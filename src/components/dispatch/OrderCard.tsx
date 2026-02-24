import { Clock, MapPin, DollarSign, Zap, User } from 'lucide-react';
import { Order } from '../../types';

interface OrderCardProps {
    order: Order;
    onAssign: (order: Order) => void;
    onAutoAssign: (order: Order) => void;
    assigning?: boolean;
}

const PRIORITY_CONFIG = {
    urgent: { label: 'Urgente', cls: 'bg-red-100 text-red-700 border border-red-200', dot: 'bg-red-500' },
    high: { label: 'Alta', cls: 'bg-amber-100 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
    normal: { label: 'Normal', cls: 'bg-green-100 text-green-700 border border-green-200', dot: 'bg-green-500' },
};

export default function OrderCard({ order, onAssign, onAutoAssign, assigning }: OrderCardProps) {
    const pri = PRIORITY_CONFIG[order.priority] ?? PRIORITY_CONFIG.normal;
    const createdTime = new Date(order.created_at).toLocaleTimeString('es-MX', {
        hour: '2-digit', minute: '2-digit',
    });

    return (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${pri.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
                        {pri.label}
                    </span>
                    <span className="text-xs text-gray-400 font-mono truncate">{order.order_number}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0 ml-2">
                    <Clock className="w-3 h-3" />
                    {createdTime}
                </div>
            </div>

            {/* Customer */}
            <div className="flex items-center gap-1.5 mb-2">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-sm font-medium text-gray-800 truncate">
                    {order.customer_name ?? 'Cliente sin nombre'}
                </span>
            </div>

            {/* Addresses */}
            <div className="flex items-start gap-1.5 mb-3">
                <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs text-gray-600 leading-tight min-w-0">
                    <p className="truncate text-gray-500">↑ {order.pickup_address?.street ?? '—'}</p>
                    <p className="truncate font-medium text-gray-700 mt-0.5">
                        ↓ {order.delivery_address?.street ?? '—'}
                    </p>
                </div>
            </div>

            {/* Amount + actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-green-700 font-semibold text-sm">
                    <DollarSign className="w-3.5 h-3.5" />
                    {(order.total_amount ?? 0).toFixed(2)}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => onAutoAssign(order)}
                        disabled={assigning}
                        title="Auto-asignar"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Zap className="w-3 h-3" />
                        Auto
                    </button>
                    <button
                        onClick={() => onAssign(order)}
                        disabled={assigning}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                        Asignar
                    </button>
                </div>
            </div>
        </div>
    );
}
