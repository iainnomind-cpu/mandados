import { useState } from 'react';
import { X } from 'lucide-react';
import { createReconciliation } from '../../lib/transactionSync';
import { Driver } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface ReconciliationModalProps {
  drivers: Driver[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReconciliationModal({ drivers, onClose, onSuccess }: ReconciliationModalProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    driverId: '',
    date: new Date().toISOString().split('T')[0],
    totalCollections: '',
    totalCommissions: '',
    advancesDeducted: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculateNet = () => {
    const collections = parseFloat(formData.totalCollections) || 0;
    const commissions = parseFloat(formData.totalCommissions) || 0;
    const advances = parseFloat(formData.advancesDeducted) || 0;
    return collections - commissions - advances;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.driverId) {
      setError('Selecciona un conductor');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createReconciliation(
        formData.driverId,
        formData.date,
        profile?.id || ''
      );

      onSuccess();
    } catch (err) {
      setError('Error al crear conciliación');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold">Nueva Conciliación</h2>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conductor
            </label>
            <select
              value={formData.driverId}
              onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Selecciona un conductor</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.vehicle_plate || 'Sin placa'} - {driver.vehicle_type || 'Sin tipo'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Cobros
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.totalCollections}
              onChange={(e) => setFormData({ ...formData, totalCollections: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comisiones
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.totalCommissions}
              onChange={(e) => setFormData({ ...formData, totalCommissions: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anticipos Deducidos
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.advancesDeducted}
              onChange={(e) => setFormData({ ...formData, advancesDeducted: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Monto Neto:</span>
              <span className="text-2xl font-bold text-blue-600">
                ${calculateNet().toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
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
              {loading ? 'Creando...' : 'Crear Conciliación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
