import { useState, useEffect, useMemo } from 'react';
import {
  MessageSquareText, Send, RefreshCw, Check, AlertCircle,
  FileText, Trash2, ChevronDown, ChevronUp, Eye, EyeOff,
  Sparkles, Info, X
} from 'lucide-react';

// ─── Types ───
interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components?: Array<{ type: string; text?: string; format?: string }>;
}

// ─── Status badge colors ───
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  APPROVED:  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  PENDING:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  REJECTED:  { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  IN_APPEAL: { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  DISABLED:  { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400' },
};

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    APPROVED: 'Aprobada',
    PENDING: 'En revisión',
    REJECTED: 'Rechazada',
    IN_APPEAL: 'En apelación',
    DISABLED: 'Deshabilitada',
  };
  return map[status] || status;
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════
export default function WhatsAppTemplates() {
  // ─── Form state ───
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');

  // ─── UI state ───
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ─── Templates list ───
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // ─── Preview toggle ───
  const [showPreview, setShowPreview] = useState(true);

  // ─── Delete state ───
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── Sanitized name preview ───
  const sanitizedName = useMemo(() => {
    return name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }, [name]);

  // ─── Variable detection ───
  const detectedVars = useMemo(() => {
    const matches = body.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches)].sort();
  }, [body]);

  // ─── WhatsApp preview ───
  const previewBody = useMemo(() => {
    const exampleValues = ['Juan Pérez', 'Pollo asado x1', 'Pizza Pomodori, Centro', 'Vigía 39, Col. Hacienda', '$45.00'];
    let preview = body;
    detectedVars.forEach((v) => {
      const idx = parseInt(v.replace(/\{|\}/g, '')) - 1;
      const val = exampleValues[idx] || `valor_${idx + 1}`;
      preview = preview.replace(v, `*${val}*`);
    });
    return preview;
  }, [body, detectedVars]);

  // ─── Load templates ───
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/whatsapp-template');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      } else {
        console.error('Error loading templates:', data.error);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    if (showTemplates && templates.length === 0) {
      loadTemplates();
    }
  }, [showTemplates]);

  // ─── Submit template ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim() || !body.trim()) {
      setError('El nombre y el cuerpo del mensaje son obligatorios.');
      return;
    }

    if (!sanitizedName) {
      setError('El nombre de la plantilla debe contener al menos un carácter alfanumérico.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/whatsapp-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sanitizedName,
          body: body.trim(),
          header: header.trim() || undefined,
          footer: footer.trim() || undefined,
          category: 'UTILITY',
          language: 'es_MX',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMsg(data.message || '¡Plantilla enviada a revisión exitosamente!');
        setSubmitted(true);
        setName('');
        setBody('');
        setHeader('');
        setFooter('');
        setTimeout(() => setSubmitted(false), 4000);

        // Refresh templates list if visible
        if (showTemplates) {
          loadTemplates();
        }
      } else {
        const detail = data.details?.error?.error_user_msg
          || data.details?.error?.message
          || data.error
          || 'Error desconocido al crear la plantilla';
        setError(detail);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete template ───
  const handleDelete = async (templateName: string) => {
    if (!confirm(`¿Estás seguro de eliminar la plantilla "${templateName}"?`)) return;

    setDeletingId(templateName);
    try {
      const res = await fetch('/api/whatsapp-template', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName }),
      });

      const data = await res.json();
      if (data.success) {
        setTemplates(prev => prev.filter(t => t.name !== templateName));
        setSuccessMsg(`Plantilla "${templateName}" eliminada.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.error || 'Error al eliminar la plantilla');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Quick insert variable ───
  const insertVariable = (num: number) => {
    setBody(prev => `${prev}{{${num}}}`);
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ── Section Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-purple-50 via-white to-emerald-50/30 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <MessageSquareText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Plantillas de WhatsApp</h3>
              <p className="text-xs text-slate-500 mt-0.5">Crea y gestiona plantillas de mensaje aprobadas por Meta</p>
            </div>
          </div>
        </div>

        {/* ── Notifications ── */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-1">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-sm text-red-700">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-1">
            <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-sm text-emerald-700">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Template Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Nombre de la plantilla <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: aviso_entrega_repartidor"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-400"
            />
            {name && sanitizedName !== name && (
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Se registrará como: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-purple-600 font-mono text-[11px]">{sanitizedName}</code>
              </p>
            )}
          </div>

          {/* Header (optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Encabezado <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              placeholder="ej: Notificación de Entrega"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-600">
                Cuerpo del mensaje <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-medium">Insertar variable:</span>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => insertVariable(n)}
                    className="px-2 py-0.5 text-[11px] font-mono bg-purple-50 text-purple-600 border border-purple-200 rounded-md hover:bg-purple-100 hover:border-purple-300 transition-all active:scale-95"
                  >
                    {`{{${n}}}`}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="ej: Hola {{1}}, tu pedido ({{2}}) se recogerá en {{3}} y se entregará en {{4}}. Total: {{5}}. ¡Gracias!"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all placeholder:text-slate-400"
            />
            {detectedVars.length > 0 && (
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span className="text-[11px] text-slate-500">Variables detectadas:</span>
                {detectedVars.map(v => (
                  <span key={v} className="text-[11px] font-mono bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100">{v}</span>
                ))}
              </div>
            )}
          </div>

          {/* Footer (optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Pie de mensaje <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="ej: Mandados ERP — Entregas a domicilio"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-400"
            />
          </div>

          {/* ── WhatsApp Preview ── */}
          <div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors mb-2"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? 'Ocultar vista previa' : 'Mostrar vista previa'}
            </button>

            {showPreview && body.trim() && (
              <div className="bg-gradient-to-br from-[#e5ddd5] to-[#d4cec4] rounded-2xl p-5 relative overflow-hidden">
                {/* WhatsApp pattern overlay */}
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }} />
                <div className="relative max-w-sm ml-auto space-y-1">
                  {/* Header */}
                  {header.trim() && (
                    <div className="bg-[#dcf8c6] rounded-xl rounded-tr-sm px-4 pt-3 pb-1 shadow-sm">
                      <p className="text-[13px] font-bold text-slate-800">{header.trim()}</p>
                    </div>
                  )}
                  {/* Body */}
                  <div className="bg-[#dcf8c6] rounded-xl rounded-tr-sm px-4 py-3 shadow-sm">
                    <p className="text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed">{previewBody}</p>
                    {/* Footer */}
                    {footer.trim() && (
                      <p className="text-[11px] text-slate-500 mt-2 border-t border-emerald-200/50 pt-1.5">{footer.trim()}</p>
                    )}
                    <p className="text-[10px] text-slate-500 text-right mt-1">
                      {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Config defaults info ── */}
          <div className="flex items-center gap-3 px-4 py-3 bg-purple-50/50 border border-purple-100 rounded-xl">
            <Info className="w-4 h-4 text-purple-500 shrink-0" />
            <p className="text-[11px] text-purple-700">
              La plantilla se registrará con categoría <strong>UTILITY</strong> e idioma <strong>es_MX</strong>.
              Meta la revisará antes de aprobarla (normalmente tarda minutos).
            </p>
          </div>

          {/* ── Submit button ── */}
          <button
            type="submit"
            disabled={submitting || !name.trim() || !body.trim()}
            className={`w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm shadow-lg transition-all duration-300 ${
              submitted
                ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                : 'bg-gradient-to-r from-purple-600 to-emerald-600 text-white hover:from-purple-700 hover:to-emerald-700 shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-[1.01] active:scale-[0.99]'
            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
          >
            {submitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : submitted ? (
              <Check className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {submitting ? 'Registrando en Meta...' : submitted ? '¡Enviada a Revisión!' : 'Registrar Plantilla en Meta'}
          </button>
        </form>
      </div>

      {/* ── Existing Templates List ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => {
            setShowTemplates(!showTemplates);
            if (!showTemplates && templates.length === 0) loadTemplates();
          }}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-purple-600" />
            <div className="text-left">
              <h3 className="font-bold text-slate-700 text-sm">Plantillas Registradas</h3>
              <p className="text-[11px] text-slate-500">Ver plantillas existentes en tu cuenta de WhatsApp Business</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <span className="text-xs font-semibold bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full border border-purple-100">
                {templates.length}
              </span>
            )}
            {showTemplates ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </button>

        {showTemplates && (
          <div className="border-t border-slate-100">
            {/* Refresh bar */}
            <div className="px-6 py-3 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {loadingTemplates ? 'Cargando...' : `${templates.length} plantilla(s) encontrada(s)`}
              </span>
              <button
                onClick={loadTemplates}
                disabled={loadingTemplates}
                className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTemplates ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>

            {loadingTemplates ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No hay plantillas registradas</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {templates.map((t) => {
                  const statusStyle = STATUS_COLORS[t.status] || STATUS_COLORS.PENDING;
                  const bodyComp = t.components?.find(c => c.type === 'BODY');

                  return (
                    <div
                      key={t.id}
                      className="px-6 py-4 hover:bg-slate-50/50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold text-slate-800 truncate">{t.name}</span>
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                              {getStatusLabel(t.status)}
                            </span>
                          </div>
                          {bodyComp?.text && (
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{bodyComp.text}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-slate-400">{t.category}</span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[10px] text-slate-400">{t.language}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(t.name)}
                          disabled={deletingId === t.name}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                          title="Eliminar plantilla"
                        >
                          {deletingId === t.name ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
