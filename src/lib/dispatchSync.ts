import { supabase } from './supabase';
import { DriverWithProfile, DriverRoute, RouteStop } from '../types';

// ============================================================
// Haversine distance helper (km)
// ============================================================
function haversineKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// Pick the best available driver
// ============================================================
export async function pickBestDriver(
    orderLat?: number | null,
    orderLng?: number | null
): Promise<DriverWithProfile | null> {
    const { data: drivers, error } = await supabase
        .from('drivers')
        .select('*, profiles:user_id(full_name)')
        .eq('status', 'available')
        .order('active_load_count', { ascending: true });

    if (error || !drivers || drivers.length === 0) return null;

    // If we have order coordinates, prefer nearest with lowest load
    if (orderLat != null && orderLng != null) {
        const scored = (drivers as DriverWithProfile[]).map((d) => {
            const dist =
                d.current_lat != null && d.current_lng != null
                    ? haversineKm(d.current_lat, d.current_lng, orderLat!, orderLng!)
                    : 9999;
            // Score: load * 10 + distance (km), lower is better
            return { driver: d, score: (d.active_load_count ?? 0) * 10 + dist };
        });
        scored.sort((a, b) => a.score - b.score);
        return scored[0].driver;
    }

    // Fallback: just lowest load
    return (drivers as DriverWithProfile[])[0];
}

// ============================================================
// Get or create today's driver_route
// ============================================================
export async function createOrGetDriverRoute(
    driverId: string,
    date?: string
): Promise<DriverRoute> {
    const routeDate = date ?? new Date().toISOString().slice(0, 10);

    // Try to find existing active route
    const { data: existing } = await supabase
        .from('driver_routes')
        .select('*')
        .eq('driver_id', driverId)
        .eq('route_date', routeDate)
        .maybeSingle();

    if (existing) return existing as DriverRoute;

    // Create new
    const { data: created, error } = await supabase
        .from('driver_routes')
        .insert([{ driver_id: driverId, route_date: routeDate, status: 'active' }])
        .select()
        .single();

    if (error) throw error;
    return created as DriverRoute;
}

// ============================================================
// Add a stop to a route
// ============================================================
export async function addRouteStop(
    routeId: string,
    orderId: string,
    stopSequence?: number,
    estimatedArrival?: string
): Promise<RouteStop> {
    // Determine next sequence if not provided
    let sequence = stopSequence;
    if (sequence == null) {
        const { count } = await supabase
            .from('route_stops')
            .select('*', { count: 'exact', head: true })
            .eq('route_id', routeId);
        sequence = (count ?? 0) + 1;
    }

    const { data, error } = await supabase
        .from('route_stops')
        .insert([
            {
                route_id: routeId,
                order_id: orderId,
                stop_sequence: sequence,
                estimated_arrival: estimatedArrival ?? null,
                status: 'pending',
            },
        ])
        .select()
        .single();

    if (error) throw error;
    return data as RouteStop;
}

// ============================================================
// Auto-assign order (proximity + load based)
// ============================================================
export async function autoAssignOrder(
    orderId: string,
    dispatcherId: string
): Promise<{ driverId: string; routeId: string; stopId: string }> {
    // Fetch order
    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, status, pickup_address')
        .eq('id', orderId)
        .single();

    if (orderErr || !order) throw new Error('Pedido no encontrado');
    if (!['pending', 'confirmed'].includes(order.status)) {
        throw new Error(`El pedido no se puede despachar (estado: ${order.status})`);
    }

    // Resolve order coordinates from pickup_address JSON
    const pickup = order.pickup_address as { coordinates?: { lat: number; lng: number } };
    const orderLat = pickup?.coordinates?.lat ?? null;
    const orderLng = pickup?.coordinates?.lng ?? null;

    const driver = await pickBestDriver(orderLat, orderLng);
    if (!driver) throw new Error('No hay conductores disponibles');

    return manualAssignOrder(orderId, driver.id, dispatcherId);
}

// ============================================================
// Manual assign order to a specific driver
// ============================================================
export async function manualAssignOrder(
    orderId: string,
    driverId: string,
    dispatcherId: string
): Promise<{ driverId: string; routeId: string; stopId: string }> {
    // Validate driver availability
    const { data: driver, error: driverErr } = await supabase
        .from('drivers')
        .select('id, status')
        .eq('id', driverId)
        .single();

    if (driverErr || !driver) throw new Error('Conductor no encontrado');
    if (driver.status !== 'available') {
        throw new Error('El conductor no está disponible');
    }

    // Update order: status → assigned, assigned_driver_id
    const { error: orderUpdateErr } = await supabase
        .from('orders')
        .update({ status: 'assigned', assigned_driver_id: driverId })
        .eq('id', orderId);
    if (orderUpdateErr) throw orderUpdateErr;

    // Increment driver active_load_count
    const { data: driverCurrent } = await supabase
        .from('drivers')
        .select('active_load_count')
        .eq('id', driverId)
        .single();

    await supabase
        .from('drivers')
        .update({ active_load_count: (driverCurrent?.active_load_count ?? 0) + 1 })
        .eq('id', driverId);

    // Insert into assignments (OMS assignment record)
    await supabase.from('assignments').insert([
        {
            order_id: orderId,
            driver_id: driverId,
            assigned_by: dispatcherId,
            status: 'assigned',
        },
    ]);

    // Log event
    await supabase.from('order_events').insert([
        {
            order_id: orderId,
            event_type: 'assigned',
            description: 'Pedido asignado a conductor desde TMS',
            user_id: dispatcherId,
            metadata: { driver_id: driverId },
        },
    ]);

    // Create/get today's route for driver
    const route = await createOrGetDriverRoute(driverId);

    // Add route stop
    const stop = await addRouteStop(route.id, orderId);

    return { driverId, routeId: route.id, stopId: stop.id };
}

// ============================================================
// Complete a route stop → cascade to order / route / finance
// ============================================================
export async function completeRouteStop(
    stopId: string,
    routeId: string,
    orderId: string,
    driverId: string
): Promise<void> {
    const now = new Date().toISOString();

    // Mark stop as completed
    await supabase
        .from('route_stops')
        .update({ status: 'completed' })
        .eq('id', stopId);

    // Update order to completed
    await supabase
        .from('orders')
        .update({ status: 'delivered', updated_at: now })
        .eq('id', orderId);

    // Decrement driver active_load_count
    const { data: driverData } = await supabase
        .from('drivers')
        .select('active_load_count, total_deliveries')
        .eq('id', driverId)
        .single();

    const newLoad = Math.max(0, (driverData?.active_load_count ?? 1) - 1);
    await supabase
        .from('drivers')
        .update({
            active_load_count: newLoad,
            total_deliveries: (driverData?.total_deliveries ?? 0) + 1,
            status: newLoad === 0 ? 'available' : 'busy',
        })
        .eq('id', driverId);

    // Check if all stops in this route are completed
    const { count: pendingCount } = await supabase
        .from('route_stops')
        .select('*', { count: 'exact', head: true })
        .eq('route_id', routeId)
        .neq('status', 'completed');

    if (pendingCount === 0) {
        await supabase
            .from('driver_routes')
            .update({ status: 'completed' })
            .eq('id', routeId);
    }

    // Notify finance module
    await notifyFinanceDeliveryCompleted(orderId, driverId);

    // Log event
    await supabase.from('order_events').insert([
        {
            order_id: orderId,
            event_type: 'delivered',
            description: 'Pedido entregado confirmado por conductor (TMS)',
            metadata: { stop_id: stopId, route_id: routeId },
        },
    ]);
}

// ============================================================
// Update driver GPS position (called by driver app)
// ============================================================
export async function updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number
): Promise<void> {
    await supabase
        .from('drivers')
        .update({ current_lat: lat, current_lng: lng })
        .eq('id', driverId);

    // Also insert into driver_locations for historical tracking
    await supabase.from('driver_locations').insert([
        { driver_id: driverId, latitude: lat, longitude: lng },
    ]);
}

// ============================================================
// Outbound: Notify Finance module when delivery completed
// ============================================================
export async function notifyFinanceDeliveryCompleted(
    orderId: string,
    driverId: string
): Promise<void> {
    const { data: order } = await supabase
        .from('orders')
        .select('total_amount, delivery_fee, payment_method')
        .eq('id', orderId)
        .single();

    if (order && order.payment_method === 'cash') {
        await supabase.from('transactions').insert([
            {
                order_id: orderId,
                driver_id: driverId,
                transaction_type: 'collection',
                amount: (order.total_amount ?? 0) + (order.delivery_fee ?? 0),
                payment_method: 'cash',
                status: 'pending',
            },
        ]);
    }

    // Event bus placeholder for other finance notifications
    console.info('[TMS→Finance] Delivery completed event', { orderId, driverId });
}

// ============================================================
// Outbound: Send ETA update to Client module (placeholder)
// ============================================================
export function sendEtaUpdate(
    orderId: string,
    eta: string,
    driverLocation?: { lat: number; lng: number }
): void {
    // TODO: Integrate with client-facing notification service (push/SMS/webhook)
    console.info('[TMS→Client] ETA update', { orderId, eta, driverLocation });
}

// ============================================================
// Fetch active routes with stops for dispatcher view
// ============================================================
export async function fetchActiveRoutesWithStops(): Promise<DriverRoute[]> {
    const { data, error } = await supabase
        .from('driver_routes')
        .select(`
      *,
      driver:driver_id(
        id, vehicle_type, vehicle_plate, status, active_load_count, current_lat, current_lng,
        profiles:user_id(full_name)
      ),
      route_stops(
        id, stop_sequence, status, estimated_arrival, order_id,
        order:order_id(order_number, customer_name, delivery_address, priority, total_amount)
      )
    `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as DriverRoute[];
}

// ============================================================
// Fetch drivers with profiles for dispatch UI
// ============================================================
export async function fetchDriversWithProfiles(): Promise<DriverWithProfile[]> {
    const { data, error } = await supabase
        .from('drivers')
        .select('*, profiles:user_id(full_name)')
        .in('status', ['available', 'busy'])
        .order('active_load_count', { ascending: true });

    if (error) throw error;
    return (data ?? []) as DriverWithProfile[];
}
