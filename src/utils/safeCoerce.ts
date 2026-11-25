/**
 * Defensive runtime coercion and formatting utilities.
 * Prevents TypeError / RangeError crashes when Firestore returns missing fields,
 * Firestore Timestamp objects, non-array payloads, or invalid date values.
 */

export function asStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return fallback;
}

export function asIsoString(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (val instanceof Date) {
    return Number.isFinite(val.getTime()) ? val.toISOString() : fallback;
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    const d = new Date(val);
    return Number.isFinite(d.getTime()) ? d.toISOString() : fallback;
  }
  if (val && typeof val === 'object') {
    const obj = val as {
      toDate?: () => unknown;
      seconds?: unknown;
      _seconds?: unknown;
    };
    if (typeof obj.toDate === 'function') {
      try {
        const d = obj.toDate();
        if (d instanceof Date && Number.isFinite(d.getTime())) {
          return d.toISOString();
        }
      } catch {
        // Ignore invalid Timestamp
      }
    }
    const secs =
      typeof obj.seconds === 'number'
        ? obj.seconds
        : typeof obj._seconds === 'number'
        ? obj._seconds
        : NaN;
    if (Number.isFinite(secs)) {
      const d = new Date(secs * 1000);
      return Number.isFinite(d.getTime()) ? d.toISOString() : fallback;
    }
  }
  return fallback;
}

export function asDateString(val: unknown, fallback = ''): string {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return fallback;
    return trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)
      ? trimmed.slice(0, 10)
      : trimmed;
  }
  const iso = asIsoString(val, '');
  if (iso && iso.length >= 10) {
    return iso.slice(0, 10);
  }
  return fallback;
}

export function asStrArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  const out: string[] = [];
  for (let i = 0; i < val.length; i += 1) {
    const item = asStr(val[i], '').trim();
    if (item) out.push(item);
  }
  return out;
}

export function asFiniteNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function safeCompareAsc(a: unknown, b: unknown): number {
  const sa = asStr(a, '');
  const sb = asStr(b, '');
  if (sa === sb) return 0;
  try {
    return sa.localeCompare(sb);
  } catch {
    return sa < sb ? -1 : 1;
  }
}

export function safeCompareDesc(a: unknown, b: unknown): number {
  return safeCompareAsc(b, a);
}

export function safeFormatTime(
  val: unknown,
  locales: string | string[] = [],
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
  fallback = '--:--'
): string {
  const iso = asIsoString(val, '');
  const raw = iso || asStr(val, '');
  if (!raw) return fallback;
  try {
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return fallback;
    return d.toLocaleTimeString(locales, options);
  } catch {
    try {
      const d = new Date(raw);
      if (!Number.isFinite(d.getTime())) return fallback;
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch {
      return fallback;
    }
  }
}
