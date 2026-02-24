import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, MapPin, Navigation } from 'lucide-react';
import { DriverRoute, RouteStop } from '../../types';

interface RoutePanelProps {
    routes: DriverRoute[];
    loading: boolean;
    onCompleteStop: (stop: RouteStop, route: DriverRoute) => void;
}

const STOP_STATUS = {
    pending: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' },
    reached: { label: 'En lugar', cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Completado', cls: 'bg-emerald-100 text-emerald-700' },
};

function StopRow({
    stop,
    route,
    onComplete,
}: {
    stop: RouteStop;
    route: DriverRoute;
    onComplete: (stop: RouteStop, route: DriverRoute) => void;
}) {
    const st = STOP_STATUS[stop.status] ?? STOP_STATUS.pending;
    return (
        <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-gray-50 rounded-lg transition-colors">
            {/* Sequence bubble */}
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {stop.stop_sequence}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">
                    {stop.order?.order_number ?? stop.order_id.slice(0, 8)}
                </p>
                {stop.order?.delivery_address && (
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {(stop.order.delivery_address as { street?: string })?.street ?? '—'}
                    </p>
                )}
                {stop.estimated_arrival && (
                    <p className="text-xs text-indigo-500 mt-0.5">
                        ETA: {new Date(stop.estimated_arrival).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                )}
            </div>

            {/* Status + action */}
            <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
                    {st.label}
                </span>
                {stop.status !== 'completed' && (
                    <button
                        onClick={() => onComplete(stop, route)}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completar
                    </button>
                )}
            </div>
        </div>
    );
}

function RouteCard({
    route,
    onCompleteStop,
}: {
    route: DriverRoute;
    onCompleteStop: (stop: RouteStop, route: DriverRoute) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const stops = route.route_stops ?? [];
    const completed = stops.filter((s) => s.status === 'completed').length;
    const driverName = route.driver?.profiles?.full_name ?? route.driver?.vehicle_plate ?? 'Conductor';

    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Navigation className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="min-w-0 text-left">
                        <p className="text-sm font-semibold text-gray-900 truncate">{driverName}</p>
                        <p className="text-xs text-gray-400">
                            {route.route_date} · {completed}/{stops.length} paradas
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: stops.length ? `${(completed / stops.length) * 100}%` : '0%' }}
                        />
                    </div>
                    {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>
            </button>

            {/* Stops */}
            {expanded && stops.length > 0 && (
                <div className="border-t border-gray-50 px-1 pb-1">
                    {stops
                        .slice()
                        .sort((a, b) => a.stop_sequence - b.stop_sequence)
                        .map((stop) => (
                            <StopRow key={stop.id} stop={stop} route={route} onComplete={onCompleteStop} />
                        ))}
                </div>
            )}
            {expanded && stops.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Sin paradas</p>
            )}
        </div>
    );
}

export default function RoutePanel({ routes, loading, onCompleteStop }: RoutePanelProps) {
    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                {[1, 2].map((i) => (
                    <div key={i} className="bg-gray-100 rounded-xl h-24" />
                ))}
            </div>
        );
    }

    if (routes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Navigation className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-medium">Sin rutas activas</p>
                <p className="text-xs mt-1">Las rutas aparecerán al asignar pedidos</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {routes.map((route) => (
                <RouteCard key={route.id} route={route} onCompleteStop={onCompleteStop} />
            ))}
        </div>
    );
}
