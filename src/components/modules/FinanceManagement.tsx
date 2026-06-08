import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, Truck, CheckCircle,
  Clock, Package, Zap, Receipt, RefreshCcw,
} from 'lucide-react';

import {
  getDriverSettlementData,
  getFinanceKPIs,
  getSettlementHistory,
  type DriverSettlementRow,
  type SettlementRecord,
} from '../../lib/financesSync';
import { useRealtimeOrders } from '../../hooks/useRealtimeSync';
import SettlementModal from '../modals/SettlementModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  title,
  value,
  icon: Icon,
  gradient,
  shadowColor,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  gradient: string;
  shadowColor: string;
  subtitle?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-white"
      style={{ background: gradient, boxShadow: `0 8px 32px ${shadowColor}` }}
    >
      <div className="relative z-10">
        <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">{title}</p>
        <p className="text-3xl font-black" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {value}
        </p>
        {subtitle && (
          <p className="text-[10px] mt-1 opacity-70 font-medium">{subtitle}</p>
        )}
      </div>
      {/* Decorative icon */}
      <Icon className="absolute -right-2 -bottom-2 w-20 h-20 opacity-10" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function FinanceManagement() {
  const [date] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState({ totalComisiones: 0, pendientesCalle: 0, liquidadas: 0 });

  // Driver settlement table
  const [driverRows, setDriverRows] = useState<DriverSettlementRow[]>([]);

  // Settlement history
  const [history, setHistory] = useState<SettlementRecord[]>([]);

  // Settlement modal
  const [settlementTarget, setSettlementTarget] = useState<DriverSettlementRow | null>(null);

  // ---------- Load data ----------
  const loadAll = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [kpiData, rows, hist] = await Promise.all([
        getFinanceKPIs(date),
        getDriverSettlementData(date),
        getSettlementHistory(20),
      ]);
      setKpis(kpiData);
      setDriverRows(rows);
      setHistory(hist);
    } catch (err) {
      console.error('FinanceManagement load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime refresh on orders change
  const realtimeCb = useCallback(() => {
    loadAll(false);
  }, [loadAll]);

  useRealtimeOrders(realtimeCb);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAll(false);
  };

  // ---------- Date label ----------
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ---------- Settlement totals ----------
  const totalPedidos = driverRows.reduce((s, r) => s + r.sencilloCount + r.complejoCount, 0);

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}
            >
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Central de Liquidación</h1>
              <p className="text-sm text-slate-500 capitalize">{dateLabel}</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <KpiCard
            title="Total Ingresos por Comisiones"
            value={`$${kpis.totalComisiones.toFixed(2)}`}
            icon={TrendingUp}
            gradient="linear-gradient(135deg, #6366f1, #4f46e5)"
            shadowColor="rgba(99,102,241,0.25)"
            subtitle={`${totalPedidos} pedidos entregados hoy`}
          />
          <KpiCard
            title="Comisiones Pendientes en Calle"
            value={`$${kpis.pendientesCalle.toFixed(2)}`}
            icon={Truck}
            gradient="linear-gradient(135deg, #f59e0b, #d97706)"
            shadowColor="rgba(245,158,11,0.25)"
            subtitle="Pedidos asignados / en tránsito"
          />
          <KpiCard
            title="Comisiones Ya Liquidadas"
            value={`$${kpis.liquidadas.toFixed(2)}`}
            icon={CheckCircle}
            gradient="linear-gradient(135deg, #10b981, #059669)"
            shadowColor="rgba(16,185,129,0.25)"
            subtitle="Cortes procesados hoy"
          />
        </div>

        {/* Corte de Caja Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6" style={{ border: '1px solid #e2e8f0' }}>
          <div className="px-5 py-4 flex items-center justify-between"
               style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Corte de Caja — Por Repartidor</h2>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {driverRows.length} repartidor{driverRows.length !== 1 ? 'es' : ''}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Repartidor</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1">
                      <Package className="w-3 h-3" />Sencillos
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" />Complejos
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Comisiones</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-5 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-slate-100 rounded-lg animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : driverRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <Clock className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                      <p className="text-sm font-medium text-slate-400">No hay entregas completadas hoy</p>
                      <p className="text-xs text-slate-300 mt-1">Los cortes aparecerán aquí conforme se completen pedidos</p>
                    </td>
                  </tr>
                ) : (
                  driverRows.map((row) => {
                    const totalPedidosRow = row.sencilloCount + row.complejoCount;
                    return (
                      <tr key={row.driverId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0"
                              style={{ background: row.settled ? '#10b981' : '#6366f1' }}
                            >
                              {row.driverName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{row.driverName}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{row.vehiclePlate} · {totalPedidosRow} pedido{totalPedidosRow !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
                            <Package className="w-3 h-3" />
                            {row.sencilloCount}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-50 text-violet-700" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
                            <Zap className="w-3 h-3" />
                            {row.complejoCount}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-base font-black text-slate-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            ${row.totalComisiones.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {row.settled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 uppercase tracking-wider"
                                  style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                              <CheckCircle className="w-3 h-3" />
                              Liquidado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 uppercase tracking-wider"
                                  style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                              <Clock className="w-3 h-3" />
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {row.settled ? (
                            <span className="text-xs text-slate-400 font-medium">—</span>
                          ) : (
                            <button
                              onClick={() => setSettlementTarget(row)}
                              className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:shadow-lg"
                              style={{
                                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                              }}
                            >
                              Liquidar Corte
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settlement History */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
          <div className="px-5 py-4" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <h2 className="text-base font-bold text-slate-900">Historial de Liquidaciones</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Repartidor</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Esperado</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Entregado</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Diferencia</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fondo</th>
                  <th className="px-5 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">
                      No hay liquidaciones registradas
                    </td>
                  </tr>
                ) : (
                  history.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-600 font-medium">
                        {new Date(rec.period_date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900">{rec.driver_name}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        ${rec.total_expected.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        ${rec.total_delivered.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="font-bold text-sm"
                          style={{
                            color: rec.difference < 0 ? '#ef4444' : rec.difference > 0 ? '#10b981' : '#22c55e',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {rec.difference >= 0 ? '+' : ''}{rec.difference < 0 ? '-' : ''}${Math.abs(rec.difference).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rec.company_fund > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700"
                                style={{ border: '1px solid rgba(245,158,11,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>
                            ${rec.company_fund.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 uppercase"
                              style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                          <CheckCircle className="w-3 h-3" />
                          Liquidado
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

      {/* Settlement Modal */}
      {settlementTarget && (
        <SettlementModal
          driverName={settlementTarget.driverName}
          driverId={settlementTarget.driverId}
          vehiclePlate={settlementTarget.vehiclePlate}
          sencilloCount={settlementTarget.sencilloCount}
          complejoCount={settlementTarget.complejoCount}
          dateStr={date}
          onClose={() => setSettlementTarget(null)}
          onSuccess={() => {
            setSettlementTarget(null);
            loadAll(false);
          }}
        />
      )}
    </div>
  );
}
