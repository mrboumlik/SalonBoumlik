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
  updatedAt: new Date().toISOString(),
};

let cachedSettings: SalonProfileSettings = DEFAULT_SALON_PROFILE_SETTINGS;

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
  googleReviewUrl: string
): Promise<SalonProfileSettings> {
  const cleanMapsUrl = googleMapsUrl.trim();
  const cleanReviewUrl = googleReviewUrl.trim();
  if (!cleanMapsUrl.startsWith('https://') || !cleanReviewUrl.startsWith('https://')) {
    throw new Error('Both Google Maps and Google Business Review links must start with https://');
  }

  const payload: SalonProfileSettings = {
    googleMapsUrl: cleanMapsUrl.slice(0, 500),
    googleReviewUrl: cleanReviewUrl.slice(0, 500),
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
