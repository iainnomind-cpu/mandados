import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Driver, DriverStatus } from '../../types';

interface DriverDetailsModalProps {
  driver: Driver;
  onClose: () => void;
  onUpdate: () => void;
}

export default function DriverDetailsModal({ driver, onClose, onUpdate }: DriverDetailsModalProps) {
  const [status, setStatus] = useState<DriverStatus>(driver.status);
  const [loading, setLoading] = useState(false);

  const handleUpdateStatus = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status })
        .eq('id', driver.id);

      if (!error) {
        onUpdate();
        onClose();
      }
    } catch (error) {
      console.error('Error updating driver status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-xl font-bold">Detalles del Conductor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Placa del Vehículo</p>
              <p className="font-semibold text-lg">{driver.vehicle_plate || 'Sin placa'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tipo de Vehículo</p>
              <p className="font-semibold text-lg">{driver.vehicle_type || 'Sin tipo'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Número de Licencia</p>
              <p>{driver.license_number || 'Sin licencia'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Expiración de Licencia</p>
              <p>
                {driver.license_expiry
                  ? new Date(driver.license_expiry).toLocaleDateString()
                  : 'No especificado'}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Rating</p>
                <p className="text-2xl font-bold">⭐ {driver.rating.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Entregas</p>
                <p className="text-2xl font-bold">{driver.total_deliveries}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado</p>
                <p className="text-lg font-semibold capitalize">{driver.status}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cambiar Estado
            </label>
            <div className="flex gap-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DriverStatus)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="available">Disponible</option>
                <option value="busy">Ocupado</option>
                <option value="offline">Fuera de línea</option>
                <option value="suspended">Suspendido</option>
              </select>
              <button
                onClick={handleUpdateStatus}
                disabled={loading || status === driver.status}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-500">
              Registrado: {new Date(driver.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
