import { useEffect, useState } from 'react';
import { safeStorageGet, safeStorageSet } from './safeBrowser';

export type TrustedTimeSource =
  | 'server_api'
  | 'firestore_server'
  | 'cached_offset'
  | 'device_clock';

export interface TrustedTimeMeta {
  serverOffsetMs: number;
  isCalibrated: boolean;
  isDrifted: boolean;
  timeSource: TrustedTimeSource;
  lastSyncedAtIso: string | null;
}

const TRUSTED_TIME_CACHE_KEY = 'salon_boumlik_trusted_time_cal_v1';
const DRIFT_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const MAX_SANE_OFFSET_MS = 30 * 365.25 * 24 * 60 * 60 * 1000; // +/- 30 years
const RECALIBRATE_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
const SALON_TIMEZONE = 'Africa/Casablanca';

let serverOffsetMs = 0;
let isCalibrated = false;
let timeSource: TrustedTimeSource = 'device_clock';
let lastSyncedAtIso: string | null = null;
let lastCalibrationAttemptPerfMs = -Infinity;
let inflightSyncPromise: Promise<boolean> | null = null;
let hooksBound = false;

const listeners = new Set<(meta: TrustedTimeMeta) => void>();

function loadCachedCalibration(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = safeStorageGet(TRUSTED_TIME_CACHE_KEY, 'local');
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      serverOffsetMs?: unknown;
      syncedAtIso?: unknown;
    };
    if (
      typeof parsed.serverOffsetMs === 'number' &&
      Number.isFinite(parsed.serverOffsetMs) &&
      Math.abs(parsed.serverOffsetMs) <= MAX_SANE_OFFSET_MS
    ) {
      serverOffsetMs = Math.round(parsed.serverOffsetMs);
      timeSource = 'cached_offset';
      lastSyncedAtIso = typeof parsed.syncedAtIso === 'string' ? parsed.syncedAtIso : null;
    }
  } catch {
    // Ignore malformed cache
  }
}

loadCachedCalibration();

export function getTrustedTimeMeta(): TrustedTimeMeta {
  return {
    serverOffsetMs,
    isCalibrated,
    isDrifted: (isCalibrated || timeSource === 'cached_offset') && Math.abs(serverOffsetMs) > DRIFT_THRESHOLD_MS,
    timeSource,
    lastSyncedAtIso,
  };
}

function notifyTimeListeners(): void {
  const snapshot = getTrustedTimeMeta();
  listeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      // Ignore subscriber errors
    }
  });
}

function persistCalibration(offsetMs: number, syncedIso: string): void {
  try {
    safeStorageSet(
      TRUSTED_TIME_CACHE_KEY,
      JSON.stringify({
        serverOffsetMs: offsetMs,
        syncedAtIso: syncedIso,
      }),
      'local'
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function applyExternalServerTimeSample(
  serverNowMs: number,
  source: TrustedTimeSource = 'firestore_server'
): void {
  if (!Number.isFinite(serverNowMs) || serverNowMs < 1577836800000) return; // >= 2020-01-01
  const nextOffset = Math.round(serverNowMs - Date.now());
  if (Math.abs(nextOffset) > MAX_SANE_OFFSET_MS) return;

  const changed =
    !isCalibrated ||
    Math.abs(nextOffset - serverOffsetMs) > 1500 ||
    timeSource !== source;

  serverOffsetMs = nextOffset;
  isCalibrated = true;
  timeSource = source;
  lastSyncedAtIso = new Date(serverNowMs).toISOString();
  persistCalibration(serverOffsetMs, lastSyncedAtIso);
  if (changed) notifyTimeListeners();
}

export async function syncTrustedServerTime(force = false): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;

  const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!force && isCalibrated && perfNow - lastCalibrationAttemptPerfMs < 30000) {
    return true;
  }
  if (inflightSyncPromise) return inflightSyncPromise;

  lastCalibrationAttemptPerfMs = perfNow;

  inflightSyncPromise = (async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId =
      controller !== null ? window.setTimeout(() => controller.abort(), 4500) : null;

    try {
      const p0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const c0 = Date.now();
      const res = await fetch(`/api/time?t=${c0}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller ? controller.signal : undefined,
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { nowMs?: unknown };
      const p1 = typeof performance !== 'undefined' ? performance.now() : 0;
      const c1 = Date.now();

      if (typeof data?.nowMs !== 'number' || !Number.isFinite(data.nowMs)) return false;

      const rttPerf = p1 >= p0 && p0 > 0 ? p1 - p0 : Math.max(0, c1 - c0);
      if (rttPerf > 8000 && isCalibrated) {
        return true;
      }
      const estimatedClientNowAtServerSample = c1 - Math.round(rttPerf / 2);
      const nextOffset = Math.round(data.nowMs - estimatedClientNowAtServerSample);
      if (Math.abs(nextOffset) > MAX_SANE_OFFSET_MS) return false;

      const changed =
        !isCalibrated ||
        Math.abs(nextOffset - serverOffsetMs) > 1500 ||
        timeSource !== 'server_api';

      serverOffsetMs = nextOffset;
      isCalibrated = true;
      timeSource = 'server_api';
      lastSyncedAtIso = new Date(data.nowMs).toISOString();
      persistCalibration(serverOffsetMs, lastSyncedAtIso);
      if (changed) notifyTimeListeners();
      return true;
    } catch {
      return false;
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      inflightSyncPromise = null;
    }
  })();

  return inflightSyncPromise;
}

function ensureTrustedTimeHooks(): void {
  if (hooksBound || typeof window === 'undefined') return;
  hooksBound = true;

  void syncTrustedServerTime(true);

  const onWake = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    void syncTrustedServerTime(true);
  };

  try {
    window.addEventListener('online', onWake);
    window.addEventListener('focus', onWake);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') onWake();
      });
    }
    window.setInterval(() => {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        void syncTrustedServerTime(false);
      }
    }, RECALIBRATE_INTERVAL_MS);
  } catch {
    // Ignore event binding issues in restricted environments
  }
}

if (typeof window !== 'undefined') {
  ensureTrustedTimeHooks();
}

export function getTrustedNowMs(): number {
  ensureTrustedTimeHooks();
  return Date.now() + serverOffsetMs;
}

export function getTrustedNowDate(): Date {
  return new Date(getTrustedNowMs());
}

export function getTrustedNowIso(): string {
  return new Date(getTrustedNowMs()).toISOString();
}

/**
 * Formats a Date in Morocco timezone (`Africa/Casablanca`) as `YYYY-MM-DD`,
 * gracefully falling back to local calendar formatting on minimal environments.
 */
export function formatMoroccoCalendarDate(dateObj: Date): string {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: SALON_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(dateObj);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d && /^\d{4}$/.test(y)) {
        return `${y}-${m}-${d}`;
      }
    }
  } catch {
    // Fallback below if browser ICU lacks Africa/Casablanca
  }
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatMoroccoClockTime(isoOrDate: string | Date): string {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (!Number.isFinite(d.getTime())) return '--:--';
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: SALON_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(d);
    }
  } catch {
    // Fallback below
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatClockOffsetHumanAr(offsetMs: number): string {
  const absSec = Math.round(Math.abs(offsetMs) / 1000);
  if (absSec < 60) return `${absSec} ثانية`;
  const absMin = Math.round(absSec / 60);
  if (absMin < 60) return `${absMin} دقيقة`;
  const absHours = Math.round(absMin / 60);
  if (absHours < 48) return `${absHours} ساعة`;
  const absDays = Math.round(absHours / 24);
  if (absDays < 60) return `${absDays} يوم`;
  const absYears = Math.round(absDays / 365);
  if (absYears >= 1) return `حوالي ${absYears} سنة`;
  return `${Math.round(absDays / 30)} شهر`;
}

export function useTrustedTimeStatus(): TrustedTimeMeta & {
  refreshServerTime: () => Promise<boolean>;
} {
  const [meta, setMeta] = useState<TrustedTimeMeta>(() => getTrustedTimeMeta());

  useEffect(() => {
    ensureTrustedTimeHooks();
    setMeta(getTrustedTimeMeta());
    listeners.add(setMeta);
    return () => {
      listeners.delete(setMeta);
    };
  }, []);

  return {
    ...meta,
    refreshServerTime: () => syncTrustedServerTime(true),
  };
}
