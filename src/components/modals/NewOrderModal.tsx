import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createOrderWithTransaction } from '../../lib/orderSync';
import { OrderType, OrderSource, OrderPriority } from '../../types';

interface NewOrderModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewOrderModal({ onClose, onSuccess }: NewOrderModalProps) {
  const [formData, setFormData] = useState({
    orderType: 'mandadito' as OrderType,
    source: 'phone' as OrderSource,
    priority: 'normal' as OrderPriority,
    customerPhone: '',
    pickupStreet: '',
    pickupCity: '',
    deliveryStreet: '',
    deliveryCity: '',
    totalAmount: '',
    deliveryFee: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let customerId = null;

      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', formData.customerPhone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([{ phone: formData.customerPhone }])
          .select('id')
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      const orderNumber = `ORD-${Date.now()}`;

      await createOrderWithTransaction({
        order_number: orderNumber,
        customer_id: customerId,
        order_type: formData.orderType,
        source: formData.source,
        priority: formData.priority,
        status: 'pending',
        pickup_address: {
          street: formData.pickupStreet,
          city: formData.pickupCity,
        },
        delivery_address: {
          street: formData.deliveryStreet,
          city: formData.deliveryCity,
        },
        total_amount: parseFloat(formData.totalAmount) || 0,
        delivery_fee: parseFloat(formData.deliveryFee) || 0,
        payment_method: 'cash',
        payment_status: 'pending',
        items: [],
      });

      onSuccess();
    } catch (err) {
      setError('Error al crear el pedido');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-xl font-bold">Nuevo Pedido</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Pedido
              </label>
              <select
                value={formData.orderType}
                onChange={(e) => setFormData({ ...formData, orderType: e.target.value as OrderType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="mandadito">Mandadito</option>
                <option value="restaurant">Restaurante</option>
                <option value="express">Express</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Origen
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as OrderSource })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="chatbot">Chatbot</option>
                <option value="phone">Teléfono</option>
                <option value="web">Web</option>
                <option value="restaurant">Restaurante</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioridad
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as OrderPriority })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono Cliente
              </label>
              <input
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Dirección de Recogida</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Calle"
                value={formData.pickupStreet}
                onChange={(e) => setFormData({ ...formData, pickupStreet: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Ciudad"
                value={formData.pickupCity}
                onChange={(e) => setFormData({ ...formData, pickupCity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Dirección de Entrega</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Calle"
                value={formData.deliveryStreet}
                onChange={(e) => setFormData({ ...formData, deliveryStreet: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Ciudad"
                value={formData.deliveryCity}
                onChange={(e) => setFormData({ ...formData, deliveryCity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto Total
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarifa de Envío
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.deliveryFee}
                onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
