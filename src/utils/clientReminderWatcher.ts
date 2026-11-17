import { useEffect, useRef } from 'react';
import { AppointmentBooking, Language } from '../types';
import { normalizeMoroccanPhoneDigits, subscribeToBookings } from './bookingStore';
import { sendDualAlert } from './notifications';

const TRACKED_TICKETS_KEY = 'salon_boumlik_tracked_tickets_v1';
const TRACKED_PHONES_KEY = 'salon_boumlik_tracked_phones_v1';
const NOTIFIED_EVENTS_KEY = 'salon_boumlik_notified_events_v1';

function readStringArray(key: string): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeStringArray(key: string, items: string[], maxItems = 40): void {
  try {
    if (typeof window === 'undefined') return;
    const deduped = Array.from(new Set(items)).slice(-maxItems);
    localStorage.setItem(key, JSON.stringify(deduped));
  } catch {
    // ignore storage errors
  }
}

export function rememberTrackedTicket(ticketNumber: string, clientPhone?: string): void {
  const cleanTicket = ticketNumber.trim().toUpperCase();
  if (cleanTicket.length >= 3) {
    const existing = readStringArray(TRACKED_TICKETS_KEY);
    writeStringArray(TRACKED_TICKETS_KEY, [...existing, cleanTicket], 25);
  }
  if (clientPhone) {
    rememberTrackedPhone(clientPhone);
  }
}

export function rememberTrackedPhone(rawPhone: string): void {
  const normalized = normalizeMoroccanPhoneDigits(rawPhone);
  if (normalized.length >= 6) {
    const existing = readStringArray(TRACKED_PHONES_KEY);
    writeStringArray(TRACKED_PHONES_KEY, [...existing, normalized], 10);
  }
}

function hasNotifiedEvent(eventKey: string): boolean {
  return readStringArray(NOTIFIED_EVENTS_KEY).includes(eventKey);
}

function markEventNotified(eventKey: string): void {
  const existing = readStringArray(NOTIFIED_EVENTS_KEY);
  if (!existing.includes(eventKey)) {
    writeStringArray(NOTIFIED_EVENTS_KEY, [...existing, eventKey], 120);
  }
}

function isBookingTrackedByDevice(booking: AppointmentBooking): boolean {
  const tickets = readStringArray(TRACKED_TICKETS_KEY);
  const phones = readStringArray(TRACKED_PHONES_KEY);
  const bTicket = booking.ticketNumber.trim().toUpperCase();
  const bPhone = normalizeMoroccanPhoneDigits(booking.clientPhone);

  if (tickets.some((t) => t === bTicket || t.replace('#', '') === bTicket.replace('#', ''))) {
    return true;
  }
  if (bPhone.length >= 6 && phones.includes(bPhone)) {
    return true;
  }
  return false;
}

function parseAppointmentDateTime(dateStr: string, timeSlot: string): Date | null {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, mins] = timeSlot.split(':').map(Number);
    if (!year || !month || !day || Number.isNaN(hours)) return null;
    return new Date(year, month - 1, day, hours, mins || 0, 0);
  } catch {
    return null;
  }
}

function notifyBookingStatusUpdate(booking: AppointmentBooking, lang: Language): void {
  const eventKey = `status:${booking.id}:${booking.status}`;
  if (hasNotifiedEvent(eventKey)) return;
  markEventNotified(eventKey);

  let title = '';
  let body = '';
  let toastType: 'info' | 'success' | 'warning' | 'reschedule' = 'info';

  if (booking.status === 'confirmed') {
    toastType = 'success';
    title =
      lang === 'ar'
        ? `تم تأكيد موعدك (${booking.ticketNumber}) ✓`
        : lang === 'en'
        ? `Appointment Confirmed (${booking.ticketNumber}) ✓`
        : `Rendez-vous Confirmé (${booking.ticketNumber}) ✓`;
    body =
      lang === 'ar'
        ? `كرسيك محجوز مع ${booking.barberName} بتاريخ ${booking.date} الساعة ${booking.timeSlot}.`
        : `Votre créneau est réservé avec ${booking.barberName} le ${booking.date} à ${booking.timeSlot}.`;
  } else if (booking.status === 'rescheduled') {
    toastType = 'reschedule';
    const nextTime = booking.rescheduledTo
      ? `${booking.rescheduledTo.date} • ${booking.rescheduledTo.time}`
      : `${booking.date} • ${booking.timeSlot}`;
    title =
      lang === 'ar'
        ? `تحديث موعدك (${booking.ticketNumber})`
        : lang === 'en'
        ? `Schedule Update (${booking.ticketNumber})`
        : `Nouvel Horaire Proposé (${booking.ticketNumber})`;
    body =
      lang === 'ar'
        ? `اقترح ${booking.barberName} التوقيت الجديد: ${nextTime}. افتح التذكرة للقبول.`
        : `${booking.barberName} propose un nouvel horaire : ${nextTime}.`;
  } else if (booking.status === 'completed') {
    toastType = 'success';
    title =
      lang === 'ar'
        ? `تم تأكيد حضورك +1 نقطة ولاء (${booking.ticketNumber}) 🏆`
        : lang === 'en'
        ? `Visit Verified +1 Loyalty Point (${booking.ticketNumber}) 🏆`
        : `Visite Confirmée +1 Point Fidélité (${booking.ticketNumber}) 🏆`;
    body =
      lang === 'ar'
        ? `شكراً لزيارتك! تم تحديث رصيد نقاط الولاء وسجل الزيارات الخاص بك.`
        : `Merci pour votre visite ! Votre progression fidélité a été mise à jour.`;
  } else if (booking.status === 'rejected' || booking.status === 'cancelled') {
    toastType = 'warning';
    title =
      lang === 'ar'
        ? `إشعار بخصوص التذكرة (${booking.ticketNumber})`
        : `Mise à jour du ticket (${booking.ticketNumber})`;
    body =
      booking.adminNotes ||
      (lang === 'ar' ? 'تغيرت حالة التذكرة. اضغط لمراجعة التفاصيل.' : 'Le statut de votre réservation a changé.');
  } else {
    return;
  }

  sendDualAlert(title, {
    body,
    type: toastType,
    data: {
      ticketNumber: booking.ticketNumber,
      url: `/#track=${encodeURIComponent(booking.ticketNumber)}`,
    },
  });
}

function checkUpcomingAppointmentReminders(bookings: AppointmentBooking[], lang: Language): void {
  const nowMs = Date.now();
  bookings.forEach((b) => {
    if (b.status !== 'confirmed' && b.status !== 'pending') return;
    if (!isBookingTrackedByDevice(b)) return;

    const dt = parseAppointmentDateTime(b.date, b.timeSlot);
    if (!dt) return;

    const diffMinutes = Math.round((dt.getTime() - nowMs) / 60000);
    if (diffMinutes > 0 && diffMinutes <= 60) {
      const reminderKey = `reminder-60m:${b.id}:${b.date}:${b.timeSlot}`;
      if (hasNotifiedEvent(reminderKey)) return;
      markEventNotified(reminderKey);

      const title =
        lang === 'ar'
          ? `تذكير بموعدك في صالون بومليك (${b.ticketNumber}) ⏰`
          : lang === 'en'
          ? `Salon Boumlik Reminder (${b.ticketNumber}) ⏰`
          : `Rappel Salon Boumlik (${b.ticketNumber}) ⏰`;
      const body =
        lang === 'ar'
          ? `موعدك مع ${b.barberName} اليوم بعد ${diffMinutes} دقيقة (${b.timeSlot}). مرحباً بك!`
          : `Votre rendez-vous avec ${b.barberName} est dans ${diffMinutes} min (${b.timeSlot}).`;

      sendDualAlert(title, {
        body,
        type: 'info',
        data: {
          ticketNumber: b.ticketNumber,
          url: `/#track=${encodeURIComponent(b.ticketNumber)}`,
        },
      });
    }
  });
}

/**
 * Keeps live PWA Service Worker reminders & status-change push alerts running
 * for any appointment ticket booked or tracked on this device.
 */
export function useClientAppointmentReminders(lang: Language): void {
  const prevStatusMapRef = useRef<Record<string, string>>({});
  const hydratedRef = useRef(false);
  const latestBookingsRef = useRef<AppointmentBooking[]>([]);

  useEffect(() => {
    const unsub = subscribeToBookings((bookings) => {
      latestBookingsRef.current = bookings;

      if (!hydratedRef.current) {
        const seed: Record<string, string> = {};
        bookings.forEach((b) => {
          seed[b.id] = b.status;
        });
        prevStatusMapRef.current = seed;
        hydratedRef.current = true;
        checkUpcomingAppointmentReminders(bookings, lang);
        return;
      }

      bookings.forEach((b) => {
        const previousStatus = prevStatusMapRef.current[b.id];
        if (previousStatus && previousStatus !== b.status && isBookingTrackedByDevice(b)) {
          notifyBookingStatusUpdate(b, lang);
        }
        prevStatusMapRef.current[b.id] = b.status;
      });
    });

    const intervalId = window.setInterval(() => {
      if (latestBookingsRef.current.length > 0) {
        checkUpcomingAppointmentReminders(latestBookingsRef.current, lang);
      }
    }, 60 * 1000);

    return () => {
      unsub();
      window.clearInterval(intervalId);
    };
  }, [lang]);
}
