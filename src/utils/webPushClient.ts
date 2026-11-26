import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { Language } from '../types';
import { db } from './firebase';
import { normalizeMoroccanPhoneDigits } from './bookingStore';
import {
  registerServiceWorker,
  safeReadNotificationPermission,
  safeRequestNotificationPermission,
} from './notifications';

const PUSH_SUBSCRIPTIONS_COLLECTION = 'push_subscriptions';

export type NotificationSupportReason =
  | 'granted'
  | 'default'
  | 'denied'
  | 'overlay_or_blocked'
  | 'dismissed'
  | 'ios_homescreen_required'
  | 'insecure_context'
  | 'unsupported';

export interface NotificationEnvInfo {
  supported: boolean;
  pushSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isIos: boolean;
  isAndroid: boolean;
  isStandalonePwa: boolean;
  isSecureContext: boolean;
  reason: NotificationSupportReason;
}

export interface ResilientNotificationResult {
  granted: boolean;
  subscribed: boolean;
  permission: NotificationPermission | 'unsupported';
  reason: NotificationSupportReason;
  env: NotificationEnvInfo;
}

export interface StoredPushSubscription {
  id: string;
  role: 'client' | 'master' | 'barber';
  normalizedPhone?: string;
  clientPhone?: string;
  clientName?: string;
  barberId?: string;
  staffName?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang?: Language;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

let cachedVapidPublicKey: string | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const id = window.setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    promise
      .then((val) => {
        if (!done) {
          done = true;
          window.clearTimeout(id);
          resolve(val);
        }
      })
      .catch(() => {
        if (!done) {
          done = true;
          window.clearTimeout(id);
          resolve(fallback);
        }
      });
  });
}

export function detectNotificationEnvironment(): NotificationEnvInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      supported: false,
      pushSupported: false,
      permission: 'unsupported',
      isIos: false,
      isAndroid: false,
      isStandalonePwa: false,
      isSecureContext: false,
      reason: 'unsupported',
    };
  }

  const ua = navigator.userAgent || '';
  const isIos =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
  const isAndroid = /Android/i.test(ua);
  let isStandalonePwa = false;
  try {
    isStandalonePwa = Boolean(
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches) ||
        (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    isStandalonePwa = false;
  }

  const isSecureContext = window.isSecureContext !== false;
  const permission = safeReadNotificationPermission();
  const supported = permission !== 'unsupported';
  const pushSupported =
    supported && 'serviceWorker' in navigator && 'PushManager' in window;

  let reason: NotificationSupportReason;
  if (!isSecureContext) {
    reason = 'insecure_context';
  } else if (!supported) {
    reason = isIos && !isStandalonePwa ? 'ios_homescreen_required' : 'unsupported';
  } else if (permission === 'granted') {
    reason = 'granted';
  } else if (permission === 'denied') {
    reason = 'denied';
  } else {
    reason = 'default';
  }

  return {
    supported,
    pushSupported,
    permission,
    isIos,
    isAndroid,
    isStandalonePwa,
    isSecureContext,
    reason,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hashStringDeterministic(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeVapidPublicKey(raw?: string): string | null {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  if (!cleaned || !/^[A-Za-z0-9\-_]+$/.test(cleaned)) return null;
  try {
    return urlBase64ToUint8Array(cleaned).length === 65 ? cleaned : null;
  } catch {
    return null;
  }
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;

  // 1. Check .env client-side VAPID key if provided via Vite (VITE_VAPID_PUBLIC_KEY)
  try {
    const rawEnvPublicKey =
      typeof import.meta !== 'undefined' && import.meta.env
        ? String(import.meta.env.VITE_VAPID_PUBLIC_KEY || '')
        : '';
    const validEnvKey = normalizeVapidPublicKey(rawEnvPublicKey);
    if (validEnvKey) {
      cachedVapidPublicKey = validEnvKey;
      return validEnvKey;
    }
  } catch {
    // fallback to backend endpoint
  }

  // 2. Fallback to backend /api/push/vapid-public-key backed by server .env VAPID_PUBLIC_KEY
  try {
    const res = await withTimeout(fetch('/api/push/vapid-public-key'), 2500, null);
    if (!res || !res.ok) return null;
    const data = (await res.json()) as { publicKey?: string };
    const validServerKey = normalizeVapidPublicKey(data?.publicKey);
    if (validServerKey) {
      cachedVapidPublicKey = validServerKey;
      return validServerKey;
    }
    return null;
  } catch (err) {
    console.warn('Unable to load VAPID public key:', err);
    return null;
  }
}

export async function getBrowserPushStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  const env = detectNotificationEnvironment();
  if (!env.supported || env.permission === 'unsupported') {
    return { supported: false, permission: 'default', subscribed: false };
  }

  const permission = env.permission;
  if (permission !== 'granted' || !env.pushSupported) {
    return { supported: true, permission, subscribed: false };
  }

  try {
    const registration = await registerServiceWorker(2000);
    if (!registration || !registration.pushManager) {
      return { supported: true, permission, subscribed: false };
    }
    const sub = await withTimeout(registration.pushManager.getSubscription(), 2000, null);
    return { supported: true, permission, subscribed: Boolean(sub) };
  } catch {
    return { supported: true, permission, subscribed: false };
  }
}

async function getOrCreateBrowserPushSubscription(): Promise<{
  endpoint: string;
  p256dh: string;
  auth: string;
} | null> {
  const env = detectNotificationEnvironment();
  if (!env.pushSupported || env.permission !== 'granted') {
    return null;
  }

  try {
    const registration = await registerServiceWorker(2500);
    if (!registration || !registration.pushManager) return null;

    const vapidPublicKey = await fetchVapidPublicKey();
    if (!vapidPublicKey) return null;

    const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
    let subscription = await withTimeout(
      registration.pushManager.getSubscription(),
      2000,
      null
    );

    // If an existing subscription uses an outdated VAPID key, refresh it cleanly
    if (subscription && subscription.options?.applicationServerKey) {
      const existingKeyStr = arrayBufferToBase64Url(subscription.options.applicationServerKey);
      if (existingKeyStr && existingKeyStr !== vapidPublicKey) {
        try {
          await subscription.unsubscribe();
        } catch {
          // ignore stale unsubscribe failure
        }
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey.buffer as ArrayBuffer,
        }),
        3500,
        null
      );
    }

    if (!subscription) return null;

    const json = subscription.toJSON();
    const endpoint = json.endpoint || subscription.endpoint;
    const p256dh = json.keys?.p256dh || arrayBufferToBase64Url(subscription.getKey('p256dh'));
    const auth = json.keys?.auth || arrayBufferToBase64Url(subscription.getKey('auth'));

    if (!endpoint || !endpoint.startsWith('https://') || !p256dh || !auth) {
      return null;
    }

    return { endpoint, p256dh, auth };
  } catch (err) {
    console.warn('PushManager subscription setup note:', err);
    return null;
  }
}

/**
 * Non-blocking, cross-device resilient notification & Web Push flow.
 * Never throws or stalls booking creation/ticket display on Android screen overlays,
 * denied/dismissed prompts, iOS non-PWA Safari, or legacy browsers.
 */
export async function requestResilientClientNotifications(params: {
  clientPhone?: string;
  clientName?: string;
  lang: Language;
  allowPrompt?: boolean;
}): Promise<ResilientNotificationResult> {
  const initialEnv = detectNotificationEnvironment();
  if (!initialEnv.supported || !initialEnv.isSecureContext) {
    return {
      granted: false,
      subscribed: false,
      permission: initialEnv.permission,
      reason: initialEnv.reason,
      env: initialEnv,
    };
  }

  let permission: NotificationPermission | 'unsupported' = initialEnv.permission;
  let reason: NotificationSupportReason = initialEnv.reason;

  if (permission === 'default' && params.allowPrompt !== false) {
    const reqStartedAt = Date.now();
    const res = await safeRequestNotificationPermission(5000);
    permission = res.permission;
    const elapsedMs = Date.now() - reqStartedAt;

    if (permission === 'granted') {
      reason = 'granted';
    } else if (res.threwOrBlocked || (initialEnv.isAndroid && permission === 'default' && elapsedMs < 450)) {
      // On Android, floating bubbles / screen overlays immediately dismiss/block with no user interaction
      reason = 'overlay_or_blocked';
    } else if (permission === 'denied') {
      reason = 'denied';
    } else {
      reason = 'dismissed';
    }
  } else if (permission === 'denied') {
    reason = 'denied';
  } else if (permission === 'granted') {
    reason = 'granted';
  }

  const updatedEnv: NotificationEnvInfo = {
    ...initialEnv,
    permission,
    reason,
  };

  if (permission !== 'granted') {
    return {
      granted: false,
      subscribed: false,
      permission,
      reason,
      env: updatedEnv,
    };
  }

  const pushKeys = await getOrCreateBrowserPushSubscription();
  const normalizedPhone = normalizeMoroccanPhoneDigits(params.clientPhone || '');
  if (!pushKeys || normalizedPhone.length < 4) {
    return {
      granted: true,
      subscribed: false,
      permission: 'granted',
      reason: 'granted',
      env: updatedEnv,
    };
  }

  const endpointHash = hashStringDeterministic(pushKeys.endpoint);
  const docId = `sub_c_${normalizedPhone || 'anon'}_${endpointHash}`.slice(0, 120);
  const nowIso = new Date().toISOString().slice(0, 64);

  const record: StoredPushSubscription = {
    id: docId,
    role: 'client',
    normalizedPhone: normalizedPhone.slice(0, 32),
    clientPhone: String(params.clientPhone || '').trim().slice(0, 40),
    clientName: String(params.clientName || 'Client').trim().slice(0, 120),
    endpoint: pushKeys.endpoint.slice(0, 1000),
    p256dh: pushKeys.p256dh.slice(0, 300),
    auth: pushKeys.auth.slice(0, 200),
    lang: params.lang,
    userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 300),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await withTimeout(setDoc(doc(db, PUSH_SUBSCRIPTIONS_COLLECTION, docId), record), 3500, undefined);
    return {
      granted: true,
      subscribed: true,
      permission: 'granted',
      reason: 'granted',
      env: updatedEnv,
    };
  } catch (error) {
    console.warn('Client push subscription Firestore save note:', error);
    return {
      granted: true,
      subscribed: false,
      permission: 'granted',
      reason: 'granted',
      env: updatedEnv,
    };
  }
}

/**
 * Registers a client Web Push subscription in Firestore linked to their phone number.
 */
export async function registerClientPushSubscription(params: {
  clientPhone: string;
  clientName: string;
  lang: Language;
}): Promise<{ granted: boolean; subscribed: boolean }> {
  const res = await requestResilientClientNotifications({
    clientPhone: params.clientPhone,
    clientName: params.clientName,
    lang: params.lang,
    allowPrompt: true,
  });
  return { granted: res.granted, subscribed: res.subscribed };
}

/**
 * Registers an Admin or Barber Push subscription in Firestore so Hassan, Anouar,
 * Lahcen, and Mounir receive background alerts on new bookings, CIH receipts, and waitlist entries.
 */
export async function registerStaffPushSubscription(params: {
  role: 'master' | 'barber';
  barberId: string;
  staffName: string;
  lang?: Language;
}): Promise<{ granted: boolean; subscribed: boolean }> {
  const env = detectNotificationEnvironment();
  if (!env.supported) {
    return { granted: false, subscribed: false };
  }

  let permission: NotificationPermission | 'unsupported' = env.permission;
  if (permission !== 'granted') {
    const req = await safeRequestNotificationPermission(5000);
    permission = req.permission;
  }
  if (permission !== 'granted') {
    return { granted: false, subscribed: false };
  }

  const pushKeys = await getOrCreateBrowserPushSubscription();
  if (!pushKeys) {
    return { granted: true, subscribed: false };
  }

  const endpointHash = hashStringDeterministic(pushKeys.endpoint);
  const cleanBarberId = String(params.barberId || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
  const docId = `sub_s_${cleanBarberId}_${endpointHash}`.slice(0, 120);
  const nowIso = new Date().toISOString().slice(0, 64);

  const record: StoredPushSubscription = {
    id: docId,
    role: params.role,
    barberId: String(params.barberId || 'all').slice(0, 64),
    staffName: String(params.staffName || 'Staff').slice(0, 100),
    endpoint: pushKeys.endpoint.slice(0, 1000),
    p256dh: pushKeys.p256dh.slice(0, 300),
    auth: pushKeys.auth.slice(0, 200),
    lang: params.lang || 'ar',
    userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 300),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await withTimeout(setDoc(doc(db, PUSH_SUBSCRIPTIONS_COLLECTION, docId), record), 3500, undefined);
    return { granted: true, subscribed: true };
  } catch (error) {
    console.warn('Staff push subscription Firestore save note:', error);
    return { granted: true, subscribed: false };
  }
}

async function sendToPushRelay(
  records: StoredPushSubscription[],
  payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    eventType: string;
    ticketNumber?: string;
  }
): Promise<void> {
  if (records.length === 0) return;

  try {
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptions: records.map((r) => ({
          endpoint: r.endpoint,
          keys: {
            p256dh: r.p256dh,
            auth: r.auth,
          },
        })),
        payload,
      }),
    });

    if (!res.ok) return;
    const data = (await res.json()) as { expiredEndpoints?: string[] };
    if (Array.isArray(data.expiredEndpoints) && data.expiredEndpoints.length > 0) {
      const staleRecords = records.filter((r) =>
        data.expiredEndpoints!.includes(r.endpoint)
      );
      await Promise.all(
        staleRecords.map((stale) =>
          deleteDoc(doc(db, PUSH_SUBSCRIPTIONS_COLLECTION, stale.id)).catch(() => {})
        )
      );
    }
  } catch (err) {
    console.warn('Background push relay note:', err);
  }
}

/**
 * Dispatches a background Web Push notification to all subscribed devices for a client phone.
 */
export async function dispatchClientBackgroundPush(params: {
  clientPhone: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  eventType:
    | 'booking_confirmed'
    | 'booking_attended'
    | 'booking_rescheduled'
    | 'booking_updated'
    | 'loyalty_points_updated';
  ticketNumber?: string;
}): Promise<void> {
  const normalizedPhone = normalizeMoroccanPhoneDigits(params.clientPhone);
  if (normalizedPhone.length < 4) return;

  try {
    const q = query(
      collection(db, PUSH_SUBSCRIPTIONS_COLLECTION),
      where('role', '==', 'client'),
      where('normalizedPhone', '==', normalizedPhone)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const records = snap.docs.map((d) => d.data() as StoredPushSubscription);
    await sendToPushRelay(records, {
      title: params.title,
      body: params.body,
      url: params.url || '/',
      tag: params.tag || `sb-client-${params.eventType}-${normalizedPhone}`,
      eventType: params.eventType,
      ticketNumber: params.ticketNumber,
    });
  } catch (err) {
    console.warn('Client background push dispatch note:', err);
  }
}

/**
 * Dispatches a background Web Push notification to Master Admin (Hassan) and the assigned barber
 * (Anouar, Lahcen, Mounir, Hassan) whenever a booking, CIH receipt, or waitlist entry arrives.
 */
export async function dispatchStaffBackgroundPush(params: {
  barberId?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  eventType: 'new_booking' | 'cih_receipt_uploaded' | 'waitlist_joined';
  ticketNumber?: string;
}): Promise<void> {
  try {
    const q = query(
      collection(db, PUSH_SUBSCRIPTIONS_COLLECTION),
      where('role', 'in', ['master', 'barber'])
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const allStaffSubs = snap.docs.map((d) => d.data() as StoredPushSubscription);
    const targetBarber = params.barberId || 'all';
    const matchingSubs = allStaffSubs.filter(
      (sub) =>
        sub.role === 'master' ||
        sub.barberId === 'all' ||
        targetBarber === 'all' ||
        sub.barberId === targetBarber
    );

    await sendToPushRelay(matchingSubs, {
      title: params.title,
      body: params.body,
      url: params.url || '/#admin',
      tag: params.tag || `sb-staff-${params.eventType}`,
      eventType: params.eventType,
      ticketNumber: params.ticketNumber,
    });
  } catch (err) {
    console.warn('Staff background push dispatch note:', err);
  }
}
