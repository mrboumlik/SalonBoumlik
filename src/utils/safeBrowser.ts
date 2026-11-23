/**
 * Browser compatibility & graceful fallback helpers for older Chrome / Windows 7,
 * Cast/TV WebViews, restricted iframes, and strict third-party storage environments.
 */

const inMemoryLocalStore = new Map<string, string>();
const inMemorySessionStore = new Map<string, string>();

export type SafeStorageKind = 'local' | 'session';

function resolveWebStorage(kind: SafeStorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const store = kind === 'session' ? window.sessionStorage : window.localStorage;
    if (!store) return null;
    const probeKey = '__sb_storage_probe__';
    store.setItem(probeKey, '1');
    store.removeItem(probeKey);
    return store;
  } catch {
    return null;
  }
}

export function safeStorageGet(
  key: string,
  kind: SafeStorageKind = 'local'
): string | null {
  const mem = kind === 'session' ? inMemorySessionStore : inMemoryLocalStore;
  try {
    if (typeof window !== 'undefined') {
      const store = kind === 'session' ? window.sessionStorage : window.localStorage;
      if (store) {
        const val = store.getItem(key);
        if (val !== null) return val;
      }
    }
  } catch {
    // Restricted third-party storage or security error; fall back to in-memory map
  }
  return mem.has(key) ? mem.get(key)! : null;
}

export function safeStorageSet(
  key: string,
  value: string,
  kind: SafeStorageKind = 'local'
): boolean {
  const mem = kind === 'session' ? inMemorySessionStore : inMemoryLocalStore;
  mem.set(key, value);
  try {
    const store = resolveWebStorage(kind);
    if (store) {
      store.setItem(key, value);
      return true;
    }
  } catch {
    // Keep value in in-memory fallback so session state does not crash
  }
  return false;
}

export function safeStorageRemove(
  key: string,
  kind: SafeStorageKind = 'local'
): void {
  const mem = kind === 'session' ? inMemorySessionStore : inMemoryLocalStore;
  mem.delete(key);
  try {
    if (typeof window !== 'undefined') {
      const store = kind === 'session' ? window.sessionStorage : window.localStorage;
      if (store) {
        store.removeItem(key);
      }
    }
  } catch {
    // Ignore restricted storage removal errors
  }
}

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function areCookiesAccessible(): boolean {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    if (navigator.cookieEnabled === false) return false;
    void document.cookie;
    return true;
  } catch {
    return false;
  }
}

export function safeMatchMedia(query: string): { matches: boolean } {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { matches: false };
  }
  try {
    return window.matchMedia(query);
  } catch {
    return { matches: false };
  }
}

/**
 * Copies text using Clipboard API when available, gracefully falling back to
 * a temporary textarea + execCommand('copy') for HTTP, older Chrome, Windows 7,
 * and restricted iframe contexts.
 */
export async function safeCopyToClipboard(text: string): Promise<boolean> {
  const value = String(text ?? '');
  if (!value) return false;

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to legacy execCommand fallback
    }
  }

  if (typeof document === 'undefined') return false;

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
    document.body.removeChild(textarea);
    return Boolean(ok);
  } catch {
    return false;
  }
}
