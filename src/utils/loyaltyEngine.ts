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
