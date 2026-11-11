/**
 * Web Notifications Helper for Salon Boumlik
 * Handles browser notification permissions and dispatching clean alerts
 */

export async function requestWebNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

export function sendWebNotification(title: string, options?: NotificationOptions): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
        badge: '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
        ...options,
      });
      return true;
    } catch (err) {
      console.error('Error firing Web Notification:', err);
      return false;
    }
  }
  return false;
}
