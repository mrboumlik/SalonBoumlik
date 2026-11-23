import { AppointmentBooking, BookingStatus } from '../types';
import { normalizeMoroccanPhoneDigits } from './bookingStore';

export const MAX_ACTIVE_BOOKINGS_PER_CLIENT = 2;

export const ACTIVE_UPCOMING_BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'pending_quote',
  'flexible_pending',
  'confirmed',
  'rescheduled',
];

const DEVICE_FP_STORAGE_KEY = 'sb_device_fp_v1';
const IP_HASH_SESSION_KEY = 'sb_net_hash_v1';

let inMemoryIpHash: string | undefined;
let ipFetchPromise: Promise<string | undefined> | null = null;

function hashStringFnv1a(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(36);
  const part2 = (h2 >>> 0).toString(36);
  return `${part1}${part2}`;
}

export function getLocalTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Generates or returns a persistent device fingerprint combining stable browser traits
 * with a persisted device token so duplicate bookings from the same device are capped cleanly.
 */
export function getOrCreateDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'srv-device';

  try {
    const existing = window.localStorage.getItem(DEVICE_FP_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,96}$/.test(existing)) {
      return existing;
    }
  } catch {
    // ignore storage blocks
  }

  const traits = [
    typeof navigator !== 'undefined' ? navigator.userAgent : '',
    typeof navigator !== 'undefined' ? navigator.language : '',
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      : '',
    typeof screen !== 'undefined' ? `${screen.width}x${screen.height}x${screen.colorDepth}` : '',
    typeof navigator !== 'undefined' ? String(navigator.hardwareConcurrency || '') : '',
  ].join('|');

  const traitHash = hashStringFnv1a(traits);
  const randSalt = Math.random().toString(36).slice(2, 8);
  const fp = `dev_${traitHash}_${randSalt}`.slice(0, 64);

  try {
    window.localStorage.setItem(DEVICE_FP_STORAGE_KEY, fp);
  } catch {
    // ignore
  }
  return fp;
}

export function getCachedClientIpHash(): string | undefined {
  if (inMemoryIpHash) return inMemoryIpHash;
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = window.sessionStorage.getItem(IP_HASH_SESSION_KEY);
    if (stored && /^ip_[a-zA-Z0-9]{4,48}$/.test(stored)) {
      inMemoryIpHash = stored;
      return stored;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Best-effort non-blocking network hash lookup (hashed client-side; never stores raw IP).
 * Always fails silently offline or if blocked so real clients can still book smoothly.
 */
export async function prefetchClientIpHash(): Promise<string | undefined> {
  const cached = getCachedClientIpHash();
  if (cached) return cached;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return undefined;
  if (ipFetchPromise) return ipFetchPromise;

  ipFetchPromise = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1600);
    try {
      const res = await fetch('https://api64.ipify.org?format=json', {
        signal: controller.signal,
      });
      if (!res.ok) return undefined;
      const json = (await res.json()) as { ip?: string };
      const rawIp = typeof json?.ip === 'string' ? json.ip.trim() : '';
      if (!rawIp || rawIp.length < 4) return undefined;
      const hashed = `ip_${hashStringFnv1a(`sb_salt_2026_${rawIp}`)}`.slice(0, 48);
      inMemoryIpHash = hashed;
      try {
        window.sessionStorage.setItem(IP_HASH_SESSION_KEY, hashed);
      } catch {
        // ignore
      }
      return hashed;
    } catch {
      return undefined;
    } finally {
      window.clearTimeout(timer);
      ipFetchPromise = null;
    }
  })();

  return ipFetchPromise;
}

/**
 * Returns active upcoming bookings (excluding Master Admin walk-ins) belonging to this
 * browser device, network IP hash, or normalized phone number.
 */
export function getClientActiveUpcomingBookings(params: {
  bookings: AppointmentBooking[];
  todayStr?: string;
  deviceFingerprint?: string;
  clientIpHash?: string;
  clientPhone?: string;
}): AppointmentBooking[] {
  const today = params.todayStr || getLocalTodayStr();
  const fp = params.deviceFingerprint?.trim() || '';
  const ipHash = params.clientIpHash?.trim() || '';
  const cleanPhone = params.clientPhone
    ? normalizeMoroccanPhoneDigits(params.clientPhone)
    : '';

  if (!fp && !ipHash && cleanPhone.length < 6) return [];

  return params.bookings.filter((b) => {
    if (b.isAdminWalkIn) return false;
    if (!ACTIVE_UPCOMING_BOOKING_STATUSES.includes(b.status)) return false;

    const effectiveDate = (b.rescheduledTo?.date || b.date || '').trim();
    if (effectiveDate && effectiveDate < today) return false;

    const matchesFp = Boolean(fp && b.deviceFingerprint && b.deviceFingerprint === fp);
    const matchesIp = Boolean(ipHash && b.clientIpHash && b.clientIpHash === ipHash);
    const bPhone = normalizeMoroccanPhoneDigits(b.clientPhone || '');
    const matchesPhone = Boolean(cleanPhone.length >= 6 && bPhone === cleanPhone);

    return matchesFp || matchesIp || matchesPhone;
  });
}
