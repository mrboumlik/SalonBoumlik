import React, { useMemo, useState } from 'react';
import {
  Award,
  Coins,
  Gift,
  Plus,
  Search,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Ticket,
  Crown,
} from 'lucide-react';
import { AppointmentBooking, CrmClientProfile } from '../types';
import {
  adjustClientLoyaltyPoints,
  buildCrmClientSummaries,
  grantClientCustomDiscount,
  redeemLoyaltyPointsForDiscount,
} from '../utils/crmStore';
import { LOYALTY_POINT_TIERS, DEFAULT_FALLBACK_POINTS_PER_VISIT } from '../utils/loyaltyEngine';
import { sendDualAlert } from '../utils/notifications';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface LoyaltyPointsAdminPanelProps {
  bookings: AppointmentBooking[];
  crmMap: Record<string, CrmClientProfile>;
  onOpenClientTracking?: (query: string) => void;
}

export const LoyaltyPointsAdminPanel: React.FC<LoyaltyPointsAdminPanelProps> = ({
  bookings,
  crmMap,
  onOpenClientTracking,
}) => {
  const { lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'redeemable' | 'active_discount' | 'vip'>('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [adjustTargetClientId, setAdjustTargetClientId] = useState<string | null>(null);
  const [adjustPointsInput, setAdjustPointsInput] = useState<string>('5');

  const allClients = useMemo(
    () =>
      buildCrmClientSummaries(bookings, crmMap).sort((a, b) => {
        if (b.loyaltyPoints !== a.loyaltyPoints) return b.loyaltyPoints - a.loyaltyPoints;
        return b.verifiedVisits - a.verifiedVisits;
      }),
    [bookings, crmMap]
  );

  const kpis = useMemo(() => {
    let totalActivePoints = 0;
    let totalEarnedPoints = 0;
    let totalRedeemedPoints = 0;
    let activeDiscountClients = 0;
    let activeDiscountMAD = 0;

    allClients.forEach((c) => {
      totalActivePoints += c.loyaltyPoints;
      totalEarnedPoints += c.pointsEarnedTotal;
      totalRedeemedPoints += c.pointsRedeemedTotal;
      if (c.customDiscountMAD > 0) {
        activeDiscountClients += 1;
        activeDiscountMAD += c.customDiscountMAD;
      }
    });

    return {
      totalActivePoints,
      totalEarnedPoints,
      totalRedeemedPoints,
      activeDiscountClients,
      activeDiscountMAD,
    };
  }, [allClients]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allClients.filter((c) => {
      if (filterMode === 'redeemable' && c.loyaltyPoints < LOYALTY_POINT_TIERS[0].pointsCost) {
        return false;
      }
      if (filterMode === 'active_discount' && c.customDiscountMAD <= 0) {
        return false;
      }
      if (filterMode === 'vip' && !c.isVip) {
        return false;
      }
      if (!q) return true;
      return (
        c.clientName.toLowerCase().includes(q) ||
        c.phoneDisplay.toLowerCase().includes(q) ||
        c.normalizedPhone.includes(q.replace(/\D/g, ''))
      );
    });
  }, [allClients, filterMode, search]);

  const handleAwardBonusPoints = async (
    c: (typeof allClients)[number],
    delta: number
  ) => {
    setBusyKey(`${c.id}-pts`);
    try {
      await adjustClientLoyaltyPoints({
        phone: c.phoneDisplay,
        clientName: c.clientName,
        pointsDelta: delta,
        verifiedVisits: c.verifiedVisits,
        crmMap,
      });
      sendDualAlert(
        pickLang(lang, {
          ar: `تم تحديث نقاط ${c.clientName} ✓`,
          fr: `Points de ${c.clientName} mis à jour ✓`,
          amz: `ⵜⵜⵓⵙⵎⴰⵢⵏⵓⵏⵜ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵏ ${c.clientName} ✓`,
          en: `Updated points for ${c.clientName} ✓`,
          es: `Puntos de ${c.clientName} actualizados ✓`,
        }),
        {
          body:
            delta >= 0
              ? pickLang(lang, {
                  ar: `تمت إضافة +${delta} نقطة ولاء بنجاح.`,
                  fr: `+${delta} points de fidélité ajoutés avec succès.`,
                  amz: `ⵜⵜⵓⵔⵏⴰⵏⵜ +${delta} ⵜⵏⵇⵇⵉⴹⵉⵏ ⵏ ⵜⵏⵎⵎⵉⵔⵜ.`,
                  en: `+${delta} loyalty points added successfully.`,
                  es: `+${delta} puntos de fidelidad añadidos con éxito.`,
                })
              : pickLang(lang, {
                  ar: `تم تعديل الرصيد (${delta} نقطة).`,
                  fr: `Solde ajusté (${delta} pts).`,
                  amz: `ⵉⵜⵜⵓⵙⵏⴼⵍ ⵓⵎⴹⴰⵏ (${delta} pts).`,
                  en: `Balance adjusted (${delta} pts).`,
                  es: `Saldo ajustado (${delta} pts).`,
                }),
          type: 'success',
          skipSound: true,
        }
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleOpenCustomPointsAdjust = (c: (typeof allClients)[number]) => {
    if (adjustTargetClientId === c.id) {
      setAdjustTargetClientId(null);
      return;
    }
    setAdjustPointsInput('5');
    setAdjustTargetClientId(c.id);
  };

  const handleSubmitCustomPointsAdjust = async (c: (typeof allClients)[number]) => {
    const delta = Number(adjustPointsInput);
    if (!Number.isFinite(delta) || delta === 0) return;
    await handleAwardBonusPoints(c, delta);
    setAdjustTargetClientId(null);
  };

  const handleRedeemTier = async (
    c: (typeof allClients)[number],
    tier: (typeof LOYALTY_POINT_TIERS)[number]
  ) => {
    if (c.loyaltyPoints < tier.pointsCost) return;
    setBusyKey(`${c.id}-${tier.id}`);
    try {
      const tierLabel = pickLang(lang, tier.label);
      await redeemLoyaltyPointsForDiscount({
        phone: c.phoneDisplay,
        clientName: c.clientName,
        pointsCost: tier.pointsCost,
        discountMAD: tier.discountMAD,
        rewardKind: tier.rewardKind,
        verifiedVisits: c.verifiedVisits,
        label: pickLang(lang, {
          ar: `🎟️ استبدال ${tier.pointsCost} نقطة ← ${tierLabel}`,
          fr: `🎟️ Échange ${tier.pointsCost} pts ← ${tierLabel}`,
          amz: `🎟️ ⴰⵙⵏⴼⵍ ${tier.pointsCost} pts ← ${tierLabel}`,
          en: `🎟️ Redeemed ${tier.pointsCost} pts ← ${tierLabel}`,
          es: `🎟️ Canje ${tier.pointsCost} pts ← ${tierLabel}`,
        }),
        crmMap,
      });
      sendDualAlert(
        pickLang(lang, {
          ar:
            tier.discountMAD > 0
              ? 'تم استبدال نقاط الولاء بخصم فوري 🎁'
              : 'تم استبدال نقاط الولاء بمكافأة مجانية 🎁',
          fr:
            tier.discountMAD > 0
              ? 'Points échangés contre une réduction immédiate 🎁'
              : 'Points échangés contre une prestation offerte 🎁',
          amz: 'ⵜⵜⵓⵙⵏⴼⵍⵏⵜ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵙ ⵜⵙⵎⵖⵓⵔⵜ 🎁',
          en:
            tier.discountMAD > 0
              ? 'Loyalty points redeemed for instant discount 🎁'
              : 'Loyalty points redeemed for free service reward 🎁',
          es:
            tier.discountMAD > 0
              ? 'Puntos canjeados por descuento inmediato 🎁'
              : 'Puntos canjeados por recompensa gratuita 🎁',
        }),
        {
          body:
            tier.discountMAD > 0
              ? pickLang(lang, {
                  ar: `${c.clientName}: -${tier.pointsCost} نقطة ← خصم ${tier.discountMAD} MAD جاهز للحجز القادم.`,
                  fr: `${c.clientName} : -${tier.pointsCost} pts ← remise de ${tier.discountMAD} MAD prête pour la prochaine visite.`,
                  amz: `${c.clientName}: -${tier.pointsCost} pts ← ⴰⵙⵏⵇⵙ ${tier.discountMAD} MAD.`,
                  en: `${c.clientName}: -${tier.pointsCost} pts ← ${tier.discountMAD} MAD discount ready for next booking.`,
                  es: `${c.clientName}: -${tier.pointsCost} pts ← descuento de ${tier.discountMAD} MAD listo.`,
                })
              : pickLang(lang, {
                  ar: `${c.clientName}: -${tier.pointsCost} نقطة ← ${tierLabel} مسجلة في ملف الزبون.`,
                  fr: `${c.clientName} : -${tier.pointsCost} pts ← ${tierLabel} enregistrée sur le profil client.`,
                  amz: `${c.clientName}: -${tier.pointsCost} pts ← ${tierLabel}.`,
                  en: `${c.clientName}: -${tier.pointsCost} pts ← ${tierLabel} recorded on client profile.`,
                  es: `${c.clientName}: -${tier.pointsCost} pts ← ${tierLabel} registrada en el perfil.`,
                }),
          type: 'success',
          skipSound: true,
        }
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleResetActiveDiscount = async (c: (typeof allClients)[number]) => {
    setBusyKey(`${c.id}-clear-disc`);
    try {
      await grantClientCustomDiscount(
        c.phoneDisplay,
        c.clientName,
        0,
        pickLang(lang, {
          ar: '✓ تم تسوية خصم الولاء من طرف الإدارة',
          fr: '✓ Remise de fidélité soldée par l’administration',
          amz: '✓ ⵉⵜⵜⵓⵙⴼⵔⴰ ⵓⵙⵏⵇⵙ ⵙⴳ ⵜⵎⵙⵙⵓⴳⵓⵔⵜ',
          en: '✓ Loyalty discount settled by management',
          es: '✓ Descuento liquidado por administración',
        }),
        crmMap
      );
      sendDualAlert(
        pickLang(lang, {
          ar: 'تمت تسوية رصيد الخصم ✓',
          fr: 'Solde de remise réinitialisé ✓',
          amz: 'ⵉⵜⵜⵓⵙⴼⵔⴰ ⵓⵙⵏⵇⵙ ✓',
          en: 'Discount balance cleared ✓',
          es: 'Saldo de descuento liquidado ✓',
        }),
        {
          body: pickLang(lang, {
            ar: `تم تصفير الخصم النشط للزبون ${c.clientName}.`,
            fr: `Remise active réinitialisée pour ${c.clientName}.`,
            amz: `ⵉⵜⵜⵓⵙⴼⵔⴰ ⵓⵙⵏⵇⵙ ⵉ ${c.clientName}.`,
            en: `Active discount cleared for ${c.clientName}.`,
            es: `Descuento activo restablecido para ${c.clientName}.`,
          }),
          type: 'success',
          skipSound: true,
        }
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header & Program Rules */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#141720] border border-amber-300 dark:border-amber-500/35 shadow-xs space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                {pickLang(lang, {
                  ar: 'نظام نقاط الولاء والمكافآت',
                  fr: 'Programme de Points de Fidélité & Récompenses',
                  amz: 'ⴰⵏⴳⵔⴰⵡ ⵏ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵏ ⵜⵏⵎⵎⵉⵔⵜ',
                  en: 'Loyalty Points & Rewards System',
                  es: 'Sistema de Puntos de Fidelidad y Recompensas',
                })}
              </span>
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
              {pickLang(lang, {
                ar: 'يكتسب الزبون نقاط ولاء حسب الخدمة المختارة (+3 إلى +22 نقطة/زيارة) فور تأكيد الحضور، ويمكنه استبدالها بهدايا وخصومات مدروسة.',
                fr: 'Le client gagne des points selon ses prestations (+3 à +22 pts/visite) à chaque présence confirmée, échangeables contre des cadeaux et remises.',
                amz: 'ⵉⵜⵜⴰⵎⵥ ⵓⵎⵙⴰⵖ ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵙ ⵜⵡⵓⵔⵉ (+3–22 pts/ⵜⵉⵔⵣⵉ) ⴷⴼⴼⵉⵔ ⵓⵙⵏⵜⵎ.',
                en: 'Clients earn service-based points (+3 to +22 pts/visit) upon confirmed check-in, redeemable for balanced rewards and discounts.',
                es: 'El cliente gana puntos según el servicio (+3 a +22 pts/visita) al confirmar asistencia.',
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold font-mono tabular-nums">
            {LOYALTY_POINT_TIERS.map((tier) => (
              <span
                key={tier.id}
                className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
              >
                {tier.pointsCost} pts →{' '}
                {tier.discountMAD > 0 ? `-${tier.discountMAD} MAD` : pickLang(lang, tier.label)}
              </span>
            ))}
          </div>
        </div>

        {/* Program KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#191D28] border border-stone-200 dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">
              {pickLang(lang, { ar: 'إجمالي النقاط المتاحة', fr: 'Total points actifs', amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵉⵍⵍⴰⵏ', en: 'Total Active Points', es: 'Puntos activos totales' })}
            </span>
            <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono tabular-nums">
              {kpis.totalActivePoints.toLocaleString('en-US')} <span className="text-[11px]">pts</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#191D28] border border-stone-200 dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">
              {pickLang(lang, { ar: 'إجمالي النقاط المكتسبة', fr: 'Total points gagnés', amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵉⵜⵜⵓⵙⴽⵔⵏ', en: 'Total Earned Points', es: 'Puntos ganados totales' })}
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
              {kpis.totalEarnedPoints.toLocaleString('en-US')} <span className="text-[11px] text-slate-500 dark:text-zinc-400">pts</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#191D28] border border-stone-200 dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">
              {pickLang(lang, { ar: 'النقاط المستبدلة', fr: 'Points échangés', amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵉⵜⵜⵓⵙⵏⴼⵍⵏ', en: 'Redeemed Points', es: 'Puntos canjeados' })}
            </span>
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
              {kpis.totalRedeemedPoints.toLocaleString('en-US')} <span className="text-[11px]">pts</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#191D28] border border-stone-200 dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">
              {pickLang(lang, { ar: 'خصومات نشطة غير مستخدمة', fr: 'Remises actives non utilisées', amz: 'ⵉⵙⵏⵇⵙⵏ ⵉⵔⵎⵉⴷⵏ', en: 'Unused Active Discounts', es: 'Descuentos activos sin usar' })}
            </span>
            <span className="text-xl font-black text-cyan-700 dark:text-cyan-300 font-mono tabular-nums">
              {kpis.activeDiscountMAD.toLocaleString('en-US')} <span className="text-[11px]">MAD</span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-500 block">
              {pickLang(lang, {
                ar: `لدى ${kpis.activeDiscountClients} زبناء`,
                fr: `Chez ${kpis.activeDiscountClients} clients`,
                amz: `ⵖⵓⵔ ${kpis.activeDiscountClients} ⵉⵎⵙⴰⵖⵏ`,
                en: `Across ${kpis.activeDiscountClients} clients`,
                es: `En ${kpis.activeDiscountClients} clientes`,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={pickLang(lang, {
              ar: 'بحث باسم الزبون أو رقم الهاتف...',
              fr: 'Rechercher par nom ou téléphone...',
              amz: 'ⴰⵔⵣⵣⵓ ⵙ ⵢⵉⵙⵎ ⵏⵖ ⵓⵟⵟⵓⵏ...',
              en: 'Search by client name or phone...',
              es: 'Buscar por nombre o teléfono...',
            })}
            className="w-full bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: pickLang(lang, { ar: `الكل (${allClients.length})`, fr: `Tous (${allClients.length})`, amz: `ⴰⴽⴽʷ (${allClients.length})`, en: `All (${allClients.length})`, es: `Todos (${allClients.length})` }) },
            { id: 'redeemable', label: pickLang(lang, { ar: `قابل للاستبدال (${LOYALTY_POINT_TIERS[0].pointsCost}+ pts)`, fr: `Échangeable (${LOYALTY_POINT_TIERS[0].pointsCost}+ pts)`, amz: `ⵉⵜⵜⵓⵙⵏⴼⴰⵍ (${LOYALTY_POINT_TIERS[0].pointsCost}+ pts)`, en: `Redeemable (${LOYALTY_POINT_TIERS[0].pointsCost}+ pts)`, es: `Canjeable (${LOYALTY_POINT_TIERS[0].pointsCost}+ pts)` }) },
            { id: 'active_discount', label: pickLang(lang, { ar: 'خصم نشط', fr: 'Remise active', amz: 'ⴰⵙⵏⵇⵙ ⵉⵔⵎⵉⴷⵏ', en: 'Active Discount', es: 'Descuento activo' }) },
            { id: 'vip', label: 'VIP' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id as typeof filterMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                filterMode === tab.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-stone-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-stone-200 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client Loyalty Points Cards */}
      {filteredClients.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
          {pickLang(lang, {
            ar: 'لا توجد حسابات زبناء مطابقة للبحث في برنامج النقاط.',
            fr: 'Aucun profil client correspondant dans le programme de points.',
            amz: 'ⵓⵔ ⵉⵍⵍⵉ ⵓⵎⵙⴰⵖ ⵉⵎⵙⴰⵙⴰⵏ ⴳ ⵓⵏⴳⵔⴰⵡ ⵏ ⵜⵏⵇⵇⵉⴹⵉⵏ.',
            en: 'No matching client accounts found in the points program.',
            es: 'No hay cuentas de clientes que coincidan en el programa de puntos.',
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredClients.map((c) => {
            const maxTier = LOYALTY_POINT_TIERS[LOYALTY_POINT_TIERS.length - 1];
            const nextTier =
              LOYALTY_POINT_TIERS.find((t) => c.loyaltyPoints < t.pointsCost) || maxTier;
            const progressPct = Math.min(
              100,
              Math.round((c.loyaltyPoints / nextTier.pointsCost) * 100)
            );
            const isBusy = busyKey?.startsWith(c.id);
            const nextTierLabel = pickLang(lang, nextTier.label);

            return (
              <div
                key={c.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500/35 shadow-2xs transition-colors space-y-3"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-black text-slate-900 dark:text-white text-sm truncate">
                        {c.clientName}
                      </span>
                      {c.isVip && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-400/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                          <Crown className="w-2.5 h-2.5" />
                          <span>VIP</span>
                        </span>
                      )}
                    </div>
                    <span dir="ltr" className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block mt-0.5">
                      {c.phoneDisplay} · {c.verifiedVisits}{' '}
                      {pickLang(lang, { ar: 'زيارة مؤكدة', fr: 'visites confirmées', amz: 'ⵜⵉⵔⵣⴰ', en: 'verified visits', es: 'visitas confirmadas' })}
                    </span>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono tabular-nums leading-none">
                      {c.loyaltyPoints} <span className="text-[11px] text-amber-600 dark:text-amber-300">pts</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono tabular-nums mt-1">
                      +{c.pointsEarnedTotal} {pickLang(lang, { ar: 'مكتسبة', fr: 'gagnés', amz: 'ⵉⵜⵜⵓⵙⴽⵔⵏ', en: 'earned', es: 'ganados' })} · -{c.pointsRedeemedTotal} {pickLang(lang, { ar: 'مستبدلة', fr: 'échangés', amz: 'ⵉⵜⵜⵓⵙⵏⴼⵍⵏ', en: 'redeemed', es: 'canjeados' })}
                    </div>
                  </div>
                </div>

                {/* Progress Bar toward Next Reward */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                    <span>
                      {c.loyaltyPoints >= maxTier.pointsCost
                        ? pickLang(lang, {
                            ar: 'مؤهل لأعلى مكافأة VIP (-10 MAD)',
                            fr: 'Éligible à la récompense maximale VIP (-10 MAD)',
                            amz: 'ⵉⵣⵎⵔ ⵉ ⵜⵏⵎⵎⵉⵔⵜ ⵜⴰⵎⵇⵔⴰⵏⵜ VIP (-10 MAD)',
                            en: 'Eligible for max VIP reward (-10 MAD)',
                            es: 'Elegible para recompensa máxima VIP (-10 MAD)',
                          })
                        : pickLang(lang, {
                            ar: `الهدف القادم: ${nextTierLabel} (${nextTier.pointsCost} pts)`,
                            fr: `Prochain palier : ${nextTierLabel} (${nextTier.pointsCost} pts)`,
                            amz: `ⴰⵙⵡⵉⵔ ⴷ-ⵉⴷⴷⴰⵏ: ${nextTierLabel} (${nextTier.pointsCost} pts)`,
                            en: `Next goal: ${nextTierLabel} (${nextTier.pointsCost} pts)`,
                            es: `Próxima meta: ${nextTierLabel} (${nextTier.pointsCost} pts)`,
                          })}
                    </span>
                    <span className="text-amber-700 dark:text-amber-300 font-bold">
                      {c.loyaltyPoints} / {nextTier.pointsCost}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-stone-200 dark:bg-zinc-950 border border-stone-300 dark:border-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Active Discount Credit Banner */}
                {c.customDiscountMAD > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/40 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span>
                        {pickLang(lang, {
                          ar: `خصم جاهز للحجز القادم: -${c.customDiscountMAD} MAD`,
                          fr: `Remise prête pour le prochain RDV : -${c.customDiscountMAD} MAD`,
                          amz: `ⴰⵙⵏⵇⵙ ⵉ ⵓⵎⵓⵄⵉⴷ ⴷ-ⵉⴷⴷⴰⵏ: -${c.customDiscountMAD} MAD`,
                          en: `Discount ready for next booking: -${c.customDiscountMAD} MAD`,
                          es: `Descuento listo para próxima cita: -${c.customDiscountMAD} MAD`,
                        })}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(isBusy)}
                      onClick={() => handleResetActiveDiscount(c)}
                      className="px-2 py-0.5 rounded-lg bg-white hover:bg-stone-100 dark:bg-black/50 dark:hover:bg-black border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      {pickLang(lang, { ar: 'تصفير', fr: 'Réinitialiser', amz: 'ⵙⴼⵔ', en: 'Clear', es: 'Limpiar' })}
                    </button>
                  </div>
                )}

                {/* Redeem Tiers Row */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-600 dark:text-zinc-400 font-bold flex items-center gap-1">
                    <Gift className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>
                      {pickLang(lang, {
                        ar: 'استبدال النقاط بخصم فوري للزبون:',
                        fr: 'Échanger des points contre une remise immédiate :',
                        amz: 'ⵙⵏⴼⵍ ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵙ ⵓⵙⵏⵇⵙ:',
                        en: 'Redeem points for instant client discount:',
                        es: 'Canjear puntos por descuento inmediato:',
                      })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {LOYALTY_POINT_TIERS.map((tier) => {
                      const canRedeem = c.loyaltyPoints >= tier.pointsCost;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          disabled={!canRedeem || Boolean(isBusy)}
                          onClick={() => handleRedeemTier(c, tier)}
                          className={`py-1.5 px-2 rounded-xl border text-[10px] font-bold text-center transition-all ${
                            canRedeem
                              ? 'bg-amber-50 hover:bg-amber-500 hover:text-black dark:bg-amber-500/15 dark:hover:bg-amber-500 dark:hover:text-black border-amber-300 dark:border-amber-500/45 text-amber-900 dark:text-amber-200 cursor-pointer'
                              : 'bg-stone-100 dark:bg-zinc-950 border-stone-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                          }`}
                        >
                          <div className="font-mono font-black tabular-nums">{tier.pointsCost} pts</div>
                          <div className="truncate">
                            {tier.discountMAD > 0 ? `-${tier.discountMAD} MAD` : pickLang(lang, tier.label)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Admin Points Controls */}
                <div className="pt-2 border-t border-stone-200 dark:border-zinc-800/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={Boolean(isBusy)}
                        onClick={() => handleAwardBonusPoints(c, DEFAULT_FALLBACK_POINTS_PER_VISIT)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/35 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                        <span>
                          +{DEFAULT_FALLBACK_POINTS_PER_VISIT}{' '}
                          {pickLang(lang, { ar: 'نقاط', fr: 'pts', amz: 'pts', en: 'pts', es: 'pts' })}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(isBusy)}
                        onClick={() => handleOpenCustomPointsAdjust(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-stone-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>
                          {pickLang(lang, { ar: 'تعديل النقاط', fr: 'Ajuster points', amz: 'ⵙⵏⴼⵍ ⵜⵉⵏⵇⵇⵉⴹⵉⵏ', en: 'Adjust Points', es: 'Ajustar puntos' })}
                        </span>
                      </button>
                    </div>

                    {onOpenClientTracking && (
                      <button
                        type="button"
                        onClick={() => onOpenClientTracking(c.phoneDisplay || c.normalizedPhone || c.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-amber-300 dark:border-zinc-700 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>
                          {pickLang(lang, { ar: 'ملف الزبون', fr: 'Profil client', amz: 'ⴰⴼⴰⵢⵍⵓ', en: 'Client Profile', es: 'Perfil cliente' })}
                        </span>
                      </button>
                    )}
                  </div>

                  {adjustTargetClientId === c.id && (
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex flex-wrap items-center gap-1.5">
                      <input
                        type="number"
                        value={adjustPointsInput}
                        onChange={(e) => setAdjustPointsInput(e.target.value)}
                        dir="ltr"
                        aria-label="Points delta"
                        className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-stone-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono text-xs"
                      />
                      <button
                        type="button"
                        disabled={Boolean(isBusy) || !Number(adjustPointsInput)}
                        onClick={() => void handleSubmitCustomPointsAdjust(c)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] cursor-pointer disabled:opacity-50"
                      >
                        {pickLang(lang, { ar: 'حفظ', fr: 'Valider', amz: 'ⵃⴹⵓ', en: 'Apply', es: 'Aplicar' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustTargetClientId(null)}
                        className="px-2 py-1 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white text-[11px] cursor-pointer"
                      >
                        {pickLang(lang, { ar: 'إلغاء', fr: 'Annuler', amz: 'ⵙⵔⵓⵙ', en: 'Cancel', es: 'Cancelar' })}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <div className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-400 flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span>
          {pickLang(lang, {
            ar: 'تُطبق الخصومات المستبدلة تلقائياً على إجمالي الطلب عند إدخال رقم هاتف الزبون في خطوة التأكيد بنموذج الحجز.',
            fr: 'Les remises échangées s’appliquent automatiquement au total dès que le client saisit son numéro lors de la confirmation.',
            amz: 'ⵉⵙⵏⵇⵙⵏ ⵜⵜⵓⵙⵏⴼⴰⵍⵏⵉⵏ ⵜⵜⵓⵙⴽⴰⵔⵏ ⵙ ⵜⵓⵔⵎⵉⵜ ⴳ ⵜⵉⴳⵉⵔⴰ ⵏ ⵓⵎⵓⵄⵉⴷ.',
            en: 'Redeemed discounts apply automatically to the total when the client enters their phone number at confirmation.',
            es: 'Los descuentos canjeados se aplican automáticamente al total al confirmar la reserva.',
          })}
        </span>
      </div>
    </div>
  );
};
