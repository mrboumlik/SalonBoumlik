import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { SALON_INFO } from '../data/barbershopData';
import { SalonProfileSettings } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';

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

export function subscribeToSalonProfileSettings(
  onData: (settings: SalonProfileSettings) => void
): () => void {
  const ref = doc(db, SETTINGS_COLLECTION, SALON_PROFILE_DOC_ID);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<SalonProfileSettings>;
        cachedSettings = {
          googleMapsUrl: data.googleMapsUrl || SALON_INFO.googleMapsDirectionsUrl,
          googleReviewUrl: data.googleReviewUrl || SALON_INFO.social.googleReviewUrl,
          salonPhone: data.salonPhone?.trim() || SALON_INFO.phone,
          salonWhatsapp: data.salonWhatsapp?.trim() || SALON_INFO.whatsappNumber,
          additionalPhones: sanitizeAdditionalPhones(data.additionalPhones),
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      } else {
        cachedSettings = DEFAULT_SALON_PROFILE_SETTINGS;
      }
      onData(cachedSettings);
    },
    (error) => {
      console.warn('Salon profile settings listener warning:', error);
      onData(cachedSettings);
    }
  );
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
    cachedSettings = payload;
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
