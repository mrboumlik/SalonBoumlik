import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { INITIAL_REVIEWS, TEAM_MEMBERS } from '../data/barbershopData';
import { CustomerReview } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';

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

function mapDocToCustomerReview(docData: FirestoreReviewRecord): CustomerReview {
  return {
    id: docData.id,
    barberId: docData.barberId,
    barberName: docData.barberName,
    author: docData.author,
    city: docData.city || 'Taroudant',
    serviceName: docData.serviceName || 'Coupe & Soin',
    rating: Math.max(1, Math.min(5, Number(docData.rating) || 5)),
    date: docData.dateLabel || docData.createdAt.slice(0, 10),
    comment: docData.comment,
    verified: Boolean(docData.verified),
    createdAt: docData.createdAt,
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
      handleFirestoreError(error, OperationType.WRITE, REVIEWS_COLLECTION);
    } finally {
      seedInFlight = null;
    }
  })();
  return seedInFlight;
}

function ensureReviewsListener() {
  if (activeUnsubscribe) return;

  const q = query(collection(db, REVIEWS_COLLECTION), orderBy('createdAt', 'desc'));
  activeUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
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

      cachedReviews = next;
      hasHydratedReviews = true;
      reviewListeners.forEach((cb) => cb(next));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, REVIEWS_COLLECTION);
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
    if (reviewListeners.size === 0 && activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
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
}): Promise<CustomerReview> {
  const barber = TEAM_MEMBERS.find((b) => b.id === input.barberId) || TEAM_MEMBERS[0];
  const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const createdAt = new Date().toISOString().slice(0, 64);

  const payload: FirestoreReviewRecord = {
    id: cleanId,
    barberId: barber.id.slice(0, 64),
    barberName: (barber.name.fr || barber.name.ar).slice(0, 100),
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

  const path = `${REVIEWS_COLLECTION}/${cleanId}`;
  try {
    await setDoc(doc(db, REVIEWS_COLLECTION, cleanId), payload);
    const mapped = mapDocToCustomerReview(payload);
    cachedReviews = [mapped, ...cachedReviews.filter((r) => r.id !== mapped.id)];
    hasHydratedReviews = true;
    reviewListeners.forEach((cb) => cb(cachedReviews));
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
  const barber = TEAM_MEMBERS.find((b) => b.id === barberId);
  const firstFrName = (barber?.name.fr || '').toLowerCase().split(' ')[0];
  const firstArName = (barber?.name.ar || '').toLowerCase().split(' ')[0];

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
