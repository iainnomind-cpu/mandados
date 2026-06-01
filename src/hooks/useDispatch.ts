import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Order, DriverWithProfile } from '../types';
import { fetchDriversWithProfiles } from '../lib/dispatchSync';
import { useRealtimeOrders, useRealtimeDrivers } from './useRealtimeSync';

/** Order assigned to a driver (lightweight projection for dispatch view) */
export interface DriverAssignedOrder {
    id: string;
    order_number: string;
    customer_name: string | null;
    status: string;
    total_amount: number;
    created_at: string;
}

/** Driver enriched with their currently assigned orders */
export interface DriverWithOrders extends DriverWithProfile {
    assignedOrders: DriverAssignedOrder[];
    hasProblem: boolean;
}

interface UseDispatchReturn {
    /** Drivers in shift with their assigned orders */
    driversWithOrders: DriverWithOrders[];
    /** Orders currently flagged as 'problem' (for alerts panel) */
    problemOrders: (Order & { driverName?: string })[];
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export function useDispatch(): UseDispatchReturn {
    const [driversWithOrders, setDriversWithOrders] = useState<DriverWithOrders[]>([]);
    const [problemOrders, setProblemOrders] = useState<(Order & { driverName?: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadRef = useRef<() => void>();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch all active drivers with profiles
            const driversData = await fetchDriversWithProfiles();

            // 2. Fetch all orders currently assigned/in_transit/problem
            const { data: activeOrders, error: ordersErr } = await supabase
                .from('orders')
                .select('id, order_number, customer_name, status, total_amount, assigned_driver_id, created_at')
                .in('status', ['assigned', 'in_transit', 'problem'])
                .order('created_at', { ascending: true });

            if (ordersErr) throw ordersErr;

            const ordersList = (activeOrders ?? []) as (DriverAssignedOrder & { assigned_driver_id: string })[];

            // 3. Group orders by driver
            const ordersByDriver = new Map<string, DriverAssignedOrder[]>();
            for (const o of ordersList) {
                if (!o.assigned_driver_id) continue;
                const existing = ordersByDriver.get(o.assigned_driver_id) ?? [];
                existing.push({
                    id: o.id,
                    order_number: o.order_number,
                    customer_name: o.customer_name,
                    status: o.status,
                    total_amount: o.total_amount,
                    created_at: o.created_at,
                });
                ordersByDriver.set(o.assigned_driver_id, existing);
            }

            // 4. Build enriched driver list
            const enriched: DriverWithOrders[] = driversData.map((driver) => {
                const assignedOrders = ordersByDriver.get(driver.id) ?? [];
                const hasProblem = assignedOrders.some((o) => o.status === 'problem');
                return { ...driver, assignedOrders, hasProblem };
            });

            // Sort: drivers with problems first, then by load descending
            enriched.sort((a, b) => {
                if (a.hasProblem !== b.hasProblem) return a.hasProblem ? -1 : 1;
                return (b.assignedOrders.length) - (a.assignedOrders.length);
            });

            setDriversWithOrders(enriched);

            // 5. Build problem orders list with driver name
            const problems = ordersList
                .filter((o) => o.status === 'problem')
                .map((o) => {
                    const driver = driversData.find((d) => d.id === o.assigned_driver_id);
                    const driverName = driver?.profiles?.full_name ?? driver?.full_name ?? 'Sin conductor';
                    return { ...o, driverName } as Order & { driverName?: string };
                });
            setProblemOrders(problems);
        } catch (err: unknown) {
            console.error('[useDispatch] load error:', err);
            setError('Error al cargar datos de despacho');
        } finally {
            setLoading(false);
        }
    }, []);

    loadRef.current = load;

    useEffect(() => { load(); }, [load]);

    const stableCallback = useCallback(() => { loadRef.current?.(); }, []);
    useRealtimeOrders(stableCallback);
    useRealtimeDrivers(stableCallback);

    return { driversWithOrders, problemOrders, loading, error, reload: load };
}
