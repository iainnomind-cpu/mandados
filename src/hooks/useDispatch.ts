import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Order, DriverWithProfile } from '../types';
import { autoAssignOrder, manualAssignOrder, fetchDriversWithProfiles } from '../lib/dispatchSync';
import { useRealtimeOrders, useRealtimeDrivers } from './useRealtimeSync';

interface UseDispatchReturn {
    unassignedOrders: Order[];
    drivers: DriverWithProfile[];
    loading: boolean;
    error: string | null;
    reload: () => void;
    autoAssign: (orderId: string, dispatcherId: string) => Promise<void>;
    manualAssign: (orderId: string, driverId: string, dispatcherId: string) => Promise<void>;
}

export function useDispatch(): UseDispatchReturn {
    const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([]);
    const [drivers, setDrivers] = useState<DriverWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadRef = useRef<() => void>();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [ordersRes, driversData] = await Promise.all([
                supabase
                    .from('orders')
                    .select('*')
                    .in('status', ['pending', 'confirmed'])
                    .order('priority', { ascending: false })
                    .order('created_at', { ascending: true }),
                fetchDriversWithProfiles(),
            ]);

            if (ordersRes.error) throw ordersRes.error;
            setUnassignedOrders((ordersRes.data as Order[]) ?? []);
            setDrivers(driversData);
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

    const autoAssign = useCallback(
        async (orderId: string, dispatcherId: string) => {
            await autoAssignOrder(orderId, dispatcherId);
            await load();
        },
        [load]
    );

    const manualAssign = useCallback(
        async (orderId: string, driverId: string, dispatcherId: string) => {
            await manualAssignOrder(orderId, driverId, dispatcherId);
            await load();
        },
        [load]
    );

    return { unassignedOrders, drivers, loading, error, reload: load, autoAssign, manualAssign };
}
