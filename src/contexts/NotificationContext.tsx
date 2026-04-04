import { createContext, useContext, useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ───
export interface AppNotification {
    id: string;
    type: 'new_message' | 'new_order' | 'escalation';
    title: string;
    body: string;
    timestamp: string;
    read: boolean;
    /** For escalation notifications — the conversation ID to navigate to */
    conversationId?: string;
}

interface NotificationContextValue {
    notifications: AppNotification[];
    latestToast: AppNotification | null;
    unreadCount: number;
    dismissToast: () => void;
    clearNotifications: () => void;
    markAllRead: () => void;
    /** Callback for navigating to the chat module (set by App) */
    onNavigateToChat: ((conversationId?: string) => void) | null;
    setOnNavigateToChat: (fn: (conversationId?: string) => void) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ─── Sound helper (Web Audio API — no files needed) ───
function playNotificationSound(type: 'message' | 'order' | 'escalation') {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        if (type === 'message') {
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.3);
        } else if (type === 'escalation') {
            // Urgent alarm — 3 loud beeps at high frequency
            oscillator.type = 'square';
            gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
            // Beep 1
            oscillator.frequency.setValueAtTime(1200, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            // Beep 2
            gainNode.gain.setValueAtTime(0.5, ctx.currentTime + 0.2);
            oscillator.frequency.setValueAtTime(1400, ctx.currentTime + 0.2);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
            // Beep 3
            gainNode.gain.setValueAtTime(0.5, ctx.currentTime + 0.4);
            oscillator.frequency.setValueAtTime(1600, ctx.currentTime + 0.4);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.65);
        } else {
            oscillator.frequency.setValueAtTime(523, ctx.currentTime);
            oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
            oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.5);
        }

        oscillator.onended = () => ctx.close();
    } catch (e) {
        console.warn('Audio not available:', e);
    }
}

// ─── Browser notification helper ───
function showBrowserNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
    }
}

// ─── Provider ───
export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [latestToast, setLatestToast] = useState<AppNotification | null>(null);

    // Track whether the initial load has completed (to suppress sounds on mount)
    const readyRef = useRef(false);

    const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
        const notification: AppNotification = {
            ...n,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            read: false,
        };

        setNotifications((prev) => [notification, ...prev].slice(0, 50));
        setLatestToast(notification);
        playNotificationSound(
            n.type === 'escalation' ? 'escalation' : n.type === 'new_message' ? 'message' : 'order'
        );

        if (document.hidden) {
            showBrowserNotification(n.title, n.body);
        }
    }, []);

    // Keep a ref so Supabase callbacks always call the latest version
    const addNotificationRef = useRef(addNotification);
    addNotificationRef.current = addNotification;

    const dismissToast = useCallback(() => setLatestToast(null), []);
    const clearNotifications = useCallback(() => setNotifications([]), []);
    const markAllRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, []);

    // Navigation callback for escalation toasts
    const [onNavigateToChat, setOnNavigateToChatState] = useState<((conversationId?: string) => void) | null>(null);
    const setOnNavigateToChat = useCallback((fn: (conversationId?: string) => void) => {
        setOnNavigateToChatState(() => fn);
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    // Request browser notification permission once
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // ─── Supabase Realtime subscriptions ───
    useEffect(() => {
        // Small delay so initial DB events (reconnection cache) are ignored
        const readyTimer = setTimeout(() => {
            readyRef.current = true;
        }, 3000);

        // ── Channel 1: All chat_messages (customer + bot escalation) ──
        // NOTE: Supabase Realtime does NOT allow two listeners with
        // different column filters on the SAME table in the SAME channel.
        // We use ONE listener without a column filter and decide inside.
        const msgsChannel = supabase
            .channel('global-chat-messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                },
                (payload) => {
                    if (!readyRef.current) return;
                    const msg = payload.new as any;
                    const text: string = msg.message || '';
                    const sender: string = msg.sender_type || '';

                    if (sender === 'customer') {
                        // Regular new message notification
                        addNotificationRef.current({
                            type: 'new_message',
                            title: '💬 Nuevo mensaje',
                            body: text.substring(0, 120) || 'Mensaje recibido',
                        });
                    } else if (sender === 'bot' && text.includes('ESCALAMIENTO')) {
                        // Escalation marker message
                        const razonMatch = text.match(/Raz[oó]n:\s*([^|]+)/);
                        const catMatch = text.match(/Categor[íi]a:\s*(\S+)/);
                        const razon = razonMatch ? razonMatch[1].trim() : 'Atención requerida';
                        const categoria = catMatch
                            ? catMatch[1].replace(/[—–\s].*$/, '').trim()
                            : 'otro';

                        const catLabels: Record<string, string> = {
                            pago: '💳 Problema de pago',
                            queja: '😤 Queja / Reclamo',
                            producto_danado: '📦 Producto dañado',
                            solicitud_especial: '✨ Solicitud especial',
                            otro: '❓ Requiere atención',
                        };

                        addNotificationRef.current({
                            type: 'escalation',
                            title: '🚨 ¡Requiere atención humana!',
                            body: `${catLabels[categoria] || '❓ Requiere atención'}: ${razon}`,
                            conversationId: msg.conversation_id,
                        });
                    }
                }
            )
            .subscribe();

        // ── Channel 2: New orders ──
        const ordersChannel = supabase
            .channel('global-orders')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'orders',
                },
                (payload) => {
                    if (!readyRef.current) return;
                    const order = payload.new as any;
                    addNotificationRef.current({
                        type: 'new_order',
                        title: '📦 ¡Nuevo pedido!',
                        body: `Pedido ${order.order_number || ''} — ${order.customer_name || 'WhatsApp'}`,
                    });
                }
            )
            .subscribe();

        return () => {
            clearTimeout(readyTimer);
            supabase.removeChannel(msgsChannel);
            supabase.removeChannel(ordersChannel);
        };
    }, []);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                latestToast,
                unreadCount,
                dismissToast,
                clearNotifications,
                markAllRead,
                onNavigateToChat,
                setOnNavigateToChat,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

// ─── Consumer hook ───
export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
    return ctx;
}
