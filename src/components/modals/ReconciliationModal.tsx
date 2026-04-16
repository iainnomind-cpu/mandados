import { useState, useEffect, useMemo } from 'react';
import { X, RefreshCcw, DollarSign, CheckSquare, Square } from 'lucide-react';
import { calculateDriverRemittance, processRemittance } from '../../lib/financesSync';
import { Driver } from '../../types';

interface ReconciliationModalProps {
  drivers: Driver[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReconciliationModal({ drivers, onClose, onSuccess }: ReconciliationModalProps) {
  const [driverId, setDriverId] = useState('');
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');

  const [calculations, setCalculations] = useState<{
    totalAdvances: number;
    totalCollected: number;
    driverCommissions: number;
    netRemittanceDue: number;
    pendingTransactionIds: string[];
    orderBreakdown: Array<{
      orderId: string;
      orderNumber: string;
      advances: number;
      collected: number;
      commission: number;
      net: number;
      transactionIds: string[];
    }>;
  } | null>(null);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Fetch calculations whenever driver changes
  useEffect(() => {
    if (!driverId) {
      setCalculations(null);
      return;
    }

    const fetchCalculations = async () => {
      setCalculating(true);
      setError('');
      try {
        const result = await calculateDriverRemittance(driverId);
        setCalculations(result as any);
        // Default to all selected
        setSelectedOrderIds(result.orderBreakdown.map((ob: any) => ob.orderId));
      } catch (err: any) {
        setError(err.message || 'Error al calcular totales');
        setCalculations(null);
        setSelectedOrderIds([]);
      } finally {
        setCalculating(false);
      }
    };

    fetchCalculations();
  }, [driverId]);

  const selectedTotals = useMemo(() => {
    if (!calculations) return null;
    let advances = 0;
    let collected = 0;
    let commission = 0;
    let txIds: string[] = [];

    calculations.orderBreakdown.forEach(ob => {
      if (selectedOrderIds.includes(ob.orderId)) {
        advances += ob.advances;
        collected += ob.collected;
        commission += ob.commission;
        txIds.push(...ob.transactionIds);
      }
    });

    return {
      advances,
      collected,
      commission,
      net: collected - advances - commission,
      txIds
    };
  }, [calculations, selectedOrderIds]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleAll = () => {
    if (!calculations) return;
    if (selectedOrderIds.length === calculations.orderBreakdown.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(calculations.orderBreakdown.map(ob => ob.orderId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverId) {
      setError('Selecciona un conductor');
      return;
    }

    if (!selectedTotals || selectedTotals.txIds.length === 0) {
      setError('Debes seleccionar al menos un pedido para liquidar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await processRemittance(driverId, selectedTotals.txIds);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al crear liquidación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Generar Liquidación</h2>
              <p className="text-xs text-slate-500">Conciliación basada en COD</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
              Seleccionar Conductor
            </label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
              required
            >
              <option value="">-- Elige un conductor --</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.vehicle_plate || 'Sin placa'} - {driver.vehicle_type || 'Sin tipo'}
                </option>
              ))}
            </select>
          </div>

          {/* Removing manual input date since the new logic uses current time for remittances */}

          {calculations && calculations.orderBreakdown.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <label className="block text-sm font-bold text-slate-700">
                  Seleccionar Pedidos
                </label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {selectedOrderIds.length === calculations.orderBreakdown.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                {calculations.orderBreakdown.map((ob) => {
                  const isSelected = selectedOrderIds.includes(ob.orderId);
                  return (
                    <div
                      key={ob.orderId}
                      onClick={() => toggleOrderSelection(ob.orderId)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500/20' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                      <button type="button" className={`shrink-0 transition-colors ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                        {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm">{ob.orderNumber}</p>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">
                          Cobro: ${ob.collected.toFixed(2)} | Anti: ${ob.advances.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-black ${ob.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          ${ob.net.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
            <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
              Resumen Calculado
              {calculating && <RefreshCcw className="w-4 h-4 text-indigo-500 animate-spin" />}
            </h3>

            {selectedTotals ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Efectivo Cobrado (COD)</span>
                  <span className="font-bold text-slate-900">+ ${selectedTotals.collected.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Anticipos (Reembolso a Conductor)</span>
                  <span className="font-bold text-red-600">- ${selectedTotals.advances.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Ganancias del Conductor</span>
                  <span className="font-bold text-red-600">- ${selectedTotals.commission.toFixed(2)}</span>
                </div>

                <div className="pt-3 mt-3 border-t border-indigo-100">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-indigo-900">Monto A Entregar</span>
                    <span className="text-2xl font-black text-indigo-600">
                      ${selectedTotals.net.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-indigo-400 mt-1 uppercase tracking-wider font-bold">
                    Efectivo neto ({selectedTotals.txIds.length} transacciones)
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-indigo-400 text-center py-4 font-medium">
                Selecciona un conductor para ver el desglose automático.
              </p>
            )}
          </div>

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-slate-100 text-slate-600 rounded-2xl hover:bg-slate-50 font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || calculating || !calculations || calculations.pendingTransactionIds.length === 0}
              className={`flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-bold transition-all shadow-lg ${(loading || calculating || !calculations || calculations.pendingTransactionIds.length === 0)
                ? 'opacity-50 grayscale shadow-none'
                : 'hover:bg-indigo-700 shadow-indigo-200'
                }`}
            >
              {loading ? 'Procesando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
