import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  CaisseBarberId,
  CaisseBarberSetting,
  CaisseCreditStatus,
  CaisseDailySettlement,
  CaisseEntry,
  CaisseEntryType,
} from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';

const CAISSE_ENTRIES_COLLECTION = 'caisse_entries';
const CAISSE_SETTINGS_COLLECTION = 'caisse_settings';
const CAISSE_SETTLEMENTS_COLLECTION = 'caisse_settlements';

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
    arName: 'حسن ايت بومليك (الإدارة)',
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

export function resolveCaisseBarberId(rawBarberId: string, rawBarberName?: string): CaisseBarberId {
  const normalized = (rawBarberId || '').toLowerCase().trim();
  if (normalized === 'hassan' || normalized === 'all') return 'hassan';
  if (normalized === 'anouar-arif' || normalized.includes('anouar')) return 'anouar-arif';
  if (normalized === 'lahcen-lhanz' || normalized.includes('lahcen')) return 'lahcen-lhanz';
  if (normalized === 'mounir-querdeny' || normalized.includes('mounir')) return 'mounir-querdeny';

  const nameLower = (rawBarberName || '').toLowerCase();
  if (nameLower.includes('anouar')) return 'anouar-arif';
  if (nameLower.includes('lahcen')) return 'lahcen-lhanz';
  if (nameLower.includes('mounir')) return 'mounir-querdeny';
  return 'hassan';
}

export function getCaisseBarberMeta(barberId: CaisseBarberId): CaisseBarberInfo {
  return CAISSE_BARBERS.find((b) => b.id === barberId) || CAISSE_BARBERS[0];
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

// ---------- In-memory caches + shared Firestore subscriptions ----------

let entriesCache: CaisseEntry[] = [];
let hasEntriesHydrated = false;
const entryListeners = new Set<(entries: CaisseEntry[]) => void>();
let entriesUnsub: (() => void) | null = null;

function ensureEntriesListener() {
  if (entriesUnsub) return;
  const q = query(collection(db, CAISSE_ENTRIES_COLLECTION), orderBy('createdAt', 'desc'));
  entriesUnsub = onSnapshot(
    q,
    (snapshot) => {
      entriesCache = snapshot.docs.map((d) => ({
        ...(d.data() as CaisseEntry),
        id: (d.data() as CaisseEntry).id || d.id,
      }));
      hasEntriesHydrated = true;
      entryListeners.forEach((cb) => cb(entriesCache));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, CAISSE_ENTRIES_COLLECTION);
    }
  );
}

export function subscribeToCaisseEntries(cb: (entries: CaisseEntry[]) => void): () => void {
  entryListeners.add(cb);
  ensureEntriesListener();
  if (hasEntriesHydrated) cb(entriesCache);
  return () => {
    entryListeners.delete(cb);
    if (entryListeners.size === 0 && entriesUnsub) {
      entriesUnsub();
      entriesUnsub = null;
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

function ensureSettingsListener() {
  if (settingsUnsub) return;
  settingsUnsub = onSnapshot(
    collection(db, CAISSE_SETTINGS_COLLECTION),
    (snapshot) => {
      const next: Record<string, CaisseBarberSetting> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as CaisseBarberSetting;
        next[d.id] = { ...data, id: data.id || d.id };
      });
      settingsCache = next;
      hasSettingsHydrated = true;
      settingsListeners.forEach((cb) => cb(settingsCache));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, CAISSE_SETTINGS_COLLECTION);
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
    if (settingsListeners.size === 0 && settingsUnsub) {
      settingsUnsub();
      settingsUnsub = null;
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

function ensureSettlementsListener() {
  if (settlementsUnsub) return;
  settlementsUnsub = onSnapshot(
    collection(db, CAISSE_SETTLEMENTS_COLLECTION),
    (snapshot) => {
      const next: Record<string, CaisseDailySettlement> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as CaisseDailySettlement;
        next[d.id] = { ...data, id: data.id || d.id };
      });
      settlementsCache = next;
      hasSettlementsHydrated = true;
      settlementsListeners.forEach((cb) => cb(settlementsCache));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, CAISSE_SETTLEMENTS_COLLECTION);
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
    if (settlementsListeners.size === 0 && settlementsUnsub) {
      settlementsUnsub();
      settlementsUnsub = null;
      hasSettlementsHydrated = false;
    }
  };
}

export function useCaisseSettlements(): Record<string, CaisseDailySettlement> {
  const [map, setMap] = useState<Record<string, CaisseDailySettlement>>(settlementsCache);
  useEffect(() => subscribeToCaisseSettlements(setMap), []);
  return map;
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
  createdByRole: 'master' | 'barber';
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
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCaisseEntry(entryId: string): Promise<void> {
  const path = `${CAISSE_ENTRIES_COLLECTION}/${entryId}`;
  try {
    await deleteDoc(doc(db, CAISSE_ENTRIES_COLLECTION, entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Records repayment of an existing barber/shop credit:
 * 1) Updates remaining credit & status on the original credit document (never altering original day cash).
 * 2) Adds a new `credit_repayment` entry on `repaidDate` so cash enters THAT repayment day's Caisse!
 */
export async function recordCaisseCreditRepayment(params: {
  creditEntry: CaisseEntry;
  amountRepaidMAD: number;
  repaidDate: string;
  actorRole: 'master' | 'barber';
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

  const nextRemaining = clampAmount(creditEntry.creditRemainingMAD - applied);
  const nextStatus: CaisseCreditStatus = nextRemaining <= 0 ? 'paid' : 'partial';
  const prevRepaidTotal = clampAmount(creditEntry.repaidAmountMAD || 0);

  await updateCaisseEntry(creditEntry.id, {
    creditRemainingMAD: nextRemaining,
    creditStatus: nextStatus,
    repaidDate,
    repaidAmountMAD: clampAmount(prevRepaidTotal + applied),
  });

  const serviceDesc =
    creditEntry.serviceNames && creditEntry.serviceNames.length > 0
      ? creditEntry.serviceNames.join(' + ')
      : 'سداد دين خدمة';

  const repaymentEntry = await addCaisseEntry({
    barberId: creditEntry.barberId,
    barberName: creditEntry.barberName,
    type: 'credit_repayment',
    date: repaidDate,
    serviceIds: creditEntry.serviceIds,
    serviceNames: creditEntry.serviceNames,
    expectedAmountMAD: applied,
    amountPaidMAD: applied,
    creditAmountMAD: 0,
    creditRemainingMAD: 0,
    creditStatus: 'none',
    clientName: creditEntry.clientName,
    clientPhone: creditEntry.clientPhone,
    parentCreditEntryId: creditEntry.id,
    repaidDate,
    repaidAmountMAD: applied,
    note:
      note?.trim() ||
      `أداء كريدي (${creditEntry.clientName || 'زبون'}) • ${serviceDesc} • أصل الدين يوم ${creditEntry.date}`,
    createdByRole: actorRole,
    createdByName: actorName,
  });

  return repaymentEntry;
}

export async function updateBarberCommissionPercent(
  barberId: CaisseBarberId,
  commissionPercent: number,
  updatedBy: string
): Promise<CaisseBarberSetting> {
  const pct = Math.max(0, Math.min(100, Math.round(commissionPercent)));
  const setting: CaisseBarberSetting = {
    id: barberId,
    barberId,
    commissionPercent: pct,
    updatedBy: String(updatedBy || 'Hassan ait boumlik').trim().slice(0, 100),
    updatedAt: new Date().toISOString().slice(0, 64),
  };
  const path = `${CAISSE_SETTINGS_COLLECTION}/${barberId}`;
  try {
    await setDoc(doc(db, CAISSE_SETTINGS_COLLECTION, barberId), setting);
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
  note?: string;
  confirmedBy: string;
}): Promise<CaisseDailySettlement> {
  const id = sanitizeId(`${params.barberId}_${params.date}`, 'cs');
  const nowIso = new Date().toISOString().slice(0, 64);
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
    confirmedAt: nowIso,
    updatedAt: nowIso,
  };
  if (params.note && params.note.trim()) {
    payload.note = params.note.trim().slice(0, 400);
  }
  const path = `${CAISSE_SETTLEMENTS_COLLECTION}/${id}`;
  try {
    await setDoc(doc(db, CAISSE_SETTLEMENTS_COLLECTION, id), payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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

export interface BarberDayStats {
  barberId: CaisseBarberId;
  date: string;
  incomeMAD: number;
  directIncomeMAD: number;
  repaymentIncomeMAD: number;
  creditsIssuedMAD: number;
  expensesMAD: number;
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
  commissionPercent: number
): BarberDayStats {
  const dayEntries = entries.filter((e) => e.barberId === barberId && e.date === date);

  let directIncomeMAD = 0;
  let repaymentIncomeMAD = 0;
  let creditsIssuedMAD = 0;
  let expensesMAD = 0;
  let floatMAD = 0;

  for (const e of dayEntries) {
    if (e.type === 'income') {
      directIncomeMAD += Number(e.amountPaidMAD) || 0;
      creditsIssuedMAD += Number(e.creditAmountMAD) || 0;
    } else if (e.type === 'credit_repayment') {
      repaymentIncomeMAD += Number(e.amountPaidMAD) || 0;
    } else if (e.type === 'expense') {
      expensesMAD += Number(e.amountPaidMAD) || 0;
    } else if (e.type === 'float_adjustment') {
      floatMAD += Number(e.amountPaidMAD) || 0;
    }
  }

  const incomeMAD = clampAmount(directIncomeMAD + repaymentIncomeMAD);
  const pct = Math.max(0, Math.min(100, commissionPercent));
  const barberGrossShareMAD = Math.round(incomeMAD * (pct / 100));
  const shopShareMAD = Math.max(0, Math.round(incomeMAD - barberGrossShareMAD));
  const barberNetShareMAD =
    barberId === 'hassan'
      ? Math.max(0, Math.round(barberGrossShareMAD + floatMAD - expensesMAD))
      : Math.max(0, Math.round(barberGrossShareMAD - expensesMAD));
  const drawerCashMAD = Math.max(0, Math.round(incomeMAD + floatMAD - expensesMAD));

  return {
    barberId,
    date,
    incomeMAD,
    directIncomeMAD: clampAmount(directIncomeMAD),
    repaymentIncomeMAD: clampAmount(repaymentIncomeMAD),
    creditsIssuedMAD: clampAmount(creditsIssuedMAD),
    expensesMAD: clampAmount(expensesMAD),
    floatMAD: clampAmount(floatMAD),
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
  const pct = getEffectiveCommissionPercent(barberId, settingsMap);

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
  settlementsMap: Record<string, CaisseDailySettlement>
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

  const byBarber: MonthlyBarberRollup[] = CAISSE_BARBERS.map((barber) => {
    const pct = getEffectiveCommissionPercent(barber.id, settingsMap);
    const barberMonthEntries = entries.filter(
      (e) => e.barberId === barber.id && e.date.startsWith(monthYYYYMM)
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
      const ds = computeBarberDayStats(barber.id, d, barberMonthEntries, pct);
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

    const openCreditsMAD = barberMonthEntries
      .filter((e) => (Number(e.creditRemainingMAD) || 0) > 0 && e.creditStatus !== 'paid')
      .reduce((acc, e) => acc + (Number(e.creditRemainingMAD) || 0), 0);

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

  const grandTotalOpenCreditsMAD = entries
    .filter((e) => (Number(e.creditRemainingMAD) || 0) > 0 && e.creditStatus !== 'paid')
    .reduce((acc, e) => acc + (Number(e.creditRemainingMAD) || 0), 0);

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
