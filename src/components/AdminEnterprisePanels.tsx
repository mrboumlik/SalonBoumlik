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
  Language,
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
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

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
  const { lang } = useLanguage();
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

  const getBarberDisplayName = (b: BarberStaff) =>
    b.name[lang] || b.name.ar || b.name.fr;

  const ui = {
    title: pickLang(lang, {
      ar: 'تحليلات الأداء والأرباح الشهرية • Analytics',
      fr: 'Analytique & Revenus Mensuels',
      amz: 'ⵜⵉⵙⵍⴰⴹ ⵏ ⵜⵡⵓⵔⵉ ⴷ ⵉⴷⵔⵉⵎⵏ ⵏ ⵡⴰⵢⵢⵓⵔ',
      en: 'Monthly Performance & Revenue Analytics',
      es: 'Analítica de Rendimiento e Ingresos Mensuales',
    }),
    subtitleMaster: pickLang(lang, {
      ar: 'متابعة أداء كل حلاق على حدة: إجمالي الزيارات المكتملة والإيرادات المحققة خلال الشهر الحالي.',
      fr: 'Suivi individuel des barbiers : visites confirmées et chiffre d’affaires encaissé ce mois.',
      amz: 'ⴰⴹⴼⴰⵕ ⵏ ⴽⵓ ⴰⵎⴽⵔⴰⴹ: ⵜⵉⵔⵣⵉⵡⵉⵏ ⵉⵜⵜⵓⵙⴷⵓⵏ ⴷ ⵉⴷⵔⵉⵎⵏ ⵏ ⵡⴰⵢⵢⵓⵔ ⴰⴷ.',
      en: 'Individual barber tracking: completed visits and earned revenue for the selected month.',
      es: 'Seguimiento por barbero: visitas completadas e ingresos generados este mes.',
    }),
    subtitleBarber: pickLang(lang, {
      ar: 'ملخص زياراتك المكتملة والأرباح المحققة خلال الشهر الحالي.',
      fr: 'Résumé de vos visites complétées et de vos revenus sur le mois sélectionné.',
      amz: 'ⴰⵙⴳⵣⵍ ⵏ ⵜⵔⵣⵉⵡⵉⵏ ⵏⵏⴽ ⵉⵜⵜⵓⵙⴷⵓⵏ ⴷ ⵉⴷⵔⵉⵎⵏ ⵏ ⵡⴰⵢⵢⵓⵔ.',
      en: 'Summary of your completed visits and earned revenue for the selected month.',
      es: 'Resumen de tus visitas completadas e ingresos del mes seleccionado.',
    }),
    monthLabel: pickLang(lang, { ar: 'الشهر:', fr: 'Mois :', amz: 'ⴰⵢⵢⵓⵔ:', en: 'Month:', es: 'Mes:' }),
    currentMonthBtn: pickLang(lang, {
      ar: 'الشهر الحالي',
      fr: 'Mois en cours',
      amz: 'ⴰⵢⵢⵓⵔ ⴰⴷ',
      en: 'Current Month',
      es: 'Mes actual',
    }),
    dailyIncomeTitle: pickLang(lang, {
      ar: `مداخيل اليوم المكتملة (${todayStr})`,
      fr: `Revenus complétés du jour (${todayStr})`,
      amz: `ⵉⴷⵔⵉⵎⵏ ⵏ ⴰⵙⵙ ⴰ (${todayStr})`,
      en: `Today's Completed Revenue (${todayStr})`,
      es: `Ingresos completados hoy (${todayStr})`,
    }),
    dailyIncomeSub: pickLang(lang, {
      ar: 'زيارات مكتملة اليوم',
      fr: 'Visites complétées aujourd’hui',
      amz: 'ⵜⵉⵔⵣⵉⵡⵉⵏ ⵏ ⴰⵙⵙ ⴰ',
      en: 'Completed visits today',
      es: 'Visitas completadas hoy',
    }),
    weeklyIncomeTitle: pickLang(lang, {
      ar: 'مداخيل آخر 7 أيام (الأسبوع)',
      fr: 'Revenus des 7 derniers jours',
      amz: 'ⵉⴷⵔⵉⵎⵏ ⵏ 7 ⵓⵙⵙⴰⵏ ⵉⵣⵔⵉⵏ',
      en: 'Last 7 Days Revenue',
      es: 'Ingresos últimos 7 días',
    }),
    weeklyIncomeSub: pickLang(lang, {
      ar: `من ${weekStartStr} إلى اليوم`,
      fr: `Du ${weekStartStr} à aujourd’hui`,
      amz: `ⵙⴳ ${weekStartStr} ⴰⵔ ⴰⵙⵙ ⴰ`,
      en: `From ${weekStartStr} to today`,
      es: `Del ${weekStartStr} a hoy`,
    }),
    monthlyIncomeTitle: pickLang(lang, {
      ar: `أرباح الشهر (${selectedMonth})`,
      fr: `Revenus du mois (${selectedMonth})`,
      amz: `ⵉⴷⵔⵉⵎⵏ ⵏ ⵡⴰⵢⵢⵓⵔ (${selectedMonth})`,
      en: `Monthly Revenue (${selectedMonth})`,
      es: `Ingresos del mes (${selectedMonth})`,
    }),
    fromCompletedVisits: (n: number) =>
      pickLang(lang, {
        ar: `من ${n} زيارة مكتملة`,
        fr: `Sur ${n} visites complétées`,
        amz: `ⵙⴳ ${n} ⵜⵔⵣⵉⵡⵉⵏ`,
        en: `From ${n} completed visits`,
        es: `De ${n} visitas completadas`,
      }),
    totalCumTitle: pickLang(lang, {
      ar: 'الإجمالي التراكمي المكتمل',
      fr: 'Total cumulé complété',
      amz: 'ⴰⵎⵓⵜⵜⵉ ⴰⵎⴰⵜⴰⵢ ⵉⵜⵜⵓⵙⴷⵓⵏ',
      en: 'Cumulative Completed Revenue',
      es: 'Total acumulado completado',
    }),
    fromTotalVisits: (n: number) =>
      pickLang(lang, {
        ar: `من ${n} زيارة مكتملة إجمالاً`,
        fr: `Sur ${n} visites complétées au total`,
        amz: `ⵙⴳ ${n} ⵜⵔⵣⵉⵡⵉⵏ ⵙ ⵓⵎⴰⵜⴰ`,
        en: `Across ${n} total completed visits`,
        es: `De ${n} visitas completadas en total`,
      }),
    topPerformersTitle: pickLang(lang, {
      ar: `أفضل الأداءات • Top Performers (${selectedMonth})`,
      fr: `Meilleurs Barbiers • Top Performers (${selectedMonth})`,
      amz: `ⵉⵎⵓⴼⴰⵢⵏ ⵏ ⵜⵡⵓⵔⵉ (${selectedMonth})`,
      en: `Top Performers (${selectedMonth})`,
      es: `Mejores Rendimientos (${selectedMonth})`,
    }),
    topPerformersSub: pickLang(lang, {
      ar: 'ترتيب الحلاقين حسب إجمالي الإيرادات المحققة ومؤشر رضا الزبناء للشهر الحالي.',
      fr: 'Classement des barbiers selon le chiffre d’affaires et l’indice de satisfaction client.',
      amz: 'ⴰⵙⵜⴰⵢ ⵏ ⵉⵎⴽⵔⴰⴹⵏ ⵙ ⵉⴷⵔⵉⵎⵏ ⴷ ⵓⵙⵓⵜⴳ ⵏ ⵉⵎⵙⴰⵖⵏ.',
      en: 'Barbers ranked by earned revenue and client satisfaction score for the selected month.',
      es: 'Clasificación de barberos por ingresos y satisfacción del cliente del mes.',
    }),
    sortCombined: pickLang(lang, { ar: 'التصنيف العام', fr: 'Classement global', amz: 'ⴰⵎⴰⵜⴰⵢ', en: 'Overall', es: 'General' }),
    sortRevenue: pickLang(lang, { ar: 'الأعلى دخلاً', fr: 'Revenus', amz: 'ⵉⴷⵔⵉⵎⵏ', en: 'Top Revenue', es: 'Más ingresos' }),
    sortSatisfaction: pickLang(lang, { ar: 'رضا الزبناء', fr: 'Satisfaction', amz: 'ⴰⵙⵓⵜⴳ', en: 'Satisfaction', es: 'Satisfacción' }),
    youBadge: pickLang(lang, { ar: '(أنت)', fr: '(Vous)', amz: '(ⴽⵢⵢⵉ)', en: '(You)', es: '(Tú)' }),
    visitsAndReliability: (v: number, pct: number) =>
      pickLang(lang, {
        ar: `${v} زيارات مكتملة · التزام ${pct}%`,
        fr: `${v} visites complétées · fiabilité ${pct}%`,
        amz: `${v} ⵜⵔⵣⵉⵡⵉⵏ · ⴰⵙⴷⵓ ${pct}%`,
        en: `${v} completed visits · ${pct}% reliability`,
        es: `${v} visitas · ${pct}% puntualidad`,
      }),
    satisfactionLabel: (pct: number) =>
      pickLang(lang, {
        ar: `${pct}% رضا الزبناء`,
        fr: `${pct}% satisfaction`,
        amz: `${pct}% ⴰⵙⵓⵜⴳ`,
        en: `${pct}% satisfaction`,
        es: `${pct}% satisfacción`,
      }),
    monthRevLabel: pickLang(lang, {
      ar: 'إيرادات الشهر المحققة:',
      fr: 'Chiffre d’affaires réalisé :',
      amz: 'ⵉⴷⵔⵉⵎⵏ ⵏ ⵡⴰⵢⵢⵓⵔ:',
      en: 'Monthly Earned Revenue:',
      es: 'Ingresos del mes:',
    }),
    indivTitle: pickLang(lang, {
      ar: `أداء الحلاقين الفردي لشهر ${selectedMonth} (الزيارات المكتملة والإيرادات)`,
      fr: `Performance individuelle (${selectedMonth}) — Visites & Revenus`,
      amz: `ⵜⴰⵡⵓⵔⵉ ⵏ ⴽⵓ ⴰⵎⴽⵔⴰⴹ (${selectedMonth})`,
      en: `Individual Barber Performance for ${selectedMonth}`,
      es: `Rendimiento individual del mes ${selectedMonth}`,
    }),
    indivSub: pickLang(lang, {
      ar: 'يحتسب هذا التقرير الزيارات التي تم تأكيد حضورها وإتمامها فعلياً خلال الشهر.',
      fr: 'Ce rapport comptabilise uniquement les visites dont la présence a été confirmée.',
      amz: 'ⴰⵏⵇⵇⵉⵙ ⴰⴷ ⵉⵜⵜⵃⵙⴰⴱ ⵖⴰⵙ ⵜⵉⵔⵣⵉⵡⵉⵏ ⵉⵜⵜⵓⵙⴷⵓⵏ.',
      en: 'This report counts only visits confirmed as completed during the selected month.',
      es: 'Este informe cuenta únicamente las visitas confirmadas como completadas.',
    }),
    totalMonthVisits: pickLang(lang, {
      ar: 'إجمالي زيارات الشهر:',
      fr: 'Total visites du mois :',
      amz: 'ⴰⵎⵓⵜⵜⵉ ⵏ ⵜⵔⵣⵉⵡⵉⵏ:',
      en: 'Total monthly visits:',
      es: 'Total de visitas del mes:',
    }),
    leaderBadge: pickLang(lang, {
      ar: '· الأعلى دخلاً',
      fr: '· Top Revenu',
      amz: '· ⴰⵎⵣⵡⴰⵔⵓ',
      en: '· Top Earner',
      es: '· Mayor ingreso',
    }),
    shareOfMonth: (pct: number) =>
      pickLang(lang, {
        ar: `${pct}% من دخل الشهر`,
        fr: `${pct}% du revenu mensuel`,
        amz: `${pct}% ⵙⴳ ⵡⴰⵢⵢⵓⵔ`,
        en: `${pct}% of monthly income`,
        es: `${pct}% del ingreso mensual`,
      }),
    completedVisitsCol: pickLang(lang, { ar: 'الزيارات المكتملة', fr: 'Visites complétées', amz: 'ⵜⵉⵔⵣⵉⵡⵉⵏ', en: 'Completed Visits', es: 'Completadas' }),
    avgTicketCol: pickLang(lang, { ar: 'متوسط الزيارة', fr: 'Panier moyen', amz: 'ⴰⵏⴰⵎⵎⴰⵙ', en: 'Avg. Ticket', es: 'Ticket medio' }),
    confirmedUpcomingCol: pickLang(lang, { ar: 'مؤكد قادم', fr: 'Confirmés à venir', amz: 'ⵉⵜⵜⵓⵙⴷⵓⵏ ⴷ ⵉⴷⴷⴰⵏ', en: 'Confirmed Next', es: 'Confirmadas' }),
    topServiceLabel: pickLang(lang, {
      ar: 'الخدمة الأكثر إنجازاً هذا الشهر:',
      fr: 'Prestation la plus réalisée ce mois :',
      amz: 'ⵜⴰⵏⴰⴼⵓⵜ ⵉⵜⵜⵓⴳⴰⵏ ⴱⴰⵀⵔⴰ:',
      en: 'Most requested service this month:',
      es: 'Servicio más realizado este mes:',
    }),
    topServicesTitle: pickLang(lang, {
      ar: `الخدمات الأكثر إنجازاً في شهر ${selectedMonth}`,
      fr: `Prestations les plus demandées (${selectedMonth})`,
      amz: `ⵜⵉⵏⴰⴼⵓⵜⵉⵏ ⵜⵉⵎⵇⵇⵔⴰⵏⵉⵏ ⴳ ${selectedMonth}`,
      en: `Top Services in ${selectedMonth}`,
      es: `Servicios principales en ${selectedMonth}`,
    }),
    completedServicesTag: pickLang(lang, {
      ar: 'الخدمات المكتملة',
      fr: 'Prestations réalisées',
      amz: 'ⵜⵉⵏⴰⴼⵓⵜⵉⵏ ⵉⵜⵜⵓⵙⴷⵓⵏ',
      en: 'Completed Services',
      es: 'Servicios completados',
    }),
    noMonthServices: pickLang(lang, {
      ar: `لا توجد زيارات مكتملة مسجلة في شهر ${selectedMonth} بعد.`,
      fr: `Aucune visite complétée enregistrée pour ${selectedMonth}.`,
      amz: `ⵓⵔ ⵍⵍⵉⵏⵜ ⵜⵔⵣⵉⵡⵉⵏ ⵉⵜⵜⵓⵙⴷⵓⵏ ⴳ ${selectedMonth}.`,
      en: `No completed visits recorded for ${selectedMonth} yet.`,
      es: `Aún no hay visitas completadas en ${selectedMonth}.`,
    }),
  };

  return (
    <div className="space-y-5">
      {/* Analytics Header + Month Picker */}
      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>{ui.title}</span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {role === 'master' ? ui.subtitleMaster : ui.subtitleBarber}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-[11px] font-bold text-zinc-400">{ui.monthLabel}</label>
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
              {ui.currentMonthBtn}
            </button>
          )}
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 space-y-1">
          <span className="text-[11px] font-bold text-emerald-400 block">
            {ui.dailyIncomeTitle}
          </span>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {dailyCompletedIncome.toLocaleString('en-US')}{' '}
            <span className="text-xs text-emerald-400">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400">{ui.dailyIncomeSub}</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-blue-500/30 space-y-1">
          <span className="text-[11px] font-bold text-blue-400 block">
            {ui.weeklyIncomeTitle}
          </span>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {weeklyCompletedIncome.toLocaleString('en-US')}{' '}
            <span className="text-xs text-blue-400">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400">{ui.weeklyIncomeSub}</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/35 space-y-1">
          <span className="text-[11px] font-bold text-amber-400 block">
            {ui.monthlyIncomeTitle}
          </span>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {monthlyCompletedIncome.toLocaleString('en-US')}{' '}
            <span className="text-xs text-amber-400">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400">
            {ui.fromCompletedVisits(monthlyCompletedBookings.length)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-purple-500/30 space-y-1">
          <span className="text-[11px] font-bold text-purple-400 block">
            {ui.totalCumTitle}
          </span>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {totalCompletedRevenue.toLocaleString('en-US')}{' '}
            <span className="text-xs text-purple-400">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400">
            {ui.fromTotalVisits(completedBookings.length)}
          </span>
        </div>
      </div>

      {/* TOP PERFORMERS CARD */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950/25 via-zinc-900/90 to-zinc-950 border border-amber-500/35 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-zinc-800 pb-3">
          <div>
            <h4 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>{ui.topPerformersTitle}</span>
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">{ui.topPerformersSub}</p>
          </div>

          <div className="inline-flex rounded-xl bg-zinc-950 border border-zinc-800 p-0.5 text-[11px] font-bold flex-shrink-0">
            {[
              { id: 'combined', label: ui.sortCombined },
              { id: 'revenue', label: ui.sortRevenue },
              { id: 'satisfaction', label: ui.sortSatisfaction },
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
            const displayName = getBarberDisplayName(entry.barber);

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
                      alt={displayName}
                      className="w-9 h-9 rounded-xl object-cover border-2 flex-shrink-0"
                      style={{ borderColor: color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-white text-xs sm:text-sm truncate">
                          {displayName}
                        </span>
                        {role === 'barber' && entry.barber.id === ownBarberId && (
                          <span className="text-[10px] font-bold text-amber-300">
                            {ui.youBadge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                        {ui.visitsAndReliability(entry.completedVisits, entry.reliabilityPct)}
                      </span>
                    </div>
                  </div>

                  {/* Client Satisfaction Score */}
                  <div className="text-end flex-shrink-0">
                    <div className="inline-flex items-center gap-1 font-mono font-black text-xs sm:text-sm text-amber-300 tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{entry.satisfactionScore.toFixed(1)}</span>
                      <span className="text-[10px] text-zinc-400">/ 5.0</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono tabular-nums">
                      {ui.satisfactionLabel(entry.satisfactionPct)}
                    </div>
                  </div>
                </div>

                {/* Revenue Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">{ui.monthRevLabel}</span>
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

      {/* Weekly Completed Appointments Bar Chart */}
      <WeeklyWorkloadBarChart bookings={bookings} todayStr={todayStr} />

      {/* Individual Barber Performance */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/85 border border-zinc-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>{ui.indivTitle}</span>
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">{ui.indivSub}</p>
          </div>
          <span className="text-[11px] font-mono text-emerald-300 font-bold tabular-nums">
            {ui.totalMonthVisits} {monthlyCompletedBookings.length}
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
            const barberDisplay = getBarberDisplayName(stat.barber);

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
                          {barberDisplay}
                        </span>
                        {isLeader && (
                          <span className="text-[10px] font-bold text-amber-300">
                            {ui.leaderBadge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {lang === 'ar' || !stat.barber.role
                          ? stat.barber.name.fr
                          : stat.barber.role[lang] || stat.barber.role.fr}
                      </span>
                    </div>
                  </div>

                  <div className="text-end flex-shrink-0">
                    <div className="text-lg font-black text-emerald-400 font-mono tabular-nums">
                      {stat.revenueGenerated.toLocaleString('en-US')}{' '}
                      <span className="text-[11px]">MAD</span>
                    </div>
                    {role === 'master' && (
                      <div className="text-[10px] text-zinc-400 font-mono tabular-nums">
                        {ui.shareOfMonth(stat.sharePct)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="py-1.5 px-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block">
                      {ui.completedVisitsCol}
                    </span>
                    <span className="font-mono font-black text-sm text-white tabular-nums">
                      {stat.completedVisits}
                    </span>
                  </div>

                  <div className="py-1.5 px-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block">
                      {ui.avgTicketCol}
                    </span>
                    <span className="font-mono font-black text-sm text-amber-300 tabular-nums">
                      {stat.avgTicketMAD} <span className="text-[10px]">MAD</span>
                    </span>
                  </div>

                  <div className="py-1.5 px-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block">
                      {ui.confirmedUpcomingCol}
                    </span>
                    <span className="font-mono font-bold text-xs text-blue-300 tabular-nums">
                      {stat.confirmedUpcomingCount} ({stat.confirmedPipelineRevenue} MAD)
                    </span>
                  </div>
                </div>

                {stat.topServiceName && (
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-800/70">
                    <span>{ui.topServiceLabel}</span>
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

      {/* Top-Selling Services */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <Scissors className="w-4 h-4 text-emerald-400" />
            <span>{ui.topServicesTitle}</span>
          </h4>
          <span className="text-[10px] text-zinc-400">{ui.completedServicesTag}</span>
        </div>

        {topServices.length === 0 ? (
          <p className="text-xs text-zinc-500 py-5 text-center">
            {ui.noMonthServices}
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
const WEEKDAY_LABELS: Record<number, Record<Language, string>> = {
  0: { ar: 'الأحد', fr: 'Dimanche', amz: 'ⴰⵙⴰⵎⴰⵙ', en: 'Sunday', es: 'Domingo' },
  1: { ar: 'الإثنين (عطلة الصالون)', fr: 'Lundi (Fermé)', amz: 'ⴰⵢⵏⴰⵙ (ⵉⵇⵇⵏ)', en: 'Monday (Closed)', es: 'Lunes (Cerrado)' },
  2: { ar: 'الثلاثاء', fr: 'Mardi', amz: 'ⴰⵙⵉⵏⴰⵙ', en: 'Tuesday', es: 'Martes' },
  3: { ar: 'الأربعاء', fr: 'Mercredi', amz: 'ⴰⴽⵕⴰⵙ', en: 'Wednesday', es: 'Miércoles' },
  4: { ar: 'الخميس', fr: 'Jeudi', amz: 'ⴰⴽⵡⴰⵙ', en: 'Thursday', es: 'Jueves' },
  5: { ar: 'الجمعة', fr: 'Vendredi', amz: 'ⴰⵙⵉⵎⵡⴰⵙ', en: 'Friday', es: 'Viernes' },
  6: { ar: 'السبت', fr: 'Samedi', amz: 'ⴰⵙⵉⴹⵢⴰⵙ', en: 'Saturday', es: 'Sábado' },
};

const CALENDAR_WEEK_DAYS: Record<Language, string>[] = [
  { ar: 'الإثنين', fr: 'Lun', amz: 'ⴰⵢⵏⴰⵙ', en: 'Mon', es: 'Lun' },
  { ar: 'الثلاثاء', fr: 'Mar', amz: 'ⴰⵙⵉⵏⴰⵙ', en: 'Tue', es: 'Mar' },
  { ar: 'الأربعاء', fr: 'Mer', amz: 'ⴰⴽⵕⴰⵙ', en: 'Wed', es: 'Mié' },
  { ar: 'الخميس', fr: 'Jeu', amz: 'ⴰⴽⵡⴰⵙ', en: 'Thu', es: 'Jue' },
  { ar: 'الجمعة', fr: 'Ven', amz: 'ⴰⵙⵉⵎⵡⴰⵙ', en: 'Fri', es: 'Vie' },
  { ar: 'السبت', fr: 'Sam', amz: 'ⴰⵙⵉⴹⵢⴰⵙ', en: 'Sat', es: 'Sáb' },
  { ar: 'الأحد', fr: 'Dim', amz: 'ⴰⵙⴰⵎⴰⵙ', en: 'Sun', es: 'Dom' },
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
  const { lang } = useLanguage();
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

  const ui = {
    updatedTitle: pickLang(lang, {
      ar: 'تم تحديث الجدول الأسبوعي ✅',
      fr: 'Planning hebdomadaire mis à jour ✅',
      amz: 'ⵉⵜⵜⵓⵙⵎⴰⵢⵏⵓ ⵓⵙⵖⵉⵡⵙ ⵏ ⵉⵎⴰⵍⴰⵙⵙ ✅',
      en: 'Weekly schedule updated ✅',
      es: 'Horario semanal actualizado ✅',
    }),
    saveErrTitle: pickLang(lang, {
      ar: 'تعذر حفظ التعديلات',
      fr: 'Impossible d’enregistrer',
      amz: 'ⵓⵔ ⵉⵜⵜⵓⵃⴹⵉ ⵓⵙⵏⴼⵍ',
      en: 'Could not save changes',
      es: 'No se pudieron guardar los cambios',
    }),
    saveErrBody: pickLang(lang, {
      ar: 'يرجى التحقق من الاتصال والمحاولة مرة أخرى.',
      fr: 'Veuillez vérifier la connexion et réessayer.',
      amz: 'ⵙⵙⴼⵇⴷ ⴰⵣⴷⴰⵢ ⵜⴰⵍⵙⴷ.',
      en: 'Please check your connection and try again.',
      es: 'Verifica la conexión e inténtalo de nuevo.',
    }),
    headerTitle: pickLang(lang, {
      ar: 'التقويم الأسبوعي المرئي لتوفر الحلاقين والاستراحات',
      fr: 'Calendrier Hebdomadaire des Disponibilités & Pauses',
      amz: 'ⴰⵙⵖⵉⵡⵙ ⵏ ⵉⵎⴰⵍⴰⵙⵙ ⵉ ⵜⵍⴻⵍⵍⵉ ⴷ ⵉⵙⵓⵏⴼⵓⵜⵏ',
      en: 'Visual Weekly Barber Availability & Break Calendar',
      es: 'Calendario Semanal de Disponibilidad y Pausas',
    }),
    headerSub: pickLang(lang, {
      ar: 'اضغط على أي ساعة في التقويم لحجبها (استراحة/غداء) أو إعادة فتحها فوراً في نظام الحجز.',
      fr: 'Cliquez sur un créneau pour le bloquer (pause/déjeuner) ou le rouvrir instantanément.',
      amz: 'ⴰⴷⵔ ⵖⴼ ⴽⵓ ⵜⴰⵙⵔⴰⴳⵜ ⵉ ⵓⵙⵇⵏ ⵏⵖ ⴰⵔⵥⵥⵓⵎ ⵉ ⵓⵙⵔⵓⵙ.',
      en: 'Click any slot in the grid to block (break/lunch) or reopen it in real time.',
      es: 'Pulsa cualquier hora para bloquearla (pausa) o reabrirla al instante.',
    }),
    prevWeek: pickLang(lang, { ar: 'الأسبوع السابق', fr: 'Semaine préc.', amz: 'ⵉⵎⴰⵍⴰⵙⵙ ⵉⵣⵔⵉⵏ', en: 'Prev Week', es: 'Sem. anterior' }),
    currWeek: pickLang(lang, { ar: 'الأسبوع الحالي', fr: 'Cette semaine', amz: 'ⵉⵎⴰⵍⴰⵙⵙ ⴰⴷ', en: 'This Week', es: 'Esta semana' }),
    nextWeek: pickLang(lang, { ar: 'الأسبوع التالي', fr: 'Semaine suiv.', amz: 'ⵉⵎⴰⵍⴰⵙⵙ ⴷ ⵉⴷⴷⴰⵏ', en: 'Next Week', es: 'Sem. siguiente' }),
    saving: pickLang(lang, { ar: 'جاري الحفظ...', fr: 'Enregistrement...', amz: 'ⴰⵃⵟⵟⵓ...', en: 'Saving...', es: 'Guardando...' }),
    quickLunchLabel: pickLang(lang, {
      ar: 'حجب سريع للاستراحة في هذا الأسبوع:',
      fr: 'Blocage rapide de pause cette semaine :',
      amz: 'ⴰⵙⵇⵏ ⵉⵣⵔⴱⵏ ⵏ ⵓⵙⵓⵏⴼⵓ ⴳ ⵉⵎⴰⵍⴰⵙⵙ ⴰ:',
      en: 'Quick weekly break toggle:',
      es: 'Bloqueo rápido de pausa esta semana:',
    }),
    unblockWeek: (p: string) =>
      pickLang(lang, {
        ar: `✓ ${p} (إلغاء حجب الأسبوع)`,
        fr: `✓ ${p} (Débloquer semaine)`,
        amz: `✓ ${p} (ⵔⵥⵎ ⵉⵎⴰⵍⴰⵙⵙ)`,
        en: `✓ ${p} (Unblock week)`,
        es: `✓ ${p} (Desbloquear sem.)`,
      }),
    blockWeek: (p: string) =>
      pickLang(lang, {
        ar: `⏸ حجب ${p} طوال الأسبوع`,
        fr: `⏸ Bloquer ${p} la semaine`,
        amz: `⏸ ⵇⵇⵏ ${p} ⵉⵎⴰⵍⴰⵙⵙ`,
        en: `⏸ Block ${p} all week`,
        es: `⏸ Bloquear ${p} toda la sem.`,
      }),
    legendAvail: pickLang(lang, { ar: 'متاح', fr: 'Disponible', amz: 'ⵉⵍⵍⴰ', en: 'Available', es: 'Disponible' }),
    legendBreak: pickLang(lang, { ar: 'استراحة / محجوب', fr: 'Pause / Bloqué', amz: 'ⴰⵙⵓⵏⴼⵓ', en: 'Break / Blocked', es: 'Pausa / Bloqueado' }),
    legendBooked: pickLang(lang, { ar: 'موعد زبون محجوز', fr: 'Client réservé', amz: 'ⵉⵜⵜⵓⵃⵊⵣ', en: 'Booked Client', es: 'Cita reservada' }),
    legendOff: pickLang(lang, { ar: 'عطلة / خارج الدوام', fr: 'Fermé / Repos', amz: 'ⵉⵇⵇⵏ / ⵜⴰⵏⴼⵓⵙⵜ', en: 'Off / Closed', es: 'Cerrado / Libre' }),
    timeCol: pickLang(lang, { ar: 'التوقيت', fr: 'Heure', amz: 'ⵜⴰⵙⵔⴰⴳⵜ', en: 'Time', es: 'Hora' }),
    todayTag: pickLang(lang, { ar: 'اليوم', fr: 'Auj.', amz: 'ⴰⵙⵙ ⴰ', en: 'Today', es: 'Hoy' }),
    salonClosedMon: pickLang(lang, { ar: 'عطلة الصالون', fr: 'Salon fermé', amz: 'ⵉⵇⵇⵏ ⵓⵙⴰⵍⵓⵏ', en: 'Salon Closed', es: 'Salón cerrado' }),
    barberOffBtn: pickLang(lang, { ar: 'عطلة الحلاق ✕', fr: 'Repos barbier ✕', amz: 'ⴰⵙⵓⵏⴼⵓ ✕', en: 'Barber Off ✕', es: 'Libre ✕' }),
    barberOnBtn: pickLang(lang, { ar: 'متاح للعمل ✓', fr: 'En service ✓', amz: 'ⵉⵜⵜⴰⵡⵓⵔⵉ ✓', en: 'Working ✓', es: 'Trabajando ✓' }),
    closedCell: pickLang(lang, { ar: 'مغلق', fr: 'Fermé', amz: 'ⵉⵇⵇⵏ', en: 'Closed', es: 'Cerrado' }),
    outOfHoursCell: pickLang(lang, { ar: 'خارج الدوام', fr: 'Hors horaire', amz: 'ⴱⵕⵕⴰ ⵏ ⵜⵡⵓⵔⵉ', en: 'Off Hours', es: 'Fuera horario' }),
    dayOffCell: pickLang(lang, { ar: 'يوم عطلة', fr: 'Jour de repos', amz: 'ⴰⵙⵙ ⵏ ⵓⵙⵓⵏⴼⵓ', en: 'Day Off', es: 'Día libre' }),
    dailyBreakCell: pickLang(lang, { ar: '⏸ استراحة يومية', fr: '⏸ Pause quot.', amz: '⏸ ⴰⵙⵓⵏⴼⵓ ⵏ ⴽⵓ ⴰⵙⵙ', en: '⏸ Daily Break', es: '⏸ Pausa diaria' }),
    breakCell: pickLang(lang, { ar: '⏸ استراحة', fr: '⏸ Bloqué', amz: '⏸ ⵉⵇⵇⵏ', en: '⏸ Blocked', es: '⏸ Bloqueado' }),
    availCell: pickLang(lang, { ar: '✓ متاح', fr: '✓ Libre', amz: '✓ ⵉⵍⵍⴰ', en: '✓ Open', es: '✓ Libre' }),
    dailyBreaksTitle: pickLang(lang, {
      ar: 'ساعات الاستراحة الدائمة كل يوم (Daily Break)',
      fr: 'Heures de pause quotidienne récurrente',
      amz: 'ⵜⵉⵙⵔⴰⴳⵉⵏ ⵏ ⵓⵙⵓⵏⴼⵓ ⵏ ⴽⵓ ⴰⵙⵙ',
      en: 'Recurring Daily Break Hours',
      es: 'Horas de pausa diaria recurrente',
    }),
    weeklyOffTitle: pickLang(lang, {
      ar: 'أيام العطلة الأسبوعية المتكررة',
      fr: 'Jours de repos hebdomadaires récurrents',
      amz: 'ⵓⵙⵙⴰⵏ ⵏ ⵓⵙⵓⵏⴼⵓ ⵏ ⴽⵓ ⵉⵎⴰⵍⴰⵙⵙ',
      en: 'Recurring Weekly Off-Days',
      es: 'Días libres semanales',
    }),
    offBadge: pickLang(lang, { ar: 'عطلة', fr: 'Repos', amz: 'ⵉⵇⵇⵏ', en: 'Off', es: 'Libre' }),
    workBadge: pickLang(lang, { ar: 'عمل', fr: 'Travail', amz: 'ⵜⴰⵡⵓⵔⵉ', en: 'Work', es: 'Activo' }),
    customOffTitle: pickLang(lang, {
      ar: 'إضافة تاريخ عطلة مخصص',
      fr: 'Ajouter une date d’absence spécifique',
      amz: 'ⵔⵏⵓ ⴰⵣⵎⵣ ⵏ ⵓⵙⵓⵏⴼⵓ',
      en: 'Add Specific Off Date',
      es: 'Añadir fecha libre',
    }),
    closeDateBtn: pickLang(lang, { ar: 'إغلاق', fr: 'Fermer', amz: 'ⵇⵇⵏ', en: 'Block', es: 'Bloquear' }),
    noOffDates: pickLang(lang, {
      ar: 'لا توجد تواريخ عطلة مضافة.',
      fr: 'Aucune date d’absence enregistrée.',
      amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⵣⵎⴰⵣ ⵏ ⵓⵙⵓⵏⴼⵓ.',
      en: 'No custom off dates added.',
      es: 'No hay fechas libres añadidas.',
    }),
  };

  const persistUpdate = async (next: BarberScheduleConfig, successMsg: string) => {
    setSaving(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);
      const cutoffStr = formatDateYMD(cutoff);

      const cleaned: BarberScheduleConfig = {
        ...next,
        offDates: next.offDates.filter((d) => d >= cutoffStr),
        dateSlotBlocks: next.dateSlotBlocks.filter((entry) => entry.split('@')[0] >= cutoffStr),
      };

      await saveBarberSchedule(cleaned);
      sendDualAlert(ui.updatedTitle, {
        body: successMsg,
        type: 'success',
        skipSound: true,
      });
    } catch (err) {
      console.error('Failed to save barber schedule:', err);
      sendDualAlert(ui.saveErrTitle, {
        body: ui.saveErrBody,
        type: 'warning',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDateAvailability = (dateStr: string, weekday: number) => {
    if (weekday === 1) return;
    const isRecurringOff = activeConfig.offWeekdays.includes(weekday);
    if (isRecurringOff) {
      const nextWeekdays = activeConfig.offWeekdays.filter((d) => d !== weekday);
      const wName = WEEKDAY_LABELS[weekday]?.[lang] || dateStr;
      persistUpdate(
        { ...activeConfig, offWeekdays: nextWeekdays },
        pickLang(lang, {
          ar: `تم تفعيل العمل يوم ${wName}.`,
          fr: `Service activé pour ${wName}.`,
          amz: `ⵜⵜⵓⵔⵥⵎ ⵜⵡⵓⵔⵉ ⴰⵙⵙ ⵏ ${wName}.`,
          en: `Workday enabled for ${wName}.`,
          es: `Día laboral activado para ${wName}.`,
        })
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
        ? pickLang(lang, {
            ar: `تم فتح الحجز بتاريخ ${dateStr} بنجاح.`,
            fr: `Réservations rouvertes le ${dateStr}.`,
            amz: `ⵉⵜⵜⵓⵔⵥⵎ ⵓⵙⵔⵓⵙ ⴳ ${dateStr}.`,
            en: `Reopened bookings for ${dateStr}.`,
            es: `Reservas reabiertas para ${dateStr}.`,
          })
        : pickLang(lang, {
            ar: `تم إغلاق يوم ${dateStr} (عطلة للحلاق).`,
            fr: `Journée du ${dateStr} marquée comme repos.`,
            amz: `ⵉⵇⵇⵏ ⴰⵙⵙ ⵏ ${dateStr}.`,
            en: `Marked ${dateStr} as barber day off.`,
            es: `Día ${dateStr} marcado como libre.`,
          })
    );
  };

  const handleToggleCalendarCell = (dateStr: string, slot: string) => {
    const key = `${dateStr}@${slot}`;
    const isSpecificBlocked = activeConfig.dateSlotBlocks.includes(key);
    const isRecurringBreak = activeConfig.breakSlots.includes(slot);

    if (isRecurringBreak && !isSpecificBlocked) {
      const nextBreaks = activeConfig.breakSlots.filter((s) => s !== slot);
      persistUpdate(
        { ...activeConfig, breakSlots: nextBreaks },
        pickLang(lang, {
          ar: `تمت إزالة الاستراحة اليومية الدائمة عند الساعة ${slot}.`,
          fr: `Pause quotidienne de ${slot} supprimée.`,
          amz: `ⵉⵜⵜⵓⴽⴽⵙ ⵓⵙⵓⵏⴼⵓ ⵏ ${slot}.`,
          en: `Removed recurring daily break at ${slot}.`,
          es: `Eliminada la pausa diaria de las ${slot}.`,
        })
      );
      return;
    }

    const nextBlocks = isSpecificBlocked
      ? activeConfig.dateSlotBlocks.filter((b) => b !== key)
      : [...activeConfig.dateSlotBlocks, key].sort();

    persistUpdate(
      { ...activeConfig, dateSlotBlocks: nextBlocks },
      isSpecificBlocked
        ? pickLang(lang, {
            ar: `تمت إعادة فتح الساعة ${slot} بتاريخ ${dateStr}.`,
            fr: `Créneau ${slot} rouvert le ${dateStr}.`,
            amz: `ⵉⵜⵜⵓⵔⵥⵎ ${slot} ⴳ ${dateStr}.`,
            en: `Reopened ${slot} on ${dateStr}.`,
            es: `Reabierto ${slot} el ${dateStr}.`,
          })
        : pickLang(lang, {
            ar: `تم حجب الساعة ${slot} (استراحة/غداء) بتاريخ ${dateStr}.`,
            fr: `Créneau ${slot} bloqué (pause) le ${dateStr}.`,
            amz: `ⵉⵇⵇⵏ ${slot} ⴳ ${dateStr}.`,
            en: `Blocked ${slot} (break) on ${dateStr}.`,
            es: `Bloqueado ${slot} (pausa) el ${dateStr}.`,
          })
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
        ? pickLang(lang, {
            ar: `تمت إعادة فتح الساعة ${slot} لجميع أيام هذا الأسبوع.`,
            fr: `Créneau ${slot} rouvert pour toute la semaine.`,
            amz: `ⵉⵜⵜⵓⵔⵥⵎ ${slot} ⵉ ⵉⵎⴰⵍⴰⵙⵙ ⴰⴽⴽⵯ.`,
            en: `Reopened ${slot} for all days this week.`,
            es: `Reabierto ${slot} toda la semana.`,
          })
        : pickLang(lang, {
            ar: `تم حجب الساعة ${slot} للاستراحة طوال الأسبوع المحدد.`,
            fr: `Créneau ${slot} bloqué toute la semaine.`,
            amz: `ⵉⵇⵇⵏ ${slot} ⵉ ⵉⵎⴰⵍⴰⵙⵙ ⴰⴽⴽⵯ.`,
            en: `Blocked ${slot} for the whole selected week.`,
            es: `Bloqueado ${slot} toda la semana.`,
          })
    );
  };

  const handleToggleWeekday = (dayIdx: number) => {
    const exists = activeConfig.offWeekdays.includes(dayIdx);
    const nextDays = exists
      ? activeConfig.offWeekdays.filter((d) => d !== dayIdx)
      : [...activeConfig.offWeekdays, dayIdx];
    persistUpdate(
      { ...activeConfig, offWeekdays: nextDays },
      pickLang(lang, {
        ar: 'تم تحديث أيام العطلة الأسبوعية المتكررة للحلاق.',
        fr: 'Jours de repos hebdomadaires mis à jour.',
        amz: 'ⵜⵜⵓⵙⵎⴰⵢⵏⵓⵏ ⵓⵙⵙⴰⵏ ⵏ ⵓⵙⵓⵏⴼⵓ.',
        en: 'Updated recurring weekly off-days.',
        es: 'Días libres semanales actualizados.',
      })
    );
  };

  const handleToggleBreakSlot = (slot: string) => {
    const exists = activeConfig.breakSlots.includes(slot);
    const nextBreaks = exists
      ? activeConfig.breakSlots.filter((s) => s !== slot)
      : [...activeConfig.breakSlots, slot];
    persistUpdate(
      { ...activeConfig, breakSlots: nextBreaks },
      pickLang(lang, {
        ar: `تم تحديث الاستراحة اليومية الدائمة (${slot}).`,
        fr: `Pause quotidienne mise à jour (${slot}).`,
        amz: `ⵉⵜⵜⵓⵙⵎⴰⵢⵏⵓ ⵓⵙⵓⵏⴼⵓ (${slot}).`,
        en: `Updated recurring daily break (${slot}).`,
        es: `Pausa diaria actualizada (${slot}).`,
      })
    );
  };

  const handleAddOffDate = () => {
    if (!newOffDate) return;
    if (activeConfig.offDates.includes(newOffDate)) return;
    const nextDates = [...activeConfig.offDates, newOffDate].sort();
    setNewOffDate('');
    persistUpdate(
      { ...activeConfig, offDates: nextDates },
      pickLang(lang, {
        ar: `تمت إضافة يوم عطلة (${newOffDate}) ومنع الحجز فيه.`,
        fr: `Date d’absence ajoutée (${newOffDate}).`,
        amz: `ⵉⵜⵜⵓⵔⵏⴰ ⵡⴰⵙⵙ ⵏ ⵓⵙⵓⵏⴼⵓ (${newOffDate}).`,
        en: `Added off date (${newOffDate}).`,
        es: `Fecha libre añadida (${newOffDate}).`,
      })
    );
  };

  const handleRemoveOffDate = (d: string) => {
    const nextDates = activeConfig.offDates.filter((item) => item !== d);
    persistUpdate(
      { ...activeConfig, offDates: nextDates },
      pickLang(lang, {
        ar: `تمت إزالة يوم العطلة (${d}).`,
        fr: `Date d’absence retirée (${d}).`,
        amz: `ⵉⵜⵜⵓⴽⴽⵙ ⵡⴰⵙⵙ (${d}).`,
        en: `Removed off date (${d}).`,
        es: `Fecha libre eliminada (${d}).`,
      })
    );
  };

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
      {/* Top Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>{ui.headerTitle}</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">{ui.headerSub}</p>
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
                  <span>{b.name[lang] || b.name.ar || b.name.fr}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Week Navigation */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
              <span>{ui.prevWeek}</span>
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
              {ui.currWeek}
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>{ui.nextWeek}</span>
              <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
            <span className="text-zinc-400" dir="ltr">
              {weekDays[0].dateStr} → {weekDays[6].dateStr}
            </span>
            {saving && <span className="text-amber-400 font-sans font-bold">{ui.saving}</span>}
          </div>
        </div>
      </div>

      {/* Quick Weekly Break Bar & Legend */}
      <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5" />
            <span>{ui.quickLunchLabel}</span>
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
                {allBlocked ? ui.unblockWeek(preset) : ui.blockWeek(preset)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded bg-emerald-600/40 border border-emerald-500/60 inline-block" />
            {ui.legendAvail}
          </span>
          <span className="flex items-center gap-1 text-red-300">
            <span className="w-2.5 h-2.5 rounded bg-red-900/60 border border-red-500/60 inline-block" />
            {ui.legendBreak}
          </span>
          <span className="flex items-center gap-1 text-blue-300">
            <span className="w-2.5 h-2.5 rounded bg-blue-900/60 border border-blue-500/60 inline-block" />
            {ui.legendBooked}
          </span>
          <span className="flex items-center gap-1 text-zinc-400">
            <span className="w-2.5 h-2.5 rounded bg-zinc-800 border border-zinc-700 inline-block" />
            {ui.legendOff}
          </span>
        </div>
      </div>

      {/* Interactive 7-Day Weekly Calendar Grid */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-center">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="p-3 text-start font-black text-zinc-400 w-24 border-e border-zinc-800/80">
                  {ui.timeCol}
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
                      className={`p-2.5 border-e border-zinc-800/70 align-top ${
                        isToday ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`font-black text-xs ${isToday ? 'text-amber-300' : 'text-white'}`}>
                            {day.label[lang] || day.label.ar}
                          </span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-[9px] font-black">
                              {ui.todayTag}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400 tabular-nums">
                          {day.shortDate}
                        </div>

                        {isMondayClosed ? (
                          <div className="py-1 px-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-[10px] font-bold">
                            {ui.salonClosedMon}
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
                            {isBarberOff ? ui.barberOffBtn : ui.barberOnBtn}
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
                    className="p-2.5 font-mono font-black text-xs text-zinc-300 bg-zinc-950/70 border-e border-zinc-800/80 tabular-nums"
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
                          className="p-1.5 border-e border-zinc-800/60 bg-zinc-950/40"
                        >
                          <div className="py-2 rounded-lg text-[10px] text-zinc-600 font-medium">
                            {isMonday
                              ? ui.closedCell
                              : !inSalonHours
                              ? ui.outOfHoursCell
                              : ui.dayOffCell}
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
                          className="p-1.5 border-e border-zinc-800/60"
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

                    const barberDisp = activeBarber.name[lang] || activeBarber.name.ar || activeBarber.name.fr;

                    return (
                      <td
                        key={`${day.dateStr}-${slot}`}
                        className="p-1.5 border-e border-zinc-800/60"
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
                              ? `${slot}`
                              : isSpecificBlock
                              ? `${slot} (${day.dateStr})`
                              : `${barberDisp} — ${slot}`
                          }
                        >
                          {isBlocked
                            ? isRecurringBreak
                              ? ui.dailyBreakCell
                              : ui.breakCell
                            : ui.availCell}
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

      {/* Bottom Rule Helpers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
          <div className="font-bold text-amber-300">{ui.dailyBreaksTitle}</div>
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

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
          <div className="font-bold text-amber-300">{ui.weeklyOffTitle}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
              const isOff = activeConfig.offWeekdays.includes(dayIdx) || dayIdx === 1;
              return (
                <button
                  key={dayIdx}
                  type="button"
                  disabled={dayIdx === 1 || saving}
                  onClick={() => handleToggleWeekday(dayIdx)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-between transition-all ${
                    dayIdx === 1
                      ? 'bg-red-950/40 border-red-500/40 text-red-400 cursor-not-allowed opacity-80'
                      : isOff
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 cursor-pointer'
                      : 'bg-black/40 border-zinc-800 text-zinc-300 hover:border-zinc-600 cursor-pointer'
                  }`}
                >
                  <span className="truncate">{WEEKDAY_LABELS[dayIdx]?.[lang] || WEEKDAY_LABELS[dayIdx]?.ar}</span>
                  <span>{isOff ? ui.offBadge : ui.workBadge}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
          <div className="font-bold text-white flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-red-400" />
            <span>{ui.customOffTitle}</span>
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
              <span>{ui.closeDateBtn}</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {activeConfig.offDates.length === 0 ? (
              <span className="text-[11px] text-zinc-500">{ui.noOffDates}</span>
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
  const { lang } = useLanguage();
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
      sendDualAlert(
        c.isVip
          ? pickLang(lang, {
              ar: 'تمت إزالة وسم VIP',
              fr: 'Badge VIP retiré',
              amz: 'ⵉⵜⵜⵓⴽⴽⵙ VIP',
              en: 'VIP Badge Removed',
              es: 'Insignia VIP eliminada',
            })
          : pickLang(lang, {
              ar: 'تمت ترقية الزبون إلى VIP 👑',
              fr: 'Client promu VIP 👑',
              amz: 'ⵉⵜⵜⵓⵙⵎⵓⵇⵇⵍ ⵖⵔ VIP 👑',
              en: 'Client Upgraded to VIP 👑',
              es: 'Cliente ascendido a VIP 👑',
            }),
        {
          body: `${c.clientName} (${c.phoneDisplay})`,
          type: 'success',
          skipSound: true,
        }
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRedeemFreeWash = async (c: typeof clients[number]) => {
    setBusyId(c.id);
    try {
      await redeemClientFreeWash(c.phoneDisplay, c.clientName, crmMap);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم تسجيل مكافأة الغسل المجاني 🎁',
          fr: 'Shampoing gratuit enregistré 🎁',
          amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵙⵉⵔⴷ ⴼⴰⴱⵓⵔ 🎁',
          en: 'Free Wash Reward Recorded 🎁',
          es: 'Lavado gratis registrado 🎁',
        }),
        {
          body: `${c.clientName}`,
          type: 'success',
          skipSound: true,
        }
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCustomDiscount = async (c: typeof clients[number]) => {
    const promptTxt = pickLang(lang, {
      ar: `أدخل قيمة تخفيض الولاء بالدرهم (MAD) للزبون ${c.clientName} (أدخل 0 لإلغاء التخفيض):`,
      fr: `Entrez la réduction fidélité (MAD) pour ${c.clientName} (0 pour annuler) :`,
      amz: `ⵙⵙⴽⵛⵎ ⴰⵙⵉⴷⵔ (MAD) ⵉ ${c.clientName} (0 ⵉ ⵓⵙⵔⵓⵙ) :`,
      en: `Enter loyalty discount in MAD for ${c.clientName} (0 to clear):`,
      es: `Introduce el descuento de fidelidad en MAD para ${c.clientName} (0 para anular):`,
    });
    const val = window.prompt(promptTxt, String(c.customDiscountMAD || 10));
    if (val === null) return;
    const amount = Number(val);
    if (!Number.isFinite(amount) || amount < 0) return;

    setBusyId(c.id);
    try {
      await grantClientCustomDiscount(
        c.phoneDisplay,
        c.clientName,
        amount,
        amount > 0 ? `🎁 -${amount} MAD` : '',
        crmMap
      );
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم تحديث تخفيض الولاء ✅',
          fr: 'Réduction fidélité mise à jour ✅',
          amz: 'ⵉⵜⵜⵓⵙⵎⴰⵢⵏⵓ ⵓⵙⵉⴷⵔ ✅',
          en: 'Loyalty Discount Updated ✅',
          es: 'Descuento actualizado ✅',
        }),
        {
          body:
            amount > 0
              ? `-${amount} MAD (${c.clientName})`
              : pickLang(lang, {
                  ar: 'تم إلغاء التخفيض الخاص.',
                  fr: 'Réduction annulée.',
                  amz: 'ⵉⵜⵜⵓⴽⴽⵙ ⵓⵙⵉⴷⵔ.',
                  en: 'Custom discount cleared.',
                  es: 'Descuento eliminado.',
                }),
          type: 'success',
          skipSound: true,
        }
      );
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
        nextBanned
          ? pickLang(lang, {
              ar: 'حظر يدوي من لوحة التحكم',
              fr: 'Blocage manuel par l’administration',
              amz: 'ⴰⵙⵇⵏ ⵙⴳ ⵜⴼⵍⵡⵉⵜ ⵏ ⵓⵙⵡⵓⴷⴷⵓ',
              en: 'Manual blacklist from Admin Dashboard',
              es: 'Bloqueo manual desde el panel',
            })
          : pickLang(lang, {
              ar: 'تم رفع الحظر يدوياً من طرف الإدارة',
              fr: 'Débloqué manuellement par l’administration',
              amz: 'ⵉⵜⵜⵓⴽⴽⵙ ⵓⵙⵇⵏ ⵙⴳ ⵜⵎⵙⵙⵓⴳⵓⵔⵜ',
              en: 'Manually unbanned by Admin',
              es: 'Desbloqueado manualmente por Admin',
            }),
        crmMap
      );
      sendDualAlert(
        nextBanned
          ? pickLang(lang, {
              ar: 'تم إدراج الرقم في القائمة السوداء 🚫',
              fr: 'Numéro ajouté à la liste noire 🚫',
              amz: 'ⵉⵜⵜⵓⵔⵏⴰ ⵓⵟⵟⵓⵏ ⵖⵔ ⵜⵍⴳⴰⵎⵜ ⵜⴰⴱⵔⴽⴰⵏⵜ 🚫',
              en: 'Number Blacklisted 🚫',
              es: 'Número bloqueado 🚫',
            })
          : pickLang(lang, {
              ar: 'تم رفع الحظر بنجاح ✅',
              fr: 'Client débloqué avec succès ✅',
              amz: 'ⵉⵜⵜⵓⴽⴽⵙ ⵓⵙⵇⵏ ✅',
              en: 'Client Unbanned ✅',
              es: 'Cliente desbloqueado ✅',
            }),
        {
          body: `${c.clientName} (${c.phoneDisplay})`,
          type: nextBanned ? 'warning' : 'success',
          skipSound: true,
        }
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleExportCsv = () => {
    if (clients.length === 0) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'لا توجد بيانات للتصدير',
          fr: 'Aucune donnée à exporter',
          amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⵙⴼⴽⴰ',
          en: 'No Data to Export',
          es: 'Sin datos para exportar',
        }),
        {
          body: pickLang(lang, {
            ar: 'يرجى التأكد من وجود سجلات زبناء مطابقة قبل تصدير ملف CSV.',
            fr: 'Vérifiez qu’il existe des fiches clients correspondant au filtre.',
            amz: 'ⵙⵙⴼⵇⴷ ⵉⴼⵉⵍⴰⵡⵏ ⵏ ⵉⵎⵙⴰⵖⵏ.',
            en: 'Ensure matching client records exist before exporting CSV.',
            es: 'Asegúrate de tener clientes antes de exportar.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }

    const result = downloadCrmAccountingCsv(clients);
    sendDualAlert(
      pickLang(lang, {
        ar: 'تم تصدير سجل CRM والمحاسبة بنجاح ✓',
        fr: 'Export CSV CRM & Comptabilité réussi ✓',
        amz: 'ⵉⵜⵜⵓⵙⵉⴼⴹ CSV ⵏ CRM ✓',
        en: 'CRM & Accounting CSV Exported ✓',
        es: 'CSV de CRM y contabilidad exportado ✓',
      }),
      {
        body: `${result.clientCount} · ${result.rowCount} (${result.completedRevenueMAD} MAD)`,
        type: 'success',
        skipSound: true,
      }
    );
  };

  const ui = {
    title: pickLang(lang, {
      ar: 'سجل الزبناء، برنامج الولاء والقائمة السوداء (CRM)',
      fr: 'Clients CRM, Fidélité, VIP & Liste Noire',
      amz: 'ⵉⵎⵙⴰⵖⵏ CRM, ⵜⴰⵖⵓⵏⵉ ⴷ ⵜⵍⴳⴰⵎⵜ ⵜⴰⴱⵔⴽⴰⵏⵜ',
      en: 'Client CRM, Loyalty, VIP & Blacklist',
      es: 'Clientes CRM, Fidelidad, VIP y Lista Negra',
    }),
    subtitle: pickLang(lang, {
      ar: 'تتبع تلقائي لعدد الزيارات عبر رقم الهاتف، مكافأة الغسل المجاني في الزيارة 5، وحظر تلقائي بعد تغيّبين (2 No-Shows) مع إمكانية رفع الحظر يدوياً.',
      fr: 'Suivi automatique par téléphone, récompense au 5e passage et blocage automatique après 2 absences (No-Shows) avec levée manuelle.',
      amz: 'ⴰⴹⴼⴰⵕ ⵏ ⵜⵔⵣⵉⵡⵉⵏ ⵙ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⴷ ⵓⵙⵉⵔⴷ ⴼⴰⴱⵓⵔ ⴳ ⵜⵉⵙ 5.',
      en: 'Automatic visit tracking by phone, free wash milestone at visit 5, and auto-blacklist after 2 no-shows with manual override.',
      es: 'Seguimiento automático por teléfono, lavado gratis en la visita 5 y bloqueo tras 2 ausencias.',
    }),
    exportCsv: pickLang(lang, {
      ar: 'تصدير CSV',
      fr: 'Exporter CSV',
      amz: 'ⵙⵉⴼⴹ CSV',
      en: 'Export CSV',
      es: 'Exportar CSV',
    }),
    searchPlaceholder: pickLang(lang, {
      ar: 'بحث باسم الزبون أو رقم الهاتف...',
      fr: 'Rechercher par nom ou téléphone...',
      amz: 'ⵔⵣⵓ ⵙ ⵢⵉⵙⵎ ⵏⵖ ⵓⵟⵟⵓⵏ...',
      en: 'Search by client name or phone...',
      es: 'Buscar por nombre o teléfono...',
    }),
    filterAll: pickLang(lang, { ar: 'الكل', fr: 'Tous', amz: 'ⴰⴽⴽⵯ', en: 'All', es: 'Todos' }),
    filterVip: 'VIP 👑',
    filterLoyalty: pickLang(lang, { ar: 'مكافآت الولاء 🎁', fr: 'Fidélité 🎁', amz: 'ⵜⴰⵖⵓⵏⵉ 🎁', en: 'Loyalty 🎁', es: 'Fidelidad 🎁' }),
    filterBanned: pickLang(lang, { ar: 'القائمة السوداء 🚫', fr: 'Liste noire 🚫', amz: 'ⵜⴰⵍⴳⴰⵎⵜ ⵜⴰⴱⵔⴽⴰⵏⵜ 🚫', en: 'Blacklist 🚫', es: 'Bloqueados 🚫' }),
    empty: pickLang(lang, {
      ar: 'لا توجد ملفات زبناء مطابقة للبحث.',
      fr: 'Aucun profil client correspondant.',
      amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⵎⵙⴰⵖⵏ.',
      en: 'No matching client profiles found.',
      es: 'No se encontraron clientes.',
    }),
    bannedBadge: pickLang(lang, { ar: '🚫 محظور', fr: '🚫 Bloqué', amz: '🚫 ⵉⵇⵇⵏ', en: '🚫 Blacklisted', es: '🚫 Bloqueado' }),
    freeWashBadge: pickLang(lang, { ar: '🎁 مستحق لغسل مجاني', fr: '🎁 Shampoing offert dû', amz: '🎁 ⴰⵙⵉⵔⴷ ⴼⴰⴱⵓⵔ', en: '🎁 Free Wash Earned', es: '🎁 Lavado gratis' }),
    qrBtn: pickLang(lang, { ar: 'QR الملف', fr: 'QR Profil', amz: 'QR ⵏ ⵓⵎⵙⴰⵖ', en: 'Profile QR', es: 'QR Perfil' }),
    visitsCol: pickLang(lang, { ar: 'الزيارات المؤكدة', fr: 'Visites validées', amz: 'ⵜⵉⵔⵣⵉⵡⵉⵏ', en: 'Verified Visits', es: 'Visitas' }),
    spendCol: pickLang(lang, { ar: 'إجمالي الإنفاق', fr: 'Total dépensé', amz: 'ⵜⴰⵎⵙⴰⵖⵜ', en: 'Lifetime Spend', es: 'Gasto total' }),
    noShowCol: pickLang(lang, { ar: 'التغيب (No-Show)', fr: 'Absences (No-Show)', amz: 'ⴰⵏⴼⴰⵍ (No-Show)', en: 'No-Shows', es: 'Ausencias' }),
    activeDiscount: (amt: number) =>
      pickLang(lang, {
        ar: `🎁 تخفيض ولاء مفعل تلقائياً بالحجز القادم: -${amt} MAD`,
        fr: `🎁 Réduction auto sur le prochain RDV : -${amt} MAD`,
        amz: `🎁 ⴰⵙⵉⴷⵔ ⵉⵜⵜⵓⵙⵎⵔⴰⵙⵏ ⴳ ⵓⵙⵉⵀⵍ ⴷ ⵉⴷⴷⴰⵏ: -${amt} MAD`,
        en: `🎁 Auto loyalty discount on next booking: -${amt} MAD`,
        es: `🎁 Descuento automático en la próxima cita: -${amt} MAD`,
      }),
    removeVip: pickLang(lang, { ar: 'إزالة VIP', fr: 'Retirer VIP', amz: 'ⴽⴽⵙ VIP', en: 'Remove VIP', es: 'Quitar VIP' }),
    upgradeVip: pickLang(lang, { ar: 'ترقية VIP', fr: 'Passer VIP', amz: 'ⵙⵎⵓⵇⵇⵍ VIP', en: 'Make VIP', es: 'Hacer VIP' }),
    freeWashBtn: (n: number) =>
      pickLang(lang, {
        ar: `غسل مجاني (${n})`,
        fr: `Shampoing (${n})`,
        amz: `ⴰⵙⵉⵔⴷ (${n})`,
        en: `Free Wash (${n})`,
        es: `Lavado (${n})`,
      }),
    discountBtn: pickLang(lang, { ar: 'تخفيض MAD', fr: 'Réduc. MAD', amz: 'ⴰⵙⵉⴷⵔ MAD', en: 'Discount MAD', es: 'Descuento MAD' }),
    unbanBtn: pickLang(lang, { ar: 'رفع الحظر', fr: 'Débloquer', amz: 'ⵔⵥⵎ', en: 'Unban', es: 'Desbloquear' }),
    banBtn: pickLang(lang, { ar: 'حظر الرقم', fr: 'Bloquer', amz: 'ⵇⵇⵏ', en: 'Blacklist', es: 'Bloquear' }),
    trackBtn: pickLang(lang, { ar: 'التتبع', fr: 'Suivi', amz: 'ⴰⴹⴼⴰⵕ', en: 'Track', es: 'Seguir' }),
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>{ui.title}</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">{ui.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={clients.length === 0}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-500/45 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{ui.exportCsv}</span>
            <span className="font-mono text-[10px] opacity-85 tabular-nums">
              ({clients.length})
            </span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-500 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={ui.searchPlaceholder}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl ps-9 pe-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              { id: 'all', label: ui.filterAll },
              { id: 'vip', label: ui.filterVip },
              { id: 'loyalty', label: ui.filterLoyalty },
              { id: 'banned', label: ui.filterBanned },
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
          {ui.empty}
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
                          {ui.bannedBadge}
                        </span>
                      )}
                      {c.eligibleFreeWashes > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600/25 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold">
                          {ui.freeWashBadge}
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
                    >
                      <QrCode className="w-4 h-4" />
                      <span>{ui.qrBtn}</span>
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

                {(() => {
                  const loyalty = computeLoyaltyProgress(c.verifiedVisits, lang);
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-black/50 border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">{ui.visitsCol}</span>
                          <span className="font-mono font-black text-amber-300 text-sm tabular-nums">
                            {c.verifiedVisits}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/50 border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">{ui.spendCol}</span>
                          <span className="font-mono font-black text-emerald-300 text-sm tabular-nums">
                            {c.lifetimeSpendMAD} MAD
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/50 border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">{ui.noShowCol}</span>
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
                        {ui.activeDiscount(c.customDiscountMAD)}
                      </div>
                    )}
                    {c.rewardNote && <div className="text-amber-300">{c.rewardNote}</div>}
                    {c.isBanned && c.banReason && (
                      <div className="text-red-300">{c.banReason}</div>
                    )}
                  </div>
                )}

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
                    <span>{c.isVip ? ui.removeVip : ui.upgradeVip}</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleRedeemFreeWash(c)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Gift className="w-3 h-3" />
                    <span>{ui.freeWashBtn(c.freeWashesRedeemed)}</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleCustomDiscount(c)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{ui.discountBtn}</span>
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
                        <span>{ui.unbanBtn}</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-3 h-3" />
                        <span>{ui.banBtn}</span>
                      </>
                    )}
                  </button>
                  {onOpenClientTracking && (
                    <button
                      type="button"
                      onClick={() => onOpenClientTracking(c.phoneDisplay || c.normalizedPhone || c.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3 text-amber-400" />
                      <span>{ui.trackBtn}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
  const { lang } = useLanguage();
  const visible = entries.filter((e) =>
    role === 'master' ? true : e.barberId === ownBarberId
  );

  const ui = {
    title: pickLang(lang, {
      ar: 'قائمة الانتظار الذكية (Smart Waitlist)',
      fr: 'Liste d’Attente Intelligente (Waitlist)',
      amz: 'ⵜⴰⵍⴳⴰⵎⵜ ⵏ ⵓⴳⴰⵏⵉ ⵜⴰⵎⵉⵖⵉⵙⵜ',
      en: 'Smart Waitlist Queue',
      es: 'Lista de Espera Inteligente',
    }),
    subtitle: pickLang(lang, {
      ar: 'الزبناء المسجلون عند امتلاء المواعيد. راسلهم عبر واتساب فور إلغاء أو شغور أي مقعد!',
      fr: 'Clients inscrits lorsque le planning est complet. Contactez-les sur WhatsApp dès qu’un créneau se libère.',
      amz: 'ⵉⵎⵙⴰⵖⵏ ⵉⵣⵎⵎⴻⵎⵏ ⵎⴰ ⵉⵜⵜⵓⵃⵊⵣ ⵓⵙⴰⵍⵓⵏ. ⴰⵣⵏ ⴰⵙⵏ ⴳ ⵡⴰⵜⵙⴰⴱ.',
      en: 'Clients queued when slots are full. Message them via WhatsApp when a seat opens!',
      es: 'Clientes en espera cuando los horarios están llenos. Contáctalos por WhatsApp si queda hueco.',
    }),
    waitingBadge: (n: number) =>
      pickLang(lang, {
        ar: `${n} في الانتظار`,
        fr: `${n} en attente`,
        amz: `${n} ⴳ ⵓⴳⴰⵏⵉ`,
        en: `${n} waiting`,
        es: `${n} en espera`,
      }),
    empty: pickLang(lang, {
      ar: 'لا يوجد أي زبناء في قائمة الانتظار حالياً.',
      fr: 'Aucun client en liste d’attente actuellement.',
      amz: 'ⵓⵔ ⵉⵍⵍⵉ ⵓⵎⵙⴰⵖ ⴳ ⵓⴳⴰⵏⵉ.',
      en: 'No clients currently on the waitlist.',
      es: 'No hay clientes en la lista de espera.',
    }),
    statusWaiting: pickLang(lang, { ar: 'في الانتظار', fr: 'En attente', amz: 'ⴳ ⵓⴳⴰⵏⵉ', en: 'Waiting', es: 'En espera' }),
    statusNotified: pickLang(lang, { ar: 'تم التواصل معه', fr: 'Contacté', amz: 'ⵉⵜⵜⵓⵙⵉⵡⵍ', en: 'Contacted', es: 'Contactado' }),
    statusConverted: pickLang(lang, { ar: 'تم الحجز ✓', fr: 'Converti ✓', amz: 'ⵉⵜⵜⵓⵃⵊⵣ ✓', en: 'Booked ✓', es: 'Reservado ✓' }),
    statusCancelled: pickLang(lang, { ar: 'ملغى', fr: 'Annulé', amz: 'ⵉⵜⵜⵓⵙⵔ', en: 'Cancelled', es: 'Cancelado' }),
    waBtn: pickLang(lang, { ar: 'إخبار عبر واتساب', fr: 'Notifier WhatsApp', amz: 'ⴰⵣⵏ ⴳ ⵡⴰⵜⵙⴰⴱ', en: 'Notify WhatsApp', es: 'Avisar WhatsApp' }),
    convertedBtn: pickLang(lang, { ar: 'تم التحويل لحجز', fr: 'Marquer réservé', amz: 'ⵉⵜⵜⵓⵙⵏⴼⵍ ⵉ ⵓⵙⵉⵀⵍ', en: 'Mark Booked', es: 'Convertido a cita' }),
    deleteTitle: pickLang(lang, { ar: 'حذف', fr: 'Supprimer', amz: 'ⴽⴽⵙ', en: 'Delete', es: 'Eliminar' }),
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <ListPlus className="w-4 h-4 text-blue-400" />
            <span>{ui.title}</span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">{ui.subtitle}</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold">
          {ui.waitingBadge(visible.filter((e) => e.status === 'waiting').length)}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-400">
          {ui.empty}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((entry) => {
            const clientWa = formatMoroccanWhatsAppNumber(entry.clientPhone);
            const waText = pickLang(lang, {
              ar: `مرحباً ${entry.clientName}، معك صالون بومليك! توفر الآن مكان شاغر بتاريخ ${entry.date} مع ${entry.barberName} (توقيتك المفضل: ${entry.preferredTime}). هل ترغب في تأكيد الحجز الآن؟`,
              fr: `Bonjour ${entry.clientName}, ici Salon Boumlik ! Un créneau vient de se libérer le ${entry.date} avec ${entry.barberName} (heure souhaitée : ${entry.preferredTime}). Souhaitez-vous confirmer le rendez-vous ?`,
              amz: `Azul ${entry.clientName}, ⵙⴳ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ! ⵉⵍⵍⴰ ⵓⵎⴽⴰⵏ ⴰⵙⵙ ⵏ ${entry.date} ⴷ ${entry.barberName} (${entry.preferredTime}). ⵉⵙ ⵜⵔⵉⴷ ⴰⴷ ⵜⵙⴷⵓⴷ ⴰⵙⵉⵀⵍ ?`,
              en: `Hello ${entry.clientName}, this is Salon Boumlik! A spot just opened on ${entry.date} with ${entry.barberName} (preferred time: ${entry.preferredTime}). Would you like to confirm now?`,
              es: `Hola ${entry.clientName}, te contactamos de Salon Boumlik. Quedó libre una cita el ${entry.date} con ${entry.barberName} (hora: ${entry.preferredTime}). ¿Quieres confirmarla?`,
            });
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
                        ? ui.statusWaiting
                        : entry.status === 'notified'
                        ? ui.statusNotified
                        : entry.status === 'converted'
                        ? ui.statusConverted
                        : ui.statusCancelled}
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
                    <span>{ui.waBtn}</span>
                  </a>

                  {entry.status !== 'converted' && (
                    <button
                      type="button"
                      onClick={() => updateWaitlistStatus(entry.id, 'converted')}
                      className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{ui.convertedBtn}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteWaitlistEntry(entry.id)}
                    className="p-1.5 rounded-xl bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 border border-zinc-700 cursor-pointer"
                    title={ui.deleteTitle}
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

function formatQueueDelta(slotMinutes: number, nowMinutes: number, lang: Language): {
  label: string;
  tone: 'now' | 'upcoming' | 'overdue';
} {
  const diff = slotMinutes - nowMinutes;
  if (diff >= -15 && diff <= 20) {
    return {
      label: pickLang(lang, {
        ar: 'الآن · جاهز',
        fr: 'Maintenant · Prêt',
        amz: 'ⴷⵖⵉ · ⵉⵀⵢⵢⴰ',
        en: 'Now · Ready',
        es: 'Ahora · Listo',
      }),
      tone: 'now',
    };
  }
  if (diff > 20) {
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    const text =
      hrs > 0
        ? pickLang(lang, {
            ar: `بعد ${hrs}س ${mins > 0 ? `${mins}د` : ''}`,
            fr: `Dans ${hrs}h ${mins > 0 ? `${mins}m` : ''}`,
            amz: `ⴷⴼⴼⵉⵔ ${hrs}h ${mins > 0 ? `${mins}m` : ''}`,
            en: `In ${hrs}h ${mins > 0 ? `${mins}m` : ''}`,
            es: `En ${hrs}h ${mins > 0 ? `${mins}m` : ''}`,
          })
        : pickLang(lang, {
            ar: `بعد ${mins} دقيقة`,
            fr: `Dans ${mins} min`,
            amz: `ⴷⴼⴼⵉⵔ ${mins} min`,
            en: `In ${mins} min`,
            es: `En ${mins} min`,
          });
    return { label: text.trim(), tone: 'upcoming' };
  }
  const lateMins = Math.abs(diff);
  const hrs = Math.floor(lateMins / 60);
  const mins = lateMins % 60;
  const text =
    hrs > 0
      ? pickLang(lang, {
          ar: `تجاوز بـ ${hrs}س ${mins > 0 ? `${mins}د` : ''}`,
          fr: `En retard de ${hrs}h ${mins > 0 ? `${mins}m` : ''}`,
          amz: `ⵉⵣⵔⵉ ${hrs}h ${mins > 0 ? `${mins}m` : ''}`,
          en: `${hrs}h ${mins > 0 ? `${mins}m ` : ''}overdue`,
          es: `Retraso ${hrs}h ${mins > 0 ? `${mins}m` : ''}`,
        })
      : pickLang(lang, {
          ar: `منذ ${lateMins} دقيقة`,
          fr: `Il y a ${lateMins} min`,
          amz: `ⵣⵉ ${lateMins} min`,
          en: `${lateMins}m ago`,
          es: `Hace ${lateMins} min`,
        });
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
  const { lang } = useLanguage();
  const [barberFilter, setBarberFilter] = useState<string>('all');
  const [nowDate, setNowDate] = useState<Date>(() => new Date());

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

  const nextInLine =
    queueItems.find((b) => parseSlotToMinutes(getEffectiveBookingTime(b)) >= nowMinutes - 20) ||
    queueItems[0] ||
    null;

  const getBarberColor = (b: AppointmentBooking) =>
    b.barberColor || TEAM_MEMBERS.find((m) => m.id === b.barberId)?.themeColor || '#D97706';

  const ui = {
    title: pickLang(lang, {
      ar: 'الطابور المباشر لليوم (Live Queue)',
      fr: 'File d’Attente en Direct (Live Queue)',
      amz: 'ⵜⴰⵍⴳⴰⵎⵜ ⵜⵓⵙⵔⵉⴷⵜ ⵏ ⴰⵙⵙ ⴰ',
      en: "Today's Live Queue",
      es: 'Cola en Vivo de Hoy',
    }),
    subtitle: pickLang(lang, {
      ar: 'قائمة فورية مرتبة زمنياً لجميع المواعيد النشطة اليوم لمعرفة الزبون التالي في الدور بنظرة واحدة.',
      fr: 'Liste chronologique en temps réel de tous les rendez-vous actifs du jour.',
      amz: 'ⵜⴰⵍⴳⴰⵎⵜ ⵉⵜⵜⵓⵙⵎⴰⵢⵏⵓⵏ ⵉ ⵎⴰⵕⵕⴰ ⵉⵙⵉⵀⴰⵍ ⵏ ⴰⵙⵙ ⴰ.',
      en: 'Chronological real-time list of active appointments today to spot who is next.',
      es: 'Lista en tiempo real de todas las citas activas de hoy por orden horario.',
    }),
    currTime: pickLang(lang, { ar: 'الوقت الحالي:', fr: 'Heure actuelle :', amz: 'ⵜⴰⵙⵔⴰⴳⵜ:', en: 'Current time:', es: 'Hora actual:' }),
    waitingLbl: pickLang(lang, { ar: 'في الانتظار:', fr: 'En attente :', amz: 'ⴳ ⵓⴳⴰⵏⵉ:', en: 'Waiting:', es: 'En espera:' }),
    doneTodayLbl: pickLang(lang, { ar: 'منجز اليوم:', fr: 'Terminés auj. :', amz: 'ⵉⵜⵜⵓⴳⴰⵏ ⴰⵙⵙ ⴰ:', en: 'Done today:', es: 'Hechos hoy:' }),
    allBarbers: pickLang(lang, { ar: 'جميع الحلاقين', fr: 'Tous les barbiers', amz: 'ⵎⴰⵕⵕⴰ ⵉⵎⴽⵔⴰⴹⵏ', en: 'All Barbers', es: 'Todos' }),
    nextInLineBadge: pickLang(lang, { ar: 'التالي في الدور · Next in Line', fr: 'Client suivant · Next in Line', amz: 'ⴰⵎⵙⴰⵖ ⴷ ⵉⴷⴷⴰⵏ', en: 'Next in Line', es: 'Siguiente en turno' }),
    priorityFull: pickLang(lang, { ar: '· أولوية تفادي الانتظار', fr: '· Priorité Coupe-File', amz: '· ⴰⵣⵡⴰⵔ ⵡⴰⵔ ⴰⴳⴰⵏⵉ', en: '· Queue Priority', es: '· Prioridad' }),
    priorityShort: pickLang(lang, { ar: '· أولوية', fr: '· Priorité', amz: '· ⴰⵣⵡⴰⵔ', en: '· Priority', es: '· Prioridad' }),
    defaultService: pickLang(lang, { ar: 'حلاقة وعناية', fr: 'Coiffure & soins', amz: 'ⴰⵙⵙⴼⵔⵓ ⴷ ⵓⵎⴽⵔⴰⴹ', en: 'Haircut & Grooming', es: 'Corte y cuidado' }),
    confirmBtn: pickLang(lang, { ar: 'تأكيد', fr: 'Confirmer', amz: 'ⵙⵙⴷⵓ', en: 'Confirm', es: 'Confirmar' }),
    attendanceBtn: pickLang(lang, { ar: 'تأكيد الحضور', fr: 'Valider présence', amz: 'ⵙⵙⴷⵓ ⴰⵡⵡⴰⴹ', en: 'Confirm Arrival', es: 'Confirmar llegada' }),
    presentBtn: pickLang(lang, { ar: 'حضر', fr: 'Présent', amz: 'ⵉⵡⵡⴹ', en: 'Attended', es: 'Asistió' }),
    cancelBtn: pickLang(lang, { ar: 'إلغاء', fr: 'Annuler', amz: 'ⵙⵔ', en: 'Cancel', es: 'Cancelar' }),
    trackBtn: pickLang(lang, { ar: 'تتبع', fr: 'Suivre', amz: 'ⴹⴼⵕ', en: 'Track', es: 'Seguir' }),
    emptyTitle: pickLang(lang, {
      ar: `لا توجد مواعيد نشطة في الطابور المباشر لليوم (${todayStr})`,
      fr: `Aucun rendez-vous actif dans la file d’aujourd’hui (${todayStr})`,
      amz: `ⵓⵔ ⵍⵍⵉⵏ ⵉⵙⵉⵀⴰⵍ ⴰⵙⵙ ⴰ (${todayStr})`,
      en: `No active appointments in today's queue (${todayStr})`,
      es: `No hay citas activas en la cola de hoy (${todayStr})`,
    }),
    emptySub: pickLang(lang, {
      ar: 'ستظهر أي حجوزات جديدة أو قادمة لهذا اليوم هنا تلقائياً ومباشرة.',
      fr: 'Toute nouvelle réservation pour aujourd’hui apparaîtra ici en temps réel.',
      amz: 'ⴽⵓ ⴰⵙⵉⵀⵍ ⴰⵎⴰⵢⵏⵓ ⵉ ⴰⵙⵙ ⴰ ⵔⴰⴷ ⵉⴱⴰⵏ ⴷⴰ.',
      en: 'Any new or upcoming appointments for today will appear here automatically.',
      es: 'Las nuevas reservas para hoy aparecerán aquí automáticamente.',
    }),
    statusConfirmed: pickLang(lang, { ar: 'مؤكد', fr: 'Confirmé', amz: 'ⵉⵜⵜⵓⵙⴷⵓ', en: 'Confirmed', es: 'Confirmada' }),
    statusRescheduled: pickLang(lang, { ar: 'معدل', fr: 'Reporté', amz: 'ⵉⵜⵜⵓⵙⵏⴼⵍ', en: 'Rescheduled', es: 'Reprogramada' }),
    statusPending: pickLang(lang, { ar: 'معلق', fr: 'En attente', amz: 'ⵉⵜⵜⵓⴳⴰⵏⵉ', en: 'Pending', es: 'Pendiente' }),
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Compact Header */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>{ui.title}</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">{ui.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px]">
            <span className="text-zinc-400">
              {ui.currTime} <strong className="text-white">{nowTimeLabel}</strong>
            </span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span className="text-emerald-400 font-bold">
              {ui.waitingLbl} {queueItems.length}
            </span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span className="text-zinc-300">
              {ui.doneTodayLbl} {completedTodayCount}
            </span>
          </div>
        </div>

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
              {ui.allBarbers} ({getLiveQueueBookings(bookings, todayStr, 'master', 'all', 'all').length})
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
                  <span>{member.name[lang] || member.name.ar || member.name.fr}</span>
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
        const delta = formatQueueDelta(slotMins, nowMinutes, lang);
        const bColor = getBarberColor(nextInLine);
        const crm = crmMap[getCrmDocId(nextInLine.clientPhone)];
        const isPriority = /تفادي الانتظار|Coupe-File|Queue Avoidance/i.test(
          nextInLine.notes || ''
        );

        return (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-zinc-900 to-zinc-900 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-emerald-300">
                <span>{ui.nextInLineBadge}</span>
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
                    {ui.priorityFull}
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
                  {(nextInLine.cartItemsSummary || []).map((i) => i.name).join(' · ') ||
                    ui.defaultService}
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
                  <span>{ui.confirmBtn}</span>
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
                <span>{ui.attendanceBtn}</span>
              </button>

              {onOpenClientTracking && (
                <button
                  type="button"
                  onClick={() => onOpenClientTracking(nextInLine.clientPhone)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>{ui.trackBtn}</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Compact Queue List */}
      {queueItems.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2">
          <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm font-bold text-zinc-300">{ui.emptyTitle}</p>
          <p className="text-[11px] text-zinc-500">{ui.emptySub}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-zinc-900/75 border border-zinc-800 overflow-hidden divide-y divide-zinc-800/80">
          {queueItems.map((booking, index) => {
            const effTime = getEffectiveBookingTime(booking);
            const slotMins = parseSlotToMinutes(effTime);
            const delta = formatQueueDelta(slotMins, nowMinutes, lang);
            const isNext = nextInLine?.id === booking.id;
            const barberColor = getBarberColor(booking);
            const crm = crmMap[getCrmDocId(booking.clientPhone)];
            const isPriority = /تفادي الانتظار|Coupe-File|Queue Avoidance/i.test(
              booking.notes || ''
            );
            const servicesLabel =
              (booking.cartItemsSummary || []).map((s) => s.name).join(' · ') ||
              ui.defaultService;

            return (
              <div
                key={booking.id}
                className={`p-3 sm:px-4 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 transition-colors ${
                  isNext ? 'bg-emerald-950/20' : 'hover:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
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
                    <div className="text-start min-w-[60px]">
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
                          {ui.priorityShort}
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
                          ? ui.statusConfirmed
                          : booking.status === 'rescheduled'
                          ? ui.statusRescheduled
                          : ui.statusPending}
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

                <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                  {booking.status === 'pending' && (
                    <button
                      type="button"
                      disabled={busyId === booking.id}
                      onClick={() => onConfirm(booking.id)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{ui.confirmBtn}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busyId === booking.id}
                    onClick={() => onMarkCompleted(booking)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {busyId === booking.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Award className="w-3.5 h-3.5" />
                    )}
                    <span>{ui.presentBtn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyId === booking.id}
                    onClick={() => onQuickCancel(booking)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-600 border border-red-500/40 text-red-200 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{ui.cancelBtn}</span>
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
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>

                  {onOpenClientTracking && (
                    <button
                      type="button"
                      onClick={() => onOpenClientTracking(booking.clientPhone)}
                      className="min-h-[36px] px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
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


