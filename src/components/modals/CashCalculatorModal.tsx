import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Calculator, Check } from 'lucide-react';

interface CashCalculatorModalProps {
  onApply: (total: number) => void;
  onClose: () => void;
}

const DENOMINATIONS = [
  { value: 1000, label: '$1,000' },
  { value: 500, label: '$500' },
  { value: 200, label: '$200' },
  { value: 100, label: '$100' },
  { value: 50, label: '$50' },
  { value: 20, label: '$20' },
  { value: 10, label: '$10' },
  { value: 5, label: '$5' },
  { value: 2, label: '$2' },
  { value: 1, label: '$1' },
  { value: 0.5, label: '$0.50' },
];

export default function CashCalculatorModal({ onApply, onClose }: CashCalculatorModalProps) {
  const [pieces, setPieces] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    DENOMINATIONS.forEach(d => { init[d.value] = 0; });
    return init;
  });

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const updatePieces = useCallback((denom: number, val: string) => {
    const num = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
    setPieces(prev => ({ ...prev, [denom]: num }));
  }, []);

  const total = DENOMINATIONS.reduce((sum, d) => sum + d.value * (pieces[d.value] || 0), 0);

  const handleApply = () => {
    onApply(total);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[70] p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #e94560, #c23152)' }}>
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Calculadora de Efectivo</h2>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">F9 — Denominaciones MXN</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table */}
        <div className="px-5 py-4 space-y-1.5 max-h-[55vh] overflow-y-auto">
          {/* Column headers */}
          <div className="grid grid-cols-3 gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">
            <span>Denominación</span>
            <span className="text-center">Piezas</span>
            <span className="text-right">Subtotal</span>
          </div>

          {DENOMINATIONS.map((d, idx) => {
            const subtotal = d.value * (pieces[d.value] || 0);
            return (
              <div
                key={d.value}
                className="grid grid-cols-3 gap-3 items-center py-1.5 px-2 rounded-lg transition-all"
                style={{
                  background: pieces[d.value] > 0 ? 'rgba(233,69,96,0.08)' : 'transparent',
                  borderLeft: pieces[d.value] > 0 ? '2px solid #e94560' : '2px solid transparent',
                }}
              >
                <span className="text-sm font-bold text-gray-200" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
                  {d.label}
                </span>
                <input
                  ref={idx === 0 ? firstInputRef : undefined}
                  type="number"
                  min={0}
                  value={pieces[d.value] || ''}
                  placeholder="0"
                  onChange={(e) => updatePieces(d.value, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full text-center text-sm font-semibold rounded-lg py-1.5 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e0e0e0',
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  }}
                />
                <span
                  className="text-right text-sm font-bold"
                  style={{
                    color: subtotal > 0 ? '#10b981' : '#4a4a5a',
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  }}
                >
                  ${subtotal.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer — Total + Apply */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-300 uppercase tracking-wide">Total General</span>
            <span
              className="text-2xl font-black"
              style={{
                color: total > 0 ? '#10b981' : '#6b7280',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}
            >
              ${total.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#9ca3af',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              disabled={total === 0}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{
                background: total > 0
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'rgba(255,255,255,0.05)',
                boxShadow: total > 0 ? '0 4px 14px rgba(16,185,129,0.3)' : 'none',
              }}
            >
              <Check className="w-4 h-4" />
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
