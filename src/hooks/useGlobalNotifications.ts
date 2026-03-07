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
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.3);
        } else {
            // Rising chime for orders
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

// ─── Hook ───
export function useGlobalNotifications() {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [latestToast, setLatestToast] = useState<AppNotification | null>(null);

    // Use refs to avoid stale closures in polling/realtime callbacks
    const addNotificationRef = useRef<(n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void>();
    const lastMessageIdRef = useRef<string | null>(null);
    const lastOrderIdRef = useRef<string | null>(null);
    const hasInitialLoadRef = useRef(false);

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

    addNotificationRef.current = addNotification;

    const dismissToast = useCallback(() => setLatestToast(null), []);
    const clearNotifications = useCallback(() => setNotifications([]), []);
    const markAllRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    // Request browser notification permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // ─── Polling for new messages & orders ───
    useEffect(() => {
        // Initial load: just capture the latest IDs without notifying
        const initializeIds = async () => {
            const { data: latestMsg } = await supabase
                .from('chat_messages')
                .select('id')
                .eq('sender_type', 'customer')
                .order('created_at', { ascending: false })
                .limit(1);

            if (latestMsg && latestMsg.length > 0) {
                lastMessageIdRef.current = latestMsg[0].id;
            }

            const { data: latestOrder } = await supabase
                .from('orders')
                .select('id')
                .order('created_at', { ascending: false })
                .limit(1);

            if (latestOrder && latestOrder.length > 0) {
                lastOrderIdRef.current = latestOrder[0].id;
            }

            hasInitialLoadRef.current = true;
        };

        initializeIds();

        // Poll every 5 seconds for new customer messages
        const pollInterval = setInterval(async () => {
            if (!hasInitialLoadRef.current) return;

            // Check for new customer messages
            let msgQuery = supabase
                .from('chat_messages')
                .select('id, message, sender_type, created_at')
                .eq('sender_type', 'customer')
                .order('created_at', { ascending: false })
                .limit(5);

            if (lastMessageIdRef.current) {
                msgQuery = msgQuery.gt('id', lastMessageIdRef.current);
            }

            const { data: newMessages } = await msgQuery;

            if (newMessages && newMessages.length > 0) {
                // Update last seen ID
                lastMessageIdRef.current = newMessages[0].id;

                // Notify for each new message
                for (const msg of newMessages.reverse()) {
                    addNotificationRef.current?.({
                        type: 'new_message',
                        title: '💬 Nuevo mensaje',
                        body: msg.message?.substring(0, 80) || 'Mensaje recibido',
                    });
                }
            }

            // Check for new orders
            let orderQuery = supabase
                .from('orders')
                .select('id, order_number, customer_name, source, created_at')
                .order('created_at', { ascending: false })
                .limit(5);

            if (lastOrderIdRef.current) {
                orderQuery = orderQuery.gt('id', lastOrderIdRef.current);
            }

            const { data: newOrders } = await orderQuery;

            if (newOrders && newOrders.length > 0) {
                lastOrderIdRef.current = newOrders[0].id;

                for (const order of newOrders.reverse()) {
                    addNotificationRef.current?.({
                        type: 'new_order',
                        title: '📦 ¡Nuevo pedido!',
                        body: `Pedido ${order.order_number || ''} — ${order.customer_name || 'WhatsApp'}`,
                    });
                }
            }
        }, 5000);

        return () => clearInterval(pollInterval);
    }, []);

    return {
        notifications,
        latestToast,
        unreadCount,
        dismissToast,
        clearNotifications,
        markAllRead,
    };
}
