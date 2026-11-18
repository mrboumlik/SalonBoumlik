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
import { LOYALTY_POINT_TIERS, POINTS_PER_VISIT } from '../utils/loyaltyEngine';
import { sendDualAlert } from '../utils/notifications';

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
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'redeemable' | 'active_discount' | 'vip'>('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
      sendDualAlert(`تم تحديث نقاط ${c.clientName} ✓`, {
        body:
          delta >= 0
            ? `تمت إضافة +${delta} نقطة ولاء بنجاح.`
            : `تم تعديل الرصيد (${delta} نقطة).`,
        type: 'success',
        skipSound: true,
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleCustomPointsAdjust = async (c: (typeof allClients)[number]) => {
    const val = window.prompt(
      `أدخل عدد النقاط لإضافتها أو خصمها لـ ${c.clientName} (مثال: 20 أو -10):`,
      '10'
    );
    if (val === null) return;
    const delta = Number(val);
    if (!Number.isFinite(delta) || delta === 0) return;
    await handleAwardBonusPoints(c, delta);
  };

  const handleRedeemTier = async (
    c: (typeof allClients)[number],
    tier: (typeof LOYALTY_POINT_TIERS)[number]
  ) => {
    if (c.loyaltyPoints < tier.pointsCost) return;
    setBusyKey(`${c.id}-${tier.id}`);
    try {
      await redeemLoyaltyPointsForDiscount({
        phone: c.phoneDisplay,
        clientName: c.clientName,
        pointsCost: tier.pointsCost,
        discountMAD: tier.discountMAD,
        verifiedVisits: c.verifiedVisits,
        label: `🎟️ استبدال ${tier.pointsCost} نقطة ← ${tier.label.ar}`,
        crmMap,
      });
      sendDualAlert('تم استبدال نقاط الولاء بخصم فوري 🎁', {
        body: `${c.clientName}: -${tier.pointsCost} نقطة ← خصم ${tier.discountMAD} MAD جاهز للحجز القادم.`,
        type: 'success',
        skipSound: true,
      });
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
        '✓ تم تسوية خصم الولاء من طرف الإدارة',
        crmMap
      );
      sendDualAlert('تمت تسوية رصيد الخصم ✓', {
        body: `تم تصفير الخصم النشط للزبون ${c.clientName}.`,
        type: 'success',
        skipSound: true,
      });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header & Program Rules */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-zinc-900/90 to-zinc-950 border border-amber-500/35 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>نظام نقاط الولاء والمكافآت • Loyalty Points</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              يكتسب الزبون +{POINTS_PER_VISIT} نقاط ولاء تلقائياً عند كل زيارة مكتملة، ويمكنه استبدالها بخصومات فورية على خدماته القادمة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold font-mono tabular-nums">
            {LOYALTY_POINT_TIERS.map((tier) => (
              <span
                key={tier.id}
                className="px-2.5 py-1 rounded-lg bg-black/60 border border-amber-500/30 text-amber-300"
              >
                {tier.pointsCost} pts → -{tier.discountMAD} MAD
              </span>
            ))}
          </div>
        </div>

        {/* Program KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-black/50 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">إجمالي النقاط المتاحة</span>
            <span className="text-xl font-black text-amber-400 font-mono tabular-nums">
              {kpis.totalActivePoints.toLocaleString('en-US')} <span className="text-[11px]">pts</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/50 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">إجمالي النقاط المكتسبة</span>
            <span className="text-xl font-black text-white font-mono tabular-nums">
              {kpis.totalEarnedPoints.toLocaleString('en-US')} <span className="text-[11px] text-zinc-400">pts</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/50 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">النقاط المستبدلة</span>
            <span className="text-xl font-black text-emerald-400 font-mono tabular-nums">
              {kpis.totalRedeemedPoints.toLocaleString('en-US')} <span className="text-[11px]">pts</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/50 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">خصومات نشطة غير مستخدمة</span>
            <span className="text-xl font-black text-cyan-300 font-mono tabular-nums">
              {kpis.activeDiscountMAD.toLocaleString('en-US')} <span className="text-[11px]">MAD</span>
            </span>
            <span className="text-[10px] text-zinc-500 block">
              لدى {kpis.activeDiscountClients} زبناء
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-3.5 rounded-2xl bg-zinc-900/75 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الزبون أو رقم الهاتف..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: `الكل (${allClients.length})` },
            { id: 'redeemable', label: 'قابل للاستبدال (20+ pts)' },
            { id: 'active_discount', label: 'خصم نشط' },
            { id: 'vip', label: 'VIP' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id as typeof filterMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                filterMode === tab.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client Loyalty Points Cards */}
      {filteredClients.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-400">
          لا توجد حسابات زبناء مطابقة للبحث في برنامج النقاط.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredClients.map((c) => {
            const maxTier = LOYALTY_POINT_TIERS[LOYALTY_POINT_TIERS.length - 1];
            const nextTier =
              LOYALTY_POINT_TIERS.find((t) => c.loyaltyPoints < t.pointsCost) || maxTier;
            const progressPct = Math.min(
              100,
              Math.round((c.loyaltyPoints / nextTier.pointsCost) * 100)
            );
            const isBusy = busyKey?.startsWith(c.id);

            return (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/35 transition-colors space-y-3"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-black text-white text-sm truncate">
                        {c.clientName}
                      </span>
                      {c.isVip && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
                          <Crown className="w-2.5 h-2.5" />
                          <span>VIP</span>
                        </span>
                      )}
                    </div>
                    <span dir="ltr" className="text-[11px] font-mono text-zinc-400 block mt-0.5">
                      {c.phoneDisplay} · {c.verifiedVisits} زيارة مؤكدة
                    </span>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-black text-amber-400 font-mono tabular-nums leading-none">
                      {c.loyaltyPoints} <span className="text-[11px] text-amber-300">pts</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono tabular-nums mt-1">
                      +{c.pointsEarnedTotal} مكتسبة · -{c.pointsRedeemedTotal} مستبدلة
                    </div>
                  </div>
                </div>

                {/* Progress Bar toward Next Reward */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono tabular-nums">
                    <span>
                      {c.loyaltyPoints >= maxTier.pointsCost
                        ? 'مؤهل لأعلى مكافأة VIP (-70 MAD)'
                        : `الهدف القادم: ${nextTier.label.ar} (${nextTier.pointsCost} pts)`}
                    </span>
                    <span className="text-amber-300 font-bold">
                      {c.loyaltyPoints} / {nextTier.pointsCost}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Active Discount Credit Banner */}
                {c.customDiscountMAD > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>خصم جاهز للحجز القادم: -{c.customDiscountMAD} MAD</span>
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(isBusy)}
                      onClick={() => handleResetActiveDiscount(c)}
                      className="px-2 py-0.5 rounded-lg bg-black/50 hover:bg-black border border-emerald-500/30 text-emerald-200 text-[10px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      تصفير
                    </button>
                  </div>
                )}

                {/* Redeem Tiers Row */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-zinc-400 font-bold flex items-center gap-1">
                    <Gift className="w-3 h-3 text-amber-400" />
                    <span>استبدال النقاط بخصم فوري للزبون:</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
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
                              ? 'bg-amber-500/15 hover:bg-amber-500 hover:text-black border-amber-500/45 text-amber-200 cursor-pointer'
                              : 'bg-zinc-950/60 border-zinc-800 text-zinc-600 cursor-not-allowed'
                          }`}
                        >
                          <div className="font-mono font-black tabular-nums">{tier.pointsCost} pts</div>
                          <div className="truncate">-{tier.discountMAD} MAD</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Admin Points Controls */}
                <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={Boolean(isBusy)}
                      onClick={() => handleAwardBonusPoints(c, POINTS_PER_VISIT)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+{POINTS_PER_VISIT} نقطة</span>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(isBusy)}
                      onClick={() => handleCustomPointsAdjust(c)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>تعديل النقاط</span>
                    </button>
                  </div>

                  {onOpenClientTracking && (
                    <button
                      type="button"
                      onClick={() => onOpenClientTracking(c.phoneDisplay || c.normalizedPhone || c.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>ملف الزبون</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <div className="px-3 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span>
          تُطبق الخصومات المستبدلة تلقائياً على إجمالي الطلب عند إدخال رقم هاتف الزبون في خطوة التأكيد بنموذج الحجز.
        </span>
      </div>
    </div>
  );
};
