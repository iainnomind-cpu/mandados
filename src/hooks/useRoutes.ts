import { useState, useCallback, useEffect, useRef } from 'react';
import { DriverRoute } from '../types';
import { fetchActiveRoutesWithStops, completeRouteStop } from '../lib/dispatchSync';
import { useRealtimeDriverRoutes, useRealtimeRouteStops } from './useRealtimeSync';

interface UseRoutesReturn {
    routes: DriverRoute[];
    loading: boolean;
    error: string | null;
    reload: () => void;
    completeStop: (
        stopId: string,
        routeId: string,
        orderId: string,
        driverId: string
    ) => Promise<void>;
}

export function useRoutes(): UseRoutesReturn {
    const [routes, setRoutes] = useState<DriverRoute[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadRef = useRef<() => void>();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchActiveRoutesWithStops();
            setRoutes(data);
        } catch (err: unknown) {
            console.error('[useRoutes] load error:', err);
            setError('Error al cargar rutas activas');
        } finally {
            setLoading(false);
        }
    }, []);

    loadRef.current = load;

    useEffect(() => { load(); }, [load]);

    const stableCallback = useCallback(() => { loadRef.current?.(); }, []);
    useRealtimeDriverRoutes(stableCallback);
    useRealtimeRouteStops(stableCallback);

    const completeStop = useCallback(
        async (stopId: string, routeId: string, orderId: string, driverId: string) => {
            await completeRouteStop(stopId, routeId, orderId, driverId);
            await load();
        },
        [load]
    );

    return { routes, loading, error, reload: load, completeStop };
}
