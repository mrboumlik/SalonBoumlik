import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import {
  BarberCustomService,
  BarberCustomServiceOverride,
  BarberProfileOverride,
  BarberStaff,
  CaisseBarberId,
  RosterMemberAccount,
  ShopPricingConfig,
} from '../types';
import { TEAM_MEMBERS } from '../data/barbershopData';
import { BASE_SERVICES } from './pricingEngine';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  emitRealtimeSyncHint,
  registerRealtimeRefreshHandler,
  resetResilientRetry,
  scheduleResilientRetry,
} from './realtimeSync';
import { CALM_COLOR_PRESETS } from './barberIdentity';
import { DEFAULT_ROSTER_ACCOUNTS } from './barberRosterStore';
import {
  DEFAULT_SHOP_PRICING_CONFIG,
  resolveEffectiveServicePrices,
  sanitizeHiddenServiceIds,
  sanitizeServiceBundles,
} from './shopPricingStore';

const BARBER_PROFILES_COLLECTION = 'barber_profiles';

let cachedProfiles: Partial<Record<CaisseBarberId, BarberProfileOverride>> = {};
let hasHydratedProfiles = false;
const profileListeners = new Set<
  (map: Partial<Record<CaisseBarberId, BarberProfileOverride>>) => void
>();
let activeProfilesUnsubscribe: (() => void) | null = null;
let profilesRefreshUnsub: (() => void) | null = null;

function commitProfilesCache(
  next: Partial<Record<CaisseBarberId, BarberProfileOverride>>,
  broadcastHint = false
): void {
  cachedProfiles = next;
  hasHydratedProfiles = true;
  profileListeners.forEach((cb) => {
    try {
      cb(cachedProfiles);
    } catch (err) {
      console.warn('Barber profiles listener callback error:', err);
    }
  });
  if (broadcastHint) {
    emitRealtimeSyncHint('profiles');
  }
}

function sanitizeCustomServices(items: BarberCustomService[]): BarberCustomService[] {
  return (Array.isArray(items) ? items : [])
    .slice(0, 30)
    .map((item, idx) => ({
      id: String(item.id || `srv-${idx + 1}`)
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 64),
      nameAr: String(item.nameAr || 'خدمة').trim().slice(0, 80),
      nameFr: item.nameFr ? String(item.nameFr).trim().slice(0, 80) : undefined,
      nameEn: item.nameEn ? String(item.nameEn).trim().slice(0, 80) : undefined,
      priceMAD: Math.max(0, Math.min(20000, Math.round(Number(item.priceMAD) || 0))),
      durationMinutes: Math.max(
        10,
        Math.min(360, Math.round(Number(item.durationMinutes) || 30))
      ),
      active: item.active !== false,
    }))
    .filter((item) => item.nameAr.length > 0);
}

function sanitizeCustomServiceOverrides(
  raw: Record<string, BarberCustomServiceOverride> | undefined
): Record<string, BarberCustomServiceOverride> {
  const clean: Record<string, BarberCustomServiceOverride> = {};
  if (!raw || typeof raw !== 'object') return clean;
  Object.entries(raw)
    .slice(0, 30)
    .forEach(([key, val]) => {
      if (!val || typeof val !== 'object') return;
      const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
      if (!safeKey) return;
      if (!val.enabled) return;
      const entry: BarberCustomServiceOverride = {
        enabled: true,
        priceMAD: Math.max(0, Math.min(20000, Math.round(Number(val.priceMAD) || 0))),
      };
      if (
        typeof val.durationMinutes === 'number' &&
        Number.isFinite(val.durationMinutes)
      ) {
        entry.durationMinutes = Math.max(
          10,
          Math.min(360, Math.round(val.durationMinutes))
        );
      }
      clean[safeKey] = entry;
    });
  return clean;
}

export function normalizeInstagramHandle(raw: string | undefined): string {
  let clean = String(raw || '').trim();
  if (!clean) return '';
  clean = clean
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .split(/[/?#]/)[0]
    .replace(/^@+/, '')
    .trim()
    .slice(0, 80);
  return clean ? `@${clean}` : '';
}

function parseProfileDocs(
  docs: { id: string; data: () => unknown }[]
): Partial<Record<CaisseBarberId, BarberProfileOverride>> {
  const next: Partial<Record<CaisseBarberId, BarberProfileOverride>> = {};
  docs.forEach((docSnap) => {
    const raw = docSnap.data() as Partial<BarberProfileOverride>;
    const barberId = (raw.barberId || raw.id || docSnap.id) as CaisseBarberId;
    if (!barberId || !/^[a-zA-Z0-9_-]{2,64}$/.test(barberId)) {
      return;
    }
    next[barberId] = {
      id: barberId,
      barberId,
      avatar: raw.avatar,
      phone: raw.phone,
      whatsappNumber: raw.whatsappNumber,
      instagramHandle: raw.instagramHandle,
      bioAr: raw.bioAr,
      bioFr: raw.bioFr,
      bioEn: raw.bioEn,
      useCustomServices: Boolean(raw.useCustomServices),
      customServices: sanitizeCustomServices(raw.customServices || []),
      customServiceOverrides: sanitizeCustomServiceOverrides(
        raw.customServiceOverrides
      ),
      customHiddenServiceIds: sanitizeHiddenServiceIds(raw.customHiddenServiceIds),
      customBundles: sanitizeServiceBundles(raw.customBundles, false),
      enableNoWaitOption: Boolean(raw.enableNoWaitOption),
      updatedBy: raw.updatedBy || 'System',
      updatedAt: raw.updatedAt || '',
    };
  });
  return next;
}

function ensureBarberProfilesListener() {
  if (!profilesRefreshUnsub) {
    profilesRefreshUnsub = registerRealtimeRefreshHandler(
      'barber_profiles',
      'profiles',
      async () => {
        if (profileListeners.size === 0) return;
        ensureBarberProfilesListener();
        try {
          let snap;
          try {
            snap = await getDocsFromServer(collection(db, BARBER_PROFILES_COLLECTION));
          } catch {
            snap = await getDocs(collection(db, BARBER_PROFILES_COLLECTION));
          }
          commitProfilesCache(parseProfileDocs(snap.docs));
        } catch (err) {
          console.warn('Barber profiles wake refresh warning:', err);
        }
      }
    );
  }
  if (activeProfilesUnsubscribe) return;

  activeProfilesUnsubscribe = onSnapshot(
    collection(db, BARBER_PROFILES_COLLECTION),
    (snapshot) => {
      resetResilientRetry('barber_profiles');
      commitProfilesCache(parseProfileDocs(snapshot.docs));
    },
    (error) => {
      if (activeProfilesUnsubscribe) {
        try {
          activeProfilesUnsubscribe();
        } catch {
          // Ignore
        }
        activeProfilesUnsubscribe = null;
      }
      scheduleResilientRetry(
        'barber_profiles',
        () => profileListeners.size > 0,
        () => ensureBarberProfilesListener(),
        error
      );
    }
  );
}

export function subscribeToBarberProfiles(
  onData: (map: Partial<Record<CaisseBarberId, BarberProfileOverride>>) => void
): () => void {
  profileListeners.add(onData);
  ensureBarberProfilesListener();
  if (hasHydratedProfiles) {
    onData(cachedProfiles);
  }
  return () => {
    profileListeners.delete(onData);
    if (profileListeners.size === 0) {
      resetResilientRetry('barber_profiles');
      if (activeProfilesUnsubscribe) {
        activeProfilesUnsubscribe();
        activeProfilesUnsubscribe = null;
      }
      if (profilesRefreshUnsub) {
        profilesRefreshUnsub();
        profilesRefreshUnsub = null;
      }
      hasHydratedProfiles = false;
    }
  };
}

export function useBarberProfiles(): Partial<
  Record<CaisseBarberId, BarberProfileOverride>
> {
  const [profiles, setProfiles] = useState<
    Partial<Record<CaisseBarberId, BarberProfileOverride>>
  >(cachedProfiles);

  useEffect(() => {
    const unsub = subscribeToBarberProfiles((data) => {
      setProfiles({ ...data });
    });
    return () => unsub();
  }, []);

  return profiles;
}

export async function saveBarberProfile(
  profile: Omit<BarberProfileOverride, 'id' | 'updatedAt'>
): Promise<BarberProfileOverride> {
  const barberId = profile.barberId;
  const path = `${BARBER_PROFILES_COLLECTION}/${barberId}`;
  const nowIso = new Date().toISOString().slice(0, 64);

  const sanitizedServices = sanitizeCustomServices(profile.customServices).map(
    (srv) => {
      const clean: BarberCustomService = {
        id: srv.id,
        nameAr: srv.nameAr,
        priceMAD: srv.priceMAD,
        durationMinutes: srv.durationMinutes,
        active: srv.active,
      };
      if (srv.nameFr) clean.nameFr = srv.nameFr;
      if (srv.nameEn) clean.nameEn = srv.nameEn;
      return clean;
    }
  );

  const sanitizedOverrides = sanitizeCustomServiceOverrides(
    profile.customServiceOverrides
  );
  const sanitizedHiddenIds = sanitizeHiddenServiceIds(profile.customHiddenServiceIds);
  const sanitizedCustomBundles = sanitizeServiceBundles(profile.customBundles, false);

  const payload: Record<string, unknown> = {
    id: barberId,
    barberId,
    useCustomServices: Boolean(profile.useCustomServices),
    customServices: sanitizedServices,
    customServiceOverrides: sanitizedOverrides,
    customHiddenServiceIds: sanitizedHiddenIds,
    customBundles: sanitizedCustomBundles,
    enableNoWaitOption: Boolean(profile.enableNoWaitOption),
    updatedBy: String(profile.updatedBy || 'Staff').trim().slice(0, 100),
    updatedAt: nowIso,
  };

  if (profile.avatar && profile.avatar.trim()) {
    payload.avatar = profile.avatar.trim().slice(0, 235000);
  }
  if (profile.phone && profile.phone.trim()) {
    payload.phone = profile.phone.trim().slice(0, 40);
  }
  if (profile.whatsappNumber && profile.whatsappNumber.trim()) {
    payload.whatsappNumber = profile.whatsappNumber.trim().slice(0, 40);
  }
  const cleanIg = normalizeInstagramHandle(profile.instagramHandle);
  if (cleanIg) {
    payload.instagramHandle = cleanIg.slice(0, 100);
  }
  if (barberId === 'hassan') {
    if (profile.bioAr && profile.bioAr.trim()) {
      payload.bioAr = profile.bioAr.trim().slice(0, 500);
    }
    if (profile.bioFr && profile.bioFr.trim()) {
      payload.bioFr = profile.bioFr.trim().slice(0, 500);
    }
    if (profile.bioEn && profile.bioEn.trim()) {
      payload.bioEn = profile.bioEn.trim().slice(0, 500);
    }
  }

  try {
    await setDoc(doc(db, BARBER_PROFILES_COLLECTION, barberId), payload);
    const saved = payload as unknown as BarberProfileOverride;
    commitProfilesCache({ ...cachedProfiles, [barberId]: saved }, true);
    return saved;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Merges active roster barbers + static TEAM_MEMBERS metadata with live Firestore profile overrides.
 * Excludes archived barbers and the shared Caisse account from client/active barber lists.
 */
export function getMergedBarbers(
  profilesMap: Partial<Record<CaisseBarberId, BarberProfileOverride>>,
  rosterMembers?: RosterMemberAccount[]
): BarberStaff[] {
  const staticById = new Map(TEAM_MEMBERS.map((m) => [m.id, m]));
  const rosterSource =
    rosterMembers && rosterMembers.length > 0 ? rosterMembers : DEFAULT_ROSTER_ACCOUNTS;

  const activeRoster = rosterSource.filter(
    (m) => m.status !== 'archived' && m.role !== 'caisse'
  );

  return activeRoster.map((rosterItem) => {
    const baseMember = staticById.get(rosterItem.id);
    const preset = CALM_COLOR_PRESETS[rosterItem.colorKey] || CALM_COLOR_PRESETS.slate;

    const fallbackMember: BarberStaff = baseMember
      ? {
          ...baseMember,
          name: {
            ...baseMember.name,
            ar: rosterItem.nameAr || baseMember.name.ar,
            fr: rosterItem.nameFr || baseMember.name.fr,
            en: rosterItem.nameEn || baseMember.name.en,
          },
          themeColor: preset.accentHex,
          colorName: rosterItem.colorKey,
        }
      : {
          id: rosterItem.id,
          name: {
            ar: rosterItem.nameAr,
            fr: rosterItem.nameFr,
            en: rosterItem.nameEn || rosterItem.nameFr,
            amz: rosterItem.nameAr,
            es: rosterItem.nameFr,
          },
          role: {
            fr: 'Barbier Professionnel',
            ar: 'حلاق محترف',
            en: 'Master Barber',
            amz: 'ⴰⵎⵣⵡⴰⵔⵓ',
            es: 'Barbero Profesional',
          },
          experience: {
            fr: 'Équipe Boumlik',
            ar: 'فريق صالون بومليك',
            en: 'Boumlik Team',
            amz: 'ⵜⴰⵔⴱⴰܥⵜ ⵏ ⴱⵓⵎⵍⵉⴽ',
            es: 'Equipo Boumlik',
          },
          specialty: {
            fr: 'Dégradés & Barbe',
            ar: 'التدريج العصري واللحية',
            en: 'Fades & Beard Styling',
            amz: 'ⵜⴰⴽⵔⴹⴰ ⴷ ⵜⵎⴰⵔⵜ',
            es: 'Degradados y Barba',
          },
          phone: rosterItem.defaultPhone || '+212635392503',
          whatsappNumber: rosterItem.defaultWhatsapp || '212635392503',
          instagramHandle: rosterItem.defaultInstagram || '@boumlik.barbershop',
          instagram: 'https://www.instagram.com/boumlik.barbershop',
          avatar:
            rosterItem.defaultAvatar ||
            TEAM_MEMBERS[1]?.avatar ||
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
          rating: 4.9,
          isOwner: Boolean(rosterItem.isOwner),
          themeColor: preset.accentHex,
          colorName: rosterItem.colorKey,
        };

    const override = profilesMap[rosterItem.id as CaisseBarberId];
    if (!override) return fallbackMember;

    const cleanIg = normalizeInstagramHandle(override.instagramHandle);
    const nextIgHandle = cleanIg || fallbackMember.instagramHandle;
    const nextIgUrl = nextIgHandle
      ? `https://www.instagram.com/${nextIgHandle.replace(/^@+/, '')}`
      : fallbackMember.instagram;

    return {
      ...fallbackMember,
      avatar: override.avatar?.trim() ? override.avatar.trim() : fallbackMember.avatar,
      phone: override.phone?.trim() ? override.phone.trim() : fallbackMember.phone,
      whatsappNumber: override.whatsappNumber?.trim()
        ? override.whatsappNumber.trim()
        : fallbackMember.whatsappNumber,
      instagramHandle: nextIgHandle,
      instagram: nextIgUrl,
      bio: fallbackMember.isOwner
        ? {
            fr: override.bioFr?.trim() || fallbackMember.bio?.fr || '',
            ar: override.bioAr?.trim() || fallbackMember.bio?.ar || '',
            en: override.bioEn?.trim() || fallbackMember.bio?.en || '',
            amz: fallbackMember.bio?.amz || '',
            es: fallbackMember.bio?.es,
          }
        : fallbackMember.bio,
    };
  });
}

export interface SelectableBarberService {
  id: string;
  nameAr: string;
  nameFr: string;
  nameEn: string;
  priceMAD: number;
  durationMinutes: number;
  isCustom: boolean;
}

/**
 * Returns active services for a barber combining:
 * - Visible Salon BASE_SERVICES (filtering out shopConfig.hiddenServiceIds) with overrides & rules
 * - Selected barber's selective per-service price/duration overrides (ONLY when enabled by that barber)
 * - Plus any extra personal custom services added by that barber
 */
export function getBarberSelectableServices(
  barberId: CaisseBarberId,
  profilesMap: Partial<Record<CaisseBarberId, BarberProfileOverride>>,
  shopConfig: ShopPricingConfig = DEFAULT_SHOP_PRICING_CONFIG,
  dateStr: string = new Date().toISOString().split('T')[0]
): SelectableBarberService[] {
  const override = profilesMap[barberId];
  const resolved = resolveEffectiveServicePrices({
    dateStr,
    shopConfig,
    barberProfile: override,
  });

  const hiddenSet = new Set([
    ...(shopConfig?.hiddenServiceIds || []),
    ...(override?.customHiddenServiceIds || []),
  ]);

  const baseList: SelectableBarberService[] = BASE_SERVICES
    .filter((srv) => !hiddenSet.has(srv.id))
    .map((srv) => ({
      id: srv.id,
      nameAr: srv.name.ar,
      nameFr: srv.name.fr,
      nameEn: srv.name.en,
      priceMAD: resolved.priceMap[srv.id] ?? srv.basePrice,
      durationMinutes: resolved.durationMap[srv.id] ?? srv.durationMinutes,
      isCustom: resolved.barberCustomServiceIds.includes(srv.id),
    }));

  const extraCustoms = (override?.customServices || [])
    .filter((s) => s.active !== false && !BASE_SERVICES.some((b) => b.id === s.id))
    .map((s) => ({
      id: s.id,
      nameAr: s.nameAr,
      nameFr: s.nameFr || s.nameAr,
      nameEn: s.nameEn || s.nameFr || s.nameAr,
      priceMAD: s.priceMAD,
      durationMinutes: s.durationMinutes || 30,
      isCustom: true,
    }));

  return [...baseList, ...extraCustoms];
}

/**
 * Compresses an uploaded image file to a JPEG Data URL <= 140 KB for Firestore storage.
 */
export async function compressAvatarImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const maxDim = 420;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 180000 && quality > 0.35) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
