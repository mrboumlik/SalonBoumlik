import React, { useState } from 'react';
import { Gift, Coins, CheckCircle2, Award } from 'lucide-react';
import { CrmClientProfile, Language } from '../types';
import {
  ClientLoyaltyPointsSummary,
  LoyaltyProgressState,
  POINTS_PER_VISIT,
} from '../utils/loyaltyEngine';
import { pickLang } from '../utils/i18n';

interface LoyaltyProgressCardProps {
  clientName?: string;
  crmProfile?: CrmClientProfile | null;
  loyaltyProgress: LoyaltyProgressState;
  pointsSummary: ClientLoyaltyPointsSummary;
  lang: Language;
}

type RingTargetMode = 'free_service' | 'discount_reward';

export const LoyaltyProgressCard: React.FC<LoyaltyProgressCardProps> = ({
  clientName,
  crmProfile,
  loyaltyProgress,
  pointsSummary,
  lang,
}) => {
  const [ringMode, setRingMode] = useState<RingTargetMode>('free_service');

  const langKey: 'ar' | 'fr' | 'en' | 'es' =
    lang === 'ar' || lang === 'en' || lang === 'es' ? lang : 'fr';

  // Free Service Target math: each milestone tier is 5 verified visits = 50 pts (10 pts / visit)
  const pointsPerServiceTier = loyaltyProgress.tierSize * POINTS_PER_VISIT; // 50 pts
  const earnedInCurrentServiceCycle = loyaltyProgress.justUnlockedMilestone
    ? pointsPerServiceTier
    : loyaltyProgress.stepsInCurrentBracket * POINTS_PER_VISIT;
  const pointsToNextFreeService = loyaltyProgress.justUnlockedMilestone
    ? 0
    : Math.max(0, loyaltyProgress.visitsRemaining * POINTS_PER_VISIT);
  const freeServicePct = loyaltyProgress.justUnlockedMilestone
    ? 100
    : Math.min(100, Math.round((earnedInCurrentServiceCycle / pointsPerServiceTier) * 100));

  // Discount Reward Target math from live Firebase points balance
  const nextRewardTier = pointsSummary.nextTier;
  const rewardCost = nextRewardTier?.pointsCost || 100;
  const rewardBalance = pointsSummary.pointsBalance;
  const pointsToNextDiscount = pointsSummary.pointsRemainingForNextTier;
  const discountRewardPct = pointsSummary.progressToNextTierPct;
  const allDiscountTiersUnlocked = nextRewardTier ? rewardBalance >= nextRewardTier.pointsCost : false;

  // Active circular ring metrics based on toggle
  const isFreeServiceMode = ringMode === 'free_service';
  const ringPct = isFreeServiceMode ? freeServicePct : discountRewardPct;
  const ringCurrent = isFreeServiceMode ? earnedInCurrentServiceCycle : rewardBalance;
  const ringTarget = isFreeServiceMode ? pointsPerServiceTier : rewardCost;
  const pointsRemaining = isFreeServiceMode ? pointsToNextFreeService : pointsToNextDiscount;
  const isGoalReached = pointsRemaining === 0;

  // SVG Circle geometry (crisp 124x124 viewBox)
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, ringPct)) / 100) * circumference;

  const targetRewardTitle = isFreeServiceMode
    ? loyaltyProgress.justUnlockedMilestone
      ? loyaltyProgress.justUnlockedRewardTitle || loyaltyProgress.nextRewardTitle
      : loyaltyProgress.nextRewardTitle
    : nextRewardTier
    ? `${nextRewardTier.label[langKey]} (-${nextRewardTier.discountMAD} MAD)`
    : '';

  const visitsEquivalent = Math.max(0, Math.ceil(pointsRemaining / POINTS_PER_VISIT));

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-stone-50 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-950 dark:to-black border border-amber-300 dark:border-amber-500/35 space-y-4">
      {/* Header + Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-stone-200 dark:border-zinc-800/90 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
              {pickLang(lang, {
                ar: 'تقدم الولاء • Loyalty Progress',
                fr: 'Progression Fidélité',
                amz: 'ⴰⵙⴰⵍⴰⵢ ⵏ ⵜⵏⴼⵍⵓⵙⵜ',
                en: 'Loyalty Progress',
                es: 'Progreso de Fidelidad',
              })}
            </h4>
          </div>
          <p className="text-[11px] text-stone-600 dark:text-zinc-400 mt-0.5 truncate">
            {clientName ? `${clientName} · ` : ''}
            {crmProfile?.isVip ? 'VIP · ' : ''}
            {pickLang(lang, {
              ar: `الرصيد الحالي: ${pointsSummary.pointsBalance} نقطة`,
              fr: `Solde actuel : ${pointsSummary.pointsBalance} pts`,
              amz: `ⵜⵉⵏⵇⵇⵉⴹⵉⵏ : ${pointsSummary.pointsBalance} pts`,
              en: `Current Balance: ${pointsSummary.pointsBalance} pts`,
              es: `Saldo actual: ${pointsSummary.pointsBalance} pts`,
            })}
          </p>
        </div>

        {/* Interactive Toggle: Free Service vs Discount Reward */}
        <div className="inline-flex rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-0.5 text-[11px] font-bold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setRingMode('free_service')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1 ${
              isFreeServiceMode
                ? 'bg-amber-500 text-black shadow-xs'
                : 'text-stone-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'خدمة مجانية',
                fr: 'Service Offert',
                amz: 'ⵜⴰⵏⴰⴼⵓⵜ ⴼⴰⴱⵓⵔ',
                en: 'Free Service',
                es: 'Servicio Gratis',
              })}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRingMode('discount_reward')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1 ${
              !isFreeServiceMode
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'خصم بالنقاط',
                fr: 'Remise Points',
                amz: 'ⴰⵙⵉⴷⵔ ⵙ ⵜⵏⵇⵇⵉⴹⵉⵏ',
                en: 'Points Reward',
                es: 'Descuento Puntos',
              })}
            </span>
          </button>
        </div>
      </div>

      {/* Circular Progress Bar + Next Reward Details */}
      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* SVG Circular Progress Ring */}
        <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
          <svg
            className="w-full h-full -rotate-90"
            viewBox="0 0 124 124"
            role="img"
            aria-label={`${ringPct}% loyalty progress toward ${targetRewardTitle}`}
          >
            <defs>
              <linearGradient id="loyaltyRingGradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
              <linearGradient id="loyaltyRingGradEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#34D399" />
              </linearGradient>
            </defs>

            {/* Track Circle */}
            <circle
              cx="62"
              cy="62"
              r={radius}
              fill="none"
              className="stroke-stone-200 dark:stroke-zinc-800"
              strokeWidth="10"
            />

            {/* Progress Arc */}
            <circle
              cx="62"
              cy="62"
              r={radius}
              fill="none"
              stroke={
                isGoalReached || !isFreeServiceMode
                  ? 'url(#loyaltyRingGradEmerald)'
                  : 'url(#loyaltyRingGradAmber)'
              }
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Center Numeric Metric inside Ring */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="font-mono font-black text-xl text-slate-900 dark:text-white tabular-nums leading-none">
              {ringPct}%
            </span>
            <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-1" dir="ltr">
              {ringCurrent} / {ringTarget}
            </span>
            <span className="text-[9px] text-stone-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
              {pickLang(lang, {
                ar: 'نقطة',
                fr: 'pts',
                amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ',
                en: 'pts',
                es: 'pts',
              })}
            </span>
          </div>
        </div>

        {/* Remaining Points & Next Free Service / Reward Explanation */}
        <div className="flex-1 min-w-0 text-center sm:text-start space-y-2.5">
          <div>
            <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 block">
              {isFreeServiceMode
                ? pickLang(lang, {
                    ar: `الخدمة المجانية التالية (المستوى ${loyaltyProgress.currentTierNumber}):`,
                    fr: `Prochain service offert (Palier ${loyaltyProgress.currentTierNumber}) :`,
                    amz: `ⵜⴰⵏⴰⴼⵓⵜ ⴼⴰⴱⵓⵔ ⵉⴷⴷⴰⵏ (ⴰⵙⵡⵉⵔ ${loyaltyProgress.currentTierNumber}) :`,
                    en: `Next Free Service (Tier ${loyaltyProgress.currentTierNumber}):`,
                    es: `Próximo servicio gratis (Nivel ${loyaltyProgress.currentTierNumber}):`,
                  })
                : pickLang(lang, {
                    ar: 'المكافأة القادمة لاستبدال النقاط:',
                    fr: 'Prochaine récompense échangeable :',
                    amz: 'ⵜⴰⵙⵎⵖⵓⵔⵜ ⵉⴷⴷⴰⵏ :',
                    en: 'Next Redeemable Reward Tier:',
                    es: 'Próxima recompensa canjeable:',
                  })}
            </span>

            <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-300 mt-0.5 break-words">
              {targetRewardTitle}
            </div>
          </div>

          {isGoalReached ? (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center sm:justify-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>
                {isFreeServiceMode
                  ? pickLang(lang, {
                      ar: 'مبروك! مكافأتك المجانية جاهزة للمطالبة في الصالون الآن.',
                      fr: 'Félicitations ! Votre service offert est débloqué !',
                      amz: 'ⵜⴰⵙⵎⵖⵓⵔⵜ ⵏⵏⴽ ⴼⴰⴱⵓⵔ ⵜⵡⵊⴷ ⵖⵉⵍⴰⴷ!',
                      en: 'Congrats! Your free service reward is unlocked and ready!',
                      es: '¡Felicidades! Tu servicio gratis está listo para reclamar.',
                    })
                  : allDiscountTiersUnlocked
                  ? pickLang(lang, {
                      ar: 'لديك نقاط كافية لفتح أعلى خصم (-70 MAD)! يمكنك الاستبدال الآن.',
                      fr: 'Tous les paliers débloqués ! Échangez votre remise ci-dessous.',
                      amz: 'ⵜⵉⵙⵎⵖⵓⵔⵉⵏ ⴰⴽⴽⵯ ⵕⵥⵎⵏⵜ (-70 MAD)!',
                      en: 'All discount tiers unlocked! Redeem your reward below.',
                      es: '¡Todos los descuentos desbloqueados! Canjea abajo.',
                    })
                  : pickLang(lang, {
                      ar: 'وصلت للهدف! يمكنك استبدال نقاطك الآن.',
                      fr: 'Objectif atteint ! Prêt à échanger.',
                      amz: 'ⵜⵓⵡⴹⴷ ⴰⵡⵜⵜⴰⵙ! ⵜⵥⴹⴰⵕⴷ ⴰⴷ ⵜⵙⵏⴼⵍⴷ ⵖⵉⵍⴰⴷ.',
                      en: 'Goal reached! Ready to redeem.',
                      es: '¡Meta alcanzada! Listo para canjear.',
                    })}
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/90 border border-stone-200 dark:border-zinc-800 space-y-1">
              <div className="text-xs font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {lang === 'ar' ? (
                  <>
                    متبقي{' '}
                    <span className="text-amber-700 dark:text-amber-400 text-sm">{pointsRemaining} نقطة</span>{' '}
                    للحصول على المكافأة
                  </>
                ) : lang === 'amz' ? (
                  <>
                    ⵉⵖⴰⵎⴰ{' '}
                    <span className="text-amber-700 dark:text-amber-400 text-sm">{pointsRemaining} pts</span>{' '}
                    ⵉ ⵜⵙⵎⵖⵓⵔⵜ
                  </>
                ) : lang === 'en' ? (
                  <>
                    <span className="text-amber-700 dark:text-amber-400 text-sm">{pointsRemaining} points</span>{' '}
                    until your next reward
                  </>
                ) : lang === 'es' ? (
                  <>
                    Faltan{' '}
                    <span className="text-amber-700 dark:text-amber-400 text-sm">{pointsRemaining} puntos</span>{' '}
                    para tu próxima recompensa
                  </>
                ) : (
                  <>
                    Plus que{' '}
                    <span className="text-amber-700 dark:text-amber-400 text-sm">{pointsRemaining} points</span>{' '}
                    avant votre récompense
                  </>
                )}
              </div>

              <div className="text-[11px] text-stone-600 dark:text-zinc-400">
                {pickLang(lang, {
                  ar: `يعادل ${visitsEquivalent} ${visitsEquivalent === 1 ? 'زيارة مؤكدة واحدة' : 'زيارات مؤكدة'} (+${POINTS_PER_VISIT} نقاط لكل زيارة)`,
                  fr: `Équivalent à ${visitsEquivalent} ${visitsEquivalent === 1 ? 'visite confirmée' : 'visites confirmées'} (+${POINTS_PER_VISIT} pts/visite)`,
                  amz: `ⵉⴳⴰ ⴰⵎ ${visitsEquivalent} ⵏ ⵜⵉⵔⵣⴰ (+${POINTS_PER_VISIT} pts/ⵜⵉⵔⵣⵉ)`,
                  en: `Equivalent to ${visitsEquivalent} verified ${visitsEquivalent === 1 ? 'visit' : 'visits'} (+${POINTS_PER_VISIT} pts/visit)`,
                  es: `Equivale a ${visitsEquivalent} ${visitsEquivalent === 1 ? 'visita verificada' : 'visitas verificadas'} (+${POINTS_PER_VISIT} pts/visita)`,
                })}
              </div>
            </div>
          )}

          {/* Clean unboxed Firebase telemetry metadata */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[10px] text-stone-500 dark:text-zinc-500 font-mono tabular-nums">
            <span>
              {pickLang(lang, {
                ar: `إجمالي المكتسب: ${pointsSummary.pointsEarnedTotal} نقطة`,
                fr: `Gagné : ${pointsSummary.pointsEarnedTotal} pts`,
                amz: `ⴰⴽⴽⵯ : ${pointsSummary.pointsEarnedTotal} pts`,
                en: `Earned: ${pointsSummary.pointsEarnedTotal} pts`,
                es: `Ganado: ${pointsSummary.pointsEarnedTotal} pts`,
              })}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {pickLang(lang, {
                ar: `زيارات مؤكدة: ${loyaltyProgress.verifiedVisits}`,
                fr: `Visites vérifiées : ${loyaltyProgress.verifiedVisits}`,
                amz: `ⵜⵉⵔⵣⵉⵡⵉⵏ : ${loyaltyProgress.verifiedVisits}`,
                en: `Verified visits: ${loyaltyProgress.verifiedVisits}`,
                es: `Visitas verificadas: ${loyaltyProgress.verifiedVisits}`,
              })}
            </span>
            {pointsSummary.activeDiscountMAD > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  -{pointsSummary.activeDiscountMAD} MAD{' '}
                  {pickLang(lang, {
                    ar: 'نشط',
                    fr: 'Actif',
                    amz: 'ⵉⵔⵎ',
                    en: 'Active',
                    es: 'Activo',
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
