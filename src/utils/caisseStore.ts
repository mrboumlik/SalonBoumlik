import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  serverTimestamp,
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
import { getCurrentDeviceOrigin } from './deviceOrigin';
import { db, handleFirestoreError, OperationType } from './firebase';
import { showToast } from './notifications';
import {
  emitRealtimeSyncHint,
  registerRealtimeRefreshHandler,
  resetResilientRetry,
  scheduleResilientRetry,
} from './realtimeSync';
import { safeStorageGet, safeStorageSet } from './safeBrowser';
import {
  asDateString,
  asFiniteNum,
  asIsoString,
  asStr,
  asStrArray,
  safeCompareDesc,
} from './safeCoerce';
import {
  applyExternalServerTimeSample,
  formatMoroccoCalendarDate,
  getTrustedNowDate,
  getTrustedNowMs,
  getTrustedTimeMeta,
  syncTrustedServerTime,
} from './trustedTime';

const CAISSE_ENTRIES_COLLECTION = 'caisse_entries';
const CAISSE_SETTINGS_COLLECTION = 'caisse_settings';
const CAISSE_SETTLEMENTS_COLLECTION = 'caisse_settlements';
const CAISSE_CYCLES_COLLECTION = 'caisse_cycles';
const CAISSE_ARCHIVES_COLLECTION = 'caisse_daily_archives';
const BARBER_DAILY_NOTES_COLLECTION = 'barber_daily_notes';
const CAISSE_OFFLINE_QUEUE_KEY = 'salon_boumlik_caisse_offline_queue_v1';
const CAISSE_ENTRIES_SNAPSHOT_CACHE_KEY = 'salon_boumlik_caisse_entries_cache_v1';

/**
 * Returns the canonical Morocco calendar date (`Africa/Casablanca`, `YYYY-MM-DD`)
 * using server-calibrated trusted time to protect against corrupted local device clocks.
 * Does NOT perform any 03:00 AM shift or automatic clock-based balance reset;
 * daily and monthly balances reset strictly when explicitly settled by Hassan.
 */
export function getSalonBusinessDate(dateObj?: Date): string {
  const baseDate = dateObj ?? getTrustedNowDate();
  return formatMoroccoCalendarDate(baseDate);
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

export function isFloatEntryType(type: CaisseEntryType | string | undefined): boolean {
  return type === 'float_adjustment' || type === 'float_return';
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

/**
 * Financial attribution matcher:
 * Change float ("فلوس الصرف" / `float_adjustment` & `float_return`) always belongs
 * to Hassan Ait Boumlik's personal funds (`hassan`) and never to other barbers.
 */
export function matchesCaisseFinancialBarber(
  entry: Pick<CaisseEntry, 'barberId' | 'barberName' | 'type'>,
  targetBarberId: CaisseBarberId,
  rosterMembers?: RosterMemberAccount[]
): boolean {
  if (isFloatEntryType(entry.type)) {
    return targetBarberId === 'hassan';
  }
  return matchesCaisseBarber(entry.barberId, entry.barberName, targetBarberId, rosterMembers);
}

function getNextMonotonicIsoForBarber(
  barberId: CaisseBarberId,
  rosterMembers?: RosterMemberAccount[],
  targetTimeMs?: number
): string {
  let maxAnchorMs = 0;
  Object.values(settlementsCache).forEach((s) => {
    if (
      s.intakeClosed &&
      matchesCaisseBarber(s.barberId, s.barberName, barberId, rosterMembers)
    ) {
      const iso = s.confirmedAt || s.updatedAt || '';
      const ms = iso ? Date.parse(iso) : NaN;
      if (Number.isFinite(ms) && ms > maxAnchorMs) maxAnchorMs = ms;
    }
  });
  cyclesCache.forEach((c) => {
    if (matchesCaisseBarber(c.barberId, c.barberName, barberId, rosterMembers)) {
      const iso = c.settledThroughIso || c.confirmedAt || '';
      const ms = iso ? Date.parse(iso) : NaN;
      if (Number.isFinite(ms) && ms > maxAnchorMs) maxAnchorMs = ms;
    }
  });
  const nowMs =
    typeof targetTimeMs === 'number' && Number.isFinite(targetTimeMs)
      ? targetTimeMs
      : getTrustedNowMs();
  const safeMs = nowMs <= maxAnchorMs ? maxAnchorMs + 1 : nowMs;
  return new Date(safeMs).toISOString().slice(0, 64);
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

function coerceCaisseEntryDoc(rawInput: unknown, docId: string): CaisseEntry {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = asStr(raw.id, docId) || docId;
  const firestoreServerCreatedAt =
    raw.firestoreServerCreatedAt !== undefined && raw.firestoreServerCreatedAt !== null
      ? asIsoString(raw.firestoreServerCreatedAt, '') || undefined
      : undefined;
  const createdAt =
    asIsoString(raw.createdAt, '') ||
    firestoreServerCreatedAt ||
    asIsoString(raw.updatedAt, '');
  const updatedAt = asIsoString(raw.updatedAt, createdAt);
  const date = asDateString(raw.date, '') || (createdAt ? createdAt.slice(0, 10) : getSalonBusinessDate());
  return {
    ...(raw as Partial<CaisseEntry>),
    id,
    barberId: asStr(raw.barberId, 'hassan'),
    barberName: asStr(raw.barberName, 'Hassan ait boumlik'),
    type: (asStr(raw.type, 'income') || 'income') as CaisseEntryType,
    adjustmentDirection:
      raw.adjustmentDirection === 'debit'
        ? 'debit'
        : raw.adjustmentDirection === 'credit'
        ? 'credit'
        : undefined,
    date,
    serviceIds: asStrArray(raw.serviceIds),
    serviceNames: asStrArray(raw.serviceNames),
    expectedAmountMAD: asFiniteNum(raw.expectedAmountMAD, 0),
    amountPaidMAD: asFiniteNum(raw.amountPaidMAD, 0),
    creditAmountMAD: asFiniteNum(raw.creditAmountMAD, 0),
    creditRemainingMAD: asFiniteNum(raw.creditRemainingMAD, 0),
    creditStatus: (asStr(raw.creditStatus, 'none') || 'none') as CaisseCreditStatus,
    clientName: raw.clientName !== undefined ? asStr(raw.clientName, '') : undefined,
    clientPhone: raw.clientPhone !== undefined ? asStr(raw.clientPhone, '') : undefined,
    expectedRepaymentDate: raw.expectedRepaymentDate !== undefined ? asDateString(raw.expectedRepaymentDate, '') : undefined,
    repaidDate: raw.repaidDate !== undefined ? asDateString(raw.repaidDate, '') : undefined,
    repaidAmountMAD: raw.repaidAmountMAD !== undefined ? asFiniteNum(raw.repaidAmountMAD, 0) : undefined,
    parentCreditEntryId: raw.parentCreditEntryId !== undefined ? asStr(raw.parentCreditEntryId, '') : undefined,
    sourceBookingId: raw.sourceBookingId !== undefined ? asStr(raw.sourceBookingId, '') : undefined,
    note: raw.note !== undefined ? asStr(raw.note, '') : undefined,
    createdByRole: (asStr(raw.createdByRole, 'barber') || 'barber') as StaffRole,
    createdByName: asStr(raw.createdByName, 'Staff'),
    createdAt,
    updatedAt,
    deviceKind: raw.deviceKind === 'phone' || raw.deviceKind === 'pc' ? raw.deviceKind : undefined,
    deviceId: raw.deviceId !== undefined ? asStr(raw.deviceId, '') || undefined : undefined,
    deviceLabel: raw.deviceLabel !== undefined ? asStr(raw.deviceLabel, '') || undefined : undefined,
    devicePlatform: raw.devicePlatform !== undefined ? asStr(raw.devicePlatform, '') || undefined : undefined,
    deviceBrowser: raw.deviceBrowser !== undefined ? asStr(raw.deviceBrowser, '') || undefined : undefined,
    timeSource:
      raw.timeSource === 'server_api' ||
      raw.timeSource === 'firestore_server' ||
      raw.timeSource === 'cached_offset' ||
      raw.timeSource === 'device_clock'
        ? raw.timeSource
        : undefined,
    serverClockOffsetMs:
      typeof raw.serverClockOffsetMs === 'number' && Number.isFinite(raw.serverClockOffsetMs)
        ? raw.serverClockOffsetMs
        : undefined,
    deviceClockISO: raw.deviceClockISO !== undefined ? asIsoString(raw.deviceClockISO, '') || undefined : undefined,
    offlineCreated: typeof raw.offlineCreated === 'boolean' ? raw.offlineCreated : undefined,
    firestoreServerCreatedAt,
  };
}

function coerceCaisseSettlementDoc(rawInput: unknown, docId: string): CaisseDailySettlement {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = asStr(raw.id, docId) || docId;
  return {
    ...(raw as Partial<CaisseDailySettlement>),
    id,
    barberId: asStr(raw.barberId, 'hassan'),
    barberName: asStr(raw.barberName, 'Hassan ait boumlik'),
    date: asDateString(raw.date, ''),
    collected: Boolean(raw.collected),
    collectedAmountMAD: asFiniteNum(raw.collectedAmountMAD, 0),
    barberShareMAD: asFiniteNum(raw.barberShareMAD, 0),
    shopShareMAD: asFiniteNum(raw.shopShareMAD, 0),
    floatMAD: asFiniteNum(raw.floatMAD, 0),
    expensesMAD: asFiniteNum(raw.expensesMAD, 0),
    carryOverOwedMAD: asFiniteNum(raw.carryOverOwedMAD, 0),
    resetCount: asFiniteNum(raw.resetCount, 0),
    intakeClosed: Boolean(raw.intakeClosed),
    grossIntakeClosedMAD: asFiniteNum(raw.grossIntakeClosedMAD, 0),
    confirmedBy: asStr(raw.confirmedBy, ''),
    confirmedAt: asIsoString(raw.confirmedAt, ''),
    updatedAt: asIsoString(raw.updatedAt, ''),
  };
}

function coerceCaisseCycleDoc(rawInput: unknown, docId: string): CaisseCycleSettlement {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = asStr(raw.id, docId) || docId;
  const settledThroughIso = asIsoString(raw.settledThroughIso, '') || asIsoString(raw.confirmedAt, '');
  return {
    ...(raw as Partial<CaisseCycleSettlement>),
    id,
    barberId: asStr(raw.barberId, 'hassan'),
    barberName: asStr(raw.barberName, 'Hassan ait boumlik'),
    settledThroughIso,
    settledThroughDate: asDateString(raw.settledThroughDate, ''),
    periodStartDate: raw.periodStartDate !== undefined ? asDateString(raw.periodStartDate, '') : undefined,
    periodEndDate: raw.periodEndDate !== undefined ? asDateString(raw.periodEndDate, '') : undefined,
    totalCollectedMAD: asFiniteNum(raw.totalCollectedMAD, 0),
    barberSharePaidMAD: asFiniteNum(raw.barberSharePaidMAD, 0),
    shopShareMAD: asFiniteNum(raw.shopShareMAD, 0),
    expensesMAD: asFiniteNum(raw.expensesMAD, 0),
    floatMAD: asFiniteNum(raw.floatMAD, 0),
    creditsIssuedMAD: asFiniteNum(raw.creditsIssuedMAD, 0),
    entryCount: asFiniteNum(raw.entryCount, 0),
    carryForwardBalanceMAD:
      typeof raw.carryForwardBalanceMAD === 'number' && Number.isFinite(raw.carryForwardBalanceMAD)
        ? Math.round(raw.carryForwardBalanceMAD)
        : undefined,
    negativeResolution:
      raw.negativeResolution === 'cleared' || raw.negativeResolution === 'carried_forward'
        ? raw.negativeResolution
        : undefined,
    confirmedBy: asStr(raw.confirmedBy, ''),
    confirmedAt: asIsoString(raw.confirmedAt, settledThroughIso),
  };
}

function coerceCaisseArchiveDoc(rawInput: unknown, docId: string): CaisseDailyArchive {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = asStr(raw.id, docId) || docId;
  return {
    ...(raw as Partial<CaisseDailyArchive>),
    id,
    barberId: asStr(raw.barberId, 'hassan'),
    barberName: asStr(raw.barberName, ''),
    date: asDateString(raw.date, ''),
    incomeMAD: asFiniteNum(raw.incomeMAD, 0),
    repaymentIncomeMAD: asFiniteNum(raw.repaymentIncomeMAD, 0),
    expensesMAD: asFiniteNum(raw.expensesMAD, 0),
    floatMAD: asFiniteNum(raw.floatMAD, 0),
    creditsIssuedMAD: asFiniteNum(raw.creditsIssuedMAD, 0),
    entryCount: asFiniteNum(raw.entryCount, 0),
    entriesSummary: Array.isArray(raw.entriesSummary) ? raw.entriesSummary : [],
    archivedAt: asIsoString(raw.archivedAt, ''),
  };
}

function coerceDailyNoteDoc(rawInput: unknown, docId: string): BarberDailyNote {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = asStr(raw.id, docId) || docId;
  return {
    ...(raw as Partial<BarberDailyNote>),
    id,
    barberId: asStr(raw.barberId, 'hassan'),
    barberName: asStr(raw.barberName, ''),
    date: asDateString(raw.date, ''),
    masterNote: asStr(raw.masterNote, ''),
    masterUpdatedBy: asStr(raw.masterUpdatedBy, ''),
    masterUpdatedAt: asIsoString(raw.masterUpdatedAt, ''),
    barberReply: raw.barberReply !== undefined ? asStr(raw.barberReply, '') : undefined,
    barberRepliedBy: raw.barberRepliedBy !== undefined ? asStr(raw.barberRepliedBy, '') : undefined,
    barberRepliedAt: raw.barberRepliedAt !== undefined ? asIsoString(raw.barberRepliedAt, '') : undefined,
    createdAt: asIsoString(raw.createdAt, ''),
    updatedAt: asIsoString(raw.updatedAt, ''),
  };
}

function sortCaisseEntriesDesc(list: CaisseEntry[]): CaisseEntry[] {
  return [...list].sort((a, b) => {
    const ka = asStr(a.createdAt, '') || asStr(a.date, '');
    const kb = asStr(b.createdAt, '') || asStr(b.date, '');
    const cmp = safeCompareDesc(ka, kb);
    if (cmp !== 0) return cmp;
    return safeCompareDesc(a.id, b.id);
  });
}

function sortCaisseCyclesDesc(list: CaisseCycleSettlement[]): CaisseCycleSettlement[] {
  return [...list].sort((a, b) => {
    const ka = asStr(a.confirmedAt, '') || asStr(a.settledThroughIso, '') || asStr(a.settledThroughDate, '');
    const kb = asStr(b.confirmedAt, '') || asStr(b.settledThroughIso, '') || asStr(b.settledThroughDate, '');
    const cmp = safeCompareDesc(ka, kb);
    if (cmp !== 0) return cmp;
    return safeCompareDesc(a.id, b.id);
  });
}

async function getCollectionDocsFast<T>(colName: string) {
  try {
    return await getDocsFromServer(collection(db, colName));
  } catch {
    return await getDocs(collection(db, colName));
  }
}

// ---------- Offline Caisse Queue + Auto-Reconciliation ----------

type PendingOfflineQueueItem =
  | {
      kind: 'create';
      id: string;
      payload: CaisseEntry;
      hasExplicitDateOverride: boolean;
      hasExplicitCreatedAtOverride: boolean;
      queuedAtPerfMs: number;
      queuedAtTrustedMs: number;
      queuedAtEpochMs?: number;
      wasCalibratedAtCreation: boolean;
      wasCreatedOffline?: boolean;
      attempts: number;
      lastError?: string;
    }
  | {
      kind: 'repayment';
      id: string;
      creditEntryId: string;
      prevRemainingMAD: number;
      prevRepaidTotalMAD: number;
      amountAppliedMAD: number;
      repaymentPayload: CaisseEntry;
      queuedAtPerfMs: number;
      queuedAtTrustedMs: number;
      queuedAtEpochMs?: number;
      wasCalibratedAtCreation: boolean;
      wasCreatedOffline?: boolean;
      attempts: number;
      lastError?: string;
    };

export interface CaisseOfflineStatus {
  isOnline: boolean;
  pendingCount: number;
  delayedPendingCount: number;
  pendingEntryIds: string[];
  isSyncing: boolean;
  lastSyncError: string | null;
  flushNow: () => Promise<number>;
}

const SESSION_BOOT_EPOCH = Math.random().toString(36).slice(2, 8);
const DELAYED_PENDING_BANNER_MS = 1250;
const CONNECTIVITY_CACHE_TTL_MS = 8000;
const CONNECTIVITY_PROBE_TIMEOUT_MS = 1500;
const sessionPerfAnchorIds = new Set<string>();
let offlineQueue: PendingOfflineQueueItem[] = [];
let isFlushingOfflineQueue = false;
let flushNeedsRerun = false;
let delayedPendingTimerId: number | null = null;
let lastOfflineSyncError: string | null = null;
let offlineHooksBound = false;
let isNetworkCurrentlyOffline =
  typeof navigator !== 'undefined' && navigator.onLine === false;
let lastConfirmedReachableEpochMs = 0;
let inflightConnectivityProbe: Promise<boolean> | null = null;
const offlineStatusListeners = new Set<() => void>();

function loadOfflineQueue(): PendingOfflineQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = safeStorageGet(CAISSE_OFFLINE_QUEUE_KEY, 'local');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingOfflineQueueItem =>
        Boolean(item && typeof item === 'object' && typeof item.id === 'string' && (item.kind === 'create' || item.kind === 'repayment'))
    );
  } catch {
    return [];
  }
}

offlineQueue = loadOfflineQueue();

function saveOfflineQueue(next: PendingOfflineQueueItem[]): void {
  offlineQueue = next;
  try {
    safeStorageSet(CAISSE_OFFLINE_QUEUE_KEY, JSON.stringify(next), 'local');
  } catch {
    // Ignore storage quota errors
  }
}

function loadCachedEntriesSnapshot(): CaisseEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = safeStorageGet(CAISSE_ENTRIES_SNAPSHOT_CACHE_KEY, 'local');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item, idx) => coerceCaisseEntryDoc(item, asStr(item.id, `cached_${idx}`)));
  } catch {
    return [];
  }
}

function saveCachedEntriesSnapshot(entries: CaisseEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    const compact = entries.slice(0, 600).map((e) => stripClientOnlyEntryFields(e));
    const ok = safeStorageSet(CAISSE_ENTRIES_SNAPSHOT_CACHE_KEY, JSON.stringify(compact), 'local');
    if (!ok && compact.length > 150) {
      safeStorageSet(
        CAISSE_ENTRIES_SNAPSHOT_CACHE_KEY,
        JSON.stringify(compact.slice(0, 150)),
        'local'
      );
    }
  } catch {
    // Ignore local cache write errors
  }
}

function scheduleDelayedPendingBannerCheck(): void {
  if (typeof window === 'undefined' || delayedPendingTimerId !== null) return;
  delayedPendingTimerId = window.setTimeout(() => {
    delayedPendingTimerId = null;
    if (offlineQueue.length > 0) {
      notifyOfflineStatusListeners();
    }
  }, DELAYED_PENDING_BANNER_MS);
}

export function isWebConnectionAvailableSync(): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  return !isNetworkCurrentlyOffline;
}

function markWebConnectivityOnline(): void {
  lastConfirmedReachableEpochMs = Date.now();
  if (isNetworkCurrentlyOffline || lastOfflineSyncError) {
    isNetworkCurrentlyOffline = false;
    lastOfflineSyncError = null;
    notifyOfflineStatusListeners();
  } else {
    isNetworkCurrentlyOffline = false;
  }
}

function markWebConnectivityOffline(errorNote: string | null = null): void {
  lastConfirmedReachableEpochMs = 0;
  const changed = !isNetworkCurrentlyOffline || lastOfflineSyncError !== errorNote;
  isNetworkCurrentlyOffline = true;
  lastOfflineSyncError = errorNote;
  if (changed) {
    notifyOfflineStatusListeners();
  }
}

export async function checkWebConnectivityFast(
  forceProbe = false,
  timeoutMs = CONNECTIVITY_PROBE_TIMEOUT_MS
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    markWebConnectivityOffline(null);
    return false;
  }
  if (
    !forceProbe &&
    !isNetworkCurrentlyOffline &&
    lastConfirmedReachableEpochMs > 0 &&
    Date.now() - lastConfirmedReachableEpochMs < CONNECTIVITY_CACHE_TTL_MS
  ) {
    return true;
  }
  if (inflightConnectivityProbe) {
    return inflightConnectivityProbe;
  }

  inflightConnectivityProbe = (async () => {
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
      const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
      if (online) markWebConnectivityOnline();
      else markWebConnectivityOffline(null);
      return online;
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const abortTimer =
      controller !== null ? window.setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const t0 = Date.now();
      const res = await raceWithTimeout(
        fetch(`/api/time?ping=${t0}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
          signal: controller ? controller.signal : undefined,
        }),
        timeoutMs
      );
      if (res.ok) {
        try {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const payload = (await res.json()) as { nowMs?: unknown };
            if (typeof payload?.nowMs === 'number' && Number.isFinite(payload.nowMs)) {
              const rtt = Math.max(0, Date.now() - t0);
              applyExternalServerTimeSample(payload.nowMs + Math.round(rtt / 2), 'server_api');
            }
            markWebConnectivityOnline();
            return true;
          }
        } catch {
          // Non-JSON response on static hosting falls through to Firestore probe
        }
      }
      if (res.status >= 500) {
        markWebConnectivityOffline(null);
        return false;
      }
      // Static CDN deployment fallback: probe Firestore connection doc directly with tight timeout
      await raceWithTimeout(getDocFromServer(doc(db, 'test', 'connection')), timeoutMs);
      markWebConnectivityOnline();
      return true;
    } catch {
      markWebConnectivityOffline(null);
      return false;
    } finally {
      if (abortTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(abortTimer);
      }
      inflightConnectivityProbe = null;
    }
  })();

  return inflightConnectivityProbe;
}

function getCurrentOfflineStatusSnapshot(): Omit<CaisseOfflineStatus, 'flushNow'> {
  const isOnline = isWebConnectionAvailableSync();
  const nowEpoch = Date.now();
  const delayedPendingCount = offlineQueue.filter((item) => {
    if (!isOnline || Boolean(lastOfflineSyncError)) return true;
    if (item.wasCreatedOffline || item.attempts > 0) return true;
    if (typeof item.queuedAtEpochMs !== 'number') return true;
    return nowEpoch - item.queuedAtEpochMs >= DELAYED_PENDING_BANNER_MS;
  }).length;
  return {
    isOnline,
    pendingCount: offlineQueue.length,
    delayedPendingCount,
    pendingEntryIds: offlineQueue.map((q) => q.id),
    isSyncing: isFlushingOfflineQueue,
    lastSyncError: lastOfflineSyncError,
  };
}

function notifyOfflineStatusListeners(): void {
  offlineStatusListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore
    }
  });
}

function isLikelyNetworkOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg =
    error instanceof Error
      ? `${error.name} ${error.message}`.toLowerCase()
      : String(error || '').toLowerCase();
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '').toLowerCase()
      : '';
  if (code === 'permission-denied' || code === 'invalid-argument' || msg.includes('permission_denied')) {
    return false;
  }
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'aborted' ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('unavailable') ||
    msg.includes('timeout') ||
    msg.includes('transport') ||
    msg.includes('connection')
  );
}

function stripClientOnlyEntryFields(entry: CaisseEntry): Record<string, unknown> {
  const clean: Record<string, unknown> = { ...entry };
  delete clean.offlinePending;
  delete clean.firestoreServerCreatedAt;
  Object.keys(clean).forEach((k) => {
    if (clean[k] === undefined) delete clean[k];
  });
  return clean;
}

function buildFirestoreCreateDocPayload(entry: CaisseEntry): Record<string, unknown> {
  const clean = stripClientOnlyEntryFields(entry);
  clean.firestoreServerCreatedAt = serverTimestamp();
  return clean;
}

async function raceWithTimeout<T>(promise: Promise<T>, timeoutMs = 6500): Promise<T> {
  let timerId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        if (typeof window !== 'undefined') {
          timerId = window.setTimeout(() => {
            reject(new Error('firestore_write_timeout'));
          }, timeoutMs);
        }
      }),
    ]);
  } finally {
    if (timerId !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(timerId);
    }
  }
}

// ---------- In-memory caches + shared Firestore subscriptions ----------

let lastFirestoreEntries: CaisseEntry[] = loadCachedEntriesSnapshot();
let entriesCache: CaisseEntry[] = mergeEntriesWithOfflineQueue(lastFirestoreEntries);
let hasEntriesHydrated = lastFirestoreEntries.length > 0 || offlineQueue.length > 0;
const entryListeners = new Set<(entries: CaisseEntry[]) => void>();
let entriesUnsub: (() => void) | null = null;
let entriesRefreshUnsub: (() => void) | null = null;

function mergeEntriesWithOfflineQueue(baseEntries: CaisseEntry[]): CaisseEntry[] {
  const baseById = new Map<string, CaisseEntry>();
  baseEntries.forEach((e) => {
    baseById.set(e.id, e);
  });

  const pendingOverlays: CaisseEntry[] = [];

  for (const item of offlineQueue) {
    if (item.kind === 'create') {
      if (!baseById.has(item.id)) {
        pendingOverlays.push({ ...item.payload, offlinePending: true });
      }
    } else if (item.kind === 'repayment') {
      if (!baseById.has(item.id)) {
        pendingOverlays.push({ ...item.repaymentPayload, offlinePending: true });
      }
      const existingParent = baseById.get(item.creditEntryId);
      if (existingParent) {
        const nextRemaining = clampAmount(
          Math.max(0, existingParent.creditRemainingMAD - item.amountAppliedMAD)
        );
        baseById.set(item.creditEntryId, {
          ...existingParent,
          creditRemainingMAD: nextRemaining,
          creditStatus: nextRemaining <= 0 ? 'paid' : 'partial',
          repaidDate: item.repaymentPayload.repaidDate || existingParent.repaidDate,
          repaidAmountMAD: clampAmount((existingParent.repaidAmountMAD || 0) + item.amountAppliedMAD),
          updatedAt: item.repaymentPayload.updatedAt,
        });
      }
    }
  }

  return sortCaisseEntriesDesc([...pendingOverlays, ...Array.from(baseById.values())]);
}

function rebuildEntriesCacheFromBase(baseEntries: CaisseEntry[], persistSnapshot = true): void {
  lastFirestoreEntries = baseEntries;
  entriesCache = mergeEntriesWithOfflineQueue(baseEntries);
  if (persistSnapshot && baseEntries.length > 0) {
    saveCachedEntriesSnapshot(baseEntries);
  }
}

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
          markWebConnectivityOnline();
          rebuildEntriesCacheFromBase(snap.docs.map((d) => coerceCaisseEntryDoc(d.data(), d.id)));
          hasEntriesHydrated = true;
          notifyEntriesListeners();
          void flushOfflineCaisseQueue();
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
      if (!snapshot.metadata?.fromCache) {
        markWebConnectivityOnline();
      }
      rebuildEntriesCacheFromBase(snapshot.docs.map((d) => coerceCaisseEntryDoc(d.data(), d.id)));
      hasEntriesHydrated = true;
      notifyEntriesListeners();
      if (offlineQueue.length > 0 && isWebConnectionAvailableSync()) {
        void flushOfflineCaisseQueue();
      }
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

function resolveQueuedEventTimeMs(
  item: {
    id: string;
    queuedAtPerfMs: number;
    queuedAtTrustedMs: number;
    wasCalibratedAtCreation: boolean;
  },
  freshServerNowMs: number
): number {
  if (
    sessionPerfAnchorIds.has(item.id) &&
    typeof performance !== 'undefined' &&
    Number.isFinite(item.queuedAtPerfMs)
  ) {
    const elapsedMs = Math.max(0, performance.now() - item.queuedAtPerfMs);
    return Math.round(freshServerNowMs - elapsedMs);
  }
  if (item.wasCalibratedAtCreation && Number.isFinite(item.queuedAtTrustedMs)) {
    return item.queuedAtTrustedMs;
  }
  return freshServerNowMs;
}

export async function flushOfflineCaisseQueue(forceConnectivityCheck = false): Promise<number> {
  if (isFlushingOfflineQueue) {
    if (offlineQueue.length > 0) {
      flushNeedsRerun = true;
    }
    return 0;
  }
  if (offlineQueue.length === 0) return 0;

  // Step 1: Always check internet connection BEFORE waiting on remote Firestore writes
  const isReachable = await checkWebConnectivityFast(forceConnectivityCheck);
  if (!isReachable) {
    const markedOfflineQueue = offlineQueue.map((item) => {
      if (item.kind === 'create') {
        return {
          ...item,
          wasCreatedOffline: true,
          payload: { ...item.payload, offlineCreated: true },
        };
      }
      return {
        ...item,
        wasCreatedOffline: true,
        repaymentPayload: { ...item.repaymentPayload, offlineCreated: true },
      };
    });
    saveOfflineQueue(markedOfflineQueue);
    rebuildEntriesCacheFromBase(lastFirestoreEntries, false);
    notifyEntriesListeners();
    markWebConnectivityOffline(null);
    return 0;
  }

  isFlushingOfflineQueue = true;
  lastOfflineSyncError = null;
  notifyOfflineStatusListeners();

  let syncedCount = 0;
  let offlineToastSyncedCount = 0;
  let syncedCreditsHint = false;

  try {
    const batchItems = [...offlineQueue];
    const processedIds = new Set(batchItems.map((q) => q.id));

    const needsServerCalibration =
      !getTrustedTimeMeta().isCalibrated ||
      batchItems.some(
        (q) =>
          Boolean(q.wasCreatedOffline) ||
          q.attempts > 0 ||
          !q.wasCalibratedAtCreation ||
          (typeof q.queuedAtEpochMs === 'number' && Date.now() - q.queuedAtEpochMs > 30000)
      );

    if (needsServerCalibration) {
      const calibrated = await syncTrustedServerTime(false);
      if (!calibrated && !(await checkWebConnectivityFast(true))) {
        return 0;
      }
    }

    const freshServerNowMs = getTrustedNowMs();
    const freshTimeMeta = getTrustedTimeMeta();

    const keepUpdatedById = new Map<string, PendingOfflineQueueItem>();
    let abortedNetwork = false;

    for (let i = 0; i < batchItems.length; i += 1) {
      const item = batchItems[i];
      if (!abortedNetwork && typeof navigator !== 'undefined' && navigator.onLine === false) {
        abortedNetwork = true;
        isNetworkCurrentlyOffline = true;
        lastConfirmedReachableEpochMs = 0;
        lastOfflineSyncError = null;
      }
      if (abortedNetwork) {
        keepUpdatedById.set(item.id, item);
        continue;
      }

      const waitedOfflineOrDelayed =
        Boolean(item.wasCreatedOffline) ||
        item.attempts > 0 ||
        typeof item.queuedAtEpochMs !== 'number' ||
        Date.now() - item.queuedAtEpochMs > 8000;
      const shouldCheckExistingOnServer =
        item.attempts > 0 || !sessionPerfAnchorIds.has(item.id);

      try {
        if (item.kind === 'create') {
          const docRef = doc(db, CAISSE_ENTRIES_COLLECTION, item.id);
          if (shouldCheckExistingOnServer) {
            const existingSnap = await raceWithTimeout(getDocFromServer(docRef), 4500);
            if (existingSnap.exists()) {
              markWebConnectivityOnline();
              syncedCount += 1;
              if (waitedOfflineOrDelayed) offlineToastSyncedCount += 1;
              continue;
            }
          }

          const keepOriginalOnlineCalibratedTimes =
            !waitedOfflineOrDelayed &&
            item.wasCalibratedAtCreation &&
            !item.hasExplicitCreatedAtOverride;

          const eventMs = resolveQueuedEventTimeMs(item, freshServerNowMs);
          const reconciledIso =
            keepOriginalOnlineCalibratedTimes || item.hasExplicitCreatedAtOverride
              ? item.payload.createdAt
              : getNextMonotonicIsoForBarber(item.payload.barberId, undefined, eventMs);
          const reconciledDate =
            keepOriginalOnlineCalibratedTimes || item.hasExplicitDateOverride
              ? item.payload.date
              : getSalonBusinessDate(new Date(eventMs));

          const finalizedEntry: CaisseEntry = {
            ...item.payload,
            date: reconciledDate,
            createdAt: reconciledIso,
            updatedAt: reconciledIso,
            timeSource: freshTimeMeta.timeSource,
            serverClockOffsetMs: freshTimeMeta.serverOffsetMs,
            offlineCreated: Boolean(item.wasCreatedOffline || item.payload.offlineCreated || item.attempts > 0),
          };

          await raceWithTimeout(
            setDoc(docRef, buildFirestoreCreateDocPayload(finalizedEntry)),
            5500
          );

          markWebConnectivityOnline();
          rebuildEntriesCacheFromBase([
            finalizedEntry,
            ...lastFirestoreEntries.filter((e) => e.id !== item.id),
          ]);
          syncedCount += 1;
          if (waitedOfflineOrDelayed) offlineToastSyncedCount += 1;
          if (finalizedEntry.creditRemainingMAD > 0) syncedCreditsHint = true;
        } else if (item.kind === 'repayment') {
          const repayRef = doc(db, CAISSE_ENTRIES_COLLECTION, item.id);
          if (shouldCheckExistingOnServer) {
            const existingSnap = await raceWithTimeout(getDocFromServer(repayRef), 4500);
            if (existingSnap.exists()) {
              markWebConnectivityOnline();
              syncedCount += 1;
              if (waitedOfflineOrDelayed) offlineToastSyncedCount += 1;
              syncedCreditsHint = true;
              continue;
            }
          }

          const keepOriginalOnlineCalibratedTimes =
            !waitedOfflineOrDelayed && item.wasCalibratedAtCreation;

          const eventMs = resolveQueuedEventTimeMs(item, freshServerNowMs);
          const reconciledIso = keepOriginalOnlineCalibratedTimes
            ? item.repaymentPayload.createdAt
            : getNextMonotonicIsoForBarber(item.repaymentPayload.barberId, undefined, eventMs);
          const reconciledDate = keepOriginalOnlineCalibratedTimes
            ? item.repaymentPayload.date
            : getSalonBusinessDate(new Date(eventMs));
          const nextRemaining = clampAmount(item.prevRemainingMAD - item.amountAppliedMAD);
          const nextStatus: CaisseCreditStatus = nextRemaining <= 0 ? 'paid' : 'partial';

          const finalizedRepayment: CaisseEntry = {
            ...item.repaymentPayload,
            date: reconciledDate,
            repaidDate: reconciledDate,
            createdAt: reconciledIso,
            updatedAt: reconciledIso,
            timeSource: freshTimeMeta.timeSource,
            serverClockOffsetMs: freshTimeMeta.serverOffsetMs,
            offlineCreated: Boolean(
              item.wasCreatedOffline || item.repaymentPayload.offlineCreated || item.attempts > 0
            ),
          };

          const batch = writeBatch(db);
          batch.update(doc(db, CAISSE_ENTRIES_COLLECTION, item.creditEntryId), {
            creditRemainingMAD: nextRemaining,
            creditStatus: nextStatus,
            repaidDate: reconciledDate,
            repaidAmountMAD: clampAmount(item.prevRepaidTotalMAD + item.amountAppliedMAD),
            updatedAt: reconciledIso,
          });
          batch.set(repayRef, buildFirestoreCreateDocPayload(finalizedRepayment));
          await raceWithTimeout(batch.commit(), 5500);

          markWebConnectivityOnline();
          rebuildEntriesCacheFromBase([
            finalizedRepayment,
            ...lastFirestoreEntries.map((entry) =>
              entry.id === item.creditEntryId
                ? {
                    ...entry,
                    creditRemainingMAD: nextRemaining,
                    creditStatus: nextStatus,
                    repaidDate: reconciledDate,
                    repaidAmountMAD: clampAmount(item.prevRepaidTotalMAD + item.amountAppliedMAD),
                    updatedAt: reconciledIso,
                  }
                : entry
            ),
          ]);
          syncedCount += 1;
          if (waitedOfflineOrDelayed) offlineToastSyncedCount += 1;
          syncedCreditsHint = true;
        }
      } catch (err) {
        if (isLikelyNetworkOfflineError(err)) {
          abortedNetwork = true;
          isNetworkCurrentlyOffline = true;
          lastConfirmedReachableEpochMs = 0;
          lastOfflineSyncError = null;
          keepUpdatedById.set(item.id, {
            ...item,
            wasCreatedOffline: true,
            attempts: item.attempts + 1,
            lastError: err instanceof Error ? err.message : String(err),
          });
        } else {
          lastOfflineSyncError = err instanceof Error ? err.message : String(err);
          keepUpdatedById.set(item.id, {
            ...item,
            attempts: item.attempts + 1,
            lastError: lastOfflineSyncError,
          });
        }
      }
    }

    // Merge carefully with current live offlineQueue so entries added during async flush are NEVER dropped
    const mergedRemaining: PendingOfflineQueueItem[] = [];
    const seenMergedIds = new Set<string>();
    for (const batchItem of batchItems) {
      const updated = keepUpdatedById.get(batchItem.id);
      if (updated && !seenMergedIds.has(updated.id)) {
        mergedRemaining.push(updated);
        seenMergedIds.add(updated.id);
      }
    }
    for (const liveItem of offlineQueue) {
      if (!processedIds.has(liveItem.id) && !seenMergedIds.has(liveItem.id)) {
        mergedRemaining.push(liveItem);
        seenMergedIds.add(liveItem.id);
        flushNeedsRerun = true;
      }
    }

    saveOfflineQueue(mergedRemaining);
    rebuildEntriesCacheFromBase(lastFirestoreEntries, false);
    notifyEntriesListeners();

    if (syncedCount > 0) {
      emitRealtimeSyncHint('caisse');
      if (syncedCreditsHint) {
        emitRealtimeSyncHint('credits');
      }
    }

    if (offlineToastSyncedCount > 0) {
      showToast(
        `تمت مزامنة ${offlineToastSyncedCount} ${offlineToastSyncedCount === 1 ? 'عملية معلقة' : 'عمليات معلقة'} مع السحابة ✓`,
        'تم حفظ جميع التواريخ والمبالغ بتوقيت الخادم الموثوق.',
        'success'
      );
    }

    return syncedCount;
  } finally {
    isFlushingOfflineQueue = false;
    notifyOfflineStatusListeners();
    if (flushNeedsRerun) {
      flushNeedsRerun = false;
      if (offlineQueue.length > 0 && isWebConnectionAvailableSync()) {
        void flushOfflineCaisseQueue();
      }
    }
  }
}

function bindOfflineCaisseHooks(): void {
  if (offlineHooksBound || typeof window === 'undefined') return;
  offlineHooksBound = true;

  const recoverConnectionAndFlush = async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      markWebConnectivityOffline(null);
      return;
    }
    const ok = await checkWebConnectivityFast(true);
    if (ok && offlineQueue.length > 0) {
      await flushOfflineCaisseQueue(false);
    }
  };

  const handleOnline = () => {
    void recoverConnectionAndFlush();
  };
  const handleOffline = () => {
    markWebConnectivityOffline(null);
  };
  const handleWake = () => {
    void recoverConnectionAndFlush();
  };

  try {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleWake);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') handleWake();
      });
    }
    window.setInterval(() => {
      if (isNetworkCurrentlyOffline || offlineQueue.length > 0) {
        void recoverConnectionAndFlush();
      }
    }, 8000);
    // Initial lightweight check so web-mode connectivity status is accurate before user submits
    if (offlineQueue.length > 0) {
      void recoverConnectionAndFlush();
    } else {
      void checkWebConnectivityFast(false);
    }
  } catch {
    // Ignore restricted environment hook failures
  }
}

if (typeof window !== 'undefined') {
  bindOfflineCaisseHooks();
}

export function useCaisseOfflineStatus(): CaisseOfflineStatus {
  const [status, setStatus] = useState<Omit<CaisseOfflineStatus, 'flushNow'>>(() =>
    getCurrentOfflineStatusSnapshot()
  );

  useEffect(() => {
    bindOfflineCaisseHooks();
    const syncState = () => setStatus(getCurrentOfflineStatusSnapshot());
    syncState();
    offlineStatusListeners.add(syncState);
    return () => {
      offlineStatusListeners.delete(syncState);
    };
  }, []);

  return {
    ...status,
    flushNow: () => flushOfflineCaisseQueue(true),
  };
}

export function subscribeToCaisseEntries(cb: (entries: CaisseEntry[]) => void): () => void {
  bindOfflineCaisseHooks();
  entryListeners.add(cb);
  ensureEntriesListener();
  if (hasEntriesHydrated || offlineQueue.length > 0) cb(entriesCache);
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
            next[d.id] = coerceCaisseSettlementDoc(d.data(), d.id);
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
        next[d.id] = coerceCaisseSettlementDoc(d.data(), d.id);
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

// ---------- Cumulative Cycle Settlements & Daily Archives ----------

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
            snap.docs.map((d) => coerceCaisseCycleDoc(d.data(), d.id))
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
        snapshot.docs.map((d) => coerceCaisseCycleDoc(d.data(), d.id))
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
            next[d.id] = coerceCaisseArchiveDoc(d.data(), d.id);
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
        next[d.id] = coerceCaisseArchiveDoc(d.data(), d.id);
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
            next[d.id] = coerceDailyNoteDoc(d.data(), d.id);
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
        next[d.id] = coerceDailyNoteDoc(d.data(), d.id);
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
  adjustmentDirection?: 'credit' | 'debit';
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
  createdAtOverride?: string;
}

export function queueCaisseEntryInstant(input: CreateCaisseEntryInput): CaisseEntry {
  const effectiveBarberId: CaisseBarberId = isFloatEntryType(input.type)
    ? 'hassan'
    : input.barberId;

  const connectionAvailable = isWebConnectionAvailableSync();
  const timeMeta = getTrustedTimeMeta();
  if (connectionAvailable && !timeMeta.isCalibrated) {
    // Non-blocking warm-up so submit never waits on network latency
    void syncTrustedServerTime(false);
  }

  const trustedNowMs = getTrustedNowMs();
  const deviceOrigin = getCurrentDeviceOrigin();
  const deviceClockISO = new Date().toISOString().slice(0, 64);

  const hasExplicitCreatedAtOverride = Boolean(
    input.createdAtOverride && input.createdAtOverride.trim()
  );
  const currentTrustedBizDate = getSalonBusinessDate(new Date(trustedNowMs));
  const rawInputDate = String(input.date || '').trim().slice(0, 20);
  const hasExplicitHistoricalDate = Boolean(
    rawInputDate && rawInputDate !== currentTrustedBizDate && hasExplicitCreatedAtOverride
  );

  const nowIso = hasExplicitCreatedAtOverride
    ? input.createdAtOverride!.trim().slice(0, 64)
    : getNextMonotonicIsoForBarber(effectiveBarberId, undefined, trustedNowMs);

  const rand = Math.random().toString(36).slice(2, 7);
  const id = sanitizeId(`ce_${trustedNowMs}_${SESSION_BOOT_EPOCH}_${rand}`, 'ce');
  const meta = getCaisseBarberMeta(effectiveBarberId);

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
    barberId: effectiveBarberId,
    barberName: (isFloatEntryType(input.type) ? meta.name : input.barberName || meta.name)
      .trim()
      .slice(0, 100),
    type: input.type,
    date: rawInputDate || currentTrustedBizDate,
    expectedAmountMAD: expected,
    amountPaidMAD: paid,
    creditAmountMAD: creditTotal,
    creditRemainingMAD: creditRemaining,
    creditStatus,
    createdByRole: input.createdByRole,
    createdByName: String(input.createdByName || meta.name).trim().slice(0, 100),
    createdAt: nowIso,
    updatedAt: nowIso,
    deviceKind: deviceOrigin.deviceKind,
    deviceId: deviceOrigin.deviceId,
    deviceLabel: deviceOrigin.deviceLabel,
    devicePlatform: deviceOrigin.devicePlatform,
    deviceBrowser: deviceOrigin.deviceBrowser,
    timeSource: timeMeta.timeSource,
    serverClockOffsetMs: timeMeta.serverOffsetMs,
    deviceClockISO,
    offlineCreated: !connectionAvailable,
  };

  if (input.type === 'barber_adjustment') {
    payload.adjustmentDirection = input.adjustmentDirection === 'debit' ? 'debit' : 'credit';
  }

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

  const perfNow = typeof performance !== 'undefined' ? performance.now() : trustedNowMs;
  const queuedAtEpochMs = Date.now();
  sessionPerfAnchorIds.add(id);

  const queuedEntry: CaisseEntry = {
    ...payload,
    offlineCreated: !connectionAvailable,
    offlinePending: true,
  };

  const nextQueue: PendingOfflineQueueItem[] = [
    ...offlineQueue.filter((q) => q.id !== id),
    {
      kind: 'create',
      id,
      payload: { ...payload, offlineCreated: !connectionAvailable },
      hasExplicitDateOverride: hasExplicitHistoricalDate || Boolean(hasExplicitCreatedAtOverride),
      hasExplicitCreatedAtOverride,
      queuedAtPerfMs: perfNow,
      queuedAtTrustedMs: trustedNowMs,
      queuedAtEpochMs,
      wasCalibratedAtCreation: timeMeta.isCalibrated,
      wasCreatedOffline: !connectionAvailable,
      attempts: 0,
    },
  ];

  // Instant local commit: update persistent local cache, live ledger cache, and UI listeners immediately
  saveOfflineQueue(nextQueue);
  rebuildEntriesCacheFromBase(lastFirestoreEntries, false);
  hasEntriesHydrated = true;
  notifyEntriesListeners();
  notifyOfflineStatusListeners();

  // Only attempt remote sync after checking connectivity; offline entries stay safely in local cache until online
  if (connectionAvailable) {
    scheduleDelayedPendingBannerCheck();
    void flushOfflineCaisseQueue(false);
  }

  return queuedEntry;
}

export async function addCaisseEntry(input: CreateCaisseEntryInput): Promise<CaisseEntry> {
  return queueCaisseEntryInstant(input);
}

export interface UpdateCaisseEntryPatch {
  barberId?: CaisseBarberId;
  barberName?: string;
  type?: CaisseEntryType;
  adjustmentDirection?: 'credit' | 'debit';
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
      updatedAt: new Date(getTrustedNowMs()).toISOString().slice(0, 64),
    };

    const resolvedPatchType = patch.type;
    const isFloatType = isFloatEntryType(resolvedPatchType);
    const forcedBarberId = isFloatType ? 'hassan' : patch.barberId;

    if (forcedBarberId !== undefined) {
      updatePayload.barberId = forcedBarberId;
      updatePayload.barberName = (
        isFloatType
          ? getCaisseBarberMeta('hassan').name
          : patch.barberName || getCaisseBarberMeta(forcedBarberId).name
      )
        .trim()
        .slice(0, 100);
    } else if (patch.barberName !== undefined) {
      updatePayload.barberName = patch.barberName.trim().slice(0, 100);
    }

    if (patch.type !== undefined) updatePayload.type = patch.type;
    if (patch.type !== undefined && patch.type !== 'barber_adjustment') {
      updatePayload.adjustmentDirection = deleteField();
    } else if (patch.adjustmentDirection !== undefined) {
      updatePayload.adjustmentDirection = patch.adjustmentDirection === 'debit' ? 'debit' : 'credit';
    }
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
    rebuildEntriesCacheFromBase(
      lastFirestoreEntries.map((item) => {
        if (item.id !== entryId) return item;
        const merged: CaisseEntry = {
          ...item,
          updatedAt: String(updatePayload.updatedAt),
        };
        if (forcedBarberId !== undefined) {
          merged.barberId = forcedBarberId;
          merged.barberName = String(updatePayload.barberName || item.barberName);
        } else if (patch.barberName !== undefined) {
          merged.barberName = String(updatePayload.barberName || item.barberName);
        }
        if (patch.type !== undefined) merged.type = patch.type;
        if (patch.type !== undefined && patch.type !== 'barber_adjustment') {
          merged.adjustmentDirection = undefined;
        } else if (patch.adjustmentDirection !== undefined) {
          merged.adjustmentDirection = patch.adjustmentDirection === 'debit' ? 'debit' : 'credit';
        }
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
  // If queued locally and not yet synced, remove directly from offline queue cleanly
  const queuedMatch = offlineQueue.find((q) => q.id === entryId);
  if (queuedMatch) {
    saveOfflineQueue(offlineQueue.filter((q) => q.id !== entryId));
    rebuildEntriesCacheFromBase(lastFirestoreEntries.filter((item) => item.id !== entryId));
    notifyEntriesListeners();
    notifyOfflineStatusListeners();
    return;
  }
  try {
    await deleteDoc(doc(db, CAISSE_ENTRIES_COLLECTION, entryId));
    rebuildEntriesCacheFromBase(lastFirestoreEntries.filter((item) => item.id !== entryId));
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
export function queueCaisseCreditRepaymentInstant(params: {
  creditEntry: CaisseEntry;
  amountRepaidMAD: number;
  repaidDate: string;
  actorRole: StaffRole;
  actorName: string;
  note?: string;
}): CaisseEntry {
  const { creditEntry, amountRepaidMAD, repaidDate, actorRole, actorName, note } = params;
  const applied = Math.min(
    clampAmount(creditEntry.creditRemainingMAD),
    clampAmount(amountRepaidMAD)
  );
  if (applied <= 0) {
    throw new Error('المبلغ المؤدى يجب أن يكون أكبر من 0 درهم.');
  }

  const connectionAvailable = isWebConnectionAvailableSync();
  const timeMeta = getTrustedTimeMeta();
  if (connectionAvailable && !timeMeta.isCalibrated) {
    void syncTrustedServerTime(false);
  }

  const trustedNowMs = getTrustedNowMs();
  const deviceOrigin = getCurrentDeviceOrigin();
  const deviceClockISO = new Date().toISOString().slice(0, 64);

  const nowIso = getNextMonotonicIsoForBarber(creditEntry.barberId, undefined, trustedNowMs);
  const prevRepaidTotal = clampAmount(creditEntry.repaidAmountMAD || 0);
  const repaidDateClean = String(repaidDate || getSalonBusinessDate(new Date(trustedNowMs))).slice(0, 20);

  const serviceDesc =
    creditEntry.serviceNames && creditEntry.serviceNames.length > 0
      ? creditEntry.serviceNames.join(' + ')
      : 'سداد دين خدمة';

  const repaymentId = sanitizeId(
    `ce_${trustedNowMs}_${SESSION_BOOT_EPOCH}_${Math.random().toString(36).slice(2, 7)}`,
    'ce'
  );
  const meta = getCaisseBarberMeta(creditEntry.barberId);
  const repaymentPayload: CaisseEntry = {
    id: repaymentId,
    barberId: creditEntry.barberId,
    barberName: (creditEntry.barberName || meta.name).trim().slice(0, 100),
    type: 'credit_repayment',
    date: repaidDateClean,
    expectedAmountMAD: applied,
    amountPaidMAD: applied,
    creditAmountMAD: 0,
    creditRemainingMAD: 0,
    creditStatus: 'none',
    parentCreditEntryId: creditEntry.id,
    repaidDate: repaidDateClean,
    repaidAmountMAD: applied,
    note: (
      note?.trim() ||
      `أداء كريدي (${creditEntry.clientName || 'زبون'}) • ${serviceDesc} • أصل الدين يوم ${creditEntry.date}`
    ).slice(0, 400),
    createdByRole: actorRole,
    createdByName: String(actorName || meta.name).trim().slice(0, 100),
    createdAt: nowIso,
    updatedAt: nowIso,
    deviceKind: deviceOrigin.deviceKind,
    deviceId: deviceOrigin.deviceId,
    deviceLabel: deviceOrigin.deviceLabel,
    devicePlatform: deviceOrigin.devicePlatform,
    deviceBrowser: deviceOrigin.deviceBrowser,
    timeSource: timeMeta.timeSource,
    serverClockOffsetMs: timeMeta.serverOffsetMs,
    deviceClockISO,
    offlineCreated: !connectionAvailable,
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

  const perfNow = typeof performance !== 'undefined' ? performance.now() : trustedNowMs;
  const queuedAtEpochMs = Date.now();
  sessionPerfAnchorIds.add(repaymentId);

  const queuedItem: PendingOfflineQueueItem = {
    kind: 'repayment',
    id: repaymentId,
    creditEntryId: creditEntry.id,
    prevRemainingMAD: clampAmount(creditEntry.creditRemainingMAD),
    prevRepaidTotalMAD: prevRepaidTotal,
    amountAppliedMAD: applied,
    repaymentPayload: { ...repaymentPayload, offlineCreated: !connectionAvailable },
    queuedAtPerfMs: perfNow,
    queuedAtTrustedMs: trustedNowMs,
    queuedAtEpochMs,
    wasCalibratedAtCreation: timeMeta.isCalibrated,
    wasCreatedOffline: !connectionAvailable,
    attempts: 0,
  };

  saveOfflineQueue([...offlineQueue.filter((q) => q.id !== repaymentId), queuedItem]);
  rebuildEntriesCacheFromBase(lastFirestoreEntries, false);
  hasEntriesHydrated = true;
  notifyEntriesListeners();
  notifyOfflineStatusListeners();

  if (connectionAvailable) {
    scheduleDelayedPendingBannerCheck();
    void flushOfflineCaisseQueue(false);
  }

  return { ...repaymentPayload, offlineCreated: !connectionAvailable, offlinePending: true };
}

export async function recordCaisseCreditRepayment(params: {
  creditEntry: CaisseEntry;
  amountRepaidMAD: number;
  repaidDate: string;
  actorRole: StaffRole;
  actorName: string;
  note?: string;
}): Promise<CaisseEntry> {
  return queueCaisseCreditRepaymentInstant(params);
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
    updatedAt: new Date(getTrustedNowMs()).toISOString().slice(0, 64),
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
  const nowIso = new Date(getTrustedNowMs()).toISOString().slice(0, 64);
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

export interface BarberLastDailyCloseInfo {
  closedIso: string | null;
  closedDate: string | null;
  settlement: CaisseDailySettlement | null;
}

/**
 * Canonical daily-cycle anchor ("آخر تصفية حساب يومي"):
 * Finds the most recent `intakeClosed` settlement timestamp across ALL dates
 * for a given barber so the open daily cycle does NOT reset automatically on any clock hour
 * (midnight, 03:00, etc.) and ONLY resets when "تصفية الحساب اليومي" is explicitly executed.
 */
export function getBarberLastDailyCloseInfo(
  barberId: CaisseBarberId,
  settlementsMap?: Record<string, CaisseDailySettlement>,
  rosterMembers?: RosterMemberAccount[]
): BarberLastDailyCloseInfo {
  if (!settlementsMap) {
    return { closedIso: null, closedDate: null, settlement: null };
  }
  let bestSettlement: CaisseDailySettlement | null = null;
  let bestIso = '';
  Object.values(settlementsMap).forEach((s) => {
    if (!s || !s.intakeClosed) return;
    if (!matchesCaisseBarber(s.barberId, s.barberName, barberId, rosterMembers)) return;
    const candidateIso =
      asIsoString(s.confirmedAt, '') ||
      asIsoString(s.updatedAt, '') ||
      (s.date ? `${s.date}T23:59:59.999Z` : '');
    if (candidateIso && (!bestIso || candidateIso > bestIso)) {
      bestIso = candidateIso;
      bestSettlement = s;
    }
  });
  return {
    closedIso: bestIso || null,
    closedDate: bestSettlement ? asDateString((bestSettlement as CaisseDailySettlement).date, '') || null : null,
    settlement: bestSettlement,
  };
}

/**
 * Closes the active daily cycle for a barber ("تصفية الحساب اليومي"),
 * advancing their `intakeClosed` anchor timestamp past all currently open entries
 * so the daily drawer & daily figures reset cleanly to 0 across all accounts/devices,
 * while leaving cumulative/monthly balances (`cycleBalance`) untouched.
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
    floatMAD: Math.max(0, params.dayStats.floatMAD),
    expensesMAD: Math.max(0, params.dayStats.expensesMAD),
    carryOverOwedMAD: Math.max(0, params.carryOverOwedMAD),
    resetCount: (params.existingSettlement?.resetCount ?? 0) + 1,
    intakeClosed: true,
    grossIntakeClosedMAD: Math.max(0, params.dayStats.incomeMAD),
    settlementMode: 'daily_intake',
    note:
      params.note?.trim() ||
      `تصفية الحساب اليومي (${params.dayStats.incomeMAD} MAD)`,
    confirmedBy: params.confirmedBy,
    confirmedAtOverride: params.maxEntryCreatedAt,
  });
}

/**
 * Atomically closes all unclosed open-daily entries for all barbers through now
 * (regardless of how many calendar days elapsed since the previous daily settlement),
 * resetting the physical drawer ("الحساب في المجر") cleanly to 0 MAD while preserving
 * all monthly / cumulative cycle balances.
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

  const nowIso = new Date(getTrustedNowMs()).toISOString().slice(0, 64);
  const payloads: CaisseDailySettlement[] = [];

  for (const barber of barbers) {
    const openDaily = computeBarberOpenDailyStats({
      barberId: barber.id,
      entries,
      settingsMap,
      settlementsMap,
      cycles,
      rosterMembers,
      referenceDate: throughDate,
    });

    if (openDaily.openEntries.length === 0) {
      continue;
    }

    const bCycle = computeBarberCycleBalance(
      barber.id,
      entries,
      settingsMap,
      cycles,
      throughDate,
      manualCredits,
      rosterMembers
    );

    const existingSettle = findBarberDaySettlement(
      barber.id,
      throughDate,
      settlementsMap,
      rosterMembers
    );

    let maxCreatedAt = nowIso;
    if (openDaily.lastDailyCloseIso && openDaily.lastDailyCloseIso >= maxCreatedAt) {
      const nextMs = Date.parse(openDaily.lastDailyCloseIso);
      if (Number.isFinite(nextMs)) {
        maxCreatedAt = new Date(nextMs + 1).toISOString().slice(0, 64);
      }
    }
    for (const pe of openDaily.openEntries) {
      if (pe.createdAt && pe.createdAt > maxCreatedAt) {
        maxCreatedAt = pe.createdAt.slice(0, 64);
      }
    }

    const id = existingSettle?.id || sanitizeId(`${barber.id}_${throughDate}`, 'cs');

    payloads.push({
      id,
      barberId: barber.id,
      barberName: String(barber.name).trim().slice(0, 100),
      date: String(throughDate).slice(0, 20),
      collected: Boolean(existingSettle?.collected),
      collectedAmountMAD: clampAmount(existingSettle?.collectedAmountMAD ?? 0),
      barberShareMAD: clampAmount(Math.max(0, openDaily.barberNetShareMAD)),
      shopShareMAD: clampAmount(Math.max(0, openDaily.shopShareMAD)),
      floatMAD: clampAmount(Math.max(0, openDaily.floatMAD)),
      expensesMAD: clampAmount(Math.max(0, openDaily.expensesMAD)),
      carryOverOwedMAD: clampAmount(Math.max(0, bCycle.barberNetOwedMAD)),
      resetCount: Math.max(0, Math.min(1000, (existingSettle?.resetCount ?? 0) + 1)),
      intakeClosed: true,
      grossIntakeClosedMAD: clampAmount(Math.max(0, openDaily.incomeMAD)),
      settlementMode: 'daily_intake',
      note: `تصفية الحساب اليومي (${openDaily.incomeMAD} MAD)`,
      confirmedBy: String(confirmedBy || 'Hassan ait boumlik').trim().slice(0, 100),
      confirmedAt: maxCreatedAt,
      updatedAt: maxCreatedAt,
    });
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
  barberAdjustmentMAD: number;
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
      matchesCaisseFinancialBarber(e, barberId, rosterMembers)
  );

  let directIncomeMAD = 0;
  let repaymentIncomeMAD = 0;
  let creditsIssuedMAD = 0;
  let expensesMAD = 0;
  let floatInMAD = 0;
  let floatOutMAD = 0;
  let barberAdjustmentMAD = 0;

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
    } else if (e.type === 'barber_adjustment') {
      const adjAmt = Number(e.amountPaidMAD) || 0;
      barberAdjustmentMAD += e.adjustmentDirection === 'debit' ? -adjAmt : adjAmt;
    }
  }

  const floatMAD = Math.round(floatInMAD - floatOutMAD);
  const incomeMAD = clampAmount(directIncomeMAD + repaymentIncomeMAD);
  const pct = Math.max(0, Math.min(100, commissionPercent));
  const barberGrossShareMAD = Math.round(incomeMAD * (pct / 100));
  const shopShareMAD = Math.max(0, Math.round(incomeMAD - barberGrossShareMAD));
  const roundedAdj = Math.round(barberAdjustmentMAD);
  const barberNetShareMAD =
    barberId === 'hassan'
      ? Math.round(barberGrossShareMAD + floatMAD - expensesMAD + roundedAdj)
      : Math.round(barberGrossShareMAD - expensesMAD + roundedAdj);
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
    barberAdjustmentMAD: roundedAdj,
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
  const safeRefDate = asDateString(referenceDate, getSalonBusinessDate());
  const month = safeRefDate.slice(0, 7);

  const dateSet = new Set<string>();
  entries.forEach((e) => {
    const ed = asDateString(e.date, '');
    if (e.barberId === barberId && ed.startsWith(month) && ed < safeRefDate) {
      dateSet.add(ed);
    }
  });
  Object.values(settlementsMap).forEach((s) => {
    const sd = asDateString(s.date, '');
    if (s.barberId === barberId && sd.startsWith(month) && sd < safeRefDate) {
      dateSet.add(sd);
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
        asDateString(e.date, '').startsWith(monthYYYYMM) &&
        matchesCaisseFinancialBarber(e, barber.id, rosterMembers)
    );

    const uniqueDates = Array.from(
      new Set(barberMonthEntries.map((e) => asDateString(e.date, '')).filter(Boolean))
    ).sort();

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
        const recDate = asDateString(r.creditDate, '') || asIsoString(r.createdAt, '').slice(0, 10);
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
  const entryCreatedIso = asIsoString(entry.createdAt, '');
  const entryDate = asDateString(entry.date, '');
  for (const cyc of barberCycles) {
    const cycSettledIso = asIsoString(cyc.settledThroughIso, '');
    if (!cycSettledIso || entryCreatedIso > cycSettledIso) continue;
    if (!cyc.settlementPeriodScope || cyc.settlementPeriodScope === 'full_open') {
      return true;
    }
    if (cyc.periodStartDate && cyc.periodEndDate) {
      if (entryDate >= cyc.periodStartDate && entryDate <= cyc.periodEndDate) {
        return true;
      }
    } else if (cyc.settlementPeriodScope === 'month' && cyc.periodStartDate) {
      const monthPrefix = asStr(cyc.periodStartDate, '').slice(0, 7);
      if (monthPrefix && entryDate.startsWith(monthPrefix)) {
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
  barberAdjustmentMAD: number;
  carryForwardMAD: number;
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
  fallbackDate: string = getSalonBusinessDate(),
  rosterMembers?: RosterMemberAccount[]
): {
  incomeMAD: number;
  expensesMAD: number;
  floatInMAD: number;
  floatOutMAD: number;
  floatMAD: number;
  barberAdjustmentMAD: number;
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
  let barberAdjustmentMAD = 0;
  let drawerCashMAD = 0;
  let creditsIssuedMAD = 0;
  let barberGrossShareMAD = 0;
  let barberNetOwedMAD = 0;
  let shopShareMAD = 0;

  for (const d of uniqueDates) {
    const dayPct = getEffectiveCommissionPercentForDate(barberId, d, settingsMap);
    const ds = computeBarberDayStats(barberId, d, targetEntries, dayPct, rosterMembers);
    incomeMAD += ds.incomeMAD;
    expensesMAD += ds.expensesMAD;
    floatInMAD += ds.floatInMAD;
    floatOutMAD += ds.floatOutMAD;
    floatMAD += ds.floatMAD;
    barberAdjustmentMAD += ds.barberAdjustmentMAD;
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
    barberAdjustmentMAD: Math.round(barberAdjustmentMAD),
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
    .sort((a, b) => safeCompareDesc(a.settledThroughIso, b.settledThroughIso));
  const latestCycle = barberCycles[0] || null;
  const lastSettledIso = latestCycle ? latestCycle.settledThroughIso : null;
  const lastSettledDate = latestCycle ? latestCycle.settledThroughDate : null;

  const carryForwardMAD =
    latestCycle &&
    typeof latestCycle.carryForwardBalanceMAD === 'number' &&
    Number.isFinite(latestCycle.carryForwardBalanceMAD)
      ? Math.round(latestCycle.carryForwardBalanceMAD)
      : 0;

  const openCycleEntries = entries.filter(
    (e) =>
      matchesCaisseFinancialBarber(e, barberId, rosterMembers) &&
      !isEntrySettledByCycles(e, barberCycles)
  );

  const summary = summarizeBarberEntriesWithSettings(
    barberId,
    openCycleEntries,
    settingsMap,
    referenceDate,
    rosterMembers
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
    barberAdjustmentMAD: summary.barberAdjustmentMAD,
    carryForwardMAD,
    drawerCashMAD: summary.drawerCashMAD,
    creditsIssuedMAD: summary.creditsIssuedMAD,
    barberGrossShareMAD: summary.barberGrossShareMAD,
    barberNetOwedMAD: Math.round(summary.barberNetOwedMAD + carryForwardMAD),
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
  rosterMembers?: RosterMemberAccount[];
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
    rosterMembers,
  } = params;

  const fullCycle = computeBarberCycleBalance(
    barberId,
    entries,
    settingsMap,
    cycles,
    referenceDate,
    undefined,
    rosterMembers
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
    rangeEnd,
    rosterMembers
  );

  const includeCarryForward =
    fullCycle.carryForwardMAD !== 0 &&
    (!fullCycle.lastSettledDate || rangeEnd >= fullCycle.lastSettledDate);
  const appliedCarryForward = includeCarryForward ? fullCycle.carryForwardMAD : 0;

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
      barberAdjustmentMAD: summary.barberAdjustmentMAD,
      carryForwardMAD: appliedCarryForward,
      drawerCashMAD: summary.drawerCashMAD,
      creditsIssuedMAD: summary.creditsIssuedMAD,
      barberGrossShareMAD: summary.barberGrossShareMAD,
      barberNetOwedMAD: Math.round(summary.barberNetOwedMAD + appliedCarryForward),
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
  negativeResolution?: 'cleared' | 'carried_forward';
  carryForwardBalanceMAD?: number;
  note?: string;
}): Promise<CaisseCycleSettlement> {
  const {
    cycleBalance,
    confirmedBy,
    businessDate,
    settlementPeriodScope = 'full_open',
    periodStartDate,
    periodEndDate,
    negativeResolution,
    carryForwardBalanceMAD,
    note,
  } = params;
  let settledThroughIso = new Date(getTrustedNowMs()).toISOString().slice(0, 64);
  if (cycleBalance.lastSettledIso && settledThroughIso <= cycleBalance.lastSettledIso) {
    const prevMs = Date.parse(cycleBalance.lastSettledIso);
    if (Number.isFinite(prevMs)) {
      settledThroughIso = new Date(prevMs + 2).toISOString().slice(0, 64);
    }
  }
  for (const e of cycleBalance.openCycleEntries) {
    if (e.createdAt && e.createdAt >= settledThroughIso) {
      const eMs = Date.parse(e.createdAt);
      settledThroughIso = Number.isFinite(eMs)
        ? new Date(eMs + 1).toISOString().slice(0, 64)
        : e.createdAt.slice(0, 64);
    }
  }
  const nowIso = new Date(getTrustedNowMs()).toISOString().slice(0, 64);
  const meta = getCaisseBarberMeta(cycleBalance.barberId);
  const id = sanitizeId(`${cycleBalance.barberId}_cyc_${getTrustedNowMs()}`, 'cyc');

  let finalBarberSharePaidMAD = Math.max(
    -10000000,
    Math.min(10000000, Math.round(cycleBalance.barberNetOwedMAD))
  );
  let resolvedCarryForwardMAD: number | undefined = undefined;
  let resolvedNegativeMode: 'cleared' | 'carried_forward' | undefined = negativeResolution;
  let finalEntryCount = Math.max(0, cycleBalance.openCycleEntries.length);

  if (cycleBalance.barberNetOwedMAD < 0) {
    if (negativeResolution === 'cleared') {
      const clearAmt = Math.abs(Math.round(cycleBalance.barberNetOwedMAD));
      if (clearAmt > 0) {
        await addCaisseEntry({
          barberId: cycleBalance.barberId,
          barberName: meta.name,
          type: 'barber_adjustment',
          adjustmentDirection: 'credit',
          date: String(periodEndDate || businessDate || getSalonBusinessDate()).slice(0, 20),
          expectedAmountMAD: clearAmt,
          amountPaidMAD: clearAmt,
          creditAmountMAD: 0,
          creditRemainingMAD: 0,
          creditStatus: 'none',
          note: `تصفير الرصيد السالب عند تصفية الحساب الشهري (+${clearAmt} MAD معزول للحلاق)`,
          createdByRole: 'master',
          createdByName: String(confirmedBy || 'Hassan ait boumlik').trim().slice(0, 100),
          createdAtOverride: settledThroughIso,
        });
        finalEntryCount += 1;
      }
      finalBarberSharePaidMAD = 0;
      resolvedCarryForwardMAD = 0;
      resolvedNegativeMode = 'cleared';
    } else if (negativeResolution === 'carried_forward') {
      const carriedVal =
        typeof carryForwardBalanceMAD === 'number' && Number.isFinite(carryForwardBalanceMAD)
          ? Math.round(carryForwardBalanceMAD)
          : Math.round(cycleBalance.barberNetOwedMAD);
      resolvedCarryForwardMAD = Math.max(-10000000, Math.min(10000000, carriedVal));
      resolvedNegativeMode = 'carried_forward';
    }
  }

  const payload: CaisseCycleSettlement = {
    id,
    barberId: cycleBalance.barberId,
    barberName: meta.name,
    settledThroughIso,
    settledThroughDate: String(businessDate || getSalonBusinessDate()).slice(0, 20),
    settlementPeriodScope,
    totalCollectedMAD: clampAmount(cycleBalance.incomeMAD, 10000000),
    barberSharePaidMAD: finalBarberSharePaidMAD,
    shopShareMAD: clampAmount(cycleBalance.shopShareMAD, 10000000),
    expensesMAD: clampAmount(cycleBalance.expensesMAD, 10000000),
    floatMAD: clampAmount(cycleBalance.floatMAD, 10000000),
    creditsIssuedMAD: clampAmount(cycleBalance.creditsIssuedMAD, 10000000),
    entryCount: finalEntryCount,
    confirmedBy: String(confirmedBy || 'Hassan ait boumlik').trim().slice(0, 100),
    confirmedAt: nowIso,
  };
  if (resolvedCarryForwardMAD !== undefined) {
    payload.carryForwardBalanceMAD = resolvedCarryForwardMAD;
  }
  if (resolvedNegativeMode !== undefined) {
    payload.negativeResolution = resolvedNegativeMode;
  }
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
  limit: number = 14,
  rosterMembers?: RosterMemberAccount[]
): BarberDailyInOutRow[] {
  const byDate = new Map<string, CaisseEntry[]>();
  entries.forEach((e) => {
    if (!matchesCaisseFinancialBarber(e, barberId, rosterMembers)) return;
    const list = byDate.get(e.date) || [];
    list.push(e);
    byDate.set(e.date, list);
  });

  Object.values(settlementsMap).forEach((s) => {
    if (matchesCaisseBarber(s.barberId, s.barberName, barberId, rosterMembers) && !byDate.has(s.date)) {
      byDate.set(s.date, []);
    }
  });

  return Array.from(byDate.keys())
    .sort((a, b) => safeCompareDesc(a, b))
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
      const settlement = findBarberDaySettlement(barberId, date, settlementsMap, rosterMembers);
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

// ---------- Historical Daily Summary Archives (Read-Only History, Never Resets Balances) ----------

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
    const nowIso = new Date(getTrustedNowMs()).toISOString().slice(0, 64);
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

/**
 * Computes a safe `createdAtOverride` timestamp when Master Admin adds a backdated
 * transaction onto a closed ("مغلق") or historical day so the entry sits inside that
 * day's closed window without leaking into today's already-reset open daily drawer.
 */
export function computeClosedDayCreatedAtOverride(params: {
  barberId: CaisseBarberId;
  date: string;
  entries?: CaisseEntry[];
  settlementsMap?: Record<string, CaisseDailySettlement>;
  rosterMembers?: RosterMemberAccount[];
  businessTodayStr?: string;
}): string | undefined {
  const {
    barberId,
    date,
    entries = entriesCache,
    settlementsMap = settlementsCache,
    rosterMembers,
    businessTodayStr = getSalonBusinessDate(),
  } = params;

  const daySettlement = findBarberDaySettlement(barberId, date, settlementsMap, rosterMembers);
  const lastClose = getBarberLastDailyCloseInfo(barberId, settlementsMap, rosterMembers);

  const isDayClosed = Boolean(daySettlement?.intakeClosed);
  const isCoveredByLaterClose = Boolean(
    lastClose.closedIso &&
      date < businessTodayStr &&
      (!lastClose.closedDate || lastClose.closedDate >= date)
  );

  if (!isDayClosed && !isCoveredByLaterClose) {
    return undefined;
  }

  let targetMs = Date.parse(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(targetMs)) {
    targetMs = getTrustedNowMs() - 86_400_000;
  }

  const anchorCandidates = [
    daySettlement?.confirmedAt,
    daySettlement?.updatedAt,
    lastClose.closedIso,
  ].filter((iso): iso is string => Boolean(iso));

  for (const iso of anchorCandidates) {
    const ms = Date.parse(iso);
    if (Number.isFinite(ms) && targetMs >= ms) {
      targetMs = ms - 1000;
    }
  }

  const existingSet = new Set(entries.map((e) => e.createdAt));
  let candidateIso = new Date(targetMs).toISOString().slice(0, 64);
  let guard = 0;
  while (existingSet.has(candidateIso) && guard < 100) {
    targetMs -= 10;
    candidateIso = new Date(targetMs).toISOString().slice(0, 64);
    guard += 1;
  }
  return candidateIso;
}

/**
 * Recomputes and persists `caisse_daily_archives` and any existing `caisse_settlements`
 * snapshot totals after Master Admin adds, edits, or deletes an entry on a closed/past day,
 * without altering the `confirmedAt` daily-close anchor timestamp.
 */
export async function resyncBarberDayArchiveAndSettlement(params: {
  barberId: CaisseBarberId;
  date: string;
  entries?: CaisseEntry[];
  settingsMap?: Record<string, CaisseBarberSetting>;
  settlementsMap?: Record<string, CaisseDailySettlement>;
  rosterMembers?: RosterMemberAccount[];
  currentBusinessDate?: string;
}): Promise<void> {
  const {
    barberId,
    date,
    entries = entriesCache,
    settingsMap = settingsCache,
    settlementsMap = settlementsCache,
    rosterMembers,
    currentBusinessDate = getSalonBusinessDate(),
  } = params;

  const cleanDate = String(date || '').slice(0, 20);
  if (!cleanDate) return;

  const meta = getCaisseBarberMeta(barberId, rosterMembers);
  const dayEntries = entries.filter(
    (e) => matchesCaisseFinancialBarber(e, barberId, rosterMembers) && e.date === cleanDate
  );

  // 1. Re-sync or clear matching daily archive doc when historical or already archived
  const archiveId = sanitizeId(`${barberId}_${cleanDate}`, 'arc');
  const hasExistingArchive = Boolean(archivesCache[archiveId]);
  if (cleanDate < currentBusinessDate || hasExistingArchive) {
    try {
      if (dayEntries.length === 0) {
        if (hasExistingArchive) {
          const nextArchives = { ...archivesCache };
          delete nextArchives[archiveId];
          archivesCache = nextArchives;
          notifyArchivesListeners();
          await raceWithTimeout(deleteDoc(doc(db, CAISSE_ARCHIVES_COLLECTION, archiveId)), 4500);
        }
      } else {
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
        const nowIso = new Date(getTrustedNowMs()).toISOString().slice(0, 64);
        const archivePayload: CaisseDailyArchive = {
          id: archiveId,
          barberId,
          barberName: meta.name,
          date: cleanDate,
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
        archivesCache = { ...archivesCache, [archiveId]: archivePayload };
        notifyArchivesListeners();
        await raceWithTimeout(
          setDoc(doc(db, CAISSE_ARCHIVES_COLLECTION, archiveId), archivePayload),
          4500
        );
      }
    } catch (err) {
      console.warn('Daily archive resync note:', err);
    }
  }

  // 2. Re-sync existing daily settlement snapshot figures (preserving confirmedAt anchor!)
  const existingSettle = findBarberDaySettlement(barberId, cleanDate, settlementsMap, rosterMembers);
  if (existingSettle) {
    try {
      const pct = getEffectiveCommissionPercentForDate(barberId, cleanDate, settingsMap);
      const dayStats = computeBarberDayStats(barberId, cleanDate, entries, pct, rosterMembers);
      const nowIso = new Date(getTrustedNowMs()).toISOString().slice(0, 64);
      const patch = {
        barberShareMAD: clampAmount(Math.max(0, dayStats.barberNetShareMAD)),
        shopShareMAD: clampAmount(Math.max(0, dayStats.shopShareMAD)),
        floatMAD: clampAmount(Math.max(0, dayStats.floatMAD)),
        expensesMAD: clampAmount(Math.max(0, dayStats.expensesMAD)),
        grossIntakeClosedMAD: clampAmount(Math.max(0, dayStats.incomeMAD)),
        updatedAt: nowIso,
      };
      settlementsCache = {
        ...settlementsCache,
        [existingSettle.id]: {
          ...existingSettle,
          ...patch,
        },
      };
      notifySettlementsListeners();
      await raceWithTimeout(
        updateDoc(doc(db, CAISSE_SETTLEMENTS_COLLECTION, existingSettle.id), patch),
        4500
      );
    } catch (err) {
      console.warn('Daily settlement snapshot resync note:', err);
    }
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
      (e) =>
        matchesCaisseFinancialBarber(e, barber.id, rosterMembers) &&
        asDateString(e.date, '').startsWith(yearYYYY)
    );
    const uniqueDates = Array.from(new Set(yearEntries.map((e) => asDateString(e.date, '')).filter(Boolean)));

    let incomeMAD = 0;
    let expensesMAD = 0;
    let creditsIssuedMAD = 0;
    let barberNetShareMAD = 0;
    let shopShareMAD = 0;

    for (const d of uniqueDates) {
      const pct = getEffectiveCommissionPercentForDate(barber.id, d, settingsMap);
      const ds = computeBarberDayStats(barber.id, d, yearEntries, pct, rosterMembers);
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

// ---------- Single Authoritative Open Daily Cycle & Shop Drawer Engine ----------

export interface BarberOpenDailyStats extends BarberDayStats {
  lastDailyCloseIso: string | null;
  lastDailyCloseDate: string | null;
  lastClosedIncomeMAD: number;
  lastClosedExpensesMAD: number;
  lastClosedShopShareMAD: number;
  isDailySettledClean: boolean;
  openEntries: CaisseEntry[];
}

/**
 * Single Source of Truth for a barber's open daily cycle ("الدورة اليومية المفتوحة").
 * Anchored strictly to the barber's last "تصفية الحساب اليومي" timestamp (`intakeClosed`),
 * NOT to any scheduled clock hour or automatic rollover. Resets cleanly to 0 only when daily settlement runs.
 */
export function computeBarberOpenDailyStats(params: {
  barberId: CaisseBarberId;
  entries: CaisseEntry[];
  settingsMap: Record<string, CaisseBarberSetting>;
  settlementsMap?: Record<string, CaisseDailySettlement>;
  cycles: CaisseCycleSettlement[];
  rosterMembers?: RosterMemberAccount[];
  referenceDate?: string;
}): BarberOpenDailyStats {
  const {
    barberId,
    entries,
    settingsMap,
    settlementsMap,
    cycles,
    rosterMembers,
    referenceDate = getSalonBusinessDate(),
  } = params;

  const barberCycles = cycles.filter((c) =>
    matchesCaisseBarber(c.barberId, c.barberName, barberId, rosterMembers)
  );
  const lastClose = getBarberLastDailyCloseInfo(barberId, settlementsMap, rosterMembers);

  const openEntries = entries.filter((e) => {
    if (!matchesCaisseFinancialBarber(e, barberId, rosterMembers)) return false;
    if (lastClose.closedIso) {
      if (e.createdAt) {
        return e.createdAt > lastClose.closedIso;
      }
      return lastClose.closedDate ? e.date > lastClose.closedDate : true;
    }
    return !isEntrySettledByCycles(e, barberCycles);
  });

  const uniqueDates = Array.from(new Set(openEntries.map((e) => e.date))).sort();
  let directIncomeMAD = 0;
  let repaymentIncomeMAD = 0;
  let creditsIssuedMAD = 0;
  let expensesMAD = 0;
  let floatInMAD = 0;
  let floatOutMAD = 0;
  let floatMAD = 0;
  let barberAdjustmentMAD = 0;
  let incomeMAD = 0;
  let barberGrossShareMAD = 0;
  let barberNetShareMAD = 0;
  let shopShareMAD = 0;
  let drawerCashMAD = 0;

  for (const d of uniqueDates) {
    const dayPct = getEffectiveCommissionPercentForDate(barberId, d, settingsMap);
    const ds = computeBarberDayStats(barberId, d, openEntries, dayPct, rosterMembers);
    directIncomeMAD += ds.directIncomeMAD;
    repaymentIncomeMAD += ds.repaymentIncomeMAD;
    creditsIssuedMAD += ds.creditsIssuedMAD;
    expensesMAD += ds.expensesMAD;
    floatInMAD += ds.floatInMAD;
    floatOutMAD += ds.floatOutMAD;
    floatMAD += ds.floatMAD;
    barberAdjustmentMAD += ds.barberAdjustmentMAD;
    incomeMAD += ds.incomeMAD;
    barberGrossShareMAD += ds.barberGrossShareMAD;
    barberNetShareMAD += ds.barberNetShareMAD;
    shopShareMAD += ds.shopShareMAD;
    drawerCashMAD += ds.drawerCashMAD;
  }

  const pct = getEffectiveCommissionPercentForDate(barberId, referenceDate, settingsMap);

  return {
    barberId,
    date: referenceDate,
    incomeMAD: Math.round(incomeMAD),
    directIncomeMAD: Math.round(directIncomeMAD),
    repaymentIncomeMAD: Math.round(repaymentIncomeMAD),
    creditsIssuedMAD: Math.round(creditsIssuedMAD),
    expensesMAD: Math.round(expensesMAD),
    floatInMAD: Math.round(floatInMAD),
    floatOutMAD: Math.round(floatOutMAD),
    floatMAD: Math.round(floatMAD),
    barberAdjustmentMAD: Math.round(barberAdjustmentMAD),
    commissionPercent: pct,
    extraPercentAbove50: Math.max(0, pct - 50),
    barberGrossShareMAD: Math.round(barberGrossShareMAD),
    barberNetShareMAD: Math.round(barberNetShareMAD),
    shopShareMAD: Math.round(shopShareMAD),
    drawerCashMAD: Math.round(drawerCashMAD),
    entryCount: openEntries.length,
    lastDailyCloseIso: lastClose.closedIso,
    lastDailyCloseDate: lastClose.closedDate,
    lastClosedIncomeMAD: Number(lastClose.settlement?.grossIntakeClosedMAD) || 0,
    lastClosedExpensesMAD: Number(lastClose.settlement?.expensesMAD) || 0,
    lastClosedShopShareMAD: Number(lastClose.settlement?.shopShareMAD) || 0,
    isDailySettledClean: Boolean(lastClose.closedIso && openEntries.length === 0),
    openEntries,
  };
}

export interface ShopDrawerBarberRow {
  barberId: CaisseBarberId;
  barberName: string;
  arName: string;
  color: string;
  floatInMAD: number;
  floatOutMAD: number;
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
  isDailySettledClean?: boolean;
}

export interface ShopDrawerSummary {
  scope: 'open_daily' | 'open_cycle' | 'day';
  date?: string;
  totalFloatInMAD: number;
  totalFloatOutMAD: number;
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
  scope: 'open_daily' | 'open_cycle' | 'day';
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
    if (scope === 'open_daily' || (scope === 'open_cycle' && respectDailyIntakeClose)) {
      const openStats = computeBarberOpenDailyStats({
        barberId: barber.id,
        entries,
        settingsMap,
        settlementsMap,
        cycles,
        rosterMembers,
        referenceDate: date,
      });
      return {
        barberId: barber.id,
        barberName: barber.name,
        arName: barber.arName,
        color: barber.color,
        floatInMAD: openStats.floatInMAD,
        floatOutMAD: openStats.floatOutMAD,
        floatMAD: openStats.floatMAD,
        directIncomeMAD: openStats.directIncomeMAD,
        repaymentIncomeMAD: openStats.repaymentIncomeMAD,
        incomeMAD: openStats.incomeMAD,
        expensesMAD: openStats.expensesMAD,
        barberGrossShareMAD: openStats.barberGrossShareMAD,
        shopShareMAD: openStats.shopShareMAD,
        barberNetShareMAD: openStats.barberNetShareMAD,
        netDrawerContributionMAD: openStats.drawerCashMAD,
        entryCount: openStats.entryCount,
        isDailySettledClean: openStats.isDailySettledClean,
      };
    }

    const barberCycles = cycles.filter((c) =>
      matchesCaisseBarber(c.barberId, c.barberName, barber.id, rosterMembers)
    );
    const scopedEntries = entries.filter((e) => {
      if (!matchesCaisseFinancialBarber(e, barber.id, rosterMembers)) {
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
      return !isEntrySettledByCycles(e, barberCycles);
    });

    const uniqueDates = Array.from(new Set(scopedEntries.map((e) => e.date))).sort();
    let floatInMAD = 0;
    let floatOutMAD = 0;
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
      floatInMAD += ds.floatInMAD;
      floatOutMAD += ds.floatOutMAD;
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
      floatInMAD: Math.round(floatInMAD),
      floatOutMAD: Math.round(floatOutMAD),
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

  const totalFloatInMAD = byBarber.reduce((s, r) => s + r.floatInMAD, 0);
  const totalFloatOutMAD = byBarber.reduce((s, r) => s + r.floatOutMAD, 0);
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
    totalFloatInMAD,
    totalFloatOutMAD,
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


