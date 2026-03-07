import { createContext, useContext, useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ───
export interface AppNotification {
    id: string;
    type: 'new_message' | 'new_order';
    title: string;
    body: string;
    timestamp: string;
    read: boolean;
}

interface NotificationContextValue {
    notifications: AppNotification[];
    latestToast: AppNotification | null;
    unreadCount: number;
    dismissToast: () => void;
    clearNotifications: () => void;
    markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ─── Sound helper (Web Audio API — no files needed) ───
function playNotificationSound(type: 'message' | 'order') {
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
        playNotificationSound(n.type === 'new_message' ? 'message' : 'order');

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

        const channel = supabase
            .channel('global-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: 'sender_type=eq.customer',
                },
                (payload) => {
                    if (!readyRef.current) return;
                    const msg = payload.new as any;
                    addNotificationRef.current({
                        type: 'new_message',
                        title: '💬 Nuevo mensaje',
                        body: msg.message?.substring(0, 120) || 'Mensaje recibido',
                    });
                }
            )
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
            supabase.removeChannel(channel);
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
