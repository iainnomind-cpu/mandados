import { useState, useEffect } from 'react';
import { Package, Truck, DollarSign, Users, TrendingUp, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    activeDeliveries: 0,
    availableDrivers: 0,
    todayRevenue: 0,
    completedToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        { count: totalOrders },
        { count: pendingOrders },
        { count: activeDeliveries },
        { count: availableDrivers },
        { data: todayOrders },
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'confirmed']),
        supabase.from('assignments').select('*', { count: 'exact', head: true }).in('status', ['assigned', 'accepted', 'in_progress']),
        supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('orders').select('total_amount, status').gte('created_at', today.toISOString()),
      ]);

      const todayRevenue = todayOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const completedToday = todayOrders?.filter(o => o.status === 'delivered').length || 0;

      setStats({
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        activeDeliveries: activeDeliveries || 0,
        availableDrivers: availableDrivers || 0,
        todayRevenue,
        completedToday,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    subtitle
  }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    subtitle?: string;
  }) => (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div>
        <p className="text-gray-500 text-sm mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Resumen general del sistema</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Cargando estadísticas...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <StatCard
                title="Pedidos Totales"
                value={stats.totalOrders}
                icon={Package}
                color="bg-blue-600"
              />
              <StatCard
                title="Pedidos Pendientes"
                value={stats.pendingOrders}
                icon={Clock}
                color="bg-orange-600"
                subtitle="Requieren asignación"
              />
              <StatCard
                title="Entregas Activas"
                value={stats.activeDeliveries}
                icon={Truck}
                color="bg-purple-600"
                subtitle="En progreso"
              />
              <StatCard
                title="Conductores Disponibles"
                value={stats.availableDrivers}
                icon={Users}
                color="bg-green-600"
                subtitle="Listos para asignar"
              />
              <StatCard
                title="Ingresos Hoy"
                value={`$${stats.todayRevenue.toFixed(2)}`}
                icon={DollarSign}
                color="bg-teal-600"
              />
              <StatCard
                title="Completados Hoy"
                value={stats.completedToday}
                icon={TrendingUp}
                color="bg-indigo-600"
                subtitle="Entregas finalizadas"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Actividad Reciente
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Package className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {stats.pendingOrders} pedidos esperando asignación
                      </p>
                      <p className="text-xs text-gray-500">Requieren atención inmediata</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Truck className="w-5 h-5 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {stats.activeDeliveries} entregas en progreso
                      </p>
                      <p className="text-xs text-gray-500">Monitoreo en tiempo real</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Users className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {stats.availableDrivers} conductores disponibles
                      </p>
                      <p className="text-xs text-gray-500">Listos para nuevas asignaciones</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Resumen del Día
                </h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-600">Entregas Completadas</span>
                    <span className="text-xl font-bold text-green-600">{stats.completedToday}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-600">Ingresos Generados</span>
                    <span className="text-xl font-bold text-blue-600">
                      ${stats.todayRevenue.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-600">Tasa de Completado</span>
                    <span className="text-xl font-bold text-purple-600">
                      {stats.completedToday > 0 && stats.totalOrders > 0
                        ? `${((stats.completedToday / stats.totalOrders) * 100).toFixed(1)}%`
                        : '0%'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Promedio por Entrega</span>
                    <span className="text-xl font-bold text-teal-600">
                      ${stats.completedToday > 0 ? (stats.todayRevenue / stats.completedToday).toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
