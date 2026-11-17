import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { AppointmentBooking, BarberScheduleConfig } from '../types';
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
    dateSlotBlocks: [],
    updatedAt: '',
  };
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
  reason?: 'booked' | 'break' | 'blocked';
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

export function evaluateBarberDayAvailability(
  barberId: string,
  dateStr: string,
  schedulesMap: Record<string, BarberScheduleConfig>,
  bookings: AppointmentBooking[]
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

  // Active bookings blocking slots for this barber on this date
  const bookedTimes = new Set(
    bookings
      .filter(
        (b) =>
          b.date === dateStr &&
          b.barberId === barberId &&
          !['cancelled', 'rejected', 'no_show'].includes(b.status)
      )
      .map((b) => b.timeSlot.trim())
  );

  const breakSet = new Set(schedule.breakSlots);
  const specificBlockSet = new Set(schedule.dateSlotBlocks);

  const slots: EvaluatedSlot[] = baseSlots.map((time) => {
    if (bookedTimes.has(time)) {
      return { time, available: false, reason: 'booked' };
    }
    if (breakSet.has(time)) {
      return { time, available: false, reason: 'break' };
    }
    if (specificBlockSet.has(`${dateStr}@${time}`)) {
      return { time, available: false, reason: 'blocked' };
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
 * Finds today's date or next open working date (skips Monday).
 */
export function getInitialBookingDate(): string {
  const d = new Date();
  if (d.getDay() === 1) {
    d.setDate(d.getDate() + 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
