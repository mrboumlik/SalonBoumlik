import { safeStorageGet, safeStorageSet } from './safeBrowser';

export type CaisseDeviceKind = 'pc' | 'phone';

export interface DeviceOriginInfo {
  deviceKind: CaisseDeviceKind;
  deviceId: string;
  devicePlatform: string;
  deviceBrowser: string;
  deviceLabel: string;
}

const DEVICE_ORIGIN_ID_KEY = 'sb_caisse_device_id_v1';

function detectDeviceKind(): CaisseDeviceKind {
  if (typeof navigator === 'undefined') return 'pc';
  const ua = navigator.userAgent || '';
  const mobileRe = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  if (mobileRe.test(ua)) return 'phone';

  // iPadOS Safari reports Macintosh in UA with maxTouchPoints > 1
  if (
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1 &&
    /macintosh/i.test(ua)
  ) {
    return 'phone';
  }

  // Fallback check for small touch-first devices without desktop Windows/Linux UA
  if (
    typeof window !== 'undefined' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1 &&
    !/windows nt|x11|linux x86_64/i.test(ua) &&
    window.screen &&
    Math.min(window.screen.width || 9999, window.screen.height || 9999) <= 900
  ) {
    return 'phone';
  }

  return 'pc';
}

function detectDevicePlatform(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent || '';

  if (/windows nt 6\.1/i.test(ua)) return 'Windows 7';
  if (/windows nt 6\.2|windows nt 6\.3/i.test(ua)) return 'Windows 8';
  if (/windows nt 10\.0/i.test(ua)) return 'Windows 10/11';
  if (/windows/i.test(ua)) return 'Windows';

  const androidMatch = ua.match(/Android\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (androidMatch) return `Android ${androidMatch[1]}`.slice(0, 48);
  if (/android/i.test(ua)) return 'Android';

  if (/ipad/i.test(ua)) return 'iPadOS';
  if (/iphone|ipod/i.test(ua)) return 'iOS (iPhone)';
  if (/macintosh|mac os x/i.test(ua)) {
    if (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
      return 'iPadOS';
    }
    return 'macOS';
  }
  if (/linux/i.test(ua)) return 'Linux';
  return 'Web Browser';
}

function detectDeviceBrowser(): string {
  if (typeof navigator === 'undefined') return 'Browser';
  const ua = navigator.userAgent || '';

  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/samsungbrowser\//i.test(ua)) return 'Samsung Internet';
  if (/chrome\//i.test(ua) || /crios\//i.test(ua)) {
    // Supermium runs modern Chromium engines on Windows 7 (NT 6.1)
    if (/windows nt 6\.1/i.test(ua)) return 'Supermium / Chrome';
    return 'Chrome';
  }
  if (/safari\//i.test(ua)) return 'Safari';
  return 'Browser';
}

function getOrCreatePersistentDeviceId(kind: CaisseDeviceKind): string {
  const prefix = kind === 'phone' ? 'PH' : 'PC';
  try {
    const existing = safeStorageGet(DEVICE_ORIGIN_ID_KEY, 'local');
    if (existing && /^(PC|PH)-[A-Z0-9]{4,8}$/.test(existing)) {
      // If browser profile somehow moved between mobile/desktop mode, normalize prefix cleanly
      if (existing.startsWith(`${prefix}-`)) return existing;
      const suffix = existing.split('-')[1] || '0000';
      const normalized = `${prefix}-${suffix}`;
      safeStorageSet(DEVICE_ORIGIN_ID_KEY, normalized, 'local');
      return normalized;
    }
  } catch {
    // Ignore storage errors
  }

  const randSuffix = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X');
  const nextId = `${prefix}-${randSuffix}`.slice(0, 16);
  try {
    safeStorageSet(DEVICE_ORIGIN_ID_KEY, nextId, 'local');
  } catch {
    // Ignore
  }
  return nextId;
}

export function getCurrentDeviceOrigin(): DeviceOriginInfo {
  const deviceKind = detectDeviceKind();
  const devicePlatform = detectDevicePlatform().slice(0, 64);
  const deviceBrowser = detectDeviceBrowser().slice(0, 64);
  const deviceId = getOrCreatePersistentDeviceId(deviceKind).slice(0, 32);
  const kindAr = deviceKind === 'phone' ? 'تيليفون' : 'بيسي';
  const deviceLabel = `${kindAr} · ${devicePlatform}`.slice(0, 80);

  return {
    deviceKind,
    deviceId,
    devicePlatform,
    deviceBrowser,
    deviceLabel,
  };
}
