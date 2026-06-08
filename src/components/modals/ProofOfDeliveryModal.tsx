import { useState } from 'react';
import { X, CheckCircle2, DollarSign, Camera, CreditCard, Banknote } from 'lucide-react';
import { DriverRoute, RouteStop } from '../../types';

interface ProofOfDeliveryModalProps {
    stop: RouteStop;
    route: DriverRoute;
    onClose: () => void;
    onConfirm: (
        stop: RouteStop,
        route: DriverRoute,
        podData: { collectedAmount: number; paymentMethod: 'cash' | 'transfer' | 'card'; proofDelivered: boolean }
    ) => Promise<void>;
}

export default function ProofOfDeliveryModal({ stop, route, onClose, onConfirm }: ProofOfDeliveryModalProps) {
    const [collectedAmount] = useState<string>(
        stop.order ? (stop.order.total_amount ?? 0).toString() : '0'
    );
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
    const [proofDelivered, setProofDelivered] = useState<boolean>(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConfirm = async () => {
        const amountVal = parseFloat(collectedAmount);
        if (isNaN(amountVal) || amountVal < 0) {
            setError('Por favor, ingresa un monto válido.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await onConfirm(stop, route, { collectedAmount: amountVal, paymentMethod, proofDelivered });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(errorMsg || 'Error al completar la entrega.');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                            <CheckCircle2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Confirmar Entrega</h2>
                            <p className="text-xs text-slate-500 font-mono">{stop.order?.order_number || 'Orden Desconocida'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                        disabled={loading}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            Monto Cobrado Exacto (COD)
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={collectedAmount}
                                readOnly
                                disabled
                                className="w-full pl-8 pr-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-2xl focus:outline-none font-bold text-lg text-slate-500 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                            Método de Pago
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setPaymentMethod('cash')}
                                className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${paymentMethod === 'cash' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                <Banknote className="w-5 h-5" />
                                <span className="text-xs">Efectivo</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('transfer')}
                                className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${paymentMethod === 'transfer' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                <DollarSign className="w-5 h-5" />
                                <span className="text-xs">Transfer</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('card')}
                                className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${paymentMethod === 'card' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                <CreditCard className="w-5 h-5" />
                                <span className="text-xs">Tarjeta</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 flex items-center gap-2">
                            <Camera className="w-4 h-4 text-slate-400" />
                            Prueba de Entrega
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setProofDelivered(true)}
                                className={`py-3 px-4 rounded-2xl border text-sm font-medium transition-all ${proofDelivered ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                Sí entregó prueba de entrega
                            </button>
                            <button
                                onClick={() => setProofDelivered(false)}
                                className={`py-3 px-4 rounded-2xl border text-sm font-medium transition-all ${!proofDelivered ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                No entregó prueba de Entrega
                            </button>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg text-lg ${loading ? 'bg-slate-400 shadow-none' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                                }`}
                        >
                            {loading ? 'Procesando...' : 'Completar Entrega'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
