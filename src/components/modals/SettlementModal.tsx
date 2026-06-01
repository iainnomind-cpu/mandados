import { useState, useEffect, useCallback } from 'react';
import { X, DollarSign, Package, Zap, CheckCircle, AlertTriangle, Briefcase, ToggleLeft, ToggleRight } from 'lucide-react';
import { processSettlement } from '../../lib/financesSync';
import { calcularComision } from '../../lib/comision';
import CashCalculatorModal from './CashCalculatorModal';

interface SettlementModalProps {
  driverName: string;
  driverId: string;
  vehiclePlate: string;
  sencilloCount: number;
  complejoCount: number;
  dateStr: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SettlementModal({
  driverName,
  driverId,
  vehiclePlate,
  sencilloCount,
  complejoCount,
  dateStr,
  onClose,
  onSuccess,
}: SettlementModalProps) {
  const [dineroEntregado, setDineroEntregado] = useState<string>('');
  const [showF9, setShowF9] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Company fund state ---
  const [fondoActivo, setFondoActivo] = useState(false);
  const [fondoEmpresa, setFondoEmpresa] = useState<string>('');

  const comisionSencillo = calcularComision('sencillo');
  const comisionComplejo = calcularComision('complejo');
  const sumaComisiones = sencilloCount * comisionSencillo + complejoCount * comisionComplejo;

  const fondoNum = fondoActivo ? (parseFloat(fondoEmpresa) || 0) : 0;
  const totalEsperado = sumaComisiones + fondoNum;

  const entregadoNum = parseFloat(dineroEntregado) || 0;
  const diferencia = entregadoNum - totalEsperado;

  // F9 global listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        setShowF9(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleF9Apply = useCallback((total: number) => {
    setDineroEntregado(total.toFixed(2));
    setShowF9(false);
  }, []);

  const handleSubmit = async () => {
    if (!dineroEntregado || entregadoNum <= 0) {
      setError('Ingresa el monto entregado por el repartidor.');
      return;
    }

    if (fondoActivo && fondoNum <= 0) {
      setError('Ingresa el monto del fondo entregado por la empresa.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await processSettlement(
        driverId,
        driverName,
        dateStr,
        sencilloCount,
        complejoCount,
        totalEsperado,
        entregadoNum,
        fondoNum,
      );
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Error al procesar la liquidación');
    } finally {
      setLoading(false);
    }
  };

  // Format today
  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const getDiffColor = () => {
    if (dineroEntregado === '' || entregadoNum === 0) return { color: '#6b7280', bg: 'rgba(107,114,128,0.08)' };
    if (diferencia < 0) return { color: '#ef4444', bg: 'rgba(239,68,68,0.06)' };
    if (diferencia > 0) return { color: '#10b981', bg: 'rgba(16,185,129,0.06)' };
    return { color: '#22c55e', bg: 'rgba(34,197,94,0.08)' };
  };

  const diffStyle = getDiffColor();

  return (
    <>
      <div
        className="fixed inset-0 flex items-center justify-center z-[60] p-4"
        style={{ backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)' }}
      >
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-6 py-5 flex items-center justify-between shrink-0"
               style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderBottom: '1px solid #e2e8f0' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
                   style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Liquidar Corte de Caja</h2>
                <p className="text-xs text-slate-500 font-medium capitalize">{dateLabel}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 overflow-y-auto">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium"
                   style={{ background: 'rgba(239,68,68,0.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.15)' }}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Driver Info */}
            <div className="flex items-center gap-3 p-4 rounded-2xl"
                 style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
                {driverName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-900">{driverName}</p>
                <p className="text-xs text-slate-500 font-medium">{vehiclePlate}</p>
              </div>
            </div>

            {/* Breakdown table */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
              <div className="px-4 py-3" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Desglose de Comisiones</h3>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Package className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-800">Sencillo</span>
                      <span className="text-xs text-slate-400 ml-1.5">× ${comisionSencillo}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 mr-2">{sencilloCount} pedidos</span>
                    <span className="text-sm font-bold text-slate-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      ${(sencilloCount * comisionSencillo).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-800">Complejo</span>
                      <span className="text-xs text-slate-400 ml-1.5">× ${comisionComplejo}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 mr-2">{complejoCount} pedidos</span>
                    <span className="text-sm font-bold text-slate-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      ${(complejoCount * comisionComplejo).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Company fund row — conditional */}
                {fondoActivo && fondoNum > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between"
                       style={{ background: 'rgba(245,158,11,0.04)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-amber-800">Fondo Empresa</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-amber-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        +${fondoNum.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Total Esperado */}
                <div className="px-4 py-3.5 flex items-center justify-between"
                     style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)' }}>
                  <span className="text-sm font-black text-indigo-900 uppercase tracking-wide">Total Esperado</span>
                  <span className="text-xl font-black text-indigo-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    ${totalEsperado.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Company Fund Toggle */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => {
                  setFondoActivo(prev => !prev);
                  if (fondoActivo) setFondoEmpresa('');
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between transition-all hover:bg-slate-50/60"
                style={{ background: fondoActivo ? 'rgba(245,158,11,0.05)' : 'transparent' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                    style={{
                      background: fondoActivo
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : '#f1f5f9',
                      boxShadow: fondoActivo ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
                    }}
                  >
                    <Briefcase className={`w-4 h-4 ${fondoActivo ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                  <span className={`text-sm font-bold ${fondoActivo ? 'text-amber-800' : 'text-slate-600'}`}>
                    ¿La empresa dio fondo para compras al repartidor?
                  </span>
                </div>
                {fondoActivo ? (
                  <ToggleRight className="w-7 h-7 text-amber-500 shrink-0" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-300 shrink-0" />
                )}
              </button>

              {/* Conditional: Company fund input */}
              {fondoActivo && (
                <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <label className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 block">
                    Fondo Entregado por la Empresa
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-amber-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fondoEmpresa}
                      onChange={(e) => setFondoEmpresa(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      className="w-full pl-9 pr-4 py-3 text-lg font-bold rounded-xl outline-none transition-all"
                      style={{
                        background: 'rgba(245,158,11,0.04)',
                        border: '2px solid rgba(245,158,11,0.25)',
                        color: '#92400e',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#f59e0b';
                        e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.12)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(245,158,11,0.25)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-amber-600/70 mt-1.5 font-medium">
                    Este monto se sumará al total esperado del corte
                  </p>
                </div>
              )}
            </div>

            {/* Dinero entregado input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-700">
                  Dinero Entregado <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowF9(true)}
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                  style={{
                    background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                    color: '#e94560',
                    border: '1px solid rgba(233,69,96,0.3)',
                  }}
                >
                  F9 Calculadora
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={dineroEntregado}
                  onChange={(e) => setDineroEntregado(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-3.5 text-lg font-bold rounded-2xl outline-none transition-all"
                  style={{
                    background: '#f8fafc',
                    border: '2px solid #e2e8f0',
                    color: '#1e293b',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366f1';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Difference */}
            <div className="p-4 rounded-2xl transition-all" style={{ background: diffStyle.bg, border: `1px solid ${diffStyle.color}20` }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: diffStyle.color }}>
                  {dineroEntregado === '' || entregadoNum === 0
                    ? 'Ingresa el monto entregado'
                    : diferencia < 0
                      ? '⚠️ Faltante'
                      : diferencia > 0
                        ? '💰 Sobrante'
                        : '✅ Cuadra'}
                </span>
                {(dineroEntregado !== '' && entregadoNum > 0) && (
                  <span
                    className="text-xl font-black"
                    style={{ color: diffStyle.color, fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {diferencia >= 0 ? '+' : ''}{diferencia < 0 ? '-' : ''}${Math.abs(diferencia).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex gap-3 shrink-0" style={{ borderTop: '1px solid #e2e8f0' }}>
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50"
              style={{ border: '2px solid #e2e8f0' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !dineroEntregado || entregadoNum <= 0}
              className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{
                background: (!loading && dineroEntregado && entregadoNum > 0)
                  ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                  : '#94a3b8',
                boxShadow: (!loading && dineroEntregado && entregadoNum > 0)
                  ? '0 4px 14px rgba(99,102,241,0.3)'
                  : 'none',
              }}
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? 'Procesando...' : 'Confirmar Liquidación'}
            </button>
          </div>
        </div>
      </div>

      {/* F9 Calculator overlay */}
      {showF9 && (
        <CashCalculatorModal
          onApply={handleF9Apply}
          onClose={() => setShowF9(false)}
        />
      )}
    </>
  );
}
