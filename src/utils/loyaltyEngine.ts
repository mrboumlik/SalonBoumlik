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
  stepsInCurrentBracket: number; // 0..4 (or 5 when showing completed milestone badge)
  displayBracketCount: number; // 0..4 for active bar, 5 when just unlocked on previous tier
  visitsRemaining: number;
  progressPercent: number;
  justUnlockedMilestone: number | null;
  unlockedCount: number;
  nextRewardTitle: string;
  justUnlockedRewardTitle: string | null;
  tiers: LoyaltyMilestoneTier[];
}

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
    if (lang === 'ar') return 'خصم 20 MAD + عناية بالوجه';
    if (lang === 'en') return '20 MAD Off + Facial Care';
    if (lang === 'es') return '20 MAD dto + Cuidado facial';
    if (lang === 'amz') return '20 MAD + ⴰⴼⵓⵍⴽⵉ ⵏ ⵓⴷⵎ';
    return 'Remise 20 MAD + Soin Visage';
  }

  if (tierIndex === 3) {
    if (lang === 'ar') return 'حلاقة ولحية VIP مجانية';
    if (lang === 'en') return 'Free VIP Haircut & Beard';
    if (lang === 'es') return 'Corte + Barba VIP gratis';
    if (lang === 'amz') return 'ⵜⴰⵎⴰⵔⵜ ⴷ ⵓⵣⵣⴰⵔ VIP ⴼⴰⴱⵓⵔ';
    return 'Coupe + Barbe VIP Offerte';
  }

  if (lang === 'ar') return `مكافأة VIP الذهبية (${targetVisits} زيارة)`;
  if (lang === 'en') return `VIP Gold Reward (${targetVisits} Visits)`;
  if (lang === 'es') return `Premio VIP Oro (${targetVisits} visitas)`;
  if (lang === 'amz') return `ⵜⴰⵙⵎⵖⵓⵔⵜ VIP (${targetVisits})`;
  return `Récompense VIP Or (${targetVisits} visites)`;
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
  const stepsInCurrentBracket = verifiedVisits - previousMilestone; // 0..4
  const justUnlockedMilestone =
    verifiedVisits > 0 && verifiedVisits % tierSize === 0 ? verifiedVisits : null;
  const visitsRemaining = nextMilestone - verifiedVisits; // 1..5
  const unlockedCount = Math.floor(verifiedVisits / tierSize);

  // When a client hits 5, 10, 15..., show full 5/5 bar on the milestone card if > 0 & % 5 === 0
  // while clearly presenting the next milestone target (10, 15, 20...)
  const displayBracketCount = justUnlockedMilestone ? tierSize : stepsInCurrentBracket;
  const progressPercent = Math.round((stepsInCurrentBracket / tierSize) * 100);

  // Build visible milestone badges dynamically: always at least [5, 10, 15], expanding cleanly as client climbs
  const maxVisibleTierCount = Math.max(3, currentTierNumber + 1);
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

export const POINTS_PER_VISIT = 10;

export interface LoyaltyPointRewardTier {
  id: string;
  pointsCost: number;
  discountMAD: number;
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

export const LOYALTY_POINT_TIERS: LoyaltyPointRewardTier[] = [
  {
    id: 'tier-10mad',
    pointsCost: 20,
    discountMAD: 10,
    label: {
      ar: 'خصم 10 دراهم',
      fr: 'Remise 10 MAD',
      en: '10 MAD Discount',
      es: '10 MAD dto.',
      amz: 'ⴰⵙⵙⵏⵇⵙ 10 MAD',
    },
    description: {
      ar: 'صالح لأي خدمة في زيارتك القادمة',
      fr: 'Valable sur toute prestation',
      en: 'Valid on any future service',
      es: 'Válido en cualquier servicio',
      amz: 'ⵉⵖⵓⴷⴰ ⵉ ⴽⵓ ⵜⴰⵡⵓⵔⵉ ⵉⴷⴷⴰⵏ',
    },
  },
  {
    id: 'tier-30mad',
    pointsCost: 50,
    discountMAD: 30,
    label: {
      ar: 'خصم 30 درهم',
      fr: 'Remise 30 MAD',
      en: '30 MAD Discount',
      es: '30 MAD dto.',
      amz: 'ⴰⵙⵙⵏⵇⵙ 30 MAD',
    },
    description: {
      ar: 'تخفيض مميز على الحلاقة أو العناية',
      fr: 'Réduction coupe ou soin',
      en: 'Discount on haircut or care',
      es: 'Descuento en corte o cuidado',
      amz: 'ⴰⵙⵙⵏⵇⵙ ⵉⵥⵍⵉⵏ ⵖⴼ ⵜⴽⵔⴹⴰ',
    },
  },
  {
    id: 'tier-70mad',
    pointsCost: 100,
    discountMAD: 70,
    label: {
      ar: 'خصم VIP بقيمة 70 درهم',
      fr: 'Remise VIP 70 MAD',
      en: '70 MAD VIP Discount',
      es: '70 MAD dto. VIP',
      amz: 'ⴰⵙⵙⵏⵇⵙ VIP 70 MAD',
    },
    description: {
      ar: 'يغطي باقة الحلاقة واللحية الكاملة',
      fr: 'Couvre un forfait coupe + barbe',
      en: 'Covers full haircut & beard combo',
      es: 'Cubre combo completo corte + barba',
      amz: 'ⵉⵎⵎⴰⴳⵔ ⵜⴰⴽⵔⴹⴰ + ⵜⴰⵎⴰⵔⵜ',
    },
  },
];

export interface ClientLoyaltyPointsSummary {
  pointsBalance: number;
  pointsEarnedTotal: number;
  pointsRedeemedTotal: number;
  activeDiscountMAD: number;
  pointsPerVisit: number;
  nextTier: LoyaltyPointRewardTier | null;
  pointsRemainingForNextTier: number;
  progressToNextTierPct: number;
  canRedeemAny: boolean;
}

export function computeClientPointsSummary(
  verifiedVisits: number,
  crmProfile?: CrmClientProfile | null
): ClientLoyaltyPointsSummary {
  const safeVisits = Math.max(0, Math.floor(verifiedVisits || 0));
  const baselineEarned = safeVisits * POINTS_PER_VISIT;
  const storedEarned = typeof crmProfile?.pointsEarnedTotal === 'number' ? crmProfile.pointsEarnedTotal : 0;
  const storedRedeemed = typeof crmProfile?.pointsRedeemedTotal === 'number' ? crmProfile.pointsRedeemedTotal : 0;

  const pointsEarnedTotal = Math.max(storedEarned, baselineEarned);
  const pointsRedeemedTotal = Math.max(0, storedRedeemed);

  let pointsBalance: number;
  if (typeof crmProfile?.loyaltyPoints === 'number') {
    // Include any un-synced completed booking visits beyond storedEarned
    const extraEarned = Math.max(0, baselineEarned - storedEarned);
    pointsBalance = Math.max(0, Math.round(crmProfile.loyaltyPoints + extraEarned));
  } else {
    pointsBalance = Math.max(0, pointsEarnedTotal - pointsRedeemedTotal);
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
    pointsRedeemedTotal,
    activeDiscountMAD: Math.max(0, crmProfile?.customDiscountMAD ?? 0),
    pointsPerVisit: POINTS_PER_VISIT,
    nextTier,
    pointsRemainingForNextTier,
    progressToNextTierPct,
    canRedeemAny,
  };
}

