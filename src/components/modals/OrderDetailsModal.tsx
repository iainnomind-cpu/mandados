import { useState, useEffect } from 'react';
import {
  X, MapPin, Package, Calendar, User, Phone,
  Edit3, Truck, CheckCircle, XCircle, Clock, UserCheck, ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { updateOrderStatus, assignOrderToDriver } from '../../lib/orderSync';
import { useAuth } from '../../contexts/AuthContext';
import { OrderWithItems, Driver } from '../../types';
import { ToastType } from '../NotificationToast';

interface OrderDetailsModalProps {
  order: OrderWithItems;
  onClose: () => void;
  onUpdate: () => void;
  onToast: (message: string, type: ToastType) => void;
  onDelete: (order: OrderWithItems) => void;
}

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h4>
      {children}
    </div>
  );
}

export default function OrderDetailsModal({
  order,
  onClose,
  onUpdate,
  onToast,
  onDelete,
}: OrderDetailsModalProps) {
  const { profile } = useAuth();
  const role = profile?.role;

  const [newStatus, setNewStatus] = useState(order.status);
  const [savingStatus, setSavingStatus] = useState(false);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState(order.assigned_driver_id ?? '');
  const [assigningDriver, setAssigningDriver] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const canEditStatus = role === 'admin' || role === 'dispatcher' || role === 'operator';
  const canAssignDriver = role === 'admin' || role === 'dispatcher';
  const canDelete = role === 'admin';

  useEffect(() => {
    if (canAssignDriver) loadDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssignDriver]);

  const loadDrivers = async () => {
    setLoadingDrivers(true);
    const { data } = await supabase
      .from('drivers')
      .select('*, profiles:user_id(full_name)')
      .in('status', ['available', 'busy'])
      .order('status');
    setDrivers((data as Driver[]) || []);
    setLoadingDrivers(false);
  };

  const handleSaveStatus = async () => {
    if (newStatus === order.status) return;
    setSavingStatus(true);
    try {
      await updateOrderStatus(order.id, newStatus, profile?.id);
      onToast(`Estado actualizado a "${STATUS_LABELS[newStatus]}"`, 'success');
      onUpdate();
    } catch {
      onToast('Error al actualizar el estado', 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedDriverId || selectedDriverId === (order.assigned_driver_id ?? '')) return;
    setAssigningDriver(true);
    try {
      await assignOrderToDriver(order.id, selectedDriverId, profile?.id ?? '');
      onToast('Conductor asignado exitosamente', 'success');
      onUpdate();
    } catch {
      onToast('Error al asignar conductor', 'error');
    } finally {
      setAssigningDriver(false);
    }
  };

  const handleMarkDelivered = async () => {
    setSavingStatus(true);
    try {
      await updateOrderStatus(order.id, 'delivered', profile?.id);
      onToast('Pedido marcado como entregado', 'success');
      onUpdate();
    } catch {
      onToast('Error al marcar como entregado', 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  // Compute delivery address as displayable string
  const deliveryAddr =
    typeof order.delivery_address === 'string'
      ? order.delivery_address
      : `${order.delivery_address?.street ?? ''}${order.delivery_address?.city ? ', ' + order.delivery_address.city : ''}`;

  const pickupAddr =
    typeof order.pickup_address === 'string'
      ? order.pickup_address
      : `${order.pickup_address?.street ?? ''}${order.pickup_address?.city ? ', ' + order.pickup_address.city : ''}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Detalles del Pedido</h2>
            {order.order_number && (
              <p className="text-xs text-gray-400 mt-0.5">{order.order_number}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Customer Info */}
          <Section title="Cliente">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Nombre</p>
                  <p className="text-sm font-medium text-gray-900">{order.customer_name || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Teléfono</p>
                  <p className="text-sm font-medium text-gray-900">{order.customer_phone || '—'}</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Addresses */}
          <Section title="Direcciones">
            <div className="space-y-3">
              {pickupAddr.trim() && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Recogida</p>
                    <p className="text-sm text-gray-700">{pickupAddr || '—'}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Entrega</p>
                  <p className="text-sm text-gray-700">{deliveryAddr || '—'}</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Items */}
          {(order.order_items && order.order_items.length > 0) ? (
            <Section title="Artículos">
              <div className="space-y-1">
                <div className="grid grid-cols-12 text-xs text-gray-400 mb-1 px-1">
                  <span className="col-span-6">Producto</span>
                  <span className="col-span-2 text-center">Cant.</span>
                  <span className="col-span-2 text-right">P.Unit</span>
                  <span className="col-span-2 text-right">Sub</span>
                </div>
                {order.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 text-sm py-1.5 px-1 rounded hover:bg-gray-50"
                  >
                    <span className="col-span-6 font-medium text-gray-800">{item.product_name}</span>
                    <span className="col-span-2 text-center text-gray-600">{item.quantity}</span>
                    <span className="col-span-2 text-right text-gray-600">
                      ${item.unit_price.toFixed(2)}
                    </span>
                    <span className="col-span-2 text-right font-medium text-gray-800">
                      ${item.subtotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <div className="bg-gray-50 rounded-lg px-4 py-2">
                  <span className="text-xs text-gray-500">Total</span>
                  <span className="ml-3 text-lg font-bold text-gray-900">
                    ${(order.total_amount ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </Section>
          ) : (
            <Section title="Artículos">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Package className="w-4 h-4" />
                <span>Total del pedido: <strong className="text-gray-700">${(order.total_amount ?? 0).toFixed(2)}</strong></span>
              </div>
            </Section>
          )}

          {/* Order metadata */}
          <Section title="Información del Pedido">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Tipo</p>
                <p className="capitalize text-gray-700">{order.order_type ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Prioridad</p>
                <p className="capitalize text-gray-700">{order.priority ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Método de pago</p>
                <p className="capitalize text-gray-700">{order.payment_method ?? '—'}</p>
              </div>
              <div className="flex items-start gap-1">
                <Calendar className="w-3 h-3 text-gray-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Creado</p>
                  <p className="text-gray-700">
                    {new Date(order.created_at).toLocaleString('es-MX', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>
            </div>
            {order.special_instructions && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
                <p className="text-xs font-semibold mb-1">Instrucciones especiales</p>
                {order.special_instructions}
              </div>
            )}
          </Section>

          {/* Status Update — admin/dispatcher/operator */}
          {canEditStatus && (
            <Section title="Actualizar Estado">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <button
                  onClick={handleSaveStatus}
                  disabled={savingStatus || newStatus === order.status}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {savingStatus ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
              {/* Quick action buttons */}
              <div className="flex gap-2 mt-2 flex-wrap">
                {order.status !== 'delivered' && (
                  <button
                    onClick={handleMarkDelivered}
                    disabled={savingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Marcar Entregado
                  </button>
                )}
                {order.status !== 'cancelled' && (
                  <button
                    onClick={() => { setNewStatus('cancelled'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancelar
                  </button>
                )}
                {order.status !== 'in_transit' && (
                  <button
                    onClick={() => { setNewStatus('in_transit'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-200 text-orange-600 text-xs font-medium rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    En tránsito
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* Assign Driver — admin/dispatcher */}
          {canAssignDriver && (
            <Section title="Asignar Conductor">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    disabled={loadingDrivers}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">
                      {loadingDrivers ? 'Cargando conductores…' : 'Seleccionar conductor'}
                    </option>
                    {drivers.map((d) => {
                      const name =
                        (d as unknown as { profiles?: { full_name?: string } }).profiles?.full_name ??
                        d.vehicle_plate ??
                        d.id.slice(0, 8);
                      const statusLabel = d.status === 'available' ? '✅' : '🔶';
                      return (
                        <option key={d.id} value={d.id}>
                          {statusLabel} {name} — {d.vehicle_type ?? 'Sin tipo'}
                          {d.vehicle_plate ? ` (${d.vehicle_plate})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <button
                  onClick={handleAssignDriver}
                  disabled={
                    assigningDriver ||
                    !selectedDriverId ||
                    selectedDriverId === (order.assigned_driver_id ?? '')
                  }
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {assigningDriver ? 'Asignando…' : 'Asignar'}
                </button>
              </div>
              {order.assigned_driver_id && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Conductor actual:{' '}
                  <span className="font-medium text-gray-700">
                    {(order.driver as { profiles?: { full_name?: string } })?.profiles?.full_name ??
                      order.driver?.vehicle_plate ??
                      'Asignado'}
                  </span>
                </p>
              )}
            </Section>
          )}

          {/* Footer actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Cerrar
            </button>
            {canDelete && (
              <button
                onClick={() => { onClose(); onDelete(order); }}
                className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors"
              >
                Eliminar Pedido
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
