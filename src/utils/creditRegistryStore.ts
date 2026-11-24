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
  CaisseEntry,
  ClientCreditRecord,
  CreditDisputeRecord,
  CreditDisputeStatus,
  ManualCreditStatus,
  RosterMemberAccount,
} from '../types';
import { normalizeMoroccanPhoneDigits } from './bookingStore';
import { getCaisseBarberMeta } from './caisseStore';
import { db, handleFirestoreError, OperationType } from './firebase';

const CLIENT_CREDITS_COLLECTION = 'client_credits';
const CREDIT_DISPUTES_COLLECTION = 'credit_disputes';

let creditsCache: ClientCreditRecord[] = [];
let hasCreditsHydrated = false;
const creditsListeners = new Set<(records: ClientCreditRecord[]) => void>();
let creditsUnsub: (() => void) | null = null;

let disputesCache: CreditDisputeRecord[] = [];
let hasDisputesHydrated = false;
const disputesListeners = new Set<(records: CreditDisputeRecord[]) => void>();
let disputesUnsub: (() => void) | null = null;

function sanitizeCreditId(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  if (cleaned.length >= 3) return cleaned;
  return `cred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function clampCreditAmount(val: number | undefined | null): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(100000, Math.round(val * 100) / 100));
}

function ensureClientCreditsListener() {
  if (creditsUnsub) return;
  const q = query(
    collection(db, CLIENT_CREDITS_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  creditsUnsub = onSnapshot(
    q,
    (snapshot) => {
      creditsCache = snapshot.docs.map((d) => {
        const raw = d.data() as ClientCreditRecord;
        return {
          ...raw,
          id: raw.id || d.id,
        };
      });
      hasCreditsHydrated = true;
      creditsListeners.forEach((cb) => cb(creditsCache));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, CLIENT_CREDITS_COLLECTION);
    }
  );
}

export function subscribeToManualClientCredits(
  cb: (records: ClientCreditRecord[]) => void
): () => void {
  creditsListeners.add(cb);
  ensureClientCreditsListener();
  if (hasCreditsHydrated) {
    cb(creditsCache);
  }
  return () => {
    creditsListeners.delete(cb);
    if (creditsListeners.size === 0 && creditsUnsub) {
      creditsUnsub();
      creditsUnsub = null;
      hasCreditsHydrated = false;
    }
  };
}

export function useManualClientCredits(): ClientCreditRecord[] {
  const [records, setRecords] = useState<ClientCreditRecord[]>(creditsCache);
  useEffect(() => subscribeToManualClientCredits(setRecords), []);
  return records;
}

function ensureCreditDisputesListener() {
  if (disputesUnsub) return;
  const q = query(
    collection(db, CREDIT_DISPUTES_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  disputesUnsub = onSnapshot(
    q,
    (snapshot) => {
      disputesCache = snapshot.docs.map((d) => {
        const raw = d.data() as CreditDisputeRecord;
        return {
          ...raw,
          id: raw.id || d.id,
        };
      });
      hasDisputesHydrated = true;
      disputesListeners.forEach((cb) => cb(disputesCache));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, CREDIT_DISPUTES_COLLECTION);
    }
  );
}

export function subscribeToCreditDisputes(
  cb: (records: CreditDisputeRecord[]) => void
): () => void {
  disputesListeners.add(cb);
  ensureCreditDisputesListener();
  if (hasDisputesHydrated) {
    cb(disputesCache);
  }
  return () => {
    disputesListeners.delete(cb);
    if (disputesListeners.size === 0 && disputesUnsub) {
      disputesUnsub();
      disputesUnsub = null;
      hasDisputesHydrated = false;
    }
  };
}

export function useCreditDisputes(): CreditDisputeRecord[] {
  const [records, setRecords] = useState<CreditDisputeRecord[]>(disputesCache);
  useEffect(() => subscribeToCreditDisputes(setRecords), []);
  return records;
}

function cleanAdditionalPhonesList(phones?: string[]): {
  displays: string[];
  normalized: string[];
} {
  const seen = new Set<string>();
  const displays: string[] = [];
  const normalized: string[] = [];

  (Array.isArray(phones) ? phones : []).forEach((raw) => {
    const clean = String(raw || '').trim().slice(0, 40);
    if (!clean) return;
    const norm = (normalizeMoroccanPhoneDigits(clean) || clean.replace(/\D/g, '')).slice(0, 32);
    const dedupKey = norm || clean.toLowerCase();
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);
    if (displays.length < 5) {
      displays.push(clean);
      if (norm) normalized.push(norm);
    }
  });

  return { displays, normalized };
}

export async function addManualClientCredit(input: {
  clientName: string;
  clientPhone?: string;
  additionalPhones?: string[];
  amountOwedMAD: number;
  creditDate?: string;
  note?: string;
  createdBy: string;
}): Promise<ClientCreditRecord> {
  const id = sanitizeCreditId(
    `cred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  );
  const nowIso = new Date().toISOString().slice(0, 64);
  const cleanName = String(input.clientName || '').trim().slice(0, 120) || 'زبون';
  const cleanPhone = String(input.clientPhone || '').trim().slice(0, 40);
  const normalizedPhone = cleanPhone
    ? (normalizeMoroccanPhoneDigits(cleanPhone) || cleanPhone.replace(/\D/g, '')).slice(0, 32)
    : '';
  const extra = cleanAdditionalPhonesList(input.additionalPhones);
  const amount = clampCreditAmount(input.amountOwedMAD);
  const cleanDate = String(input.creditDate || '').trim().slice(0, 20);

  const record: ClientCreditRecord = {
    id,
    clientName: cleanName,
    clientPhone: cleanPhone,
    normalizedPhone,
    ...(extra.displays.length > 0 ? { additionalPhones: extra.displays } : {}),
    ...(extra.normalized.length > 0 ? { normalizedAdditionalPhones: extra.normalized } : {}),
    amountOwedMAD: amount,
    originalAmountMAD: amount,
    status: amount <= 0 ? 'paid' : 'open',
    createdBy: String(input.createdBy || 'Hassan ait boumlik').trim().slice(0, 100),
    createdAt: nowIso,
    updatedAt: nowIso,
    ...(cleanDate ? { creditDate: cleanDate } : {}),
    ...(input.note?.trim() ? { note: input.note.trim().slice(0, 400) } : {}),
  };

  try {
    await setDoc(doc(db, CLIENT_CREDITS_COLLECTION, id), record);
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${CLIENT_CREDITS_COLLECTION}/${id}`);
  }
}

export async function updateManualClientCredit(
  creditId: string,
  current: ClientCreditRecord,
  patch: {
    clientName?: string;
    clientPhone?: string;
    additionalPhones?: string[];
    amountOwedMAD?: number;
    creditDate?: string;
    note?: string;
  }
): Promise<void> {
  const nowIso = new Date().toISOString().slice(0, 64);
  const nextName =
    patch.clientName !== undefined
      ? String(patch.clientName).trim().slice(0, 120) || current.clientName
      : current.clientName;
  const nextPhoneRaw =
    patch.clientPhone !== undefined
      ? String(patch.clientPhone).trim().slice(0, 40)
      : current.clientPhone;
  const nextNormalized = nextPhoneRaw
    ? (normalizeMoroccanPhoneDigits(nextPhoneRaw) || nextPhoneRaw.replace(/\D/g, '')).slice(0, 32)
    : '';

  const nextOwed =
    patch.amountOwedMAD !== undefined
      ? clampCreditAmount(patch.amountOwedMAD)
      : current.amountOwedMAD;
  const nextOriginal = Math.max(current.originalAmountMAD, nextOwed);
  const nextStatus: ManualCreditStatus =
    nextOwed <= 0 ? 'paid' : nextOwed < nextOriginal ? 'partial' : 'open';

  const payload: Record<string, unknown> = {
    clientName: nextName,
    clientPhone: nextPhoneRaw,
    normalizedPhone: nextNormalized,
    amountOwedMAD: nextOwed,
    originalAmountMAD: nextOriginal,
    status: nextStatus,
    updatedAt: nowIso,
  };

  if (patch.additionalPhones !== undefined) {
    const extra = cleanAdditionalPhonesList(patch.additionalPhones);
    payload.additionalPhones = extra.displays.length > 0 ? extra.displays : deleteField();
    payload.normalizedAdditionalPhones = extra.normalized.length > 0 ? extra.normalized : deleteField();
  }

  if (patch.creditDate !== undefined) {
    const trimmedDate = patch.creditDate.trim().slice(0, 20);
    payload.creditDate = trimmedDate ? trimmedDate : deleteField();
  }

  if (patch.note !== undefined) {
    const trimmed = patch.note.trim().slice(0, 400);
    payload.note = trimmed ? trimmed : deleteField();
  }

  try {
    await updateDoc(doc(db, CLIENT_CREDITS_COLLECTION, creditId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CLIENT_CREDITS_COLLECTION}/${creditId}`);
  }
}

export async function recordManualCreditPayment(
  record: ClientCreditRecord,
  payAmountMAD: number
): Promise<void> {
  const cleanPay = clampCreditAmount(payAmountMAD);
  if (cleanPay <= 0) return;
  const nextRemaining = Math.max(
    0,
    Math.round((record.amountOwedMAD - cleanPay) * 100) / 100
  );
  const nextStatus: ManualCreditStatus = nextRemaining <= 0 ? 'paid' : 'partial';
  const nowIso = new Date().toISOString().slice(0, 64);

  try {
    await updateDoc(doc(db, CLIENT_CREDITS_COLLECTION, record.id), {
      amountOwedMAD: nextRemaining,
      status: nextStatus,
      updatedAt: nowIso,
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `${CLIENT_CREDITS_COLLECTION}/${record.id}`
    );
  }
}

export async function deleteManualClientCredit(creditId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, CLIENT_CREDITS_COLLECTION, creditId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `${CLIENT_CREDITS_COLLECTION}/${creditId}`
    );
  }
}

export async function submitClientCreditDispute(input: {
  clientName: string;
  clientPhone: string;
  totalOwedSnapshotMAD: number;
  creditorSummary: string;
  message: string;
  targetBarberId?: string;
}): Promise<CreditDisputeRecord> {
  const id = sanitizeCreditId(
    `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  );
  const nowIso = new Date().toISOString().slice(0, 64);
  const cleanPhone = String(input.clientPhone || '').trim().slice(0, 40);
  const normalizedPhone = (
    normalizeMoroccanPhoneDigits(cleanPhone) ||
    cleanPhone.replace(/\D/g, '') ||
    '0000'
  ).slice(0, 32);
  const cleanName = String(input.clientName || '').trim().slice(0, 120) || 'زبون';
  const cleanMsg = String(input.message || '').trim().slice(0, 600);
  const cleanCreditor = String(input.creditorSummary || '').trim().slice(0, 240) || 'صالون بومليك';

  const record: CreditDisputeRecord = {
    id,
    clientName: cleanName,
    clientPhone: cleanPhone.length >= 6 ? cleanPhone : normalizedPhone.padEnd(6, '0'),
    normalizedPhone: normalizedPhone.length >= 4 ? normalizedPhone : '0000',
    totalOwedSnapshotMAD: clampCreditAmount(input.totalOwedSnapshotMAD),
    creditorSummary: cleanCreditor,
    message: cleanMsg || 'استفسار حول الكريدي المسجل',
    status: 'open',
    createdAt: nowIso,
    updatedAt: nowIso,
    ...(input.targetBarberId?.trim()
      ? { targetBarberId: input.targetBarberId.trim().slice(0, 64) }
      : {}),
  };

  try {
    await setDoc(doc(db, CREDIT_DISPUTES_COLLECTION, id), record);
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${CREDIT_DISPUTES_COLLECTION}/${id}`);
  }
}

export async function updateCreditDisputeStatus(
  disputeId: string,
  patch: {
    status: CreditDisputeStatus;
    staffNote?: string;
    resolvedBy?: string;
  }
): Promise<void> {
  const nowIso = new Date().toISOString().slice(0, 64);
  const payload: Record<string, unknown> = {
    status: patch.status,
    updatedAt: nowIso,
  };

  if (patch.staffNote !== undefined) {
    const trimmed = patch.staffNote.trim().slice(0, 400);
    payload.staffNote = trimmed ? trimmed : deleteField();
  }
  if (patch.resolvedBy !== undefined) {
    const cleanActor = patch.resolvedBy.trim().slice(0, 100);
    payload.resolvedBy = cleanActor ? cleanActor : deleteField();
  }
  if (patch.status === 'resolved') {
    payload.resolvedAt = nowIso;
  } else {
    payload.resolvedAt = deleteField();
  }

  try {
    await updateDoc(doc(db, CREDIT_DISPUTES_COLLECTION, disputeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CREDIT_DISPUTES_COLLECTION}/${disputeId}`);
  }
}

export async function deleteCreditDispute(disputeId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, CREDIT_DISPUTES_COLLECTION, disputeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CREDIT_DISPUTES_COLLECTION}/${disputeId}`);
  }
}

export interface CreditorBreakdownItem {
  creditorKey: string;
  creditorLabel: string;
  barberId?: string;
  amountMAD: number;
  source: 'caisse' | 'manual';
}

export interface OutstandingPhoneCreditSummary {
  hasCredit: boolean;
  normalizedPhone: string;
  totalOwedMAD: number;
  caisseCreditMAD: number;
  manualCreditMAD: number;
  caisseItems: CaisseEntry[];
  manualItems: ClientCreditRecord[];
  matchedClientNames: string[];
  creditDates: string[];
  nearestCreditDate?: string;
  creditorBreakdowns: CreditorBreakdownItem[];
}

export function computeOutstandingCreditsForPhone(
  rawPhone: string,
  caisseEntries: CaisseEntry[],
  manualCredits: ClientCreditRecord[],
  rosterMembers?: RosterMemberAccount[]
): OutstandingPhoneCreditSummary {
  const norm = normalizeMoroccanPhoneDigits(rawPhone || '');
  if (!norm || norm.length < 6) {
    return {
      hasCredit: false,
      normalizedPhone: norm,
      totalOwedMAD: 0,
      caisseCreditMAD: 0,
      manualCreditMAD: 0,
      caisseItems: [],
      manualItems: [],
      matchedClientNames: [],
      creditDates: [],
      creditorBreakdowns: [],
    };
  }

  const caisseItems = caisseEntries.filter(
    (entry) =>
      entry.creditRemainingMAD > 0 &&
      entry.creditStatus !== 'paid' &&
      normalizeMoroccanPhoneDigits(entry.clientPhone || '') === norm
  );

  const manualItems = manualCredits.filter((rec) => {
    if (rec.amountOwedMAD <= 0 || rec.status === 'paid') return false;
    if (rec.normalizedPhone && rec.normalizedPhone === norm) return true;
    if (rec.clientPhone && normalizeMoroccanPhoneDigits(rec.clientPhone) === norm) return true;
    if (
      Array.isArray(rec.normalizedAdditionalPhones) &&
      rec.normalizedAdditionalPhones.some((np) => np && np === norm)
    ) {
      return true;
    }
    if (
      Array.isArray(rec.additionalPhones) &&
      rec.additionalPhones.some((p) => p && normalizeMoroccanPhoneDigits(p) === norm)
    ) {
      return true;
    }
    return false;
  });

  const caisseCreditMAD =
    Math.round(
      caisseItems.reduce((sum, item) => sum + (Number(item.creditRemainingMAD) || 0), 0) * 100
    ) / 100;

  const manualCreditMAD =
    Math.round(
      manualItems.reduce((sum, item) => sum + (Number(item.amountOwedMAD) || 0), 0) * 100
    ) / 100;

  const totalOwedMAD = Math.round((caisseCreditMAD + manualCreditMAD) * 100) / 100;

  const namesSet = new Set<string>();
  const datesSet = new Set<string>();
  manualItems.forEach((m) => {
    if (m.clientName?.trim()) namesSet.add(m.clientName.trim());
    const d = m.creditDate?.trim() || m.createdAt?.slice(0, 10);
    if (d) datesSet.add(d);
  });
  caisseItems.forEach((c) => {
    if (c.clientName?.trim()) namesSet.add(c.clientName.trim());
    const d = c.date?.trim() || c.createdAt?.slice(0, 10);
    if (d) datesSet.add(d);
  });

  const creditDates = Array.from(datesSet).sort().reverse();

  // Group creditors clearly so client sees WHO is owed (specific barber vs management)
  const breakdownMap = new Map<string, CreditorBreakdownItem>();

  caisseItems.forEach((entry) => {
    const amt = Number(entry.creditRemainingMAD) || 0;
    if (amt <= 0) return;
    const meta = getCaisseBarberMeta(entry.barberId, rosterMembers);
    const key = `caisse_${entry.barberId}`;
    const label =
      entry.barberId === 'hassan'
        ? 'إدارة الصالون (حسن أيت بومليك)'
        : meta.arName || entry.barberName || entry.barberId;
    const prev = breakdownMap.get(key);
    if (prev) {
      prev.amountMAD = Math.round((prev.amountMAD + amt) * 100) / 100;
    } else {
      breakdownMap.set(key, {
        creditorKey: key,
        creditorLabel: label,
        barberId: entry.barberId,
        amountMAD: amt,
        source: 'caisse',
      });
    }
  });

  if (manualCreditMAD > 0) {
    breakdownMap.set('manual_management', {
      creditorKey: 'manual_management',
      creditorLabel: 'إدارة صالون بومليك',
      barberId: 'hassan',
      amountMAD: manualCreditMAD,
      source: 'manual',
    });
  }

  return {
    hasCredit: totalOwedMAD > 0,
    normalizedPhone: norm,
    totalOwedMAD,
    caisseCreditMAD,
    manualCreditMAD,
    caisseItems,
    manualItems,
    matchedClientNames: Array.from(namesSet),
    creditDates,
    nearestCreditDate: creditDates[0],
    creditorBreakdowns: Array.from(breakdownMap.values()),
  };
}

