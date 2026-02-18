import { X, MapPin, Package, Calendar } from 'lucide-react';
import { Order } from '../../types';

interface OrderDetailsModalProps {
  order: Order;
  onClose: () => void;
  onUpdate: () => void;
}

export default function OrderDetailsModal({ order, onClose }: OrderDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-xl font-bold">Detalles del Pedido</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Número de Pedido</p>
              <p className="font-semibold text-lg">{order.order_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <p className="font-semibold text-lg capitalize">{order.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tipo</p>
              <p className="capitalize">{order.order_type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Origen</p>
              <p className="capitalize">{order.source}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Prioridad</p>
              <p className="capitalize font-medium">{order.priority}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Método de Pago</p>
              <p className="capitalize">{order.payment_method}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold">Dirección de Recogida</h3>
            </div>
            <p className="text-gray-700 ml-7">
              {order.pickup_address.street}, {order.pickup_address.city}
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold">Dirección de Entrega</h3>
            </div>
            <p className="text-gray-700 ml-7">
              {order.delivery_address.street}, {order.delivery_address.city}
            </p>
          </div>

          {order.items && order.items.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold">Artículos</h3>
              </div>
              <div className="ml-7 space-y-2">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.name} x{item.quantity}</span>
                    {item.price && <span>${item.price.toFixed(2)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.special_instructions && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold mb-2">Instrucciones Especiales</h3>
              <p className="text-gray-700">{order.special_instructions}</p>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total:</span>
              <span>${order.total_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>Tarifa de envío:</span>
              <span>${order.delivery_fee.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>Creado: {new Date(order.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
