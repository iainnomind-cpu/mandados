import { useState } from 'react';
import { Truck, Users, Map as MapIcon, RefreshCcw, LayoutGrid, List } from 'lucide-react';
import { useDispatch } from '../../hooks/useDispatch';
import { useRoutes } from '../../hooks/useRoutes';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import OrderCard from '../dispatch/OrderCard';
import DriverCard from '../dispatch/DriverCard';
import RoutePanel from '../dispatch/RoutePanel';
import AssignDriverModal from '../modals/AssignDriverModal';
import { Order, DriverWithProfile, RouteStop } from '../../types';

export default function DispatchManagement() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const {
    unassignedOrders,
    drivers,
    loading: dispatchLoading,
    autoAssign,
    error: dispatchError,
    reload: reloadDispatch
  } = useDispatch();

  const {
    routes,
    loading: routesLoading,
    completeStop,
    reload: reloadRoutes
  } = useRoutes();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleAutoAssign = async (order: Order) => {
    if (!profile?.id) return;
    try {
      await autoAssign(order.id, profile.id);
      showToast('success', `Pedido ${order.order_number} auto-asignado con éxito`);
    } catch (err: any) {
      showToast('error', err.message || 'Error al auto-asignar');
    }
  };

  const handleCompleteStop = async (stop: RouteStop, route: any) => {
    try {
      await completeStop(stop.id, stop.route_id, stop.order_id, route.driver_id);
      showToast('success', 'Entrega completada y notificada a finanzas');
    } catch (err: any) {
      showToast('error', err.message || 'Error al completar entrega');
    }
  };

  const handleReload = () => {
    reloadDispatch();
    reloadRoutes();
  };

  const activeDriversCount = drivers.filter(d => d.status === 'available' || d.status === 'busy').length;
  const availableDriversCount = drivers.filter(d => d.status === 'available').length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* Header / Stats Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Despacho y Rutas (TMS)</h1>
              <p className="text-xs text-gray-500">Gestión de asignaciones y flota en tiempo real</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">Pendientes</p>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <p className="text-lg font-bold text-gray-900">{unassignedOrders.length}</p>
                </div>
              </div>
              <div className="text-center border-l border-gray-100 pl-8">
                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">Conductores</p>
                <p className="text-lg font-bold text-gray-900">
                  {availableDriversCount}<span className="text-gray-300 font-normal"> / {activeDriversCount}</span>
                </p>
              </div>
              <div className="text-center border-l border-gray-100 pl-8">
                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">Rutas Activas</p>
                <p className="text-lg font-bold text-gray-900">{routes.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-l border-gray-100 pl-6">
              <button
                onClick={handleReload}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Sincronizar"
              >
                <RefreshCcw className="w-5 h-5" />
              </button>
              <div className="flex p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">

        {/* Panel 1: Unassigned Orders */}
        <div className="flex-1 min-w-0 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-amber-500" />
              Pedidos por Asignar
            </h2>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
              {unassignedOrders.length} NUEVOS
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-200">
            {dispatchLoading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-50 rounded-xl" />)}
              </div>
            ) : unassignedOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                <LayoutGrid className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Bandeja vacía</p>
                <p className="text-xs">No hay pedidos pendientes de despacho</p>
              </div>
            ) : (
              unassignedOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onAssign={setSelectedOrder}
                  onAutoAssign={handleAutoAssign}
                />
              ))
            )}
          </div>
        </div>

        {/* Panel 2: Available Drivers */}
        <div className="flex-1 min-w-0 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Flota Activa
            </h2>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                {availableDriversCount} DISP.
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-200">
            {dispatchLoading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-50 rounded-xl" />)}
              </div>
            ) : drivers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                <Users className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Sin flota</p>
                <p className="text-xs">No hay conductores conectados</p>
              </div>
            ) : (
              drivers.map(driver => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  compact={viewMode === 'list'}
                />
              ))
            )}
          </div>
        </div>

        {/* Panel 3: Active Routes & Map Placeholder */}
        <div className="w-[400px] flex flex-col gap-6">
          {/* Active Routes List */}
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <List className="w-4 h-4 text-indigo-500" />
                Rutas en Curso
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200">
              <RoutePanel
                routes={routes}
                loading={routesLoading}
                onCompleteStop={handleCompleteStop}
              />
            </div>
          </div>

          {/* Map View Placeholder */}
          <div className="h-[250px] bg-slate-900 rounded-2xl shadow-inner border border-gray-800 relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-500/10 mix-blend-overlay" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <MapIcon className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-blue-100 font-bold text-sm">Vista de Mapa Global</p>
              <p className="text-blue-300/60 text-[10px] mt-1">Conecta con Google Maps API para ver conductores en tiempo real</p>
            </div>
            {/* Fake map grid */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {selectedOrder && (
        <AssignDriverModal
          order={selectedOrder}
          drivers={drivers}
          onClose={() => setSelectedOrder(null)}
          onSuccess={() => {
            setSelectedOrder(null);
            // useRealtime hooks handle updates, but reload just in case
            reloadDispatch();
            reloadRoutes();
          }}
        />
      )}
    </div>
  );
}
