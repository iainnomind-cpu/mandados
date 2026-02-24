import { useState, useMemo } from 'react';
import {
  Package, Plus, Search, Filter, Eye, Trash2,
  UserCheck, CheckCircle, XCircle, Clock, Truck,
  DollarSign, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../hooks/useOrders';
import { useToast } from '../../hooks/useToast';
import NotificationToast from '../NotificationToast';
import NewOrderModal from '../modals/NewOrderModal';
import OrderDetailsModal from '../modals/OrderDetailsModal';
import { OrderWithItems } from '../../types';

// ---------- Helpers ----------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  assigned: 'Asignado',
  in_transit: 'En tránsito',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  assigned: 'bg-purple-100 text-purple-800 border-purple-200',
  in_transit: 'bg-orange-100 text-orange-800 border-orange-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  confirmed: <CheckCircle className="w-3 h-3" />,
  assigned: <UserCheck className="w-3 h-3" />,
  in_transit: <Truck className="w-3 h-3" />,
  delivered: <CheckCircle className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
    >
      {STATUS_ICONS[status]}
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ---------- Stat Card --------------------------------------------------------

function StatCard({
  title, value, icon: Icon, color, subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{title}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

// ---------- Confirm Dialog ---------------------------------------------------

function ConfirmDialog({
  message, onConfirm, onCancel, loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-sm w-full shadow-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Confirmar eliminación</h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Component ---------------------------------------------------

export default function OrderManagement() {
  const { profile } = useAuth();
  const role = profile?.role;

  // For drivers, only load their assigned orders
  const isDriver = role === 'driver';

  const { orders, loading, error, removeOrder, reload } = useOrders({
    driverFilter: isDriver ? profile?.id : undefined,
  });

  const { toasts, showToast, removeToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderWithItems | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------- Derived stats --------------------------------------------------

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const completedToday = orders.filter(
      (o) => o.status === 'delivered' && new Date(o.created_at) >= today
    ).length;
    const revenueToday = orders
      .filter((o) => new Date(o.created_at) >= today)
      .reduce((s, o) => s + (o.total_amount || 0), 0);
    return { total, pending, completedToday, revenueToday };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  // ---------- Filtering -------------------------------------------------------

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !searchTerm ||
        (o.customer_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.order_number ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.customer_phone ?? '').includes(searchTerm);
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // ---------- Handlers -------------------------------------------------------

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeOrder(deleteTarget.id);
      showToast('Pedido eliminado correctamente', 'success');
      setDeleteTarget(null);
      if (selectedOrder?.id === deleteTarget.id) setSelectedOrder(null);
    } catch {
      showToast('Error al eliminar el pedido', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ---------- Render ---------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <NotificationToast
            key={t.id}
            message={t.message}
            type={t.type}
            onClose={() => removeToast(t.id)}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Pedidos</h1>
              <p className="text-sm text-gray-500">
                {isDriver ? 'Tus pedidos asignados' : 'Administración completa de órdenes'}
              </p>
            </div>
          </div>
          {!isDriver && (
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo Pedido
            </button>
          )}
        </div>

        {/* Stats row */}
        {!isDriver && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total de Pedidos" value={stats.total} icon={Package} color="bg-blue-600" />
            <StatCard title="Pendientes" value={stats.pending} icon={Clock} color="bg-amber-500" subtitle="Sin asignar" />
            <StatCard title="Completados Hoy" value={stats.completedToday} icon={TrendingUp} color="bg-green-600" />
            <StatCard
              title="Ingresos Hoy"
              value={`$${stats.revenueToday.toFixed(2)}`}
              icon={DollarSign}
              color="bg-teal-600"
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-5">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, teléfono o número de pedido…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}{' '}
            <button onClick={reload} className="underline font-medium">Reintentar</button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                    Teléfono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                    Dirección
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                    Conductor
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">No se encontraron pedidos</p>
                      {!isDriver && (
                        <p className="text-xs mt-1">
                          Prueba cambiando los filtros o{' '}
                          <button
                            className="text-blue-600 underline"
                            onClick={() => setShowNewModal(true)}
                          >
                            crea un nuevo pedido
                          </button>
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => {
                    const driverName =
                      (order.driver as { profiles?: { full_name?: string } })?.profiles?.full_name ??
                      order.driver?.vehicle_plate ??
                      '—';
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">
                            {order.customer_name || '—'}
                          </span>
                          {order.order_number && (
                            <p className="text-xs text-gray-400">{order.order_number}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                          {order.customer_phone || '—'}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-600 max-w-[200px] truncate">
                          {typeof order.delivery_address === 'string'
                            ? order.delivery_address
                            : `${order.delivery_address?.street ?? ''}, ${order.delivery_address?.city ?? ''}`}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-gray-600 text-xs">
                          {driverName}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-right font-semibold text-gray-900">
                          ${(order.total_amount ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                          {new Date(order.created_at).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              title="Ver detalles"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {role === 'admin' && (
                              <button
                                onClick={() => setDeleteTarget(order)}
                                title="Eliminar pedido"
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              Mostrando {filtered.length} de {orders.length} pedido{orders.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showNewModal && (
        <NewOrderModal
          onClose={() => setShowNewModal(false)}
          onSuccess={(msg) => {
            setShowNewModal(false);
            showToast(msg ?? 'Pedido creado exitosamente', 'success');
          }}
          onError={(msg) => showToast(msg ?? 'Error al crear pedido', 'error')}
        />
      )}

      {/* Details modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={() => {
            reload();
            setSelectedOrder(null);
          }}
          onToast={showToast}
          onDelete={(o) => {
            setSelectedOrder(null);
            setDeleteTarget(o);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          message={`¿Eliminar el pedido de "${deleteTarget.customer_name ?? deleteTarget.order_number}"? Esta acción no se puede deshacer.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
