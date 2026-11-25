import { useEffect, useState } from 'react';
import { doc, getDoc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import { SALON_INFO } from '../data/barbershopData';
import { SalonProfileSettings } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  emitRealtimeSyncHint,
  registerRealtimeRefreshHandler,
  resetResilientRetry,
  scheduleResilientRetry,
} from './realtimeSync';

const SETTINGS_COLLECTION = 'settings';
const SALON_PROFILE_DOC_ID = 'salon_profile';

export const DEFAULT_SALON_PROFILE_SETTINGS: SalonProfileSettings = {
  googleMapsUrl: SALON_INFO.googleMapsDirectionsUrl,
  googleReviewUrl: SALON_INFO.social.googleReviewUrl,
  salonPhone: SALON_INFO.phone,
  salonWhatsapp: SALON_INFO.whatsappNumber,
  additionalPhones: [],
  updatedAt: new Date().toISOString(),
};

let cachedSettings: SalonProfileSettings = DEFAULT_SALON_PROFILE_SETTINGS;
let hasHydratedSettings = false;
const settingsListeners = new Set<(settings: SalonProfileSettings) => void>();
let activeSettingsUnsub: (() => void) | null = null;
let settingsRefreshUnsub: (() => void) | null = null;

function sanitizeAdditionalPhones(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((p) => String(p || '').trim().slice(0, 40))
        .filter((p) => p.length >= 6)
    )
  ).slice(0, 10);
}

export function formatSalonDisplayPhone(raw?: string): string {
  const clean = String(raw || SALON_INFO.phone).trim();
  const digits = clean.replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('212') && local.length >= 11) {
    local = `0${local.slice(3)}`;
  }
  if (local.length === 10 && local.startsWith('0')) {
    return `${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8, 10)}`;
  }
  return clean || SALON_INFO.displayPhone;
}

export function normalizeSalonWhatsappDigits(raw?: string): string {
  const digits = String(raw || SALON_INFO.whatsappNumber).replace(/\D/g, '');
  if (!digits) return SALON_INFO.whatsappNumber;
  if (digits.startsWith('212')) return digits;
  if (digits.startsWith('0')) return `212${digits.slice(1)}`;
  return digits.length === 9 ? `212${digits}` : digits;
}

export function normalizeSalonTelHref(raw?: string): string {
  const clean = String(raw || SALON_INFO.phone).trim();
  const digits = clean.replace(/\D/g, '');
  if (!digits) return `tel:+${SALON_INFO.whatsappNumber}`;
  if (clean.startsWith('+')) return `tel:+${digits}`;
  if (digits.startsWith('212')) return `tel:+${digits}`;
  if (digits.startsWith('0') && digits.length >= 9) return `tel:+212${digits.slice(1)}`;
  return `tel:${clean.replace(/\s+/g, '')}`;
}

function parseSettingsSnapshotData(
  exists: boolean,
  rawData?: Partial<SalonProfileSettings>
): SalonProfileSettings {
  if (!exists || !rawData) {
    return DEFAULT_SALON_PROFILE_SETTINGS;
  }
  return {
    googleMapsUrl: rawData.googleMapsUrl || SALON_INFO.googleMapsDirectionsUrl,
    googleReviewUrl: rawData.googleReviewUrl || SALON_INFO.social.googleReviewUrl,
    salonPhone: rawData.salonPhone?.trim() || SALON_INFO.phone,
    salonWhatsapp: rawData.salonWhatsapp?.trim() || SALON_INFO.whatsappNumber,
    additionalPhones: sanitizeAdditionalPhones(rawData.additionalPhones),
    updatedAt: rawData.updatedAt || new Date().toISOString(),
  };
}

function commitSettingsCache(next: SalonProfileSettings, broadcastHint = false): void {
  cachedSettings = next;
  hasHydratedSettings = true;
  settingsListeners.forEach((cb) => {
    try {
      cb(cachedSettings);
    } catch (err) {
      console.warn('Salon settings listener callback error:', err);
    }
  });
  if (broadcastHint) {
    emitRealtimeSyncHint('settings');
  }
}

function ensureSalonSettingsListener() {
  const ref = doc(db, SETTINGS_COLLECTION, SALON_PROFILE_DOC_ID);

  if (!settingsRefreshUnsub) {
    settingsRefreshUnsub = registerRealtimeRefreshHandler(
      'salon_settings',
      'settings',
      async () => {
        if (settingsListeners.size === 0) return;
        ensureSalonSettingsListener();
        try {
          let snap;
          try {
            snap = await getDocFromServer(ref);
          } catch {
            snap = await getDoc(ref);
          }
          commitSettingsCache(
            parseSettingsSnapshotData(snap.exists(), snap.data() as Partial<SalonProfileSettings>)
          );
        } catch (err) {
          console.warn('Salon profile settings wake refresh warning:', err);
        }
      }
    );
  }

  if (activeSettingsUnsub) return;

  activeSettingsUnsub = onSnapshot(
    ref,
    (snap) => {
      resetResilientRetry('salon_settings');
      commitSettingsCache(
        parseSettingsSnapshotData(snap.exists(), snap.data() as Partial<SalonProfileSettings>)
      );
    },
    (error) => {
      if (activeSettingsUnsub) {
        try {
          activeSettingsUnsub();
        } catch {
          // Ignore
        }
        activeSettingsUnsub = null;
      }
      scheduleResilientRetry(
        'salon_settings',
        () => settingsListeners.size > 0,
        () => ensureSalonSettingsListener(),
        error
      );
    }
  );
}

export function subscribeToSalonProfileSettings(
  onData: (settings: SalonProfileSettings) => void
): () => void {
  settingsListeners.add(onData);
  ensureSalonSettingsListener();
  if (hasHydratedSettings) {
    onData(cachedSettings);
  }
  return () => {
    settingsListeners.delete(onData);
    if (settingsListeners.size === 0) {
      resetResilientRetry('salon_settings');
      if (activeSettingsUnsub) {
        activeSettingsUnsub();
        activeSettingsUnsub = null;
      }
      if (settingsRefreshUnsub) {
        settingsRefreshUnsub();
        settingsRefreshUnsub = null;
      }
      hasHydratedSettings = false;
    }
  };
}

export async function saveSalonProfileSettings(
  googleMapsUrl: string,
  googleReviewUrl: string,
  contactPatch?: {
    salonPhone?: string;
    salonWhatsapp?: string;
    additionalPhones?: string[];
  }
): Promise<SalonProfileSettings> {
  const cleanMapsUrl = googleMapsUrl.trim();
  const cleanReviewUrl = googleReviewUrl.trim();
  if (!cleanMapsUrl.startsWith('https://') || !cleanReviewUrl.startsWith('https://')) {
    throw new Error('Both Google Maps and Google Business Review links must start with https://');
  }

  const nextPhone = (
    contactPatch?.salonPhone !== undefined
      ? contactPatch.salonPhone
      : cachedSettings.salonPhone || SALON_INFO.phone
  )
    .trim()
    .slice(0, 40);

  const nextWhatsapp = (
    contactPatch?.salonWhatsapp !== undefined
      ? contactPatch.salonWhatsapp
      : cachedSettings.salonWhatsapp || SALON_INFO.whatsappNumber
  )
    .trim()
    .slice(0, 40);

  const nextAdditional =
    contactPatch?.additionalPhones !== undefined
      ? sanitizeAdditionalPhones(contactPatch.additionalPhones)
      : cachedSettings.additionalPhones || [];

  const payload: SalonProfileSettings = {
    googleMapsUrl: cleanMapsUrl.slice(0, 500),
    googleReviewUrl: cleanReviewUrl.slice(0, 500),
    salonPhone: nextPhone || SALON_INFO.phone,
    salonWhatsapp: nextWhatsapp || SALON_INFO.whatsappNumber,
    additionalPhones: nextAdditional,
    updatedAt: new Date().toISOString(),
  };

  const path = `${SETTINGS_COLLECTION}/${SALON_PROFILE_DOC_ID}`;
  try {
    await setDoc(doc(db, SETTINGS_COLLECTION, SALON_PROFILE_DOC_ID), payload);
    commitSettingsCache(payload, true);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function useSalonProfileSettings(): SalonProfileSettings {
  const [settings, setSettings] = useState<SalonProfileSettings>(cachedSettings);

  useEffect(() => {
    const unsub = subscribeToSalonProfileSettings(setSettings);
    return () => unsub();
  }, []);

  return settings;
}
