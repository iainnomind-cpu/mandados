import { useEffect, useRef, useCallback, useState } from 'react';
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

// ─── Sound helper (Web Audio API — no files needed) ───
function playNotificationSound(type: 'message' | 'order') {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        if (type === 'message') {
            // Short double-beep for messages
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);        // A5
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.3);
        } else {
            // Rising chime for orders
            oscillator.frequency.setValueAtTime(523, ctx.currentTime);        // C5
            oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1);  // E5
            oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.2);  // G5
            oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.3); // C6
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.5);
        }

        // Cleanup
        oscillator.onended = () => ctx.close();
    } catch (e) {
        // Audio not available — silent fallback
        console.warn('Audio not available:', e);
    }
}

// ─── Browser notification helper ───
function showBrowserNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
    }
}

// ─── Hook ───
export function useGlobalNotifications() {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [latestToast, setLatestToast] = useState<AppNotification | null>(null);
    const initializedRef = useRef(false);

    const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
        const notification: AppNotification = {
            ...n,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            read: false,
        };

        setNotifications((prev) => [notification, ...prev].slice(0, 50)); // keep 50 max
        setLatestToast(notification);

        // Play sound
        playNotificationSound(n.type === 'new_message' ? 'message' : 'order');

        // Browser notification (if tab not focused)
        if (document.hidden) {
            showBrowserNotification(n.title, n.body);
        }
    }, []);

    const dismissToast = useCallback(() => {
        setLatestToast(null);
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    // ─── Request browser notification permission on mount ───
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // ─── Subscribe to realtime events ───
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        // Listen for new customer messages (not bot/operator)
        const channel = supabase
            .channel('global-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
            }, (payload: any) => {
                const msg = payload.new;
                if (msg.sender_type === 'customer') {
                    addNotification({
                        type: 'new_message',
                        title: '💬 Nuevo mensaje',
                        body: msg.message?.substring(0, 80) || 'Mensaje recibido',
                    });
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'orders',
            }, (payload: any) => {
                const order = payload.new;
                if (order.source === 'chatbot') {
                    addNotification({
                        type: 'new_order',
                        title: '📦 ¡Nuevo pedido!',
                        body: `Pedido ${order.order_number || ''} — ${order.customer_name || 'WhatsApp'}`,
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            initializedRef.current = false;
        };
    }, [addNotification]);

    return {
        notifications,
        latestToast,
        unreadCount,
        dismissToast,
        clearNotifications,
        markAllRead,
    };
}
