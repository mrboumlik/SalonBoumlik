import { AppointmentBooking, CrmClientProfile, Language } from '../types';

export interface LoyaltyMilestoneTier {
  targetVisits: number;
  tierNumber: number;
  unlocked: boolean;
  isCurrentTarget: boolean;
  rewardTitle: string;
}

export interface LoyaltyProgressState {
  verifiedVisits: number;
  tierSize: number;
  currentTierNumber: number;
  previousMilestone: number;
  nextMilestone: number;
  stepsInCurrentBracket: number;
  displayBracketCount: number;
  visitsRemaining: number;
  progressPercent: number;
  justUnlockedMilestone: number | null;
  unlockedCount: number;
  nextRewardTitle: string;
  justUnlockedRewardTitle: string | null;
  tiers: LoyaltyMilestoneTier[];
}

export const DEFAULT_FALLBACK_POINTS_PER_VISIT = 5;

/**
 * Service-specific loyalty points table calibrated to Salon Boumlik Taroudant margins.
 * Lighter/fast services earn fewer points; standard haircuts earn moderate points;
 * high-value treatments earn higher points.
 */
export const SERVICE_LOYALTY_POINTS: Record<string, number> = {
  wash: 3,
  'black-mask': 3,
  waxing: 3,
  blowout: 3,
  beard: 4,
  'face-mask': 4,
  'black-dye': 4,
  haircut: 6,
  'face-scrub': 6,
  straightening: 8,
  'hair-color': 10,
  protein: 18,
};

export interface BookingLoyaltyPointsBreakdown {
  points: number;
  breakdown: Array<{
    serviceId: string;
    name: string;
    points: number;
  }>;
}

/**
 * Computes loyalty points earned for a single confirmed visit based strictly on
 * the actual services chosen (and price tier for variable services like color/protein).
 */
export function computeBookingLoyaltyPoints(
  booking?: Partial<AppointmentBooking> | null
): BookingLoyaltyPointsBreakdown {
  if (!booking) {
    return { points: DEFAULT_FALLBACK_POINTS_PER_VISIT, breakdown: [] };
  }

  const items = Array.isArray(booking.cartItemsSummary) ? booking.cartItemsSummary : [];
  if (items.length > 0) {
    const breakdown: BookingLoyaltyPointsBreakdown['breakdown'] = [];
    let sum = 0;

    for (const item of items) {
      const id = String(item.serviceId || '').trim();
      let pts = SERVICE_LOYALTY_POINTS[id] ?? 0;

      if (id === 'protein') {
        const price = Number(item.finalPrice || item.originalPrice || 200);
        pts = price >= 300 ? 22 : price >= 250 ? 20 : 18;
      } else if (id === 'hair-color') {
        const price = Number(item.finalPrice || item.originalPrice || 100);
        pts = price >= 140 ? 14 : price >= 100 ? 11 : 8;
      } else if (pts === 0) {
        const price = Number(item.finalPrice || item.originalPrice || 0);
        pts = price > 0 ? Math.max(2, Math.min(18, Math.round(price / 5))) : 4;
      }

      sum += pts;
      breakdown.push({
        serviceId: id,
        name: item.name || id,
        points: pts,
      });
    }

    return {
      points: Math.max(3, Math.min(35, sum)),
      breakdown,
    };
  }

  const totalMAD = Number(booking.finalTotalMAD || 0);
  if (totalMAD > 0) {
    return {
      points: Math.max(3, Math.min(25, Math.round(totalMAD / 5))),
      breakdown: [],
    };
  }

  return { points: DEFAULT_FALLBACK_POINTS_PER_VISIT, breakdown: [] };
}

/**
 * Profit-safe progressive visit milestone rewards starting after 5 confirmed visits.
 * Tier 1 (5 visits): Free Hair Wash
 * Tier 2 (10 visits): Free Facial Mask
 * Tier 3 (15 visits): 5 MAD Discount
 * Tier 4+ (20+ visits): 10 MAD VIP Discount
 */
export function getMilestoneRewardLabel(targetVisits: number, lang: Language = 'ar'): string {
  const tierIndex = Math.max(1, Math.round(targetVisits / 5));

  if (tierIndex === 1) {
    if (lang === 'ar') return 'غسل شعر مجاني';
    if (lang === 'en') return 'Free Hair Wash';
    if (lang === 'es') return 'Lavado de cabello gratis';
    if (lang === 'amz') return 'ⴰⵙⵉⵔⴷ ⵏ ⵓⵣⵣⴰⵔ ⴼⴰⴱⵓⵔ';
    return 'Shampoing Gratuit';
  }

  if (tierIndex === 2) {
    if (lang === 'ar') return 'ماسك للوجه مجاني';
    if (lang === 'en') return 'Free Facial Mask';
    if (lang === 'es') return 'Mascarilla facial gratis';
    if (lang === 'amz') return 'ⴰⵎⴰⵙⴽ ⵏ ⵓⴷⵎ ⴼⴰⴱⵓⵔ';
    return 'Masque Visage Gratuit';
  }

  if (tierIndex === 3) {
    if (lang === 'ar') return 'تخفيض 5 دراهم';
    if (lang === 'en') return '5 MAD Discount';
    if (lang === 'es') return '5 MAD de descuento';
    if (lang === 'amz') return 'ⴰⵙⵙⵏⵇⵙ 5 MAD';
    return 'Remise 5 MAD';
  }

  if (lang === 'ar') return `تخفيض 10 دراهم VIP (${targetVisits} زيارة)`;
  if (lang === 'en') return `10 MAD VIP Discount (${targetVisits} Visits)`;
  if (lang === 'es') return `10 MAD dto. VIP (${targetVisits} visitas)`;
  if (lang === 'amz') return `ⴰⵙⵙⵏⵇⵙ VIP 10 MAD (${targetVisits})`;
  return `Remise VIP 10 MAD (${targetVisits} visites)`;
}

/**
 * Computes strictly verified attendance visits count.
 * Pending, confirmed (not yet attended), cancelled, rejected, and no_show bookings
 * NEVER contribute to loyalty progress.
 */
export function getVerifiedVisitsCount(
  clientBookings: AppointmentBooking[],
  crmProfile?: CrmClientProfile | null
): number {
  const completedBookingsCount = clientBookings.filter((b) => b.status === 'completed').length;
  const storedVerified = typeof crmProfile?.verifiedVisits === 'number' ? crmProfile.verifiedVisits : 0;
  return Math.max(0, Math.max(storedVerified, completedBookingsCount));
}

/**
 * Multi-tier dynamic loyalty progress calculation (5, 10, 15, 20, ...)
 * Driven exclusively by verified attended visits.
 */
export function computeLoyaltyProgress(
  verifiedVisitsInput: number,
  lang: Language = 'ar'
): LoyaltyProgressState {
  const verifiedVisits = Math.max(0, Math.floor(verifiedVisitsInput || 0));
  const tierSize = 5;
  const currentTierNumber = Math.floor(verifiedVisits / tierSize) + 1;
  const previousMilestone = (currentTierNumber - 1) * tierSize;
  const nextMilestone = currentTierNumber * tierSize;
  const stepsInCurrentBracket = verifiedVisits - previousMilestone;
  const justUnlockedMilestone =
    verifiedVisits > 0 && verifiedVisits % tierSize === 0 ? verifiedVisits : null;
  const visitsRemaining = nextMilestone - verifiedVisits;
  const unlockedCount = Math.floor(verifiedVisits / tierSize);

  const displayBracketCount = justUnlockedMilestone ? tierSize : stepsInCurrentBracket;
  const progressPercent = Math.round((stepsInCurrentBracket / tierSize) * 100);

  // Show [5, 10, 15, 20] dynamically as client advances
  const maxVisibleTierCount = Math.max(4, currentTierNumber + 1);
  const tiers: LoyaltyMilestoneTier[] = Array.from({ length: maxVisibleTierCount }, (_, idx) => {
    const tierNumber = idx + 1;
    const targetVisits = tierNumber * tierSize;
    return {
      targetVisits,
      tierNumber,
      unlocked: verifiedVisits >= targetVisits,
      isCurrentTarget: targetVisits === nextMilestone,
      rewardTitle: getMilestoneRewardLabel(targetVisits, lang),
    };
  });

  return {
    verifiedVisits,
    tierSize,
    currentTierNumber,
    previousMilestone,
    nextMilestone,
    stepsInCurrentBracket,
    displayBracketCount,
    visitsRemaining,
    progressPercent,
    justUnlockedMilestone,
    unlockedCount,
    nextRewardTitle: getMilestoneRewardLabel(nextMilestone, lang),
    justUnlockedRewardTitle: justUnlockedMilestone
      ? getMilestoneRewardLabel(justUnlockedMilestone, lang)
      : null,
    tiers,
  };
}

export type LoyaltyPointRewardKind = 'free_wash' | 'free_mask' | 'discount';

export interface LoyaltyPointRewardTier {
  id: string;
  pointsCost: number;
  discountMAD: number;
  rewardKind: LoyaltyPointRewardKind;
  label: {
    ar: string;
    fr: string;
    en: string;
    es: string;
    amz?: string;
  };
  description: {
    ar: string;
    fr: string;
    en: string;
    es: string;
    amz?: string;
  };
}

/**
 * Progressive, profit-safe point redemption tiers calibrated to ~25 MAD haircuts
 * and 3-22 pts earned per confirmed visit:
 * 35 pts -> Free Hair Wash
 * 60 pts -> Free Facial Mask
 * 85 pts -> 5 MAD Discount
 * 130 pts -> 10 MAD VIP Discount
 */
export const LOYALTY_POINT_TIERS: LoyaltyPointRewardTier[] = [
  {
    id: 'tier-free-wash',
    pointsCost: 35,
    discountMAD: 0,
    rewardKind: 'free_wash',
    label: {
      ar: 'غسل شعر مجاني',
      fr: 'Shampoing Gratuit',
      en: 'Free Hair Wash',
      es: 'Lavado Gratis',
      amz: 'ⴰⵙⵉⵔⴷ ⵏ ⵓⵣⵣⴰⵔ ⴼⴰⴱⵓⵔ',
    },
    description: {
      ar: 'مكافأة بعد 5+ زيارات مؤكدة تقريباً',
      fr: 'Débloqué après ~5+ visites confirmées',
      en: 'Unlocked after ~5+ verified visits',
      es: 'Tras ~5+ visitas verificadas',
      amz: 'ⴷⴼⴼⵉⵔ 5+ ⵜⵉⵔⵣⵉⵡⵉⵏ',
    },
  },
  {
    id: 'tier-free-mask',
    pointsCost: 60,
    discountMAD: 0,
    rewardKind: 'free_mask',
    label: {
      ar: 'ماسك للوجه مجاني',
      fr: 'Masque Visage Gratuit',
      en: 'Free Facial Mask',
      es: 'Mascarilla Gratis',
      amz: 'ⴰⵎⴰⵙⴽ ⵏ ⵓⴷⵎ ⴼⴰⴱⵓⵔ',
    },
    description: {
      ar: 'قناع عناية منعش مجاناً في زيارتك القادمة',
      fr: 'Soin masque offert lors de votre visite',
      en: 'Complimentary refreshing facial mask',
      es: 'Mascarilla facial gratis en tu visita',
      amz: 'ⴰⵎⴰⵙⴽ ⴼⴰⴱⵓⵔ ⵉ ⵓⴷⵎ',
    },
  },
  {
    id: 'tier-5mad',
    pointsCost: 85,
    discountMAD: 5,
    rewardKind: 'discount',
    label: {
      ar: 'تخفيض 5 دراهم',
      fr: 'Remise 5 MAD',
      en: '5 MAD Discount',
      es: '5 MAD dto.',
      amz: 'ⴰⵙⵙⵏⵇⵙ 5 MAD',
    },
    description: {
      ar: 'يُخصم تلقائياً من مجموع حجزك القادم',
      fr: 'Déduit automatiquement de votre prochain RDV',
      en: 'Auto-applied on your next booking total',
      es: 'Aplicado automáticamente en tu próxima cita',
      amz: 'ⵉⵜⵜⵓⵙⵎⵔⵙ ⴳ ⵓⵙⵉⵀⵍ ⵉⴷⴷⴰⵏ',
    },
  },
  {
    id: 'tier-10mad',
    pointsCost: 130,
    discountMAD: 10,
    rewardKind: 'discount',
    label: {
      ar: 'تخفيض 10 دراهم VIP',
      fr: 'Remise VIP 10 MAD',
      en: '10 MAD VIP Discount',
      es: '10 MAD dto. VIP',
      amz: 'ⴰⵙⵙⵏⵇⵙ VIP 10 MAD',
    },
    description: {
      ar: 'مكافأة الولاء المتقدمة للزبناء الدائمين',
      fr: 'Récompense fidélité avancée',
      en: 'Top-tier reward for loyal regular clients',
      es: 'Recompensa VIP para clientes habituales',
      amz: 'ⵜⴰⵙⵎⵖⵓⵔⵜ VIP ⵉ ⵉⵎⵙⴰⵖⵏ ⵉⵇⴱⵓⵔⵏ',
    },
  },
];

export interface ClientLoyaltyPointsSummary {
  pointsBalance: number;
  pointsEarnedTotal: number;
  pointsRedeemedTotal: number;
  activeDiscountMAD: number;
  nextTier: LoyaltyPointRewardTier | null;
  pointsRemainingForNextTier: number;
  progressToNextTierPct: number;
  canRedeemAny: boolean;
}

export function computeClientPointsSummary(
  verifiedVisits: number,
  crmProfile?: CrmClientProfile | null,
  clientBookings?: AppointmentBooking[]
): ClientLoyaltyPointsSummary {
  const safeVisits = Math.max(0, Math.floor(verifiedVisits || 0));
  const storedRedeemed =
    typeof crmProfile?.pointsRedeemedTotal === 'number'
      ? Math.max(0, crmProfile.pointsRedeemedTotal)
      : 0;
  const hasStoredPoints =
    typeof crmProfile?.loyaltyPoints === 'number' ||
    typeof crmProfile?.pointsEarnedTotal === 'number';

  let pointsEarnedTotal: number;
  let pointsBalance: number;

  if (hasStoredPoints) {
    const storedBalance =
      typeof crmProfile?.loyaltyPoints === 'number'
        ? Math.max(0, Math.round(crmProfile.loyaltyPoints))
        : 0;
    const storedEarned =
      typeof crmProfile?.pointsEarnedTotal === 'number'
        ? Math.max(0, Math.round(crmProfile.pointsEarnedTotal))
        : storedBalance + storedRedeemed;

    pointsBalance = storedBalance;
    pointsEarnedTotal = Math.max(storedEarned, storedBalance + storedRedeemed);
  } else {
    const completedList = (clientBookings || []).filter((b) => b.status === 'completed');
    const estimatedFromBookings =
      completedList.length > 0
        ? completedList.reduce((sum, b) => sum + computeBookingLoyaltyPoints(b).points, 0)
        : 0;
    const unrecordedVisits = Math.max(0, safeVisits - completedList.length);
    const baselineEarned =
      estimatedFromBookings + unrecordedVisits * DEFAULT_FALLBACK_POINTS_PER_VISIT;

    pointsEarnedTotal = Math.max(0, baselineEarned);
    pointsBalance = Math.max(0, pointsEarnedTotal - storedRedeemed);
  }

  const nextTier =
    LOYALTY_POINT_TIERS.find((t) => pointsBalance < t.pointsCost) ||
    LOYALTY_POINT_TIERS[LOYALTY_POINT_TIERS.length - 1];

  const pointsRemainingForNextTier = Math.max(0, nextTier.pointsCost - pointsBalance);
  const progressToNextTierPct = Math.min(
    100,
    Math.round((pointsBalance / nextTier.pointsCost) * 100)
  );
  const canRedeemAny = LOYALTY_POINT_TIERS.some((t) => pointsBalance >= t.pointsCost);

  return {
    pointsBalance,
    pointsEarnedTotal,
    pointsRedeemedTotal: storedRedeemed,
    activeDiscountMAD: Math.max(0, crmProfile?.customDiscountMAD ?? 0),
    nextTier,
    pointsRemainingForNextTier,
    progressToNextTierPct,
    canRedeemAny,
  };
}
