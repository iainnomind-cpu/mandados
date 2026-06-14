import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingCart, Zap, Package, Truck, Circle } from 'lucide-react';
import { createOrderWithItems } from '../../lib/orderSync';
import { manualAssignOrder } from '../../lib/dispatchSync';
import { calcularComision, SERVICE_TYPE_DESCRIPTIONS } from '../../lib/comision';
import { OrderItemDraft, OrderType, OrderSource, OrderPriority } from '../../types';
import type { ServiceType } from '../../lib/comision';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface NewOrderModalProps {
  onClose: () => void;
  onSuccess: (message?: string) => void;
  onError: (message?: string) => void;
}

const EMPTY_ITEM: OrderItemDraft = {
  product_name: '',
  quantity: 1,
};


export default function NewOrderModal({ onClose, onSuccess, onError }: NewOrderModalProps) {
  const { profile } = useAuth();

  // --- Customer fields ---
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // --- Driver assignment ---
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [drivers, setDrivers] = useState<{id: string; full_name: string; status: string; active_load_count: number}[]>([]);

  // Fetch active drivers on mount
  useEffect(() => {
    supabase
      .from('drivers')
      .select('id, full_name, status, active_load_count')
      .in('status', ['available', 'busy'])
      .order('status', { ascending: true }) // available first
      .then(({ data }) => {
        if (data) setDrivers(data);
      });
  }, []);

  // --- Tipo de Servicio y Comisión ---
  const [serviceType, setServiceType] = useState<ServiceType>('sencillo');
  const comision = calcularComision(serviceType);

  // --- Order metadata ---
  const [orderType, setOrderType] = useState<OrderType>('mandadito');
  const [source, setSource] = useState<OrderSource>('phone');
  const [priority, setPriority] = useState<OrderPriority>('normal');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // --- Items (descriptive only — no pricing) ---
  const [items, setItems] = useState<OrderItemDraft[]>([{ ...EMPTY_ITEM }]);

  const [loading, setLoading] = useState(false);

  // Total = comisión de servicio
  const totalAmount = comision;

  // --- Item helpers ---
  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<OrderItemDraft>) =>
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      onError('El nombre del cliente es requerido');
      return;
    }
    if (!customerPhone.trim()) {
      onError('El teléfono del cliente es requerido');
      return;
    }
    if (!deliveryAddress.trim()) {
      onError('La dirección de entrega es requerida');
      return;
    }

    const validItems = items.filter(
      (it) => it.product_name.trim() !== '' && it.quantity > 0
    );

    if (validItems.length === 0) {
      onError('Agrega al menos un artículo con nombre y cantidad');
      return;
    }

    setLoading(true);
    try {
      const orderNumber = `ORD-${Date.now()}`;

      const createdOrder = await createOrderWithItems(
        {
          order_number: orderNumber,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          delivery_address: { street: deliveryAddress.trim(), city: '', state: '' },
          order_type: orderType,
          service_type: serviceType,
          source,
          priority,
          status: 'pending',
          pickup_address: pickupAddress.trim() ? { street: pickupAddress.trim(), city: '', state: '' } : null,
          special_instructions: specialInstructions.trim() || undefined,
          payment_method: 'cash',
          payment_status: 'pending',
          delivery_fee: comision,
          total_amount: totalAmount,
        } as Parameters<typeof createOrderWithItems>[0],
        validItems.map(it => ({
          ...it,
          unit_price: 0,
        }))
      );

      // Assign driver immediately if one was selected
      if (selectedDriverId && createdOrder?.id && profile?.id) {
        try {
          await manualAssignOrder(createdOrder.id, selectedDriverId, profile.id);
        } catch (assignErr: any) {
          console.warn('Pedido creado pero no se pudo asignar repartidor:', assignErr.message);
          onSuccess('Pedido creado. No se pudo asignar el repartidor automáticamente.');
          return;
        }
      }

      onSuccess(selectedDriverId ? 'Pedido creado y repartidor asignado.' : 'Pedido creado exitosamente');
    } catch (err) {
      console.error('create order error', err);
      onError('Error al crear el pedido. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Nuevo Pedido</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer Section */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Datos del Cliente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej. María García"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+52 55 1234 5678"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección de recolección (Opcional)
                </label>
                <input
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Ej. Tienda Centro / Calle Madero #123"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección de entrega <span className="text-red-500">*</span>
                </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Calle, colonia, ciudad"
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
              </div>
            </div>
          </section>

          {/* Tipo de Servicio — Comisión automática */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Tipo de Servicio
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Sencillo */}
              <button
                type="button"
                onClick={() => setServiceType('sencillo')}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  serviceType === 'sencillo'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {serviceType === 'sencillo' && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                )}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  serviceType === 'sencillo' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Package className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-bold ${serviceType === 'sencillo' ? 'text-blue-700' : 'text-gray-800'}`}>
                    Sencillo
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{SERVICE_TYPE_DESCRIPTIONS.sencillo}</p>
                </div>
                <p className={`text-lg font-bold ${serviceType === 'sencillo' ? 'text-blue-600' : 'text-gray-400'}`}>
                  $35
                </p>
              </button>

              {/* Complejo */}
              <button
                type="button"
                onClick={() => setServiceType('complejo')}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  serviceType === 'complejo'
                    ? 'border-violet-500 bg-violet-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {serviceType === 'complejo' && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-violet-500 rounded-full animate-pulse" />
                )}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  serviceType === 'complejo' ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-bold ${serviceType === 'complejo' ? 'text-violet-700' : 'text-gray-800'}`}>
                    Complejo
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{SERVICE_TYPE_DESCRIPTIONS.complejo}</p>
                </div>
                <p className={`text-lg font-bold ${serviceType === 'complejo' ? 'text-violet-600' : 'text-gray-400'}`}>
                  $45
                </p>
              </button>
            </div>
          </section>

          {/* Order Metadata */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Tipo de Pedido
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as OrderType)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="mandadito">Mandadito</option>
                  <option value="restaurant">Restaurante</option>
                  <option value="express">Express</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as OrderSource)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="phone">Teléfono</option>
                  <option value="chatbot">Chatbot</option>
                  <option value="web">Web</option>
                  <option value="restaurant">Restaurante</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as OrderPriority)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
          </section>

          {/* Items Section — descriptive only, no pricing */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Artículos del Pedido
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus className="w-4 h-4" />
                Agregar artículo
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 mb-1 px-1">
              <span className="col-span-8">Producto</span>
              <span className="col-span-3 text-center">Cantidad</span>
              <span className="col-span-1" />
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Nombre del producto"
                      value={item.product_name}
                      onChange={(e) => updateItem(idx, { product_name: e.target.value })}
                      className="col-span-8 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          updateItem(idx, { quantity: 0 });
                        } else {
                          updateItem(idx, { quantity: Math.max(1, parseInt(raw, 10) || 1) });
                        }
                      }}
                      onBlur={() => {
                        if (item.quantity < 1) updateItem(idx, { quantity: 1 });
                      }}
                      className="col-span-3 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="col-span-1 flex justify-center text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
              ))}
            </div>

            {/* Comisión Total */}
            <div className="mt-4 flex justify-end">
              <div className={`border rounded-lg px-4 py-3 min-w-[200px] ${
                serviceType === 'complejo'
                  ? 'bg-violet-50 border-violet-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                  <span>Tipo de Servicio:</span>
                  <span className={`font-semibold ${
                    serviceType === 'complejo' ? 'text-violet-600' : 'text-blue-600'
                  }`}>
                    {serviceType === 'sencillo' ? 'Sencillo' : 'Complejo'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-gray-700 mr-2">Comisión:</span>
                  <p className={`text-2xl font-bold notranslate ${
                    serviceType === 'complejo' ? 'text-violet-700' : 'text-blue-700'
                  }`} translate="no">
                    ${totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Driver assignment */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Asignar Repartidor (Opcional)
            </h3>
            {drivers.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No hay repartidores disponibles en este momento.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {drivers.map((d) => {
                  const isFree = d.active_load_count === 0;
                  const isSelected = selectedDriverId === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDriverId(isSelected ? '' : d.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isFree ? 'bg-emerald-100' : 'bg-amber-100'
                      }`}>
                        <Circle className={`w-3 h-3 fill-current ${
                          isFree ? 'text-emerald-500' : 'text-amber-500'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${
                          isSelected ? 'text-blue-800' : 'text-gray-800'
                        }`}>{d.full_name || 'Sin nombre'}</p>
                        <p className={`text-xs ${
                          isFree ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {isFree ? 'Libre' : `${d.active_load_count} pedido${d.active_load_count > 1 ? 's' : ''} activo${d.active_load_count > 1 ? 's' : ''}`}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="ml-auto text-blue-600 text-xs font-bold">✓ Seleccionado</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Special instructions */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instrucciones especiales (opcional)
            </label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={2}
              placeholder="Ej. Sin cebolla, entrega en puerta trasera…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
                serviceType === 'complejo'
                  ? 'bg-violet-600 hover:bg-violet-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Creando pedido…' : `Crear Pedido · $${totalAmount.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
