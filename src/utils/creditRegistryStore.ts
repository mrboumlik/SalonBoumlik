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
} from 'firebase/firestore';
import {
  CaisseBarberId,
  CaisseEntry,
  ClientCreditRecord,
  CreditDisputeRecord,
  CreditDisputeStatus,
  CreditSettlementActionType,
  CreditSettlementRequest,
  CreditSettlementSourceType,
  ManualCreditStatus,
  RosterMemberAccount,
} from '../types';
import { normalizeMoroccanPhoneDigits } from './bookingStore';
import {
  getCaisseBarberMeta,
  getEffectiveCaisseCreditRemaining,
  getSalonBusinessDate,
  matchesCaisseBarber,
  recordCaisseCreditRepayment,
  updateCaisseEntry,
} from './caisseStore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  emitRealtimeSyncHint,
  registerRealtimeRefreshHandler,
  resetResilientRetry,
  scheduleResilientRetry,
} from './realtimeSync';
import {
  asDateString,
  asFiniteNum,
  asIsoString,
  asStr,
  asStrArray,
  safeCompareDesc,
} from './safeCoerce';

const CLIENT_CREDITS_COLLECTION = 'client_credits';
const CREDIT_DISPUTES_COLLECTION = 'credit_disputes';
const CREDIT_SETTLEMENT_REQUESTS_COLLECTION = 'credit_settlement_requests';

let creditsCache: ClientCreditRecord[] = [];
let hasCreditsHydrated = false;
const creditsListeners = new Set<(records: ClientCreditRecord[]) => void>();
let creditsUnsub: (() => void) | null = null;
let creditsRefreshUnsub: (() => void) | null = null;

let disputesCache: CreditDisputeRecord[] = [];
let hasDisputesHydrated = false;
const disputesListeners = new Set<(records: CreditDisputeRecord[]) => void>();
let disputesUnsub: (() => void) | null = null;
let disputesRefreshUnsub: (() => void) | null = null;

let settlementRequestsCache: CreditSettlementRequest[] = [];
let hasSettlementRequestsHydrated = false;
const settlementRequestsListeners = new Set<(records: CreditSettlementRequest[]) => void>();
let settlementRequestsUnsub: (() => void) | null = null;
let settlementRequestsRefreshUnsub: (() => void) | null = null;

async function getCreditDocsFast(colName: string) {
  try {
    return await getDocsFromServer(collection(db, colName));
  } catch {
    return await getDocs(collection(db, colName));
  }
}

function coerceManualCreditDoc(rawInput: unknown, docId: string): ClientCreditRecord {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = asStr(raw.id, docId) || docId;
  const createdAt = asIsoString(raw.createdAt, '') || asIsoString(raw.updatedAt, '');
  const updatedAt = asIsoString(raw.updatedAt, createdAt);
  const additionalPhones = asStrArray(raw.additionalPhones);
  const normalizedAdditionalPhones = asStrArray(raw.normalizedAdditionalPhones);
  return {
    ...(raw as Partial<ClientCreditRecord>),
    id,
    clientName: asStr(raw.clientName, 'زبون'),
    clientPhone: asStr(raw.clientPhone, ''),
    normalizedPhone: asStr(raw.normalizedPhone, ''),
    additionalPhones: additionalPhones.length > 0 ? additionalPhones : undefined,
    normalizedAdditionalPhones:
      normalizedAdditionalPhones.length > 0 ? normalizedAdditionalPhones : undefined,
    barberId: raw.barberId !== undefined ? asStr(raw.barberId, '') : undefined,
    barberName: raw.barberName !== undefined ? asStr(raw.barberName, '') : undefined,
    amountOwedMAD: asFiniteNum(raw.amountOwedMAD, 0),
    originalAmountMAD: asFiniteNum(raw.originalAmountMAD, asFiniteNum(raw.amountOwedMAD, 0)),
    status: (asStr(raw.status, 'open') || 'open') as ManualCreditStatus,
    creditDate: raw.creditDate !== undefined ? asDateString(raw.creditDate, '') : undefined,
    note: raw.note !== undefined ? asStr(raw.note, '') : undefined,
    createdBy: asStr(raw.createdBy, ''),
    createdAt,
    updatedAt,
  };
}

function coerceCreditDisputeDoc(rawInput: unknown, docId: string): CreditDisputeRecord {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = asStr(raw.id, docId) || docId;
  const createdAt = asIsoString(raw.createdAt, '') || asIsoString(raw.updatedAt, '');
  const updatedAt = asIsoString(raw.updatedAt, createdAt);
  return {
    ...(raw as Partial<CreditDisputeRecord>),
    id,
    clientName: asStr(raw.clientName, 'زبون'),
    clientPhone: asStr(raw.clientPhone, ''),
    normalizedPhone: asStr(raw.normalizedPhone, ''),
    targetBarberId: raw.targetBarberId !== undefined ? asStr(raw.targetBarberId, '') : undefined,
    creditorSummary: asStr(raw.creditorSummary, ''),
    totalOwedSnapshotMAD: asFiniteNum(raw.totalOwedSnapshotMAD, 0),
    message: asStr(raw.message, ''),
    status: (asStr(raw.status, 'open') || 'open') as CreditDisputeStatus,
    staffNote: raw.staffNote !== undefined ? asStr(raw.staffNote, '') : undefined,
    createdAt,
    updatedAt,
  };
}

function coerceSettlementRequestDoc(rawInput: unknown, docId: string): CreditSettlementRequest {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = asStr(raw.id, docId) || docId;
  const createdAt = asIsoString(raw.createdAt, '') || asIsoString(raw.updatedAt, '');
  const updatedAt = asIsoString(raw.updatedAt, createdAt);
  return {
    ...(raw as Partial<CreditSettlementRequest>),
    id,
    sourceType: (asStr(raw.sourceType, 'manual') || 'manual') as CreditSettlementSourceType,
    sourceId: raw.sourceId !== undefined ? asStr(raw.sourceId, '') : undefined,
    barberId: asStr(raw.barberId, 'hassan'),
    barberName: asStr(raw.barberName, ''),
    clientName: asStr(raw.clientName, 'زبون'),
    clientPhone: asStr(raw.clientPhone, ''),
    normalizedPhone: asStr(raw.normalizedPhone, ''),
    actionType: (asStr(raw.actionType, 'pay') || 'pay') as CreditSettlementActionType,
    requestedAmountMAD: asFiniteNum(raw.requestedAmountMAD, 0),
    originalRemainingMAD: asFiniteNum(raw.originalRemainingMAD, 0),
    approvedAmountMAD:
      raw.approvedAmountMAD !== undefined ? asFiniteNum(raw.approvedAmountMAD, 0) : undefined,
    status: (asStr(raw.status, 'pending') || 'pending') as CreditSettlementRequest['status'],
    note: raw.note !== undefined ? asStr(raw.note, '') : undefined,
    submittedBy: asStr(raw.submittedBy, ''),
    submittedRole: (asStr(raw.submittedRole, 'client') || 'client') as CreditSettlementRequest['submittedRole'],
    reviewedBy: raw.reviewedBy !== undefined ? asStr(raw.reviewedBy, '') : undefined,
    reviewedAt: raw.reviewedAt !== undefined ? asIsoString(raw.reviewedAt, '') : undefined,
    reviewerNote: raw.reviewerNote !== undefined ? asStr(raw.reviewerNote, '') : undefined,
    createdAt,
    updatedAt,
  };
}

function sortByCreatedAtDesc<T extends { id?: string; createdAt?: string; updatedAt?: string }>(
  list: T[]
): T[] {
  return [...list].sort((a, b) => {
    const aKey = asIsoString(a.createdAt, '') || asIsoString(a.updatedAt, '');
    const bKey = asIsoString(b.createdAt, '') || asIsoString(b.updatedAt, '');
    if (aKey !== bKey) return safeCompareDesc(aKey, bKey);
    return safeCompareDesc(a.id, b.id);
  });
}

export function getEffectiveManualCreditRemaining(rec: ClientCreditRecord): number {
  if (!rec || rec.status === 'paid') return 0;
  const owed = Number(rec.amountOwedMAD);
  if (!Number.isFinite(owed) || owed <= 0) return 0;
  return Math.max(0, Math.round(owed * 100) / 100);
}

function notifyCreditsListeners() {
  creditsListeners.forEach((cb) => {
    try {
      cb(creditsCache);
    } catch (err) {
      console.warn('Client credits listener callback error:', err);
    }
  });
}

function notifyDisputesListeners() {
  disputesListeners.forEach((cb) => {
    try {
      cb(disputesCache);
    } catch (err) {
      console.warn('Credit disputes listener callback error:', err);
    }
  });
}

function notifySettlementRequestsListeners() {
  settlementRequestsListeners.forEach((cb) => {
    try {
      cb(settlementRequestsCache);
    } catch (err) {
      console.warn('Credit settlement requests listener callback error:', err);
    }
  });
}

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
  if (!creditsRefreshUnsub) {
    creditsRefreshUnsub = registerRealtimeRefreshHandler(
      'client_credits',
      'credits',
      async () => {
        if (creditsListeners.size === 0) return;
        ensureClientCreditsListener();
        try {
          const snap = await getCreditDocsFast(CLIENT_CREDITS_COLLECTION);
          creditsCache = sortByCreatedAtDesc(
            snap.docs.map((d) => coerceManualCreditDoc(d.data(), d.id))
          );
          hasCreditsHydrated = true;
          notifyCreditsListeners();
        } catch (err) {
          console.warn('Client credits wake refresh warning:', err);
        }
      }
    );
  }
  if (creditsUnsub) return;

  creditsUnsub = onSnapshot(
    collection(db, CLIENT_CREDITS_COLLECTION),
    (snapshot) => {
      resetResilientRetry('client_credits');
      creditsCache = sortByCreatedAtDesc(
        snapshot.docs.map((d) => coerceManualCreditDoc(d.data(), d.id))
      );
      hasCreditsHydrated = true;
      notifyCreditsListeners();
    },
    (error) => {
      if (creditsUnsub) {
        try {
          creditsUnsub();
        } catch {
          // Ignore
        }
        creditsUnsub = null;
      }
      scheduleResilientRetry(
        'client_credits',
        () => creditsListeners.size > 0,
        () => ensureClientCreditsListener(),
        error
      );
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
    if (creditsListeners.size === 0) {
      resetResilientRetry('client_credits');
      if (creditsUnsub) {
        creditsUnsub();
        creditsUnsub = null;
      }
      if (creditsRefreshUnsub) {
        creditsRefreshUnsub();
        creditsRefreshUnsub = null;
      }
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
  if (!disputesRefreshUnsub) {
    disputesRefreshUnsub = registerRealtimeRefreshHandler(
      'credit_disputes',
      'credits',
      async () => {
        if (disputesListeners.size === 0) return;
        ensureCreditDisputesListener();
        try {
          const snap = await getCreditDocsFast(CREDIT_DISPUTES_COLLECTION);
          disputesCache = sortByCreatedAtDesc(
            snap.docs.map((d) => coerceCreditDisputeDoc(d.data(), d.id))
          );
          hasDisputesHydrated = true;
          notifyDisputesListeners();
        } catch (err) {
          console.warn('Credit disputes wake refresh warning:', err);
        }
      }
    );
  }
  if (disputesUnsub) return;

  disputesUnsub = onSnapshot(
    collection(db, CREDIT_DISPUTES_COLLECTION),
    (snapshot) => {
      resetResilientRetry('credit_disputes');
      disputesCache = sortByCreatedAtDesc(
        snapshot.docs.map((d) => coerceCreditDisputeDoc(d.data(), d.id))
      );
      hasDisputesHydrated = true;
      notifyDisputesListeners();
    },
    (error) => {
      if (disputesUnsub) {
        try {
          disputesUnsub();
        } catch {
          // Ignore
        }
        disputesUnsub = null;
      }
      scheduleResilientRetry(
        'credit_disputes',
        () => disputesListeners.size > 0,
        () => ensureCreditDisputesListener(),
        error
      );
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
    if (disputesListeners.size === 0) {
      resetResilientRetry('credit_disputes');
      if (disputesUnsub) {
        disputesUnsub();
        disputesUnsub = null;
      }
      if (disputesRefreshUnsub) {
        disputesRefreshUnsub();
        disputesRefreshUnsub = null;
      }
      hasDisputesHydrated = false;
    }
  };
}

export function useCreditDisputes(): CreditDisputeRecord[] {
  const [records, setRecords] = useState<CreditDisputeRecord[]>(disputesCache);
  useEffect(() => subscribeToCreditDisputes(setRecords), []);
  return records;
}

function ensureCreditSettlementRequestsListener() {
  if (!settlementRequestsRefreshUnsub) {
    settlementRequestsRefreshUnsub = registerRealtimeRefreshHandler(
      'credit_settlement_requests',
      'credits',
      async () => {
        if (settlementRequestsListeners.size === 0) return;
        ensureCreditSettlementRequestsListener();
        try {
          const snap = await getCreditDocsFast(CREDIT_SETTLEMENT_REQUESTS_COLLECTION);
          settlementRequestsCache = sortByCreatedAtDesc(
            snap.docs.map((d) => coerceSettlementRequestDoc(d.data(), d.id))
          );
          hasSettlementRequestsHydrated = true;
          notifySettlementRequestsListeners();
        } catch (err) {
          console.warn('Credit settlement requests wake refresh warning:', err);
        }
      }
    );
  }
  if (settlementRequestsUnsub) return;

  settlementRequestsUnsub = onSnapshot(
    collection(db, CREDIT_SETTLEMENT_REQUESTS_COLLECTION),
    (snapshot) => {
      resetResilientRetry('credit_settlement_requests');
      settlementRequestsCache = sortByCreatedAtDesc(
        snapshot.docs.map((d) => coerceSettlementRequestDoc(d.data(), d.id))
      );
      hasSettlementRequestsHydrated = true;
      notifySettlementRequestsListeners();
    },
    (error) => {
      if (settlementRequestsUnsub) {
        try {
          settlementRequestsUnsub();
        } catch {
          // Ignore
        }
        settlementRequestsUnsub = null;
      }
      scheduleResilientRetry(
        'credit_settlement_requests',
        () => settlementRequestsListeners.size > 0,
        () => ensureCreditSettlementRequestsListener(),
        error
      );
    }
  );
}

export function subscribeToCreditSettlementRequests(
  cb: (records: CreditSettlementRequest[]) => void
): () => void {
  settlementRequestsListeners.add(cb);
  ensureCreditSettlementRequestsListener();
  if (hasSettlementRequestsHydrated) {
    cb(settlementRequestsCache);
  }
  return () => {
    settlementRequestsListeners.delete(cb);
    if (settlementRequestsListeners.size === 0) {
      resetResilientRetry('credit_settlement_requests');
      if (settlementRequestsUnsub) {
        settlementRequestsUnsub();
        settlementRequestsUnsub = null;
      }
      if (settlementRequestsRefreshUnsub) {
        settlementRequestsRefreshUnsub();
        settlementRequestsRefreshUnsub = null;
      }
      hasSettlementRequestsHydrated = false;
    }
  };
}

export function useCreditSettlementRequests(): CreditSettlementRequest[] {
  const [records, setRecords] = useState<CreditSettlementRequest[]>(
    settlementRequestsCache
  );
  useEffect(() => subscribeToCreditSettlementRequests(setRecords), []);
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
  barberId?: CaisseBarberId;
  barberName?: string;
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
  const cleanBarberId = String(input.barberId || '').trim().slice(0, 64);
  const cleanBarberName = String(input.barberName || '').trim().slice(0, 100);

  const record: ClientCreditRecord = {
    id,
    clientName: cleanName,
    clientPhone: cleanPhone,
    normalizedPhone,
    ...(extra.displays.length > 0 ? { additionalPhones: extra.displays } : {}),
    ...(extra.normalized.length > 0 ? { normalizedAdditionalPhones: extra.normalized } : {}),
    ...(cleanBarberId ? { barberId: cleanBarberId } : {}),
    ...(cleanBarberName ? { barberName: cleanBarberName } : {}),
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
    creditsCache = sortByCreatedAtDesc([record, ...creditsCache.filter((r) => r.id !== id)]);
    hasCreditsHydrated = true;
    notifyCreditsListeners();
    emitRealtimeSyncHint('credits');
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
    barberId?: CaisseBarberId;
    barberName?: string;
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

  const extra =
    patch.additionalPhones !== undefined ? cleanAdditionalPhonesList(patch.additionalPhones) : null;
  if (extra) {
    payload.additionalPhones = extra.displays.length > 0 ? extra.displays : deleteField();
    payload.normalizedAdditionalPhones = extra.normalized.length > 0 ? extra.normalized : deleteField();
  }

  if (patch.barberId !== undefined) {
    const cleanBarber = String(patch.barberId || '').trim().slice(0, 64);
    payload.barberId = cleanBarber ? cleanBarber : deleteField();
    const cleanBarberName = String(patch.barberName || '').trim().slice(0, 100);
    payload.barberName = cleanBarber && cleanBarberName ? cleanBarberName : deleteField();
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
    const updatedRec: ClientCreditRecord = {
      ...current,
      clientName: nextName,
      clientPhone: nextPhoneRaw,
      normalizedPhone: nextNormalized,
      amountOwedMAD: nextOwed,
      originalAmountMAD: nextOriginal,
      status: nextStatus,
      updatedAt: nowIso,
    };
    if (extra) {
      if (extra.displays.length > 0) updatedRec.additionalPhones = extra.displays;
      else delete updatedRec.additionalPhones;
      if (extra.normalized.length > 0) updatedRec.normalizedAdditionalPhones = extra.normalized;
      else delete updatedRec.normalizedAdditionalPhones;
    }
    if (patch.barberId !== undefined) {
      const cleanBarber = String(patch.barberId || '').trim().slice(0, 64);
      const cleanBarberName = String(patch.barberName || '').trim().slice(0, 100);
      if (cleanBarber) updatedRec.barberId = cleanBarber;
      else delete updatedRec.barberId;
      if (cleanBarber && cleanBarberName) updatedRec.barberName = cleanBarberName;
      else delete updatedRec.barberName;
    }
    if (patch.creditDate !== undefined) {
      const trimmedDate = patch.creditDate.trim().slice(0, 20);
      if (trimmedDate) updatedRec.creditDate = trimmedDate;
      else delete updatedRec.creditDate;
    }
    if (patch.note !== undefined) {
      const trimmed = patch.note.trim().slice(0, 400);
      if (trimmed) updatedRec.note = trimmed;
      else delete updatedRec.note;
    }
    creditsCache = sortByCreatedAtDesc(
      creditsCache.map((r) => (r.id === creditId ? updatedRec : r))
    );
    hasCreditsHydrated = true;
    notifyCreditsListeners();
    emitRealtimeSyncHint('credits');
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
    creditsCache = sortByCreatedAtDesc(
      creditsCache.map((r) =>
        r.id === record.id
          ? {
              ...r,
              amountOwedMAD: nextRemaining,
              status: nextStatus,
              updatedAt: nowIso,
            }
          : r
      )
    );
    hasCreditsHydrated = true;
    notifyCreditsListeners();
    emitRealtimeSyncHint('credits');
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
    creditsCache = creditsCache.filter((r) => r.id !== creditId);
    hasCreditsHydrated = true;
    notifyCreditsListeners();
    emitRealtimeSyncHint('credits');
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
    disputesCache = sortByCreatedAtDesc([record, ...disputesCache.filter((d) => d.id !== id)]);
    hasDisputesHydrated = true;
    notifyDisputesListeners();
    emitRealtimeSyncHint('credits');
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
    disputesCache = sortByCreatedAtDesc(
      disputesCache.map((d) => {
        if (d.id !== disputeId) return d;
        const next: CreditDisputeRecord = {
          ...d,
          status: patch.status,
          updatedAt: nowIso,
        };
        if (patch.staffNote !== undefined) {
          const trimmed = patch.staffNote.trim().slice(0, 400);
          if (trimmed) next.staffNote = trimmed;
          else delete next.staffNote;
        }
        if (patch.resolvedBy !== undefined) {
          const cleanActor = patch.resolvedBy.trim().slice(0, 100);
          if (cleanActor) next.resolvedBy = cleanActor;
          else delete next.resolvedBy;
        }
        if (patch.status === 'resolved') next.resolvedAt = nowIso;
        else delete next.resolvedAt;
        return next;
      })
    );
    hasDisputesHydrated = true;
    notifyDisputesListeners();
    emitRealtimeSyncHint('credits');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CREDIT_DISPUTES_COLLECTION}/${disputeId}`);
  }
}

export async function deleteCreditDispute(disputeId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, CREDIT_DISPUTES_COLLECTION, disputeId));
    disputesCache = disputesCache.filter((d) => d.id !== disputeId);
    hasDisputesHydrated = true;
    notifyDisputesListeners();
    emitRealtimeSyncHint('credits');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CREDIT_DISPUTES_COLLECTION}/${disputeId}`);
  }
}

export async function submitCreditSettlementRequest(input: {
  sourceType: CreditSettlementSourceType;
  sourceId?: string;
  barberId?: string;
  barberName?: string;
  clientName: string;
  clientPhone?: string;
  actionType: CreditSettlementActionType;
  originalRemainingMAD: number;
  requestedAmountMAD: number;
  note?: string;
  submittedBy: string;
  submittedRole: 'client' | 'barber' | 'caisse' | 'master';
}): Promise<CreditSettlementRequest> {
  const id = sanitizeCreditId(
    `csreq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  );
  const nowIso = new Date().toISOString().slice(0, 64);
  const cleanPhone = String(input.clientPhone || '').trim().slice(0, 40);
  const normalizedPhone = cleanPhone
    ? (normalizeMoroccanPhoneDigits(cleanPhone) || cleanPhone.replace(/\D/g, '')).slice(0, 32)
    : '';
  const cleanName = String(input.clientName || '').trim().slice(0, 120) || 'زبون';
  const orig = clampCreditAmount(input.originalRemainingMAD);
  const reqAmt = clampCreditAmount(input.requestedAmountMAD);
  const cleanSourceId = String(input.sourceId || '').trim().slice(0, 128);
  const cleanBarberId = String(input.barberId || '').trim().slice(0, 64);
  const cleanBarberName = String(input.barberName || '').trim().slice(0, 100);
  const cleanNote = String(input.note || '').trim().slice(0, 400);

  const record: CreditSettlementRequest = {
    id,
    sourceType: input.sourceType,
    ...(cleanSourceId ? { sourceId: cleanSourceId } : {}),
    ...(cleanBarberId ? { barberId: cleanBarberId } : {}),
    ...(cleanBarberName ? { barberName: cleanBarberName } : {}),
    clientName: cleanName,
    clientPhone: cleanPhone,
    normalizedPhone,
    actionType: input.actionType,
    originalRemainingMAD: orig,
    requestedAmountMAD: reqAmt,
    status: 'pending',
    ...(cleanNote ? { note: cleanNote } : {}),
    submittedBy: String(input.submittedBy || cleanName).trim().slice(0, 100),
    submittedRole: input.submittedRole,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(db, CREDIT_SETTLEMENT_REQUESTS_COLLECTION, id), record);
    settlementRequestsCache = sortByCreatedAtDesc([
      record,
      ...settlementRequestsCache.filter((r) => r.id !== id),
    ]);
    hasSettlementRequestsHydrated = true;
    notifySettlementRequestsListeners();
    emitRealtimeSyncHint('credits');
    return record;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `${CREDIT_SETTLEMENT_REQUESTS_COLLECTION}/${id}`
    );
  }
}

export async function confirmCreditSettlementRequest(params: {
  request: CreditSettlementRequest;
  approvedAmountMAD: number;
  reviewedBy: string;
  reviewerNote?: string;
  caisseEntries: CaisseEntry[];
  manualCredits: ClientCreditRecord[];
}): Promise<number> {
  const { request, approvedAmountMAD, reviewedBy, reviewerNote, caisseEntries, manualCredits } =
    params;
  const cleanApproved = clampCreditAmount(approvedAmountMAD);
  const nowIso = new Date().toISOString().slice(0, 64);
  const todayBiz = getSalonBusinessDate();
  const cleanActor = String(reviewedBy || 'Hassan ait boumlik').trim().slice(0, 100);

  let remainingToApply = cleanApproved;
  let totalApplied = 0;

  const applyToCaisseEntry = async (entry: CaisseEntry, maxToApply: number): Promise<number> => {
    const curRem = getEffectiveCaisseCreditRemaining(entry);
    const applyAmt = Math.min(curRem, maxToApply);
    if (applyAmt <= 0) return 0;

    if (request.actionType === 'pay') {
      await recordCaisseCreditRepayment({
        creditEntry: entry,
        amountRepaidMAD: applyAmt,
        repaidDate: todayBiz,
        actorRole: 'master',
        actorName: cleanActor,
      });
    } else {
      const nextRem = Math.max(0, Math.round((curRem - applyAmt) * 100) / 100);
      await updateCaisseEntry(entry.id, {
        creditRemainingMAD: nextRem,
        creditStatus: nextRem <= 0 ? 'paid' : 'partial',
        note: entry.note
          ? `${entry.note} · فك الكريدي (${applyAmt} MAD)`
          : `فك الكريدي (${applyAmt} MAD)`,
      });
    }
    return applyAmt;
  };

  if (cleanApproved > 0) {
    if (request.sourceType === 'caisse' && request.sourceId) {
      const target = caisseEntries.find((e) => e.id === request.sourceId);
      if (target) {
        const applied = await applyToCaisseEntry(target, remainingToApply);
        totalApplied += applied;
        remainingToApply = Math.max(0, remainingToApply - applied);
      }
    } else if (request.sourceType === 'manual' && request.sourceId) {
      const target = manualCredits.find((r) => r.id === request.sourceId);
      const owed = target ? getEffectiveManualCreditRemaining(target) : 0;
      if (target && owed > 0) {
        const applyAmt = Math.min(owed, remainingToApply);
        if (applyAmt > 0) {
          await recordManualCreditPayment(target, applyAmt);
          totalApplied += applyAmt;
          remainingToApply = Math.max(0, remainingToApply - applyAmt);
        }
      }
    } else {
      // 'aggregate': apply across matching open caisse entries and manual records by normalizedPhone (and optional barberId)
      const normPhone =
        request.normalizedPhone ||
        normalizeMoroccanPhoneDigits(request.clientPhone || '');
      if (normPhone) {
        const matchingCaisse = caisseEntries.filter((e) => {
          if (getEffectiveCaisseCreditRemaining(e) <= 0) return false;
          if (request.barberId && !matchesCaisseBarber(e.barberId, e.barberName, request.barberId)) {
            return false;
          }
          return normalizeMoroccanPhoneDigits(e.clientPhone || '') === normPhone;
        });
        for (const ce of matchingCaisse) {
          if (remainingToApply <= 0) break;
          const applied = await applyToCaisseEntry(ce, remainingToApply);
          totalApplied += applied;
          remainingToApply = Math.max(0, remainingToApply - applied);
        }

        const matchingManual = manualCredits.filter((r) => {
          if (getEffectiveManualCreditRemaining(r) <= 0) return false;
          if (
            request.barberId &&
            !matchesCaisseBarber(r.barberId || 'hassan', r.barberName, request.barberId)
          ) {
            return false;
          }
          if (r.normalizedPhone === normPhone) return true;
          if (r.clientPhone && normalizeMoroccanPhoneDigits(r.clientPhone) === normPhone) return true;
          if (
            Array.isArray(r.normalizedAdditionalPhones) &&
            r.normalizedAdditionalPhones.some((np) => np === normPhone)
          ) {
            return true;
          }
          return false;
        });
        for (const rec of matchingManual) {
          if (remainingToApply <= 0) break;
          const recOwed = getEffectiveManualCreditRemaining(rec);
          const applyAmt = Math.min(recOwed, remainingToApply);
          if (applyAmt > 0) {
            await recordManualCreditPayment(rec, applyAmt);
            totalApplied += applyAmt;
            remainingToApply = Math.max(0, remainingToApply - applyAmt);
          }
        }
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    status: 'confirmed',
    approvedAmountMAD: cleanApproved,
    reviewedBy: cleanActor,
    reviewedAt: nowIso,
    updatedAt: nowIso,
  };
  if (reviewerNote !== undefined) {
    const cleanRevNote = reviewerNote.trim().slice(0, 400);
    updatePayload.reviewerNote = cleanRevNote ? cleanRevNote : deleteField();
  }

  try {
    await updateDoc(
      doc(db, CREDIT_SETTLEMENT_REQUESTS_COLLECTION, request.id),
      updatePayload
    );
    settlementRequestsCache = sortByCreatedAtDesc(
      settlementRequestsCache.map((r) => {
        if (r.id !== request.id) return r;
        const next: CreditSettlementRequest = {
          ...r,
          status: 'confirmed',
          approvedAmountMAD: cleanApproved,
          reviewedBy: cleanActor,
          reviewedAt: nowIso,
          updatedAt: nowIso,
        };
        if (reviewerNote !== undefined) {
          const cleanRevNote = reviewerNote.trim().slice(0, 400);
          if (cleanRevNote) next.reviewerNote = cleanRevNote;
          else delete next.reviewerNote;
        }
        return next;
      })
    );
    hasSettlementRequestsHydrated = true;
    notifySettlementRequestsListeners();
    emitRealtimeSyncHint('credits');
    emitRealtimeSyncHint('caisse');
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `${CREDIT_SETTLEMENT_REQUESTS_COLLECTION}/${request.id}`
    );
  }

  return Math.round(totalApplied * 100) / 100 || cleanApproved;
}

export async function rejectCreditSettlementRequest(params: {
  requestId: string;
  reviewedBy: string;
  reviewerNote?: string;
}): Promise<void> {
  const nowIso = new Date().toISOString().slice(0, 64);
  const cleanReviewer = String(params.reviewedBy || 'Hassan ait boumlik').trim().slice(0, 100);
  const payload: Record<string, unknown> = {
    status: 'rejected',
    reviewedBy: cleanReviewer,
    reviewedAt: nowIso,
    updatedAt: nowIso,
  };
  if (params.reviewerNote !== undefined) {
    const cleanRevNote = params.reviewerNote.trim().slice(0, 400);
    payload.reviewerNote = cleanRevNote ? cleanRevNote : deleteField();
  }

  try {
    await updateDoc(
      doc(db, CREDIT_SETTLEMENT_REQUESTS_COLLECTION, params.requestId),
      payload
    );
    settlementRequestsCache = sortByCreatedAtDesc(
      settlementRequestsCache.map((r) => {
        if (r.id !== params.requestId) return r;
        const next: CreditSettlementRequest = {
          ...r,
          status: 'rejected',
          reviewedBy: cleanReviewer,
          reviewedAt: nowIso,
          updatedAt: nowIso,
        };
        if (params.reviewerNote !== undefined) {
          const cleanRevNote = params.reviewerNote.trim().slice(0, 400);
          if (cleanRevNote) next.reviewerNote = cleanRevNote;
          else delete next.reviewerNote;
        }
        return next;
      })
    );
    hasSettlementRequestsHydrated = true;
    notifySettlementRequestsListeners();
    emitRealtimeSyncHint('credits');
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `${CREDIT_SETTLEMENT_REQUESTS_COLLECTION}/${params.requestId}`
    );
  }
}

export async function deleteCreditSettlementRequest(requestId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, CREDIT_SETTLEMENT_REQUESTS_COLLECTION, requestId));
    settlementRequestsCache = settlementRequestsCache.filter((r) => r.id !== requestId);
    hasSettlementRequestsHydrated = true;
    notifySettlementRequestsListeners();
    emitRealtimeSyncHint('credits');
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `${CREDIT_SETTLEMENT_REQUESTS_COLLECTION}/${requestId}`
    );
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
      getEffectiveCaisseCreditRemaining(entry) > 0 &&
      normalizeMoroccanPhoneDigits(entry.clientPhone || '') === norm
  );

  const manualItems = manualCredits.filter((rec) => {
    if (getEffectiveManualCreditRemaining(rec) <= 0) return false;
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
      caisseItems.reduce((sum, item) => sum + getEffectiveCaisseCreditRemaining(item), 0) * 100
    ) / 100;

  const manualCreditMAD =
    Math.round(
      manualItems.reduce((sum, item) => sum + getEffectiveManualCreditRemaining(item), 0) * 100
    ) / 100;

  const totalOwedMAD = Math.round((caisseCreditMAD + manualCreditMAD) * 100) / 100;

  const namesSet = new Set<string>();
  const datesSet = new Set<string>();
  manualItems.forEach((m) => {
    const cname = asStr(m.clientName, '').trim();
    if (cname) namesSet.add(cname);
    const d = asDateString(m.creditDate, '') || asIsoString(m.createdAt, '').slice(0, 10);
    if (d) datesSet.add(d);
  });
  caisseItems.forEach((c) => {
    const cname = asStr(c.clientName, '').trim();
    if (cname) namesSet.add(cname);
    const d = asDateString(c.date, '') || asIsoString(c.createdAt, '').slice(0, 10);
    if (d) datesSet.add(d);
  });

  const creditDates = Array.from(datesSet).sort().reverse();

  // Group creditors clearly so client sees WHO is owed (specific barber vs management)
  const breakdownMap = new Map<string, CreditorBreakdownItem>();

  caisseItems.forEach((entry) => {
    const amt = getEffectiveCaisseCreditRemaining(entry);
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

  manualItems.forEach((rec) => {
    const amt = getEffectiveManualCreditRemaining(rec);
    if (amt <= 0) return;
    const assignedBarberId = rec.barberId || 'hassan';
    const meta = getCaisseBarberMeta(assignedBarberId, rosterMembers);
    const key = `manual_${assignedBarberId}`;
    const label =
      assignedBarberId === 'hassan'
        ? 'إدارة الصالون (حسن أيت بومليك)'
        : meta.arName || rec.barberName || assignedBarberId;
    const prev = breakdownMap.get(key);
    if (prev) {
      prev.amountMAD = Math.round((prev.amountMAD + amt) * 100) / 100;
    } else {
      breakdownMap.set(key, {
        creditorKey: key,
        creditorLabel: label,
        barberId: assignedBarberId,
        amountMAD: amt,
        source: 'manual',
      });
    }
  });

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

