import { useState, useMemo, useEffect } from 'react';
import { X, User, Truck, ShieldCheck, AlertCircle, RefreshCcw, Search, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
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

/** Max simultaneous orders per driver */
const MAX_LOAD = 5;

/** Semaphore color based on active_load_count */
function loadColor(count: number) {
  if (count === 0) return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Libre' };
  if (count <= 2) return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: `${count} pendiente${count > 1 ? 's' : ''}` };
  return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: `Carga alta: ${count}` };
}

export default function AssignDriverModal({ order, drivers, onClose, onSuccess }: AssignDriverModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [anticipoAmount, setAnticipoAmount] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localDrivers, setLocalDrivers] = useState<DriverWithProfile[]>(drivers || []);
  const [loadingDrivers, setLoadingDrivers] = useState(!drivers || drivers.length === 0);

  // Fetch drivers if not provided by parent
  useEffect(() => {
    if (!drivers || drivers.length === 0) {
      const load = async () => {
        setLoadingDrivers(true);
        const { data } = await supabase
          .from('drivers')
          .select('*, profiles:user_id(full_name)')
          .in('status', ['available', 'busy'])
          .order('active_load_count', { ascending: true });
        setLocalDrivers((data as DriverWithProfile[]) || []);
        setLoadingDrivers(false);
      };
      load();
    }
  }, [drivers]);

  const availableDrivers = useMemo(() => {
    const filtered = localDrivers
      .filter((d) => d.status === 'available' || d.status === 'busy') // Only available/busy
      .filter((d) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const nameProfile = d.profiles?.full_name?.toLowerCase() || '';
        const nameDriver = d.full_name?.toLowerCase() || '';
        const plate = d.vehicle_plate?.toLowerCase() || '';
        return nameProfile.includes(q) || nameDriver.includes(q) || plate.includes(q);
      });

    // Sort: available first, then busy. Within each group, lowest load first, then highest rating
    const statusOrder: Record<string, number> = { available: 0, busy: 1 };
    filtered.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 2;
      const sb = statusOrder[b.status] ?? 2;
      if (sa !== sb) return sa - sb;
      if ((a.active_load_count ?? 0) !== (b.active_load_count ?? 0))
        return (a.active_load_count ?? 0) - (b.active_load_count ?? 0);
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

    return filtered;
  }, [localDrivers, searchQuery]);

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
      const anticipoVal = anticipoAmount ? parseFloat(anticipoAmount) : 0;
      if (anticipoAmount && (isNaN(anticipoVal) || anticipoVal < 0)) {
        setError('El monto de anticipo no es válido');
        setLoading(false);
        return;
      }

      await manualAssignOrder(
        order.id,
        selectedDriverId,
        user.id,
        anticipoVal
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

  const selectedDriver = availableDrivers.find(d => d.id === selectedDriverId);
  const selectedAtMax = selectedDriver && (selectedDriver.active_load_count ?? 0) >= MAX_LOAD;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
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

        {/* Scrollable body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
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

            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por nombre o placa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {loadingDrivers ? (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <RefreshCcw className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-spin" />
                <p className="text-sm font-medium text-slate-400">Cargando conductores...</p>
              </div>
            ) : availableDrivers.length === 0 ? (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-slate-400">
                  {searchQuery ? 'No se encontraron conductores' : 'No hay conductores disponibles'}
                </p>
                {!searchQuery && <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Espera a que alguien se libere</p>}
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {availableDrivers.map((driver) => {
                  const load = driver.active_load_count ?? 0;
                  const lc = loadColor(load);
                  const atMax = load >= MAX_LOAD;
                  const driverName = driver.profiles?.full_name || driver.full_name || driver.vehicle_plate || 'Conductor';

                  return (
                    <button
                      key={driver.id}
                      onClick={() => !atMax && setSelectedDriverId(driver.id)}
                      disabled={atMax}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-2xl transition-all border text-left
                        ${atMax
                          ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                          : selectedDriverId === driver.id
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
                        <p className="font-bold text-slate-900 text-sm truncate flex items-center gap-2">
                          {driverName}
                          {driver.status === 'busy' && (
                            <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">
                              OCUPADO
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter truncate">
                          {driver.vehicle_type} · {driver.vehicle_plate}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        {/* Load semaphore */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${lc.bg} ${lc.text} ${lc.border}`}>
                          <Package className="w-3 h-3" />
                          {atMax ? 'LLENO' : lc.label}
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium">⭐ {(driver.rating ?? 5).toFixed(1)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Warning when selecting a driver with high load */}
          {selectedDriver && (selectedDriver.active_load_count ?? 0) >= 3 && !selectedAtMax && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2 text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                <strong>{selectedDriver.profiles?.full_name || selectedDriver.full_name}</strong> ya tiene{' '}
                {selectedDriver.active_load_count} pedidos activos. ¿Seguro que quieres asignarle otro?
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
              Registro de Anticipo (Opcional)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={anticipoAmount}
                onChange={(e) => setAnticipoAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-medium"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 ml-1">Ingresa el monto si el repartidor adelantó efectivo para esta orden.</p>
          </div>
        </div>

        {/* Footer - always visible */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-6 py-3.5 border-2 border-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 hover:border-slate-200 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={loading || !selectedDriverId || !!selectedAtMax}
            className={`
              flex-1 px-6 py-3.5 bg-blue-600 text-white font-bold rounded-2xl transition-all shadow-lg 
              ${!loading && selectedDriverId && !selectedAtMax ? 'hover:bg-blue-700 shadow-blue-200' : 'opacity-50 grayscale shadow-none'}
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
  );
}
