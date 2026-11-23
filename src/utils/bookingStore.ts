import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { AppointmentBooking, BookingStatus } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  dispatchClientBackgroundPush,
  dispatchStaffBackgroundPush,
} from './webPushClient';
import { generateCheckInToken } from './clientQr';

const BOOKINGS_COLLECTION = 'bookings';

// Live in-memory cache kept in sync by Firestore onSnapshot
let memoryCache: AppointmentBooking[] = [];
let hasHydratedFromFirestore = false;

type BookingsListener = {
  onData: (bookings: AppointmentBooking[]) => void;
  onError?: (error: unknown) => void;
};

const listeners = new Set<BookingsListener>();
let activeUnsubscribe: (() => void) | null = null;

/**
 * Recursively strips `undefined` values so Firestore rejects zero writes due to undefined properties.
 */
function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        result[k] = stripUndefinedDeep(v);
      }
    }
    return result as T;
  }
  return value;
}

function buildSanitizedBooking(booking: AppointmentBooking): Record<string, unknown> {
  const cleanId = booking.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const sanitized: Record<string, unknown> = {
    id: cleanId,
    ticketNumber: String(booking.ticketNumber || '#SB-1000').slice(0, 32),
    barberId: String(booking.barberId || 'hassan').slice(0, 64),
    barberName: String(booking.barberName || 'Hassan ait boumlik').slice(0, 100),
    date: String(booking.date || new Date().toISOString().split('T')[0]).slice(0, 20),
    timeSlot: String(booking.timeSlot || '16:00').slice(0, 16),
    clientName: String(booking.clientName || 'Client').slice(0, 120),
    clientPhone: String(booking.clientPhone || '0000000000').slice(0, 40),
    status: booking.status || 'pending',
    createdAt: String(booking.createdAt || new Date().toISOString()).slice(0, 64),
    services: Array.isArray(booking.services) ? stripUndefinedDeep(booking.services.slice(0, 20)) : [],
  };

  if (booking.barberColor) sanitized.barberColor = String(booking.barberColor).slice(0, 20);
  if (booking.clientEmail && booking.clientEmail.trim()) {
    sanitized.clientEmail = booking.clientEmail.trim().slice(0, 120);
  }
  if (booking.clientNotes && booking.clientNotes.trim()) {
    sanitized.clientNotes = booking.clientNotes.trim().slice(0, 400);
  }
  if (booking.notes && booking.notes.trim()) {
    sanitized.notes = booking.notes.trim().slice(0, 500);
  }
  if (Array.isArray(booking.cartItemsSummary)) {
    sanitized.cartItemsSummary = stripUndefinedDeep(booking.cartItemsSummary.slice(0, 20));
  }
  if (typeof booking.originalTotalMAD === 'number' && Number.isFinite(booking.originalTotalMAD)) {
    sanitized.originalTotalMAD = Math.max(0, Math.min(50000, booking.originalTotalMAD));
  }
  if (typeof booking.finalTotalMAD === 'number' && Number.isFinite(booking.finalTotalMAD)) {
    sanitized.finalTotalMAD = Math.max(0, Math.min(50000, booking.finalTotalMAD));
  }
  if (typeof booking.totalSavingsMAD === 'number' && Number.isFinite(booking.totalSavingsMAD)) {
    sanitized.totalSavingsMAD = Math.max(0, Math.min(50000, booking.totalSavingsMAD));
  }
  if (booking.bookingMethod === 'site' || booking.bookingMethod === 'whatsapp') {
    sanitized.bookingMethod = booking.bookingMethod;
  }
  if (
    booking.drinkPreference === 'coffee' ||
    booking.drinkPreference === 'tea' ||
    booking.drinkPreference === 'none'
  ) {
    sanitized.drinkPreference = booking.drinkPreference;
  }
  if (typeof booking.totalDurationMinutes === 'number' && Number.isFinite(booking.totalDurationMinutes)) {
    sanitized.totalDurationMinutes = Math.max(0, Math.min(1000, booking.totalDurationMinutes));
  }
  if (typeof booking.isFlexibleTime === 'boolean') {
    sanitized.isFlexibleTime = booking.isFlexibleTime;
  }
  if (booking.preferredTimeHint && booking.preferredTimeHint.trim()) {
    sanitized.preferredTimeHint = booking.preferredTimeHint.trim().slice(0, 32);
  }
  if (booking.rescheduledTo && booking.rescheduledTo.date && booking.rescheduledTo.time) {
    sanitized.rescheduledTo = {
      date: String(booking.rescheduledTo.date).slice(0, 20),
      time: String(booking.rescheduledTo.time).slice(0, 16),
    };
  }
  if (
    booking.clientLanguage &&
    ['fr', 'ar', 'en', 'amz', 'es'].includes(booking.clientLanguage)
  ) {
    sanitized.clientLanguage = booking.clientLanguage;
  }
  if (booking.adminNotes !== undefined && booking.adminNotes !== '') {
    sanitized.adminNotes = String(booking.adminNotes).slice(0, 500);
  }
  if (booking.cihReceiptName && booking.cihReceiptName.trim()) {
    sanitized.cihReceiptName = booking.cihReceiptName.trim().slice(0, 160);
  }
  if (booking.cihReceiptPreview && booking.cihReceiptPreview.trim()) {
    sanitized.cihReceiptPreview = booking.cihReceiptPreview.slice(0, 200000);
  }
  if (booking.cihReceiptUploadedAt && booking.cihReceiptUploadedAt.trim()) {
    sanitized.cihReceiptUploadedAt = booking.cihReceiptUploadedAt.trim().slice(0, 64);
  }
  if (booking.loyaltyRewardApplied && booking.loyaltyRewardApplied.trim()) {
    sanitized.loyaltyRewardApplied = booking.loyaltyRewardApplied.trim().slice(0, 200);
  }
  if (booking.attendanceConfirmedAt && booking.attendanceConfirmedAt.trim()) {
    sanitized.attendanceConfirmedAt = booking.attendanceConfirmedAt.trim().slice(0, 64);
  }
  if (booking.checkInToken && booking.checkInToken.trim()) {
    sanitized.checkInToken = booking.checkInToken.trim().slice(0, 32);
  }
  if (booking.checkedInAt && booking.checkedInAt.trim()) {
    sanitized.checkedInAt = booking.checkedInAt.trim().slice(0, 64);
  }
  if (booking.caisseLoggedAt && booking.caisseLoggedAt.trim()) {
    sanitized.caisseLoggedAt = booking.caisseLoggedAt.trim().slice(0, 64);
  }
  if (booking.caisseEntryId && booking.caisseEntryId.trim()) {
    sanitized.caisseEntryId = booking.caisseEntryId.trim().slice(0, 128);
  }
  if (booking.deviceFingerprint && booking.deviceFingerprint.trim()) {
    sanitized.deviceFingerprint = booking.deviceFingerprint.trim().slice(0, 128);
  }
  if (booking.clientIpHash && booking.clientIpHash.trim()) {
    sanitized.clientIpHash = booking.clientIpHash.trim().slice(0, 128);
  }
  if (typeof booking.isAdminWalkIn === 'boolean') {
    sanitized.isAdminWalkIn = booking.isAdminWalkIn;
  }

  return sanitized;
}

function ensureFirestoreListener() {
  if (activeUnsubscribe) return;

  const q = query(collection(db, BOOKINGS_COLLECTION), orderBy('createdAt', 'desc'));
  activeUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const nextBookings: AppointmentBooking[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as AppointmentBooking;
        return {
          ...data,
          id: data.id || docSnap.id,
        };
      });

      memoryCache = nextBookings;
      hasHydratedFromFirestore = true;

      listeners.forEach((listener) => {
        try {
          listener.onData(nextBookings);
        } catch (err) {
          console.error('Error in booking listener callback:', err);
        }
      });
    },
    (error) => {
      listeners.forEach((listener) => {
        if (listener.onError) {
          listener.onError(error);
        }
      });
      handleFirestoreError(error, OperationType.LIST, BOOKINGS_COLLECTION);
    }
  );
}

/**
 * Subscribe to real-time Firestore `bookings` updates across all devices.
 */
export function subscribeToBookings(
  onData: (bookings: AppointmentBooking[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const listener: BookingsListener = { onData, onError };
  listeners.add(listener);

  ensureFirestoreListener();

  if (hasHydratedFromFirestore) {
    onData(memoryCache);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
      hasHydratedFromFirestore = false;
    }
  };
}

/**
 * Returns the latest Firestore-synchronized bookings cached in memory.
 */
export function getAllBookings(): AppointmentBooking[] {
  return memoryCache;
}

/**
 * Explicitly fetches all bookings from Firestore once (helpful before a stream hydrates).
 */
export async function fetchAllBookingsOnce(): Promise<AppointmentBooking[]> {
  try {
    const q = query(collection(db, BOOKINGS_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({
      ...(d.data() as AppointmentBooking),
      id: d.id,
    }));
    memoryCache = items;
    hasHydratedFromFirestore = true;
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, BOOKINGS_COLLECTION);
  }
}

/**
 * Normalizes ticket numbers (e.g., "#SB-7328", "SB-7328", "7328", "sb-7328")
 */
function cleanTicketString(ticket: string): string {
  return ticket.trim().replace(/^#+/, '').replace(/^SB-?/i, '').trim().toUpperCase();
}

/**
 * Normalizes Moroccan phone numbers across "+212...", "212...", "06...", and spaced formats.
 */
export function normalizeMoroccanPhoneDigits(rawPhone: string): string {
  let digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00212') && digits.length >= 13) {
    digits = digits.slice(5);
  } else if (digits.startsWith('212') && digits.length >= 11) {
    digits = digits.slice(3);
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = digits.slice(1);
  }
  return digits;
}

export function getBookingByTicket(
  ticket: string,
  sourceBookings: AppointmentBooking[] = memoryCache
): AppointmentBooking | undefined {
  if (!ticket) return undefined;
  const rawClean = ticket.trim().toUpperCase();
  const digitsOrCode = cleanTicketString(ticket);

  return sourceBookings.find((b) => {
    const bRaw = b.ticketNumber.toUpperCase();
    const bClean = cleanTicketString(b.ticketNumber);

    if (bRaw === rawClean || bRaw === `#${rawClean}` || bRaw.replace('#', '') === rawClean) {
      return true;
    }
    if (digitsOrCode && bClean === digitsOrCode) {
      return true;
    }
    if (digitsOrCode.length >= 3 && digitsOrCode.length <= 6 && (bRaw.includes(digitsOrCode) || b.id.includes(digitsOrCode))) {
      return true;
    }
    return false;
  });
}

export function getBookingsByPhone(
  rawPhone: string,
  sourceBookings: AppointmentBooking[] = memoryCache
): AppointmentBooking[] {
  const rawDigits = rawPhone.replace(/\D/g, '');
  const canonicalDigits = normalizeMoroccanPhoneDigits(rawPhone);
  if (rawDigits.length < 4 && canonicalDigits.length < 4) return [];

  return sourceBookings.filter((b) => {
    const bRawDigits = b.clientPhone.replace(/\D/g, '');
    const bCanonical = normalizeMoroccanPhoneDigits(b.clientPhone);
    return (
      (rawDigits.length >= 4 && (bRawDigits.includes(rawDigits) || rawDigits.includes(bRawDigits))) ||
      (canonicalDigits.length >= 4 && (bCanonical.includes(canonicalDigits) || canonicalDigits.includes(bCanonical)))
    );
  });
}

export function matchesUniversalBookingQuery(
  booking: AppointmentBooking,
  rawQuery: string
): boolean {
  const q = rawQuery.trim();
  if (!q) return true;

  const qLower = q.toLowerCase();
  const qUpper = q.toUpperCase();
  const cleanQTicket = cleanTicketString(q);
  const bTicketUpper = booking.ticketNumber.toUpperCase();
  const bTicketClean = cleanTicketString(booking.ticketNumber);

  // 1. Ticket ID matching (#SB-1234, SB-1234, 1234)
  if (
    bTicketUpper === qUpper ||
    bTicketUpper.replace('#', '') === qUpper.replace('#', '') ||
    bTicketUpper.includes(qUpper) ||
    (cleanQTicket.length >= 2 && bTicketClean.includes(cleanQTicket))
  ) {
    return true;
  }

  // 2. Normalized Moroccan phone matching (06..., +212..., c_<digits>, spaces ignored)
  const phoneLookupQuery = qLower.startsWith('c_') ? q.slice(2) : q;
  const rawDigits = phoneLookupQuery.replace(/\D/g, '');
  const canonicalDigits = normalizeMoroccanPhoneDigits(phoneLookupQuery);
  if (rawDigits.length >= 3) {
    const bRawDigits = booking.clientPhone.replace(/\D/g, '');
    const bCanonical = normalizeMoroccanPhoneDigits(booking.clientPhone);
    if (
      bRawDigits.includes(rawDigits) ||
      (rawDigits.length >= 9 && rawDigits.includes(bRawDigits)) ||
      (canonicalDigits.length >= 3 && bCanonical.includes(canonicalDigits))
    ) {
      return true;
    }
  }

  // 3. Name / Barber / Email text matching
  return (
    booking.clientName.toLowerCase().includes(qLower) ||
    booking.barberName.toLowerCase().includes(qLower) ||
    (booking.clientEmail ? booking.clientEmail.toLowerCase().includes(qLower) : false)
  );
}

export function findBookingsUniversal(
  rawQuery: string,
  sourceBookings: AppointmentBooking[] = memoryCache
): AppointmentBooking[] {
  const q = rawQuery.trim();
  if (!q) return sourceBookings;

  const byExactTicket = getBookingByTicket(q, sourceBookings);
  const byPhone = getBookingsByPhone(q, sourceBookings);
  const loose = sourceBookings.filter((b) => matchesUniversalBookingQuery(b, q));

  const seen = new Set<string>();
  const ordered: AppointmentBooking[] = [];

  if (byExactTicket) {
    seen.add(byExactTicket.id);
    ordered.push(byExactTicket);
  }
  [...byPhone, ...loose].forEach((b) => {
    if (!seen.has(b.id)) {
      seen.add(b.id);
      ordered.push(b);
    }
  });

  return ordered;
}

/**
 * Writes a new booking directly to Cloud Firestore (`bookings/{id}`).
 */
export async function createNewBooking(
  bookingData: Omit<AppointmentBooking, 'id' | 'ticketNumber' | 'createdAt' | 'status'> & {
    id?: string;
    ticketNumber?: string;
    status?: BookingStatus;
  }
): Promise<AppointmentBooking> {
  const nextNum = Math.floor(1000 + Math.random() * 9000);
  const ticketNumber = bookingData.ticketNumber || `#SB-${nextNum}`;
  const id =
    bookingData.id || `booking-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const newBooking: AppointmentBooking = {
    ...bookingData,
    id,
    ticketNumber,
    checkInToken: bookingData.checkInToken || generateCheckInToken(bookingData.clientPhone),
    status: bookingData.status || 'pending',
    createdAt: new Date().toISOString(),
  };

  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    const payload = buildSanitizedBooking(newBooking);
    await setDoc(doc(db, BOOKINGS_COLLECTION, id), payload);
    memoryCache = [newBooking, ...memoryCache.filter((b) => b.id !== id)];

    // Dispatch background VAPID Web Push to Master Admin + assigned barber
    const slotText =
      newBooking.status === 'flexible_pending' || newBooking.isFlexibleTime
        ? `توقيت مرن (بانتظار اختيارك لأقرب وقت${newBooking.preferredTimeHint ? ` حول ${newBooking.preferredTimeHint}` : ''})`
        : `${newBooking.date} الساعة ${newBooking.timeSlot}`;
    void dispatchStaffBackgroundPush({
      barberId: newBooking.barberId,
      eventType: 'new_booking',
      ticketNumber: newBooking.ticketNumber,
      url: '/#admin',
      tag: `sb-new-booking-${newBooking.id}`,
      title:
        newBooking.status === 'flexible_pending'
          ? `Salon Boumlik • طلب وقت مرن (${newBooking.ticketNumber})`
          : `Salon Boumlik • حجز جديد (${newBooking.ticketNumber})`,
      body: newBooking.cihReceiptName
        ? `الزبون ${newBooking.clientName} حجز مع ${newBooking.barberName} (${slotText}) مع إيصال CIH.`
        : `الزبون ${newBooking.clientName} حجز مع ${newBooking.barberName} (${slotText}).`,
    });

    return newBooking;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Updates booking status (and optional adminNotes / rescheduledTo) directly in Cloud Firestore.
 */
export async function updateBookingStatus(
  id: string,
  newStatus: BookingStatus,
  adminNotes?: string,
  rescheduledTo?: { date: string; time: string }
): Promise<AppointmentBooking | null> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
    };
    if (adminNotes !== undefined) {
      updatePayload.adminNotes = String(adminNotes).slice(0, 500);
    }
    if (rescheduledTo !== undefined) {
      updatePayload.rescheduledTo = {
        date: String(rescheduledTo.date).slice(0, 20),
        time: String(rescheduledTo.time).slice(0, 16),
      };
    }

    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), updatePayload);

    let targetBooking = memoryCache.find((b) => b.id === id);
    if (!targetBooking) {
      const snap = await getDoc(doc(db, BOOKINGS_COLLECTION, id));
      if (snap.exists()) {
        targetBooking = snap.data() as AppointmentBooking;
      }
    }

    if (!targetBooking) return null;
    const updatedBooking: AppointmentBooking = {
      ...targetBooking,
      status: newStatus,
      adminNotes: adminNotes !== undefined ? adminNotes : targetBooking.adminNotes,
      rescheduledTo: rescheduledTo !== undefined ? rescheduledTo : targetBooking.rescheduledTo,
    };
    memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));

    // Dispatch background Web Push to client devices when status or time updates
    const cLang = updatedBooking.clientLanguage || 'ar';
    if (newStatus === 'confirmed') {
      void dispatchClientBackgroundPush({
        clientPhone: updatedBooking.clientPhone,
        ticketNumber: updatedBooking.ticketNumber,
        eventType: 'booking_confirmed',
        url: `/#track=${encodeURIComponent(updatedBooking.ticketNumber)}`,
        tag: `sb-booking-${updatedBooking.id}-confirmed`,
        title:
          cLang === 'ar'
            ? `Salon Boumlik • تم تأكيد موعدك (${updatedBooking.ticketNumber})`
            : `Salon Boumlik • Rendez-vous confirmé (${updatedBooking.ticketNumber})`,
        body:
          cLang === 'ar'
            ? `تم تأكيد حجزك مع ${updatedBooking.barberName} بتاريخ ${updatedBooking.date} الساعة ${updatedBooking.timeSlot}.`
            : `Votre rendez-vous avec ${updatedBooking.barberName} est confirmé le ${updatedBooking.date} à ${updatedBooking.timeSlot}.`,
      });
    } else if (newStatus === 'rescheduled' && updatedBooking.rescheduledTo) {
      void dispatchClientBackgroundPush({
        clientPhone: updatedBooking.clientPhone,
        ticketNumber: updatedBooking.ticketNumber,
        eventType: 'booking_rescheduled',
        url: `/#track=${encodeURIComponent(updatedBooking.ticketNumber)}`,
        tag: `sb-booking-${updatedBooking.id}-rescheduled-${updatedBooking.rescheduledTo.time}`,
        title:
          cLang === 'ar'
            ? `Salon Boumlik • تحديث موعدك (${updatedBooking.ticketNumber})`
            : `Salon Boumlik • Nouvel horaire proposé (${updatedBooking.ticketNumber})`,
        body:
          cLang === 'ar'
            ? `تم تحديث الموعد مع ${updatedBooking.barberName} إلى ${updatedBooking.rescheduledTo.date} الساعة ${updatedBooking.rescheduledTo.time}.`
            : `Nouvel horaire avec ${updatedBooking.barberName} : ${updatedBooking.rescheduledTo.date} à ${updatedBooking.rescheduledTo.time}.`,
      });
    } else if (newStatus === 'rejected' || newStatus === 'cancelled') {
      void dispatchClientBackgroundPush({
        clientPhone: updatedBooking.clientPhone,
        ticketNumber: updatedBooking.ticketNumber,
        eventType: 'booking_updated',
        url: `/#track=${encodeURIComponent(updatedBooking.ticketNumber)}`,
        tag: `sb-booking-${updatedBooking.id}-${newStatus}`,
        title: `Salon Boumlik • ${updatedBooking.ticketNumber}`,
        body:
          adminNotes?.trim() ||
          (cLang === 'ar'
            ? 'تم تحديث حالة تذكرتك. اضغط لمراجعة التفاصيل.'
            : 'Le statut de votre réservation a été mis à jour.'),
      });
    }

    return updatedBooking;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Allows the assigned barber or Master Admin to assign the closest optimal date & time slot
 * to a flexible booking (`flexible_pending`), confirm it, and automatically notify the client.
 */
export async function assignFlexibleBookingSlot(
  id: string,
  assignedDate: string,
  assignedTime: string,
  adminNotes?: string
): Promise<AppointmentBooking | null> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    const cleanDate = String(assignedDate || '').trim().slice(0, 20);
    const cleanTime = String(assignedTime || '').trim().slice(0, 16);
    const noteText = String(
      adminNotes ||
        `تم اختيار أفضل وقت متاح لك (${cleanDate} • ${cleanTime}) وتأكيد موعدك بنجاح.`
    ).slice(0, 500);

    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), {
      date: cleanDate,
      timeSlot: cleanTime,
      status: 'confirmed' as BookingStatus,
      adminNotes: noteText,
      rescheduledTo: deleteField(),
    });

    let targetBooking = memoryCache.find((b) => b.id === id);
    if (!targetBooking) {
      const snap = await getDoc(doc(db, BOOKINGS_COLLECTION, id));
      if (snap.exists()) {
        targetBooking = snap.data() as AppointmentBooking;
      }
    }
    if (!targetBooking) return null;

    const updatedBooking: AppointmentBooking = {
      ...targetBooking,
      date: cleanDate,
      timeSlot: cleanTime,
      status: 'confirmed',
      adminNotes: noteText,
      rescheduledTo: undefined,
    };
    memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));

    const cLang = updatedBooking.clientLanguage || 'ar';
    void dispatchClientBackgroundPush({
      clientPhone: updatedBooking.clientPhone,
      ticketNumber: updatedBooking.ticketNumber,
      eventType: 'booking_confirmed',
      url: `/#track=${encodeURIComponent(updatedBooking.ticketNumber)}`,
      tag: `sb-booking-${updatedBooking.id}-assigned-${cleanTime}`,
      title:
        cLang === 'ar'
          ? `Salon Boumlik • تم تحديد وتأكيد موعدك (${updatedBooking.ticketNumber})`
          : `Salon Boumlik • Créneau assigné et confirmé (${updatedBooking.ticketNumber})`,
      body:
        cLang === 'ar'
          ? `اختار لك الحلاق ${updatedBooking.barberName} أفضل وقت متاح: ${cleanDate} الساعة ${cleanTime}. مرحباً بك!`
          : `${updatedBooking.barberName} a sélectionné votre créneau optimal : ${cleanDate} à ${cleanTime}.`,
    });

    return updatedBooking;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Moves a late-arriving client's booking directly to the nearest open slot for that barber,
 * immediately freeing up their missed original slot and confirming the new seat.
 */
export async function rescheduleBookingToNearestSlot(
  id: string,
  targetDate: string,
  targetTime: string,
  adminNotes?: string
): Promise<AppointmentBooking | null> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    const cleanDate = String(targetDate || '').trim().slice(0, 20);
    const cleanTime = String(targetTime || '').trim().slice(0, 16);
    const noteText = String(
      adminNotes ||
        `بسبب التأخر عن الموعد السابق، تم تأجيل الحجز إلى أقرب وقت متاح (${cleanDate} • ${cleanTime}).`
    ).slice(0, 500);

    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), {
      date: cleanDate,
      timeSlot: cleanTime,
      status: 'confirmed' as BookingStatus,
      adminNotes: noteText,
      rescheduledTo: deleteField(),
    });

    let targetBooking = memoryCache.find((b) => b.id === id);
    if (!targetBooking) {
      const snap = await getDoc(doc(db, BOOKINGS_COLLECTION, id));
      if (snap.exists()) {
        targetBooking = snap.data() as AppointmentBooking;
      }
    }
    if (!targetBooking) return null;

    const updatedBooking: AppointmentBooking = {
      ...targetBooking,
      date: cleanDate,
      timeSlot: cleanTime,
      status: 'confirmed',
      adminNotes: noteText,
      rescheduledTo: undefined,
    };
    memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));

    const cLang = updatedBooking.clientLanguage || 'ar';
    void dispatchClientBackgroundPush({
      clientPhone: updatedBooking.clientPhone,
      ticketNumber: updatedBooking.ticketNumber,
      eventType: 'booking_rescheduled',
      url: `/#track=${encodeURIComponent(updatedBooking.ticketNumber)}`,
      tag: `sb-booking-${updatedBooking.id}-nearest-${cleanTime}`,
      title:
        cLang === 'ar'
          ? `Salon Boumlik • تأجيل لأقرب وقت متاح (${updatedBooking.ticketNumber})`
          : `Salon Boumlik • Créneau déplacé (${updatedBooking.ticketNumber})`,
      body:
        cLang === 'ar'
          ? `تم نقل موعدك مع ${updatedBooking.barberName} إلى ${cleanDate} الساعة ${cleanTime}.`
          : `Votre RDV avec ${updatedBooking.barberName} a été déplacé au ${cleanDate} à ${cleanTime}.`,
    });

    return updatedBooking;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Marks a booking as attended/completed with timestamp and optional reward tag in Cloud Firestore.
 */
export async function markBookingAttendanceCompleted(
  id: string,
  adminNotes?: string,
  loyaltyRewardApplied?: string
): Promise<AppointmentBooking | null> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    const confirmedAt = new Date().toISOString().slice(0, 64);
    const updatePayload: Record<string, unknown> = {
      status: 'completed' as BookingStatus,
      attendanceConfirmedAt: confirmedAt,
    };
    if (adminNotes !== undefined) {
      updatePayload.adminNotes = String(adminNotes).slice(0, 500);
    }
    if (loyaltyRewardApplied !== undefined && loyaltyRewardApplied.trim()) {
      updatePayload.loyaltyRewardApplied = loyaltyRewardApplied.trim().slice(0, 200);
    }

    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), updatePayload);

    const existing = memoryCache.find((b) => b.id === id);
    if (!existing) return null;
    const updatedBooking: AppointmentBooking = {
      ...existing,
      status: 'completed',
      attendanceConfirmedAt: confirmedAt,
      adminNotes: adminNotes !== undefined ? adminNotes : existing.adminNotes,
      loyaltyRewardApplied:
        loyaltyRewardApplied !== undefined && loyaltyRewardApplied.trim()
          ? loyaltyRewardApplied.trim().slice(0, 200)
          : existing.loyaltyRewardApplied,
    };
    memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));
    return updatedBooking;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Handles Client Acceptance or Rejection of a Proposed Rescheduled Time in Cloud Firestore.
 */
export async function clientRescheduleResponse(
  id: string,
  accepted: boolean
): Promise<AppointmentBooking | null> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    let existing = memoryCache.find((b) => b.id === id);
    if (!existing) {
      const snap = await getDoc(doc(db, BOOKINGS_COLLECTION, id));
      if (!snap.exists()) return null;
      existing = snap.data() as AppointmentBooking;
    }

    if (accepted && existing.rescheduledTo) {
      const nextNotes = (
        (existing.adminNotes ? `${existing.adminNotes} | ` : '') +
        'تم قبول التوقيت الجديد من الزبون بنجاح.'
      ).slice(0, 500);

      await updateDoc(doc(db, BOOKINGS_COLLECTION, id), {
        date: existing.rescheduledTo.date,
        timeSlot: existing.rescheduledTo.time,
        status: 'confirmed',
        rescheduledTo: deleteField(),
        adminNotes: nextNotes,
      });

      const updatedBooking: AppointmentBooking = {
        ...existing,
        date: existing.rescheduledTo.date,
        timeSlot: existing.rescheduledTo.time,
        status: 'confirmed',
        rescheduledTo: undefined,
        adminNotes: nextNotes,
      };
      memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));
      return updatedBooking;
    } else {
      const nextNotes = (
        (existing.adminNotes ? `${existing.adminNotes} | ` : '') +
        'تم رفض التوقيت المقترح وإلغاء الموعد من الزبون.'
      ).slice(0, 500);

      await updateDoc(doc(db, BOOKINGS_COLLECTION, id), {
        status: 'cancelled',
        adminNotes: nextNotes,
      });

      const updatedBooking: AppointmentBooking = {
        ...existing,
        status: 'cancelled',
        adminNotes: nextNotes,
      };
      memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));
      return updatedBooking;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Cancels a booking directly from the client tracking page in Cloud Firestore.
 */
export async function cancelClientBooking(
  id: string,
  reason?: string
): Promise<AppointmentBooking | null> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    let existing = memoryCache.find((b) => b.id === id);
    if (!existing) {
      const snap = await getDoc(doc(db, BOOKINGS_COLLECTION, id));
      if (!snap.exists()) return null;
      existing = snap.data() as AppointmentBooking;
    }

    const nextNotes = (
      (existing.adminNotes ? `${existing.adminNotes} | ` : '') +
      (reason || 'ألغى الزبون الموعد عبر تذكرته الإلكترونية.')
    ).slice(0, 500);

    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), {
      status: 'cancelled',
      adminNotes: nextNotes,
    });

    const updatedBooking: AppointmentBooking = {
      ...existing,
      status: 'cancelled',
      adminNotes: nextNotes,
    };
    memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));
    return updatedBooking;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Updates the admin response note for a booking directly in Cloud Firestore.
 */
export async function updateBookingAdminNote(
  id: string,
  note: string
): Promise<AppointmentBooking | null> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    const cleanNote = String(note || '').slice(0, 500);
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), {
      adminNotes: cleanNote,
    });

    const existing = memoryCache.find((b) => b.id === id);
    if (!existing) return null;
    const updatedBooking: AppointmentBooking = { ...existing, adminNotes: cleanNote };
    memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));
    return updatedBooking;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Attaches or updates a client's CIH transfer receipt on an existing booking in Cloud Firestore.
 */
export async function updateBookingCihReceipt(
  id: string,
  receipt: {
    cihReceiptName: string;
    cihReceiptPreview?: string;
    cihReceiptUploadedAt: string;
  }
): Promise<AppointmentBooking | null> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    const cleanName = String(receipt.cihReceiptName || '').trim().slice(0, 160);
    const cleanUploadedAt = String(receipt.cihReceiptUploadedAt || new Date().toISOString())
      .trim()
      .slice(0, 64);
    const cleanPreview =
      receipt.cihReceiptPreview && receipt.cihReceiptPreview.trim()
        ? receipt.cihReceiptPreview.slice(0, 200000)
        : '';

    const updatePayload: Record<string, unknown> = {
      cihReceiptName: cleanName,
      cihReceiptUploadedAt: cleanUploadedAt,
      cihReceiptPreview: cleanPreview ? cleanPreview : deleteField(),
    };

    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), updatePayload);

    let targetBooking = memoryCache.find((b) => b.id === id);
    if (!targetBooking) {
      const snap = await getDoc(doc(db, BOOKINGS_COLLECTION, id));
      if (snap.exists()) {
        targetBooking = snap.data() as AppointmentBooking;
      }
    }

    if (targetBooking) {
      void dispatchStaffBackgroundPush({
        barberId: targetBooking.barberId,
        eventType: 'cih_receipt_uploaded',
        ticketNumber: targetBooking.ticketNumber,
        url: '/#admin',
        tag: `sb-cih-receipt-${targetBooking.id}`,
        title: `Salon Boumlik • إيصال تحويل CIH (${targetBooking.ticketNumber})`,
        body: `قام الزبون ${targetBooking.clientName} بإرفاق إيصال التحويل البنكي CIH لموعد ${targetBooking.date} (${targetBooking.timeSlot}).`,
      });
    }

    if (!targetBooking) return null;
    const updatedBooking: AppointmentBooking = {
      ...targetBooking,
      cihReceiptName: cleanName,
      cihReceiptPreview: cleanPreview || undefined,
      cihReceiptUploadedAt: cleanUploadedAt,
    };
    memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));
    return updatedBooking;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Records client arrival check-in via unique QR scan (`checkedInAt`) in Cloud Firestore.
 */
export async function checkInBookingByQr(
  id: string
): Promise<AppointmentBooking | null> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    const nowIso = new Date().toISOString().slice(0, 64);
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), {
      checkedInAt: nowIso,
    });

    let existing = memoryCache.find((b) => b.id === id);
    if (!existing) {
      const snap = await getDoc(doc(db, BOOKINGS_COLLECTION, id));
      if (snap.exists()) {
        existing = snap.data() as AppointmentBooking;
      }
    }
    if (!existing) return null;

    const updatedBooking: AppointmentBooking = {
      ...existing,
      checkedInAt: nowIso,
    };
    memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));
    return updatedBooking;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Marks a completed appointment booking as logged into Caisse (`caisseLoggedAt` + `caisseEntryId`).
 */
export async function markBookingCaisseLogged(
  id: string,
  caisseEntryId: string
): Promise<AppointmentBooking | null> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    const nowIso = new Date().toISOString().slice(0, 64);
    const cleanEntryId = String(caisseEntryId || '').trim().slice(0, 128);
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), {
      caisseLoggedAt: nowIso,
      caisseEntryId: cleanEntryId,
    });

    let existing = memoryCache.find((b) => b.id === id);
    if (!existing) {
      const snap = await getDoc(doc(db, BOOKINGS_COLLECTION, id));
      if (snap.exists()) {
        existing = snap.data() as AppointmentBooking;
      }
    }
    if (!existing) return null;

    const updatedBooking: AppointmentBooking = {
      ...existing,
      caisseLoggedAt: nowIso,
      caisseEntryId: cleanEntryId,
    };
    memoryCache = memoryCache.map((b) => (b.id === id ? updatedBooking : b));
    return updatedBooking;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Deletes a booking document from Cloud Firestore.
 */
export async function deleteBooking(id: string): Promise<boolean> {
  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, BOOKINGS_COLLECTION, id));
    memoryCache = memoryCache.filter((b) => b.id !== id);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
