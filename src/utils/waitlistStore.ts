import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { WaitlistEntry, WaitlistStatus } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  emitRealtimeSyncHint,
  registerRealtimeRefreshHandler,
  resetResilientRetry,
  scheduleResilientRetry,
} from './realtimeSync';
import { dispatchStaffBackgroundPush } from './webPushClient';

const WAITLIST_COLLECTION = 'waitlist';

let cachedWaitlist: WaitlistEntry[] = [];
let hasHydratedWaitlist = false;
const waitlistListeners = new Set<(entries: WaitlistEntry[]) => void>();
let activeWaitlistUnsubscribe: (() => void) | null = null;
let waitlistRefreshUnsub: (() => void) | null = null;

function sortWaitlistDesc(list: WaitlistEntry[]): WaitlistEntry[] {
  return [...list].sort((a, b) => {
    const cmp = (b.createdAt || '').localeCompare(a.createdAt || '');
    if (cmp !== 0) return cmp;
    return (b.id || '').localeCompare(a.id || '');
  });
}

function commitWaitlistCache(next: WaitlistEntry[], broadcastHint = false): void {
  cachedWaitlist = sortWaitlistDesc(next);
  hasHydratedWaitlist = true;
  waitlistListeners.forEach((cb) => {
    try {
      cb(cachedWaitlist);
    } catch (err) {
      console.warn('Waitlist listener callback error:', err);
    }
  });
  if (broadcastHint) {
    emitRealtimeSyncHint('waitlist');
  }
}

function ensureWaitlistListener() {
  if (!waitlistRefreshUnsub) {
    waitlistRefreshUnsub = registerRealtimeRefreshHandler(
      'waitlist',
      'waitlist',
      async () => {
        if (waitlistListeners.size === 0) return;
        ensureWaitlistListener();
        try {
          let snap;
          try {
            snap = await getDocsFromServer(collection(db, WAITLIST_COLLECTION));
          } catch {
            snap = await getDocs(collection(db, WAITLIST_COLLECTION));
          }
          const items: WaitlistEntry[] = snap.docs.map((docSnap) => ({
            ...(docSnap.data() as WaitlistEntry),
            id: docSnap.id,
          }));
          commitWaitlistCache(items);
        } catch (err) {
          console.warn('Waitlist wake refresh warning:', err);
        }
      }
    );
  }
  if (activeWaitlistUnsubscribe) return;

  activeWaitlistUnsubscribe = onSnapshot(
    collection(db, WAITLIST_COLLECTION),
    (snapshot) => {
      resetResilientRetry('waitlist');
      const items: WaitlistEntry[] = snapshot.docs.map((docSnap) => ({
        ...(docSnap.data() as WaitlistEntry),
        id: docSnap.id,
      }));
      commitWaitlistCache(items);
    },
    (error) => {
      if (activeWaitlistUnsubscribe) {
        try {
          activeWaitlistUnsubscribe();
        } catch {
          // Ignore
        }
        activeWaitlistUnsubscribe = null;
      }
      scheduleResilientRetry(
        'waitlist',
        () => waitlistListeners.size > 0,
        () => ensureWaitlistListener(),
        error
      );
    }
  );
}

export function subscribeToWaitlist(
  onData: (entries: WaitlistEntry[]) => void
): () => void {
  waitlistListeners.add(onData);
  ensureWaitlistListener();
  if (hasHydratedWaitlist) {
    onData(cachedWaitlist);
  }
  return () => {
    waitlistListeners.delete(onData);
    if (waitlistListeners.size === 0) {
      resetResilientRetry('waitlist');
      if (activeWaitlistUnsubscribe) {
        activeWaitlistUnsubscribe();
        activeWaitlistUnsubscribe = null;
      }
      if (waitlistRefreshUnsub) {
        waitlistRefreshUnsub();
        waitlistRefreshUnsub = null;
      }
      hasHydratedWaitlist = false;
    }
  };
}

export function useWaitlist(): WaitlistEntry[] {
  const [entries, setEntries] = useState<WaitlistEntry[]>(cachedWaitlist);

  useEffect(() => {
    const unsub = subscribeToWaitlist((list) => {
      setEntries([...list]);
    });
    return () => unsub();
  }, []);

  return entries;
}

export async function addToWaitlist(
  input: Omit<WaitlistEntry, 'id' | 'status' | 'createdAt'>
): Promise<WaitlistEntry> {
  const id = `wl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const entry: WaitlistEntry = {
    id,
    barberId: String(input.barberId || 'hassan').slice(0, 64),
    barberName: String(input.barberName || 'Hassan ait boumlik').slice(0, 100),
    date: String(input.date).slice(0, 20),
    preferredTime: String(input.preferredTime || 'أي وقت').slice(0, 32),
    clientName: String(input.clientName).trim().slice(0, 120),
    clientPhone: String(input.clientPhone).trim().slice(0, 40),
    servicesSummary: String(input.servicesSummary || '').slice(0, 300),
    status: 'waiting',
    createdAt: new Date().toISOString().slice(0, 64),
  };

  const path = `${WAITLIST_COLLECTION}/${id}`;
  try {
    await setDoc(doc(db, WAITLIST_COLLECTION, id), entry);
    commitWaitlistCache([entry, ...cachedWaitlist.filter((w) => w.id !== id)], true);

    void dispatchStaffBackgroundPush({
      barberId: entry.barberId,
      eventType: 'waitlist_joined',
      url: '/#admin',
      tag: `sb-waitlist-${entry.id}`,
      title: 'Salon Boumlik • تسجيل جديد في قائمة الانتظار',
      body: `الزبون ${entry.clientName} انضم لقائمة الانتظار (${entry.barberName} • ${entry.date} ${entry.preferredTime}).`,
    });

    return entry;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWaitlistStatus(
  id: string,
  status: WaitlistStatus
): Promise<void> {
  const path = `${WAITLIST_COLLECTION}/${id}`;
  try {
    await updateDoc(doc(db, WAITLIST_COLLECTION, id), { status });
    commitWaitlistCache(
      cachedWaitlist.map((w) => (w.id === id ? { ...w, status } : w)),
      true
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWaitlistEntry(id: string): Promise<void> {
  const path = `${WAITLIST_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, WAITLIST_COLLECTION, id));
    commitWaitlistCache(
      cachedWaitlist.filter((w) => w.id !== id),
      true
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
