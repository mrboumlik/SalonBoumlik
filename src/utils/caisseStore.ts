import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  BarberDailyNote,
  CaisseBarberId,
  CaisseBarberSetting,
  CaisseCreditStatus,
  CaisseCycleSettlement,
  CaisseDailyArchive,
  CaisseDailySettlement,
  CaisseEntry,
  CaisseEntryType,
  ClientCreditRecord,
  CommissionPeriodOverride,
  RosterMemberAccount,
  StaffRole,
} from '../types';
import { getBarberIdentityTokens } from './barberIdentity';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  emitRealtimeSyncHint,
  registerRealtimeRefreshHandler,
  resetResilientRetry,
  scheduleResilientRetry,
} from './realtimeSync';

const CAISSE_ENTRIES_COLLECTION = 'caisse_entries';
const CAISSE_SETTINGS_COLLECTION = 'caisse_settings';
const CAISSE_SETTLEMENTS_COLLECTION = 'caisse_settlements';
const CAISSE_CYCLES_COLLECTION = 'caisse_cycles';
const CAISSE_ARCHIVES_COLLECTION = 'caisse_daily_archives';
const BARBER_DAILY_NOTES_COLLECTION = 'barber_daily_notes';

/**
 * Business day rolls over at 03:00 AM local time so late-night entries
 * between 00:00 and 02:59 still belong to the salon's previous evening shift.
 */
export function getSalonBusinessDate(dateObj: Date = new Date()): string {
  const shifted = new Date(dateObj.getTime());
  shifted.setHours(shifted.getHours() - 3);
  const yyyy = shifted.getFullYear();
  const mm = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface CaisseBarberInfo {
  id: CaisseBarberId;
  name: string;
  arName: string;
  color: string;
  isOwner?: boolean;
}

export const CAISSE_BARBERS: CaisseBarberInfo[] = [
  {
    id: 'hassan',
    name: 'Hassan ait boumlik',
    arName: 'حسن ايت بومليك',
    color: '#D97706',
    isOwner: true,
  },
  {
    id: 'anouar-arif',
    name: 'Anouar arif',
    arName: 'انور عريف',
    color: '#2563EB',
  },
  {
    id: 'lahcen-lhanz',
    name: 'Lahcen lhanz',
    arName: 'لحسن الهنز',
    color: '#059669',
  },
  {
    id: 'mounir-querdeny',
    name: 'Mounir querdeny',
    arName: 'منير كرديني',
    color: '#7C3AED',
  },
];

export function resolveCaisseBarberId(
  rawBarberId: string,
  rawBarberName?: string,
  rosterMembers?: RosterMemberAccount[]
): CaisseBarberId {
  const normalized = (rawBarberId || '').toLowerCase().trim();
  if (rosterMembers && rosterMembers.length > 0) {
    const directMatch = rosterMembers.find((m) => m.id.toLowerCase() === normalized);
    if (directMatch) return directMatch.id;
  }
  if (normalized === 'hassan' || normalized === 'all') return 'hassan';
  if (normalized === 'anouar-arif' || normalized.includes('anouar')) return 'anouar-arif';
  if (normalized === 'lahcen-lhanz' || normalized.includes('lahcen')) return 'lahcen-lhanz';
  if (normalized === 'mounir-querdeny' || normalized.includes('mounir')) return 'mounir-querdeny';
  if (normalized && /^[a-z0-9_-]{2,64}$/.test(normalized)) return normalized;

  const nameLower = (rawBarberName || '').toLowerCase().trim();
  if (rosterMembers && rosterMembers.length > 0 && nameLower) {
    const byName = rosterMembers.find(
      (m) =>
        m.nameFr.toLowerCase() === nameLower ||
        m.nameAr.toLowerCase() === nameLower ||
        (m.nameEn && m.nameEn.toLowerCase() === nameLower) ||
        nameLower.includes(m.nameFr.toLowerCase().split(' ')[0])
    );
    if (byName) return byName.id;
  }
  if (nameLower.includes('anouar')) return 'anouar-arif';
  if (nameLower.includes('lahcen')) return 'lahcen-lhanz';
  if (nameLower.includes('mounir')) return 'mounir-querdeny';
  return 'hassan';
}

export function getCaisseBarberMeta(
  barberId: CaisseBarberId,
  rosterMembers?: RosterMemberAccount[]
): CaisseBarberInfo {
  const fromRoster = rosterMembers?.find((m) => m.id === barberId);
  if (fromRoster) {
    const tokens = getBarberIdentityTokens(fromRoster.id, fromRoster.nameAr, fromRoster.colorKey);
    return {
      id: fromRoster.id,
      name: fromRoster.nameFr,
      arName: fromRoster.nameAr,
      color: tokens.accentHex,
      isOwner: Boolean(fromRoster.isOwner),
    };
  }
  const fromDefault = CAISSE_BARBERS.find((b) => b.id === barberId);
  if (fromDefault) return fromDefault;
  const tokens = getBarberIdentityTokens(barberId);
  return {
    id: barberId,
    name: barberId,
    arName: barberId,
    color: tokens.accentHex,
  };
}

export function getCaisseBarbersFromRoster(
  rosterMembers?: RosterMemberAccount[],
  entries?: CaisseEntry[]
): CaisseBarberInfo[] {
  const list: CaisseBarberInfo[] = [];
  const seen = new Set<string>();

  if (rosterMembers && rosterMembers.length > 0) {
    rosterMembers
      .filter((m) => m.role !== 'caisse' && m.status !== 'archived')
      .forEach((m) => {
        seen.add(m.id);
        list.push(getCaisseBarberMeta(m.id, rosterMembers));
      });
  } else {
    CAISSE_BARBERS.forEach((b) => {
      seen.add(b.id);
      list.push(b);
    });
  }

  // Also include archived barbers if they have historical entries passed in
  if (entries && rosterMembers) {
    const archivedWithEntries = new Set(entries.map((e) => e.barberId));
    rosterMembers
      .filter((m) => m.role !== 'caisse' && m.status === 'archived' && archivedWithEntries.has(m.id))
      .forEach((m) => {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          const meta = getCaisseBarberMeta(m.id, rosterMembers);
          list.push({ ...meta, arName: `${meta.arName} (سابق)` });
        }
      });
  }

  return list;
}

function clampAmount(val: number | undefined | null, max = 100000): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(max, Math.round(val * 100) / 100));
}

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  if (cleaned.length >= 3) return cleaned;
  return `${fallbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function matchesCaisseBarber(
  rawBarberId: string | undefined,
  rawBarberName: string | undefined,
  targetBarberId: CaisseBarberId,
  rosterMembers?: RosterMemberAccount[]
): boolean {
  if (rawBarberId === targetBarberId) return true;
  return (
    resolveCaisseBarberId(rawBarberId || 'hassan', rawBarberName, rosterMembers) ===
    targetBarberId
  );
}

export function getEffectiveCaisseCreditRemaining(
  entry: Partial<CaisseEntry> | null | undefined
): number {
  if (!entry) return 0;
  if (entry.creditStatus === 'paid') return 0;
  if (
    typeof entry.creditRemainingMAD === 'number' &&
    Number.isFinite(entry.creditRemainingMAD)
  ) {
    return Math.max(0, entry.creditRemainingMAD);
  }
  const parsed = Number(entry.creditRemainingMAD);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(0, parsed);
  }
  if (
    (entry.creditRemainingMAD === undefined || entry.creditRemainingMAD === null) &&
    (Number(entry.creditAmountMAD) || 0) > 0
  ) {
    return Math.max(0, Number(entry.creditAmountMAD) || 0);
  }
  return 0;
}

function sortCaisseEntriesDesc(list: CaisseEntry[]): CaisseEntry[] {
  return [...list].sort((a, b) => {
    const ka = a.createdAt || a.date || '';
    const kb = b.createdAt || b.date || '';
    const cmp = kb.localeCompare(ka);
    if (cmp !== 0) return cmp;
    return (b.id || '').localeCompare(a.id || '');
  });
}

function sortCaisseCyclesDesc(list: CaisseCycleSettlement[]): CaisseCycleSettlement[] {
  return [...list].sort((a, b) => {
    const ka = a.confirmedAt || a.settledThroughIso || a.settledThroughDate || '';
    const kb = b.confirmedAt || b.settledThroughIso || b.settledThroughDate || '';
    const cmp = kb.localeCompare(ka);
    if (cmp !== 0) return cmp;
    return (b.id || '').localeCompare(a.id || '');
  });
}

async function getCollectionDocsFast<T>(colName: string) {
  try {
    return await getDocsFromServer(collection(db, colName));
  } catch {
    return await getDocs(collection(db, colName));
  }
}

// ---------- In-memory caches + shared Firestore subscriptions ----------

let entriesCache: CaisseEntry[] = [];
let hasEntriesHydrated = false;
const entryListeners = new Set<(entries: CaisseEntry[]) => void>();
let entriesUnsub: (() => void) | null = null;
let entriesRefreshUnsub: (() => void) | null = null;

function notifyEntriesListeners() {
  entryListeners.forEach((cb) => {
    try {
      cb(entriesCache);
    } catch (err) {
      console.warn('Caisse entries listener callback error:', err);
    }
  });
}

function ensureEntriesListener() {
  if (!entriesRefreshUnsub) {
    entriesRefreshUnsub = registerRealtimeRefreshHandler(
      'caisse_entries',
      'caisse',
      async () => {
        if (entryListeners.size === 0) return;
        ensureEntriesListener();
        try {
          const snap = await getCollectionDocsFast(CAISSE_ENTRIES_COLLECTION);
          entriesCache = sortCaisseEntriesDesc(
            snap.docs.map((d) => ({
              ...(d.data() as CaisseEntry),
              id: (d.data() as CaisseEntry).id || d.id,
            }))
          );
          hasEntriesHydrated = true;
          notifyEntriesListeners();
        } catch (err) {
          console.warn('Caisse entries wake refresh warning:', err);
        }
      }
    );
  }
  if (entriesUnsub) return;

  entriesUnsub = onSnapshot(
    collection(db, CAISSE_ENTRIES_COLLECTION),
    (snapshot) => {
      resetResilientRetry('caisse_entries');
      entriesCache = sortCaisseEntriesDesc(
        snapshot.docs.map((d) => ({
          ...(d.data() as CaisseEntry),
          id: (d.data() as CaisseEntry).id || d.id,
        }))
      );
      hasEntriesHydrated = true;
      notifyEntriesListeners();
    },
    (error) => {
      if (entriesUnsub) {
        try {
          entriesUnsub();
        } catch {
          // Ignore
        }
        entriesUnsub = null;
      }
      scheduleResilientRetry(
        'caisse_entries',
        () => entryListeners.size > 0,
        () => ensureEntriesListener(),
        error
      );
    }
  );
}

export function subscribeToCaisseEntries(cb: (entries: CaisseEntry[]) => void): () => void {
  entryListeners.add(cb);
  ensureEntriesListener();
  if (hasEntriesHydrated) cb(entriesCache);
  return () => {
    entryListeners.delete(cb);
    if (entryListeners.size === 0) {
      resetResilientRetry('caisse_entries');
      if (entriesUnsub) {
        entriesUnsub();
        entriesUnsub = null;
      }
      if (entriesRefreshUnsub) {
        entriesRefreshUnsub();
        entriesRefreshUnsub = null;
      }
      hasEntriesHydrated = false;
    }
  };
}

export function useCaisseEntries(): CaisseEntry[] {
  const [entries, setEntries] = useState<CaisseEntry[]>(entriesCache);
  useEffect(() => subscribeToCaisseEntries(setEntries), []);
  return entries;
}

let settingsCache: Record<string, CaisseBarberSetting> = {};
let hasSettingsHydrated = false;
const settingsListeners = new Set<(map: Record<string, CaisseBarberSetting>) => void>();
let settingsUnsub: (() => void) | null = null;
let settingsRefreshUnsub: (() => void) | null = null;

function notifySettingsListeners() {
  settingsListeners.forEach((cb) => {
    try {
      cb(settingsCache);
    } catch (err) {
      console.warn('Caisse settings listener callback error:', err);
    }
  });
}

function ensureSettingsListener() {
  if (!settingsRefreshUnsub) {
    settingsRefreshUnsub = registerRealtimeRefreshHandler(
      'caisse_settings',
      'caisse',
      async () => {
        if (settingsListeners.size === 0) return;
        ensureSettingsListener();
        try {
          const snap = await getCollectionDocsFast(CAISSE_SETTINGS_COLLECTION);
          const next: Record<string, CaisseBarberSetting> = {};
          snap.docs.forEach((d) => {
            const data = d.data() as CaisseBarberSetting;
            next[d.id] = { ...data, id: data.id || d.id };
          });
          settingsCache = next;
          hasSettingsHydrated = true;
          notifySettingsListeners();
        } catch (err) {
          console.warn('Caisse settings wake refresh warning:', err);
        }
      }
    );
  }
  if (settingsUnsub) return;

  settingsUnsub = onSnapshot(
    collection(db, CAISSE_SETTINGS_COLLECTION),
    (snapshot) => {
      resetResilientRetry('caisse_settings');
      const next: Record<string, CaisseBarberSetting> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as CaisseBarberSetting;
        next[d.id] = { ...data, id: data.id || d.id };
      });
      settingsCache = next;
      hasSettingsHydrated = true;
      notifySettingsListeners();
    },
    (error) => {
      if (settingsUnsub) {
        try {
          settingsUnsub();
        } catch {
          // Ignore
        }
        settingsUnsub = null;
      }
      scheduleResilientRetry(
        'caisse_settings',
        () => settingsListeners.size > 0,
        () => ensureSettingsListener(),
        error
      );
    }
  );
}

export function subscribeToCaisseSettings(
  cb: (map: Record<string, CaisseBarberSetting>) => void
): () => void {
  settingsListeners.add(cb);
  ensureSettingsListener();
  if (hasSettingsHydrated) cb(settingsCache);
  return () => {
    settingsListeners.delete(cb);
    if (settingsListeners.size === 0) {
      resetResilientRetry('caisse_settings');
      if (settingsUnsub) {
        settingsUnsub();
        settingsUnsub = null;
      }
      if (settingsRefreshUnsub) {
        settingsRefreshUnsub();
        settingsRefreshUnsub = null;
      }
      hasSettingsHydrated = false;
    }
  };
}

export function useCaisseSettings(): Record<string, CaisseBarberSetting> {
  const [map, setMap] = useState<Record<string, CaisseBarberSetting>>(settingsCache);
  useEffect(() => subscribeToCaisseSettings(setMap), []);
  return map;
}

let settlementsCache: Record<string, CaisseDailySettlement> = {};
let hasSettlementsHydrated = false;
const settlementsListeners = new Set<(map: Record<string, CaisseDailySettlement>) => void>();
let settlementsUnsub: (() => void) | null = null;
let settlementsRefreshUnsub: (() => void) | null = null;

function notifySettlementsListeners() {
  settlementsListeners.forEach((cb) => {
    try {
      cb(settlementsCache);
    } catch (err) {
      console.warn('Caisse settlements listener callback error:', err);
    }
  });
}

function ensureSettlementsListener() {
  if (!settlementsRefreshUnsub) {
    settlementsRefreshUnsub = registerRealtimeRefreshHandler(
      'caisse_settlements',
      'caisse',
      async () => {
        if (settlementsListeners.size === 0) return;
        ensureSettlementsListener();
        try {
          const snap = await getCollectionDocsFast(CAISSE_SETTLEMENTS_COLLECTION);
          const next: Record<string, CaisseDailySettlement> = {};
          snap.docs.forEach((d) => {
            const data = d.data() as CaisseDailySettlement;
            next[d.id] = { ...data, id: data.id || d.id };
          });
          settlementsCache = next;
          hasSettlementsHydrated = true;
          notifySettlementsListeners();
        } catch (err) {
          console.warn('Caisse settlements wake refresh warning:', err);
        }
      }
    );
  }
  if (settlementsUnsub) return;

  settlementsUnsub = onSnapshot(
    collection(db, CAISSE_SETTLEMENTS_COLLECTION),
    (snapshot) => {
      resetResilientRetry('caisse_settlements');
      const next: Record<string, CaisseDailySettlement> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as CaisseDailySettlement;
        next[d.id] = { ...data, id: data.id || d.id };
      });
      settlementsCache = next;
      hasSettlementsHydrated = true;
      notifySettlementsListeners();
    },
    (error) => {
      if (settlementsUnsub) {
        try {
          settlementsUnsub();
        } catch {
          // Ignore
        }
        settlementsUnsub = null;
      }
      scheduleResilientRetry(
        'caisse_settlements',
        () => settlementsListeners.size > 0,
        () => ensureSettlementsListener(),
        error
      );
    }
  );
}

export function subscribeToCaisseSettlements(
  cb: (map: Record<string, CaisseDailySettlement>) => void
): () => void {
  settlementsListeners.add(cb);
  ensureSettlementsListener();
  if (hasSettlementsHydrated) cb(settlementsCache);
  return () => {
    settlementsListeners.delete(cb);
    if (settlementsListeners.size === 0) {
      resetResilientRetry('caisse_settlements');
      if (settlementsUnsub) {
        settlementsUnsub();
        settlementsUnsub = null;
      }
      if (settlementsRefreshUnsub) {
        settlementsRefreshUnsub();
        settlementsRefreshUnsub = null;
      }
      hasSettlementsHydrated = false;
    }
  };
}

export function useCaisseSettlements(): Record<string, CaisseDailySettlement> {
  const [map, setMap] = useState<Record<string, CaisseDailySettlement>>(settlementsCache);
  useEffect(() => subscribeToCaisseSettlements(setMap), []);
  return map;
}

// ---------- Cumulative Cycle Settlements & 03:00 AM Daily Archives ----------

let cyclesCache: CaisseCycleSettlement[] = [];
let hasCyclesHydrated = false;
const cyclesListeners = new Set<(cycles: CaisseCycleSettlement[]) => void>();
let cyclesUnsub: (() => void) | null = null;
let cyclesRefreshUnsub: (() => void) | null = null;

function notifyCyclesListeners() {
  cyclesListeners.forEach((cb) => {
    try {
      cb(cyclesCache);
    } catch (err) {
      console.warn('Caisse cycles listener callback error:', err);
    }
  });
}

function ensureCyclesListener() {
  if (!cyclesRefreshUnsub) {
    cyclesRefreshUnsub = registerRealtimeRefreshHandler(
      'caisse_cycles',
      'caisse',
      async () => {
        if (cyclesListeners.size === 0) return;
        ensureCyclesListener();
        try {
          const snap = await getCollectionDocsFast(CAISSE_CYCLES_COLLECTION);
          cyclesCache = sortCaisseCyclesDesc(
            snap.docs.map((d) => ({
              ...(d.data() as CaisseCycleSettlement),
              id: (d.data() as CaisseCycleSettlement).id || d.id,
            }))
          );
          hasCyclesHydrated = true;
          notifyCyclesListeners();
        } catch (err) {
          console.warn('Caisse cycles wake refresh warning:', err);
        }
      }
    );
  }
  if (cyclesUnsub) return;

  cyclesUnsub = onSnapshot(
    collection(db, CAISSE_CYCLES_COLLECTION),
    (snapshot) => {
      resetResilientRetry('caisse_cycles');
      cyclesCache = sortCaisseCyclesDesc(
        snapshot.docs.map((d) => ({
          ...(d.data() as CaisseCycleSettlement),
          id: (d.data() as CaisseCycleSettlement).id || d.id,
        }))
      );
      hasCyclesHydrated = true;
      notifyCyclesListeners();
    },
    (error) => {
      if (cyclesUnsub) {
        try {
          cyclesUnsub();
        } catch {
          // Ignore
        }
        cyclesUnsub = null;
      }
      scheduleResilientRetry(
        'caisse_cycles',
        () => cyclesListeners.size > 0,
        () => ensureCyclesListener(),
        error
      );
    }
  );
}

export function subscribeToCaisseCycles(
  cb: (cycles: CaisseCycleSettlement[]) => void
): () => void {
  cyclesListeners.add(cb);
  ensureCyclesListener();
  if (hasCyclesHydrated) cb(cyclesCache);
  return () => {
    cyclesListeners.delete(cb);
    if (cyclesListeners.size === 0) {
      resetResilientRetry('caisse_cycles');
      if (cyclesUnsub) {
        cyclesUnsub();
        cyclesUnsub = null;
      }
      if (cyclesRefreshUnsub) {
        cyclesRefreshUnsub();
        cyclesRefreshUnsub = null;
      }
      hasCyclesHydrated = false;
    }
  };
}

export function useCaisseCycles(): CaisseCycleSettlement[] {
  const [cycles, setCycles] = useState<CaisseCycleSettlement[]>(cyclesCache);
  useEffect(() => subscribeToCaisseCycles(setCycles), []);
  return cycles;
}

let archivesCache: Record<string, CaisseDailyArchive> = {};
let hasArchivesHydrated = false;
const archivesListeners = new Set<(map: Record<string, CaisseDailyArchive>) => void>();
let archivesUnsub: (() => void) | null = null;
let archivesRefreshUnsub: (() => void) | null = null;

function notifyArchivesListeners() {
  archivesListeners.forEach((cb) => {
    try {
      cb(archivesCache);
    } catch (err) {
      console.warn('Caisse archives listener callback error:', err);
    }
  });
}

function ensureArchivesListener() {
  if (!archivesRefreshUnsub) {
    archivesRefreshUnsub = registerRealtimeRefreshHandler(
      'caisse_archives',
      'caisse',
      async () => {
        if (archivesListeners.size === 0) return;
        ensureArchivesListener();
        try {
          const snap = await getCollectionDocsFast(CAISSE_ARCHIVES_COLLECTION);
          const next: Record<string, CaisseDailyArchive> = {};
          snap.docs.forEach((d) => {
            const data = d.data() as CaisseDailyArchive;
            next[d.id] = { ...data, id: data.id || d.id };
          });
          archivesCache = next;
          hasArchivesHydrated = true;
          notifyArchivesListeners();
        } catch (err) {
          console.warn('Caisse archives wake refresh warning:', err);
        }
      }
    );
  }
  if (archivesUnsub) return;

  archivesUnsub = onSnapshot(
    collection(db, CAISSE_ARCHIVES_COLLECTION),
    (snapshot) => {
      resetResilientRetry('caisse_archives');
      const next: Record<string, CaisseDailyArchive> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as CaisseDailyArchive;
        next[d.id] = { ...data, id: data.id || d.id };
      });
      archivesCache = next;
      hasArchivesHydrated = true;
      notifyArchivesListeners();
    },
    (error) => {
      if (archivesUnsub) {
        try {
          archivesUnsub();
        } catch {
          // Ignore
        }
        archivesUnsub = null;
      }
      scheduleResilientRetry(
        'caisse_archives',
        () => archivesListeners.size > 0,
        () => ensureArchivesListener(),
        error
      );
    }
  );
}

export function subscribeToCaisseArchives(
  cb: (map: Record<string, CaisseDailyArchive>) => void
): () => void {
  archivesListeners.add(cb);
  ensureArchivesListener();
  if (hasArchivesHydrated) cb(archivesCache);
  return () => {
    archivesListeners.delete(cb);
    if (archivesListeners.size === 0) {
      resetResilientRetry('caisse_archives');
      if (archivesUnsub) {
        archivesUnsub();
        archivesUnsub = null;
      }
      if (archivesRefreshUnsub) {
        archivesRefreshUnsub();
        archivesRefreshUnsub = null;
      }
      hasArchivesHydrated = false;
    }
  };
}

export function useCaisseArchives(): Record<string, CaisseDailyArchive> {
  const [map, setMap] = useState<Record<string, CaisseDailyArchive>>(archivesCache);
  useEffect(() => subscribeToCaisseArchives(setMap), []);
  return map;
}

// ---------- Daily Per-Barber Master Notes & Barber Replies ----------

let dailyNotesCache: Record<string, BarberDailyNote> = {};
let hasDailyNotesHydrated = false;
const dailyNotesListeners = new Set<(map: Record<string, BarberDailyNote>) => void>();
let dailyNotesUnsub: (() => void) | null = null;
let dailyNotesRefreshUnsub: (() => void) | null = null;

function notifyDailyNotesListeners() {
  dailyNotesListeners.forEach((cb) => {
    try {
      cb(dailyNotesCache);
    } catch (err) {
      console.warn('Daily notes listener callback error:', err);
    }
  });
}

function ensureDailyNotesListener() {
  if (!dailyNotesRefreshUnsub) {
    dailyNotesRefreshUnsub = registerRealtimeRefreshHandler(
      'caisse_daily_notes',
      'caisse',
      async () => {
        if (dailyNotesListeners.size === 0) return;
        ensureDailyNotesListener();
        try {
          const snap = await getCollectionDocsFast(BARBER_DAILY_NOTES_COLLECTION);
          const next: Record<string, BarberDailyNote> = {};
          snap.docs.forEach((d) => {
            const data = d.data() as BarberDailyNote;
            next[d.id] = { ...data, id: data.id || d.id };
          });
          dailyNotesCache = next;
          hasDailyNotesHydrated = true;
          notifyDailyNotesListeners();
        } catch (err) {
          console.warn('Barber daily notes wake refresh warning:', err);
        }
      }
    );
  }
  if (dailyNotesUnsub) return;

  dailyNotesUnsub = onSnapshot(
    collection(db, BARBER_DAILY_NOTES_COLLECTION),
    (snapshot) => {
      resetResilientRetry('caisse_daily_notes');
      const next: Record<string, BarberDailyNote> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as BarberDailyNote;
        next[d.id] = { ...data, id: data.id || d.id };
      });
      dailyNotesCache = next;
      hasDailyNotesHydrated = true;
      notifyDailyNotesListeners();
    },
    (error) => {
      if (dailyNotesUnsub) {
        try {
          dailyNotesUnsub();
        } catch {
          // Ignore
        }
        dailyNotesUnsub = null;
      }
      scheduleResilientRetry(
        'caisse_daily_notes',
        () => dailyNotesListeners.size > 0,
        () => ensureDailyNotesListener(),
        error
      );
    }
  );
}

export function subscribeToBarberDailyNotes(
  cb: (map: Record<string, BarberDailyNote>) => void
): () => void {
  dailyNotesListeners.add(cb);
  ensureDailyNotesListener();
  if (hasDailyNotesHydrated) cb(dailyNotesCache);
  return () => {
    dailyNotesListeners.delete(cb);
    if (dailyNotesListeners.size === 0) {
      resetResilientRetry('caisse_daily_notes');
      if (dailyNotesUnsub) {
        dailyNotesUnsub();
        dailyNotesUnsub = null;
      }
      if (dailyNotesRefreshUnsub) {
        dailyNotesRefreshUnsub();
        dailyNotesRefreshUnsub = null;
      }
      hasDailyNotesHydrated = false;
    }
  };
}

export function useBarberDailyNotes(): Record<string, BarberDailyNote> {
  const [map, setMap] = useState<Record<string, BarberDailyNote>>(dailyNotesCache);
  useEffect(() => subscribeToBarberDailyNotes(setMap), []);
  return map;
}

export async function saveMasterDailyBarberNote(params: {
  barberId: CaisseBarberId;
  barberName: string;
  date: string;
  masterNote: string;
  masterUpdatedBy: string;
  existingNote?: BarberDailyNote;
}): Promise<BarberDailyNote> {
  const cleanDate = String(params.date || getSalonBusinessDate()).slice(0, 20);
  const id = `${params.barberId}_${cleanDate}`;
  const nowIso = new Date().toISOString().slice(0, 64);

  const payload: BarberDailyNote = {
    id,
    barberId: params.barberId,
    barberName: (params.existingNote?.barberName || params.barberName || params.barberId)
      .trim()
      .slice(0, 100),
    date: cleanDate,
    masterNote: params.masterNote.trim().slice(0, 600),
    masterUpdatedBy: String(params.masterUpdatedBy || 'Hassan ait boumlik').trim().slice(0, 100),
    masterUpdatedAt: nowIso,
    createdAt: params.existingNote?.createdAt || nowIso,
    updatedAt: nowIso,
  };

  if (params.existingNote?.barberReply !== undefined) {
    payload.barberReply = params.existingNote.barberReply;
  }
  if (params.existingNote?.barberRepliedBy) {
    payload.barberRepliedBy = params.existingNote.barberRepliedBy;
  }
  if (params.existingNote?.barberRepliedAt) {
    payload.barberRepliedAt = params.existingNote.barberRepliedAt;
  }

  const path = `${BARBER_DAILY_NOTES_COLLECTION}/${id}`;
  try {
    await setDoc(doc(db, BARBER_DAILY_NOTES_COLLECTION, id), payload);
    dailyNotesCache = { ...dailyNotesCache, [id]: payload };
    notifyDailyNotesListeners();
    emitRealtimeSyncHint('caisse');
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveBarberDailyNoteReply(params: {
  barberId: CaisseBarberId;
  barberName: string;
  date: string;
  barberReply: string;
  barberRepliedBy: string;
  existingNote?: BarberDailyNote;
}): Promise<BarberDailyNote> {
  const cleanDate = String(params.date || getSalonBusinessDate()).slice(0, 20);
  const id = `${params.barberId}_${cleanDate}`;
  const nowIso = new Date().toISOString().slice(0, 64);

  const payload: BarberDailyNote = {
    id,
    barberId: params.barberId,
    barberName: (params.existingNote?.barberName || params.barberName || params.barberId)
      .trim()
      .slice(0, 100),
    date: cleanDate,
    masterNote: params.existingNote?.masterNote ?? '',
    masterUpdatedBy: params.existingNote?.masterUpdatedBy || 'Hassan ait boumlik',
    masterUpdatedAt: params.existingNote?.masterUpdatedAt || nowIso,
    barberReply: params.barberReply.trim().slice(0, 600),
    barberRepliedBy: String(params.barberRepliedBy || params.barberName).trim().slice(0, 100),
    barberRepliedAt: nowIso,
    createdAt: params.existingNote?.createdAt || nowIso,
    updatedAt: nowIso,
  };

  const path = `${BARBER_DAILY_NOTES_COLLECTION}/${id}`;
  try {
    await setDoc(doc(db, BARBER_DAILY_NOTES_COLLECTION, id), payload);
    dailyNotesCache = { ...dailyNotesCache, [id]: payload };
    notifyDailyNotesListeners();
    emitRealtimeSyncHint('caisse');
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ---------- Sanitized Firestore Write Operations ----------

export interface CreateCaisseEntryInput {
  barberId: CaisseBarberId;
  barberName?: string;
  type: CaisseEntryType;
  date: string;
  serviceIds?: string[];
  serviceNames?: string[];
  expectedAmountMAD: number;
  amountPaidMAD: number;
  creditAmountMAD?: number;
  creditRemainingMAD?: number;
  creditStatus?: CaisseCreditStatus;
  clientName?: string;
  clientPhone?: string;
  expectedRepaymentDate?: string;
  repaidDate?: string;
  repaidAmountMAD?: number;
  parentCreditEntryId?: string;
  sourceBookingId?: string;
  sourceTicketNumber?: string;
  note?: string;
  createdByRole: StaffRole;
  createdByName: string;
}

export async function addCaisseEntry(input: CreateCaisseEntryInput): Promise<CaisseEntry> {
  const nowIso = new Date().toISOString().slice(0, 64);
  const rand = Math.random().toString(36).slice(2, 7);
  const id = sanitizeId(`ce_${Date.now()}_${rand}`, 'ce');
  const meta = getCaisseBarberMeta(input.barberId);

  const expected = clampAmount(input.expectedAmountMAD);
  const paid = clampAmount(input.amountPaidMAD);
  const creditTotal =
    input.creditAmountMAD !== undefined
      ? clampAmount(input.creditAmountMAD)
      : input.type === 'income' && expected > paid
      ? clampAmount(expected - paid)
      : 0;
  const creditRemaining =
    input.creditRemainingMAD !== undefined
      ? clampAmount(input.creditRemainingMAD)
      : creditTotal;
  const creditStatus: CaisseCreditStatus =
    input.creditStatus ||
    (creditTotal > 0 ? (creditRemaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'open') : 'none');

  const payload: CaisseEntry = {
    id,
    barberId: input.barberId,
    barberName: (input.barberName || meta.name).trim().slice(0, 100),
    type: input.type,
    date: String(input.date || new Date().toISOString().split('T')[0]).slice(0, 20),
    expectedAmountMAD: expected,
    amountPaidMAD: paid,
    creditAmountMAD: creditTotal,
    creditRemainingMAD: creditRemaining,
    creditStatus,
    createdByRole: input.createdByRole,
    createdByName: String(input.createdByName || meta.name).trim().slice(0, 100),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (Array.isArray(input.serviceIds) && input.serviceIds.length > 0) {
    payload.serviceIds = input.serviceIds.slice(0, 20).map((s) => String(s).slice(0, 64));
  }
  if (Array.isArray(input.serviceNames) && input.serviceNames.length > 0) {
    payload.serviceNames = input.serviceNames.slice(0, 20).map((s) => String(s).slice(0, 100));
  }
  if (input.clientName && input.clientName.trim()) {
    payload.clientName = input.clientName.trim().slice(0, 120);
  }
  if (input.clientPhone && input.clientPhone.trim()) {
    payload.clientPhone = input.clientPhone.trim().slice(0, 40);
  }
  if (input.expectedRepaymentDate && input.expectedRepaymentDate.trim()) {
    payload.expectedRepaymentDate = input.expectedRepaymentDate.trim().slice(0, 20);
  }
  if (input.repaidDate && input.repaidDate.trim()) {
    payload.repaidDate = input.repaidDate.trim().slice(0, 20);
  }
  if (typeof input.repaidAmountMAD === 'number' && Number.isFinite(input.repaidAmountMAD)) {
    payload.repaidAmountMAD = clampAmount(input.repaidAmountMAD);
  }
  if (input.parentCreditEntryId && input.parentCreditEntryId.trim()) {
    payload.parentCreditEntryId = input.parentCreditEntryId.trim().slice(0, 128);
  }
  if (input.sourceBookingId && input.sourceBookingId.trim()) {
    payload.sourceBookingId = input.sourceBookingId.trim().slice(0, 128);
  }
  if (input.sourceTicketNumber && input.sourceTicketNumber.trim()) {
    payload.sourceTicketNumber = input.sourceTicketNumber.trim().slice(0, 32);
  }
  if (input.note && input.note.trim()) {
    payload.note = input.note.trim().slice(0, 400);
  }

  const path = `${CAISSE_ENTRIES_COLLECTION}/${id}`;
  try {
    await setDoc(doc(db, CAISSE_ENTRIES_COLLECTION, id), payload);
    entriesCache = sortCaisseEntriesDesc([
      payload,
      ...entriesCache.filter((item) => item.id !== id),
    ]);
    notifyEntriesListeners();
    emitRealtimeSyncHint('caisse');
    if (creditRemaining > 0) emitRealtimeSyncHint('credits');
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export interface UpdateCaisseEntryPatch {
  barberId?: CaisseBarberId;
  barberName?: string;
  type?: CaisseEntryType;
  date?: string;
  serviceIds?: string[];
  serviceNames?: string[];
  expectedAmountMAD?: number;
  amountPaidMAD?: number;
  creditAmountMAD?: number;
  creditRemainingMAD?: number;
  creditStatus?: CaisseCreditStatus;
  clientName?: string;
  clientPhone?: string;
  expectedRepaymentDate?: string;
  repaidDate?: string;
  repaidAmountMAD?: number;
  note?: string;
}

export async function updateCaisseEntry(
  entryId: string,
  patch: UpdateCaisseEntryPatch
): Promise<void> {
  const path = `${CAISSE_ENTRIES_COLLECTION}/${entryId}`;
  try {
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date().toISOString().slice(0, 64),
    };

    if (patch.barberId !== undefined) {
      updatePayload.barberId = patch.barberId;
      updatePayload.barberName = (
        patch.barberName || getCaisseBarberMeta(patch.barberId).name
      )
        .trim()
        .slice(0, 100);
    } else if (patch.barberName !== undefined) {
      updatePayload.barberName = patch.barberName.trim().slice(0, 100);
    }

    if (patch.type !== undefined) updatePayload.type = patch.type;
    if (patch.date !== undefined) updatePayload.date = String(patch.date).slice(0, 20);
    if (patch.serviceIds !== undefined) {
      updatePayload.serviceIds = patch.serviceIds.slice(0, 20).map((s) => String(s).slice(0, 64));
    }
    if (patch.serviceNames !== undefined) {
      updatePayload.serviceNames = patch.serviceNames
        .slice(0, 20)
        .map((s) => String(s).slice(0, 100));
    }
    if (patch.expectedAmountMAD !== undefined) {
      updatePayload.expectedAmountMAD = clampAmount(patch.expectedAmountMAD);
    }
    if (patch.amountPaidMAD !== undefined) {
      updatePayload.amountPaidMAD = clampAmount(patch.amountPaidMAD);
    }
    if (patch.creditAmountMAD !== undefined) {
      updatePayload.creditAmountMAD = clampAmount(patch.creditAmountMAD);
    }
    if (patch.creditRemainingMAD !== undefined) {
      updatePayload.creditRemainingMAD = clampAmount(patch.creditRemainingMAD);
    }
    if (patch.creditStatus !== undefined) {
      updatePayload.creditStatus = patch.creditStatus;
    }
    if (patch.clientName !== undefined) {
      updatePayload.clientName = patch.clientName.trim()
        ? patch.clientName.trim().slice(0, 120)
        : deleteField();
    }
    if (patch.clientPhone !== undefined) {
      updatePayload.clientPhone = patch.clientPhone.trim()
        ? patch.clientPhone.trim().slice(0, 40)
        : deleteField();
    }
    if (patch.expectedRepaymentDate !== undefined) {
      updatePayload.expectedRepaymentDate = patch.expectedRepaymentDate.trim()
        ? patch.expectedRepaymentDate.trim().slice(0, 20)
        : deleteField();
    }
    if (patch.repaidDate !== undefined) {
      updatePayload.repaidDate = patch.repaidDate.trim()
        ? patch.repaidDate.trim().slice(0, 20)
        : deleteField();
    }
    if (patch.repaidAmountMAD !== undefined) {
      updatePayload.repaidAmountMAD = clampAmount(patch.repaidAmountMAD);
    }
    if (patch.note !== undefined) {
      updatePayload.note = patch.note.trim() ? patch.note.trim().slice(0, 400) : deleteField();
    }

    await updateDoc(doc(db, CAISSE_ENTRIES_COLLECTION, entryId), updatePayload);
    entriesCache = sortCaisseEntriesDesc(
      entriesCache.map((item) => {
        if (item.id !== entryId) return item;
        const merged: CaisseEntry = {
          ...item,
          updatedAt: String(updatePayload.updatedAt),
        };
        if (patch.barberId !== undefined) {
          merged.barberId = patch.barberId;
          merged.barberName = String(updatePayload.barberName || item.barberName);
        } else if (patch.barberName !== undefined) {
          merged.barberName = String(updatePayload.barberName || item.barberName);
        }
        if (patch.type !== undefined) merged.type = patch.type;
        if (patch.date !== undefined) merged.date = String(updatePayload.date);
        if (patch.serviceIds !== undefined) merged.serviceIds = updatePayload.serviceIds as string[];
        if (patch.serviceNames !== undefined) merged.serviceNames = updatePayload.serviceNames as string[];
        if (patch.expectedAmountMAD !== undefined) merged.expectedAmountMAD = Number(updatePayload.expectedAmountMAD);
        if (patch.amountPaidMAD !== undefined) merged.amountPaidMAD = Number(updatePayload.amountPaidMAD);
        if (patch.creditAmountMAD !== undefined) merged.creditAmountMAD = Number(updatePayload.creditAmountMAD);
        if (patch.creditRemainingMAD !== undefined) merged.creditRemainingMAD = Number(updatePayload.creditRemainingMAD);
        if (patch.creditStatus !== undefined) merged.creditStatus = patch.creditStatus;
        if (patch.clientName !== undefined) {
          merged.clientName = patch.clientName.trim() ? patch.clientName.trim().slice(0, 120) : undefined;
        }
        if (patch.clientPhone !== undefined) {
          merged.clientPhone = patch.clientPhone.trim() ? patch.clientPhone.trim().slice(0, 40) : undefined;
        }
        if (patch.expectedRepaymentDate !== undefined) {
          merged.expectedRepaymentDate = patch.expectedRepaymentDate.trim() ? patch.expectedRepaymentDate.trim().slice(0, 20) : undefined;
        }
        if (patch.repaidDate !== undefined) {
          merged.repaidDate = patch.repaidDate.trim() ? patch.repaidDate.trim().slice(0, 20) : undefined;
        }
        if (patch.repaidAmountMAD !== undefined) merged.repaidAmountMAD = Number(updatePayload.repaidAmountMAD);
        if (patch.note !== undefined) {
          merged.note = patch.note.trim() ? patch.note.trim().slice(0, 400) : undefined;
        }
        return merged;
      })
    );
    notifyEntriesListeners();
    emitRealtimeSyncHint('caisse');
    emitRealtimeSyncHint('credits');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCaisseEntry(entryId: string): Promise<void> {
  const path = `${CAISSE_ENTRIES_COLLECTION}/${entryId}`;
  try {
    await deleteDoc(doc(db, CAISSE_ENTRIES_COLLECTION, entryId));
    entriesCache = entriesCache.filter((item) => item.id !== entryId);
    notifyEntriesListeners();
    emitRealtimeSyncHint('caisse');
    emitRealtimeSyncHint('credits');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Records repayment of an existing barber/shop credit atomically via writeBatch:
 * 1) Updates remaining credit & status on the original credit document (never altering original day cash).
 * 2) Adds a new `credit_repayment` entry on `repaidDate` so cash enters THAT repayment day's Caisse!
 */
export async function recordCaisseCreditRepayment(params: {
  creditEntry: CaisseEntry;
  amountRepaidMAD: number;
  repaidDate: string;
  actorRole: StaffRole;
  actorName: string;
  note?: string;
}): Promise<CaisseEntry> {
  const { creditEntry, amountRepaidMAD, repaidDate, actorRole, actorName, note } = params;
  const applied = Math.min(
    clampAmount(creditEntry.creditRemainingMAD),
    clampAmount(amountRepaidMAD)
  );
  if (applied <= 0) {
    throw new Error('المبلغ المؤدى يجب أن يكون أكبر من 0 درهم.');
  }

  const nowIso = new Date().toISOString().slice(0, 64);
  const nextRemaining = clampAmount(creditEntry.creditRemainingMAD - applied);
  const nextStatus: CaisseCreditStatus = nextRemaining <= 0 ? 'paid' : 'partial';
  const prevRepaidTotal = clampAmount(creditEntry.repaidAmountMAD || 0);

  const serviceDesc =
    creditEntry.serviceNames && creditEntry.serviceNames.length > 0
      ? creditEntry.serviceNames.join(' + ')
      : 'سداد دين خدمة';

  const repaymentId = sanitizeId(
    `ce_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    'ce'
  );
  const meta = getCaisseBarberMeta(creditEntry.barberId);
  const repaymentPayload: CaisseEntry = {
    id: repaymentId,
    barberId: creditEntry.barberId,
    barberName: (creditEntry.barberName || meta.name).trim().slice(0, 100),
    type: 'credit_repayment',
    date: String(repaidDate || getSalonBusinessDate()).slice(0, 20),
    expectedAmountMAD: applied,
    amountPaidMAD: applied,
    creditAmountMAD: 0,
    creditRemainingMAD: 0,
    creditStatus: 'none',
    parentCreditEntryId: creditEntry.id,
    repaidDate: String(repaidDate || getSalonBusinessDate()).slice(0, 20),
    repaidAmountMAD: applied,
    note: (
      note?.trim() ||
      `أداء كريدي (${creditEntry.clientName || 'زبون'}) • ${serviceDesc} • أصل الدين يوم ${creditEntry.date}`
    ).slice(0, 400),
    createdByRole: actorRole,
    createdByName: String(actorName || meta.name).trim().slice(0, 100),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (creditEntry.serviceIds && creditEntry.serviceIds.length > 0) {
    repaymentPayload.serviceIds = creditEntry.serviceIds.slice(0, 20);
  }
  if (creditEntry.serviceNames && creditEntry.serviceNames.length > 0) {
    repaymentPayload.serviceNames = creditEntry.serviceNames.slice(0, 20);
  }
  if (creditEntry.clientName && creditEntry.clientName.trim()) {
    repaymentPayload.clientName = creditEntry.clientName.trim().slice(0, 120);
  }
  if (creditEntry.clientPhone && creditEntry.clientPhone.trim()) {
    repaymentPayload.clientPhone = creditEntry.clientPhone.trim().slice(0, 40);
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, CAISSE_ENTRIES_COLLECTION, creditEntry.id), {
      creditRemainingMAD: nextRemaining,
      creditStatus: nextStatus,
      repaidDate: String(repaidDate || getSalonBusinessDate()).slice(0, 20),
      repaidAmountMAD: clampAmount(prevRepaidTotal + applied),
      updatedAt: nowIso,
    });
    batch.set(doc(db, CAISSE_ENTRIES_COLLECTION, repaymentId), repaymentPayload);
    await batch.commit();
    const repaidDateClean = String(repaidDate || getSalonBusinessDate()).slice(0, 20);
    entriesCache = sortCaisseEntriesDesc([
      repaymentPayload,
      ...entriesCache.map((item) =>
        item.id === creditEntry.id
          ? {
              ...item,
              creditRemainingMAD: nextRemaining,
              creditStatus: nextStatus,
              repaidDate: repaidDateClean,
              repaidAmountMAD: clampAmount(prevRepaidTotal + applied),
              updatedAt: nowIso,
            }
          : item
      ),
    ]);
    notifyEntriesListeners();
    emitRealtimeSyncHint('caisse');
    emitRealtimeSyncHint('credits');
    return repaymentPayload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${CAISSE_ENTRIES_COLLECTION}/${creditEntry.id}`);
  }
}

function sanitizePeriodOverrides(
  overrides: CommissionPeriodOverride[] | undefined
): CommissionPeriodOverride[] {
  return (Array.isArray(overrides) ? overrides : [])
    .slice(0, 24)
    .map((o, idx) => {
      const clean: CommissionPeriodOverride = {
        id: sanitizeId(o.id || `cpo_${idx + 1}`, 'cpo'),
        scope: o.scope === 'month' ? 'month' : 'date_range',
        commissionPercent: Math.max(0, Math.min(100, Math.round(Number(o.commissionPercent) || 50))),
      };
      if (o.label && o.label.trim()) clean.label = o.label.trim().slice(0, 80);
      if (clean.scope === 'month' && o.month) clean.month = String(o.month).slice(0, 7);
      if (clean.scope === 'date_range') {
        if (o.startDate) clean.startDate = String(o.startDate).slice(0, 10);
        if (o.endDate || o.startDate) {
          clean.endDate = String(o.endDate || o.startDate).slice(0, 10);
        }
      }
      return clean;
    })
    .filter((o) => (o.scope === 'month' ? Boolean(o.month) : Boolean(o.startDate)));
}

export async function updateBarberCommissionPercent(
  barberId: CaisseBarberId,
  commissionPercent: number,
  updatedBy: string,
  periodOverrides?: CommissionPeriodOverride[]
): Promise<CaisseBarberSetting> {
  const pct = Math.max(0, Math.min(100, Math.round(commissionPercent)));
  const cleanOverrides = sanitizePeriodOverrides(
    periodOverrides !== undefined ? periodOverrides : settingsCache[barberId]?.periodOverrides
  );
  const setting: CaisseBarberSetting = {
    id: barberId,
    barberId,
    commissionPercent: pct,
    updatedBy: String(updatedBy || 'Hassan ait boumlik').trim().slice(0, 100),
    updatedAt: new Date().toISOString().slice(0, 64),
  };
  if (cleanOverrides.length > 0) {
    setting.periodOverrides = cleanOverrides;
  }
  const path = `${CAISSE_SETTINGS_COLLECTION}/${barberId}`;
  try {
    await setDoc(doc(db, CAISSE_SETTINGS_COLLECTION, barberId), setting);
    settingsCache = { ...settingsCache, [barberId]: setting };
    notifySettingsListeners();
    emitRealtimeSyncHint('caisse');
    return setting;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveDailySettlement(params: {
  barberId: CaisseBarberId;
  barberName: string;
  date: string;
  collected: boolean;
  collectedAmountMAD: number;
  barberShareMAD: number;
  shopShareMAD: number;
  floatMAD: number;
  expensesMAD: number;
  carryOverOwedMAD: number;
  resetCount: number;
  intakeClosed?: boolean;
  grossIntakeClosedMAD?: number;
  settlementMode?: 'daily_intake' | 'daily_share';
  note?: string;
  confirmedBy: string;
  confirmedAtOverride?: string;
}): Promise<CaisseDailySettlement> {
  const id = sanitizeId(`${params.barberId}_${params.date}`, 'cs');
  const nowIso = new Date().toISOString().slice(0, 64);
  const confirmedAtIso =
    params.confirmedAtOverride && params.confirmedAtOverride > nowIso
      ? params.confirmedAtOverride.slice(0, 64)
      : nowIso;
  const payload: CaisseDailySettlement = {
    id,
    barberId: params.barberId,
    barberName: String(params.barberName).trim().slice(0, 100),
    date: String(params.date).slice(0, 20),
    collected: Boolean(params.collected),
    collectedAmountMAD: clampAmount(params.collectedAmountMAD),
    barberShareMAD: clampAmount(params.barberShareMAD),
    shopShareMAD: clampAmount(params.shopShareMAD),
    floatMAD: clampAmount(params.floatMAD),
    expensesMAD: clampAmount(params.expensesMAD),
    carryOverOwedMAD: clampAmount(params.carryOverOwedMAD),
    resetCount: Math.max(0, Math.min(1000, Math.round(params.resetCount))),
    confirmedBy: String(params.confirmedBy || 'Hassan ait boumlik').trim().slice(0, 100),
    confirmedAt: confirmedAtIso,
    updatedAt: confirmedAtIso,
  };
  if (params.intakeClosed !== undefined) {
    payload.intakeClosed = Boolean(params.intakeClosed);
  }
  if (params.grossIntakeClosedMAD !== undefined) {
    payload.grossIntakeClosedMAD = clampAmount(params.grossIntakeClosedMAD);
  }
  if (params.settlementMode) {
    payload.settlementMode = params.settlementMode;
  }
  if (params.note && params.note.trim()) {
    payload.note = params.note.trim().slice(0, 400);
  }
  const path = `${CAISSE_SETTLEMENTS_COLLECTION}/${id}`;
  try {
    await setDoc(doc(db, CAISSE_SETTLEMENTS_COLLECTION, id), payload);
    settlementsCache = { ...settlementsCache, [id]: payload };
    notifySettlementsListeners();
    emitRealtimeSyncHint('caisse');
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function findBarberDaySettlement(
  barberId: CaisseBarberId,
  date: string,
  settlementsMap?: Record<string, CaisseDailySettlement>,
  rosterMembers?: RosterMemberAccount[]
): CaisseDailySettlement | undefined {
  if (!settlementsMap) return undefined;
  const direct = settlementsMap[`${barberId}_${date}`];
  if (direct) return direct;
  const sanitized = settlementsMap[sanitizeId(`${barberId}_${date}`, 'cs')];
  if (sanitized) return sanitized;
  return Object.values(settlementsMap).find(
    (s) =>
      s.date === date &&
      matchesCaisseBarber(s.barberId, s.barberName, barberId, rosterMembers)
  );
}

/**
 * Closes a specific day for a barber based on gross intake ("اللي دخل كل حلاق"),
 * resetting the daily drawer & daily figures cleanly to 0 without erasing
 * monthly / cumulative balance owed ("شحال كيتسال هو").
 */
export async function closeBarberDayIntake(params: {
  barberId: CaisseBarberId;
  barberName: string;
  date: string;
  dayStats: BarberDayStats;
  carryOverOwedMAD: number;
  confirmedBy: string;
  existingSettlement?: CaisseDailySettlement;
  maxEntryCreatedAt?: string;
  note?: string;
}): Promise<CaisseDailySettlement> {
  return saveDailySettlement({
    barberId: params.barberId,
    barberName: params.barberName,
    date: params.date,
    collected: Boolean(params.existingSettlement?.collected),
    collectedAmountMAD: params.existingSettlement?.collectedAmountMAD ?? 0,
    barberShareMAD: Math.max(0, params.dayStats.barberNetShareMAD),
    shopShareMAD: Math.max(0, params.dayStats.shopShareMAD),
    floatMAD: params.dayStats.floatMAD,
    expensesMAD: params.dayStats.expensesMAD,
    carryOverOwedMAD: Math.max(0, params.carryOverOwedMAD),
    resetCount: (params.existingSettlement?.resetCount ?? 0) + 1,
    intakeClosed: true,
    grossIntakeClosedMAD: params.dayStats.incomeMAD,
    settlementMode: 'daily_intake',
    note:
      params.note?.trim() ||
      `إغلاق مداخيل اليوم (${params.dayStats.incomeMAD} MAD)`,
    confirmedBy: params.confirmedBy,
    confirmedAtOverride: params.maxEntryCreatedAt,
  });
}

/**
 * Atomically closes all unclosed barber-days through `throughDate` (including `throughDate`)
 * so the daily physical drawer resets cleanly to 0 MAD while preserving all monthly / cycle balances.
 */
export async function closeAllBarbersDailyIntakeThrough(params: {
  barbers: CaisseBarberInfo[];
  throughDate: string;
  entries: CaisseEntry[];
  settingsMap: Record<string, CaisseBarberSetting>;
  settlementsMap: Record<string, CaisseDailySettlement>;
  cycles: CaisseCycleSettlement[];
  rosterMembers?: RosterMemberAccount[];
  manualCredits?: ClientCreditRecord[];
  confirmedBy: string;
}): Promise<number> {
  const {
    barbers,
    throughDate,
    entries,
    settingsMap,
    settlementsMap,
    cycles,
    rosterMembers,
    manualCredits,
    confirmedBy,
  } = params;

  const nowIso = new Date().toISOString().slice(0, 64);
  const payloads: CaisseDailySettlement[] = [];

  for (const barber of barbers) {
    const barberEntries = entries.filter(
      (e) =>
        e.date &&
        e.date <= throughDate &&
        matchesCaisseBarber(e.barberId, e.barberName, barber.id, rosterMembers)
    );
    const candidateDates = new Set<string>(barberEntries.map((e) => e.date));
    candidateDates.add(throughDate);

    const bCycle = computeBarberCycleBalance(
      barber.id,
      entries,
      settingsMap,
      cycles,
      throughDate,
      manualCredits,
      rosterMembers
    );

    for (const date of Array.from(candidateDates).sort()) {
      const existingSettle = findBarberDaySettlement(
        barber.id,
        date,
        settlementsMap,
        rosterMembers
      );
      const closedIso = existingSettle?.intakeClosed
        ? existingSettle.confirmedAt || existingSettle.updatedAt || null
        : null;
      const dayEntries = barberEntries.filter((e) => e.date === date);
      const pendingDayEntries = dayEntries.filter(
        (e) => !closedIso || e.createdAt > closedIso
      );

      if (pendingDayEntries.length === 0) {
        if (date !== throughDate || existingSettle?.intakeClosed) continue;
        // On throughDate itself, only close if not already closed and there's activity or it's explicitly closing today
        if (dayEntries.length === 0) continue;
      }

      let maxCreatedAt = nowIso;
      for (const pe of pendingDayEntries) {
        if (pe.createdAt && pe.createdAt > maxCreatedAt) {
          maxCreatedAt = pe.createdAt.slice(0, 64);
        }
      }

      const pct = getEffectiveCommissionPercentForDate(barber.id, date, settingsMap);
      const dayStats = computeBarberDayStats(barber.id, date, entries, pct, rosterMembers);
      const id = existingSettle?.id || sanitizeId(`${barber.id}_${date}`, 'cs');

      payloads.push({
        id,
        barberId: barber.id,
        barberName: String(barber.name).trim().slice(0, 100),
        date: String(date).slice(0, 20),
        collected: Boolean(existingSettle?.collected),
        collectedAmountMAD: clampAmount(existingSettle?.collectedAmountMAD ?? 0),
        barberShareMAD: clampAmount(Math.max(0, dayStats.barberNetShareMAD)),
        shopShareMAD: clampAmount(Math.max(0, dayStats.shopShareMAD)),
        floatMAD: clampAmount(dayStats.floatMAD),
        expensesMAD: clampAmount(dayStats.expensesMAD),
        carryOverOwedMAD: clampAmount(Math.max(0, bCycle.barberNetOwedMAD)),
        resetCount: Math.max(0, Math.min(1000, (existingSettle?.resetCount ?? 0) + 1)),
        intakeClosed: true,
        grossIntakeClosedMAD: clampAmount(dayStats.incomeMAD),
        settlementMode: 'daily_intake',
        note: `إغلاق مداخيل اليوم (${dayStats.incomeMAD} MAD)`,
        confirmedBy: String(confirmedBy || 'Hassan ait boumlik').trim().slice(0, 100),
        confirmedAt: maxCreatedAt,
        updatedAt: maxCreatedAt,
      });
    }
  }

  if (payloads.length === 0) return 0;

  try {
    for (let i = 0; i < payloads.length; i += 400) {
      const chunk = payloads.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const p of chunk) {
        batch.set(doc(db, CAISSE_SETTLEMENTS_COLLECTION, p.id), p);
      }
      await batch.commit();
    }
    const nextCache = { ...settlementsCache };
    for (const p of payloads) {
      nextCache[p.id] = p;
    }
    settlementsCache = nextCache;
    notifySettlementsListeners();
    emitRealtimeSyncHint('caisse');
    return payloads.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, CAISSE_SETTLEMENTS_COLLECTION);
  }
}

// ---------- Pure Accounting & Period Rollup Selectors ----------

export function getEffectiveCommissionPercent(
  barberId: CaisseBarberId,
  settingsMap: Record<string, CaisseBarberSetting>
): number {
  const found = settingsMap[barberId];
  if (found && typeof found.commissionPercent === 'number' && Number.isFinite(found.commissionPercent)) {
    return Math.max(0, Math.min(100, found.commissionPercent));
  }
  return 50;
}

export function getEffectiveCommissionPercentForDate(
  barberId: CaisseBarberId,
  dateStr: string,
  settingsMap: Record<string, CaisseBarberSetting>
): number {
  const found = settingsMap[barberId];
  const overrides = found?.periodOverrides || [];
  if (overrides.length > 0 && dateStr) {
    for (let i = overrides.length - 1; i >= 0; i -= 1) {
      const ov = overrides[i];
      if (ov.scope === 'date_range' && ov.startDate) {
        const end = ov.endDate || ov.startDate;
        if (dateStr >= ov.startDate && dateStr <= end) {
          return Math.max(0, Math.min(100, ov.commissionPercent));
        }
      }
    }
    for (let i = overrides.length - 1; i >= 0; i -= 1) {
      const ov = overrides[i];
      if (ov.scope === 'month' && ov.month && dateStr.startsWith(ov.month)) {
        return Math.max(0, Math.min(100, ov.commissionPercent));
      }
    }
  }
  return getEffectiveCommissionPercent(barberId, settingsMap);
}

export interface BarberDayStats {
  barberId: CaisseBarberId;
  date: string;
  incomeMAD: number;
  directIncomeMAD: number;
  repaymentIncomeMAD: number;
  creditsIssuedMAD: number;
  expensesMAD: number;
  floatInMAD: number;
  floatOutMAD: number;
  floatMAD: number;
  commissionPercent: number;
  extraPercentAbove50: number;
  barberGrossShareMAD: number;
  barberNetShareMAD: number;
  shopShareMAD: number;
  drawerCashMAD: number;
  entryCount: number;
}

export function computeBarberDayStats(
  barberId: CaisseBarberId,
  date: string,
  entries: CaisseEntry[],
  commissionPercent: number,
  rosterMembers?: RosterMemberAccount[]
): BarberDayStats {
  const dayEntries = entries.filter(
    (e) =>
      e.date === date &&
      matchesCaisseBarber(e.barberId, e.barberName, barberId, rosterMembers)
  );

  let directIncomeMAD = 0;
  let repaymentIncomeMAD = 0;
  let creditsIssuedMAD = 0;
  let expensesMAD = 0;
  let floatInMAD = 0;
  let floatOutMAD = 0;

  for (const e of dayEntries) {
    if (e.type === 'income') {
      directIncomeMAD += Number(e.amountPaidMAD) || 0;
      creditsIssuedMAD += Number(e.creditAmountMAD) || 0;
    } else if (e.type === 'credit_repayment') {
      repaymentIncomeMAD += Number(e.amountPaidMAD) || 0;
    } else if (e.type === 'expense') {
      expensesMAD += Number(e.amountPaidMAD) || 0;
    } else if (e.type === 'float_adjustment') {
      floatInMAD += Number(e.amountPaidMAD) || 0;
    } else if (e.type === 'float_return') {
      floatOutMAD += Number(e.amountPaidMAD) || 0;
    }
  }

  const floatMAD = Math.round(floatInMAD - floatOutMAD);
  const incomeMAD = clampAmount(directIncomeMAD + repaymentIncomeMAD);
  const pct = Math.max(0, Math.min(100, commissionPercent));
  const barberGrossShareMAD = Math.round(incomeMAD * (pct / 100));
  const shopShareMAD = Math.max(0, Math.round(incomeMAD - barberGrossShareMAD));
  const barberNetShareMAD =
    barberId === 'hassan'
      ? Math.round(barberGrossShareMAD + floatMAD - expensesMAD)
      : Math.round(barberGrossShareMAD - expensesMAD);
  const drawerCashMAD = Math.round(incomeMAD + floatMAD - expensesMAD);

  return {
    barberId,
    date,
    incomeMAD,
    directIncomeMAD: clampAmount(directIncomeMAD),
    repaymentIncomeMAD: clampAmount(repaymentIncomeMAD),
    creditsIssuedMAD: clampAmount(creditsIssuedMAD),
    expensesMAD: clampAmount(expensesMAD),
    floatInMAD: clampAmount(floatInMAD),
    floatOutMAD: clampAmount(floatOutMAD),
    floatMAD,
    commissionPercent: pct,
    extraPercentAbove50: Math.max(0, pct - 50),
    barberGrossShareMAD,
    barberNetShareMAD,
    shopShareMAD,
    drawerCashMAD,
    entryCount: dayEntries.length,
  };
}

export interface CarryOverDayItem {
  date: string;
  barberNetShareMAD: number;
  collectedAmountMAD: number;
  owedMAD: number;
}

export interface BarberCarryOverSummary {
  barberId: CaisseBarberId;
  month: string;
  carryOverOwedMAD: number;
  unsettledDays: CarryOverDayItem[];
  isMonthEndWarning: boolean;
  daysUntilMonthEnd: number;
}

function getDaysInMonth(yearMonth: string): number {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr) || new Date().getFullYear();
  const m = Number(mStr) || new Date().getMonth() + 1;
  return new Date(y, m, 0).getDate();
}

export function computeBarberCarryOverOwed(
  barberId: CaisseBarberId,
  referenceDate: string,
  entries: CaisseEntry[],
  settingsMap: Record<string, CaisseBarberSetting>,
  settlementsMap: Record<string, CaisseDailySettlement>
): BarberCarryOverSummary {
  const month = referenceDate.slice(0, 7);

  const dateSet = new Set<string>();
  entries.forEach((e) => {
    if (e.barberId === barberId && e.date.startsWith(month) && e.date < referenceDate) {
      dateSet.add(e.date);
    }
  });
  Object.values(settlementsMap).forEach((s) => {
    if (s.barberId === barberId && s.date.startsWith(month) && s.date < referenceDate) {
      dateSet.add(s.date);
    }
  });

  const sortedDates = Array.from(dateSet).sort();
  const unsettledDays: CarryOverDayItem[] = [];
  let carryOverOwedMAD = 0;

  for (const d of sortedDates) {
    const pct = getEffectiveCommissionPercentForDate(barberId, d, settingsMap);
    const dayStats = computeBarberDayStats(barberId, d, entries, pct);
    const settlement = settlementsMap[`${barberId}_${d}`];
    if (settlement?.collected) continue;

    const alreadyPaid = Number(settlement?.collectedAmountMAD) || 0;
    const owed = Math.max(0, dayStats.barberNetShareMAD - alreadyPaid);
    if (owed > 0) {
      carryOverOwedMAD += owed;
      unsettledDays.push({
        date: d,
        barberNetShareMAD: dayStats.barberNetShareMAD,
        collectedAmountMAD: alreadyPaid,
        owedMAD: owed,
      });
    }
  }

  const daysInMonth = getDaysInMonth(month);
  const dayNum = Number(referenceDate.slice(8, 10)) || 1;
  const daysUntilMonthEnd = Math.max(0, daysInMonth - dayNum);
  const isMonthEndWarning = carryOverOwedMAD > 0 && daysUntilMonthEnd <= 3;

  return {
    barberId,
    month,
    carryOverOwedMAD: Math.round(carryOverOwedMAD),
    unsettledDays,
    isMonthEndWarning,
    daysUntilMonthEnd,
  };
}

export interface PeriodRollupSummary {
  periodIndex: 1 | 2 | 3;
  labelAr: string;
  rangeLabel: string;
  incomeMAD: number;
  expensesMAD: number;
  creditsIssuedMAD: number;
  shopShareMAD: number;
  barberSharesMAD: number;
}

export interface MonthlyBarberRollup {
  barberId: CaisseBarberId;
  barberName: string;
  arName: string;
  color: string;
  incomeMAD: number;
  repaymentIncomeMAD: number;
  creditsIssuedMAD: number;
  openCreditsMAD: number;
  expensesMAD: number;
  floatMAD: number;
  commissionPercent: number;
  extraPercentAbove50: number;
  barberGrossShareMAD: number;
  barberNetShareMAD: number;
  shopShareMAD: number;
  uncollectedOwedMAD: number;
}

export interface MonthlyCaisseRollup {
  month: string;
  periods: PeriodRollupSummary[];
  byBarber: MonthlyBarberRollup[];
  grandTotalIncomeMAD: number;
  grandTotalExpensesMAD: number;
  grandTotalShopShareMAD: number;
  grandTotalBarberSharesMAD: number;
  grandTotalOpenCreditsMAD: number;
}

export function computeMonthlyCaisseRollup(
  monthYYYYMM: string,
  entries: CaisseEntry[],
  settingsMap: Record<string, CaisseBarberSetting>,
  settlementsMap: Record<string, CaisseDailySettlement>,
  rosterMembers?: RosterMemberAccount[],
  manualCredits?: ClientCreditRecord[]
): MonthlyCaisseRollup {
  const daysInMonth = getDaysInMonth(monthYYYYMM);
  const periods: PeriodRollupSummary[] = [
    {
      periodIndex: 1,
      labelAr: 'العشرة الأولى (1 ← 10)',
      rangeLabel: `${monthYYYYMM}-01 → 10`,
      incomeMAD: 0,
      expensesMAD: 0,
      creditsIssuedMAD: 0,
      shopShareMAD: 0,
      barberSharesMAD: 0,
    },
    {
      periodIndex: 2,
      labelAr: 'العشرة الثانية (11 ← 20)',
      rangeLabel: `${monthYYYYMM}-11 → 20`,
      incomeMAD: 0,
      expensesMAD: 0,
      creditsIssuedMAD: 0,
      shopShareMAD: 0,
      barberSharesMAD: 0,
    },
    {
      periodIndex: 3,
      labelAr: `العشرة الثالثة (21 ← ${daysInMonth})`,
      rangeLabel: `${monthYYYYMM}-21 → ${daysInMonth}`,
      incomeMAD: 0,
      expensesMAD: 0,
      creditsIssuedMAD: 0,
      shopShareMAD: 0,
      barberSharesMAD: 0,
    },
  ];

  const barberList = getCaisseBarbersFromRoster(rosterMembers, entries);
  const byBarber: MonthlyBarberRollup[] = barberList.map((barber) => {
    const pct = getEffectiveCommissionPercentForDate(
      barber.id,
      `${monthYYYYMM}-15`,
      settingsMap
    );
    const barberMonthEntries = entries.filter(
      (e) =>
        e.date.startsWith(monthYYYYMM) &&
        matchesCaisseBarber(e.barberId, e.barberName, barber.id, rosterMembers)
    );

    const uniqueDates = Array.from(new Set(barberMonthEntries.map((e) => e.date))).sort();

    let incomeMAD = 0;
    let repaymentIncomeMAD = 0;
    let creditsIssuedMAD = 0;
    let expensesMAD = 0;
    let floatMAD = 0;
    let barberGrossShareMAD = 0;
    let barberNetShareMAD = 0;
    let shopShareMAD = 0;
    let uncollectedOwedMAD = 0;

    for (const d of uniqueDates) {
      const dayPct = getEffectiveCommissionPercentForDate(barber.id, d, settingsMap);
      const ds = computeBarberDayStats(barber.id, d, barberMonthEntries, dayPct, rosterMembers);
      incomeMAD += ds.incomeMAD;
      repaymentIncomeMAD += ds.repaymentIncomeMAD;
      creditsIssuedMAD += ds.creditsIssuedMAD;
      expensesMAD += ds.expensesMAD;
      floatMAD += ds.floatMAD;
      barberGrossShareMAD += ds.barberGrossShareMAD;
      barberNetShareMAD += ds.barberNetShareMAD;
      shopShareMAD += ds.shopShareMAD;

      const settlement = settlementsMap[`${barber.id}_${d}`];
      if (!settlement?.collected) {
        const paid = Number(settlement?.collectedAmountMAD) || 0;
        uncollectedOwedMAD += Math.max(0, ds.barberNetShareMAD - paid);
      }

      const dayNum = Number(d.slice(8, 10)) || 1;
      const pIdx = dayNum <= 10 ? 0 : dayNum <= 20 ? 1 : 2;
      periods[pIdx].incomeMAD += ds.incomeMAD;
      periods[pIdx].expensesMAD += ds.expensesMAD;
      periods[pIdx].creditsIssuedMAD += ds.creditsIssuedMAD;
      periods[pIdx].shopShareMAD += ds.shopShareMAD;
      periods[pIdx].barberSharesMAD += ds.barberNetShareMAD;
    }

    const caisseMonthOpenCreditsMAD = barberMonthEntries.reduce(
      (acc, e) => acc + getEffectiveCaisseCreditRemaining(e),
      0
    );
    const manualMonthOpenCreditsMAD = (manualCredits || [])
      .filter((r) => {
        if (r.status === 'paid' || (Number(r.amountOwedMAD) || 0) <= 0) return false;
        if (!matchesCaisseBarber(r.barberId || 'hassan', r.barberName, barber.id, rosterMembers)) {
          return false;
        }
        const recDate = r.creditDate?.trim() || r.createdAt?.slice(0, 10) || '';
        return recDate.startsWith(monthYYYYMM);
      })
      .reduce((acc, r) => acc + Math.max(0, Number(r.amountOwedMAD) || 0), 0);
    const openCreditsMAD = caisseMonthOpenCreditsMAD + manualMonthOpenCreditsMAD;

    return {
      barberId: barber.id,
      barberName: barber.name,
      arName: barber.arName,
      color: barber.color,
      incomeMAD: Math.round(incomeMAD),
      repaymentIncomeMAD: Math.round(repaymentIncomeMAD),
      creditsIssuedMAD: Math.round(creditsIssuedMAD),
      openCreditsMAD: Math.round(openCreditsMAD),
      expensesMAD: Math.round(expensesMAD),
      floatMAD: Math.round(floatMAD),
      commissionPercent: pct,
      extraPercentAbove50: Math.max(0, pct - 50),
      barberGrossShareMAD: Math.round(barberGrossShareMAD),
      barberNetShareMAD: Math.round(barberNetShareMAD),
      shopShareMAD: Math.round(shopShareMAD),
      uncollectedOwedMAD: Math.round(uncollectedOwedMAD),
    };
  });

  const caisseAllTimeOpenCreditsMAD = entries.reduce(
    (acc, e) => acc + getEffectiveCaisseCreditRemaining(e),
    0
  );
  const manualAllTimeOpenCreditsMAD = (manualCredits || [])
    .filter((r) => r.status !== 'paid' && (Number(r.amountOwedMAD) || 0) > 0)
    .reduce((acc, r) => acc + Math.max(0, Number(r.amountOwedMAD) || 0), 0);
  const grandTotalOpenCreditsMAD = caisseAllTimeOpenCreditsMAD + manualAllTimeOpenCreditsMAD;

  return {
    month: monthYYYYMM,
    periods,
    byBarber,
    grandTotalIncomeMAD: byBarber.reduce((s, b) => s + b.incomeMAD, 0),
    grandTotalExpensesMAD: byBarber.reduce((s, b) => s + b.expensesMAD, 0),
    grandTotalShopShareMAD: byBarber.reduce((s, b) => s + b.shopShareMAD, 0),
    grandTotalBarberSharesMAD: byBarber.reduce((s, b) => s + b.barberNetShareMAD, 0),
    grandTotalOpenCreditsMAD: Math.round(grandTotalOpenCreditsMAD),
  };
}

// ---------- Cumulative Cycle Balance (Never Resets Until Master Payout Confirmation) ----------

export function isEntrySettledByCycles(
  entry: CaisseEntry,
  barberCycles: CaisseCycleSettlement[]
): boolean {
  for (const cyc of barberCycles) {
    if (entry.createdAt > cyc.settledThroughIso) continue;
    if (!cyc.settlementPeriodScope || cyc.settlementPeriodScope === 'full_open') {
      return true;
    }
    if (cyc.periodStartDate && cyc.periodEndDate) {
      if (entry.date >= cyc.periodStartDate && entry.date <= cyc.periodEndDate) {
        return true;
      }
    } else if (cyc.settlementPeriodScope === 'month' && cyc.periodStartDate) {
      const monthPrefix = cyc.periodStartDate.slice(0, 7);
      if (entry.date.startsWith(monthPrefix)) {
        return true;
      }
    }
  }
  return false;
}

export interface BarberCycleBalance {
  barberId: CaisseBarberId;
  lastSettledIso: string | null;
  lastSettledDate: string | null;
  commissionPercent: number;
  openCycleEntries: CaisseEntry[];
  incomeMAD: number;
  expensesMAD: number;
  floatInMAD: number;
  floatOutMAD: number;
  floatMAD: number;
  drawerCashMAD: number;
  creditsIssuedMAD: number;
  barberGrossShareMAD: number;
  barberNetOwedMAD: number;
  shopShareMAD: number;
  openCreditsAllTimeMAD: number;
}

export function summarizeBarberEntriesWithSettings(
  barberId: CaisseBarberId,
  targetEntries: CaisseEntry[],
  settingsMap: Record<string, CaisseBarberSetting>,
  fallbackDate: string = getSalonBusinessDate()
): {
  incomeMAD: number;
  expensesMAD: number;
  floatInMAD: number;
  floatOutMAD: number;
  floatMAD: number;
  drawerCashMAD: number;
  creditsIssuedMAD: number;
  barberGrossShareMAD: number;
  barberNetOwedMAD: number;
  shopShareMAD: number;
  commissionPercent: number;
} {
  const uniqueDates = Array.from(new Set(targetEntries.map((e) => e.date))).sort();
  let incomeMAD = 0;
  let expensesMAD = 0;
  let floatInMAD = 0;
  let floatOutMAD = 0;
  let floatMAD = 0;
  let drawerCashMAD = 0;
  let creditsIssuedMAD = 0;
  let barberGrossShareMAD = 0;
  let barberNetOwedMAD = 0;
  let shopShareMAD = 0;

  for (const d of uniqueDates) {
    const dayPct = getEffectiveCommissionPercentForDate(barberId, d, settingsMap);
    const ds = computeBarberDayStats(barberId, d, targetEntries, dayPct);
    incomeMAD += ds.incomeMAD;
    expensesMAD += ds.expensesMAD;
    floatInMAD += ds.floatInMAD;
    floatOutMAD += ds.floatOutMAD;
    floatMAD += ds.floatMAD;
    drawerCashMAD += ds.drawerCashMAD;
    creditsIssuedMAD += ds.creditsIssuedMAD;
    barberGrossShareMAD += ds.barberGrossShareMAD;
    barberNetOwedMAD += ds.barberNetShareMAD;
    shopShareMAD += ds.shopShareMAD;
  }

  return {
    incomeMAD: Math.round(incomeMAD),
    expensesMAD: Math.round(expensesMAD),
    floatInMAD: Math.round(floatInMAD),
    floatOutMAD: Math.round(floatOutMAD),
    floatMAD: Math.round(floatMAD),
    drawerCashMAD: Math.round(drawerCashMAD),
    creditsIssuedMAD: Math.round(creditsIssuedMAD),
    barberGrossShareMAD: Math.round(barberGrossShareMAD),
    barberNetOwedMAD: Math.round(barberNetOwedMAD),
    shopShareMAD: Math.round(shopShareMAD),
    commissionPercent: getEffectiveCommissionPercentForDate(barberId, fallbackDate, settingsMap),
  };
}

export function computeBarberCycleBalance(
  barberId: CaisseBarberId,
  entries: CaisseEntry[],
  settingsMap: Record<string, CaisseBarberSetting>,
  cycles: CaisseCycleSettlement[],
  referenceDate: string = getSalonBusinessDate(),
  manualCredits?: ClientCreditRecord[],
  rosterMembers?: RosterMemberAccount[]
): BarberCycleBalance {
  const barberCycles = cycles
    .filter((c) => matchesCaisseBarber(c.barberId, c.barberName, barberId, rosterMembers))
    .sort((a, b) => b.settledThroughIso.localeCompare(a.settledThroughIso));
  const latestCycle = barberCycles[0] || null;
  const lastSettledIso = latestCycle ? latestCycle.settledThroughIso : null;
  const lastSettledDate = latestCycle ? latestCycle.settledThroughDate : null;

  const openCycleEntries = entries.filter(
    (e) =>
      matchesCaisseBarber(e.barberId, e.barberName, barberId, rosterMembers) &&
      !isEntrySettledByCycles(e, barberCycles)
  );

  const summary = summarizeBarberEntriesWithSettings(
    barberId,
    openCycleEntries,
    settingsMap,
    referenceDate
  );

  const caisseOpenCreditsMAD = entries
    .filter((e) => matchesCaisseBarber(e.barberId, e.barberName, barberId, rosterMembers))
    .reduce((acc, e) => acc + getEffectiveCaisseCreditRemaining(e), 0);

  const manualOpenCreditsMAD = (manualCredits || [])
    .filter(
      (r) =>
        r.status !== 'paid' &&
        (Number(r.amountOwedMAD) || 0) > 0 &&
        matchesCaisseBarber(r.barberId || 'hassan', r.barberName, barberId, rosterMembers)
    )
    .reduce((acc, r) => acc + Math.max(0, Number(r.amountOwedMAD) || 0), 0);

  return {
    barberId,
    lastSettledIso,
    lastSettledDate,
    commissionPercent: summary.commissionPercent,
    openCycleEntries,
    incomeMAD: summary.incomeMAD,
    expensesMAD: summary.expensesMAD,
    floatInMAD: summary.floatInMAD,
    floatOutMAD: summary.floatOutMAD,
    floatMAD: summary.floatMAD,
    drawerCashMAD: summary.drawerCashMAD,
    creditsIssuedMAD: summary.creditsIssuedMAD,
    barberGrossShareMAD: summary.barberGrossShareMAD,
    barberNetOwedMAD: summary.barberNetOwedMAD,
    shopShareMAD: summary.shopShareMAD,
    openCreditsAllTimeMAD: Math.round(caisseOpenCreditsMAD + manualOpenCreditsMAD),
  };
}

export function computeBarberPeriodSettlementPreview(params: {
  barberId: CaisseBarberId;
  entries: CaisseEntry[];
  settingsMap: Record<string, CaisseBarberSetting>;
  cycles: CaisseCycleSettlement[];
  scope: 'full_open' | 'month' | 'custom_range';
  month?: string;
  startDate?: string;
  endDate?: string;
  referenceDate?: string;
}): {
  cycleBalance: BarberCycleBalance;
  periodStartDate?: string;
  periodEndDate?: string;
} {
  const {
    barberId,
    entries,
    settingsMap,
    cycles,
    scope,
    month,
    startDate,
    endDate,
    referenceDate = getSalonBusinessDate(),
  } = params;

  const fullCycle = computeBarberCycleBalance(
    barberId,
    entries,
    settingsMap,
    cycles,
    referenceDate
  );
  if (scope === 'full_open') {
    return { cycleBalance: fullCycle };
  }

  let rangeStart = '';
  let rangeEnd = '';
  if (scope === 'month' && month) {
    const dim = getDaysInMonth(month);
    rangeStart = `${month}-01`;
    rangeEnd = `${month}-${String(dim).padStart(2, '0')}`;
  } else {
    rangeStart = startDate || referenceDate;
    rangeEnd = endDate || rangeStart;
    if (rangeEnd < rangeStart) {
      const tmp = rangeStart;
      rangeStart = rangeEnd;
      rangeEnd = tmp;
    }
  }

  const scopedEntries = fullCycle.openCycleEntries.filter(
    (e) => e.date >= rangeStart && e.date <= rangeEnd
  );
  const summary = summarizeBarberEntriesWithSettings(
    barberId,
    scopedEntries,
    settingsMap,
    rangeEnd
  );

  return {
    cycleBalance: {
      ...fullCycle,
      commissionPercent: summary.commissionPercent,
      openCycleEntries: scopedEntries,
      incomeMAD: summary.incomeMAD,
      expensesMAD: summary.expensesMAD,
      floatInMAD: summary.floatInMAD,
      floatOutMAD: summary.floatOutMAD,
      floatMAD: summary.floatMAD,
      drawerCashMAD: summary.drawerCashMAD,
      creditsIssuedMAD: summary.creditsIssuedMAD,
      barberGrossShareMAD: summary.barberGrossShareMAD,
      barberNetOwedMAD: summary.barberNetOwedMAD,
      shopShareMAD: summary.shopShareMAD,
    },
    periodStartDate: rangeStart,
    periodEndDate: rangeEnd,
  };
}

export async function confirmBarberCyclePayout(params: {
  cycleBalance: BarberCycleBalance;
  confirmedBy: string;
  businessDate: string;
  settlementPeriodScope?: 'full_open' | 'month' | 'custom_range';
  periodStartDate?: string;
  periodEndDate?: string;
  note?: string;
}): Promise<CaisseCycleSettlement> {
  const {
    cycleBalance,
    confirmedBy,
    businessDate,
    settlementPeriodScope = 'full_open',
    periodStartDate,
    periodEndDate,
    note,
  } = params;
  let settledThroughIso = new Date().toISOString().slice(0, 64);
  for (const e of cycleBalance.openCycleEntries) {
    if (e.createdAt && e.createdAt > settledThroughIso) {
      settledThroughIso = e.createdAt.slice(0, 64);
    }
  }
  const nowIso = new Date().toISOString().slice(0, 64);
  const meta = getCaisseBarberMeta(cycleBalance.barberId);
  const id = sanitizeId(`${cycleBalance.barberId}_cyc_${Date.now()}`, 'cyc');

  const payload: CaisseCycleSettlement = {
    id,
    barberId: cycleBalance.barberId,
    barberName: meta.name,
    settledThroughIso,
    settledThroughDate: String(businessDate || getSalonBusinessDate()).slice(0, 20),
    settlementPeriodScope,
    totalCollectedMAD: clampAmount(cycleBalance.incomeMAD, 10000000),
    barberSharePaidMAD: Math.max(
      -10000000,
      Math.min(10000000, Math.round(cycleBalance.barberNetOwedMAD))
    ),
    shopShareMAD: clampAmount(cycleBalance.shopShareMAD, 10000000),
    expensesMAD: clampAmount(cycleBalance.expensesMAD, 10000000),
    floatMAD: clampAmount(cycleBalance.floatMAD, 10000000),
    creditsIssuedMAD: clampAmount(cycleBalance.creditsIssuedMAD, 10000000),
    entryCount: Math.max(0, cycleBalance.openCycleEntries.length),
    confirmedBy: String(confirmedBy || 'Hassan ait boumlik').trim().slice(0, 100),
    confirmedAt: nowIso,
  };
  if (periodStartDate && periodStartDate.trim()) {
    payload.periodStartDate = periodStartDate.trim().slice(0, 20);
  }
  if (periodEndDate && periodEndDate.trim()) {
    payload.periodEndDate = periodEndDate.trim().slice(0, 20);
  }
  if (note && note.trim()) {
    payload.note = note.trim().slice(0, 400);
  }

  const path = `${CAISSE_CYCLES_COLLECTION}/${id}`;
  try {
    await setDoc(doc(db, CAISSE_CYCLES_COLLECTION, id), payload);
    cyclesCache = sortCaisseCyclesDesc([
      payload,
      ...cyclesCache.filter((c) => c.id !== id),
    ]);
    notifyCyclesListeners();
    emitRealtimeSyncHint('caisse');
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCaisseCycleSettlement(cycleId: string): Promise<void> {
  const path = `${CAISSE_CYCLES_COLLECTION}/${cycleId}`;
  try {
    await deleteDoc(doc(db, CAISSE_CYCLES_COLLECTION, cycleId));
    cyclesCache = cyclesCache.filter((c) => c.id !== cycleId);
    notifyCyclesListeners();
    emitRealtimeSyncHint('caisse');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface BarberDailyInOutRow {
  date: string;
  incomeMAD: number;
  expensesMAD: number;
  netDrawerMAD: number;
  entryCount: number;
  isIntakeClosed: boolean;
  grossIntakeClosedMAD: number;
  intakeConfirmedBy?: string;
}

export function computeBarberDailyInOutHistory(
  barberId: CaisseBarberId,
  entries: CaisseEntry[],
  settlementsMap: Record<string, CaisseDailySettlement>,
  limit: number = 14
): BarberDailyInOutRow[] {
  const byDate = new Map<string, CaisseEntry[]>();
  entries.forEach((e) => {
    if (e.barberId !== barberId) return;
    const list = byDate.get(e.date) || [];
    list.push(e);
    byDate.set(e.date, list);
  });

  Object.values(settlementsMap).forEach((s) => {
    if (s.barberId === barberId && !byDate.has(s.date)) {
      byDate.set(s.date, []);
    }
  });

  return Array.from(byDate.keys())
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit)
    .map((date) => {
      const dayEntries = byDate.get(date) || [];
      let incomeMAD = 0;
      let expensesMAD = 0;
      for (const e of dayEntries) {
        if (e.type === 'income' || e.type === 'credit_repayment') {
          incomeMAD += Number(e.amountPaidMAD) || 0;
        } else if (e.type === 'expense') {
          expensesMAD += Number(e.amountPaidMAD) || 0;
        }
      }
      const settlement = settlementsMap[`${barberId}_${date}`];
      const isIntakeClosed = Boolean(settlement?.intakeClosed);
      return {
        date,
        incomeMAD: Math.round(incomeMAD),
        expensesMAD: Math.round(expensesMAD),
        netDrawerMAD: Math.round(incomeMAD - expensesMAD),
        entryCount: dayEntries.length,
        isIntakeClosed,
        grossIntakeClosedMAD: Number(settlement?.grossIntakeClosedMAD) || Math.round(incomeMAD),
        intakeConfirmedBy: settlement?.confirmedBy,
      };
    });
}

// ---------- Idempotent 03:00 AM Daily Archival (Preserves Open Cycle Balances) ----------

let archivalInFlight = false;

export async function ensureDailyArchivesForPriorDays(
  entries: CaisseEntry[],
  existingArchivesMap: Record<string, CaisseDailyArchive>,
  currentBusinessDate: string = getSalonBusinessDate()
): Promise<number> {
  if (archivalInFlight || entries.length === 0) return 0;

  const grouped = new Map<string, CaisseEntry[]>();
  for (const entry of entries) {
    if (!entry.date || entry.date >= currentBusinessDate) continue;
    const key = `${entry.barberId}_${entry.date}`;
    if (existingArchivesMap[key]) continue;
    const list = grouped.get(key) || [];
    list.push(entry);
    grouped.set(key, list);
  }

  if (grouped.size === 0) return 0;

  archivalInFlight = true;
  let createdCount = 0;
  try {
    const nowIso = new Date().toISOString().slice(0, 64);
    const pairs = Array.from(grouped.entries()).slice(0, 20);
    for (const [key, dayEntries] of pairs) {
      const sample = dayEntries[0];
      const meta = getCaisseBarberMeta(sample.barberId);
      let incomeMAD = 0;
      let repaymentIncomeMAD = 0;
      let expensesMAD = 0;
      let floatMAD = 0;
      let creditsIssuedMAD = 0;

      for (const e of dayEntries) {
        if (e.type === 'income') {
          incomeMAD += Number(e.amountPaidMAD) || 0;
          creditsIssuedMAD += Number(e.creditAmountMAD) || 0;
        } else if (e.type === 'credit_repayment') {
          repaymentIncomeMAD += Number(e.amountPaidMAD) || 0;
        } else if (e.type === 'expense') {
          expensesMAD += Number(e.amountPaidMAD) || 0;
        } else if (e.type === 'float_adjustment') {
          floatMAD += Number(e.amountPaidMAD) || 0;
        } else if (e.type === 'float_return') {
          floatMAD -= Number(e.amountPaidMAD) || 0;
        }
      }

      const id = sanitizeId(key, 'arc');
      const archivePayload: CaisseDailyArchive = {
        id,
        barberId: sample.barberId,
        barberName: meta.name,
        date: sample.date.slice(0, 20),
        incomeMAD: clampAmount(incomeMAD, 1000000),
        repaymentIncomeMAD: clampAmount(repaymentIncomeMAD, 1000000),
        expensesMAD: clampAmount(expensesMAD, 1000000),
        floatMAD: clampAmount(floatMAD, 1000000),
        creditsIssuedMAD: clampAmount(creditsIssuedMAD, 1000000),
        entryCount: dayEntries.length,
        entriesSummary: dayEntries.slice(0, 100).map((e) => ({
          id: e.id.slice(0, 64),
          type: e.type,
          amountPaidMAD: clampAmount(e.amountPaidMAD),
          creditAmountMAD: clampAmount(e.creditAmountMAD),
          label: (
            e.serviceNames?.join(' + ') ||
            e.note ||
            e.clientName ||
            e.type
          ).slice(0, 80),
          createdAt: e.createdAt.slice(0, 64),
        })),
        archivedAt: nowIso,
      };

      await setDoc(doc(db, CAISSE_ARCHIVES_COLLECTION, id), archivePayload);
      createdCount += 1;
    }
    return createdCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, CAISSE_ARCHIVES_COLLECTION);
  } finally {
    archivalInFlight = false;
  }
}

// ---------- Cumulative Annual Totals per Barber & Shop ----------

export interface AnnualCaisseBarberSummary {
  barberId: CaisseBarberId;
  barberName: string;
  arName: string;
  incomeMAD: number;
  expensesMAD: number;
  creditsIssuedMAD: number;
  barberNetShareMAD: number;
  shopShareMAD: number;
}

export interface AnnualCaisseRollup {
  year: string;
  byBarber: AnnualCaisseBarberSummary[];
  grandTotalIncomeMAD: number;
  grandTotalExpensesMAD: number;
  grandTotalShopShareMAD: number;
  grandTotalBarberSharesMAD: number;
  grandTotalCreditsIssuedMAD: number;
}

export function computeAnnualCaisseRollup(
  yearYYYY: string,
  entries: CaisseEntry[],
  settingsMap: Record<string, CaisseBarberSetting>,
  rosterMembers?: RosterMemberAccount[]
): AnnualCaisseRollup {
  const barberList = getCaisseBarbersFromRoster(rosterMembers, entries);
  const byBarber: AnnualCaisseBarberSummary[] = barberList.map((barber) => {
    const yearEntries = entries.filter(
      (e) => e.barberId === barber.id && e.date.startsWith(yearYYYY)
    );
    const uniqueDates = Array.from(new Set(yearEntries.map((e) => e.date)));

    let incomeMAD = 0;
    let expensesMAD = 0;
    let creditsIssuedMAD = 0;
    let barberNetShareMAD = 0;
    let shopShareMAD = 0;

    for (const d of uniqueDates) {
      const pct = getEffectiveCommissionPercentForDate(barber.id, d, settingsMap);
      const ds = computeBarberDayStats(barber.id, d, yearEntries, pct);
      incomeMAD += ds.incomeMAD;
      expensesMAD += ds.expensesMAD;
      creditsIssuedMAD += ds.creditsIssuedMAD;
      barberNetShareMAD += ds.barberNetShareMAD;
      shopShareMAD += ds.shopShareMAD;
    }

    return {
      barberId: barber.id,
      barberName: barber.name,
      arName: barber.arName,
      incomeMAD: Math.round(incomeMAD),
      expensesMAD: Math.round(expensesMAD),
      creditsIssuedMAD: Math.round(creditsIssuedMAD),
      barberNetShareMAD: Math.round(barberNetShareMAD),
      shopShareMAD: Math.round(shopShareMAD),
    };
  });

  return {
    year: yearYYYY,
    byBarber,
    grandTotalIncomeMAD: byBarber.reduce((s, b) => s + b.incomeMAD, 0),
    grandTotalExpensesMAD: byBarber.reduce((s, b) => s + b.expensesMAD, 0),
    grandTotalShopShareMAD: byBarber.reduce((s, b) => s + b.shopShareMAD, 0),
    grandTotalBarberSharesMAD: byBarber.reduce((s, b) => s + b.barberNetShareMAD, 0),
    grandTotalCreditsIssuedMAD: byBarber.reduce((s, b) => s + b.creditsIssuedMAD, 0),
  };
}

// ---------- Total Shop Drawer ("المجر ككل") Cash & Breakdown ----------

export interface ShopDrawerBarberRow {
  barberId: CaisseBarberId;
  barberName: string;
  arName: string;
  color: string;
  floatMAD: number;
  directIncomeMAD: number;
  repaymentIncomeMAD: number;
  incomeMAD: number;
  expensesMAD: number;
  barberGrossShareMAD: number;
  shopShareMAD: number;
  barberNetShareMAD: number;
  netDrawerContributionMAD: number;
  entryCount: number;
}

export interface ShopDrawerSummary {
  scope: 'open_cycle' | 'day';
  date?: string;
  totalFloatMAD: number;
  totalDirectIncomeMAD: number;
  totalRepaymentIncomeMAD: number;
  totalIncomeMAD: number;
  totalExpensesMAD: number;
  totalShopShareMAD: number;
  netTotalMAD: number;
  entryCount: number;
  byBarber: ShopDrawerBarberRow[];
}

export function computeShopDrawerTotals(params: {
  entries: CaisseEntry[];
  settingsMap: Record<string, CaisseBarberSetting>;
  cycles: CaisseCycleSettlement[];
  rosterMembers?: RosterMemberAccount[];
  scope: 'open_cycle' | 'day';
  date?: string;
  settlementsMap?: Record<string, CaisseDailySettlement>;
  respectDailyIntakeClose?: boolean;
}): ShopDrawerSummary {
  const {
    entries,
    settingsMap,
    cycles,
    rosterMembers,
    scope,
    date = getSalonBusinessDate(),
    settlementsMap,
    respectDailyIntakeClose = false,
  } = params;

  const barberList = getCaisseBarbersFromRoster(rosterMembers, entries);

  const byBarber: ShopDrawerBarberRow[] = barberList.map((barber) => {
    const barberCycles = cycles.filter((c) =>
      matchesCaisseBarber(c.barberId, c.barberName, barber.id, rosterMembers)
    );
    const scopedEntries = entries.filter((e) => {
      if (!matchesCaisseBarber(e.barberId, e.barberName, barber.id, rosterMembers)) {
        return false;
      }
      if (scope === 'day') {
        if (e.date !== date) return false;
        if (respectDailyIntakeClose && settlementsMap) {
          const daySettlement = findBarberDaySettlement(
            barber.id,
            date,
            settlementsMap,
            rosterMembers
          );
          if (daySettlement?.intakeClosed) {
            const closedIso =
              daySettlement.confirmedAt || daySettlement.updatedAt || null;
            if (!closedIso || e.createdAt <= closedIso) return false;
          }
        }
        return true;
      }
      if (isEntrySettledByCycles(e, barberCycles)) return false;
      if (respectDailyIntakeClose && settlementsMap) {
        const entryDaySettlement = findBarberDaySettlement(
          barber.id,
          e.date,
          settlementsMap,
          rosterMembers
        );
        if (entryDaySettlement?.intakeClosed) {
          const closedIso =
            entryDaySettlement.confirmedAt || entryDaySettlement.updatedAt || null;
          if (!closedIso || e.createdAt <= closedIso) return false;
        }
      }
      return true;
    });

    const uniqueDates = Array.from(new Set(scopedEntries.map((e) => e.date))).sort();
    let floatMAD = 0;
    let directIncomeMAD = 0;
    let repaymentIncomeMAD = 0;
    let incomeMAD = 0;
    let expensesMAD = 0;
    let barberGrossShareMAD = 0;
    let shopShareMAD = 0;
    let barberNetShareMAD = 0;

    for (const d of uniqueDates) {
      const pct = getEffectiveCommissionPercentForDate(barber.id, d, settingsMap);
      const ds = computeBarberDayStats(barber.id, d, scopedEntries, pct, rosterMembers);
      floatMAD += ds.floatMAD;
      directIncomeMAD += ds.directIncomeMAD;
      repaymentIncomeMAD += ds.repaymentIncomeMAD;
      incomeMAD += ds.incomeMAD;
      expensesMAD += ds.expensesMAD;
      barberGrossShareMAD += ds.barberGrossShareMAD;
      shopShareMAD += ds.shopShareMAD;
      barberNetShareMAD += ds.barberNetShareMAD;
    }

    return {
      barberId: barber.id,
      barberName: barber.name,
      arName: barber.arName,
      color: barber.color,
      floatMAD: Math.round(floatMAD),
      directIncomeMAD: Math.round(directIncomeMAD),
      repaymentIncomeMAD: Math.round(repaymentIncomeMAD),
      incomeMAD: Math.round(incomeMAD),
      expensesMAD: Math.round(expensesMAD),
      barberGrossShareMAD: Math.round(barberGrossShareMAD),
      shopShareMAD: Math.round(shopShareMAD),
      barberNetShareMAD: Math.round(barberNetShareMAD),
      netDrawerContributionMAD: Math.round(floatMAD + incomeMAD - expensesMAD),
      entryCount: scopedEntries.length,
    };
  });

  const totalFloatMAD = byBarber.reduce((s, r) => s + r.floatMAD, 0);
  const totalDirectIncomeMAD = byBarber.reduce((s, r) => s + r.directIncomeMAD, 0);
  const totalRepaymentIncomeMAD = byBarber.reduce((s, r) => s + r.repaymentIncomeMAD, 0);
  const totalIncomeMAD = byBarber.reduce((s, r) => s + r.incomeMAD, 0);
  const totalExpensesMAD = byBarber.reduce((s, r) => s + r.expensesMAD, 0);
  const totalShopShareMAD = byBarber.reduce((s, r) => s + r.shopShareMAD, 0);
  const entryCount = byBarber.reduce((s, r) => s + r.entryCount, 0);

  return {
    scope,
    date: scope === 'day' ? date : undefined,
    totalFloatMAD,
    totalDirectIncomeMAD,
    totalRepaymentIncomeMAD,
    totalIncomeMAD,
    totalExpensesMAD,
    totalShopShareMAD,
    netTotalMAD: Math.round(totalFloatMAD + totalIncomeMAD - totalExpensesMAD),
    entryCount,
    byBarber,
  };
}


