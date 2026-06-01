import { useState } from 'react';
import { Truck, Users, RefreshCcw, LayoutGrid, List, AlertTriangle, Activity, Shield } from 'lucide-react';
import { useDispatch } from '../../hooks/useDispatch';
import { useRoutes } from '../../hooks/useRoutes';
import { useToast } from '../../hooks/useToast';
import DriverCard from '../dispatch/DriverCard';
import RoutePanel from '../dispatch/RoutePanel';
import OrderDetailsModal from '../modals/OrderDetailsModal';
import { OrderWithItems, RouteStop, DriverRoute } from '../../types';

export default function DispatchManagement() {
  const { showToast } = useToast();
  const {
    driversWithOrders,
    problemOrders,
    loading: dispatchLoading,
    error: dispatchError,
    reload: reloadDispatch
  } = useDispatch();

  const {
    routes,
    loading: routesLoading,
    completeStop,
    reload: reloadRoutes
  } = useRoutes();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [viewOrder, setViewOrder] = useState<OrderWithItems | null>(null);

  const handleCompleteStop = async (stop: RouteStop, route: DriverRoute) => {
    try {
      await completeStop(stop.id, stop.route_id, stop.order_id, route.driver_id);
      showToast('Entrega completada y notificada a finanzas', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al completar entrega', 'error');
    }
  };

  const handleReload = () => {
    reloadDispatch();
    reloadRoutes();
  };

  // Stats
  const totalDrivers = driversWithOrders.length;
  const totalActiveOrders = driversWithOrders.reduce((sum, d) => sum + d.assignedOrders.length, 0);
  const driversWithProblem = driversWithOrders.filter(d => d.hasProblem).length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* Header / Stats Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Despacho y Rutas (TMS)</h1>
              <p className="text-xs text-gray-500">Monitor de flota y rutas en tiempo real</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">Conductores</p>
                <div className="flex items-center gap-1.5 justify-center">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  <p className="text-lg font-bold text-gray-900">{totalDrivers}</p>
                </div>
              </div>
              <div className="text-center border-l border-gray-100 pl-8">
                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">Pedidos Activos</p>
                <div className="flex items-center gap-1.5 justify-center">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <p className="text-lg font-bold text-gray-900">{totalActiveOrders}</p>
                </div>
              </div>
              <div className="text-center border-l border-gray-100 pl-8">
                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">Rutas Activas</p>
                <p className="text-lg font-bold text-gray-900">{routes.length}</p>
              </div>
              {problemOrders.length > 0 && (
                <div className="text-center border-l border-gray-100 pl-8">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-rose-500 mb-0.5">⚠️ Problemas</p>
                  <p className="text-lg font-bold text-rose-600 animate-alert-blink">{problemOrders.length}</p>
                </div>
              )}
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

      {/* Alert Banner for Problem Orders */}
      {problemOrders.length > 0 && (
        <div className="mx-6 mt-4 bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 border-2 border-rose-300 rounded-xl p-4 shadow-sm animate-alert-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/30 animate-alert-blink">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-rose-800">
                  🚨 {problemOrders.length} Alerta{problemOrders.length !== 1 ? 's' : ''} de Central
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800 border border-rose-300 animate-pulse">
                  REQUIERE ATENCIÓN
                </span>
              </div>
              <p className="text-sm text-rose-600 mt-1">
                Pedidos con incidencias reportadas desde WhatsApp:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {problemOrders.map((po) => (
                  <span
                    key={po.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 border border-rose-200 rounded-lg text-xs font-medium text-rose-800 shadow-sm"
                  >
                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                    {po.order_number} — {po.driverName ?? 'Sin conductor'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {dispatchError && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {dispatchError}{' '}
          <button onClick={handleReload} className="underline font-medium">Reintentar</button>
        </div>
      )}

      {/* Main 2-Panel Layout */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">

        {/* Panel 1: Active Fleet (drivers with assigned orders) */}
        <div className="flex-[2] min-w-0 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              Panel de Flota Activa
            </h2>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                {totalDrivers} EN TURNO
              </span>
              {driversWithProblem > 0 && (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full animate-alert-blink">
                  {driversWithProblem} CON ALERTA
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-200">
            {dispatchLoading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => <div key={i} className="h-36 bg-gray-50 rounded-xl" />)}
              </div>
            ) : driversWithOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                <Users className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Sin flota activa</p>
                <p className="text-xs">No hay conductores en turno actualmente</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 xl:grid-cols-2 gap-4' : 'space-y-3'}>
                {driversWithOrders.map(driver => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    compact={viewMode === 'list'}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Active Routes */}
        <div className="flex-1 min-w-[360px] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-500" />
              Rutas en Curso
            </h2>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">
              {routes.length} ACTIVAS
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200">
            <RoutePanel
              routes={routes}
              loading={routesLoading}
              onCompleteStop={handleCompleteStop}
            />
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {viewOrder && (
        <OrderDetailsModal
          order={viewOrder}
          onClose={() => setViewOrder(null)}
          onUpdate={() => {
            setViewOrder(null);
            reloadDispatch();
            reloadRoutes();
          }}
          onToast={showToast}
          onDelete={() => setViewOrder(null)}
        />
      )}
    </div>
  );
}
