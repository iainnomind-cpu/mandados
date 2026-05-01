import { useEffect, useState } from 'react';
import {
    MessageCircle, Package, X, Bell, BellOff, Trash2, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { useGlobalNotifications, AppNotification } from '../hooks/useGlobalNotifications';

// Helper: dispatch navigation event (works from anywhere, no React context)
function navigateToChatConversation(conversationId?: string) {
    window.dispatchEvent(new CustomEvent('erp:navigate-to-chat', { detail: conversationId }));
}

// ─── Notification item in dropdown ───
function NotificationItem({
    n,
    onClose,
}: {
    n: AppNotification;
    onClose?: () => void;
}) {
    const isMessage = n.type === 'new_message';
    const isEscalation = n.type === 'escalation';
    const timeStr = new Date(n.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const handleGoToChat = () => {
        navigateToChatConversation(n.conversationId);
        onClose?.();
    };

    return (
        <div className={`flex flex-col border-b transition-colors ${isEscalation ? 'border-red-100 bg-red-50/60' : 'border-slate-100 bg-white'
            } ${n.read ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isEscalation
                    ? 'bg-red-500 text-white'
                    : isMessage ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                    {isEscalation
                        ? <AlertTriangle className="w-4 h-4" />
                        : isMessage ? <MessageCircle className="w-4 h-4" /> : <Package className="w-4 h-4" />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${isEscalation ? 'text-red-800' : 'text-slate-700'}`}>{n.title}</p>
                    <p className={`text-xs mt-0.5 ${isEscalation ? 'text-red-600' : 'text-slate-500'}`}>{n.body}</p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">{timeStr}</span>
            </div>

            {/* Go to chat button inside the dropdown for escalations */}
            {isEscalation && (
                <button
                    onClick={handleGoToChat}
                    className="mx-4 mb-3 flex items-center justify-center gap-1.5 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold rounded-lg transition-colors"
                >
                    <MessageCircle className="w-3 h-3" />
                    Ir al chat ahora
                    <ArrowRight className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

// ─── Bell + dropdown panel for the header ───
export function NotificationBell() {
    const {
        notifications,
        unreadCount,
        clearNotifications,
        markAllRead,
    } = useGlobalNotifications();

    const [showPanel, setShowPanel] = useState(false);
    const escalationCount = notifications.filter(n => n.type === 'escalation' && !n.read).length;

    const handleGoToChat = (conversationId?: string) => {
        navigateToChatConversation(conversationId);
        setShowPanel(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => { setShowPanel(!showPanel); if (!showPanel) markAllRead(); }}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Notificaciones"
            >
                <Bell className={`w-5 h-5 ${escalationCount > 0 ? 'text-red-500' : ''}`} />
                {unreadCount > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center ${escalationCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
                        }`}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {showPanel && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />

                    {/* Panel — anchored right but won't overflow left */}
                    <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-white" />
                                <h4 className="text-sm font-bold text-white">Notificaciones</h4>
                                {escalationCount > 0 && (
                                    <span className="text-[10px] font-bold bg-red-400 text-white px-2 py-0.5 rounded-full animate-pulse">
                                        {escalationCount} urgente{escalationCount > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {notifications.length > 0 && (
                                    <button
                                        onClick={clearNotifications}
                                        className="p-1.5 text-white/70 hover:text-white rounded-md hover:bg-white/10 transition-colors"
                                        title="Limpiar todas"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowPanel(false)}
                                    className="p-1.5 text-white/70 hover:text-white rounded-md hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[420px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                    <BellOff className="w-8 h-8 mb-2 opacity-40" />
                                    <p className="text-sm">Sin notificaciones</p>
                                </div>
                            ) : (
                                notifications.map((n) => (
                                    <NotificationItem
                                        key={n.id}
                                        n={n}
                                        onClose={() => setShowPanel(false)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Floating toast — positioned bottom-center to avoid being cut off ───
export default function GlobalNotifications() {
    const { latestToast, dismissToast } = useGlobalNotifications();
    const isEscalation = latestToast?.type === 'escalation';

    useEffect(() => {
        if (!latestToast) return;
        const timer = setTimeout(dismissToast, isEscalation ? 15000 : 4000);
        return () => clearTimeout(timer);
    }, [latestToast, dismissToast, isEscalation]);

    if (!latestToast) return null;

    const handleGoToChat = () => {
        // Use custom event — works regardless of React context timing
        navigateToChatConversation(latestToast.conversationId);
        dismissToast();
    };

    return (
        <>
            {/* Bottom-center toast — fully visible, never cut off by sidebar */}
            <div
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4"
                style={{ animation: isEscalation ? 'notif-rise-shake 0.5s ease-out' : 'notif-rise 0.3s ease-out' }}
            >
                <div className={`flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${isEscalation
                    ? 'bg-red-50 border-red-300 shadow-red-500/30'
                    : latestToast.type === 'new_message'
                        ? 'bg-white border-blue-200'
                        : 'bg-white border-emerald-200'
                    }`}>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isEscalation
                            ? 'bg-red-500 text-white animate-pulse'
                            : latestToast.type === 'new_message'
                                ? 'bg-blue-500 text-white'
                                : 'bg-emerald-500 text-white'
                            }`}>
                            {isEscalation
                                ? <AlertTriangle className="w-5 h-5" />
                                : latestToast.type === 'new_message'
                                    ? <MessageCircle className="w-5 h-5" />
                                    : <Package className="w-5 h-5" />
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold ${isEscalation ? 'text-red-800' : 'text-slate-800'}`}>
                                {latestToast.title}
                            </p>
                            <p className={`text-xs mt-0.5 ${isEscalation ? 'text-red-600' : 'text-slate-500'}`}>
                                {latestToast.body}
                            </p>
                        </div>
                        <button
                            onClick={dismissToast}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Action button for escalations */}
                    {isEscalation && (
                        <button
                            onClick={handleGoToChat}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-bold transition-colors"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Ir al chat con el problema
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes notif-rise {
          from { opacity: 0; transform: translateX(-50%) translateY(40px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes notif-rise-shake {
          0%   { opacity: 0; transform: translateX(-50%) translateY(40px); }
          50%  { opacity: 1; transform: translateX(-50%) translateY(-8px); }
          65%  { transform: translateX(calc(-50% + 6px)) translateY(0); }
          80%  { transform: translateX(calc(-50% - 4px)) translateY(0); }
          100% { transform: translateX(-50%) translateY(0); }
        }
      `}</style>
        </>
    );
}
