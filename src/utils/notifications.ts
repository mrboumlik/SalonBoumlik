/**
 * Audible Notifications & Service Worker helper for Salon Boumlik
 * Implements a DUAL-ALERT system:
 * 1. In-App Audible Sound (Synthesized Chime / Audio via Web Audio API + Base64 chime) + UI Toast
 * 2. Service Worker push/local notification tied explicitly to user gesture button
 */

// Global Toast event system
export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'reschedule';
  title: string;
  body: string;
  timestamp: number;
}

type ToastListener = (toast: ToastMessage) => void;
const toastListeners = new Set<ToastListener>();

export function subscribeToToasts(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function showToast(title: string, body: string, type: ToastMessage['type'] = 'info') {
  const toast: ToastMessage = {
    id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    title,
    body,
    timestamp: Date.now(),
  };
  toastListeners.forEach((listener) => {
    try {
      listener(toast);
    } catch (e) {
      console.error('Toast listener error:', e);
    }
  });
}

/**
 * High-fidelity Audible Chime using Web Audio API (zero external network dependency)
 * Plays a pleasant 3-tone notification chime that plays reliably on mobile browsers
 * once any user interaction has occurred.
 */
export function playNotificationSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      playFallbackBase64Sound();
      return;
    }
    const ctx = new AudioContextClass();
    
    // Resume context if suspended (common on mobile browsers)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    
    // Notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz) -> luxurious barbershop chime
    const notes = [
      { freq: 523.25, start: 0, dur: 0.18 },
      { freq: 659.25, start: 0.12, dur: 0.22 },
      { freq: 783.99, start: 0.24, dur: 0.35 },
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      // Envelope: gentle attack, exponential decay
      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  } catch (err) {
    console.warn('Web Audio chime failed, trying base64 fallback audio:', err);
    playFallbackBase64Sound();
  }
}

/**
 * Short base64 WAV sound fallback as mandated by user directive
 */
function playFallbackBase64Sound(): void {
  try {
    // 0.2s 44.1kHz standard notification beep in base64 PCM WAV
    const base64Sound = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVoGAACBhYqFbF1fdJivrJBhNjVgodDbqWE1KWizm248G1qezd2aSS42Y5m5s4E5JFR9rLGbfTkpY4yrtZV3SjVcjqWpkm5HN2mNp6qSbT1AWpSgqJRzRkBPjZ2olXpMQFCMm6mVfElET4ugqpd6SkVPi52pl3xMRE+KoqqYfElET4mdqZh8';
    const audio = new Audio(base64Sound);
    audio.volume = 0.8;
    audio.play().catch((e) => {
      console.warn('Base64 audio playback note:', e);
    });
  } catch (e) {
    console.warn('Audio fallback error:', e);
  }
}

/**
 * Register Service Worker for mobile notification handling
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('Service worker registration note:', err);
    return null;
  }
}

/**
 * Request Notification Permission tied explicitly to a user gesture button
 */
export async function requestWebNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    // If already granted, return immediately
    if (Notification.permission === 'granted') {
      return 'granted';
    }

    // Trigger permission request explicitly on user click
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Warm up Service Worker registration
      await registerServiceWorker();
    }
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

/**
 * Dual Alert: Sends Web Notification (via SW or Notification API) + In-App Sound + Toast
 */
export function sendDualAlert(
  title: string,
  options?: {
    body?: string;
    type?: ToastMessage['type'];
    skipSound?: boolean;
    data?: any;
  }
): void {
  const bodyText = options?.body || '';
  const type = options?.type || 'info';

  // 1. MECHANISM 1: Play audible chime and show UI Toast
  if (!options?.skipSound) {
    playNotificationSound();
  }
  showToast(title, bodyText, type);

  // 2. MECHANISM 2: Service Worker & Web Notification API
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    // Try service worker showNotification first
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body: bodyText,
          icon: '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
          badge: '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
          vibrate: [200, 100, 200],
          data: options?.data,
        }).catch(() => {
          fallbackNotification(title, bodyText);
        });
      }).catch(() => {
        fallbackNotification(title, bodyText);
      });
    } else {
      fallbackNotification(title, bodyText);
    }
  }
}

function fallbackNotification(title: string, bodyText: string) {
  try {
    new Notification(title, {
      body: bodyText,
      icon: '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
      badge: '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
    });
  } catch (err) {
    console.warn('Native notification fallback warning:', err);
  }
}

// Backward compatibility helper
export function sendWebNotification(title: string, options?: NotificationOptions): boolean {
  sendDualAlert(title, { body: options?.body });
  return true;
}
