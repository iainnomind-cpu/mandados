import { useState } from 'react';
import { X } from 'lucide-react';
import { assignOrderToDriver } from '../../lib/orderSync';
import { Order, Driver } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface AssignDriverModalProps {
  order: Order;
  drivers: Driver[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignDriverModal({ order, drivers, onClose, onSuccess }: AssignDriverModalProps) {
  const { profile } = useAuth();
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [estimatedDistance, setEstimatedDistance] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableDrivers = drivers.filter(d => d.status === 'available');

  const handleAssign = async () => {
    if (!selectedDriverId) {
      setError('Selecciona un conductor');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await assignOrderToDriver(
        order.id,
        selectedDriverId,
        profile?.id || '',
        parseFloat(estimatedDistance) || undefined,
        parseInt(estimatedDuration) || undefined
      );

      onSuccess();
    } catch (err) {
      setError('Error al asignar conductor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold">Asignar Conductor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <p className="text-sm text-gray-500 mb-1">Pedido</p>
            <p className="font-semibold">{order.order_number}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Conductor
            </label>
            {availableDrivers.length === 0 ? (
              <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded">
                No hay conductores disponibles en este momento
              </p>
            ) : (
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona un conductor</option>
                {availableDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.vehicle_plate || 'Sin placa'} - {driver.vehicle_type || 'Sin tipo'} (⭐ {driver.rating.toFixed(1)})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Distancia Est. (km)
              </label>
              <input
                type="number"
                step="0.1"
                value={estimatedDistance}
                onChange={(e) => setEstimatedDistance(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="5.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duración Est. (min)
              </label>
              <input
                type="number"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="20"
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
              onClick={handleAssign}
              disabled={loading || !selectedDriverId}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Asignando...' : 'Asignar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
