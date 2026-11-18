import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Scissors,
  Clock,
  Calendar,
  Ban,
  CheckCircle2,
  Star,
  Gift,
  Plus,
  Trash2,
  Save,
  Search,
  MessageCircle,
  ListPlus,
  ShieldAlert,
  Award,
  Sparkles,
  UserCheck,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Coffee,
  QrCode,
  ExternalLink,
  Users,
  XCircle,
  RefreshCw,
  Download,
  Trophy,
} from 'lucide-react';
import {
  AppointmentBooking,
  BarberScheduleConfig,
  BarberStaff,
  CrmClientProfile,
  CustomerReview,
  WaitlistEntry,
} from '../types';
import { INITIAL_REVIEWS, TEAM_MEMBERS } from '../data/barbershopData';
import {
  ALL_SALON_CONFIGURABLE_HOURS,
  getDefaultBarberSchedule,
  getSalonSlotsForDate,
  saveBarberSchedule,
} from '../utils/barberScheduleStore';
import {
  buildCrmClientSummaries,
  grantClientCustomDiscount,
  redeemClientFreeWash,
  setClientBanStatus,
  toggleClientVip,
} from '../utils/crmStore';
import {
  deleteWaitlistEntry,
  updateWaitlistStatus,
} from '../utils/waitlistStore';
import { formatMoroccanWhatsAppNumber } from '../utils/whatsappAutomation';
import { sendDualAlert } from '../utils/notifications';
import { computeLoyaltyProgress } from '../utils/loyaltyEngine';
import { ClientQrTarget } from '../utils/clientQr';
import { ClientQrModal } from './ClientQrModal';
import { getCrmDocId } from '../utils/crmStore';
import { normalizeMoroccanPhoneDigits } from '../utils/bookingStore';
import { downloadCrmAccountingCsv } from '../utils/csvExport';
import { WeeklyWorkloadBarChart } from './WeeklyWorkloadBarChart';
import { useFirestoreReviews } from '../utils/reviewsStore';

/* ============================================================================
 * 1. FINANCIAL & BARBER PERFORMANCE ANALYTICS PANEL
 * ========================================================================== */
function getEffectiveDateForAnalytics(b: AppointmentBooking): string {
  return b.rescheduledTo?.date || b.date;
}

function getBookingRevenueMAD(b: AppointmentBooking): number {
  if (b.finalTotalMAD !== undefined && b.finalTotalMAD !== null) {
    return Number(b.finalTotalMAD) || 0;
  }
  return (b.cartItemsSummary || []).reduce(
    (sum, item) => sum + (Number(item.finalPrice) || 0),
    0
  );
}

function readStoredClientReviews(): CustomerReview[] {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('salon_boumlik_reviews_v3');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {
    // ignore storage fallback
  }
  return INITIAL_REVIEWS;
}

function extractReviewText(val: CustomerReview['comment']): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return [val.fr, val.ar, val.en, val.amz].filter(Boolean).join(' ');
}

function computeBarberSatisfactionMetrics(
  barber: BarberStaff,
  allBookings: AppointmentBooking[],
  monthPrefix: string,
  reviews: CustomerReview[]
): {
  satisfactionScore: number;
  satisfactionPct: number;
  reviewMentions: number;
  repeatClientsCount: number;
  reliabilityPct: number;
} {
  const firstFr = barber.name.fr.toLowerCase().split(' ')[0];
  const firstAr = barber.name.ar.split(' ')[0];

  const matchingReviews = reviews.filter((rev) => {
    if (rev.barberId) {
      return rev.barberId === barber.id;
    }
    const text = extractReviewText(rev.comment).toLowerCase();
    return text.includes(firstFr) || text.includes(firstAr);
  });

  const baseRating = Number(barber.rating) || 5.0;
  const avgReviewRating =
    matchingReviews.length > 0
      ? matchingReviews.reduce((s, r) => s + (Number(r.rating) || 5), 0) /
        matchingReviews.length
      : baseRating;

  const blendedReviewRating =
    matchingReviews.length > 0
      ? baseRating * 0.4 + avgReviewRating * 0.6
      : baseRating;

  const barberMonthBookings = allBookings.filter((b) => {
    const matches =
      b.barberId === barber.id || b.barberName.toLowerCase().includes(firstFr);
    return matches && getEffectiveDateForAnalytics(b).startsWith(monthPrefix);
  });

  const completedCount = barberMonthBookings.filter(
    (b) => b.status === 'completed'
  ).length;
  const noShowCount = barberMonthBookings.filter(
    (b) => b.status === 'no_show'
  ).length;

  const attendanceDenom = completedCount + noShowCount;
  const reliabilityRatio =
    attendanceDenom > 0 ? completedCount / attendanceDenom : 1;
  const reliabilityPct = Math.round(reliabilityRatio * 100);

  // Repeat client count across this barber's completed visits
  const phoneVisitMap = new Map<string, number>();
  allBookings.forEach((b) => {
    if (
      b.status === 'completed' &&
      (b.barberId === barber.id || b.barberName.toLowerCase().includes(firstFr))
    ) {
      const digits = normalizeMoroccanPhoneDigits(b.clientPhone);
      if (digits.length >= 6) {
        phoneVisitMap.set(digits, (phoneVisitMap.get(digits) || 0) + 1);
      }
    }
  });
  const repeatClientsCount = Array.from(phoneVisitMap.values()).filter(
    (v) => v >= 2
  ).length;

  const rawScore = blendedReviewRating * 0.75 + reliabilityRatio * 5.0 * 0.25;
  const satisfactionScore = Math.max(
    1,
    Math.min(5, Math.round(rawScore * 10) / 10)
  );
  const satisfactionPct = Math.round((satisfactionScore / 5) * 100);

  return {
    satisfactionScore,
    satisfactionPct,
    reviewMentions: matchingReviews.length,
    repeatClientsCount,
    reliabilityPct,
  };
}

export const FinancialAnalyticsPanel: React.FC<{
  bookings: AppointmentBooking[];
  role?: 'master' | 'barber';
  ownBarberId?: string;
}> = ({ bookings, role = 'master', ownBarberId = 'all' }) => {
  const { reviews: firestoreReviews } = useFirestoreReviews();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentMonthPrefix = todayStr.slice(0, 7); // YYYY-MM

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthPrefix);
  const [performerSort, setPerformerSort] = useState<
    'combined' | 'revenue' | 'satisfaction'
  >('combined');

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const weekStartStr = sevenDaysAgo.toISOString().split('T')[0];

  const scopedBookings =
    role === 'barber'
      ? bookings.filter(
          (b) =>
            b.barberId === ownBarberId ||
            b.barberName.toLowerCase().includes(ownBarberId.split('-')[0])
        )
      : bookings;

  // Completed-only bookings (verified attendance & actual earned revenue)
  const completedBookings = scopedBookings.filter((b) => b.status === 'completed');

  // Selected month completed bookings
  const monthlyCompletedBookings = completedBookings.filter((b) =>
    getEffectiveDateForAnalytics(b).startsWith(selectedMonth)
  );

  // Confirmed upcoming/pending-completion in selected month (secondary context)
  const monthlyConfirmedBookings = scopedBookings.filter(
    (b) =>
      b.status === 'confirmed' &&
      getEffectiveDateForAnalytics(b).startsWith(selectedMonth)
  );

  const dailyCompletedIncome = completedBookings
    .filter((b) => getEffectiveDateForAnalytics(b) === todayStr)
    .reduce((sum, b) => sum + getBookingRevenueMAD(b), 0);

  const weeklyCompletedIncome = completedBookings
    .filter((b) => {
      const d = getEffectiveDateForAnalytics(b);
      return d >= weekStartStr && d <= todayStr;
    })
    .reduce((sum, b) => sum + getBookingRevenueMAD(b), 0);

  const monthlyCompletedIncome = monthlyCompletedBookings.reduce(
    (sum, b) => sum + getBookingRevenueMAD(b),
    0
  );

  const totalCompletedRevenue = completedBookings.reduce(
    (sum, b) => sum + getBookingRevenueMAD(b),
    0
  );

  // Individual Barber Performance for the Selected/Current Month
  const visibleBarbers =
    role === 'barber'
      ? TEAM_MEMBERS.filter((m) => m.id === ownBarberId)
      : TEAM_MEMBERS;

  const monthlyBarberPerformance = visibleBarbers
    .map((barber) => {
      const matchesBarber = (b: AppointmentBooking) =>
        b.barberId === barber.id ||
        b.barberName.toLowerCase().includes(barber.name.fr.toLowerCase().split(' ')[0]);

      const completedItems = monthlyCompletedBookings.filter(matchesBarber);
      const confirmedItems = monthlyConfirmedBookings.filter(matchesBarber);

      const completedVisits = completedItems.length;
      const revenueGenerated = completedItems.reduce(
        (sum, b) => sum + getBookingRevenueMAD(b),
        0
      );
      const confirmedPipelineRevenue = confirmedItems.reduce(
        (sum, b) => sum + getBookingRevenueMAD(b),
        0
      );

      let servicesCount = 0;
      const barberServiceCounts = new Map<string, number>();
      completedItems.forEach((b) => {
        const items = b.cartItemsSummary || [];
        if (items.length > 0) {
          servicesCount += items.length;
          items.forEach((srv) => {
            const name = srv.name || srv.serviceId;
            barberServiceCounts.set(name, (barberServiceCounts.get(name) || 0) + 1);
          });
        } else if ((b.services || []).length > 0) {
          servicesCount += b.services.length;
        }
      });

      const topServiceEntry = Array.from(barberServiceCounts.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0];

      const avgTicketMAD =
        completedVisits > 0 ? Math.round(revenueGenerated / completedVisits) : 0;
      const sharePct =
        monthlyCompletedIncome > 0
          ? Math.round((revenueGenerated / monthlyCompletedIncome) * 100)
          : 0;

      return {
        barber,
        completedVisits,
        revenueGenerated,
        servicesCount,
        avgTicketMAD,
        sharePct,
        topServiceName: topServiceEntry ? topServiceEntry[0] : null,
        confirmedUpcomingCount: confirmedItems.length,
        confirmedPipelineRevenue,
      };
    })
    .sort(
      (a, b) =>
        b.revenueGenerated - a.revenueGenerated ||
        b.completedVisits - a.completedVisits
    );

  const maxBarberMonthlyRevenue = Math.max(
    1,
    ...monthlyBarberPerformance.map((s) => s.revenueGenerated)
  );

  // Top-selling services aggregation for selected month
  const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
  monthlyCompletedBookings.forEach((b) => {
    (b.cartItemsSummary || []).forEach((item) => {
      const key = item.name || item.serviceId;
      const existing = serviceMap.get(key) || { name: key, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += Number(item.finalPrice) || 0;
      serviceMap.set(key, existing);
    });
  });

  const topServices = Array.from(serviceMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
    .slice(0, 6);

  // Top Performers Ranking (All Barbers ranked by Revenue + Client Satisfaction for Selected Month)
  const storedReviews =
    firestoreReviews.length > 0 ? firestoreReviews : readStoredClientReviews();
  const allMonthCompleted = bookings.filter(
    (b) =>
      b.status === 'completed' &&
      getEffectiveDateForAnalytics(b).startsWith(selectedMonth)
  );
  const rawPerformers = TEAM_MEMBERS.map((barber) => {
    const firstFr = barber.name.fr.toLowerCase().split(' ')[0];
    const completedItems = allMonthCompleted.filter(
      (b) =>
        b.barberId === barber.id ||
        b.barberName.toLowerCase().includes(firstFr)
    );
    const revenue = completedItems.reduce(
      (sum, b) => sum + getBookingRevenueMAD(b),
      0
    );
    const completedVisits = completedItems.length;
    const sat = computeBarberSatisfactionMetrics(
      barber,
      bookings,
      selectedMonth,
      storedReviews
    );

    return {
      barber,
      revenue,
      completedVisits,
      ...sat,
    };
  });

  const maxPerformerRevenue = Math.max(1, ...rawPerformers.map((p) => p.revenue));

  const rankedTopPerformers = rawPerformers
    .map((item) => {
      const revNorm = item.revenue > 0 ? item.revenue / maxPerformerRevenue : 0;
      const satNorm = item.satisfactionScore / 5;
      const compositeScore = Math.round((revNorm * 0.65 + satNorm * 0.35) * 100);
      return {
        ...item,
        compositeScore,
      };
    })
    .sort((a, b) => {
      if (performerSort === 'revenue') {
        return (
          b.revenue - a.revenue ||
          b.satisfactionScore - a.satisfactionScore ||
          b.completedVisits - a.completedVisits
        );
      }
      if (performerSort === 'satisfaction') {
        return (
          b.satisfactionScore - a.satisfactionScore ||
          b.revenue - a.revenue ||
          b.completedVisits - a.completedVisits
        );
      }
      return (
        b.compositeScore - a.compositeScore ||
        b.revenue - a.revenue ||
        b.satisfactionScore - a.satisfactionScore
      );
    });

  return (
    <div className="space-y-5">
      {/* Analytics Header + Month Picker */}
      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>تحليلات الأداء والأرباح الشهرية • Analytics</span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {role === 'master'
              ? 'متابعة أداء كل حلاق على حدة: إجمالي الزيارات المكتملة والإيرادات المحققة خلال الشهر الحالي.'
              : 'ملخص زياراتك المكتملة والأرباح المحققة خلال الشهر الحالي.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-[11px] font-bold text-zinc-400">الشهر:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value || currentMonthPrefix)}
            className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
          />
          {selectedMonth !== currentMonthPrefix && (
            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonthPrefix)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold cursor-pointer"
            >
              الشهر الحالي
            </button>
          )}
        </div>
      </div>

      {/* Top KPI Cards: Daily / Weekly / Monthly / Cumulative Completed */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 space-y-1">
          <span className="text-[11px] font-bold text-emerald-400 block">
            مداخيل اليوم المكتملة ({todayStr})
          </span>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {dailyCompletedIncome.toLocaleString('en-US')}{' '}
            <span className="text-xs text-emerald-400">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400">زيارات مكتملة اليوم</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-blue-500/30 space-y-1">
          <span className="text-[11px] font-bold text-blue-400 block">
            مداخيل آخر 7 أيام (الأسبوع)
          </span>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {weeklyCompletedIncome.toLocaleString('en-US')}{' '}
            <span className="text-xs text-blue-400">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400">من {weekStartStr} إلى اليوم</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/35 space-y-1">
          <span className="text-[11px] font-bold text-amber-400 block">
            أرباح الشهر ({selectedMonth})
          </span>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {monthlyCompletedIncome.toLocaleString('en-US')}{' '}
            <span className="text-xs text-amber-400">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400">
            من {monthlyCompletedBookings.length} زيارة مكتملة
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-purple-500/30 space-y-1">
          <span className="text-[11px] font-bold text-purple-400 block">
            الإجمالي التراكمي المكتمل
          </span>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {totalCompletedRevenue.toLocaleString('en-US')}{' '}
            <span className="text-xs text-purple-400">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400">
            من {completedBookings.length} زيارة مكتملة إجمالاً
          </span>
        </div>
      </div>

      {/* TOP PERFORMERS CARD (Current Month Revenue + Client Satisfaction Ranking) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950/25 via-zinc-900/90 to-zinc-950 border border-amber-500/35 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-zinc-800 pb-3">
          <div>
            <h4 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>أفضل الأداءات • Top Performers ({selectedMonth})</span>
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              ترتيب الحلاقين حسب إجمالي الإيرادات المحققة ومؤشر رضا الزبناء للشهر الحالي.
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-zinc-950 border border-zinc-800 p-0.5 text-[11px] font-bold flex-shrink-0">
            {[
              { id: 'combined', label: 'التصنيف العام' },
              { id: 'revenue', label: 'الأعلى دخلاً' },
              { id: 'satisfaction', label: 'رضا الزبناء' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPerformerSort(opt.id as typeof performerSort)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  performerSort === opt.id
                    ? 'bg-amber-500 text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rankedTopPerformers.map((entry, idx) => {
            const color = entry.barber.themeColor || '#D97706';
            const rank = idx + 1;
            const rankStyle =
              rank === 1
                ? 'bg-amber-500 text-black border-amber-300'
                : rank === 2
                ? 'bg-zinc-200 text-black border-zinc-300'
                : rank === 3
                ? 'bg-amber-700 text-white border-amber-600'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700';
            const revPct = Math.round((entry.revenue / maxPerformerRevenue) * 100);
            const hideOtherCash = role === 'barber' && entry.barber.id !== ownBarberId;

            return (
              <div
                key={entry.barber.id}
                className={`p-3.5 rounded-2xl border space-y-2.5 ${
                  rank === 1
                    ? 'bg-amber-950/20 border-amber-500/45'
                    : 'bg-zinc-950/75 border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl font-mono font-black text-xs tabular-nums flex items-center justify-center border flex-shrink-0 ${rankStyle}`}
                    >
                      #{rank}
                    </span>
                    <img
                      src={entry.barber.avatar}
                      alt={entry.barber.name.ar}
                      className="w-9 h-9 rounded-xl object-cover border-2 flex-shrink-0"
                      style={{ borderColor: color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-white text-xs sm:text-sm truncate">
                          {entry.barber.name.ar}
                        </span>
                        {role === 'barber' && entry.barber.id === ownBarberId && (
                          <span className="text-[10px] font-bold text-amber-300">
                            (أنت)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                        {entry.completedVisits} زيارات مكتملة · التزام {entry.reliabilityPct}%
                      </span>
                    </div>
                  </div>

                  {/* Client Satisfaction Score */}
                  <div className="text-left rtl:text-right flex-shrink-0">
                    <div className="inline-flex items-center gap-1 font-mono font-black text-xs sm:text-sm text-amber-300 tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{entry.satisfactionScore.toFixed(1)}</span>
                      <span className="text-[10px] text-zinc-400">/ 5.0</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono tabular-nums">
                      {entry.satisfactionPct}% رضا الزبناء
                    </div>
                  </div>
                </div>

                {/* Revenue Progress Bar & Figure */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">إيرادات الشهر المحققة:</span>
                    <span className="font-mono font-black text-emerald-400 tabular-nums">
                      {hideOtherCash
                        ? '— MAD'
                        : `${entry.revenue.toLocaleString('en-US')} MAD`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${hideOtherCash ? 0 : revPct}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Completed Appointments Bar Chart (Team Workload Balance) */}
      <WeeklyWorkloadBarChart bookings={bookings} todayStr={todayStr} />

      {/* Individual Barber Performance for Current / Selected Month */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/85 border border-zinc-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>
                أداء الحلاقين الفردي لشهر {selectedMonth} (الزيارات المكتملة والإيرادات)
              </span>
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              يحتسب هذا التقرير الزيارات التي تم تأكيد حضورها وإتمامها فعلياً خلال الشهر.
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-300 font-bold tabular-nums">
            إجمالي زيارات الشهر: {monthlyCompletedBookings.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {monthlyBarberPerformance.map((stat, idx) => {
            const color = stat.barber.themeColor || '#D97706';
            const barWidth = Math.round(
              (stat.revenueGenerated / maxBarberMonthlyRevenue) * 100
            );
            const isLeader =
              role === 'master' && idx === 0 && stat.revenueGenerated > 0;

            return (
              <div
                key={stat.barber.id}
                className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-white text-sm truncate">
                          {stat.barber.name.ar}
                        </span>
                        {isLeader && (
                          <span className="text-[10px] font-bold text-amber-300">
                            · الأعلى دخلاً
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {stat.barber.name.fr}
                      </span>
                    </div>
                  </div>

                  <div className="text-left rtl:text-right flex-shrink-0">
                    <div className="text-lg font-black text-emerald-400 font-mono tabular-nums">
                      {stat.revenueGenerated.toLocaleString('en-US')}{' '}
                      <span className="text-[11px]">MAD</span>
                    </div>
                    {role === 'master' && (
                      <div className="text-[10px] text-zinc-400 font-mono tabular-nums">
                        {stat.sharePct}% من دخل الشهر
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>

                {/* Clean Tabular Metrics Row */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="py-1.5 px-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block">
                      الزيارات المكتملة
                    </span>
                    <span className="font-mono font-black text-sm text-white tabular-nums">
                      {stat.completedVisits}
                    </span>
                  </div>

                  <div className="py-1.5 px-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block">
                      متوسط الزيارة
                    </span>
                    <span className="font-mono font-black text-sm text-amber-300 tabular-nums">
                      {stat.avgTicketMAD} <span className="text-[10px]">MAD</span>
                    </span>
                  </div>

                  <div className="py-1.5 px-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block">
                      مؤكد قادم
                    </span>
                    <span className="font-mono font-bold text-xs text-blue-300 tabular-nums">
                      {stat.confirmedUpcomingCount} ({stat.confirmedPipelineRevenue} MAD)
                    </span>
                  </div>
                </div>

                {stat.topServiceName && (
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-800/70">
                    <span>الخدمة الأكثر إنجازاً هذا الشهر:</span>
                    <span className="font-bold text-zinc-200 truncate max-w-[60%]">
                      {stat.topServiceName}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-Selling Services in Selected Month */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <Scissors className="w-4 h-4 text-emerald-400" />
            <span>الخدمات الأكثر إنجازاً في شهر {selectedMonth}</span>
          </h4>
          <span className="text-[10px] text-zinc-400">Completed Services</span>
        </div>

        {topServices.length === 0 ? (
          <p className="text-xs text-zinc-500 py-5 text-center">
            لا توجد زيارات مكتملة مسجلة في شهر {selectedMonth} بعد.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {topServices.map((srv, idx) => (
              <div
                key={srv.name}
                className="p-2.5 rounded-xl bg-black/40 border border-zinc-800/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-black text-[11px] flex items-center justify-center flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-white truncate">{srv.name}</span>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0 font-mono tabular-nums">
                  <span className="text-[11px] text-zinc-400">{srv.count}×</span>
                  <span className="font-bold text-emerald-400">{srv.revenue} MAD</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. BARBER SHIFT & BREAK MANAGEMENT PANEL
 * ========================================================================== */
const WEEKDAY_LABELS: { idx: number; ar: string; fr: string }[] = [
  { idx: 0, ar: 'الأحد', fr: 'Dim' },
  { idx: 1, ar: 'الإثنين (عطلة الصالون)', fr: 'Lun (Fermé)' },
  { idx: 2, ar: 'الثلاثاء', fr: 'Mar' },
  { idx: 3, ar: 'الأربعاء', fr: 'Mer' },
  { idx: 4, ar: 'الخميس', fr: 'Jeu' },
  { idx: 5, ar: 'الجمعة', fr: 'Ven' },
  { idx: 6, ar: 'السبت', fr: 'Sam' },
];

const CALENDAR_WEEK_DAYS: { ar: string; fr: string }[] = [
  { ar: 'الإثنين', fr: 'Lun' },
  { ar: 'الثلاثاء', fr: 'Mar' },
  { ar: 'الأربعاء', fr: 'Mer' },
  { ar: 'الخميس', fr: 'Jeu' },
  { ar: 'الجمعة', fr: 'Ven' },
  { ar: 'السبت', fr: 'Sam' },
  { ar: 'الأحد', fr: 'Dim' },
];

function formatDateYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMondayOfWeekOffset(weekOffset: number): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + weekOffset * 7, 12, 0, 0);
  return monday;
}

export const BarberSchedulePanel: React.FC<{
  schedules: Record<string, BarberScheduleConfig>;
  bookings?: AppointmentBooking[];
  role: 'master' | 'barber';
  ownBarberId: string;
}> = ({ schedules, bookings = [], role, ownBarberId }) => {
  const selectableBarbers =
    role === 'master'
      ? TEAM_MEMBERS
      : TEAM_MEMBERS.filter((b) => b.id === ownBarberId);

  const [selectedBarberId, setSelectedBarberId] = useState<string>(
    selectableBarbers[0]?.id || 'hassan'
  );
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [newOffDate, setNewOffDate] = useState('');
  const [saving, setSaving] = useState(false);

  const todayStr = formatDateYMD(new Date());
  const activeConfig =
    schedules[selectedBarberId] || getDefaultBarberSchedule(selectedBarberId);

  // Build 7 calendar days (Monday -> Sunday) for the currently viewed week
  const weekDays = (() => {
    const startMonday = getMondayOfWeekOffset(weekOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startMonday);
      d.setDate(startMonday.getDate() + i);
      const dateStr = formatDateYMD(d);
      const weekday = d.getDay();
      const shortDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        dateStr,
        weekday,
        shortDate,
        label: CALENDAR_WEEK_DAYS[i],
        salonSlots: getSalonSlotsForDate(dateStr),
      };
    });
  })();

  const persistUpdate = async (next: BarberScheduleConfig, successMsg: string) => {
    setSaving(true);
    try {
      // Keep date arrays tidy by dropping dates older than 14 days so limits are never reached
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);
      const cutoffStr = formatDateYMD(cutoff);

      const cleaned: BarberScheduleConfig = {
        ...next,
        offDates: next.offDates.filter((d) => d >= cutoffStr),
        dateSlotBlocks: next.dateSlotBlocks.filter((entry) => entry.split('@')[0] >= cutoffStr),
      };

      await saveBarberSchedule(cleaned);
      sendDualAlert('تم تحديث الجدول الأسبوعي ✅', {
        body: successMsg,
        type: 'success',
        skipSound: true,
      });
    } catch (err) {
      console.error('Failed to save barber schedule:', err);
      sendDualAlert('تعذر حفظ التعديلات', {
        body: 'يرجى التحقق من الاتصال والمحاولة مرة أخرى.',
        type: 'warning',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDateAvailability = (dateStr: string, weekday: number) => {
    if (weekday === 1) return; // Salon always closed on Monday
    const isRecurringOff = activeConfig.offWeekdays.includes(weekday);
    if (isRecurringOff) {
      // Turn off recurring off-weekday so barber is available on this day
      const nextWeekdays = activeConfig.offWeekdays.filter((d) => d !== weekday);
      persistUpdate(
        { ...activeConfig, offWeekdays: nextWeekdays },
        `تم تفعيل العمل يوم ${WEEKDAY_LABELS.find((w) => w.idx === weekday)?.ar || dateStr}.`
      );
      return;
    }
    const exists = activeConfig.offDates.includes(dateStr);
    const nextDates = exists
      ? activeConfig.offDates.filter((d) => d !== dateStr)
      : [...activeConfig.offDates, dateStr].sort();
    persistUpdate(
      { ...activeConfig, offDates: nextDates },
      exists
        ? `تم فتح الحجز بتاريخ ${dateStr} بنجاح.`
        : `تم إغلاق يوم ${dateStr} (عطلة للحلاق).`
    );
  };

  const handleToggleCalendarCell = (dateStr: string, slot: string) => {
    const key = `${dateStr}@${slot}`;
    const isSpecificBlocked = activeConfig.dateSlotBlocks.includes(key);
    const isRecurringBreak = activeConfig.breakSlots.includes(slot);

    if (isRecurringBreak && !isSpecificBlocked) {
      // Prompt clarity: remove recurring break across all days OR block specifically
      const nextBreaks = activeConfig.breakSlots.filter((s) => s !== slot);
      persistUpdate(
        { ...activeConfig, breakSlots: nextBreaks },
        `تمت إزالة الاستراحة اليومية الدائمة عند الساعة ${slot}.`
      );
      return;
    }

    const nextBlocks = isSpecificBlocked
      ? activeConfig.dateSlotBlocks.filter((b) => b !== key)
      : [...activeConfig.dateSlotBlocks, key].sort();

    persistUpdate(
      { ...activeConfig, dateSlotBlocks: nextBlocks },
      isSpecificBlocked
        ? `تمت إعادة فتح الساعة ${slot} بتاريخ ${dateStr}.`
        : `تم حجب الساعة ${slot} (استراحة/غداء) بتاريخ ${dateStr}.`
    );
  };

  const handleToggleWeekLunchPreset = (slot: string) => {
    const openKeys = weekDays
      .filter((day) => day.weekday !== 1 && day.salonSlots.includes(slot))
      .map((day) => `${day.dateStr}@${slot}`);

    const allBlocked =
      openKeys.length > 0 &&
      openKeys.every((k) => activeConfig.dateSlotBlocks.includes(k));

    const nextBlocks = allBlocked
      ? activeConfig.dateSlotBlocks.filter((k) => !openKeys.includes(k))
      : Array.from(new Set([...activeConfig.dateSlotBlocks, ...openKeys])).sort();

    persistUpdate(
      { ...activeConfig, dateSlotBlocks: nextBlocks },
      allBlocked
        ? `تمت إعادة فتح الساعة ${slot} لجميع أيام هذا الأسبوع.`
        : `تم حجب الساعة ${slot} للاستراحة طوال كامل الأسبوع المحدد.`
    );
  };

  const handleToggleWeekday = (dayIdx: number) => {
    const exists = activeConfig.offWeekdays.includes(dayIdx);
    const nextDays = exists
      ? activeConfig.offWeekdays.filter((d) => d !== dayIdx)
      : [...activeConfig.offWeekdays, dayIdx];
    persistUpdate(
      { ...activeConfig, offWeekdays: nextDays },
      'تم تحديث أيام العطلة الأسبوعية المتكررة للحلاق.'
    );
  };

  const handleToggleBreakSlot = (slot: string) => {
    const exists = activeConfig.breakSlots.includes(slot);
    const nextBreaks = exists
      ? activeConfig.breakSlots.filter((s) => s !== slot)
      : [...activeConfig.breakSlots, slot];
    persistUpdate(
      { ...activeConfig, breakSlots: nextBreaks },
      `تم تحديث الاستراحة اليومية الدائمة (${slot}).`
    );
  };

  const handleAddOffDate = () => {
    if (!newOffDate) return;
    if (activeConfig.offDates.includes(newOffDate)) return;
    const nextDates = [...activeConfig.offDates, newOffDate].sort();
    setNewOffDate('');
    persistUpdate(
      { ...activeConfig, offDates: nextDates },
      `تمت إضافة يوم عطلة (${newOffDate}) ومنع الحجز فيه.`
    );
  };

  const handleRemoveOffDate = (d: string) => {
    const nextDates = activeConfig.offDates.filter((item) => item !== d);
    persistUpdate(
      { ...activeConfig, offDates: nextDates },
      `تمت إزالة يوم العطلة (${d}).`
    );
  };

  // Precompute active bookings map for quick lookup in calendar grid
  const barberBookingsMap = new Map<string, AppointmentBooking>();
  bookings.forEach((b) => {
    if (
      b.barberId === selectedBarberId &&
      !['cancelled', 'rejected', 'no_show'].includes(b.status)
    ) {
      barberBookingsMap.set(`${b.date}@${b.timeSlot.trim()}`, b);
    }
  });

  const activeBarber = TEAM_MEMBERS.find((b) => b.id === selectedBarberId) || TEAM_MEMBERS[0];

  return (
    <div className="space-y-4 text-xs">
      {/* Top Bar: Barber Selector + Week Navigator */}
      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>التقويم الأسبوعي المرئي لتوفر الحلاقين والاستراحات</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              اضغط على أي ساعة في التقويم لحجبها (استراحة/غداء) أو إعادة فتحها فوراً في نظام الحجز.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {selectableBarbers.map((b) => {
              const active = selectedBarberId === b.id;
              const color = b.themeColor || '#D97706';
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBarberId(b.id)}
                  className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                    active
                      ? 'text-white shadow-md'
                      : 'bg-zinc-950 text-zinc-400 hover:text-white border-zinc-800'
                  }`}
                  style={{
                    backgroundColor: active ? color : undefined,
                    borderColor: active ? color : undefined,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: active ? '#fff' : color }}
                  />
                  <span>{b.name.ar}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Week Range & Navigation Controls */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>الأسبوع السابق</span>
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
                weekOffset === 0
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
              }`}
            >
              الأسبوع الحالي
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>الأسبوع التالي</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
            <span className="text-zinc-400">
              {weekDays[0].dateStr} ← {weekDays[6].dateStr}
            </span>
            {saving && <span className="text-amber-400 font-sans font-bold">جاري الحفظ...</span>}
          </div>
        </div>
      </div>

      {/* Quick Weekly Lunch / Break Batch Bar & Legend */}
      <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5" />
            <span>حجب سريع للاستراحة في هذا الأسبوع:</span>
          </span>
          {['12:00', '16:00', '17:00'].map((preset) => {
            const openKeys = weekDays
              .filter((day) => day.weekday !== 1 && day.salonSlots.includes(preset))
              .map((day) => `${day.dateStr}@${preset}`);
            const allBlocked =
              openKeys.length > 0 &&
              openKeys.every((k) => activeConfig.dateSlotBlocks.includes(k));
            return (
              <button
                key={preset}
                type="button"
                disabled={saving}
                onClick={() => handleToggleWeekLunchPreset(preset)}
                className={`px-2.5 py-1.5 rounded-lg font-mono font-bold text-[11px] border transition-all cursor-pointer ${
                  allBlocked
                    ? 'bg-red-950/70 border-red-500/60 text-red-200'
                    : 'bg-black/50 border-zinc-700 text-zinc-200 hover:border-amber-500/60'
                }`}
              >
                {allBlocked ? `✓ ${preset} (إلغاء حجب الأسبوع)` : `⏸ حجب ${preset} طوال الأسبوع`}
              </button>
            );
          })}
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded bg-emerald-600/40 border border-emerald-500/60 inline-block" />
            متاح
          </span>
          <span className="flex items-center gap-1 text-red-300">
            <span className="w-2.5 h-2.5 rounded bg-red-900/60 border border-red-500/60 inline-block" />
            استراحة / محجوب
          </span>
          <span className="flex items-center gap-1 text-blue-300">
            <span className="w-2.5 h-2.5 rounded bg-blue-900/60 border border-blue-500/60 inline-block" />
            موعد زبون محجوز
          </span>
          <span className="flex items-center gap-1 text-zinc-400">
            <span className="w-2.5 h-2.5 rounded bg-zinc-800 border border-zinc-700 inline-block" />
            عطلة / خارج الدوام
          </span>
        </div>
      </div>

      {/* Interactive 7-Day Weekly Calendar Grid */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-center">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="p-3 text-right font-black text-zinc-400 w-24 border-l border-zinc-800/80">
                  التوقيت
                </th>
                {weekDays.map((day) => {
                  const isMondayClosed = day.weekday === 1;
                  const isRecurringOff = activeConfig.offWeekdays.includes(day.weekday);
                  const isDateOff = activeConfig.offDates.includes(day.dateStr);
                  const isBarberOff = !isMondayClosed && (isRecurringOff || isDateOff);
                  const isToday = day.dateStr === todayStr;

                  return (
                    <th
                      key={day.dateStr}
                      className={`p-2.5 border-l border-zinc-800/70 align-top ${
                        isToday ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`font-black text-xs ${isToday ? 'text-amber-300' : 'text-white'}`}>
                            {day.label.ar}
                          </span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-[9px] font-black">
                              اليوم
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400 tabular-nums">
                          {day.shortDate}
                        </div>

                        {isMondayClosed ? (
                          <div className="py-1 px-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-[10px] font-bold">
                            عطلة الصالون
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleToggleDateAvailability(day.dateStr, day.weekday)}
                            className={`w-full py-1 px-2 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              isBarberOff
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 hover:bg-amber-500/30'
                                : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                            }`}
                          >
                            {isBarberOff ? 'عطلة الحلاق ✕' : 'متاح للعمل ✓'}
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {ALL_SALON_CONFIGURABLE_HOURS.map((slot) => (
                <tr key={slot} className="border-b border-zinc-800/60 last:border-b-0 hover:bg-zinc-900/40">
                  <td
                    dir="ltr"
                    className="p-2.5 font-mono font-black text-xs text-zinc-300 bg-zinc-950/70 border-l border-zinc-800/80 tabular-nums"
                  >
                    {slot}
                  </td>

                  {weekDays.map((day) => {
                    const isMonday = day.weekday === 1;
                    const inSalonHours = day.salonSlots.includes(slot);
                    const isDayOff =
                      isMonday ||
                      activeConfig.offWeekdays.includes(day.weekday) ||
                      activeConfig.offDates.includes(day.dateStr);

                    if (!inSalonHours || isDayOff) {
                      return (
                        <td
                          key={`${day.dateStr}-${slot}`}
                          className="p-1.5 border-l border-zinc-800/60 bg-zinc-950/40"
                        >
                          <div className="py-2 rounded-lg text-[10px] text-zinc-600 font-medium">
                            {isMonday
                              ? 'مغلق'
                              : !inSalonHours
                              ? 'خارج الدوام'
                              : 'يوم عطلة'}
                          </div>
                        </td>
                      );
                    }

                    const bookedItem = barberBookingsMap.get(`${day.dateStr}@${slot}`);
                    const key = `${day.dateStr}@${slot}`;
                    const isSpecificBlock = activeConfig.dateSlotBlocks.includes(key);
                    const isRecurringBreak = activeConfig.breakSlots.includes(slot);
                    const isBlocked = isSpecificBlock || isRecurringBreak;

                    if (bookedItem) {
                      return (
                        <td
                          key={`${day.dateStr}-${slot}`}
                          className="p-1.5 border-l border-zinc-800/60"
                        >
                          <div
                            className="py-2 px-1.5 rounded-lg bg-blue-950/70 border border-blue-500/50 text-blue-200 text-[10px] font-bold truncate"
                            title={`${bookedItem.ticketNumber} — ${bookedItem.clientName} (${bookedItem.clientPhone})`}
                          >
                            📅 {bookedItem.clientName.split(' ')[0]}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={`${day.dateStr}-${slot}`}
                        className="p-1.5 border-l border-zinc-800/60"
                      >
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleToggleCalendarCell(day.dateStr, slot)}
                          className={`w-full py-2 px-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                            isBlocked
                              ? 'bg-red-950/70 hover:bg-red-900/70 border-red-500/60 text-red-200'
                              : 'bg-emerald-950/35 hover:bg-amber-500/20 border-emerald-500/35 hover:border-amber-500/60 text-emerald-300 hover:text-amber-200'
                          }`}
                          title={
                            isRecurringBreak
                              ? `استراحة يومية (${slot}) — اضغط لفتحها يومياً`
                              : isSpecificBlock
                              ? `محجوب بتاريخ ${day.dateStr} — اضغط لإعادة الفتح`
                              : `متاح مع ${activeBarber.name.ar} — اضغط لحظره للاستراحة`
                          }
                        >
                          {isBlocked
                            ? isRecurringBreak
                              ? '⏸ استراحة يومية'
                              : '⏸ استراحة'
                            : '✓ متاح'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Rule Helpers: Recurring Daily Breaks + Recurring Weekly Off-Days + Specific Date Off */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recurring Daily Break Hours */}
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
          <div className="font-bold text-amber-300">
            ساعات الاستراحة الدائمة كل يوم (Daily Break)
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {ALL_SALON_CONFIGURABLE_HOURS.map((slot) => {
              const isBlocked = activeConfig.breakSlots.includes(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={saving}
                  onClick={() => handleToggleBreakSlot(slot)}
                  className={`py-1.5 px-2 rounded-lg border font-mono font-bold text-[11px] transition-all cursor-pointer ${
                    isBlocked
                      ? 'bg-red-950/60 border-red-500/60 text-red-300'
                      : 'bg-black/40 border-zinc-800 text-zinc-300 hover:border-amber-500/50'
                  }`}
                >
                  {isBlocked ? `⏸ ${slot}` : slot}
                </button>
              );
            })}
          </div>
        </div>

        {/* Weekly Off Days */}
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
          <div className="font-bold text-amber-300">
            أيام العطلة الأسبوعية المتكررة
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {WEEKDAY_LABELS.map((w) => {
              const isOff = activeConfig.offWeekdays.includes(w.idx) || w.idx === 1;
              return (
                <button
                  key={w.idx}
                  type="button"
                  disabled={w.idx === 1 || saving}
                  onClick={() => handleToggleWeekday(w.idx)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-between transition-all ${
                    w.idx === 1
                      ? 'bg-red-950/40 border-red-500/40 text-red-400 cursor-not-allowed opacity-80'
                      : isOff
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 cursor-pointer'
                      : 'bg-black/40 border-zinc-800 text-zinc-300 hover:border-zinc-600 cursor-pointer'
                  }`}
                >
                  <span className="truncate">{w.ar}</span>
                  <span>{isOff ? 'عطلة' : 'عمل'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Future Off-Date Adder */}
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
          <div className="font-bold text-white flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-red-400" />
            <span>إضافة تاريخ عطلة مخصص</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={newOffDate}
              min={todayStr}
              onChange={(e) => setNewOffDate(e.target.value)}
              className="flex-1 bg-black/60 border border-zinc-700 rounded-xl px-2.5 py-2 text-xs text-white"
            />
            <button
              type="button"
              disabled={!newOffDate || saving}
              onClick={handleAddOffDate}
              className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إغلاق</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {activeConfig.offDates.length === 0 ? (
              <span className="text-[11px] text-zinc-500">لا توجد تواريخ عطلة مضافة.</span>
            ) : (
              activeConfig.offDates.map((d) => (
                <span
                  key={d}
                  className="px-2 py-1 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 font-mono text-[10px] flex items-center gap-1"
                >
                  <span>{d}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveOffDate(d)}
                    className="text-red-400 hover:text-white cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. CLIENT CRM, LOYALTY, VIP & BLACKLIST PANEL
 * ========================================================================== */
export const CrmLoyaltyBlacklistPanel: React.FC<{
  bookings: AppointmentBooking[];
  crmMap: Record<string, CrmClientProfile>;
  onOpenClientTracking?: (query: string) => void;
}> = ({ bookings, crmMap, onOpenClientTracking }) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'vip' | 'loyalty' | 'banned'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrTargetClient, setQrTargetClient] = useState<ClientQrTarget | null>(null);

  const clients = buildCrmClientSummaries(bookings, crmMap).filter((c) => {
    if (filterMode === 'vip' && !c.isVip) return false;
    if (filterMode === 'loyalty' && c.verifiedVisits < 5 && c.eligibleFreeWashes === 0) return false;
    if (filterMode === 'banned' && !c.isBanned) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.clientName.toLowerCase().includes(q) ||
      c.phoneDisplay.toLowerCase().includes(q) ||
      c.normalizedPhone.includes(q.replace(/\D/g, ''))
    );
  });

  const handleToggleVip = async (c: typeof clients[number]) => {
    setBusyId(c.id);
    try {
      await toggleClientVip(c.phoneDisplay, c.clientName, crmMap);
      sendDualAlert(c.isVip ? 'تمت إزالة وسم VIP' : 'تمت ترقية الزبون إلى VIP 👑', {
        body: `${c.clientName} (${c.phoneDisplay})`,
        type: 'success',
        skipSound: true,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRedeemFreeWash = async (c: typeof clients[number]) => {
    setBusyId(c.id);
    try {
      await redeemClientFreeWash(c.phoneDisplay, c.clientName, crmMap);
      sendDualAlert('تم تسجيل مكافأة الغسل المجاني 🎁', {
        body: `تم منح غسل شعر مجاني للزبون ${c.clientName}.`,
        type: 'success',
        skipSound: true,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleCustomDiscount = async (c: typeof clients[number]) => {
    const val = window.prompt(
      `أدخل قيمة تخفيض الولاء بالدرهم (MAD) للزبون ${c.clientName} (أدخل 0 لإلغاء التخفيض):`,
      String(c.customDiscountMAD || 10)
    );
    if (val === null) return;
    const amount = Number(val);
    if (!Number.isFinite(amount) || amount < 0) return;

    setBusyId(c.id);
    try {
      await grantClientCustomDiscount(
        c.phoneDisplay,
        c.clientName,
        amount,
        amount > 0 ? `🎁 تخفيض خاص (${amount} MAD)` : '',
        crmMap
      );
      sendDualAlert('تم تحديث تخفيض الولاء ✅', {
        body: amount > 0 ? `تم تفعيل تخفيض -${amount} MAD للزبون ${c.clientName}.` : 'تم إلغاء التخفيض الخاص.',
        type: 'success',
        skipSound: true,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleBanToggle = async (c: typeof clients[number]) => {
    setBusyId(c.id);
    try {
      const nextBanned = !c.isBanned;
      await setClientBanStatus(
        c.phoneDisplay,
        c.clientName,
        nextBanned,
        nextBanned ? 'حظر يدوي من لوحة التحكم' : 'تم رفع الحظر يدوياً من طرف الإدارة',
        crmMap
      );
      sendDualAlert(nextBanned ? 'تم إدراج الرقم في القائمة السوداء 🚫' : 'تم رفع الحظر بنجاح ✅', {
        body: `${c.clientName} (${c.phoneDisplay})`,
        type: nextBanned ? 'warning' : 'success',
        skipSound: true,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleExportCsv = () => {
    if (clients.length === 0) {
      sendDualAlert('لا توجد بيانات للتصدير', {
        body: 'يرجى التأكد من وجود سجلات زبناء مطابقة قبل تصدير ملف CSV.',
        type: 'warning',
        skipSound: true,
      });
      return;
    }

    const result = downloadCrmAccountingCsv(clients);
    sendDualAlert('تم تصدير سجل CRM والمحاسبة بنجاح ✓', {
      body: `${result.clientCount} زبون · ${result.rowCount} سجل حجز/إيراد (${result.completedRevenueMAD} MAD مكتمل)`,
      type: 'success',
      skipSound: true,
    });
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header + Filter Controls */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>سجل الزبناء، برنامج الولاء والقائمة السوداء (CRM)</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              تتبع تلقائي لعدد الزيارات عبر رقم الهاتف، مكافأة الغسل المجاني في الزيارة 5، وحظر تلقائي بعد تغيّبين (2 No-Shows) مع إمكانية رفع الحظر يدوياً.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={clients.length === 0}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-500/45 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
            title="تنزيل نسخة احتياطية CSV لسجل حجوزات الزبناء وسجلات الإيرادات للمحاسبة"
          >
            <Download className="w-4 h-4" />
            <span>تصدير CSV • Export CSV</span>
            <span className="font-mono text-[10px] opacity-85 tabular-nums">
              ({clients.length})
            </span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
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
              { id: 'all', label: 'الكل' },
              { id: 'vip', label: 'VIP 👑' },
              { id: 'loyalty', label: 'مكافآت الولاء 🎁' },
              { id: 'banned', label: 'القائمة السوداء 🚫' },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilterMode(pill.id as typeof filterMode)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap cursor-pointer ${
                  filterMode === pill.id
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:text-white'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Client Cards */}
      {clients.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-400">
          لا توجد ملفات زبناء مطابقة للبحث.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clients.map((c) => {
            const clientWa = formatMoroccanWhatsAppNumber(c.phoneDisplay);
            return (
              <div
                key={c.id}
                className={`p-4 rounded-2xl border space-y-3 ${
                  c.isBanned
                    ? 'bg-red-950/20 border-red-500/50'
                    : c.isVip
                    ? 'bg-amber-950/15 border-amber-500/40'
                    : 'bg-zinc-900/70 border-zinc-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-black text-white text-sm">{c.clientName}</span>
                      {c.isVip && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
                          👑 VIP
                        </span>
                      )}
                      {c.isBanned && (
                        <span className="px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500/60 text-red-200 text-[10px] font-bold">
                          🚫 محظور (Blacklisted)
                        </span>
                      )}
                      {c.eligibleFreeWashes > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600/25 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold">
                          🎁 مستحق لغسل مجاني
                        </span>
                      )}
                    </div>
                    <span dir="ltr" className="text-[11px] font-mono text-zinc-400 block mt-0.5">
                      {c.phoneDisplay}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setQrTargetClient({
                          id: c.id,
                          clientName: c.clientName,
                          phoneDisplay: c.phoneDisplay,
                          normalizedPhone: c.normalizedPhone,
                          verifiedVisits: c.verifiedVisits,
                          isVip: c.isVip,
                          isBanned: c.isBanned,
                        })
                      }
                      className="px-2.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="عرض وتوليد رمز QR الفريد لملف الزبون"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>QR الملف</span>
                    </button>

                    <a
                      href={`https://wa.me/${clientWa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Metrics Row */}
                {(() => {
                  const loyalty = computeLoyaltyProgress(c.verifiedVisits, 'ar');
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-black/50 border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">الزيارات المؤكدة</span>
                          <span className="font-mono font-black text-amber-300 text-sm tabular-nums">
                            {c.verifiedVisits}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/50 border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">إجمالي الإنفاق</span>
                          <span className="font-mono font-black text-emerald-300 text-sm tabular-nums">
                            {c.lifetimeSpendMAD} MAD
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/50 border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">التغيب (No-Show)</span>
                          <span
                            className={`font-mono font-black text-sm tabular-nums ${
                              c.noShowCount >= 2
                                ? 'text-red-400'
                                : c.noShowCount === 1
                                ? 'text-orange-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {c.noShowCount} / 2
                          </span>
                        </div>
                      </div>

                      {/* Multi-tier Milestone Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        {loyalty.tiers.map((tier) => (
                          <span
                            key={tier.targetVisits}
                            className={`px-2 py-0.5 rounded-full font-mono font-bold border tabular-nums ${
                              tier.unlocked
                                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                                : tier.isCurrentTarget
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-black/40 border-zinc-800 text-zinc-500'
                            }`}
                          >
                            {tier.unlocked
                              ? `✓ ${tier.targetVisits}/${tier.targetVisits}`
                              : `${c.verifiedVisits}/${tier.targetVisits}`}
                          </span>
                        ))}
                      </div>
                    </>
                  );
                })()}

                {(c.customDiscountMAD > 0 || c.banReason || c.rewardNote) && (
                  <div className="p-2 rounded-xl bg-black/40 border border-zinc-800/80 text-[11px] space-y-0.5">
                    {c.customDiscountMAD > 0 && (
                      <div className="text-emerald-300 font-bold">
                        🎁 تخفيض ولاء مفعل تلقائياً بالحجز القادم: -{c.customDiscountMAD} MAD
                      </div>
                    )}
                    {c.rewardNote && <div className="text-amber-300">{c.rewardNote}</div>}
                    {c.isBanned && c.banReason && (
                      <div className="text-red-300">{c.banReason}</div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800/80">
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleToggleVip(c)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                      c.isVip
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border-zinc-700'
                    }`}
                  >
                    <Star className="w-3 h-3" />
                    <span>{c.isVip ? 'إزالة VIP' : 'ترقية VIP'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleRedeemFreeWash(c)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Gift className="w-3 h-3" />
                    <span>غسل مجاني ({c.freeWashesRedeemed})</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleCustomDiscount(c)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>تخفيض MAD</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleBanToggle(c)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                      c.isBanned
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                        : 'bg-red-950/60 hover:bg-red-900 border-red-500/40 text-red-300'
                    }`}
                  >
                    {c.isBanned ? (
                      <>
                        <UserCheck className="w-3 h-3" />
                        <span>رفع الحظر (Unban)</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-3 h-3" />
                        <span>حظر الرقم</span>
                      </>
                    )}
                  </button>
                  {onOpenClientTracking && (
                    <button
                      type="button"
                      onClick={() => onOpenClientTracking(c.phoneDisplay || c.normalizedPhone || c.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      title="فتح نافذة تتبع الزبون مباشرة"
                    >
                      <ExternalLink className="w-3 h-3 text-amber-400" />
                      <span>التتبع</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Client Profile QR Modal */}
      <ClientQrModal
        client={qrTargetClient}
        onClose={() => setQrTargetClient(null)}
        onOpenClientTracking={onOpenClientTracking}
      />
    </div>
  );
};

/* ============================================================================
 * 4. SMART WAITLIST QUEUE PANEL
 * ========================================================================== */
export const WaitlistManagementPanel: React.FC<{
  entries: WaitlistEntry[];
  role: 'master' | 'barber';
  ownBarberId: string;
}> = ({ entries, role, ownBarberId }) => {
  const visible = entries.filter((e) =>
    role === 'master' ? true : e.barberId === ownBarberId
  );

  return (
    <div className="space-y-4 text-xs">
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <ListPlus className="w-4 h-4 text-blue-400" />
            <span>قائمة الانتظار الذكية (Smart Waitlist)</span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            الزبناء المسجلون عند امتلاء المواعيد. راسلهم عبر واتساب فور إلغاء أو شغور أي مقعد!
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold">
          {visible.filter((e) => e.status === 'waiting').length} في الانتظار
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-400">
          لا يوجد أي زبناء في قائمة الانتظار حالياً.
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((entry) => {
            const clientWa = formatMoroccanWhatsAppNumber(entry.clientPhone);
            const waText = `مرحباً ${entry.clientName}، معك صالون بومليك! توفر الآن مكان شاغر بتاريخ ${entry.date} مع ${entry.barberName} (توقيتك المفضل: ${entry.preferredTime}). هل ترغب في تأكيد الحجز الآن؟`;
            return (
              <div
                key={entry.id}
                className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-white text-sm">{entry.clientName}</span>
                    <span dir="ltr" className="font-mono text-zinc-400">
                      {entry.clientPhone}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        entry.status === 'waiting'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : entry.status === 'notified'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : entry.status === 'converted'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {entry.status === 'waiting'
                        ? 'في الانتظار'
                        : entry.status === 'notified'
                        ? 'تم التواصل معه'
                        : entry.status === 'converted'
                        ? 'تم الحجز ✓'
                        : 'ملغى'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-300 flex flex-wrap items-center gap-3">
                    <span>✂️ {entry.barberName}</span>
                    <span className="font-mono text-amber-300">
                      📅 {entry.date} • ⏰ {entry.preferredTime}
                    </span>
                    {entry.servicesSummary && (
                      <span className="text-zinc-400">({entry.servicesSummary})</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <a
                    href={`https://wa.me/${clientWa}?text=${encodeURIComponent(waText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => updateWaitlistStatus(entry.id, 'notified')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>إخبار عبر واتساب</span>
                  </a>

                  {entry.status !== 'converted' && (
                    <button
                      type="button"
                      onClick={() => updateWaitlistStatus(entry.id, 'converted')}
                      className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تم التحويل لحجز</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteWaitlistEntry(entry.id)}
                    className="p-1.5 rounded-xl bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 border border-zinc-700 cursor-pointer"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 5. LIVE QUEUE PANEL (Today's Active Queue in Real Time)
 * ========================================================================== */
function parseSlotToMinutes(timeStr: string): number {
  const match = (timeStr || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return 24 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getEffectiveBookingDate(b: AppointmentBooking): string {
  return b.status === 'rescheduled' && b.rescheduledTo?.date
    ? b.rescheduledTo.date
    : b.date;
}

function getEffectiveBookingTime(b: AppointmentBooking): string {
  return b.status === 'rescheduled' && b.rescheduledTo?.time
    ? b.rescheduledTo.time
    : b.timeSlot;
}

function formatQueueDelta(slotMinutes: number, nowMinutes: number): {
  label: string;
  tone: 'now' | 'upcoming' | 'overdue';
} {
  const diff = slotMinutes - nowMinutes;
  if (diff >= -15 && diff <= 20) {
    return { label: 'الآن · In Chair / Ready', tone: 'now' };
  }
  if (diff > 20) {
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    const text = hrs > 0 ? `بعد ${hrs}س ${mins > 0 ? `${mins}د` : ''}` : `بعد ${mins} دقيقة`;
    return { label: text.trim(), tone: 'upcoming' };
  }
  const lateMins = Math.abs(diff);
  const hrs = Math.floor(lateMins / 60);
  const mins = lateMins % 60;
  const text = hrs > 0 ? `تجاوز بـ ${hrs}س ${mins > 0 ? `${mins}د` : ''}` : `منذ ${lateMins} دقيقة`;
  return { label: text.trim(), tone: 'overdue' };
}

export function getLiveQueueBookings(
  bookings: AppointmentBooking[],
  todayStr: string,
  role: 'master' | 'barber',
  ownBarberId: string,
  barberFilter: string = 'all'
): AppointmentBooking[] {
  const ACTIVE_QUEUE_STATUSES = new Set([
    'pending',
    'pending_quote',
    'confirmed',
    'rescheduled',
  ]);

  return bookings
    .filter((b) => {
      if (!ACTIVE_QUEUE_STATUSES.has(b.status)) return false;
      if (getEffectiveBookingDate(b) !== todayStr) return false;

      if (role === 'barber') {
        const matchesSelf =
          b.barberId === ownBarberId ||
          b.barberName.toLowerCase().includes(ownBarberId.split('-')[0]);
        if (!matchesSelf) return false;
      } else if (barberFilter !== 'all') {
        const matchesFilter =
          b.barberId === barberFilter ||
          b.barberName.toLowerCase().includes(barberFilter.split('-')[0]);
        if (!matchesFilter) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const minA = parseSlotToMinutes(getEffectiveBookingTime(a));
      const minB = parseSlotToMinutes(getEffectiveBookingTime(b));
      if (minA !== minB) return minA - minB;
      // Confirmed takes priority over pending in same time slot, then earliest created
      if (a.status !== b.status) {
        if (a.status === 'confirmed') return -1;
        if (b.status === 'confirmed') return 1;
      }
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
}

export const LiveQueuePanel: React.FC<{
  bookings: AppointmentBooking[];
  crmMap: Record<string, CrmClientProfile>;
  todayStr: string;
  role: 'master' | 'barber';
  ownBarberId: string;
  busyId: string | null;
  onConfirm: (bookingId: string) => void;
  onMarkCompleted: (booking: AppointmentBooking) => void;
  onQuickCancel: (booking: AppointmentBooking) => void;
  onOpenClientTracking?: (query: string) => void;
  onShowClientQr: (client: ClientQrTarget) => void;
}> = ({
  bookings,
  crmMap,
  todayStr,
  role,
  ownBarberId,
  busyId,
  onConfirm,
  onMarkCompleted,
  onQuickCancel,
  onOpenClientTracking,
  onShowClientQr,
}) => {
  const [barberFilter, setBarberFilter] = useState<string>('all');
  const [nowDate, setNowDate] = useState<Date>(() => new Date());

  // Refresh live relative timing every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNowDate(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const nowTimeLabel = `${String(nowDate.getHours()).padStart(2, '0')}:${String(
    nowDate.getMinutes()
  ).padStart(2, '0')}`;

  const queueItems = getLiveQueueBookings(
    bookings,
    todayStr,
    role,
    ownBarberId,
    barberFilter
  );

  const completedTodayCount = bookings.filter((b) => {
    if (b.status !== 'completed') return false;
    if (getEffectiveBookingDate(b) !== todayStr) return false;
    if (role === 'barber') {
      return (
        b.barberId === ownBarberId ||
        b.barberName.toLowerCase().includes(ownBarberId.split('-')[0])
      );
    }
    if (barberFilter !== 'all') {
      return (
        b.barberId === barberFilter ||
        b.barberName.toLowerCase().includes(barberFilter.split('-')[0])
      );
    }
    return true;
  }).length;

  // Next in line: prioritize confirmed/earliest active slot near or after current time, else index 0
  const nextInLine =
    queueItems.find((b) => parseSlotToMinutes(getEffectiveBookingTime(b)) >= nowMinutes - 20) ||
    queueItems[0] ||
    null;

  const getBarberColor = (b: AppointmentBooking) =>
    b.barberColor || TEAM_MEMBERS.find((m) => m.id === b.barberId)?.themeColor || '#D97706';

  return (
    <div className="space-y-4 text-xs">
      {/* Compact Header Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>الطابور المباشر لليوم (Live Queue)</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              قائمة فورية مرتبة زمنياً لجميع المواعيد النشطة اليوم لمعرفة الزبون التالي في الدور بنظرة واحدة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px]">
            <span className="text-zinc-400">
              الوقت الحالي: <strong className="text-white">{nowTimeLabel}</strong>
            </span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span className="text-emerald-400 font-bold">
              في الانتظار: {queueItems.length}
            </span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span className="text-zinc-300">
              منجز اليوم: {completedTodayCount}
            </span>
          </div>
        </div>

        {/* Master Barber Filter Strip */}
        {role === 'master' && (
          <div className="pt-2.5 border-t border-zinc-800 flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setBarberFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                barberFilter === 'all'
                  ? 'bg-zinc-200 text-black'
                  : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              جميع الحلاقين ({getLiveQueueBookings(bookings, todayStr, 'master', 'all', 'all').length})
            </button>
            {TEAM_MEMBERS.map((member) => {
              const count = getLiveQueueBookings(
                bookings,
                todayStr,
                'master',
                'all',
                member.id
              ).length;
              const active = barberFilter === member.id;
              const color = member.themeColor || '#D97706';
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setBarberFilter(member.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    active
                      ? 'text-white'
                      : 'bg-zinc-950 text-zinc-400 hover:text-white border-zinc-800'
                  }`}
                  style={{
                    backgroundColor: active ? color : undefined,
                    borderColor: active ? color : undefined,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: active ? '#FFFFFF' : color }}
                  />
                  <span>{member.name.ar}</span>
                  <span className="font-mono opacity-80">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Next In Line Spotlight */}
      {nextInLine && (() => {
        const effTime = getEffectiveBookingTime(nextInLine);
        const slotMins = parseSlotToMinutes(effTime);
        const delta = formatQueueDelta(slotMins, nowMinutes);
        const bColor = getBarberColor(nextInLine);
        const crm = crmMap[getCrmDocId(nextInLine.clientPhone)];
        const isPriority = /تفادي الانتظار|Coupe-File|Queue Avoidance/i.test(
          nextInLine.notes || ''
        );

        return (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-zinc-900 to-zinc-900 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-emerald-300">
                <span>التالي في الدور · Next in Line</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-white">{effTime}</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-amber-300">{delta.label}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-black text-white truncate">
                  {nextInLine.clientName}
                </span>
                {crm?.isVip && (
                  <span className="text-xs font-bold text-amber-300">· VIP</span>
                )}
                {isPriority && (
                  <span className="text-[11px] font-bold text-cyan-300">
                    · أولوية تفادي الانتظار
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                <span className="font-mono text-zinc-200">{nextInLine.ticketNumber}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-zinc-200 font-semibold">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: bColor }}
                  />
                  {nextInLine.barberName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-xs">
                  {(nextInLine.cartItemsSummary || []).map((i) => i.name).join('، ') ||
                    'حلاقة وعناية'}
                </span>
              </div>
              {nextInLine.clientNotes && (
                <div className="text-[11px] text-amber-300 font-medium truncate max-w-xl">
                  📝 {nextInLine.clientNotes}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
              {nextInLine.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => onConfirm(nextInLine.id)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تأكيد</span>
                </button>
              )}

              <button
                type="button"
                disabled={busyId === nextInLine.id}
                onClick={() => onMarkCompleted(nextInLine)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {busyId === nextInLine.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Award className="w-3.5 h-3.5" />
                )}
                <span>تأكيد الحضور</span>
              </button>

              {onOpenClientTracking && (
                <button
                  type="button"
                  onClick={() => onOpenClientTracking(nextInLine.clientPhone)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>تتبع</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Compact Real-Time Queue List */}
      {queueItems.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2">
          <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm font-bold text-zinc-300">
            لا توجد مواعيد نشطة في الطابور المباشر لليوم ({todayStr})
          </p>
          <p className="text-[11px] text-zinc-500">
            ستظهر أي حجوزات جديدة أو قادمة لهذا اليوم هنا تلقائياً ومباشرة.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-zinc-900/75 border border-zinc-800 overflow-hidden divide-y divide-zinc-800/80">
          {queueItems.map((booking, index) => {
            const effTime = getEffectiveBookingTime(booking);
            const slotMins = parseSlotToMinutes(effTime);
            const delta = formatQueueDelta(slotMins, nowMinutes);
            const isNext = nextInLine?.id === booking.id;
            const barberColor = getBarberColor(booking);
            const crm = crmMap[getCrmDocId(booking.clientPhone)];
            const isPriority = /تفادي الانتظار|Coupe-File|Queue Avoidance/i.test(
              booking.notes || ''
            );
            const servicesLabel =
              (booking.cartItemsSummary || []).map((s) => s.name).join(' · ') ||
              'خدمة حلاقة';

            return (
              <div
                key={booking.id}
                className={`p-3 sm:px-4 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 transition-colors ${
                  isNext ? 'bg-emerald-950/20' : 'hover:bg-zinc-800/40'
                }`}
              >
                {/* Left / Main Queue Row Data */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  {/* Position + Time */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`w-7 h-7 rounded-lg font-mono font-black text-xs tabular-nums flex items-center justify-center border ${
                        isNext
                          ? 'bg-emerald-500 text-black border-emerald-400'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <div className="text-left rtl:text-right min-w-[60px]">
                      <div className="font-mono font-black text-sm text-white tabular-nums">
                        {effTime}
                      </div>
                      <div
                        className={`text-[10px] font-mono tabular-nums ${
                          delta.tone === 'now'
                            ? 'text-emerald-400 font-bold'
                            : delta.tone === 'overdue'
                            ? 'text-orange-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {delta.label}
                      </div>
                    </div>
                  </div>

                  {/* Client + Ticket + Barber + Services */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-black text-white truncate">
                        {booking.clientName}
                      </span>
                      {crm?.isVip && (
                        <span className="text-[11px] font-bold text-amber-300">· VIP</span>
                      )}
                      {isPriority && (
                        <span className="text-[10px] font-bold text-cyan-300">
                          · أولوية
                        </span>
                      )}
                      <span className="text-zinc-600" aria-hidden="true">·</span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {booking.ticketNumber}
                      </span>
                      <span className="text-zinc-600" aria-hidden="true">·</span>
                      <span
                        className={`text-[11px] font-bold ${
                          booking.status === 'confirmed'
                            ? 'text-emerald-400'
                            : booking.status === 'rescheduled'
                            ? 'text-blue-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {booking.status === 'confirmed'
                          ? 'مؤكد'
                          : booking.status === 'rescheduled'
                          ? 'معدل'
                          : 'معلق'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                      <span className="inline-flex items-center gap-1 text-zinc-300 font-semibold flex-shrink-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: barberColor }}
                        />
                        {booking.barberName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-md">{servicesLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-bold text-amber-300 tabular-nums">
                        {booking.finalTotalMAD} MAD
                      </span>
                    </div>
                    {booking.clientNotes && (
                      <div className="text-[11px] text-amber-300/95 truncate max-w-xl">
                        📝 {booking.clientNotes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Compact Quick Actions */}
                <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                  {booking.status === 'pending' && (
                    <button
                      type="button"
                      disabled={busyId === booking.id}
                      onClick={() => onConfirm(booking.id)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="قبول وتأكيد الموعد"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تأكيد</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busyId === booking.id}
                    onClick={() => onMarkCompleted(booking)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="تأكيد الحضور وإتمام الموعد (+1 ولاء)"
                  >
                    {busyId === booking.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Award className="w-3.5 h-3.5" />
                    )}
                    <span>حضر</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyId === booking.id}
                    onClick={() => onQuickCancel(booking)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-600 border border-red-500/40 text-red-200 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="إلغاء الموعد بنقرة واحدة"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>إلغاء</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onShowClientQr({
                        id: getCrmDocId(booking.clientPhone),
                        clientName: booking.clientName,
                        phoneDisplay: booking.clientPhone,
                        normalizedPhone: normalizeMoroccanPhoneDigits(booking.clientPhone),
                        verifiedVisits: crm?.verifiedVisits ?? 0,
                        isVip: crm?.isVip,
                        isBanned: crm?.isBanned,
                      })
                    }
                    className="min-h-[36px] px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    title="عرض رمز QR للزبون"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>

                  {onOpenClientTracking && (
                    <button
                      type="button"
                      onClick={() => onOpenClientTracking(booking.clientPhone)}
                      className="min-h-[36px] px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      title="فتح نافذة تتبع الزبون"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 6. DAILY COMPLETED REVENUE HELPER (Based on Booking Wizard Services)
 * ========================================================================== */
export interface DailyCompletedRevenueSummary {
  servicesRevenueMAD: number;
  netCollectedMAD: number;
  completedCount: number;
  servicesCount: number;
  topServices: { name: string; count: number; revenue: number }[];
}

export function computeDailyCompletedRevenue(
  bookings: AppointmentBooking[],
  todayStr: string,
  role: 'master' | 'barber',
  ownBarberId: string
): DailyCompletedRevenueSummary {
  const completedToday = bookings.filter((b) => {
    if (b.status !== 'completed') return false;
    const effectiveDate = b.rescheduledTo?.date || b.date;
    if (effectiveDate !== todayStr) return false;

    if (role === 'barber') {
      return (
        b.barberId === ownBarberId ||
        b.barberName.toLowerCase().includes(ownBarberId.split('-')[0])
      );
    }
    return true;
  });

  let servicesRevenueMAD = 0;
  let netCollectedMAD = 0;
  let servicesCount = 0;
  const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();

  for (const booking of completedToday) {
    const cartItems = booking.cartItemsSummary || [];
    let bookingServicesSum = 0;

    if (cartItems.length > 0) {
      for (const item of cartItems) {
        const itemPrice = Number(item.finalPrice) || 0;
        bookingServicesSum += itemPrice;
        servicesCount += 1;

        const key = item.name || item.serviceId;
        const existing = serviceMap.get(key) || { name: key, count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += itemPrice;
        serviceMap.set(key, existing);
      }
    } else if ((booking.services || []).length > 0) {
      for (const srv of booking.services) {
        const srvPrice = Number(srv.basePrice) || 0;
        bookingServicesSum += srvPrice;
        servicesCount += 1;

        const key = srv.name?.ar || srv.name?.fr || srv.id;
        const existing = serviceMap.get(key) || { name: key, count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += srvPrice;
        serviceMap.set(key, existing);
      }
    } else {
      bookingServicesSum = Number(booking.finalTotalMAD) || 0;
    }

    servicesRevenueMAD += bookingServicesSum;
    netCollectedMAD +=
      booking.finalTotalMAD !== undefined
        ? Number(booking.finalTotalMAD) || 0
        : bookingServicesSum;
  }

  const topServices = Array.from(serviceMap.values()).sort(
    (a, b) => b.revenue - a.revenue || b.count - a.count
  );

  return {
    servicesRevenueMAD,
    netCollectedMAD,
    completedCount: completedToday.length,
    servicesCount,
    topServices,
  };
}


