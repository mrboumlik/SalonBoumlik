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
    if (digitsOrCode.length >= 3 && (bRaw.includes(digitsOrCode) || b.id.includes(digitsOrCode))) {
      return true;
    }
    return false;
  });
}

export function getBookingsByPhone(
  rawPhone: string,
  sourceBookings: AppointmentBooking[] = memoryCache
): AppointmentBooking[] {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return [];
  return sourceBookings.filter((b) => {
    const bDigits = b.clientPhone.replace(/\D/g, '');
    return bDigits.includes(digits) || digits.includes(bDigits);
  });
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
    status: bookingData.status || 'pending',
    createdAt: new Date().toISOString(),
  };

  const path = `${BOOKINGS_COLLECTION}/${id}`;
  try {
    const payload = buildSanitizedBooking(newBooking);
    await setDoc(doc(db, BOOKINGS_COLLECTION, id), payload);
    memoryCache = [newBooking, ...memoryCache.filter((b) => b.id !== id)];
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

    const existing = memoryCache.find((b) => b.id === id);
    if (!existing) return null;
    const updatedBooking: AppointmentBooking = {
      ...existing,
      status: newStatus,
      adminNotes: adminNotes !== undefined ? adminNotes : existing.adminNotes,
      rescheduledTo: rescheduledTo !== undefined ? rescheduledTo : existing.rescheduledTo,
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
