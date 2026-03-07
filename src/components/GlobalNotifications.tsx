import { useEffect, useState } from 'react';
import {
    MessageCircle, Package, X, Bell, BellOff, Trash2,
} from 'lucide-react';
import { useGlobalNotifications, AppNotification } from '../hooks/useGlobalNotifications';

function NotificationItem({ n }: { n: AppNotification }) {
    const isMessage = n.type === 'new_message';
    const timeStr = new Date(n.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 transition-colors ${n.read ? 'opacity-60' : 'bg-white'
            }`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMessage ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                {isMessage ? <MessageCircle className="w-4 h-4" /> : <Package className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700">{n.title}</p>
                <p className="text-xs text-slate-500 truncate">{n.body}</p>
            </div>
            <span className="text-[10px] text-slate-400 shrink-0">{timeStr}</span>
        </div>
    );
}

export default function GlobalNotifications() {
    const {
        notifications,
        latestToast,
        unreadCount,
        dismissToast,
        clearNotifications,
        markAllRead,
    } = useGlobalNotifications();

    const [showPanel, setShowPanel] = useState(false);

    // Auto-dismiss toast after 4 seconds
    useEffect(() => {
        if (!latestToast) return;
        const timer = setTimeout(dismissToast, 4000);
        return () => clearTimeout(timer);
    }, [latestToast, dismissToast]);

    return (
        <>
            {/* ── Floating toast ── */}
            {latestToast && (
                <div className="fixed top-4 right-4 z-[9999] animate-slide-in">
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-sm max-w-sm ${latestToast.type === 'new_message'
                        ? 'bg-blue-50/95 border-blue-200'
                        : 'bg-emerald-50/95 border-emerald-200'
                        }`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${latestToast.type === 'new_message'
                            ? 'bg-blue-500 text-white'
                            : 'bg-emerald-500 text-white'
                            }`}>
                            {latestToast.type === 'new_message'
                                ? <MessageCircle className="w-5 h-5" />
                                : <Package className="w-5 h-5" />
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800">{latestToast.title}</p>
                            <p className="text-xs text-slate-500 truncate">{latestToast.body}</p>
                        </div>
                        <button
                            onClick={dismissToast}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Bell button (fixed position) ── */}
            <div className="fixed bottom-6 right-6 z-[9998]">
                <button
                    onClick={() => { setShowPanel(!showPanel); markAllRead(); }}
                    className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center hover:shadow-blue-500/50 transition-all relative"
                >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* ── Notifications panel ── */}
            {showPanel && (
                <div className="fixed bottom-20 right-6 z-[9998] w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-white" />
                            <h4 className="text-sm font-bold text-white">Notificaciones</h4>
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

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                <BellOff className="w-8 h-8 mb-2 opacity-40" />
                                <p className="text-sm">Sin notificaciones</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <NotificationItem key={n.id} n={n} />
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ── CSS animation ── */}
            <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
        </>
    );
}
