import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { AppointmentBooking, CrmClientProfile } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  emitRealtimeSyncHint,
  registerRealtimeRefreshHandler,
  resetResilientRetry,
  scheduleResilientRetry,
} from './realtimeSync';
import {
  deleteBooking,
  markBookingAttendanceCompleted,
  normalizeMoroccanPhoneDigits,
  updateBookingStatus,
} from './bookingStore';
import {
  computeBookingLoyaltyPoints,
  computeClientPointsSummary,
  getMilestoneRewardLabel,
  LoyaltyPointRewardKind,
} from './loyaltyEngine';
import { dispatchClientBackgroundPush } from './webPushClient';
import { asFiniteNum, asIsoString, asStr, safeCompareDesc } from './safeCoerce';

const CRM_COLLECTION = 'crm_clients';

export function getCrmDocId(rawPhone: string): string {
  const cleanedRaw = String(rawPhone || '').replace(/^c_/i, '');
  const canonical = normalizeMoroccanPhoneDigits(cleanedRaw);
  const fallback = cleanedRaw.replace(/\D/g, '');
  const key = (canonical || fallback || '00000').replace(/[^a-zA-Z0-9_-]/g, '');
  return `c_${key}`.slice(0, 64);
}

export function findCrmProfileByPhone(
  rawPhone: string,
  crmMap: Record<string, CrmClientProfile> = cachedCrmMap
): CrmClientProfile | undefined {
  const canonicalId = getCrmDocId(rawPhone);
  if (crmMap[canonicalId]) return crmMap[canonicalId];
  const canonicalDigits = normalizeMoroccanPhoneDigits(rawPhone);
  if (!canonicalDigits) return undefined;
  return Object.values(crmMap).find((p) => {
    const pDigits = normalizeMoroccanPhoneDigits(
      p.normalizedPhone || p.phoneDisplay || p.id.replace(/^c_/i, '')
    );
    return pDigits === canonicalDigits;
  });
}

let cachedCrmMap: Record<string, CrmClientProfile> = {};
let hasHydratedCrm = false;
const crmListeners = new Set<(map: Record<string, CrmClientProfile>) => void>();
let activeCrmUnsubscribe: (() => void) | null = null;
let crmRefreshUnsub: (() => void) | null = null;

function commitCrmCache(next: Record<string, CrmClientProfile>, broadcastHint = false): void {
  cachedCrmMap = next;
  hasHydratedCrm = true;
  crmListeners.forEach((cb) => {
    try {
      cb(cachedCrmMap);
    } catch (err) {
      console.warn('CRM listener callback error:', err);
    }
  });
  if (broadcastHint) {
    emitRealtimeSyncHint('crm');
  }
}

function coerceCrmProfileDoc(rawInput: unknown, docId: string): CrmClientProfile {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = asStr(raw.id, docId) || docId;
  return {
    ...(raw as Partial<CrmClientProfile>),
    id,
    normalizedPhone: asStr(raw.normalizedPhone, ''),
    phoneDisplay: asStr(raw.phoneDisplay, ''),
    clientName: asStr(raw.clientName, 'Client'),
    isVip: Boolean(raw.isVip),
    noShowCount: asFiniteNum(raw.noShowCount, 0),
    isBanned: Boolean(raw.isBanned),
    freeWashesRedeemed: asFiniteNum(raw.freeWashesRedeemed, 0),
    customDiscountMAD: asFiniteNum(raw.customDiscountMAD, 0),
    verifiedVisits: asFiniteNum(raw.verifiedVisits, 0),
    loyaltyPoints: raw.loyaltyPoints !== undefined ? asFiniteNum(raw.loyaltyPoints, 0) : undefined,
    pointsEarnedTotal:
      raw.pointsEarnedTotal !== undefined ? asFiniteNum(raw.pointsEarnedTotal, 0) : undefined,
    pointsRedeemedTotal:
      raw.pointsRedeemedTotal !== undefined ? asFiniteNum(raw.pointsRedeemedTotal, 0) : undefined,
    updatedAt: asIsoString(raw.updatedAt, ''),
  };
}

function ensureCrmListener() {
  if (!crmRefreshUnsub) {
    crmRefreshUnsub = registerRealtimeRefreshHandler('crm_clients', 'crm', async () => {
      if (crmListeners.size === 0) return;
      ensureCrmListener();
      try {
        let snap;
        try {
          snap = await getDocsFromServer(collection(db, CRM_COLLECTION));
        } catch {
          snap = await getDocs(collection(db, CRM_COLLECTION));
        }
        const next: Record<string, CrmClientProfile> = {};
        snap.docs.forEach((docSnap) => {
          const item = coerceCrmProfileDoc(docSnap.data(), docSnap.id);
          next[item.id] = item;
        });
        commitCrmCache(next);
      } catch (err) {
        console.warn('CRM wake refresh warning:', err);
      }
    });
  }
  if (activeCrmUnsubscribe) return;

  activeCrmUnsubscribe = onSnapshot(
    collection(db, CRM_COLLECTION),
    (snapshot) => {
      resetResilientRetry('crm_clients');
      const next: Record<string, CrmClientProfile> = {};
      snapshot.docs.forEach((docSnap) => {
        const item = coerceCrmProfileDoc(docSnap.data(), docSnap.id);
        next[item.id] = item;
      });
      commitCrmCache(next);
    },
    (error) => {
      if (activeCrmUnsubscribe) {
        try {
          activeCrmUnsubscribe();
        } catch {
          // Ignore
        }
        activeCrmUnsubscribe = null;
      }
      scheduleResilientRetry(
        'crm_clients',
        () => crmListeners.size > 0,
        () => ensureCrmListener(),
        error
      );
    }
  );
}

export function subscribeToCrmClients(
  onData: (map: Record<string, CrmClientProfile>) => void
): () => void {
  crmListeners.add(onData);
  ensureCrmListener();
  if (hasHydratedCrm) {
    onData(cachedCrmMap);
  }
  return () => {
    crmListeners.delete(onData);
    if (crmListeners.size === 0) {
      resetResilientRetry('crm_clients');
      if (activeCrmUnsubscribe) {
        activeCrmUnsubscribe();
        activeCrmUnsubscribe = null;
      }
      if (crmRefreshUnsub) {
        crmRefreshUnsub();
        crmRefreshUnsub = null;
      }
      hasHydratedCrm = false;
    }
  };
}

export function useCrmClients(): Record<string, CrmClientProfile> {
  const [clients, setClients] = useState<Record<string, CrmClientProfile>>(cachedCrmMap);

  useEffect(() => {
    const unsub = subscribeToCrmClients((map) => {
      setClients({ ...map });
    });
    return () => unsub();
  }, []);

  return clients;
}

export interface AggregatedCrmClient {
  id: string;
  allDocIds: string[];
  normalizedPhone: string;
  phoneDisplay: string;
  clientName: string;
  nameAliases: string[];
  isVip: boolean;
  noShowCount: number;
  isBanned: boolean;
  banReason?: string;
  freeWashesRedeemed: number;
  customDiscountMAD: number;
  verifiedVisits: number;
  loyaltyPoints: number;
  pointsEarnedTotal: number;
  pointsRedeemedTotal: number;
  rewardNote?: string;
  visitCount: number;
  completedCount: number;
  lifetimeSpendMAD: number;
  eligibleFreeWashes: number;
  lastVisitDate: string;
  bookings: AppointmentBooking[];
}

export function buildCrmClientSummaries(
  bookings: AppointmentBooking[],
  crmMap: Record<string, CrmClientProfile>
): AggregatedCrmClient[] {
  const grouped = new Map<string, AggregatedCrmClient>();

  const registerName = (entry: AggregatedCrmClient, candidateName?: string) => {
    const trimmed = String(candidateName || '').trim();
    if (!trimmed) return;
    if (!entry.clientName || entry.clientName === 'Client' || entry.clientName === 'زبون') {
      entry.clientName = trimmed;
    }
    if (!entry.nameAliases.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      entry.nameAliases.push(trimmed);
    }
  };

  const ensureEntry = (
    rawPhoneOrId: string,
    phoneDisplay: string,
    normalizedPhone: string,
    name: string,
    storedDocId?: string
  ) => {
    const canonicalId = getCrmDocId(normalizedPhone || phoneDisplay || rawPhoneOrId);
    const canonicalDigits =
      normalizeMoroccanPhoneDigits(normalizedPhone || phoneDisplay || rawPhoneOrId) ||
      normalizedPhone;

    let entry = grouped.get(canonicalId);
    if (!entry) {
      const stored = crmMap[canonicalId] || (storedDocId ? crmMap[storedDocId] : undefined);
      entry = {
        id: canonicalId,
        allDocIds: [],
        normalizedPhone: canonicalDigits || stored?.normalizedPhone || '',
        phoneDisplay: stored?.phoneDisplay || phoneDisplay || canonicalDigits,
        clientName: stored?.clientName || name || 'Client',
        nameAliases: [],
        isVip: Boolean(stored?.isVip),
        noShowCount: stored?.noShowCount ?? 0,
        isBanned: Boolean(stored?.isBanned),
        banReason: stored?.banReason,
        freeWashesRedeemed: stored?.freeWashesRedeemed ?? 0,
        customDiscountMAD: stored?.customDiscountMAD ?? 0,
        verifiedVisits: stored?.verifiedVisits ?? 0,
        loyaltyPoints: stored?.loyaltyPoints ?? 0,
        pointsEarnedTotal: stored?.pointsEarnedTotal ?? 0,
        pointsRedeemedTotal: stored?.pointsRedeemedTotal ?? 0,
        rewardNote: stored?.rewardNote,
        visitCount: 0,
        completedCount: 0,
        lifetimeSpendMAD: 0,
        eligibleFreeWashes: 0,
        lastVisitDate: '',
        bookings: [],
      };
      registerName(entry, entry.clientName);
      grouped.set(canonicalId, entry);
    }

    if (storedDocId && !entry.allDocIds.includes(storedDocId)) {
      entry.allDocIds.push(storedDocId);
    }
    if (crmMap[canonicalId] && !entry.allDocIds.includes(canonicalId)) {
      entry.allDocIds.push(canonicalId);
    }
    registerName(entry, name);
    return entry;
  };

  // Seed entries from persisted CRM records first, consolidating any phone variants under ONE unified profile
  Object.values(crmMap).forEach((profile) => {
    const rawKey = profile.normalizedPhone || profile.phoneDisplay || profile.id.replace(/^c_/i, '');
    const entry = ensureEntry(
      rawKey,
      profile.phoneDisplay,
      normalizeMoroccanPhoneDigits(rawKey) || profile.normalizedPhone,
      profile.clientName,
      profile.id
    );
    entry.isVip = entry.isVip || Boolean(profile.isVip);
    entry.isBanned = entry.isBanned || Boolean(profile.isBanned);
    entry.noShowCount = Math.max(entry.noShowCount, profile.noShowCount ?? 0);
    entry.freeWashesRedeemed = Math.max(
      entry.freeWashesRedeemed,
      profile.freeWashesRedeemed ?? 0
    );
    entry.customDiscountMAD = Math.max(
      entry.customDiscountMAD,
      profile.customDiscountMAD ?? 0
    );
    entry.verifiedVisits = Math.max(entry.verifiedVisits, profile.verifiedVisits ?? 0);
    entry.loyaltyPoints = Math.max(entry.loyaltyPoints, profile.loyaltyPoints ?? 0);
    entry.pointsEarnedTotal = Math.max(
      entry.pointsEarnedTotal,
      profile.pointsEarnedTotal ?? 0
    );
    entry.pointsRedeemedTotal = Math.max(
      entry.pointsRedeemedTotal,
      profile.pointsRedeemedTotal ?? 0
    );
    if (!entry.banReason && profile.banReason) entry.banReason = profile.banReason;
    if (!entry.rewardNote && profile.rewardNote) entry.rewardNote = profile.rewardNote;
    if (profile.phoneDisplay && (!entry.phoneDisplay || profile.phoneDisplay.startsWith('0'))) {
      entry.phoneDisplay = profile.phoneDisplay;
    }
  });

  // Aggregate live bookings strictly by canonical Moroccan phone number
  bookings.forEach((b) => {
    const digits = normalizeMoroccanPhoneDigits(b.clientPhone);
    if (!digits || digits.length < 4) return;
    const entry = ensureEntry(b.clientPhone, b.clientPhone, digits, b.clientName);
    entry.bookings.push(b);

    if (!entry.lastVisitDate || b.date > entry.lastVisitDate) {
      entry.lastVisitDate = b.date;
    }

    const isNonCancelledBooking = !['cancelled', 'rejected', 'no_show'].includes(b.status);
    if (isNonCancelledBooking) {
      entry.visitCount += 1;
    }
    if (b.status === 'completed') {
      entry.completedCount += 1;
    }
    if (b.status === 'confirmed' || b.status === 'completed') {
      entry.lifetimeSpendMAD += b.finalTotalMAD || 0;
    }
  });

  const list = Array.from(grouped.values()).map((client) => {
    const sortedBookings = [...client.bookings].sort((a, b) =>
      a.date === b.date
        ? safeCompareDesc(a.timeSlot, b.timeSlot)
        : safeCompareDesc(a.date, b.date)
    );
    const canonicalVerified = Math.max(client.verifiedVisits, client.completedCount);
    const storedProfile =
      crmMap[client.id] ||
      client.allDocIds.map((id) => crmMap[id]).find(Boolean);
    const pointsSummary = computeClientPointsSummary(
      canonicalVerified,
      {
        ...(storedProfile || {
          id: client.id,
          normalizedPhone: client.normalizedPhone,
          phoneDisplay: client.phoneDisplay,
          clientName: client.clientName,
          isVip: client.isVip,
          noShowCount: client.noShowCount,
          isBanned: client.isBanned,
          freeWashesRedeemed: client.freeWashesRedeemed,
          customDiscountMAD: client.customDiscountMAD,
          verifiedVisits: client.verifiedVisits,
          updatedAt: new Date().toISOString(),
        }),
        loyaltyPoints: client.loyaltyPoints,
        pointsEarnedTotal: client.pointsEarnedTotal,
        pointsRedeemedTotal: client.pointsRedeemedTotal,
      },
      sortedBookings
    );
    const earnedWashes = Math.floor(canonicalVerified / 5);
    const eligibleFreeWashes = Math.max(0, earnedWashes - client.freeWashesRedeemed);
    return {
      ...client,
      verifiedVisits: canonicalVerified,
      loyaltyPoints: pointsSummary.pointsBalance,
      pointsEarnedTotal: pointsSummary.pointsEarnedTotal,
      pointsRedeemedTotal: pointsSummary.pointsRedeemedTotal,
      bookings: sortedBookings,
      eligibleFreeWashes,
    };
  });

  return list.sort((a, b) => {
    if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
    if (a.visitCount !== b.visitCount) return b.visitCount - a.visitCount;
    return safeCompareDesc(a.lastVisitDate, b.lastVisitDate);
  });
}

function buildSanitizedCrmProfile(
  phone: string,
  clientName: string,
  patch: Partial<CrmClientProfile>,
  existing?: CrmClientProfile
): CrmClientProfile {
  const id = getCrmDocId(phone);
  const normalizedPhone = (normalizeMoroccanPhoneDigits(phone) || phone.replace(/\D/g, '') || '0000').slice(0, 32);
  const profile: CrmClientProfile = {
    id,
    normalizedPhone,
    phoneDisplay: String(patch.phoneDisplay || existing?.phoneDisplay || phone || normalizedPhone).slice(0, 40),
    clientName: String(patch.clientName || existing?.clientName || clientName || 'Client').slice(0, 120),
    isVip: patch.isVip !== undefined ? patch.isVip : Boolean(existing?.isVip),
    noShowCount: Math.max(0, Math.min(500, patch.noShowCount ?? existing?.noShowCount ?? 0)),
    isBanned: patch.isBanned !== undefined ? patch.isBanned : Boolean(existing?.isBanned),
    freeWashesRedeemed: Math.max(0, Math.min(500, patch.freeWashesRedeemed ?? existing?.freeWashesRedeemed ?? 0)),
    customDiscountMAD: Math.max(0, Math.min(10000, patch.customDiscountMAD ?? existing?.customDiscountMAD ?? 0)),
    verifiedVisits: Math.max(0, Math.min(500, patch.verifiedVisits ?? existing?.verifiedVisits ?? 0)),
    loyaltyPoints: Math.max(0, Math.min(100000, patch.loyaltyPoints ?? existing?.loyaltyPoints ?? 0)),
    pointsEarnedTotal: Math.max(0, Math.min(100000, patch.pointsEarnedTotal ?? existing?.pointsEarnedTotal ?? 0)),
    pointsRedeemedTotal: Math.max(0, Math.min(100000, patch.pointsRedeemedTotal ?? existing?.pointsRedeemedTotal ?? 0)),
    updatedAt: new Date().toISOString().slice(0, 64),
  };

  const banReason = patch.banReason !== undefined ? patch.banReason : existing?.banReason;
  if (banReason && banReason.trim()) {
    profile.banReason = banReason.trim().slice(0, 300);
  }

  const rewardNote = patch.rewardNote !== undefined ? patch.rewardNote : existing?.rewardNote;
  if (rewardNote && rewardNote.trim()) {
    profile.rewardNote = rewardNote.trim().slice(0, 300);
  }

  return profile;
}

async function persistCrmProfile(profile: CrmClientProfile): Promise<CrmClientProfile> {
  const path = `${CRM_COLLECTION}/${profile.id}`;
  try {
    await setDoc(doc(db, CRM_COLLECTION, profile.id), profile);
    commitCrmCache({ ...cachedCrmMap, [profile.id]: profile }, true);
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleClientVip(
  phone: string,
  clientName: string,
  crmMap: Record<string, CrmClientProfile> = cachedCrmMap
): Promise<CrmClientProfile> {
  const existing = findCrmProfileByPhone(phone, crmMap);
  const next = buildSanitizedCrmProfile(phone, clientName, { isVip: !existing?.isVip }, existing);
  return persistCrmProfile(next);
}

/**
 * Records a No-Show on a booking and increments CRM noShowCount.
 * Automatically blacklists the client when noShowCount reaches >= 2.
 */
export async function recordClientNoShow(
  booking: AppointmentBooking,
  crmMap: Record<string, CrmClientProfile> = cachedCrmMap
): Promise<CrmClientProfile> {
  const existing = findCrmProfileByPhone(booking.clientPhone, crmMap);
  const nextNoShows = (existing?.noShowCount ?? 0) + 1;
  const shouldAutoBan = nextNoShows >= 2;

  await updateBookingStatus(
    booking.id,
    'no_show',
    shouldAutoBan
      ? 'تم تسجيل تغيب (No-Show) — تم إدراج الرقم في القائمة السوداء تلقائياً بعد تغيبين.'
      : 'تم تسجيل تغيب عن الموعد (No-Show #1).'
  );

  const next = buildSanitizedCrmProfile(
    booking.clientPhone,
    booking.clientName,
    {
      noShowCount: nextNoShows,
      isBanned: shouldAutoBan ? true : Boolean(existing?.isBanned),
      banReason: shouldAutoBan
        ? 'حظر تلقائي بعد تغيبين (2+ No-Shows)'
        : existing?.banReason,
    },
    existing
  );
  return persistCrmProfile(next);
}

/**
 * Manual Ban or Unban override in Admin Dashboard.
 */
export async function setClientBanStatus(
  phone: string,
  clientName: string,
  isBanned: boolean,
  reason?: string,
  crmMap: Record<string, CrmClientProfile> = cachedCrmMap
): Promise<CrmClientProfile> {
  const existing = findCrmProfileByPhone(phone, crmMap);
  const next = buildSanitizedCrmProfile(
    phone,
    clientName,
    {
      isBanned,
      banReason: isBanned
        ? reason || 'حظر يدوي من الإدارة'
        : 'تم رفع الحظر يدوياً من طرف الإدارة',
    },
    existing
  );
  return persistCrmProfile(next);
}

/**
 * Redeems a 5th-visit Free Hair Wash reward for a loyal customer.
 */
export async function redeemClientFreeWash(
  phone: string,
  clientName: string,
  crmMap: Record<string, CrmClientProfile> = cachedCrmMap
): Promise<CrmClientProfile> {
  const existing = findCrmProfileByPhone(phone, crmMap);
  const next = buildSanitizedCrmProfile(
    phone,
    clientName,
    {
      freeWashesRedeemed: (existing?.freeWashesRedeemed ?? 0) + 1,
      rewardNote: '🎁 غسل شعر مجاني — مكافأة الولاء (الزيارة 5)',
    },
    existing
  );
  return persistCrmProfile(next);
}

/**
 * Grants a custom loyalty discount in MAD on the client's CRM card.
 */
export async function grantClientCustomDiscount(
  phone: string,
  clientName: string,
  discountMAD: number,
  note: string,
  crmMap: Record<string, CrmClientProfile> = cachedCrmMap
): Promise<CrmClientProfile> {
  const existing = findCrmProfileByPhone(phone, crmMap);
  const next = buildSanitizedCrmProfile(
    phone,
    clientName,
    {
      customDiscountMAD: Math.max(0, Math.round(discountMAD)),
      rewardNote: note || `🎁 تخفيض خاص: ${Math.max(0, Math.round(discountMAD))} MAD`,
    },
    existing
  );
  return persistCrmProfile(next);
}

export interface ConfirmAttendanceResult {
  booking: AppointmentBooking | null;
  profile: CrmClientProfile;
  previousVerifiedVisits: number;
  newVerifiedVisits: number;
  pointsEarned: number;
  unlockedMilestone: number | null;
  alreadyCompleted: boolean;
}

/**
 * Confirms client attendance on a booking, marks it completed in Firestore,
 * and increments the verified loyalty visit count on `crm_clients/{clientId}`
 * (only when the booking was not already marked completed, preventing double-counting).
 */
export async function confirmClientAttendance(
  booking: AppointmentBooking,
  allBookings: AppointmentBooking[],
  crmMap: Record<string, CrmClientProfile> = cachedCrmMap
): Promise<ConfirmAttendanceResult> {
  const existing = findCrmProfileByPhone(booking.clientPhone, crmMap);
  const digits = normalizeMoroccanPhoneDigits(booking.clientPhone);

  const completedBookingsBefore = digits
    ? allBookings.filter(
        (b) =>
          b.id !== booking.id &&
          normalizeMoroccanPhoneDigits(b.clientPhone) === digits &&
          b.status === 'completed'
      ).length
    : 0;

  const priorVerified = Math.max(existing?.verifiedVisits ?? 0, completedBookingsBefore);

  if (booking.status === 'completed') {
    const stableVerified = Math.max(priorVerified, completedBookingsBefore + 1);
    const ensured = buildSanitizedCrmProfile(
      booking.clientPhone,
      booking.clientName,
      { verifiedVisits: stableVerified },
      existing
    );
    const savedProfile =
      existing?.verifiedVisits === stableVerified ? existing : await persistCrmProfile(ensured);
    return {
      booking,
      profile: savedProfile,
      previousVerifiedVisits: stableVerified,
      newVerifiedVisits: stableVerified,
      pointsEarned: 0,
      unlockedMilestone: null,
      alreadyCompleted: true,
    };
  }

  const nextVerifiedVisits = priorVerified + 1;
  const priorBookingsForClient = digits
    ? allBookings.filter((b) => normalizeMoroccanPhoneDigits(b.clientPhone) === digits)
    : [];
  const currentPointsSummary = computeClientPointsSummary(
    priorVerified,
    existing,
    priorBookingsForClient
  );
  const bookingPoints = computeBookingLoyaltyPoints(booking).points;
  const nextLoyaltyPoints = currentPointsSummary.pointsBalance + bookingPoints;
  const nextEarnedTotal = currentPointsSummary.pointsEarnedTotal + bookingPoints;

  const unlockedMilestone =
    nextVerifiedVisits > 0 && nextVerifiedVisits % 5 === 0 ? nextVerifiedVisits : null;

  const rewardLabel = unlockedMilestone
    ? `🏆 إنجاز الولاء (${unlockedMilestone} زيارات مؤكدة): ${getMilestoneRewardLabel(unlockedMilestone, booking.clientLanguage || 'ar')}`
    : undefined;

  const noteToClient =
    booking.adminNotes ||
    (unlockedMilestone
      ? `تم تأكيد حضورك مع ${booking.barberName}! تهانينا على بلوغ الزيارة المؤكدة رقم ${nextVerifiedVisits}: ${getMilestoneRewardLabel(unlockedMilestone, booking.clientLanguage || 'ar')} (+${bookingPoints} نقطة ولاء).`
      : `تم تأكيد حضورك بنجاح مع ${booking.barberName} وإضافة +${bookingPoints} نقطة ولاء (الرصيد: ${nextLoyaltyPoints} نقطة).`);

  const updatedBooking = await markBookingAttendanceCompleted(
    booking.id,
    noteToClient,
    rewardLabel || booking.loyaltyRewardApplied
  );

  const nextProfile = buildSanitizedCrmProfile(
    booking.clientPhone,
    booking.clientName,
    {
      verifiedVisits: nextVerifiedVisits,
      loyaltyPoints: nextLoyaltyPoints,
      pointsEarnedTotal: nextEarnedTotal,
      pointsRedeemedTotal: currentPointsSummary.pointsRedeemedTotal,
      rewardNote: rewardLabel || existing?.rewardNote,
    },
    existing
  );
  const savedProfile = await persistCrmProfile(nextProfile);

  const cLang = booking.clientLanguage || 'ar';
  void dispatchClientBackgroundPush({
    clientPhone: booking.clientPhone,
    ticketNumber: booking.ticketNumber,
    eventType: 'booking_attended',
    url: `/#track=${encodeURIComponent(booking.ticketNumber)}`,
    tag: `sb-attended-${booking.id}`,
    title:
      cLang === 'ar'
        ? `Salon Boumlik • تم تأكيد حضورك (+${bookingPoints} نقطة ولاء)`
        : `Salon Boumlik • Présence confirmée (+${bookingPoints} pts)`,
    body:
      cLang === 'ar'
        ? `تم تسجيل حضورك للتذكرة ${booking.ticketNumber} وإضافة +${bookingPoints} نقطة. رصيدك الحالي: ${nextLoyaltyPoints} نقطة.`
        : `Votre visite (${booking.ticketNumber}) est validée ! +${bookingPoints} pts ajoutés (solde : ${nextLoyaltyPoints} pts).`,
  });

  return {
    booking: updatedBooking,
    profile: savedProfile,
    previousVerifiedVisits: priorVerified,
    newVerifiedVisits: nextVerifiedVisits,
    pointsEarned: bookingPoints,
    unlockedMilestone,
    alreadyCompleted: false,
  };
}

/**
 * Redeems Loyalty Points from `crm_clients/{clientId}` into either a free care reward
 * (Free Hair Wash / Free Facial Mask) or a modest instant MAD discount.
 */
export async function redeemLoyaltyPointsForDiscount(params: {
  phone: string;
  clientName: string;
  pointsCost: number;
  discountMAD: number;
  rewardKind?: LoyaltyPointRewardKind;
  label?: string;
  verifiedVisits?: number;
  crmMap?: Record<string, CrmClientProfile>;
}): Promise<CrmClientProfile> {
  const crmMap = params.crmMap ?? cachedCrmMap;
  const id = getCrmDocId(params.phone);
  const existing = findCrmProfileByPhone(params.phone, crmMap);
  const visits = Math.max(params.verifiedVisits ?? 0, existing?.verifiedVisits ?? 0);
  const summary = computeClientPointsSummary(visits, existing);

  if (summary.pointsBalance < params.pointsCost) {
    throw new Error('Insufficient loyalty points balance.');
  }

  const nextBalance = Math.max(0, summary.pointsBalance - params.pointsCost);
  const nextRedeemed = summary.pointsRedeemedTotal + params.pointsCost;
  const appliedDiscount = Math.max(0, Math.round(params.discountMAD));
  const nextDiscount = (existing?.customDiscountMAD ?? 0) + appliedDiscount;

  const fallbackNote =
    appliedDiscount > 0
      ? `🎟️ استبدال ${params.pointsCost} نقطة ولاء ← خصم -${appliedDiscount} MAD`
      : params.rewardKind === 'free_mask'
      ? `🎁 استبدال ${params.pointsCost} نقطة ← ماسك للوجه مجاني`
      : `🎁 استبدال ${params.pointsCost} نقطة ← غسل شعر مجاني`;

  const next = buildSanitizedCrmProfile(
    params.phone,
    params.clientName,
    {
      verifiedVisits: visits,
      loyaltyPoints: nextBalance,
      pointsEarnedTotal: summary.pointsEarnedTotal,
      pointsRedeemedTotal: nextRedeemed,
      customDiscountMAD: nextDiscount,
      rewardNote: params.label || fallbackNote,
    },
    existing
  );
  const saved = await persistCrmProfile(next);

  const pushBody =
    appliedDiscount > 0
      ? `تم استبدال ${params.pointsCost} نقطة ولاء بخصم -${appliedDiscount} MAD جاهز لموعدك القادم. الرصيد المتبقي: ${nextBalance} نقطة.`
      : `تم استبدال ${params.pointsCost} نقطة ولاء بمكافأة ${params.rewardKind === 'free_mask' ? 'ماسك للوجه مجاني' : 'غسل شعر مجاني'} لطلبك القادم. الرصيد المتبقي: ${nextBalance} نقطة.`;

  void dispatchClientBackgroundPush({
    clientPhone: params.phone,
    eventType: 'loyalty_points_updated',
    url: `/#track=${encodeURIComponent(params.phone)}`,
    tag: `sb-points-redeem-${id}-${nextRedeemed}`,
    title: 'Salon Boumlik • تحديث نقاط الولاء',
    body: pushBody,
  });

  return saved;
}

/**
 * Awards or deducts loyalty points for a client from Admin Dashboard.
 */
export async function adjustClientLoyaltyPoints(params: {
  phone: string;
  clientName: string;
  pointsDelta: number;
  verifiedVisits?: number;
  note?: string;
  crmMap?: Record<string, CrmClientProfile>;
}): Promise<CrmClientProfile> {
  const crmMap = params.crmMap ?? cachedCrmMap;
  const id = getCrmDocId(params.phone);
  const existing = findCrmProfileByPhone(params.phone, crmMap);
  const visits = Math.max(params.verifiedVisits ?? 0, existing?.verifiedVisits ?? 0);
  const summary = computeClientPointsSummary(visits, existing);

  const nextBalance = Math.max(0, summary.pointsBalance + Math.round(params.pointsDelta));
  const nextEarned =
    params.pointsDelta > 0
      ? summary.pointsEarnedTotal + Math.round(params.pointsDelta)
      : summary.pointsEarnedTotal;

  const next = buildSanitizedCrmProfile(
    params.phone,
    params.clientName,
    {
      verifiedVisits: visits,
      loyaltyPoints: nextBalance,
      pointsEarnedTotal: nextEarned,
      pointsRedeemedTotal: summary.pointsRedeemedTotal,
      rewardNote:
        params.note ||
        (params.pointsDelta >= 0
          ? `⭐ منح +${Math.round(params.pointsDelta)} نقطة ولاء إضافية من الإدارة`
          : `تعديل رصيد النقاط (${Math.round(params.pointsDelta)} نقطة)`),
    },
    existing
  );
  const saved = await persistCrmProfile(next);

  if (params.pointsDelta !== 0) {
    const sign = params.pointsDelta > 0 ? `+${Math.round(params.pointsDelta)}` : `${Math.round(params.pointsDelta)}`;
    void dispatchClientBackgroundPush({
      clientPhone: params.phone,
      eventType: 'loyalty_points_updated',
      url: `/#track=${encodeURIComponent(params.phone)}`,
      tag: `sb-points-adjust-${id}-${nextBalance}`,
      title: 'Salon Boumlik • تحديث رصيد نقاط الولاء',
      body: `تم تحديث رصيد نقاط الولاء (${sign} نقطة). رصيدك الحالي: ${nextBalance} نقطة.`,
    });
  }

  return saved;
}

/**
 * Consumes applied `customDiscountMAD` after a client submits a booking using their discount voucher.
 */
export async function consumeClientDiscountOnBooking(
  phone: string,
  clientName: string,
  usedDiscountMAD: number,
  crmMap: Record<string, CrmClientProfile> = cachedCrmMap
): Promise<CrmClientProfile | null> {
  if (usedDiscountMAD <= 0) return null;
  const existing = findCrmProfileByPhone(phone, crmMap);
  if (!existing || (existing.customDiscountMAD ?? 0) <= 0) return null;

  const remainingDiscount = Math.max(0, (existing.customDiscountMAD ?? 0) - usedDiscountMAD);
  const next = buildSanitizedCrmProfile(
    phone,
    clientName,
    {
      customDiscountMAD: remainingDiscount,
      rewardNote:
        remainingDiscount === 0
          ? '✓ تم استخدام خصم نقاط الولاء في الحجز الأخير'
          : `🎁 رصيد خصم متبقي: -${remainingDiscount} MAD`,
    },
    existing
  );
  return persistCrmProfile(next);
}

/**
 * Selectively deletes chosen booking records and/or CRM profile documents for a client.
 * Never deletes Caisse entries or open/manual credit records.
 */
export async function deleteSelectedClientRecords(params: {
  bookingIds?: string[];
  crmDocIds?: string[];
}): Promise<{ deletedBookings: number; deletedProfiles: number }> {
  const uniqueBookingIds = Array.from(new Set((params.bookingIds || []).filter(Boolean)));
  const uniqueCrmDocIds = Array.from(new Set((params.crmDocIds || []).filter(Boolean)));

  let deletedBookings = 0;
  for (const bId of uniqueBookingIds) {
    await deleteBooking(bId);
    deletedBookings += 1;
  }

  let deletedProfiles = 0;
  for (const docId of uniqueCrmDocIds) {
    const path = `${CRM_COLLECTION}/${docId}`;
    try {
      await deleteDoc(doc(db, CRM_COLLECTION, docId));
      deletedProfiles += 1;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  if (deletedProfiles > 0) {
    const nextCache = { ...cachedCrmMap };
    uniqueCrmDocIds.forEach((docId) => {
      delete nextCache[docId];
    });
    commitCrmCache(nextCache, true);
  }

  return { deletedBookings, deletedProfiles };
}
