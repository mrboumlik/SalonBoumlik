import { useEffect, useState } from 'react';
import {
  collection,
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

const REVIEWS_COLLECTION = 'reviews';

export interface FirestoreReviewRecord {
  id: string;
  barberId: string;
  barberName: string;
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
  return {
    id: asStr(docData.id, ''),
    barberId: asStr(docData.barberId, 'hassan'),
    barberName: asStr(docData.barberName, 'Salon Boumlik'),
    author: asStr(docData.author, 'Client'),
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

async function seedInitialReviewsIfEmpty() {
  if (seedInFlight) return seedInFlight;
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
          if (snap.empty) return;
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
        void seedInitialReviewsIfEmpty();
        return;
      }

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

export async function submitBarberReview(input: {
  barberId: string;
  author: string;
  city?: string;
  serviceName?: string;
  rating: number;
  comment: string;
  dateLabel?: string;
  bookingId?: string;
}): Promise<CustomerReview> {
  const rosterMember = getActiveRosterBarbers().find((m) => m.id === input.barberId);
  const staticBarber = TEAM_MEMBERS.find((b) => b.id === input.barberId) || TEAM_MEMBERS[0];
  const resolvedBarberId = rosterMember?.id || staticBarber.id;
  const resolvedBarberName =
    rosterMember?.nameFr || rosterMember?.nameAr || staticBarber.name.fr || staticBarber.name.ar;
  const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const createdAt = new Date().toISOString().slice(0, 64);

  const payload: FirestoreReviewRecord = {
    id: cleanId,
    barberId: resolvedBarberId.slice(0, 64),
    barberName: resolvedBarberName.slice(0, 100),
    author: input.author.trim().slice(0, 120),
    rating: Math.max(1, Math.min(5, Math.round(Number(input.rating) || 5))),
    comment: input.comment.trim().slice(0, 600),
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
    const mapped = mapDocToCustomerReview(payload);
    commitReviewsCache([mapped, ...cachedReviews.filter((r) => r.id !== mapped.id)], true);
    return mapped;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

function extractSearchableReviewText(rev: CustomerReview): string {
  const parts: string[] = [];
  if (rev.barberName) parts.push(rev.barberName);
  if (typeof rev.comment === 'string') {
    parts.push(rev.comment);
  } else if (rev.comment) {
    parts.push(rev.comment.fr || '', rev.comment.ar || '', rev.comment.en || '');
  }
  return parts.join(' ').toLowerCase();
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
    if (rev.barberId) {
      return rev.barberId === barberId;
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
