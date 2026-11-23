import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import {
  AppointmentBooking,
  BarberBreakRange,
  BarberScheduleConfig,
} from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';

const BARBER_SCHEDULES_COLLECTION = 'barber_schedules';

// Strict 1-hour slots across standard week & Friday
export const STANDARD_DAY_SLOTS = [
  '11:00',
  '12:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
];

export const FRIDAY_DAY_SLOTS = [
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
];

export const ALL_SALON_CONFIGURABLE_HOURS = [
  '11:00',
  '12:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
];

export function parseDateWeekday(dateStr: string): number {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date().getDay();
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

/**
 * Strict Salon Boumlik Working Hours:
 * - Monday (day 1): OFF / Closed
 * - Friday (day 5): 15:00 - 22:00 (1-hour slots: 15:00..21:00)
 * - Tue, Wed, Thu, Sat, Sun: 11:00 - 13:00 & 16:00 - 22:00 (1-hour slots: 11:00, 12:00, 16:00..21:00)
 */
export function getSalonSlotsForDate(dateStr: string): string[] {
  const day = parseDateWeekday(dateStr);
  if (day === 1) return []; // Monday OFF
  if (day === 5) return [...FRIDAY_DAY_SLOTS]; // Friday 15-22
  return [...STANDARD_DAY_SLOTS]; // 11-13 & 16-22
}

export function getDefaultBarberSchedule(barberId: string): BarberScheduleConfig {
  return {
    id: barberId,
    barberId,
    offWeekdays: [1], // Monday off by default
    offDates: [],
    breakSlots: [],
    breakRanges: [],
    dateSlotBlocks: [],
    updatedAt: '',
  };
}

function parseSlotMinutes(hhmm: string): number {
  const clean = (hhmm || '').trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
}

function sanitizeBreakRanges(raw: unknown): BarberBreakRange[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 20)
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Partial<BarberBreakRange>;
      const start = String(r.start || '').trim().slice(0, 8);
      const end = String(r.end || '').trim().slice(0, 8);
      const sMin = parseSlotMinutes(start);
      const eMin = parseSlotMinutes(end);
      if (sMin < 0 || eMin <= sMin) return null;
      return {
        id: String(r.id || `br-${idx + 1}`)
          .replace(/[^a-zA-Z0-9_-]/g, '-')
          .slice(0, 48),
        start: `${String(Math.floor(sMin / 60)).padStart(2, '0')}:${String(sMin % 60).padStart(2, '0')}`,
        end: `${String(Math.floor(eMin / 60)).padStart(2, '0')}:${String(eMin % 60).padStart(2, '0')}`,
      };
    })
    .filter((r): r is BarberBreakRange => r !== null);
}

export function isTimeSlotInBreakRanges(
  slotTime: string,
  breakRanges: BarberBreakRange[] = []
): boolean {
  const slotMin = parseSlotMinutes(slotTime);
  if (slotMin < 0 || breakRanges.length === 0) return false;
  const slotEnd = slotMin + 60;
  return breakRanges.some((r) => {
    const rStart = parseSlotMinutes(r.start);
    const rEnd = parseSlotMinutes(r.end);
    return rStart >= 0 && rEnd > rStart && rStart < slotEnd && rEnd > slotMin;
  });
}

let cachedSchedules: Record<string, BarberScheduleConfig> = {};
let hasHydratedSchedules = false;
const scheduleListeners = new Set<(map: Record<string, BarberScheduleConfig>) => void>();
let activeScheduleUnsubscribe: (() => void) | null = null;

function ensureSchedulesListener() {
  if (activeScheduleUnsubscribe) return;

  activeScheduleUnsubscribe = onSnapshot(
    collection(db, BARBER_SCHEDULES_COLLECTION),
    (snapshot) => {
      const next: Record<string, BarberScheduleConfig> = {};
      snapshot.docs.forEach((docSnap) => {
        const raw = docSnap.data() as Partial<BarberScheduleConfig>;
        const id = raw.barberId || raw.id || docSnap.id;
        next[id] = {
          id,
          barberId: id,
          offWeekdays: Array.isArray(raw.offWeekdays) ? raw.offWeekdays : [1],
          offDates: Array.isArray(raw.offDates) ? raw.offDates : [],
          breakSlots: Array.isArray(raw.breakSlots) ? raw.breakSlots : [],
          breakRanges: sanitizeBreakRanges(raw.breakRanges),
          dateSlotBlocks: Array.isArray(raw.dateSlotBlocks) ? raw.dateSlotBlocks : [],
          updatedAt: raw.updatedAt || '',
        };
      });
      cachedSchedules = next;
      hasHydratedSchedules = true;
      scheduleListeners.forEach((cb) => cb(next));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, BARBER_SCHEDULES_COLLECTION);
    }
  );
}

export function subscribeToBarberSchedules(
  onData: (map: Record<string, BarberScheduleConfig>) => void
): () => void {
  scheduleListeners.add(onData);
  ensureSchedulesListener();
  if (hasHydratedSchedules) {
    onData(cachedSchedules);
  }
  return () => {
    scheduleListeners.delete(onData);
    if (scheduleListeners.size === 0 && activeScheduleUnsubscribe) {
      activeScheduleUnsubscribe();
      activeScheduleUnsubscribe = null;
      hasHydratedSchedules = false;
    }
  };
}

export function useBarberSchedules(): Record<string, BarberScheduleConfig> {
  const [schedules, setSchedules] = useState<Record<string, BarberScheduleConfig>>(cachedSchedules);

  useEffect(() => {
    const unsub = subscribeToBarberSchedules((data) => {
      setSchedules({ ...data });
    });
    return () => unsub();
  }, []);

  return schedules;
}

export async function saveBarberSchedule(
  config: Omit<BarberScheduleConfig, 'updatedAt'>
): Promise<BarberScheduleConfig> {
  const cleanId = config.barberId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  const path = `${BARBER_SCHEDULES_COLLECTION}/${cleanId}`;
  const payload: BarberScheduleConfig = {
    id: cleanId,
    barberId: cleanId,
    offWeekdays: Array.from(new Set(config.offWeekdays.filter((d) => d >= 0 && d <= 6))).slice(0, 7),
    offDates: Array.from(new Set(config.offDates.map((d) => d.trim().slice(0, 20)).filter(Boolean))).slice(0, 60),
    breakSlots: Array.from(new Set(config.breakSlots.map((s) => s.trim().slice(0, 16)).filter(Boolean))).slice(0, 20),
    breakRanges: sanitizeBreakRanges(config.breakRanges),
    dateSlotBlocks: Array.from(new Set(config.dateSlotBlocks.map((s) => s.trim().slice(0, 32)).filter(Boolean))).slice(0, 100),
    updatedAt: new Date().toISOString().slice(0, 64),
  };

  try {
    await setDoc(doc(db, BARBER_SCHEDULES_COLLECTION, cleanId), payload);
    cachedSchedules = { ...cachedSchedules, [cleanId]: payload };
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface EvaluatedSlot {
  time: string;
  available: boolean;
  reason?: 'booked' | 'break' | 'blocked' | 'past';
}

export interface DayAvailabilitySummary {
  weekday: number;
  isSalonClosedDay: boolean;
  isBarberOffDay: boolean;
  baseSlots: string[];
  slots: EvaluatedSlot[];
  availableSlots: string[];
  isFullyBooked: boolean;
}

function getLocalTodayString(refDate = new Date()): string {
  const yyyy = refDate.getFullYear();
  const mm = String(refDate.getMonth() + 1).padStart(2, '0');
  const dd = String(refDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function evaluateBarberDayAvailability(
  barberId: string,
  dateStr: string,
  schedulesMap: Record<string, BarberScheduleConfig>,
  bookings: AppointmentBooking[],
  candidateDurationMinutes = 30
): DayAvailabilitySummary {
  const weekday = parseDateWeekday(dateStr);
  const baseSlots = getSalonSlotsForDate(dateStr);
  const isSalonClosedDay = weekday === 1 || baseSlots.length === 0;

  const schedule = schedulesMap[barberId] || getDefaultBarberSchedule(barberId);
  const isBarberOffDay =
    !isSalonClosedDay &&
    (schedule.offWeekdays.includes(weekday) || schedule.offDates.includes(dateStr));

  if (isSalonClosedDay || isBarberOffDay) {
    return {
      weekday,
      isSalonClosedDay,
      isBarberOffDay,
      baseSlots,
      slots: [],
      availableSlots: [],
      isFullyBooked: !isSalonClosedDay && isBarberOffDay,
    };
  }

  const now = new Date();
  const todayLocalStr = getLocalTodayString(now);
  const isToday = dateStr === todayLocalStr;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Build occupied [startMin, endMin) intervals from existing non-cancelled bookings
  const bookingIntervals = bookings
    .filter(
      (b) =>
        b.date === dateStr &&
        b.barberId === barberId &&
        b.status !== 'flexible_pending' &&
        b.timeSlot.trim() !== 'FLEXIBLE' &&
        !['cancelled', 'rejected', 'no_show'].includes(b.status)
    )
    .map((b) => {
      const startMin = parseSlotMinutes(b.timeSlot);
      if (startMin < 0) return null;
      const dur = Math.max(60, Number(b.totalDurationMinutes) || 60);
      const spanHours = Math.max(1, Math.ceil(dur / 60));
      return {
        startMin,
        endMin: startMin + spanHours * 60,
      };
    })
    .filter((iv): iv is { startMin: number; endMin: number } => iv !== null);

  const breakSet = new Set(schedule.breakSlots);
  const breakRanges = sanitizeBreakRanges(schedule.breakRanges);
  const specificBlockSet = new Set(schedule.dateSlotBlocks);
  const baseSlotMinutesSet = new Set(baseSlots.map(parseSlotMinutes));

  const getSingleSlotBlockReason = (
    slotMin: number,
    slotTime: string
  ): 'booked' | 'break' | 'blocked' | 'past' | null => {
    if (isToday && slotMin <= nowMinutes) {
      return 'past';
    }
    const slotEnd = slotMin + 60;
    const hasBookingOverlap = bookingIntervals.some(
      (iv) => iv.startMin < slotEnd && iv.endMin > slotMin
    );
    if (hasBookingOverlap) return 'booked';
    if (breakSet.has(slotTime)) return 'break';
    if (
      breakRanges.some((r) => {
        const rStart = parseSlotMinutes(r.start);
        const rEnd = parseSlotMinutes(r.end);
        return rStart >= 0 && rEnd > rStart && rStart < slotEnd && rEnd > slotMin;
      })
    ) {
      return 'break';
    }
    if (specificBlockSet.has(`${dateStr}@${slotTime}`)) return 'blocked';
    return null;
  };

  // Number of consecutive 1-hour slots required for the candidate duration
  const neededSlots = Math.max(1, Math.ceil((candidateDurationMinutes || 30) / 60));

  const slots: EvaluatedSlot[] = baseSlots.map((time) => {
    const startMin = parseSlotMinutes(time);
    const directReason = getSingleSlotBlockReason(startMin, time);
    if (directReason) {
      return { time, available: false, reason: directReason };
    }

    if (neededSlots > 1) {
      // Morning block closes at 13:00 (780); evening closes at 22:00 (1320)
      const sessionCutoff = startMin < 13 * 60 ? 13 * 60 : 22 * 60;
      if (startMin + neededSlots * 60 > sessionCutoff) {
        return { time, available: false, reason: 'booked' };
      }

      for (let k = 1; k < neededSlots; k++) {
        const nextMin = startMin + k * 60;
        const nextHourStr = `${String(Math.floor(nextMin / 60)).padStart(2, '0')}:00`;
        if (!baseSlotMinutesSet.has(nextMin)) {
          return { time, available: false, reason: 'booked' };
        }
        const nextReason = getSingleSlotBlockReason(nextMin, nextHourStr);
        if (nextReason) {
          return { time, available: false, reason: nextReason };
        }
      }
    }

    return { time, available: true };
  });

  const availableSlots = slots.filter((s) => s.available).map((s) => s.time);

  return {
    weekday,
    isSalonClosedDay: false,
    isBarberOffDay: false,
    baseSlots,
    slots,
    availableSlots,
    isFullyBooked: slots.length > 0 && availableSlots.length === 0,
  };
}

/**
 * Finds today's date or next open working date (skips Monday and skips today once past 21:00).
 */
export function getInitialBookingDate(): string {
  const d = new Date();
  if (d.getHours() >= 21) {
    d.setDate(d.getDate() + 1);
  }
  if (d.getDay() === 1) {
    d.setDate(d.getDate() + 1);
  }
  return getLocalTodayString(d);
}

/**
 * Computes open slots ranked closest to an optional preferred hour hint (e.g. '17:00')
 * for a given barber across the chosen date or next open working days, respecting duration.
 */
export function getRankedAvailableSlotsForBarber(
  barberId: string,
  preferredDate: string,
  preferredTimeHint: string | undefined,
  schedulesMap: Record<string, BarberScheduleConfig>,
  bookings: AppointmentBooking[],
  candidateDurationMinutes = 30
): { date: string; time: string; isSameDay: boolean }[] {
  const results: { date: string; time: string; isSameDay: boolean }[] = [];
  const parseMinutes = (hhmm?: string) => {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm.trim())) return 16 * 60;
    const [h, m] = hhmm.trim().split(':').map(Number);
    return h * 60 + m;
  };
  const targetMin = parseMinutes(preferredTimeHint);

  const todayStr = getLocalTodayString(new Date());
  const parsedStart =
    preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(preferredDate) && preferredDate >= todayStr
      ? new Date(`${preferredDate}T12:00:00`)
      : new Date();

  for (let offset = 0; offset < 5 && results.length < 10; offset++) {
    const cursor = new Date(parsedStart);
    cursor.setDate(parsedStart.getDate() + offset);
    const dStr = getLocalTodayString(cursor);

    const avail = evaluateBarberDayAvailability(
      barberId,
      dStr,
      schedulesMap,
      bookings,
      candidateDurationMinutes
    );
    if (avail.isSalonClosedDay || avail.isBarberOffDay || avail.availableSlots.length === 0) {
      continue;
    }

    const sortedSlots = [...avail.availableSlots].sort(
      (a, b) => Math.abs(parseMinutes(a) - targetMin) - Math.abs(parseMinutes(b) - targetMin)
    );
    sortedSlots.forEach((slot) => {
      if (results.length < 10) {
        results.push({ date: dStr, time: slot, isSameDay: dStr === preferredDate });
      }
    });
  }

  return results;
}
