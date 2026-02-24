import { useState, useMemo } from 'react';
import { X, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { createOrderWithItems } from '../../lib/orderSync';
import { OrderItemDraft, OrderType, OrderSource, OrderPriority } from '../../types';

interface NewOrderModalProps {
  onClose: () => void;
  onSuccess: (message?: string) => void;
  onError: (message?: string) => void;
}

const EMPTY_ITEM: OrderItemDraft = {
  product_name: '',
  quantity: 1,
  unit_price: 0,
};

export default function NewOrderModal({ onClose, onSuccess, onError }: NewOrderModalProps) {
  // --- Customer fields ---
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // --- Order metadata ---
  const [orderType, setOrderType] = useState<OrderType>('mandadito');
  const [source, setSource] = useState<OrderSource>('phone');
  const [priority, setPriority] = useState<OrderPriority>('normal');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // --- Items ---
  const [items, setItems] = useState<OrderItemDraft[]>([{ ...EMPTY_ITEM }]);

  const [loading, setLoading] = useState(false);

  // Auto-calculate total
  const totalAmount = useMemo(
    () => items.reduce((s, it) => s + it.quantity * it.unit_price, 0),
    [items]
  );

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

    const validItems = items.filter(
      (it) => it.product_name.trim() !== '' && it.quantity > 0
    );

    if (!customerName.trim()) {
      onError('El nombre del cliente es requerido');
      return;
    }

    setLoading(true);
    try {
      const orderNumber = `ORD-${Date.now()}`;

      await createOrderWithItems(
        {
          order_number: orderNumber,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || undefined,
          // Store delivery_address as a JSON object for compatibility
          delivery_address: { street: deliveryAddress.trim(), city: '' } as unknown as Record<string, unknown>,
          order_type: orderType,
          source,
          priority,
          status: 'pending',
          // pickup address is optional for delivery-only orders
          pickup_address: { street: '', city: '' } as unknown as Record<string, unknown>,
          special_instructions: specialInstructions.trim() || undefined,
          payment_method: 'cash',
          payment_status: 'pending',
          total_amount: totalAmount,
        } as Parameters<typeof createOrderWithItems>[0],
        validItems
      );

      onSuccess('Pedido creado exitosamente');
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
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+52 55 1234 5678"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección de entrega
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Calle, colonia, ciudad"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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

          {/* Items Section */}
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
              <span className="col-span-5">Producto</span>
              <span className="col-span-2 text-center">Cant.</span>
              <span className="col-span-2 text-right">P. Unit.</span>
              <span className="col-span-2 text-right">Subtotal</span>
              <span className="col-span-1" />
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const subtotal = item.quantity * item.unit_price;
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Nombre del producto"
                      value={item.product_name}
                      onChange={(e) => updateItem(idx, { product_name: e.target.value })}
                      className="col-span-5 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_price === 0 ? '' : item.unit_price}
                      placeholder="0.00"
                      onChange={(e) =>
                        updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })
                      }
                      className="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="col-span-2 text-right text-sm font-medium text-gray-700 pr-1">
                      ${subtotal.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="col-span-1 flex justify-center text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="mt-4 flex justify-end">
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 min-w-[180px]">
                <p className="text-xs text-gray-500 mb-1">Total del pedido</p>
                <p className="text-2xl font-bold text-gray-900">${totalAmount.toFixed(2)}</p>
              </div>
            </div>
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creando pedido…' : `Crear Pedido · $${totalAmount.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
