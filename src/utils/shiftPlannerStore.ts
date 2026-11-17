import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  BarberScheduleConfig,
  ShiftRequest,
  ShiftRequestType,
} from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  getDefaultBarberSchedule,
  getSalonSlotsForDate,
  parseDateWeekday,
  saveBarberSchedule,
} from './barberScheduleStore';

const SHIFT_REQUESTS_COLLECTION = 'shift_requests';

let cachedShiftRequests: ShiftRequest[] = [];
let hasHydratedShiftRequests = false;
const shiftListeners = new Set<(items: ShiftRequest[]) => void>();
let activeShiftUnsubscribe: (() => void) | null = null;

function sortShiftRequests(list: ShiftRequest[]): ShiftRequest[] {
  return [...list].sort((a, b) => {
    // Pending requests first, then newest createdAt
    if (a.status !== b.status) {
      if (a.status === 'pending') return -1;
      if (b.status === 'pending') return 1;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

function ensureShiftRequestsListener() {
  if (activeShiftUnsubscribe) return;

  activeShiftUnsubscribe = onSnapshot(
    collection(db, SHIFT_REQUESTS_COLLECTION),
    (snapshot) => {
      const next: ShiftRequest[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as ShiftRequest;
        return {
          ...data,
          id: data.id || docSnap.id,
        };
      });
      cachedShiftRequests = sortShiftRequests(next);
      hasHydratedShiftRequests = true;
      shiftListeners.forEach((cb) => cb(cachedShiftRequests));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, SHIFT_REQUESTS_COLLECTION);
    }
  );
}

export function subscribeToShiftRequests(
  onData: (items: ShiftRequest[]) => void
): () => void {
  shiftListeners.add(onData);
  ensureShiftRequestsListener();
  if (hasHydratedShiftRequests) {
    onData(cachedShiftRequests);
  }
  return () => {
    shiftListeners.delete(onData);
    if (shiftListeners.size === 0 && activeShiftUnsubscribe) {
      activeShiftUnsubscribe();
      activeShiftUnsubscribe = null;
      hasHydratedShiftRequests = false;
    }
  };
}

export function useShiftRequests(): ShiftRequest[] {
  const [requests, setRequests] = useState<ShiftRequest[]>(cachedShiftRequests);

  useEffect(() => {
    const unsub = subscribeToShiftRequests((items) => {
      setRequests([...items]);
    });
    return () => unsub();
  }, []);

  return requests;
}

export interface CreateShiftRequestInput {
  barberId: string;
  barberName: string;
  requestType: ShiftRequestType;
  targetDate: string;
  targetSlots?: string[];
  swapWithBarberId?: string;
  swapWithBarberName?: string;
  swapDate?: string;
  reason?: string;
}

export async function createShiftRequest(
  input: CreateShiftRequestInput
): Promise<ShiftRequest> {
  const id = `sr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.replace(
    /[^a-zA-Z0-9_-]/g,
    ''
  );
  const now = new Date().toISOString().slice(0, 64);

  const payload: ShiftRequest = {
    id,
    barberId: input.barberId.trim().slice(0, 64),
    barberName: input.barberName.trim().slice(0, 100),
    requestType: input.requestType,
    targetDate: input.targetDate.trim().slice(0, 20),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  if (input.targetSlots && input.targetSlots.length > 0) {
    payload.targetSlots = Array.from(
      new Set(input.targetSlots.map((s) => s.trim().slice(0, 16)).filter(Boolean))
    ).slice(0, 12);
  }

  if (input.requestType === 'shift_swap' && input.swapWithBarberId) {
    payload.swapWithBarberId = input.swapWithBarberId.trim().slice(0, 64);
    if (input.swapWithBarberName) {
      payload.swapWithBarberName = input.swapWithBarberName.trim().slice(0, 100);
    }
    if (input.swapDate && input.swapDate.trim()) {
      payload.swapDate = input.swapDate.trim().slice(0, 20);
    }
  }

  if (input.reason && input.reason.trim()) {
    payload.reason = input.reason.trim().slice(0, 300);
  }

  const path = `${SHIFT_REQUESTS_COLLECTION}/${id}`;
  try {
    await setDoc(doc(db, SHIFT_REQUESTS_COLLECTION, id), payload);
    cachedShiftRequests = sortShiftRequests([payload, ...cachedShiftRequests]);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Approves a shift request (Master Admin) and automatically updates `barber_schedules`
 * in Firestore so the client booking wizard reflects the updated barber availability immediately.
 */
export async function approveShiftRequestAndSyncAvailability(
  request: ShiftRequest,
  schedulesMap: Record<string, BarberScheduleConfig>,
  reviewedBy: string,
  reviewerNote?: string
): Promise<void> {
  const requesterSchedule =
    schedulesMap[request.barberId] || getDefaultBarberSchedule(request.barberId);

  if (request.requestType === 'day_off') {
    const nextOffDates = Array.from(
      new Set([...requesterSchedule.offDates, request.targetDate])
    ).sort();
    await saveBarberSchedule({
      ...requesterSchedule,
      offDates: nextOffDates,
    });
  } else if (request.requestType === 'day_open') {
    const targetWeekday = parseDateWeekday(request.targetDate);
    const nextOffDates = requesterSchedule.offDates.filter(
      (d) => d !== request.targetDate
    );
    const nextOffWeekdays =
      targetWeekday === 1
        ? requesterSchedule.offWeekdays
        : requesterSchedule.offWeekdays.filter((w) => w !== targetWeekday);
    await saveBarberSchedule({
      ...requesterSchedule,
      offDates: nextOffDates,
      offWeekdays: nextOffWeekdays,
    });
  } else if (request.requestType === 'slot_block') {
    const slots =
      request.targetSlots && request.targetSlots.length > 0
        ? request.targetSlots
        : getSalonSlotsForDate(request.targetDate);
    const blockKeys = slots.map((slot) => `${request.targetDate}@${slot}`);
    const nextBlocks = Array.from(
      new Set([...requesterSchedule.dateSlotBlocks, ...blockKeys])
    );
    await saveBarberSchedule({
      ...requesterSchedule,
      dateSlotBlocks: nextBlocks,
    });
  } else if (request.requestType === 'slot_open') {
    const slots =
      request.targetSlots && request.targetSlots.length > 0
        ? request.targetSlots
        : getSalonSlotsForDate(request.targetDate);
    const unblockKeySet = new Set(
      slots.map((slot) => `${request.targetDate}@${slot}`)
    );
    const unblockSlotSet = new Set(slots);
    const nextBlocks = requesterSchedule.dateSlotBlocks.filter(
      (k) => !unblockKeySet.has(k)
    );
    const nextBreaks = requesterSchedule.breakSlots.filter(
      (s) => !unblockSlotSet.has(s)
    );
    const nextOffDates = requesterSchedule.offDates.filter(
      (d) => d !== request.targetDate
    );
    await saveBarberSchedule({
      ...requesterSchedule,
      offDates: nextOffDates,
      breakSlots: nextBreaks,
      dateSlotBlocks: nextBlocks,
    });
  } else if (request.requestType === 'shift_swap') {
    const isSlotLevelSwap = Boolean(
      request.targetSlots && request.targetSlots.length > 0
    );

    if (isSlotLevelSwap && request.targetSlots) {
      const targetBlockKeys = request.targetSlots.map(
        (slot) => `${request.targetDate}@${slot}`
      );
      let requesterBlocks = Array.from(
        new Set([...requesterSchedule.dateSlotBlocks, ...targetBlockKeys])
      );
      let requesterOffDates = [...requesterSchedule.offDates];

      if (request.swapDate) {
        const returnKeys = new Set(
          request.targetSlots.map((slot) => `${request.swapDate}@${slot}`)
        );
        requesterBlocks = requesterBlocks.filter((k) => !returnKeys.has(k));
        requesterOffDates = requesterOffDates.filter((d) => d !== request.swapDate);
      }

      await saveBarberSchedule({
        ...requesterSchedule,
        offDates: requesterOffDates,
        dateSlotBlocks: requesterBlocks,
      });

      if (request.swapWithBarberId) {
        const partnerSchedule =
          schedulesMap[request.swapWithBarberId] ||
          getDefaultBarberSchedule(request.swapWithBarberId);
        const targetKeySet = new Set(targetBlockKeys);
        let partnerBlocks = partnerSchedule.dateSlotBlocks.filter(
          (k) => !targetKeySet.has(k)
        );
        let partnerOffDates = partnerSchedule.offDates.filter(
          (d) => d !== request.targetDate
        );

        if (request.swapDate) {
          const partnerNewBlocks = request.targetSlots.map(
            (slot) => `${request.swapDate}@${slot}`
          );
          partnerBlocks = Array.from(new Set([...partnerBlocks, ...partnerNewBlocks]));
        }

        await saveBarberSchedule({
          ...partnerSchedule,
          offDates: partnerOffDates,
          dateSlotBlocks: partnerBlocks,
        });
      }
    } else {
      // Full-day swap: requester gets targetDate off; swapDate (if given) opens for requester & closes for colleague
      let requesterOffDates = Array.from(
        new Set([...requesterSchedule.offDates, request.targetDate])
      );
      if (request.swapDate) {
        requesterOffDates = requesterOffDates.filter((d) => d !== request.swapDate);
      }

      await saveBarberSchedule({
        ...requesterSchedule,
        offDates: requesterOffDates.sort(),
      });

      if (request.swapWithBarberId) {
        const partnerSchedule =
          schedulesMap[request.swapWithBarberId] ||
          getDefaultBarberSchedule(request.swapWithBarberId);
        let partnerOffDates = partnerSchedule.offDates.filter(
          (d) => d !== request.targetDate
        );
        if (request.swapDate) {
          partnerOffDates = Array.from(new Set([...partnerOffDates, request.swapDate]));
        }

        await saveBarberSchedule({
          ...partnerSchedule,
          offDates: partnerOffDates.sort(),
        });
      }
    }
  }

  const now = new Date().toISOString().slice(0, 64);
  const path = `${SHIFT_REQUESTS_COLLECTION}/${request.id}`;
  const updatePayload: Record<string, string> = {
    status: 'approved',
    reviewedBy: reviewedBy.trim().slice(0, 100),
    reviewedAt: now,
    updatedAt: now,
  };
  if (reviewerNote && reviewerNote.trim()) {
    updatePayload.reviewerNote = reviewerNote.trim().slice(0, 300);
  }

  try {
    await updateDoc(doc(db, SHIFT_REQUESTS_COLLECTION, request.id), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function rejectShiftRequest(
  requestId: string,
  reviewedBy: string,
  reviewerNote?: string
): Promise<void> {
  const now = new Date().toISOString().slice(0, 64);
  const path = `${SHIFT_REQUESTS_COLLECTION}/${requestId}`;
  const updatePayload: Record<string, string> = {
    status: 'rejected',
    reviewedBy: reviewedBy.trim().slice(0, 100),
    reviewedAt: now,
    updatedAt: now,
  };
  if (reviewerNote && reviewerNote.trim()) {
    updatePayload.reviewerNote = reviewerNote.trim().slice(0, 300);
  }

  try {
    await updateDoc(doc(db, SHIFT_REQUESTS_COLLECTION, requestId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteShiftRequest(requestId: string): Promise<void> {
  const path = `${SHIFT_REQUESTS_COLLECTION}/${requestId}`;
  try {
    await deleteDoc(doc(db, SHIFT_REQUESTS_COLLECTION, requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
