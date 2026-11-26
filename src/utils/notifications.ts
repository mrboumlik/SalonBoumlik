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

function raceWithTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise
      .then((val) => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

export function safeReadNotificationPermission(): NotificationPermission | 'unsupported' {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || typeof Notification === 'undefined') {
      return 'unsupported';
    }
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/**
 * Register or retrieve the active PWA Service Worker registration (never hangs indefinitely)
 */
export async function registerServiceWorker(timeoutMs: number = 2500): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const existing = await raceWithTimeout(
      navigator.serviceWorker.getRegistration().then((reg) => reg || null),
      1500,
      null
    );
    if (existing) return existing;
    return await raceWithTimeout(
      navigator.serviceWorker.ready.then((reg) => reg || null),
      timeoutMs,
      null
    );
  } catch (err) {
    console.warn('Service worker registration note:', err);
    return null;
  }
}

/**
 * Safe cross-browser Notification.requestPermission wrapper (Promise + legacy callback + timeout + overlay guard)
 */
export async function safeRequestNotificationPermission(timeoutMs: number = 5000): Promise<{
  permission: NotificationPermission | 'unsupported';
  threwOrBlocked: boolean;
}> {
  const current = safeReadNotificationPermission();
  if (current === 'unsupported') {
    return { permission: 'unsupported', threwOrBlocked: false };
  }
  if (current === 'granted' || current === 'denied') {
    return { permission: current, threwOrBlocked: false };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (perm: NotificationPermission | 'unsupported', threwOrBlocked: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve({ permission: perm, threwOrBlocked });
    };

    const timer = window.setTimeout(() => {
      finish(safeReadNotificationPermission(), true);
    }, timeoutMs);

    try {
      let maybePromise: Promise<NotificationPermission> | undefined;
      if (Notification.requestPermission.length >= 1) {
        maybePromise = Notification.requestPermission((perm) => {
          finish(perm || safeReadNotificationPermission(), false);
        });
      } else {
        maybePromise = Notification.requestPermission();
      }

      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(
          (perm) => finish(perm || safeReadNotificationPermission(), false),
          () => finish(safeReadNotificationPermission(), true)
        );
      }
    } catch {
      finish(safeReadNotificationPermission(), true);
    }
  });
}

/**
 * Request Notification Permission tied explicitly to a user gesture button
 */
export async function requestWebNotificationPermission(): Promise<NotificationPermission> {
  const res = await safeRequestNotificationPermission(5000);
  if (res.permission === 'granted') {
    void registerServiceWorker(2500);
    return 'granted';
  }
  if (res.permission === 'denied') return 'denied';
  return 'default';
}

/**
 * Dual Alert: Sends Web Notification (via PWA Service Worker or Notification API) + In-App Sound + Toast
 */
export function sendDualAlert(
  title: string,
  options?: {
    body?: string;
    type?: ToastMessage['type'];
    skipSound?: boolean;
    tag?: string;
    data?: Record<string, unknown>;
  }
): void {
  const bodyText = options?.body || '';
  const type = options?.type || 'info';

  // 1. MECHANISM 1: Play audible chime and show UI Toast
  if (!options?.skipSound) {
    playNotificationSound();
  }
  showToast(title, bodyText, type);

  // 2. MECHANISM 2: Trusted PWA Service Worker Notification API (prevents duplicate/spam warnings)
  if (safeReadNotificationPermission() === 'granted') {
    const resolvedTag =
      options?.tag ||
      (typeof options?.data?.ticketNumber === 'string'
        ? `sb-${options.data.ticketNumber}`
        : 'salon-boumlik-alert');

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void registerServiceWorker(2000).then((reg) => {
        if (reg && typeof reg.showNotification === 'function') {
          reg
            .showNotification(title, {
              body: bodyText,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: resolvedTag,
              renotify: false,
              requireInteraction: false,
              data: options?.data || { url: '/' },
            } as NotificationOptions)
            .catch(() => {
              fallbackNotification(title, bodyText, resolvedTag);
            });
        } else {
          fallbackNotification(title, bodyText, resolvedTag);
        }
      });
    } else {
      fallbackNotification(title, bodyText, resolvedTag);
    }
  }
}

function fallbackNotification(title: string, bodyText: string, tag?: string) {
  try {
    if (typeof Notification === 'undefined') return;
    new Notification(title, {
      body: bodyText,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: tag || 'salon-boumlik-alert',
    });
  } catch (err) {
    console.warn('Native notification fallback warning:', err);
  }
}

// Backward compatibility helper
export function sendWebNotification(title: string, options?: NotificationOptions): boolean {
  sendDualAlert(title, { body: options?.body, tag: options?.tag });
  return true;
}
