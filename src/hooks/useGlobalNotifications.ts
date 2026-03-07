// Re-export from the shared context so existing imports keep working
export type { AppNotification } from '../contexts/NotificationContext';
export { useNotifications as useGlobalNotifications } from '../contexts/NotificationContext';
