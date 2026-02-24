import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Order, OrderItemDraft, OrderWithItems } from '../types';
import {
    createOrderWithItems,
    updateOrderStatus,
    assignOrderToDriver,
    deleteOrderById,
} from '../lib/orderSync';
import { useRealtimeOrders } from './useRealtimeSync';

interface UseOrdersOptions {
    /** Filter the fetched orders by status */
    statusFilter?: string;
    /** If provided, only load orders assigned to this driver id */
    driverFilter?: string;
}

interface UseOrdersReturn {
    orders: OrderWithItems[];
    loading: boolean;
    error: string | null;
    reload: () => void;
    createOrder: (
        orderData: Partial<Order>,
        items: OrderItemDraft[]
    ) => Promise<void>;
    changeStatus: (orderId: string, status: string, userId?: string) => Promise<void>;
    assignDriver: (orderId: string, driverId: string, assignedById: string) => Promise<void>;
    removeOrder: (orderId: string) => Promise<void>;
}

export function useOrders(options: UseOrdersOptions = {}): UseOrdersReturn {
    const { statusFilter, driverFilter } = options;
    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Use a ref so the realtime callback doesn't become stale
    const loadRef = useRef<() => void>();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('orders')
                .select(`
          *,
          order_items(*),
          driver:assigned_driver_id(
            id, vehicle_plate, vehicle_type,
            profiles:user_id(full_name)
          )
        `)
                .order('created_at', { ascending: false });

            if (statusFilter && statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            if (driverFilter) {
                query = query.eq('assigned_driver_id', driverFilter);
            }

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            setOrders((data as OrderWithItems[]) || []);
        } catch (err) {
            console.error('useOrders load error:', err);
            setError('Error al cargar los pedidos');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, driverFilter]);

    // Keep ref up to date
    loadRef.current = load;

    useEffect(() => {
        load();
    }, [load]);

    // Stable callback for real-time that always calls the latest load
    const realtimeCallback = useCallback(() => {
        loadRef.current?.();
    }, []);

    useRealtimeOrders(realtimeCallback);

    const createOrder = useCallback(
        async (orderData: Partial<Order>, items: OrderItemDraft[]) => {
            await createOrderWithItems(orderData, items);
            await load();
        },
        [load]
    );

    const changeStatus = useCallback(
        async (orderId: string, status: string, userId?: string) => {
            await updateOrderStatus(orderId, status, userId);
            await load();
        },
        [load]
    );

    const assignDriver = useCallback(
        async (orderId: string, driverId: string, assignedById: string) => {
            await assignOrderToDriver(orderId, driverId, assignedById);
            await load();
        },
        [load]
    );

    const removeOrder = useCallback(
        async (orderId: string) => {
            await deleteOrderById(orderId);
            await load();
        },
        [load]
    );

    return {
        orders,
        loading,
        error,
        reload: load,
        createOrder,
        changeStatus,
        assignDriver,
        removeOrder,
    };
}
