import React, { useState } from 'react';
import { Gift, Coins, CheckCircle2, Award } from 'lucide-react';
import { CrmClientProfile, Language } from '../types';
import {
  ClientLoyaltyPointsSummary,
  LoyaltyProgressState,
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

  // Free Service / Visit Milestone Target math (5 confirmed visits per progressive bracket)
  const visitTierTarget = loyaltyProgress.tierSize; // 5 visits
  const visitsInCurrentCycle = loyaltyProgress.justUnlockedMilestone
    ? visitTierTarget
    : loyaltyProgress.stepsInCurrentBracket;
  const visitsRemainingToMilestone = loyaltyProgress.justUnlockedMilestone
    ? 0
    : Math.max(0, loyaltyProgress.visitsRemaining);
  const freeServicePct = loyaltyProgress.justUnlockedMilestone
    ? 100
    : Math.min(100, Math.round((visitsInCurrentCycle / visitTierTarget) * 100));

  // Points Reward Target math from live Firebase points balance
  const nextRewardTier = pointsSummary.nextTier;
  const rewardCost = nextRewardTier?.pointsCost || 35;
  const rewardBalance = pointsSummary.pointsBalance;
  const pointsToNextDiscount = pointsSummary.pointsRemainingForNextTier;
  const discountRewardPct = pointsSummary.progressToNextTierPct;
  const allDiscountTiersUnlocked = nextRewardTier ? rewardBalance >= nextRewardTier.pointsCost : false;

  // Active circular ring metrics based on toggle
  const isFreeServiceMode = ringMode === 'free_service';
  const ringPct = isFreeServiceMode ? freeServicePct : discountRewardPct;
  const ringCurrent = isFreeServiceMode ? visitsInCurrentCycle : rewardBalance;
  const ringTarget = isFreeServiceMode ? visitTierTarget : rewardCost;
  const remainingCount = isFreeServiceMode ? visitsRemainingToMilestone : pointsToNextDiscount;
  const isGoalReached = remainingCount === 0;

  // SVG Circle geometry (crisp 124x124 viewBox)
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, ringPct)) / 100) * circumference;

  const targetRewardTitle = isFreeServiceMode
    ? loyaltyProgress.justUnlockedMilestone
      ? loyaltyProgress.justUnlockedRewardTitle || loyaltyProgress.nextRewardTitle
      : loyaltyProgress.nextRewardTitle
    : nextRewardTier
    ? nextRewardTier.discountMAD > 0
      ? `${nextRewardTier.label[langKey]} (-${nextRewardTier.discountMAD} MAD)`
      : nextRewardTier.label[langKey]
    : '';

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

        {/* Interactive Toggle: Visit Milestone vs Points Reward */}
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
                ar: 'مكافأة الزيارات',
                fr: 'Paliers Visites',
                amz: 'ⵜⵉⵔⵣⵉⵡⵉⵏ',
                en: 'Visit Milestones',
                es: 'Premios Visitas',
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
                ar: 'مكافآت النقاط',
                fr: 'Remise Points',
                amz: 'ⴰⵙⵉⴷⵔ ⵙ ⵜⵏⵇⵇⵉⴹⵉⵏ',
                en: 'Points Rewards',
                es: 'Premios Puntos',
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
              {isFreeServiceMode
                ? pickLang(lang, {
                    ar: 'زيارات',
                    fr: 'visites',
                    amz: 'ⵜⵉⵔⵣⴰ',
                    en: 'visits',
                    es: 'visitas',
                  })
                : pickLang(lang, {
                    ar: 'نقطة',
                    fr: 'pts',
                    amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ',
                    en: 'pts',
                    es: 'pts',
                  })}
            </span>
          </div>
        </div>

        {/* Remaining Visits / Points & Next Reward Explanation */}
        <div className="flex-1 min-w-0 text-center sm:text-start space-y-2.5">
          <div>
            <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 block">
              {isFreeServiceMode
                ? pickLang(lang, {
                    ar: `المكافأة التالية (الزيارة ${loyaltyProgress.nextMilestone}):`,
                    fr: `Prochain palier (${loyaltyProgress.nextMilestone} visites) :`,
                    amz: `ⵜⴰⵙⵎⵖⵓⵔⵜ ⵉⴷⴷⴰⵏ (ⵜⵉⵔⵣⵉ ${loyaltyProgress.nextMilestone}) :`,
                    en: `Next Visit Milestone (#${loyaltyProgress.nextMilestone}):`,
                    es: `Próximo premio (Visita #${loyaltyProgress.nextMilestone}):`,
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
                      ar: 'مبروك! مكافأتك جاهزة للمطالبة في الصالون الآن.',
                      fr: 'Félicitations ! Votre récompense est débloquée au salon !',
                      amz: 'ⵜⴰⵙⵎⵖⵓⵔⵜ ⵏⵏⴽ ⵜⵡⵊⴷ ⵖⵉⵍⴰⴷ!',
                      en: 'Congrats! Your milestone reward is unlocked and ready!',
                      es: '¡Felicidades! Tu premio está listo para reclamar.',
                    })
                  : allDiscountTiersUnlocked
                  ? pickLang(lang, {
                      ar: 'لديك نقاط كافية لفتح أعلى خصم (-10 MAD VIP)! يمكنك الاستبدال الآن.',
                      fr: 'Tous les paliers débloqués ! Échangez votre remise VIP (-10 MAD) ci-dessous.',
                      amz: 'ⵜⵉⵙⵎⵖⵓⵔⵉⵏ ⴰⴽⴽⵯ ⵕⵥⵎⵏⵜ (-10 MAD VIP)!',
                      en: 'All reward tiers unlocked! Redeem your -10 MAD VIP discount below.',
                      es: '¡Todos los premios desbloqueados! Canjea -10 MAD VIP abajo.',
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
                {isFreeServiceMode
                  ? pickLang(lang, {
                      ar: `متبقي ${remainingCount} ${remainingCount === 1 ? 'زيارة مؤكدة' : 'زيارات مؤكدة'} للحصول على المكافأة`,
                      fr: `Plus que ${remainingCount} visite${remainingCount > 1 ? 's' : ''} confirmée${remainingCount > 1 ? 's' : ''}`,
                      amz: `ⵉⵖⴰⵎⴰ ${remainingCount} ⵏ ⵜⵉⵔⵣⴰ ⵉ ⵜⵙⵎⵖⵓⵔⵜ`,
                      en: `${remainingCount} verified visit${remainingCount === 1 ? '' : 's'} left until reward`,
                      es: `Faltan ${remainingCount} visita${remainingCount === 1 ? '' : 's'} verificada${remainingCount === 1 ? '' : 's'}`,
                    })
                  : lang === 'ar' ? (
                      <>
                        متبقي{' '}
                        <span className="text-amber-700 dark:text-amber-400 text-sm">{remainingCount} نقطة</span>{' '}
                        للحصول على المكافأة
                      </>
                    ) : lang === 'amz' ? (
                      <>
                        ⵉⵖⴰⵎⴰ{' '}
                        <span className="text-amber-700 dark:text-amber-400 text-sm">{remainingCount} pts</span>{' '}
                        ⵉ ⵜⵙⵎⵖⵓⵔⵜ
                      </>
                    ) : lang === 'en' ? (
                      <>
                        <span className="text-amber-700 dark:text-amber-400 text-sm">{remainingCount} points</span>{' '}
                        until your next reward
                      </>
                    ) : lang === 'es' ? (
                      <>
                        Faltan{' '}
                        <span className="text-amber-700 dark:text-amber-400 text-sm">{remainingCount} puntos</span>{' '}
                        para tu próxima recompensa
                      </>
                    ) : (
                      <>
                        Plus que{' '}
                        <span className="text-amber-700 dark:text-amber-400 text-sm">{remainingCount} points</span>{' '}
                        avant votre récompense
                      </>
                    )}
              </div>

              <div className="text-[11px] text-stone-600 dark:text-zinc-400">
                {pickLang(lang, {
                  ar: 'تُحتسب النقاط حسب الخدمة المختارة (+3 إلى +22 نقطة/زيارة) فور تأكيد الحضور.',
                  fr: 'Points calculés selon vos services (+3 à +22 pts/visite) dès validation de présence.',
                  amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵙ ⵜⵡⵓⵔⵉ (+3–22 pts/ⵜⵉⵔⵣⵉ) ⴷⴼⴼⵉⵔ ⵓⵙⵏⵜⵎ.',
                  en: 'Points are earned per chosen service (+3 to +22 pts/visit) upon confirmed check-in.',
                  es: 'Los puntos se calculan según el servicio (+3 a +22 pts/visita) al confirmar asistencia.',
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
