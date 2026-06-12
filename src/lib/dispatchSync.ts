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
        .in('status', ['available', 'busy']);

    if (error || !drivers || drivers.length === 0) return null;

    let availableDrivers = (drivers as DriverWithProfile[]).filter(d => d.status === 'available');
    let driversToConsider = availableDrivers.length > 0 ? availableDrivers : (drivers as DriverWithProfile[]);

    // If we have order coordinates, prefer nearest with lowest load
    if (orderLat != null && orderLng != null) {
        const scored = driversToConsider.map((d) => {
            const dist =
                d.current_lat != null && d.current_lng != null
                    ? haversineKm(d.current_lat, d.current_lng, orderLat!, orderLng!)
                    : 9999;
            // Score: load * 1000 + deliveries * 10 + distance (km), lower is better
            return { driver: d, score: (d.active_load_count ?? 0) * 1000 + (d.total_deliveries ?? 0) * 10 + dist };
        });
        scored.sort((a, b) => a.score - b.score);
        return scored[0].driver;
    }

    // Fallback: just lowest load, then lowest deliveries
    driversToConsider.sort((a, b) => {
        if ((a.active_load_count ?? 0) !== (b.active_load_count ?? 0)) {
            return (a.active_load_count ?? 0) - (b.active_load_count ?? 0);
        }
        return (a.total_deliveries ?? 0) - (b.total_deliveries ?? 0);
    });

    return driversToConsider[0];
}

// ============================================================
// Get or create today's driver_route
// ============================================================
export async function createOrGetDriverRoute(
    driverId: string,
    date?: string
): Promise<DriverRoute> {
    const routeDate = date ?? new Date().toISOString().slice(0, 10);

    // Try to find existing route for today
    const { data: existing } = await supabase
        .from('driver_routes')
        .select('*')
        .eq('driver_id', driverId)
        .eq('route_date', routeDate)
        .maybeSingle();

    if (existing) {
        if (existing.status !== 'active') {
            const { data: updated, error: updateError } = await supabase
                .from('driver_routes')
                .update({ status: 'active' })
                .eq('id', existing.id)
                .select()
                .single();
            if (updateError) throw updateError;
            return updated as DriverRoute;
        }
        return existing as DriverRoute;
    }

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
    dispatcherId: string,
    anticipoAmount?: number
): Promise<{ driverId: string; routeId: string; stopId: string }> {
    // Validate driver exists and is active (available or busy for multi-load)
    const { data: driver, error: driverErr } = await supabase
        .from('drivers')
        .select('id, status, active_load_count')
        .eq('id', driverId)
        .single();

    if (driverErr || !driver) throw new Error('Conductor no encontrado');
    if (driver.status !== 'available' && driver.status !== 'busy') {
        throw new Error('El conductor no está disponible');
    }

    // Enforce maximum load limit
    const MAX_LOAD_PER_DRIVER = 5;
    if ((driver.active_load_count ?? 0) >= MAX_LOAD_PER_DRIVER) {
        throw new Error(`El conductor ya tiene ${driver.active_load_count} pedidos activos. Máximo permitido: ${MAX_LOAD_PER_DRIVER}`);
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
        .update({ active_load_count: (driverCurrent?.active_load_count ?? 0) + 1, status: 'busy' })
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
            description: `Pedido asignado a conductor desde TMS${anticipoAmount ? ` - Anticipo registrado: $${anticipoAmount}` : ''}`,
            user_id: dispatcherId,
            metadata: { driver_id: driverId },
        },
    ]);

    // Handle Anticipo
    if (anticipoAmount && anticipoAmount > 0) {
        await supabase.from('cod_transactions').insert([
            {
                order_id: orderId,
                driver_id: driverId,
                transaction_type: 'anticipo',
                amount: anticipoAmount,
                status: 'pending'
            }
        ]);
    }

    // Create/get today's route for driver
    const route = await createOrGetDriverRoute(driverId);

    // Add route stop
    const stop = await addRouteStop(route.id, orderId);

    // Send WhatsApp template notification to customer (fire and forget)
    sendOrderTemplateNotification(orderId).catch((err) => {
        console.error('[TMS] Error enviando plantilla WhatsApp:', err);
    });

    return { driverId, routeId: route.id, stopId: stop.id };
}

// ============================================================
// Complete a route stop → cascade to order / route / finance
// ============================================================
export async function completeRouteStop(
    stopId: string,
    routeId: string,
    orderId: string,
    driverId: string,
    podData?: { collectedAmount: number; paymentMethod: 'cash' | 'transfer' | 'card' }
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

    // Notify finance module about general delivery completion 
    // Uses the old flow so we might consider skipping if we are using the new COD flow
    if (!podData) {
        await notifyFinanceDeliveryCompleted(orderId, driverId);
    } else {
        // Register the verified payment collection in COD transactions
        await supabase.from('cod_transactions').insert([
            {
                order_id: orderId,
                driver_id: driverId,
                transaction_type: 'cobro_cliente',
                amount: podData.collectedAmount,
                payment_method: podData.paymentMethod,
                status: 'pending'
            }
        ]);
    }

    // Log event
    await supabase.from('order_events').insert([
        {
            order_id: orderId,
            event_type: 'delivered',
            description: `Pedido entregado confirmado por conductor (TMS). ${podData ? `Monto cobrado: $${podData.collectedAmount}` : ''}`,
            metadata: { stop_id: stopId, route_id: routeId, pod_data: podData || null },
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
        await supabase.from('cod_transactions').insert([
            {
                order_id: orderId,
                driver_id: driverId,
                transaction_type: 'cobro_cliente',
                amount: order.total_amount ?? 0,
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
        order:orders(order_number, customer_name, delivery_address, priority, total_amount)
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

// ============================================================
// Send WhatsApp template notification when order is assigned
// Maps 5 parameters:
//   {{1}} = nombre_cliente
//   {{2}} = descripcion_producto
//   {{3}} = direccion_recoleccion
//   {{4}} = direccion_entrega
//   {{5}} = total (comisión)
// ============================================================
async function sendOrderTemplateNotification(orderId: string): Promise<void> {
    // Fetch the full order with customer phone
    const { data: order, error } = await supabase
        .from('orders')
        .select('customer_name, customer_phone, pickup_address, delivery_address, items, special_instructions, total_amount, delivery_fee')
        .eq('id', orderId)
        .single();

    if (error || !order) {
        console.warn('[TMS→WA] No se pudo obtener el pedido para enviar plantilla:', orderId);
        return;
    }

    // Need a phone number to send to
    const phone = order.customer_phone;
    if (!phone) {
        console.warn('[TMS→WA] Pedido sin teléfono de cliente, no se puede enviar plantilla:', orderId);
        return;
    }

    // Format phone for WhatsApp (needs country code, e.g. "521XXXXXXXXXX")
    let waPhone = phone.replace(/[^0-9]/g, '');
    if (waPhone.length === 10) {
        waPhone = `52${waPhone}`; // Add Mexico country code
    }

    // Extract the 4 parameters from the order
    const nombreCliente = order.customer_name || 'Cliente';

    // Build product description from items array
    let descripcionProducto = '';
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        descripcionProducto = order.items
            .map((item: any) => {
                const name = item.name || item.product_name || '';
                const qty = item.quantity ? `x${item.quantity}` : '';
                return `${name} ${qty}`.trim();
            })
            .filter(Boolean)
            .join(', ');
    }
    // Fallback to special_instructions if items didn't yield a description
    if (!descripcionProducto && order.special_instructions) {
        descripcionProducto = order.special_instructions
            .replace(/^Pedido tomado por WhatsApp\.\s*Artículos:\s*/i, '')
            .trim();
    }
    if (!descripcionProducto) {
        descripcionProducto = 'Tu pedido';
    }

    // Extract addresses
    const pickupAddr = order.pickup_address;
    const deliveryAddr = order.delivery_address;
    const direccionRecoleccion = typeof pickupAddr === 'string'
        ? pickupAddr
        : pickupAddr?.street || pickupAddr?.address || 'Por confirmar';
    const direccionEntrega = typeof deliveryAddr === 'string'
        ? deliveryAddr
        : deliveryAddr?.street || deliveryAddr?.address || 'Por confirmar';

    // Template name from environment or default
    const templateName = (typeof window === 'undefined' ? process.env.WHATSAPP_TEMPLATE_NAME : null) || 'asignacion_mandado_repartidor';

    console.log(`[TMS→WA] Enviando plantilla "${templateName}" a ${waPhone}:`, {
        nombre_cliente: nombreCliente,
        descripcion_producto: descripcionProducto,
        direccion_recoleccion: direccionRecoleccion,
        direccion_entrega: direccionEntrega,
    });

    try {
        const res = await fetch('/api/whatsapp-template-send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: waPhone,
                template_name: templateName,
                nombre_cliente: nombreCliente,
                descripcion_producto: descripcionProducto,
                direccion_recoleccion: direccionRecoleccion,
                direccion_entrega: direccionEntrega,
                total: `$${order.total_amount || order.delivery_fee || 0}`,
            }),
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error('[TMS→WA] Error al enviar plantilla:', errBody);
        } else {
            console.log('[TMS→WA] ✅ Plantilla enviada exitosamente');
        }
    } catch (err) {
        console.error('[TMS→WA] Excepción al enviar plantilla:', err);
    }
}
