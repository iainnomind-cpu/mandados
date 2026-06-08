import { useState, useEffect, useMemo } from 'react';
import {
  Clock, Save, Check, ToggleLeft, ToggleRight, Sun, Moon,
  AlertCircle, CalendarDays, MessageSquare, Globe, RefreshCw,
  Settings, ChevronDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import WhatsAppTemplates from './WhatsAppTemplates';

// ─── Types ───
interface DaySchedule {
  open: boolean;
  start: string;
  end: string;
}

interface BusinessHours {
  enabled: boolean;
  timezone: string;
  schedule: Record<string, DaySchedule>;
}

// ─── Constants ───
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const DAY_LABELS: Record<string, { name: string; short: string; emoji: string }> = {
  monday:    { name: 'Lunes',     short: 'Lun', emoji: '📅' },
  tuesday:   { name: 'Martes',    short: 'Mar', emoji: '📅' },
  wednesday: { name: 'Miércoles', short: 'Mié', emoji: '📅' },
  thursday:  { name: 'Jueves',    short: 'Jue', emoji: '📅' },
  friday:    { name: 'Viernes',   short: 'Vie', emoji: '📅' },
  saturday:  { name: 'Sábado',    short: 'Sáb', emoji: '🌤️' },
  sunday:    { name: 'Domingo',   short: 'Dom', emoji: '☀️' },
};

const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (CST/CDT)' },
  { value: 'America/Cancun', label: 'Cancún (EST)' },
  { value: 'America/Mazatlan', label: 'Mazatlán (MST/MDT)' },
  { value: 'America/Tijuana', label: 'Tijuana (PST/PDT)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (MST)' },
];

const DEFAULT_BH: BusinessHours = {
  enabled: false,
  timezone: 'America/Mexico_City',
  schedule: {
    monday:    { open: true,  start: '09:00', end: '20:00' },
    tuesday:   { open: true,  start: '09:00', end: '20:00' },
    wednesday: { open: true,  start: '09:00', end: '20:00' },
    thursday:  { open: true,  start: '09:00', end: '20:00' },
    friday:    { open: true,  start: '09:00', end: '20:00' },
    saturday:  { open: true,  start: '09:00', end: '14:00' },
    sunday:    { open: false, start: '09:00', end: '14:00' },
  },
};

const DEFAULT_MSG = '🕐 Gracias por escribirnos. En este momento nos encontramos fuera de nuestro horario de atención. ¡Te atenderemos con gusto en cuanto estemos de vuelta!';

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

function formatTime12(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function isWithinBusinessHours(bh: BusinessHours): { isOpen: boolean; currentDay: string; currentTime: string } {
  const tz = bh.timezone || 'America/Mexico_City';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'long',
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase() || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';
  const currentTime = `${hour}:${minute}`;

  const dayMap: Record<string, string> = {
    monday: 'monday', tuesday: 'tuesday', wednesday: 'wednesday',
    thursday: 'thursday', friday: 'friday', saturday: 'saturday', sunday: 'sunday',
  };
  const dayKey = dayMap[weekday] || 'monday';
  const schedule = bh.schedule[dayKey];

  if (!schedule || !schedule.open) {
    return { isOpen: false, currentDay: dayKey, currentTime };
  }

  const currentMinutes = parseInt(hour) * 60 + parseInt(minute);
  const [startH, startM] = schedule.start.split(':').map(Number);
  const [endH, endM] = schedule.end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return {
    isOpen: currentMinutes >= startMinutes && currentMinutes < endMinutes,
    currentDay: dayKey,
    currentTime,
  };
}

// ─── Tab types ───
type TabId = 'hours' | 'templates';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  description: string;
}

const TABS: Tab[] = [
  {
    id: 'hours',
    label: 'Horario de Atención',
    icon: '🕐',
    description: 'Configura los días y horas en que el bot responde',
  },
  {
    id: 'templates',
    label: 'Plantillas de WhatsApp',
    icon: '📋',
    description: 'Crea y gestiona plantillas aprobadas por Meta',
  },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function BusinessHoursConfig() {
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<TabId>('hours');

  // ── Business hours state ──
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_BH);
  const [outsideMessage, setOutsideMessage] = useState(DEFAULT_MSG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<{ isOpen: boolean; currentDay: string; currentTime: string } | null>(null);

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    const update = () => {
      if (businessHours.enabled) {
        setCurrentStatus(isWithinBusinessHours(businessHours));
      }
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [businessHours]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('system_settings')
        .select('business_hours, outside_hours_message')
        .eq('id', 1)
        .maybeSingle();

      if (err) throw err;
      if (data) {
        if (data.business_hours) setBusinessHours(data.business_hours);
        if (data.outside_hours_message) setOutsideMessage(data.outside_hours_message);
      } else {
        console.warn('⚠️ No se encontró la fila system_settings id=1. Se creará al guardar.');
      }
    } catch (e: any) {
      console.error('Error loading settings:', e);
      setError('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      console.log('💾 Guardando configuración:', JSON.stringify(businessHours, null, 2));
      const { error: err, data: upsertData } = await supabase
        .from('system_settings')
        .upsert({
          id: 1,
          business_hours: businessHours,
          outside_hours_message: outsideMessage,
        }, { onConflict: 'id' })
        .select();

      if (err) { console.error('❌ Error al guardar:', err); throw err; }
      console.log('✅ Guardado exitoso, respuesta:', JSON.stringify(upsertData));

      const { data: verifyData } = await supabase
        .from('system_settings')
        .select('business_hours, outside_hours_message')
        .eq('id', 1)
        .maybeSingle();

      console.log('🔍 Verificación post-guardado:', JSON.stringify(verifyData?.business_hours, null, 2));
      if (verifyData?.business_hours) setBusinessHours(verifyData.business_hours);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      console.error('Error saving settings:', e);
      setError(`Error al guardar: ${e.message || 'desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = () => setBusinessHours(prev => ({ ...prev, enabled: !prev.enabled }));

  const toggleDayOpen = (day: string) => {
    setBusinessHours(prev => ({
      ...prev,
      schedule: { ...prev.schedule, [day]: { ...prev.schedule[day], open: !prev.schedule[day].open } },
    }));
  };

  const updateDayTime = (day: string, field: 'start' | 'end', value: string) => {
    setBusinessHours(prev => ({
      ...prev,
      schedule: { ...prev.schedule, [day]: { ...prev.schedule[day], [field]: value } },
    }));
  };

  const setTimezone = (tz: string) => setBusinessHours(prev => ({ ...prev, timezone: tz }));

  const getHoursWidth = (day: string): number => {
    const s = businessHours.schedule[day];
    if (!s || !s.open) return 0;
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  };

  const previewMessage = useMemo(() => {
    const scheduleLines: string[] = [];
    for (const day of DAY_ORDER) {
      const s = businessHours.schedule[day];
      const label = DAY_LABELS[day].name;
      if (s && s.open) {
        scheduleLines.push(`  📍 ${label}: ${s.start} - ${s.end}`);
      } else {
        scheduleLines.push(`  🔴 ${label}: Cerrado`);
      }
    }
    return `${outsideMessage}\n\n📋 *Nuestro horario de atención:*\n${scheduleLines.join('\n')}`;
  }, [businessHours, outsideMessage]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-500">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
              <p className="text-sm text-slate-500">Administra el comportamiento y notificaciones del sistema</p>
            </div>
          </div>

          {/* Save button — only visible on hours tab */}
          {activeTab === 'hours' && (
            <button
              onClick={saveSettings}
              disabled={saving}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm shadow-lg transition-all duration-300 ${
                saved
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30 hover:shadow-blue-500/50'
              } disabled:opacity-60`}
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar cambios'}
            </button>
          )}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* TAB NAVIGATION                                     */}
        {/* ══════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex">
            {TABS.map((tab, idx) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`settings-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex-1 flex items-center gap-3 px-6 py-4 text-left transition-all duration-200 group ${
                    idx > 0 ? 'border-l border-slate-100' : ''
                  } ${
                    isActive
                      ? 'bg-gradient-to-br from-blue-50/80 to-indigo-50/50'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Active indicator bar at bottom */}
                  <div
                    className={`absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 opacity-100'
                        : 'opacity-0'
                    }`}
                  />

                  {/* Icon bubble */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/25'
                      : 'bg-slate-100 group-hover:bg-slate-200'
                  }`}>
                    {tab.icon}
                  </div>

                  <div className="min-w-0">
                    <p className={`font-bold text-sm transition-colors duration-200 ${
                      isActive ? 'text-blue-700' : 'text-slate-600 group-hover:text-slate-800'
                    }`}>
                      {tab.label}
                    </p>
                    <p className={`text-[11px] truncate transition-colors duration-200 ${
                      isActive ? 'text-blue-500/80' : 'text-slate-400'
                    }`}>
                      {tab.description}
                    </p>
                  </div>

                  {isActive && (
                    <div className="ml-auto shrink-0 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* TAB CONTENT: HORARIO DE ATENCIÓN                  */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'hours' && (
          <div className="space-y-6">

            {/* ── Master Toggle Card ── */}
            <div className={`bg-white rounded-2xl border-2 transition-all duration-300 shadow-sm overflow-hidden ${
              businessHours.enabled ? 'border-blue-200 shadow-blue-100/50' : 'border-slate-200'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      businessHours.enabled
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25'
                        : 'bg-slate-100'
                    }`}>
                      <Clock className={`w-7 h-7 ${businessHours.enabled ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Control de Horario de Atención</h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {businessHours.enabled
                          ? 'El bot responderá solo durante el horario configurado'
                          : 'El bot responde las 24 horas, los 7 días de la semana'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleEnabled}
                    className="focus:outline-none transition-transform hover:scale-105 active:scale-95"
                  >
                    {businessHours.enabled ? (
                      <ToggleRight className="w-14 h-14 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-14 h-14 text-slate-300" />
                    )}
                  </button>
                </div>

                {/* Live status indicator */}
                {businessHours.enabled && currentStatus && (
                  <div className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    currentStatus.isOpen ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className={`w-3 h-3 rounded-full ${
                      currentStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                    }`} />
                    <div>
                      <span className={`text-sm font-semibold ${
                        currentStatus.isOpen ? 'text-emerald-700' : 'text-red-700'
                      }`}>
                        {currentStatus.isOpen ? '🟢 Actualmente ABIERTO' : '🔴 Actualmente CERRADO'}
                      </span>
                      <span className="text-xs text-slate-500 ml-3">
                        {DAY_LABELS[currentStatus.currentDay]?.name} — {formatTime12(currentStatus.currentTime)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Schedule configuration (only when enabled) ── */}
            {businessHours.enabled && (
              <>
                {/* Timezone selector */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Globe className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-slate-700">Zona Horaria</h3>
                  </div>
                  <div className="relative">
                    <select
                      value={businessHours.timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full md:w-96 appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Weekly schedule */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-slate-700">Horario Semanal</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 ml-8">Configura el horario de atención para cada día de la semana</p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {DAY_ORDER.map((day) => {
                      const schedule = businessHours.schedule[day];
                      const dayInfo = DAY_LABELS[day];
                      const hours = getHoursWidth(day);
                      const isWeekend = day === 'saturday' || day === 'sunday';
                      const isToday = currentStatus?.currentDay === day;

                      return (
                        <div
                          key={day}
                          className={`px-6 py-4 flex items-center gap-4 transition-all duration-200 ${
                            isToday ? 'bg-blue-50/50' : isWeekend ? 'bg-slate-50/50' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Day label */}
                          <div className="w-28 shrink-0">
                            <div className="flex items-center gap-2">
                              {isToday && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                              <span className={`font-semibold text-sm ${
                                schedule.open ? 'text-slate-800' : 'text-slate-400'
                              } ${isToday ? 'text-blue-700' : ''}`}>
                                {dayInfo.emoji} {dayInfo.name}
                              </span>
                            </div>
                            {isToday && <span className="text-[10px] font-medium text-blue-500 ml-4">HOY</span>}
                          </div>

                          {/* Toggle switch */}
                          <button
                            onClick={() => toggleDayOpen(day)}
                            className={`relative w-12 h-6 rounded-full transition-all duration-300 shrink-0 ${
                              schedule.open ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' : 'bg-slate-200'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
                              schedule.open ? 'left-[26px]' : 'left-0.5'
                            }`} />
                          </button>

                          {/* Open/Closed label */}
                          <span className={`text-xs font-semibold w-16 shrink-0 ${
                            schedule.open ? 'text-emerald-600' : 'text-slate-400'
                          }`}>
                            {schedule.open ? 'Abierto' : 'Cerrado'}
                          </span>

                          {schedule.open ? (
                            <>
                              <div className="flex items-center gap-2">
                                <Sun className="w-4 h-4 text-amber-500" />
                                <select
                                  value={schedule.start}
                                  onChange={(e) => updateDayTime(day, 'start', e.target.value)}
                                  className="appearance-none px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer hover:bg-white transition-colors"
                                >
                                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime12(t)}</option>)}
                                </select>
                              </div>
                              <span className="text-slate-300 font-bold">—</span>
                              <div className="flex items-center gap-2">
                                <Moon className="w-4 h-4 text-indigo-400" />
                                <select
                                  value={schedule.end}
                                  onChange={(e) => updateDayTime(day, 'end', e.target.value)}
                                  className="appearance-none px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer hover:bg-white transition-colors"
                                >
                                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime12(t)}</option>)}
                                </select>
                              </div>
                              <div className="flex-1 flex items-center gap-2 ml-2">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, (hours / 24) * 100)}%` }}
                                  />
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium shrink-0 w-10 text-right">
                                  {hours.toFixed(1)}h
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex-1 flex items-center">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full" />
                              <span className="text-[11px] text-slate-300 font-medium ml-2">—</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Weekly summary footer */}
                  <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {DAY_ORDER.filter(d => businessHours.schedule[d].open).length} de 7 días activos
                    </span>
                    <span className="text-xs text-slate-500">
                      Total: {DAY_ORDER.reduce((acc, d) => acc + getHoursWidth(d), 0).toFixed(1)} horas/semana
                    </span>
                  </div>
                </div>

                {/* Outside Hours Message */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-slate-700">Mensaje Fuera de Horario</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 ml-8">Este mensaje se enviará automáticamente junto con el horario de atención</p>
                  </div>
                  <div className="p-6 space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">Mensaje personalizado:</label>
                      <textarea
                        value={outsideMessage}
                        onChange={(e) => setOutsideMessage(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors"
                        placeholder="Escribe el mensaje que recibirán los clientes fuera del horario de atención..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">Vista previa (así lo verá el cliente en WhatsApp):</label>
                      <div className="bg-gradient-to-br from-[#e5ddd5] to-[#d4cec4] rounded-2xl p-5 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-5" style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                        }} />
                        <div className="relative max-w-sm ml-auto">
                          <div className="bg-[#dcf8c6] rounded-xl rounded-tr-sm px-4 py-3 shadow-sm">
                            <p className="text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed">{previewMessage}</p>
                            <p className="text-[10px] text-slate-500 text-right mt-1">
                              {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} ✓✓
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Disabled state info */}
            {!businessHours.enabled && (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-400 mb-2">Horario desactivado</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  El bot está configurado para responder las 24 horas, los 7 días de la semana.
                  Activa el control de horario para que el bot solo responda durante las horas configuradas.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* TAB CONTENT: PLANTILLAS DE WHATSAPP               */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'templates' && (
          <WhatsAppTemplates />
        )}

      </div>
    </div>
  );
}
