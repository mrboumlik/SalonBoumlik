import { useEffect, useRef } from 'react';
import { AppointmentBooking, CrmClientProfile, Language } from '../types';
import { normalizeMoroccanPhoneDigits, subscribeToBookings } from './bookingStore';
import { subscribeToCrmClients } from './crmStore';
import { computeClientPointsSummary } from './loyaltyEngine';
import { sendDualAlert } from './notifications';
import { pickLang } from './i18n';

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

export function getRememberedPhones(): string[] {
  return readStringArray(TRACKED_PHONES_KEY);
}

export function getRememberedTickets(): string[] {
  return readStringArray(TRACKED_TICKETS_KEY);
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
    title = pickLang(lang, {
      ar: `تم تأكيد موعدك (${booking.ticketNumber}) ✓`,
      fr: `Rendez-vous Confirmé (${booking.ticketNumber}) ✓`,
      amz: `ⵉⵜⵜⵓⵙⵙⵏⵜⵎ ⵓⵙⵉⵀⵍ ⵏⵏⴽ (${booking.ticketNumber}) ✓`,
      en: `Appointment Confirmed (${booking.ticketNumber}) ✓`,
      es: `Cita confirmada (${booking.ticketNumber}) ✓`,
    });
    body = pickLang(lang, {
      ar: `كرسيك محجوز مع ${booking.barberName} بتاريخ ${booking.date} الساعة ${booking.timeSlot}.`,
      fr: `Votre créneau est réservé avec ${booking.barberName} le ${booking.date} à ${booking.timeSlot}.`,
      amz: `ⴰⵙⵉⵀⵍ ⵏⵏⴽ ⵉⵀⵢⵢⴰ ⴷ ${booking.barberName} ⴰⵙⵙ ⵏ ${booking.date} ⴳ ${booking.timeSlot}.`,
      en: `Your chair is reserved with ${booking.barberName} on ${booking.date} at ${booking.timeSlot}.`,
      es: `Tu turno está reservado con ${booking.barberName} el ${booking.date} a las ${booking.timeSlot}.`,
    });
  } else if (booking.status === 'rescheduled') {
    toastType = 'reschedule';
    const nextTime = booking.rescheduledTo
      ? `${booking.rescheduledTo.date} • ${booking.rescheduledTo.time}`
      : `${booking.date} • ${booking.timeSlot}`;
    title = pickLang(lang, {
      ar: `تحديث موعدك (${booking.ticketNumber})`,
      fr: `Nouvel Horaire Proposé (${booking.ticketNumber})`,
      amz: `ⴰⵙⴷⵖⵉ ⵏ ⵓⵙⵉⵀⵍ (${booking.ticketNumber})`,
      en: `Schedule Update (${booking.ticketNumber})`,
      es: `Actualización de cita (${booking.ticketNumber})`,
    });
    body = pickLang(lang, {
      ar: `اقترح ${booking.barberName} التوقيت الجديد: ${nextTime}. افتح التذكرة للقبول.`,
      fr: `${booking.barberName} propose un nouvel horaire : ${nextTime}.`,
      amz: `ⵉⵙⵙⵓⵜⵔ ${booking.barberName} ⴰⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ : ${nextTime}.`,
      en: `${booking.barberName} suggested a new time: ${nextTime}. Open ticket to confirm.`,
      es: `${booking.barberName} propuso nuevo horario: ${nextTime}. Abre el ticket.`,
    });
  } else if (booking.status === 'completed') {
    toastType = 'success';
    title = pickLang(lang, {
      ar: `تم تأكيد حضورك +1 نقطة ولاء (${booking.ticketNumber}) 🏆`,
      fr: `Visite Confirmée +1 Point Fidélité (${booking.ticketNumber}) 🏆`,
      amz: `ⵜⵉⵔⵣⵉ ⵜⵜⵓⵙⵙⵏⵜⵎ +1 ⵏ ⵜⵖⵓⵏⵉ (${booking.ticketNumber}) 🏆`,
      en: `Visit Verified +1 Loyalty Point (${booking.ticketNumber}) 🏆`,
      es: `Visita verificada +1 punto fidelidad (${booking.ticketNumber}) 🏆`,
    });
    body = pickLang(lang, {
      ar: 'شكراً لزيارتك! تم تحديث رصيد نقاط الولاء وسجل الزيارات الخاص بك.',
      fr: 'Merci pour votre visite ! Votre progression fidélité a été mise à jour.',
      amz: 'ⵜⴰⵏⵎⵎⵉⵔⵜ ⵖⴼ ⵜⵉⵔⵣⵉ ⵏⵏⴽ! ⵉⵙⴷⵖⴰ ⵓⵙⵡⵉⵔ ⵏ ⵜⵖⵓⵏⵉ ⵏⵏⴽ.',
      en: 'Thank you for visiting! Your loyalty points balance and visit history are updated.',
      es: '¡Gracias por tu visita! Tus puntos e historial de fidelidad han sido actualizados.',
    });
  } else if (booking.status === 'rejected' || booking.status === 'cancelled') {
    toastType = 'warning';
    title = pickLang(lang, {
      ar: `إشعار بخصوص التذكرة (${booking.ticketNumber})`,
      fr: `Mise à jour du ticket (${booking.ticketNumber})`,
      amz: `ⴰⵏⵖⵎⵉⵙ ⵖⴼ ⵜⴼⵔⴽⵉⵜ (${booking.ticketNumber})`,
      en: `Ticket Update (${booking.ticketNumber})`,
      es: `Aviso sobre el ticket (${booking.ticketNumber})`,
    });
    body =
      booking.adminNotes ||
      pickLang(lang, {
        ar: 'تغيرت حالة التذكرة. اضغط لمراجعة التفاصيل.',
        fr: 'Le statut de votre réservation a changé.',
        amz: 'ⵉⵏⴼⵍ ⵡⴰⴷⴷⴰⴷ ⵏ ⵓⵙⵉⵀⵍ ⵏⵏⴽ.',
        en: 'Your booking status changed. Tap to view details.',
        es: 'El estado de tu reserva ha cambiado.',
      });
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

      const title = pickLang(lang, {
        ar: `تذكير بموعدك في صالون بومليك (${b.ticketNumber}) ⏰`,
        fr: `Rappel Salon Boumlik (${b.ticketNumber}) ⏰`,
        amz: `ⴰⵙⴽⵜⵉ ⵏ ⵓⵙⵉⵀⵍ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ (${b.ticketNumber}) ⏰`,
        en: `Salon Boumlik Reminder (${b.ticketNumber}) ⏰`,
        es: `Recordatorio Salon Boumlik (${b.ticketNumber}) ⏰`,
      });
      const body = pickLang(lang, {
        ar: `موعدك مع ${b.barberName} اليوم بعد ${diffMinutes} دقيقة (${b.timeSlot}). مرحباً بك!`,
        fr: `Votre rendez-vous avec ${b.barberName} est dans ${diffMinutes} min (${b.timeSlot}).`,
        amz: `ⴰⵙⵉⵀⵍ ⵏⵏⴽ ⴷ ${b.barberName} ⵉⵍⵍⴰ ⴳ ${diffMinutes} ⵜⵓⵙⴷⵉⴷⵜ (${b.timeSlot}).`,
        en: `Your appointment with ${b.barberName} is in ${diffMinutes} min (${b.timeSlot}).`,
        es: `Tu cita con ${b.barberName} es en ${diffMinutes} min (${b.timeSlot}).`,
      });

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
  const prevPointsMapRef = useRef<Record<string, number>>({});
  const hydratedCrmRef = useRef(false);

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

    const unsubCrm = subscribeToCrmClients((crmMap: Record<string, CrmClientProfile>) => {
      const trackedPhones = readStringArray(TRACKED_PHONES_KEY);
      if (!hydratedCrmRef.current) {
        const seedPts: Record<string, number> = {};
        Object.values(crmMap).forEach((profile) => {
          const pts = computeClientPointsSummary(profile.verifiedVisits ?? 0, profile).pointsBalance;
          seedPts[profile.id] = pts;
        });
        prevPointsMapRef.current = seedPts;
        hydratedCrmRef.current = true;
        return;
      }

      Object.values(crmMap).forEach((profile) => {
        const currentPts = computeClientPointsSummary(profile.verifiedVisits ?? 0, profile).pointsBalance;
        const previousPts = prevPointsMapRef.current[profile.id];
        if (
          previousPts !== undefined &&
          previousPts !== currentPts &&
          trackedPhones.includes(profile.normalizedPhone)
        ) {
          const delta = currentPts - previousPts;
          const eventKey = `pts:${profile.id}:${currentPts}:${profile.updatedAt}`;
          if (!hasNotifiedEvent(eventKey)) {
            markEventNotified(eventKey);
            sendDualAlert(
              pickLang(lang, {
                ar: '🪙 تحديث رصيد نقاط الولاء!',
                fr: '🪙 Points de Fidélité Mis à Jour !',
                amz: '🪙 ⵉⵙⴷⵖⴰ ⵓⵎⵉⴹⴰⵏ ⵏ ⵜⵖⵓⵏⵉ!',
                en: '🪙 Loyalty Points Updated!',
                es: '🪙 ¡Puntos de fidelidad actualizados!',
              }),
              {
                body: pickLang(lang, {
                  ar: `${delta > 0 ? `+${delta}` : delta} نقطة — رصيدك الحالي: ${currentPts} نقطة.`,
                  fr: `${delta > 0 ? `+${delta}` : delta} pts — Nouveau solde : ${currentPts} pts.`,
                  amz: `${delta > 0 ? `+${delta}` : delta} pts — ⴰⵎⵉⴹⴰⵏ : ${currentPts} pts.`,
                  en: `${delta > 0 ? `+${delta}` : delta} pts — New balance: ${currentPts} pts.`,
                  es: `${delta > 0 ? `+${delta}` : delta} pts — Nuevo saldo: ${currentPts} pts.`,
                }),
                type: 'success',
                tag: `sb-points-${profile.id}-${currentPts}`,
                data: { url: `/#track=${encodeURIComponent(profile.normalizedPhone)}` },
              }
            );
          }
        }
        prevPointsMapRef.current[profile.id] = currentPts;
      });
    });

    const intervalId = window.setInterval(() => {
      if (latestBookingsRef.current.length > 0) {
        checkUpcomingAppointmentReminders(latestBookingsRef.current, lang);
      }
    }, 60 * 1000);

    return () => {
      unsub();
      unsubCrm();
      window.clearInterval(intervalId);
    };
  }, [lang]);
}
