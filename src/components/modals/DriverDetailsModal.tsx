import { useState } from 'react';
import { X, Pencil, Save, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Driver, DriverStatus } from '../../types';

interface DriverDetailsModalProps {
  driver: Driver;
  onClose: () => void;
  onUpdate: () => void;
}

export default function DriverDetailsModal({ driver, onClose, onUpdate }: DriverDetailsModalProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    full_name: driver.full_name || '',
    phone: driver.phone || '',
    vehicle_plate: driver.vehicle_plate || '',
    vehicle_type: driver.vehicle_type || '',
    license_number: driver.license_number || '',
    license_expiry: driver.license_expiry || '',
    status: driver.status,
  });

  const handleSave = async () => {
    if (!formData.full_name.trim() || !formData.vehicle_plate.trim() || !formData.phone.trim()) {
      setError('Nombre, Placa del vehículo y Teléfono son obligatorios.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('drivers')
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          vehicle_plate: formData.vehicle_plate.trim(),
          vehicle_type: formData.vehicle_type || null,
          license_number: formData.license_number || null,
          license_expiry: formData.license_expiry || null,
          status: formData.status,
        })
        .eq('id', driver.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error updating driver:', err);
      setError('Error al actualizar conductor.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: driver.full_name || '',
      phone: driver.phone || '',
      vehicle_plate: driver.vehicle_plate || '',
      vehicle_type: driver.vehicle_type || '',
      license_number: driver.license_number || '',
      license_expiry: driver.license_expiry || '',
      status: driver.status,
    });
    setError('');
    setEditing(false);
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';
  const readonlyClass =
    'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">Detalles del Conductor</h2>
          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Editable fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Nombre Completo <span className="text-red-400">*</span>
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className={inputClass}
                  required
                />
              ) : (
                <p className={readonlyClass}>{driver.full_name || 'Sin nombre'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Número de Teléfono <span className="text-red-400">*</span>
              </label>
              {editing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputClass}
                  placeholder="Ej: 614 123 4567"
                  required
                />
              ) : (
                <p className={readonlyClass}>{driver.phone || 'Sin teléfono'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Placa del Vehículo <span className="text-red-400">*</span>
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.vehicle_plate}
                  onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                  className={inputClass}
                  required
                />
              ) : (
                <p className={readonlyClass}>{driver.vehicle_plate || 'Sin placa'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Tipo de Vehículo
              </label>
              {editing ? (
                <select
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Selecciona un tipo</option>
                  <option value="Moto">Moto</option>
                  <option value="Auto">Auto</option>
                  <option value="Camioneta">Camioneta</option>
                  <option value="Bicicleta">Bicicleta</option>
                </select>
              ) : (
                <p className={readonlyClass}>{driver.vehicle_type || 'Sin tipo'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Número de Licencia
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  className={inputClass}
                />
              ) : (
                <p className={readonlyClass}>{driver.license_number || 'Sin licencia'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Expiración de Licencia
              </label>
              {editing ? (
                <input
                  type="date"
                  value={formData.license_expiry}
                  onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                  className={inputClass}
                />
              ) : (
                <p className={readonlyClass}>
                  {driver.license_expiry
                    ? new Date(driver.license_expiry).toLocaleDateString()
                    : 'No especificado'}
                </p>
              )}
            </div>
          </div>

          {/* Status + stats */}
          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Estado</p>
                {editing ? (
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as DriverStatus })}
                    className={inputClass}
                  >
                    <option value="available">Disponible</option>
                    <option value="busy">Ocupado</option>
                    <option value="offline">Fuera de línea</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                ) : (
                  <p className="text-lg font-semibold capitalize">{driver.status}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Entregas</p>
                <p className="text-2xl font-bold">{driver.total_deliveries}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Registrado</p>
                <p className="text-sm font-medium mt-1">
                  {new Date(driver.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {editing && (
            <div className="border-t border-gray-200 pt-4 flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
