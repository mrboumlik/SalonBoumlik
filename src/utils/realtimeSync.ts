// Resilient Real-Time Firestore Synchronization & Cross-Tab Recovery Helper
// Compatible with modern Chrome/Safari PWAs as well as legacy Chromium (Win7 / Supermium).

export type RealtimeSyncScope =
  | 'all'
  | 'bookings'
  | 'caisse'
  | 'credits'
  | 'crm'
  | 'roster'
  | 'profiles'
  | 'schedules'
  | 'shifts'
  | 'pricing'
  | 'settings'
  | 'waitlist'
  | 'reviews';

const SYNC_CHANNEL_NAME = 'salon_boumlik_rt_sync_v1';
const SYNC_STORAGE_PING_KEY = 'salon_boumlik_rt_ping_v1';

type RefreshHandler = () => void | Promise<void>;
type SyncHintListener = (scope: RealtimeSyncScope) => void;

const refreshHandlers = new Map<string, { scope: RealtimeSyncScope; handler: RefreshHandler }>();
const retryTimers = new Map<string, number>();
const retryAttempts = new Map<string, number>();
const syncHintListeners = new Set<SyncHintListener>();

let bcInstance: BroadcastChannel | null = null;
let globalHooksBound = false;
let lastGlobalRefreshAt = 0;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!bcInstance) {
    try {
      bcInstance = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bcInstance.onmessage = (event) => {
        const scope = (event?.data?.scope || 'all') as RealtimeSyncScope;
        dispatchScopeRefresh(scope, true);
      };
    } catch {
      bcInstance = null;
    }
  }
  return bcInstance;
}

function dispatchScopeRefresh(scope: RealtimeSyncScope, fromSiblingTab = false): void {
  syncHintListeners.forEach((cb) => {
    try {
      cb(scope);
    } catch (err) {
      console.warn('Sync hint listener error:', err);
    }
  });

  if (fromSiblingTab) {
    refreshHandlers.forEach(({ scope: handlerScope, handler }) => {
      if (scope === 'all' || handlerScope === scope) {
        try {
          void handler();
        } catch (err) {
          console.warn('Scoped refresh handler error:', err);
        }
      }
    });
  }
}

export function forceRealtimeRefresh(scope: RealtimeSyncScope = 'all'): void {
  const now = Date.now();
  if (scope === 'all' && now - lastGlobalRefreshAt < 1200) {
    return;
  }
  if (scope === 'all') {
    lastGlobalRefreshAt = now;
  }

  refreshHandlers.forEach(({ scope: handlerScope, handler }) => {
    if (scope === 'all' || handlerScope === scope) {
      try {
        void handler();
      } catch (err) {
        console.warn('Force realtime refresh warning:', err);
      }
    }
  });
}

function bindGlobalRecoveryHooks(): void {
  if (globalHooksBound || typeof window === 'undefined') return;
  globalHooksBound = true;

  getBroadcastChannel();

  try {
    window.addEventListener('storage', (ev) => {
      if (ev.key === SYNC_STORAGE_PING_KEY && ev.newValue) {
        const rawScope = ev.newValue.split(':')[0] as RealtimeSyncScope;
        dispatchScopeRefresh(rawScope || 'all', true);
      }
    });
  } catch {
    // Ignore storage listener errors in restricted iframes
  }

  const triggerWakeRefresh = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    forceRealtimeRefresh('all');
  };

  try {
    window.addEventListener('online', triggerWakeRefresh);
    window.addEventListener('focus', triggerWakeRefresh);
  } catch {
    // Ignore
  }

  if (typeof document !== 'undefined') {
    try {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          triggerWakeRefresh();
        }
      });
    } catch {
      // Ignore
    }
  }
}

export function emitRealtimeSyncHint(scope: RealtimeSyncScope = 'all'): void {
  if (typeof window === 'undefined') return;
  bindGlobalRecoveryHooks();

  const ch = getBroadcastChannel();
  if (ch) {
    try {
      ch.postMessage({ scope, ts: Date.now() });
    } catch {
      // Ignore BroadcastChannel post failure
    }
  }

  try {
    window.localStorage.setItem(SYNC_STORAGE_PING_KEY, `${scope}:${Date.now()}`);
  } catch {
    // Ignore localStorage quota / private mode failures
  }
}

export function subscribeRealtimeSyncHints(cb: SyncHintListener): () => void {
  bindGlobalRecoveryHooks();
  syncHintListeners.add(cb);
  return () => {
    syncHintListeners.delete(cb);
  };
}

export function registerRealtimeRefreshHandler(
  key: string,
  scope: RealtimeSyncScope,
  handler: RefreshHandler
): () => void {
  bindGlobalRecoveryHooks();
  refreshHandlers.set(key, { scope, handler });
  return () => {
    refreshHandlers.delete(key);
  };
}

export function resetResilientRetry(key: string): void {
  retryAttempts.delete(key);
  const existing = retryTimers.get(key);
  if (existing !== undefined && typeof window !== 'undefined') {
    window.clearTimeout(existing);
  }
  retryTimers.delete(key);
}

export function scheduleResilientRetry(
  key: string,
  shouldRetry: () => boolean,
  attachFn: () => void,
  error?: unknown
): void {
  console.warn(`Firestore stream (${key}) interrupted — scheduling recovery:`, error);
  resetResilientRetry(key);
  if (typeof window === 'undefined' || !shouldRetry()) return;

  const prevAttempts = retryAttempts.get(key) || 0;
  const nextAttempts = Math.min(prevAttempts + 1, 6);
  retryAttempts.set(key, nextAttempts);

  const delays = [1000, 2000, 4000, 7000, 10000, 15000];
  const delayMs = delays[Math.min(nextAttempts - 1, delays.length - 1)];

  const timerId = window.setTimeout(() => {
    retryTimers.delete(key);
    if (!shouldRetry()) return;
    try {
      attachFn();
    } catch (err) {
      console.warn(`Firestore stream (${key}) re-attach failed:`, err);
    }
  }, delayMs);

  retryTimers.set(key, timerId);
}
