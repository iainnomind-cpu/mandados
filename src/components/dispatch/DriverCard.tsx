import { Truck, Package, Wifi, WifiOff } from 'lucide-react';
import { DriverWithProfile } from '../../types';

interface DriverCardProps {
    driver: DriverWithProfile;
    onSelect?: (driver: DriverWithProfile) => void;
    selected?: boolean;
    compact?: boolean;
}

const STATUS_CONFIG = {
    available: { label: 'Disponible', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500 animate-pulse' },
    busy: { label: 'Ocupado', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    offline: { label: 'Desconect.', cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
    suspended: { label: 'Suspendido', cls: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

const MAX_LOAD = 5; // visual cap for load bar

export default function DriverCard({ driver, onSelect, selected, compact }: DriverCardProps) {
    const st = STATUS_CONFIG[driver.status] ?? STATUS_CONFIG.offline;
    const loadPct = Math.min(100, ((driver.active_load_count ?? 0) / MAX_LOAD) * 100);
    const loadColor = loadPct >= 80 ? 'bg-red-500' : loadPct >= 50 ? 'bg-amber-400' : 'bg-emerald-500';
    const driverName = driver.profiles?.full_name ?? driver.vehicle_plate ?? 'Conductor';
    const hasGps = driver.current_lat != null && driver.current_lng != null;
    const isAvailable = driver.status === 'available';

    return (
        <div
            onClick={() => isAvailable && onSelect?.(driver)}
            className={`
        bg-white border rounded-xl p-4 transition-all
        ${selected ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' : 'border-gray-100 shadow-sm'}
        ${isAvailable && onSelect ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''}
        ${compact ? 'p-3' : ''}
      `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{driverName}</p>
                        <p className="text-xs text-gray-400 truncate">
                            {driver.vehicle_type ?? '—'} {driver.vehicle_plate ? `· ${driver.vehicle_plate}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                    </span>
                    {hasGps ? (
                        <span className="flex items-center gap-1 text-xs text-blue-500">
                            <Wifi className="w-3 h-3" /> GPS activo
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <WifiOff className="w-3 h-3" /> Sin GPS
                        </span>
                    )}
                </div>
            </div>

            {/* Load bar */}
            <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" /> Carga activa
                    </span>
                    <span className="font-semibold text-gray-700">
                        {driver.active_load_count ?? 0} pedidos
                    </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${loadColor}`}
                        style={{ width: `${loadPct}%` }}
                    />
                </div>
            </div>

            {/* Stats */}
            {!compact && (
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50">
                    <div className="text-center">
                        <p className="text-xs text-gray-400">Entregas</p>
                        <p className="font-bold text-gray-700">{driver.total_deliveries ?? 0}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-400">Rating</p>
                        <p className="font-bold text-gray-700">⭐ {(driver.rating ?? 0).toFixed(1)}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
