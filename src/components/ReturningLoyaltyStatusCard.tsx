import React from 'react';
import {
  Award,
  CheckCircle2,
  Coins,
  Crown,
  Gift,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { CrmClientProfile, Language } from '../types';
import {
  ClientLoyaltyPointsSummary,
  computeClientPointsSummary,
  computeLoyaltyProgress,
  LOYALTY_POINT_TIERS,
  LoyaltyPointRewardKind,
  LoyaltyProgressState,
} from '../utils/loyaltyEngine';
import { pickLang } from '../utils/i18n';

interface ReturningLoyaltyStatusCardProps {
  clientName: string;
  clientPhone?: string;
  verifiedVisits: number;
  crmProfile?: CrmClientProfile;
  loyaltyProgress?: LoyaltyProgressState;
  pointsSummary?: ClientLoyaltyPointsSummary;
  isVip?: boolean;
  customDiscountMAD?: number;
  lang: Language;
  compact?: boolean;
  redeemingTierId?: string | null;
  onRedeemTier?: (tier: {
    id: string;
    pointsCost: number;
    discountMAD: number;
    rewardKind?: LoyaltyPointRewardKind;
  }) => void;
}

export const ReturningLoyaltyStatusCard: React.FC<ReturningLoyaltyStatusCardProps> = ({
  clientName,
  clientPhone,
  verifiedVisits,
  crmProfile,
  loyaltyProgress: providedProgress,
  pointsSummary: providedPointsSummary,
  isVip,
  customDiscountMAD,
  lang,
  compact = false,
  redeemingTierId = null,
  onRedeemTier,
}) => {
  const progress = providedProgress ?? computeLoyaltyProgress(verifiedVisits, lang);
  const points = providedPointsSummary ?? computeClientPointsSummary(verifiedVisits, crmProfile);

  const resolvedVip = Boolean(isVip ?? crmProfile?.isVip);
  const resolvedDiscount = Math.max(
    0,
    customDiscountMAD ?? crmProfile?.customDiscountMAD ?? points.activeDiscountMAD ?? 0
  );
  const isFreeWashReady =
    verifiedVisits > 0 &&
    Math.floor(verifiedVisits / 5) > (crmProfile?.freeWashesRedeemed ?? 0);

  const langKey: 'ar' | 'fr' | 'en' | 'es' =
    lang === 'ar' || lang === 'en' || lang === 'es' ? lang : 'fr';

  const pointsTierLabel = points.nextTier ? points.nextTier.label[langKey] : '';

  const copy = {
    welcome:
      lang === 'ar'
        ? `مرحباً بعودتك، ${clientName}!`
        : lang === 'en'
        ? `Welcome back, ${clientName}!`
        : lang === 'es'
        ? `¡Bienvenido de nuevo, ${clientName}!`
        : lang === 'amz'
        ? `ⴰⵏⵙⵓⴼ ⵢⵉⵙ ⴽ, ${clientName} !`
        : `Bon retour, ${clientName} !`,
    visitsLabel:
      lang === 'ar'
        ? 'زيارات مؤكدة'
        : lang === 'en'
        ? 'Verified Visits'
        : lang === 'es'
        ? 'Visitas'
        : lang === 'amz'
        ? 'ⵜⵉⵔⵣⵉⵡⵉⵏ'
        : 'Visites vérifiées',
    pointsLabel:
      lang === 'ar'
        ? 'نقطة ولاء'
        : lang === 'en'
        ? 'Loyalty Pts'
        : lang === 'es'
        ? 'Pts Fidelidad'
        : lang === 'amz'
        ? 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ'
        : 'Pts Fidélité',
    nextRewardTitle:
      lang === 'ar'
        ? 'المكافأة القادمة'
        : lang === 'en'
        ? 'Next Milestone Reward'
        : lang === 'es'
        ? 'Próximo premio'
        : lang === 'amz'
        ? 'ⵜⴰⵙⵎⵖⵓⵔⵜ ⵉⴷⴷⴰⵏ'
        : 'Prochaine Récompense',
    nextVisitsRemaining: pickLang(lang, {
      ar: `باقي ${progress.visitsRemaining} من ${progress.tierSize}`,
      en: `${progress.visitsRemaining} left (${progress.displayBracketCount}/5)`,
      amz: `ⵇⵇⵉⵎⵏ ${progress.visitsRemaining} / ${progress.tierSize}`,
      es: `Faltan ${progress.visitsRemaining}`,
      fr: `${progress.visitsRemaining} restante(s)`,
    }),
    redeemTitle: pickLang(lang, {
      ar: 'استبدال نقاطك الآن:',
      en: 'Redeem points on this booking:',
      amz: 'ⵙⵏⴼⵍ ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵏⵏⴽ:',
      es: 'Canjear puntos:',
      fr: 'Utiliser vos points :',
    }),
  };

  return (
    <div
      className={`rounded-2xl border border-amber-200/80 dark:border-amber-500/30 bg-gradient-to-br from-amber-50/70 via-white to-stone-50 dark:from-amber-950/20 dark:via-[#12141B] dark:to-[#12141B] ${
        compact ? 'p-3 space-y-2' : 'p-3.5 space-y-3'
      } text-xs transition-colors`}
    >
      {/* Top Row: Recognized Greeting + Key Counters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/12 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            {resolvedVip ? (
              <Crown className="w-4 h-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-black text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
              {resolvedVip && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-black uppercase tracking-wide flex-shrink-0">
                  VIP
                </span>
              )}
              <span className="truncate">{copy.welcome}</span>
            </div>
            {clientPhone && (
              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400" dir="ltr">
                {clientPhone}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="px-2 py-1 rounded-lg bg-amber-500/12 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-mono font-black text-[11px] flex items-center gap-1 tabular-nums">
            <Coins className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{points.pointsBalance}</span>
            <span className="font-sans text-[10px] font-bold">pts</span>
          </div>
          <div className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono font-bold text-[11px] tabular-nums">
            {progress.verifiedVisits}{' '}
            <span className="font-sans text-[10px]">{copy.visitsLabel}</span>
          </div>
        </div>
      </div>

      {/* Active Reward / Discount Callouts */}
      {(isFreeWashReady || resolvedDiscount > 0 || Boolean(progress.justUnlockedRewardTitle)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {progress.justUnlockedRewardTitle && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500 text-black text-[11px] font-black shadow-xs">
              <Scissors className="w-3 h-3" />
              <span>{progress.justUnlockedRewardTitle}</span>
            </span>
          )}
          {isFreeWashReady && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
              <Gift className="w-3 h-3" />
              <span>
                {pickLang(lang, {
                  ar: 'غسل شعر مجاني مستحق',
                  amz: 'ⴰⵙⵉⵔⵉⴷ ⵏ ⵓⵣⵣⴰⵔ ⴼⴰⴱⵓⵔ',
                  en: 'Free Hair Wash Available',
                  es: 'Lavado Gratis Disponible',
                  fr: 'Shampoing Gratuit disponible',
                })}
              </span>
            </span>
          )}
          {resolvedDiscount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-200 text-[11px] font-black font-mono tabular-nums">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>
                {pickLang(lang, {
                  ar: `خصم مفعل: -${resolvedDiscount} MAD`,
                  amz: `ⴰⵙⵏⴼⵍ: -${resolvedDiscount} MAD`,
                  en: `Active discount: -${resolvedDiscount} MAD`,
                  es: `Descuento activo: -${resolvedDiscount} MAD`,
                  fr: `Remise active : -${resolvedDiscount} MAD`,
                })}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Dual Progress Trackers: Next 5-Visit Service Reward + Next Free Haircut (15th) */}
      <div className="space-y-2 pt-0.5">
        {/* 1) Next 5-Visit Free Service / Milestone Progress */}
        <div className="p-2.5 rounded-xl bg-white/90 dark:bg-black/40 border border-stone-200/80 dark:border-zinc-800 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 min-w-0">
              <Award className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="truncate">
                {copy.nextRewardTitle}:{' '}
                <strong className="text-amber-700 dark:text-amber-300">
                  {progress.nextRewardTitle}
                </strong>
              </span>
            </span>
            <span className="font-mono font-black text-amber-700 dark:text-amber-300 flex-shrink-0 tabular-nums">
              {progress.stepsInCurrentBracket}/{progress.tierSize}
            </span>
          </div>

          {/* 5-step milestone segmented bar */}
          <div className="grid grid-cols-5 gap-1.5" aria-label={copy.nextVisitsRemaining}>
            {Array.from({ length: progress.tierSize }, (_, idx) => {
              const filled = idx < progress.stepsInCurrentBracket;
              return (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    filled
                      ? 'bg-amber-500'
                      : 'bg-stone-200 dark:bg-zinc-800'
                  }`}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
            <span>{copy.nextVisitsRemaining}</span>
            <span className="font-mono tabular-nums">
              {pickLang(lang, {
                ar: `الهدف: ${progress.nextMilestone} زيارة`,
                amz: `ⴰⵙⵡⵉⵔ: ${progress.nextMilestone}`,
                en: `Goal: ${progress.nextMilestone} visits`,
                es: `Meta: ${progress.nextMilestone} visitas`,
                fr: `Objectif : ${progress.nextMilestone} visites`,
              })}
            </span>
          </div>
        </div>

        {/* 2) Progressive Milestone Ladder & Loyalty Points Progress */}
        {!compact && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Progressive 5 / 10 / 15 / 20 Milestones Summary */}
            <div className="p-2.5 rounded-xl bg-white/90 dark:bg-black/40 border border-stone-200/80 dark:border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span>
                    {pickLang(lang, {
                      ar: 'محطات الولاء',
                      amz: 'ⵜⵉⵙⵎⵖⵓⵔⵉⵏ',
                      en: 'Milestones',
                      es: 'Premios',
                      fr: 'Paliers Fidélité',
                    })}
                  </span>
                </span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                  {progress.verifiedVisits} {copy.visitsLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {progress.tiers.slice(0, 4).map((tier) => (
                  <div
                    key={tier.targetVisits}
                    className={`px-1.5 py-1 rounded-md border truncate font-semibold ${
                      tier.unlocked
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-800 dark:text-emerald-300'
                        : 'bg-stone-50 dark:bg-zinc-900/70 border-stone-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                    title={tier.rewardTitle}
                  >
                    {tier.targetVisits}: {tier.rewardTitle}
                  </div>
                ))}
              </div>
            </div>

            {/* Loyalty Points Tier Bar */}
            {points.nextTier && (
              <div className="p-2.5 rounded-xl bg-white/90 dark:bg-black/40 border border-stone-200/80 dark:border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1 truncate">
                    <Coins className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="truncate">{pointsTierLabel}</span>
                  </span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-300 tabular-nums flex-shrink-0">
                    {points.pointsBalance}/{points.nextTier.pointsCost}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${points.progressToNextTierPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-600 dark:text-zinc-400 leading-snug">
                  {points.pointsRemainingForNextTier === 0
                    ? pickLang(lang, {
                        ar: 'جاهز للاستبدال في هذا الحجز!',
                        amz: 'ⵉⵡⵊⴷ ⵉ ⵓⵙⵏⴼⵍ!',
                        en: 'Ready to redeem now!',
                        es: '¡Listo para canjear!',
                        fr: 'Prêt à échanger dès maintenant !',
                      })
                    : pickLang(lang, {
                        ar: `متبقي ${points.pointsRemainingForNextTier} نقطة (+3–22 حسب الخدمة)`,
                        amz: `ⵇⵇⵉⵎⵏ ${points.pointsRemainingForNextTier} pts (+3–22)`,
                        en: `${points.pointsRemainingForNextTier} pts left (+3–22 per service)`,
                        es: `Faltan ${points.pointsRemainingForNextTier} pts (+3–22/servicio)`,
                        fr: `Encore ${points.pointsRemainingForNextTier} pts (+3–22/service)`,
                      })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Optional Quick-Redeem Action Row */}
      {onRedeemTier && points.canRedeemAny && (
        <div className="pt-2 border-t border-amber-200/60 dark:border-amber-500/20 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200">
            {copy.redeemTitle}
          </span>
          {LOYALTY_POINT_TIERS.filter((tier) => points.pointsBalance >= tier.pointsCost).map(
            (tier) => (
              <button
                key={tier.id}
                type="button"
                disabled={redeemingTierId !== null}
                onClick={() =>
                  onRedeemTier({
                    id: tier.id,
                    pointsCost: tier.pointsCost,
                    discountMAD: tier.discountMAD,
                    rewardKind: tier.rewardKind,
                  })
                }
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] font-mono tabular-nums cursor-pointer disabled:opacity-50 transition-colors"
              >
                {redeemingTierId === tier.id
                  ? '...'
                  : tier.discountMAD > 0
                  ? `${tier.pointsCost} pts → -${tier.discountMAD} MAD`
                  : `${tier.pointsCost} pts → ${tier.label[langKey]}`}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
