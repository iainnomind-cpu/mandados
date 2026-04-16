import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, Wallet, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Driver } from '../../types';
import { useRealtimeCodTransactions, useRealtimeDriverRemittances } from '../../hooks/useRealtimeSync';
import ReconciliationModal from '../modals/ReconciliationModal';

interface CodTransaction {
  id: string;
  order_id: string;
  driver_id: string;
  transaction_type: 'anticipo' | 'cobro_cliente' | 'liquidacion';
  amount: number;
  payment_method: 'cash' | 'transfer' | 'card';
  status: 'pending' | 'reconciled';
  created_at: string;
  // Joined
  order?: { order_number: string };
}

interface DriverRemittance {
  id: string;
  driver_id: string;
  period_date: string;
  total_collected: number;
  total_advances: number;
  driver_commissions: number;
  net_remittance_due: number;
  status: 'pending' | 'paid_to_company';
  created_at: string;
}

export default function FinanceManagement() {
  const [transactions, setTransactions] = useState<CodTransaction[]>([]);
  const [remittances, setRemittances] = useState<DriverRemittance[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadTransactionsCallback = useCallback(() => {
    loadTransactions();
  }, [selectedDriver, dateFilter]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [selectedDriver, dateFilter]);

  useRealtimeCodTransactions(loadTransactionsCallback);
  useRealtimeDriverRemittances(loadTransactionsCallback);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadDrivers(),
      loadTransactions(),
      loadRemittances(),
    ]);
    setLoading(false);
  };

  const loadDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('vehicle_plate');

    if (!error && data) {
      setDrivers(data);
    }
  };

  const loadTransactions = async () => {
    let query = supabase
      .from('cod_transactions')
      .select('*, order:order_id(order_number)')
      .order('created_at', { ascending: false });

    if (selectedDriver !== 'all') {
      query = query.eq('driver_id', selectedDriver);
    }

    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      query = query.gte('created_at', today.toISOString());
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', monthAgo.toISOString());
    }

    const { data, error } = await query;

    if (!error && data) {
      setTransactions(data as any);
    }
  };

  const loadRemittances = async () => {
    const { data, error } = await supabase
      .from('driver_remittances')
      .select('*')
      .order('period_date', { ascending: false })
      .limit(20);

    if (!error && data) {
      setRemittances(data);
    }
  };

  const calculateTotals = () => {
    const collections = transactions
      .filter(t => t.transaction_type === 'cobro_cliente' && t.payment_method === 'cash')
      .reduce((sum, t) => sum + t.amount, 0);

    const advances = transactions
      .filter(t => t.transaction_type === 'anticipo')
      .reduce((sum, t) => sum + t.amount, 0);

    const pending = transactions
      .filter(t => t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0);

    return { collections, advances, pending };
  };

  const totals = calculateTotals();

  const getTransactionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      anticipo: 'text-orange-600 bg-orange-50',
      cobro_cliente: 'text-green-600 bg-green-50',
      liquidacion: 'text-purple-600 bg-purple-50',
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  };

  const getRemittanceStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid_to_company: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Gestión Financiera</h1>
          </div>
          <button
            onClick={() => setShowReconciliationModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Nueva Conciliación
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Cobros</p>
                <p className="text-3xl font-bold text-gray-900">${totals.collections.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Anticipos Emitidos</p>
                <p className="text-3xl font-bold text-gray-900">${totals.advances.toFixed(2)}</p>
              </div>
              <Wallet className="w-12 h-12 text-orange-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Pendiente</p>
                <p className="text-3xl font-bold text-gray-900">${totals.pending.toFixed(2)}</p>
              </div>
              <Calendar className="w-12 h-12 text-orange-500 opacity-20" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-wrap gap-4">
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos los conductores</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.vehicle_plate || 'Sin placa'}
                  </option>
                ))}
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Hoy</option>
                <option value="week">Última semana</option>
                <option value="month">Último mes</option>
                <option value="all">Todo</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Método
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Pedido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Cargando transacciones...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No hay transacciones COD
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getTransactionTypeColor(transaction.transaction_type)} uppercase`}>
                          {transaction.transaction_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900">
                          ${transaction.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 capitalize">
                          {transaction.payment_method || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm capitalize font-medium ${transaction.status === 'reconciled' ? 'text-green-600' : 'text-amber-600'}`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-600">
                          {transaction.order?.order_number || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {new Date(transaction.created_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-lg">Liquidaciones a Repartidores</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Período / Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cobrado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Anticipado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Comisiones
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    A Entregar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {remittances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No hay liquidaciones
                    </td>
                  </tr>
                ) : (
                  remittances.map((recon) => (
                    <tr key={recon.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {new Date(recon.period_date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          ${recon.total_collected.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          ${recon.total_advances.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          ${recon.driver_commissions.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-blue-600">
                          ${recon.net_remittance_due.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRemittanceStatusColor(recon.status)}`}>
                          {recon.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showReconciliationModal && (
        <ReconciliationModal
          drivers={drivers}
          onClose={() => setShowReconciliationModal(false)}
          onSuccess={() => {
            setShowReconciliationModal(false);
            loadRemittances();
            loadTransactions();
          }}
        />
      )}
    </div>
  );
}
