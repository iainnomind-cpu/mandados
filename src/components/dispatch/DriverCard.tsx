import { useState } from 'react';
import { Truck, Package, ChevronDown, ChevronRight, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { DriverWithOrders, DriverAssignedOrder } from '../../hooks/useDispatch';

interface DriverCardProps {
    driver: DriverWithOrders;
    compact?: boolean;
}

/* ── Traffic‑light thresholds ─────────────────────────────── */
function getTrafficLight(count: number) {
    if (count <= 2) return { emoji: '🟢', label: 'Disponible', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' };
    if (count <= 4) return { emoji: '🟡', label: 'Ocupado', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' };
    return { emoji: '🔴', label: 'Saturado', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' };
}

/* ── Order status helpers ─────────────────────────────────── */
const ORDER_STATUS_CLS: Record<string, string> = {
    assigned: 'bg-purple-100 text-purple-700',
    in_transit: 'bg-orange-100 text-orange-700',
    problem: 'bg-rose-100 text-rose-700 animate-alert-blink',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
    assigned: 'Asignado',
    in_transit: 'En tránsito',
    problem: 'Con Problemas',
};

/* ── Mini order row inside the dropdown ───────────────────── */
function AssignedOrderRow({ order }: { order: DriverAssignedOrder }) {
    const cls = ORDER_STATUS_CLS[order.status] ?? 'bg-gray-100 text-gray-600';
    const label = ORDER_STATUS_LABEL[order.status] ?? order.status;
    const isProblem = order.status === 'problem';

    return (
        <div className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-colors ${isProblem ? 'bg-rose-50/70' : 'hover:bg-gray-50'}`}>
            {isProblem && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-alert-blink shrink-0" />}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">
                    {order.order_number}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                    {order.customer_name ?? 'Sin nombre'}
                </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
                {label}
            </span>
        </div>
    );
}

/* ── Main DriverCard ──────────────────────────────────────── */
export default function DriverCard({ driver, compact }: DriverCardProps) {
    const [expanded, setExpanded] = useState(false);
    const orders = driver.assignedOrders ?? [];
    const count = orders.length;
    const tl = getTrafficLight(count);
    const hasProblem = driver.hasProblem;

    const driverName = driver.profiles?.full_name ?? driver.full_name ?? driver.vehicle_plate ?? 'Conductor';
    const hasGps = driver.current_lat != null && driver.current_lng != null;

    return (
        <div
            className={`
                border rounded-xl transition-all overflow-hidden
                ${hasProblem
                    ? 'border-2 border-red-400 animate-alert-border bg-red-50/30'
                    : `border-gray-100 bg-white shadow-sm hover:shadow-md`
                }
                ${compact ? 'p-3' : 'p-4'}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    {/* Avatar + traffic light */}
                    <div className="relative shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            <Truck className="w-5 h-5 text-white" />
                        </div>
                        {/* Traffic light dot */}
                        <span
                            className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] ${tl.dot}`}
                            title={`${tl.label} (${count} pedidos)`}
                        />
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-gray-900 text-sm truncate">{driverName}</p>
                            {hasProblem && (
                                <AlertTriangle className="w-4 h-4 text-rose-500 animate-alert-blink shrink-0" />
                            )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                            {driver.vehicle_type ?? '—'} {driver.vehicle_plate ? `· ${driver.vehicle_plate}` : ''}
                        </p>
                    </div>
                </div>

                {/* Traffic light badge + GPS */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${tl.bg} ${tl.border} ${tl.text} border`}>
                        <span>{tl.emoji}</span>
                        {tl.label}
                    </span>
                    {hasGps ? (
                        <span className="flex items-center gap-1 text-[10px] text-blue-500">
                            <Wifi className="w-3 h-3" /> GPS
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <WifiOff className="w-3 h-3" /> Sin GPS
                        </span>
                    )}
                </div>
            </div>

            {/* Load summary bar */}
            <div className="mb-2">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors -mx-1"
                >
                    <span className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Package className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium">{count} pedido{count !== 1 ? 's' : ''} asignado{count !== 1 ? 's' : ''}</span>
                    </span>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${tl.text}`}>{count}</span>
                        {expanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        }
                    </div>
                </button>

                {/* Load progress bar */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${tl.dot}`}
                        style={{ width: `${Math.min(100, (count / 6) * 100)}%` }}
                    />
                </div>
            </div>

            {/* Expandable order list */}
            {expanded && orders.length > 0 && (
                <div className="border-t border-gray-100 pt-2 space-y-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                    {orders.map((order) => (
                        <AssignedOrderRow key={order.id} order={order} />
                    ))}
                </div>
            )}

            {expanded && orders.length === 0 && (
                <div className="border-t border-gray-100 pt-3 pb-2 text-center">
                    <p className="text-xs text-gray-400">Sin pedidos asignados</p>
                </div>
            )}

            {/* Stats footer */}
            {!compact && (
                <div className="mt-2 pt-2 border-t border-gray-50 flex justify-center">
                    <div className="text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Entregas totales</p>
                        <p className="font-bold text-gray-700 text-sm">{driver.total_deliveries ?? 0}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
