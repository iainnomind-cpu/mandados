import { useState } from 'react';
import {
  Clock, MapPin, DollarSign, Zap, User, Package, Phone,
  ChevronDown, ChevronUp, FileText, CreditCard, MessageSquare, Hash
} from 'lucide-react';
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

const SOURCE_LABELS: Record<string, { label: string; emoji: string }> = {
    chatbot: { label: 'WhatsApp Bot', emoji: '🤖' },
    phone: { label: 'Teléfono', emoji: '📞' },
    web: { label: 'Web', emoji: '🌐' },
    restaurant: { label: 'Restaurante', emoji: '🍽️' },
};

const PAYMENT_LABELS: Record<string, string> = {
    cash: '💵 Efectivo',
    card: '💳 Tarjeta',
    transfer: '🏦 Transferencia',
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pendiente', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    paid: { label: 'Pagado', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    cod: { label: 'Contra entrega', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
};

export default function OrderCard({ order, onAssign, onAutoAssign, assigning }: OrderCardProps) {
    const [expanded, setExpanded] = useState(false);
    const pri = PRIORITY_CONFIG[order.priority] ?? PRIORITY_CONFIG.normal;
    const source = SOURCE_LABELS[order.source] ?? { label: order.source, emoji: '📦' };
    const payment = PAYMENT_LABELS[order.payment_method] ?? order.payment_method;
    const payStatus = PAYMENT_STATUS_LABELS[order.payment_status] ?? { label: order.payment_status, cls: 'text-gray-600 bg-gray-50 border-gray-200' };

    const createdTime = new Date(order.created_at).toLocaleTimeString('es-MX', {
        hour: '2-digit', minute: '2-digit',
    });
    const createdDate = new Date(order.created_at).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'short',
    });

    // Format items list
    const itemsList = order.items?.map(item => {
        const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
        return `${qty}${item.name}`;
    }).join(', ') || '—';

    return (
        <div className={`bg-white border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ${
            expanded ? 'border-blue-200 shadow-blue-100/50' : 'border-gray-100'
        }`}>
            {/* ── Clickable Header ── */}
            <div
                className="p-4 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Top row: priority + order number + time */}
                <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${pri.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
                            {pri.label}
                        </span>
                        <span className="text-xs text-gray-400 font-mono truncate">{order.order_number}</span>
                        <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded shrink-0">
                            {source.emoji} {source.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {createdTime}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                {/* Customer */}
                <div className="flex items-center gap-1.5 mb-2">
                    <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">
                        {order.customer_name ?? 'Cliente sin nombre'}
                    </span>
                    {order.customer_phone && (
                        <span className="text-[10px] text-gray-400 ml-1">({order.customer_phone})</span>
                    )}
                </div>

                {/* Addresses - compact */}
                <div className="flex items-start gap-1.5 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-gray-600 leading-tight min-w-0">
                        <p className="truncate text-gray-500">↑ {order.pickup_address?.street ?? '—'}</p>
                        <p className="truncate font-medium text-gray-700 mt-0.5">
                            ↓ {order.delivery_address?.street ?? '—'}
                        </p>
                    </div>
                </div>

                {/* Items preview (1 line) */}
                <div className="flex items-center gap-1.5 mb-3">
                    <Package className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-xs text-gray-600 truncate">{itemsList}</span>
                </div>

                {/* Bottom: Amount + actions */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-green-700 font-semibold text-sm">
                            <DollarSign className="w-3.5 h-3.5" />
                            {(order.total_amount ?? 0).toFixed(2)}
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${payStatus.cls}`}>
                            {payStatus.label}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onAutoAssign(order); }}
                            disabled={assigning}
                            title="Auto-asignar"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Zap className="w-3 h-3" />
                            Auto
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onAssign(order); }}
                            disabled={assigning}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            Asignar
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Expanded Detail Panel ── */}
            {expanded && (
                <div className="border-t border-gray-100 bg-gradient-to-b from-slate-50/80 to-white px-4 py-4 space-y-4 animate-in">

                    {/* ─ Order Info Grid ─ */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Order Number */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100">
                            <Hash className="w-3.5 h-3.5 text-gray-400" />
                            <div>
                                <p className="text-[10px] text-gray-400 font-medium uppercase">N° Pedido</p>
                                <p className="text-xs font-bold text-gray-800">{order.order_number}</p>
                            </div>
                        </div>

                        {/* Source */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100">
                            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                            <div>
                                <p className="text-[10px] text-gray-400 font-medium uppercase">Origen</p>
                                <p className="text-xs font-bold text-gray-800">{source.emoji} {source.label}</p>
                            </div>
                        </div>

                        {/* Date/Time */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <div>
                                <p className="text-[10px] text-gray-400 font-medium uppercase">Creado</p>
                                <p className="text-xs font-bold text-gray-800">{createdDate} — {createdTime}</p>
                            </div>
                        </div>

                        {/* Payment */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100">
                            <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                            <div>
                                <p className="text-[10px] text-gray-400 font-medium uppercase">Pago</p>
                                <p className="text-xs font-bold text-gray-800">{payment}</p>
                            </div>
                        </div>
                    </div>

                    {/* ─ Customer ─ */}
                    <div className="bg-white rounded-lg border border-gray-100 p-3">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 flex items-center gap-1.5">
                            <User className="w-3 h-3" /> Cliente
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-[10px] text-gray-400">Nombre</p>
                                <p className="text-xs font-semibold text-gray-800">{order.customer_name || 'Sin nombre'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400">Teléfono</p>
                                <p className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-gray-400" />
                                    {order.customer_phone || '—'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ─ Addresses ─ */}
                    <div className="bg-white rounded-lg border border-gray-100 p-3">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" /> Direcciones
                        </p>
                        <div className="space-y-2.5">
                            <div className="flex items-start gap-2">
                                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-[10px] font-bold text-amber-700">A</span>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400">Recolección</p>
                                    <p className="text-xs font-semibold text-gray-800">
                                        {order.pickup_address?.street || '—'}
                                    </p>
                                    {order.pickup_address?.city && (
                                        <p className="text-[10px] text-gray-500">{order.pickup_address.city}</p>
                                    )}
                                    {order.pickup_contact && (
                                        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                                            <Phone className="w-2.5 h-2.5" />
                                            {order.pickup_contact.name} — {order.pickup_contact.phone}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Dotted line connector */}
                            <div className="ml-2.5 border-l-2 border-dashed border-gray-200 h-3" />

                            <div className="flex items-start gap-2">
                                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-[10px] font-bold text-blue-700">B</span>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400">Entrega</p>
                                    <p className="text-xs font-semibold text-gray-800">
                                        {order.delivery_address?.street || '—'}
                                    </p>
                                    {order.delivery_address?.city && (
                                        <p className="text-[10px] text-gray-500">{order.delivery_address.city}</p>
                                    )}
                                    {order.delivery_contact && (
                                        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                                            <Phone className="w-2.5 h-2.5" />
                                            {order.delivery_contact.name} — {order.delivery_contact.phone}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─ Items ─ */}
                    <div className="bg-white rounded-lg border border-gray-100 p-3">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 flex items-center gap-1.5">
                            <Package className="w-3 h-3" /> Artículos del pedido
                        </p>
                        {order.items && order.items.length > 0 ? (
                            <div className="space-y-1.5">
                                {order.items.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded-md">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-400 font-mono w-5">{item.quantity}x</span>
                                            <span className="text-xs text-gray-800">{item.name}</span>
                                        </div>
                                        {item.price != null && item.price > 0 && (
                                            <span className="text-xs font-semibold text-gray-600">
                                                ${(item.price * item.quantity).toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic">Sin artículos registrados</p>
                        )}
                    </div>

                    {/* ─ Special Instructions ─ */}
                    {order.special_instructions && (
                        <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                            <p className="text-[10px] text-amber-600 font-bold uppercase mb-1 flex items-center gap-1.5">
                                <FileText className="w-3 h-3" /> Instrucciones especiales
                            </p>
                            <p className="text-xs text-amber-800 whitespace-pre-wrap">{order.special_instructions}</p>
                        </div>
                    )}

                    {/* ─ Summary bar ─ */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-[10px] text-gray-400">Total</p>
                                <p className="text-sm font-bold text-emerald-700">${(order.total_amount ?? 0).toFixed(2)}</p>
                            </div>
                            {order.delivery_fee > 0 && (
                                <div>
                                    <p className="text-[10px] text-gray-400">Envío</p>
                                    <p className="text-sm font-bold text-gray-700">${order.delivery_fee.toFixed(2)}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); onAutoAssign(order); }}
                                disabled={assigning}
                                className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                            >
                                <Zap className="w-3.5 h-3.5" />
                                Auto-asignar
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onAssign(order); }}
                                disabled={assigning}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                            >
                                Asignar conductor
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
