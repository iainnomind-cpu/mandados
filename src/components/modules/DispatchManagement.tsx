import { useState, useEffect, useCallback } from 'react';
import { Truck, MapPin, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Order, Driver, Assignment } from '../../types';
import { useRealtimeOrders, useRealtimeDrivers, useRealtimeAssignments } from '../../hooks/useRealtimeSync';
import AssignDriverModal from '../modals/AssignDriverModal';

interface DriverWithAssignment extends Driver {
  current_assignments?: number;
}

export default function DispatchManagement() {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<DriverWithAssignment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDataCallback = useCallback(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeOrders(loadDataCallback);
  useRealtimeDrivers(loadDataCallback);
  useRealtimeAssignments(loadDataCallback);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadPendingOrders(),
      loadDrivers(),
      loadAssignments(),
    ]);
    setLoading(false);
  };

  const loadPendingOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['pending', 'confirmed'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (!error && data) {
      setPendingOrders(data);
    }
  };

  const loadDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .in('status', ['available', 'busy']);

    if (!error && data) {
      const driversWithCounts = await Promise.all(
        data.map(async (driver) => {
          const { count } = await supabase
            .from('assignments')
            .select('*', { count: 'exact', head: true })
            .eq('driver_id', driver.id)
            .in('status', ['assigned', 'accepted', 'in_progress']);

          return { ...driver, current_assignments: count || 0 };
        })
      );
      setDrivers(driversWithCounts);
    }
  };

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .in('status', ['assigned', 'accepted', 'in_progress'])
      .order('assigned_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setAssignments(data);
    }
  };

  const getDriverStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: 'bg-green-100 text-green-800',
      busy: 'bg-orange-100 text-orange-800',
      offline: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'urgent') return '🔴';
    if (priority === 'high') return '🟡';
    return '🟢';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Truck className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Despacho</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Pedidos Pendientes</p>
                <p className="text-3xl font-bold text-gray-900">{pendingOrders.length}</p>
              </div>
              <Clock className="w-12 h-12 text-orange-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Conductores Disponibles</p>
                <p className="text-3xl font-bold text-gray-900">
                  {drivers.filter(d => d.status === 'available').length}
                </p>
              </div>
              <Truck className="w-12 h-12 text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Entregas en Curso</p>
                <p className="text-3xl font-bold text-gray-900">{assignments.length}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-blue-500 opacity-20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-lg">Pedidos por Asignar</h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Cargando...</div>
              ) : pendingOrders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No hay pedidos pendientes
                </div>
              ) : (
                pendingOrders.map((order) => (
                  <div key={order.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getPriorityIcon(order.priority)}</span>
                        <div>
                          <p className="font-semibold">{order.order_number}</p>
                          <p className="text-sm text-gray-600 capitalize">{order.order_type}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Asignar
                      </button>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600 mt-2">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p>{order.pickup_address.street}</p>
                        <p className="mt-1">→ {order.delivery_address.street}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-lg">Conductores Activos</h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Cargando...</div>
              ) : drivers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No hay conductores activos
                </div>
              ) : (
                drivers.map((driver) => (
                  <div key={driver.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">{driver.vehicle_plate || 'Sin placa'}</p>
                        <p className="text-sm text-gray-600">{driver.vehicle_type || 'Sin tipo'}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDriverStatusColor(driver.status)}`}>
                        {driver.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Entregas Activas</p>
                        <p className="font-semibold">{driver.current_assignments || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Rating</p>
                        <p className="font-semibold">⭐ {driver.rating.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total Entregas</p>
                        <p className="font-semibold">{driver.total_deliveries}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedOrder && (
        <AssignDriverModal
          order={selectedOrder}
          drivers={drivers}
          onClose={() => setSelectedOrder(null)}
          onSuccess={() => {
            setSelectedOrder(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
