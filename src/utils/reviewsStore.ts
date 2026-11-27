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
import { INITIAL_REVIEWS, TEAM_MEMBERS } from '../data/barbershopData';
import { CustomerReview } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import { getActiveRosterBarbers } from './barberRosterStore';
import {
  emitRealtimeSyncHint,
  registerRealtimeRefreshHandler,
  resetResilientRetry,
  scheduleResilientRetry,
} from './realtimeSync';
import { asFiniteNum, asIsoString, asStr, safeCompareDesc } from './safeCoerce';
import { safeStorageGet, safeStorageSet } from './safeBrowser';
import { getTrustedNowDate } from './trustedTime';
import { dispatchStaffBackgroundPush } from './webPushClient';

const REVIEWS_COLLECTION = 'reviews';
export const LOCAL_REVIEWS_CACHE_KEY = 'salon_boumlik_reviews_v3';

export interface FirestoreReviewRecord {
  id: string;
  barberId: string;
  barberName: string;
  barberIds?: string[];
  barberNames?: string[];
  allBarbers?: boolean;
  isAnonymous?: boolean;
  author: string;
  city?: string;
  serviceName?: string;
  rating: number;
  comment: string;
  dateLabel?: string;
  bookingId?: string;
  verified: boolean;
  createdAt: string;
}

export interface BarberReviewStats {
  barberId: string;
  averageRating: number;
  reviewCount: number;
  hasReviews: boolean;
}

const SEED_REVIEWS: FirestoreReviewRecord[] = [
  {
    id: 'seed-rev-hassan-1',
    barberId: 'hassan',
    barberName: 'Hassan ait boumlik',
    barberIds: ['hassan'],
    barberNames: ['Hassan ait boumlik'],
    allBarbers: false,
    isAnonymous: false,
    author: 'Yassine El Amrani',
    city: 'Taroudant',
    serviceName: 'Coupe + Taille Barbe',
    rating: 5,
    comment:
      'Salon Boumlik est une référence à Taroudant. Hassan a un coup de ciseaux exceptionnel et un accueil chaleureux.',
    dateLabel: 'Vérifié',
    verified: true,
    createdAt: '2026-11-01T12:00:00.000Z',
  },
  {
    id: 'seed-rev-anouar-1',
    barberId: 'anouar-arif',
    barberName: 'Anouar arif',
    barberIds: ['anouar-arif'],
    barberNames: ['Anouar arif'],
    allBarbers: false,
    isAnonymous: false,
    author: 'Mohamed Tazi',
    city: 'Taroudant',
    serviceName: 'Coupe Dégradé',
    rating: 5,
    comment:
      'Anouar Arif est un maître du taper fade et des contours propres. Service rapide et ambiance agréable.',
    dateLabel: 'Vérifié',
    verified: true,
    createdAt: '2026-11-03T15:30:00.000Z',
  },
  {
    id: 'seed-rev-lahcen-1',
    barberId: 'lahcen-lhanz',
    barberName: 'Lahcen lhanz',
    barberIds: ['lahcen-lhanz'],
    barberNames: ['Lahcen lhanz'],
    allBarbers: false,
    isAnonymous: false,
    author: 'Soufiane Bensaïd',
    city: 'Taroudant',
    serviceName: 'Taille & Stylisme Barbe',
    rating: 5,
    comment:
      'Lahcen maîtrise parfaitement la taille de barbe à la vapeur et les coupes classiques aux ciseaux.',
    dateLabel: 'Vérifié',
    verified: true,
    createdAt: '2026-11-05T17:15:00.000Z',
  },
  {
    id: 'seed-rev-mounir-1',
    barberId: 'mounir-querdeny',
    barberName: 'Mounir querdeny',
    barberIds: ['mounir-querdeny'],
    barberNames: ['Mounir querdeny'],
    allBarbers: false,
    isAnonymous: false,
    author: 'Karim Oubaha',
    city: 'Taroudant',
    serviceName: 'Soin Protéine + Masque Noir',
    rating: 5,
    comment:
      'Soin protéine et masque noir avec Mounir. Résultat spectaculaire, cheveux doux et visage parfaitement nettoyé.',
    dateLabel: 'Vérifié',
    verified: true,
    createdAt: '2026-11-07T18:45:00.000Z',
  },
];

let cachedReviews: CustomerReview[] = [];
let hasHydratedReviews = false;
let hasSeenOrSeededReviews = false;
let seedInFlight: Promise<void> | null = null;
const reviewListeners = new Set<(items: CustomerReview[]) => void>();
let activeUnsubscribe: (() => void) | null = null;
let reviewsRefreshUnsub: (() => void) | null = null;

function sortReviewsDesc(list: CustomerReview[]): CustomerReview[] {
  return [...list].sort((a, b) => {
    const cmp = safeCompareDesc(a.createdAt, b.createdAt);
    if (cmp !== 0) return cmp;
    return safeCompareDesc(a.id, b.id);
  });
}

function commitReviewsCache(next: CustomerReview[], broadcastHint = false): void {
  cachedReviews = sortReviewsDesc(next);
  hasHydratedReviews = true;
  reviewListeners.forEach((cb) => {
    try {
      cb(cachedReviews);
    } catch (err) {
      console.warn('Reviews listener callback error:', err);
    }
  });
  if (broadcastHint) {
    emitRealtimeSyncHint('reviews');
  }
}

function mapDocToCustomerReview(docData: FirestoreReviewRecord): CustomerReview {
  const createdAt = asIsoString(docData.createdAt, '');
  const barberIds = Array.isArray(docData.barberIds)
    ? docData.barberIds.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : undefined;
  const barberNames = Array.isArray(docData.barberNames)
    ? docData.barberNames.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : undefined;
  const rawAuthor = asStr(docData.author, 'Client');
  const isAnonymous =
    Boolean(docData.isAnonymous) ||
    rawAuthor === 'بدون اسم' ||
    rawAuthor.toLowerCase() === 'anonyme' ||
    rawAuthor.toLowerCase() === 'anonymous';

  return {
    id: asStr(docData.id, ''),
    barberId: asStr(docData.barberId, 'hassan'),
    barberName: asStr(docData.barberName, 'Salon Boumlik'),
    barberIds,
    barberNames,
    allBarbers: Boolean(docData.allBarbers) || docData.barberId === 'all',
    isAnonymous,
    author: rawAuthor,
    city: asStr(docData.city, 'Taroudant') || 'Taroudant',
    serviceName: asStr(docData.serviceName, 'Coupe & Soin') || 'Coupe & Soin',
    rating: Math.max(1, Math.min(5, asFiniteNum(docData.rating, 5))),
    date: asStr(docData.dateLabel, '') || createdAt.slice(0, 10),
    comment: asStr(docData.comment, ''),
    bookingId: docData.bookingId ? asStr(docData.bookingId, '') : undefined,
    verified: Boolean(docData.verified),
    createdAt,
  };
}

function removeReviewFromLocalStorageCache(reviewId: string): void {
  try {
    const raw = safeStorageGet(LOCAL_REVIEWS_CACHE_KEY, 'local');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const filtered = parsed.filter((r: CustomerReview) => r && r.id !== reviewId);
    safeStorageSet(LOCAL_REVIEWS_CACHE_KEY, JSON.stringify(filtered), 'local');
  } catch {
    // ignore storage errors
  }
}

async function seedInitialReviewsIfEmpty() {
  if (seedInFlight || hasSeenOrSeededReviews) return seedInFlight;
  hasSeenOrSeededReviews = true;
  seedInFlight = (async () => {
    try {
      await Promise.all(
        SEED_REVIEWS.map((item) =>
          setDoc(doc(db, REVIEWS_COLLECTION, item.id), item)
        )
      );
    } catch (error) {
      console.warn('Review seed skipped or failed:', error);
    } finally {
      seedInFlight = null;
    }
  })();
  return seedInFlight;
}

function ensureReviewsListener() {
  if (!reviewsRefreshUnsub) {
    reviewsRefreshUnsub = registerRealtimeRefreshHandler(
      'reviews',
      'reviews',
      async () => {
        if (reviewListeners.size === 0) return;
        ensureReviewsListener();
        try {
          let snap;
          try {
            snap = await getDocsFromServer(collection(db, REVIEWS_COLLECTION));
          } catch {
            snap = await getDocs(collection(db, REVIEWS_COLLECTION));
          }
          if (snap.empty) {
            if (hasSeenOrSeededReviews) {
              commitReviewsCache([]);
            }
            return;
          }
          hasSeenOrSeededReviews = true;
          const next: CustomerReview[] = snap.docs.map((docSnap) => {
            const raw = docSnap.data() as FirestoreReviewRecord;
            return mapDocToCustomerReview({
              ...raw,
              id: raw.id || docSnap.id,
            });
          });
          commitReviewsCache(next);
        } catch (err) {
          console.warn('Reviews wake refresh warning:', err);
        }
      }
    );
  }
  if (activeUnsubscribe) return;

  activeUnsubscribe = onSnapshot(
    collection(db, REVIEWS_COLLECTION),
    (snapshot) => {
      resetResilientRetry('reviews');
      if (snapshot.empty) {
        if (!hasSeenOrSeededReviews) {
          void seedInitialReviewsIfEmpty();
        } else {
          commitReviewsCache([]);
        }
        return;
      }
      hasSeenOrSeededReviews = true;

      const next: CustomerReview[] = snapshot.docs.map((docSnap) => {
        const raw = docSnap.data() as FirestoreReviewRecord;
        return mapDocToCustomerReview({
          ...raw,
          id: raw.id || docSnap.id,
        });
      });

      commitReviewsCache(next);
    },
    (error) => {
      if (activeUnsubscribe) {
        try {
          activeUnsubscribe();
        } catch {
          // Ignore
        }
        activeUnsubscribe = null;
      }
      scheduleResilientRetry(
        'reviews',
        () => reviewListeners.size > 0,
        () => ensureReviewsListener(),
        error
      );
    }
  );
}

export function subscribeToFirestoreReviews(
  onData: (reviews: CustomerReview[]) => void
): () => void {
  reviewListeners.add(onData);
  ensureReviewsListener();

  if (hasHydratedReviews) {
    onData(cachedReviews);
  }

  return () => {
    reviewListeners.delete(onData);
    if (reviewListeners.size === 0) {
      resetResilientRetry('reviews');
      if (activeUnsubscribe) {
        activeUnsubscribe();
        activeUnsubscribe = null;
      }
      if (reviewsRefreshUnsub) {
        reviewsRefreshUnsub();
        reviewsRefreshUnsub = null;
      }
      hasHydratedReviews = false;
    }
  };
}

export function useFirestoreReviews(): {
  reviews: CustomerReview[];
  isLoading: boolean;
} {
  const [reviews, setReviews] = useState<CustomerReview[]>(cachedReviews);
  const [isLoading, setIsLoading] = useState<boolean>(!hasHydratedReviews);

  useEffect(() => {
    const unsub = subscribeToFirestoreReviews((items) => {
      setReviews(items);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  return { reviews, isLoading };
}

function resolveBarberSelection(input: {
  barberId?: string;
  barberIds?: string[];
  allBarbers?: boolean;
}): {
  primaryId: string;
  primaryName: string;
  resolvedIds: string[];
  resolvedNames: string[];
  isAllBarbers: boolean;
} {
  const activeRoster = getActiveRosterBarbers();
  const pool =
    activeRoster.length > 0
      ? activeRoster.map((m) => ({
          id: m.id,
          name: m.nameFr || m.nameAr || m.id,
        }))
      : TEAM_MEMBERS.map((b) => ({
          id: b.id,
          name: b.name.fr || b.name.ar || b.id,
        }));

  const rawRequested = Array.isArray(input.barberIds) && input.barberIds.length > 0
    ? input.barberIds
    : input.barberId
    ? [input.barberId]
    : [];

  const isAllExplicit = Boolean(input.allBarbers) || rawRequested.includes('all');

  const uniqueRequestedIds = Array.from(
    new Set(
      rawRequested
        .map((id) => String(id || '').trim())
        .filter((id) => id.length > 0 && id !== 'all')
    )
  ).slice(0, 12);

  let resolvedPairs = uniqueRequestedIds
    .map((id) => pool.find((p) => p.id === id) || TEAM_MEMBERS.find((b) => b.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      id: item.id,
      name:
        typeof item.name === 'string'
          ? item.name
          : item.name.fr || item.name.ar || item.id,
    }));

  if (isAllExplicit) {
    resolvedPairs = pool;
  }

  if (resolvedPairs.length === 0 && pool.length > 0) {
    resolvedPairs = [pool[0]];
  }

  const isAllBarbers =
    isAllExplicit ||
    (pool.length > 1 &&
      pool.every((p) => resolvedPairs.some((sel) => sel.id === p.id)));

  const resolvedIds = resolvedPairs.map((p) => p.id.slice(0, 64)).slice(0, 12);
  const resolvedNames = resolvedPairs.map((p) => p.name.slice(0, 100)).slice(0, 12);

  const primaryId = isAllBarbers ? 'all' : (resolvedIds[0] || 'hassan').slice(0, 64);
  const primaryName = isAllBarbers
    ? 'جميع الحلاقين · Salon Boumlik'
    : (resolvedNames.join(' · ') || 'Salon Boumlik').slice(0, 100);

  return {
    primaryId,
    primaryName,
    resolvedIds,
    resolvedNames,
    isAllBarbers,
  };
}

export async function submitBarberReview(input: {
  barberId?: string;
  barberIds?: string[];
  allBarbers?: boolean;
  isAnonymous?: boolean;
  author: string;
  city?: string;
  serviceName?: string;
  rating: number;
  comment: string;
  dateLabel?: string;
  bookingId?: string;
}): Promise<CustomerReview> {
  const selection = resolveBarberSelection({
    barberId: input.barberId,
    barberIds: input.barberIds,
    allBarbers: input.allBarbers,
  });

  const cleanAuthorInput = input.author.trim();
  const isAnonymous = Boolean(input.isAnonymous) || cleanAuthorInput.length === 0;
  const resolvedAuthor = (isAnonymous ? 'بدون اسم' : cleanAuthorInput).slice(0, 120);

  const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const createdAt = getTrustedNowDate().toISOString().slice(0, 64);
  const safeRating = Math.max(1, Math.min(5, Math.round(Number(input.rating) || 5)));
  const cleanComment = input.comment.trim().slice(0, 600);

  const payload: FirestoreReviewRecord = {
    id: cleanId,
    barberId: selection.primaryId,
    barberName: selection.primaryName,
    barberIds: selection.resolvedIds,
    barberNames: selection.resolvedNames,
    allBarbers: selection.isAllBarbers,
    isAnonymous,
    author: resolvedAuthor,
    rating: safeRating,
    comment: cleanComment,
    verified: true,
    createdAt,
  };

  if (input.city && input.city.trim()) {
    payload.city = input.city.trim().slice(0, 80);
  }
  if (input.serviceName && input.serviceName.trim()) {
    payload.serviceName = input.serviceName.trim().slice(0, 120);
  }
  if (input.dateLabel && input.dateLabel.trim()) {
    payload.dateLabel = input.dateLabel.trim().slice(0, 64);
  }
  if (input.bookingId && input.bookingId.trim()) {
    payload.bookingId = input.bookingId.trim().slice(0, 128);
  }

  const path = `${REVIEWS_COLLECTION}/${cleanId}`;
  try {
    await setDoc(doc(db, REVIEWS_COLLECTION, cleanId), payload);
    hasSeenOrSeededReviews = true;
    const mapped = mapDocToCustomerReview(payload);
    commitReviewsCache([mapped, ...cachedReviews.filter((r) => r.id !== mapped.id)], true);

    const previewText =
      cleanComment.length > 90 ? `${cleanComment.slice(0, 90)}…` : cleanComment;
    const barberSummary = selection.isAllBarbers
      ? 'جميع الحلاقين'
      : selection.resolvedNames.join('، ');
    void dispatchStaffBackgroundPush({
      masterOnly: true,
      eventType: 'new_review',
      title: `⭐ تقييم وتعليق جديد (${safeRating}/5) • صالون بومليك`,
      body: `${resolvedAuthor} (${barberSummary}): "${previewText}"`,
      url: '/#admin',
      tag: `sb-admin-review-${cleanId}`,
    });

    return mapped;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteBarberReview(reviewId: string): Promise<void> {
  const cleanId = String(reviewId || '').trim();
  if (!cleanId) return;
  const path = `${REVIEWS_COLLECTION}/${cleanId}`;
  try {
    await deleteDoc(doc(db, REVIEWS_COLLECTION, cleanId));
    hasSeenOrSeededReviews = true;
    removeReviewFromLocalStorageCache(cleanId);
    commitReviewsCache(
      cachedReviews.filter((r) => r.id !== cleanId),
      true
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function extractSearchableReviewText(rev: CustomerReview): string {
  const parts: string[] = [];
  if (rev.barberName) parts.push(rev.barberName);
  if (Array.isArray(rev.barberNames)) parts.push(...rev.barberNames);
  if (typeof rev.comment === 'string') {
    parts.push(rev.comment);
  } else if (rev.comment) {
    parts.push(rev.comment.fr || '', rev.comment.ar || '', rev.comment.en || '');
  }
  return parts.join(' ').toLowerCase();
}

export function reviewMatchesBarber(rev: CustomerReview, barberId: string): boolean {
  if (rev.allBarbers || rev.barberId === 'all') {
    return true;
  }
  if (Array.isArray(rev.barberIds) && rev.barberIds.length > 0) {
    return rev.barberIds.includes(barberId);
  }
  if (rev.barberId) {
    return rev.barberId === barberId;
  }
  return false;
}

export function computeBarberReviewStats(
  barberId: string,
  firestoreReviews: CustomerReview[],
  fallbackRating = 5.0
): BarberReviewStats {
  const rosterMember = getActiveRosterBarbers().find((m) => m.id === barberId);
  const barber = TEAM_MEMBERS.find((b) => b.id === barberId);
  const firstFrName = (rosterMember?.nameFr || barber?.name.fr || '').toLowerCase().split(' ')[0];
  const firstArName = (rosterMember?.nameAr || barber?.name.ar || '').toLowerCase().split(' ')[0];

  const sourcePool = firestoreReviews.length > 0 ? firestoreReviews : INITIAL_REVIEWS;

  const matched = sourcePool.filter((rev) => {
    if (
      rev.allBarbers ||
      rev.barberId === 'all' ||
      (Array.isArray(rev.barberIds) && rev.barberIds.length > 0) ||
      rev.barberId
    ) {
      return reviewMatchesBarber(rev, barberId);
    }
    const text = extractSearchableReviewText(rev);
    return (
      (firstFrName && text.includes(firstFrName)) ||
      (firstArName && text.includes(firstArName))
    );
  });

  if (matched.length === 0) {
    return {
      barberId,
      averageRating: Number(fallbackRating.toFixed(1)),
      reviewCount: 0,
      hasReviews: false,
    };
  }

  const sum = matched.reduce(
    (acc, rev) => acc + Math.max(1, Math.min(5, Number(rev.rating) || 5)),
    0
  );
  const avg = Number((sum / matched.length).toFixed(1));

  return {
    barberId,
    averageRating: avg,
    reviewCount: matched.length,
    hasReviews: true,
  };
}
