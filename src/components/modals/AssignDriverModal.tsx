import { useState } from 'react';
import { X, User, Truck, ShieldCheck, AlertCircle, RefreshCcw } from 'lucide-react';
import { manualAssignOrder } from '../../lib/dispatchSync';
import { Order, DriverWithProfile } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';

interface AssignDriverModalProps {
  order: Order;
  drivers: DriverWithProfile[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignDriverModal({ order, drivers, onClose, onSuccess }: AssignDriverModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableDrivers = drivers.filter(d => d.status === 'available');

  const handleAssign = async () => {
    if (!selectedDriverId) {
      setError('Selecciona un conductor');
      return;
    }

    if (!user?.id) {
      setError('Sesión inválida. Recarga la página.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await manualAssignOrder(
        order.id,
        selectedDriverId,
        user.id
      );

      showToast(`Pedido ${order.order_number} asignado correctamente`, 'success');
      onSuccess();
    } catch (err: any) {
      console.error('Assign error:', err);
      setError(err.message || 'Error al asignar conductor');
      showToast('No se pudo completar la asignación', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Asignar Orden</h2>
              <p className="text-xs text-slate-500 font-mono">{order.order_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-sm flex gap-3 items-start animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Info Card */}
          <div className="bg-slate-50 rounded-2xl p-4 flex gap-4 border border-slate-100">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-200/50">
              <User className="w-6 h-6 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente</p>
              <p className="font-bold text-slate-900 truncate">{order.customer_name || 'Desconocido'}</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{order.delivery_address?.street || 'Sin dirección'}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3 ml-1 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-500" />
              Seleccionar Conductor
            </label>
            {availableDrivers.length === 0 ? (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-slate-400">No hay conductores disponibles</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Espera a que alguien se libere</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                {availableDrivers.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-2xl transition-all border text-left
                      ${selectedDriverId === driver.id
                        ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/10'
                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                      }
                    `}
                  >
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
                      ${selectedDriverId === driver.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}
                    `}>
                      <Truck className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">
                        {driver.profiles?.full_name || driver.vehicle_plate || 'Conductor'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter truncate">
                        {driver.vehicle_type} · {driver.vehicle_plate}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900">⭐ {driver.rating.toFixed(1)}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{driver.active_load_count} CARGA</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-4 border-2 border-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 hover:border-slate-200 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleAssign}
              disabled={loading || !selectedDriverId}
              className={`
                flex-1 px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl transition-all shadow-lg 
                ${!loading && selectedDriverId ? 'hover:bg-blue-700 shadow-blue-200' : 'opacity-50 grayscale shadow-none'}
              `}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  <span>Asignando...</span>
                </div>
              ) : (
                'Confirmar Asignación'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

