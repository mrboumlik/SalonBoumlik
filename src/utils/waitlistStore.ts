import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { WaitlistEntry, WaitlistStatus } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';

const WAITLIST_COLLECTION = 'waitlist';

let cachedWaitlist: WaitlistEntry[] = [];
let hasHydratedWaitlist = false;
const waitlistListeners = new Set<(entries: WaitlistEntry[]) => void>();
let activeWaitlistUnsubscribe: (() => void) | null = null;

function ensureWaitlistListener() {
  if (activeWaitlistUnsubscribe) return;

  const q = query(collection(db, WAITLIST_COLLECTION), orderBy('createdAt', 'desc'));
  activeWaitlistUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: WaitlistEntry[] = snapshot.docs.map((docSnap) => ({
        ...(docSnap.data() as WaitlistEntry),
        id: docSnap.id,
      }));
      cachedWaitlist = items;
      hasHydratedWaitlist = true;
      waitlistListeners.forEach((cb) => cb(items));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, WAITLIST_COLLECTION);
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
    if (waitlistListeners.size === 0 && activeWaitlistUnsubscribe) {
      activeWaitlistUnsubscribe();
      activeWaitlistUnsubscribe = null;
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
    cachedWaitlist = [entry, ...cachedWaitlist];
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
    cachedWaitlist = cachedWaitlist.map((w) => (w.id === id ? { ...w, status } : w));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWaitlistEntry(id: string): Promise<void> {
  const path = `${WAITLIST_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, WAITLIST_COLLECTION, id));
    cachedWaitlist = cachedWaitlist.filter((w) => w.id !== id);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
