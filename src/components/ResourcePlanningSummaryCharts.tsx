import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from 'recharts';
import { BarChart3, Clock, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { AppointmentBooking, CustomerReview, StaffRole } from '../types';
import { INITIAL_REVIEWS } from '../data/barbershopData';
import { getMergedBarbers, useBarberProfiles } from '../utils/barberProfileStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import { ALL_SALON_CONFIGURABLE_HOURS } from '../utils/barberScheduleStore';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface ResourcePlanningSummaryChartsProps {
  bookings: AppointmentBooking[];
  reviews?: CustomerReview[];
  role?: StaffRole;
  ownBarberId?: string;
}

type PeriodWindow = '7d' | '30d' | 'all';
type BarberMetricView = 'volume_revenue' | 'efficiency_rating';

function getEffectiveDate(b: AppointmentBooking): string {
  return b.rescheduledTo?.date || b.date;
}

function getEffectiveHour(b: AppointmentBooking): string | null {
  const raw = (b.rescheduledTo?.time || b.timeSlot || '').trim();
  if (!raw || raw === 'FLEXIBLE') {
    const hint = (b.preferredTimeHint || '').trim();
    return /^\d{2}:\d{2}$/.test(hint) ? hint : null;
  }
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const hhmm = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!hhmm) return null;
  return `${hhmm[1].padStart(2, '0')}:00`;
}

function getBookingRevenue(b: AppointmentBooking): number {
  if (b.finalTotalMAD !== undefined && b.finalTotalMAD !== null) {
    return Number(b.finalTotalMAD) || 0;
  }
  return (b.cartItemsSummary || []).reduce(
    (sum, item) => sum + (Number(item.finalPrice) || 0),
    0
  );
}

function getDateOffsetIso(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split('T')[0];
}

export const ResourcePlanningSummaryCharts: React.FC<ResourcePlanningSummaryChartsProps> = ({
  bookings,
  reviews = INITIAL_REVIEWS,
  role = 'master',
  ownBarberId = 'all',
}) => {
  const { lang } = useLanguage();
  const roster = useBarberRoster();
  const profilesMap = useBarberProfiles();
  const mergedBarbers = useMemo(
    () => getMergedBarbers(profilesMap, roster),
    [profilesMap, roster]
  );
  const [period, setPeriod] = useState<PeriodWindow>('30d');
  const [barberScope, setBarberScope] = useState<string>(
    role === 'barber' ? ownBarberId : 'all'
  );
  const [barberMetricView, setBarberMetricView] =
    useState<BarberMetricView>('volume_revenue');

  const todayStr = new Date().toISOString().split('T')[0];

  const periodFilteredBookings = useMemo(() => {
    if (period === 'all') return bookings;
    const cutoff = getDateOffsetIso(period === '7d' ? 6 : 29);
    return bookings.filter((b) => {
      const d = getEffectiveDate(b);
      return d >= cutoff && d <= todayStr;
    });
  }, [bookings, period, todayStr]);

  const hourScopedBookings = useMemo(() => {
    const targetBarber = role === 'barber' ? ownBarberId : barberScope;
    if (targetBarber === 'all') return periodFilteredBookings;
    const barberObj = mergedBarbers.find((m) => m.id === targetBarber);
    const firstFr = barberObj?.name.fr.toLowerCase().split(' ')[0] || targetBarber;
    return periodFilteredBookings.filter(
      (b) =>
        b.barberId === targetBarber ||
        b.barberName.toLowerCase().includes(firstFr)
    );
  }, [periodFilteredBookings, role, ownBarberId, barberScope, mergedBarbers]);

  // 1. Peak Booking Hours Aggregation (Recharts dataset)
  const peakHoursData = useMemo(() => {
    const hourSet = new Set<string>(ALL_SALON_CONFIGURABLE_HOURS);
    hourScopedBookings.forEach((b) => {
      const h = getEffectiveHour(b);
      if (h) hourSet.add(h);
    });

    const sortedHours = Array.from(hourSet).sort((a, b) => a.localeCompare(b));

    const buckets = sortedHours.map((hour) => {
      let completed = 0;
      let confirmed = 0;
      let pending = 0;
      let cancelledOrNoShow = 0;
      let revenueMAD = 0;

      hourScopedBookings.forEach((b) => {
        if (getEffectiveHour(b) !== hour) return;
        if (b.status === 'completed') {
          completed += 1;
          revenueMAD += getBookingRevenue(b);
        } else if (b.status === 'confirmed' || b.status === 'rescheduled') {
          confirmed += 1;
        } else if (
          b.status === 'pending' ||
          b.status === 'flexible_pending' ||
          b.status === 'pending_quote'
        ) {
          pending += 1;
        } else {
          cancelledOrNoShow += 1;
        }
      });

      const activeDemand = completed + confirmed + pending;

      return {
        hour,
        completed,
        confirmed,
        pending,
        cancelledOrNoShow,
        activeDemand,
        revenueMAD,
      };
    });

    const maxDemand = Math.max(0, ...buckets.map((x) => x.activeDemand));
    const totalActive = buckets.reduce((s, x) => s + x.activeDemand, 0);

    return buckets.map((row) => ({
      ...row,
      isPeak: maxDemand > 0 && row.activeDemand === maxDemand,
      sharePct:
        totalActive > 0 ? Math.round((row.activeDemand / totalActive) * 100) : 0,
    }));
  }, [hourScopedBookings]);

  // 2. Barber Performance Dataset (Recharts dataset)
  const barberPerformanceData = useMemo(() => {
    const targetMembers =
      role === 'barber'
        ? mergedBarbers.filter((m) => m.id === ownBarberId)
        : mergedBarbers;

    return targetMembers.map((barber) => {
      const firstFr = barber.name.fr.toLowerCase().split(' ')[0];
      const bItems = periodFilteredBookings.filter(
        (b) =>
          b.barberId === barber.id ||
          b.barberName.toLowerCase().includes(firstFr)
      );

      const completed = bItems.filter((b) => b.status === 'completed');
      const confirmed = bItems.filter(
        (b) => b.status === 'confirmed' || b.status === 'rescheduled'
      );
      const pending = bItems.filter(
        (b) =>
          b.status === 'pending' ||
          b.status === 'flexible_pending' ||
          b.status === 'pending_quote'
      );
      const noShows = bItems.filter((b) => b.status === 'no_show');

      const completedCount = completed.length;
      const upcomingCount = confirmed.length + pending.length;
      const totalHandled = completedCount + upcomingCount;
      const revenueMAD = completed.reduce((s, b) => s + getBookingRevenue(b), 0);
      const avgTicketMAD =
        completedCount > 0 ? Math.round(revenueMAD / completedCount) : 0;

      const completionDenom = completedCount + noShows.length;
      const reliabilityPct =
        completionDenom > 0
          ? Math.round((completedCount / completionDenom) * 100)
          : 100;

      const matchingReviews = reviews.filter((r) => r.barberId === barber.id);
      const avgRating =
        matchingReviews.length > 0
          ? Number(
              (
                matchingReviews.reduce((s, r) => s + (Number(r.rating) || 5), 0) /
                matchingReviews.length
              ).toFixed(2)
            )
          : Number(barber.rating || 5);

      const displayName = barber.name[lang] || barber.name.ar || barber.name.fr;

      return {
        id: barber.id,
        name: displayName.split(' ')[0],
        fullName: displayName,
        color: barber.themeColor || '#D97706',
        completedCount,
        upcomingCount,
        totalHandled,
        revenueMAD,
        avgTicketMAD,
        reliabilityPct,
        avgRating,
      };
    });
  }, [periodFilteredBookings, reviews, role, ownBarberId, lang]);

  // Executive KPIs derived from datasets
  const summaryStats = useMemo(() => {
    const activeTotal = peakHoursData.reduce((s, r) => s + r.activeDemand, 0);
    const completedTotal = peakHoursData.reduce((s, r) => s + r.completed, 0);
    const revenueTotal = peakHoursData.reduce((s, r) => s + r.revenueMAD, 0);
    const flexibleCount = hourScopedBookings.filter(
      (b) => b.timeSlot === 'FLEXIBLE' || b.status === 'flexible_pending'
    ).length;

    const sortedByDemand = [...peakHoursData]
      .filter((r) => r.activeDemand > 0)
      .sort((a, b) => b.activeDemand - a.activeDemand);
    const peakHourRow = sortedByDemand[0] || null;
    const quietestOpenRow =
      sortedByDemand.length > 1
        ? sortedByDemand[sortedByDemand.length - 1]
        : null;

    const topBarber =
      [...barberPerformanceData].sort(
        (a, b) => b.revenueMAD - a.revenueMAD || b.completedCount - a.completedCount
      )[0] || null;

    const completionRatePct =
      activeTotal > 0 ? Math.round((completedTotal / activeTotal) * 100) : 0;

    return {
      activeTotal,
      completedTotal,
      revenueTotal,
      flexibleCount,
      peakHourRow,
      quietestOpenRow,
      topBarber,
      completionRatePct,
    };
  }, [peakHoursData, hourScopedBookings, barberPerformanceData]);

  const periodLabel =
    period === '7d'
      ? pickLang(lang, { ar: 'آخر 7 أيام', fr: '7 derniers jours', amz: '7 ⵡⵓⵙⵙⴰⵏ', en: 'Last 7 Days', es: 'Últimos 7 días' })
      : period === '30d'
      ? pickLang(lang, { ar: 'آخر 30 يوماً', fr: '30 derniers jours', amz: '30 ⵡⵓⵙⵙⴰⵏ', en: 'Last 30 Days', es: 'Últimos 30 días' })
      : pickLang(lang, { ar: 'كامل السجل', fr: 'Tout l’historique', amz: 'ⴰⴽⴽʷ ⵓⵎⵣⵔⵓⵢ', en: 'All Time', es: 'Todo el historial' });

  const isRtl = lang === 'ar';
  const dirAttr = isRtl ? 'rtl' : 'ltr';

  return (
    <div className="space-y-5">
      {/* Summary View Header & Interactive Filters */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>
              {pickLang(lang, {
                ar: 'ملخص وتخطيط الموارد',
                fr: 'Synthèse & Planification des Ressources',
                amz: 'ⴰⵙⴳⵣⵍ ⴷ ⵓⵖⴰⵡⴰⵙ ⵏ ⵜⵡⵓⵔⵉ',
                en: 'Resource Planning Summary',
                es: 'Resumen de Planificación de Recursos',
              })}
            </span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {pickLang(lang, {
              ar: `تحليل ساعات الذروة ومقارنة أداء الحلاقين لتوزيع المناوبات وتقليل ضغط الانتظار (${periodLabel})`,
              fr: `Analyse des heures de pointe et performance des barbiers pour optimiser les créneaux (${periodLabel})`,
              amz: `ⴰⵙⴼⵙⵉ ⵏ ⵜⵙⵔⴰⴳⵉⵏ ⵏ ⵓⵎⵓⴷⴷⵓ ⴷ ⵜⵡⵓⵔⵉ ⵏ ⵉⵎⵣⵣⴰⴳⵏ (${periodLabel})`,
              en: `Peak hour demand analysis and barber performance comparison (${periodLabel})`,
              es: `Análisis de horas pico y rendimiento de barberos (${periodLabel})`,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Segmented Filter */}
          <div className="inline-flex rounded-xl bg-zinc-950 border border-zinc-800 p-0.5 text-[11px] font-bold">
            {(
              [
                { id: '7d', label: pickLang(lang, { ar: '7 أيام', fr: '7 jours', amz: '7 ⵡⵓⵙⵙⴰⵏ', en: '7 Days', es: '7 días' }) },
                { id: '30d', label: pickLang(lang, { ar: '30 يوماً', fr: '30 jours', amz: '30 ⵡⵓⵙⵙⴰⵏ', en: '30 Days', es: '30 días' }) },
                { id: 'all', label: pickLang(lang, { ar: 'الكل', fr: 'Tout', amz: 'ⴰⴽⴽʷ', en: 'All', es: 'Todo' }) },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  period === opt.id
                    ? 'bg-amber-500 text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Barber Filter for Peak Hours Chart (Master Admin only) */}
          {role === 'master' && (
            <select
              value={barberScope}
              onChange={(e) => setBarberScope(e.target.value)}
              aria-label={pickLang(lang, {
                ar: 'تصفية ساعات الذروة حسب الحلاق',
                fr: 'Filtrer les heures de pointe par barbier',
                amz: 'ⵙⵜⵉ ⵜⵉⵙⵔⴰⴳⵉⵏ ⵙ ⵓⵎⵣⵣⴰⴳ',
                en: 'Filter peak hours by barber',
                es: 'Filtrar horas pico por barbero',
              })}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">
                {pickLang(lang, {
                  ar: 'جميع الحلاقين (الصالون)',
                  fr: 'Tous les barbiers (Salon)',
                  amz: 'ⴰⴽⴽʷ ⵉⵎⵣⵣⴰⴳⵏ',
                  en: 'All Barbers (Salon)',
                  es: 'Todos los barberos',
                })}
              </option>
              {mergedBarbers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name[lang] || m.name.ar || m.name.fr}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Top Resource Planning KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
          <span className="text-[11px] font-bold text-zinc-400 block">
            {pickLang(lang, {
              ar: 'ساعة الذروة الأعلى طلباً',
              fr: 'Heure de pointe',
              amz: 'ⵜⴰⵙⵔⴰⴳⵜ ⵜⴰⵎⵇⵔⴰⵏⵜ',
              en: 'Peak Demand Hour',
              es: 'Hora pico',
            })}
          </span>
          <div className="text-2xl font-black text-amber-400 font-mono tabular-nums" dir="ltr">
            {summaryStats.peakHourRow ? summaryStats.peakHourRow.hour : '—'}
          </div>
          <span className="text-[11px] text-zinc-400 font-mono tabular-nums block">
            {summaryStats.peakHourRow
              ? pickLang(lang, {
                  ar: `${summaryStats.peakHourRow.activeDemand} حجز (${summaryStats.peakHourRow.sharePct}% من الطلب)`,
                  fr: `${summaryStats.peakHourRow.activeDemand} RDV (${summaryStats.peakHourRow.sharePct}% de la demande)`,
                  amz: `${summaryStats.peakHourRow.activeDemand} ⵉⵎⵓⵄⵉⴷⵏ (${summaryStats.peakHourRow.sharePct}%)`,
                  en: `${summaryStats.peakHourRow.activeDemand} bookings (${summaryStats.peakHourRow.sharePct}% share)`,
                  es: `${summaryStats.peakHourRow.activeDemand} citas (${summaryStats.peakHourRow.sharePct}%)`,
                })
              : pickLang(lang, { ar: 'لا توجد بيانات كافية', fr: 'Données insuffisantes', amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⵙⴼⴽⴰ', en: 'Not enough data', es: 'Sin datos suficientes' })}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
          <span className="text-[11px] font-bold text-zinc-400 block">
            {pickLang(lang, {
              ar: `إجمالي الطلب الفعّال (${periodLabel})`,
              fr: `Demande active (${periodLabel})`,
              amz: `ⴰⵎⴰⵜⴰⵢ ⵏ ⵉⵎⵓⵄⵉⴷⵏ (${periodLabel})`,
              en: `Active Demand (${periodLabel})`,
              es: `Demanda activa (${periodLabel})`,
            })}
          </span>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {summaryStats.activeTotal}
          </div>
          <span className="text-[11px] text-emerald-400 font-mono tabular-nums block">
            {summaryStats.completedTotal} {pickLang(lang, { ar: 'مكتمل', fr: 'terminés', amz: 'ⵉⵎⴷⵏ', en: 'completed', es: 'completadas' })} ({summaryStats.completionRatePct}%)
            {summaryStats.flexibleCount > 0 ? ` · ${summaryStats.flexibleCount} ${pickLang(lang, { ar: 'مرن', fr: 'flexibles', amz: 'ⵉⵏⵓⵥⵓⵕⵏ', en: 'flexible', es: 'flexibles' })}` : ''}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
          <span className="text-[11px] font-bold text-zinc-400 block">
            {pickLang(lang, {
              ar: 'الإيرادات المحققة (المكتملة)',
              fr: 'Revenus réalisés (terminés)',
              amz: 'ⵉⴷⵔⵉⵎⵏ ⵉⵜⵜⵓⵙⴽⵔⵏ',
              en: 'Realized Revenue (Completed)',
              es: 'Ingresos realizados',
            })}
          </span>
          <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
            {summaryStats.revenueTotal.toLocaleString('en-US')}{' '}
            <span className="text-xs font-bold">MAD</span>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono tabular-nums block">
            {pickLang(lang, { ar: 'متوسط التذكرة:', fr: 'Ticket moyen :', amz: 'ⴰⵏⴰⵎⵎⴰⵙ:', en: 'Avg ticket:', es: 'Ticket medio:' })}{' '}
            {summaryStats.completedTotal > 0
              ? Math.round(summaryStats.revenueTotal / summaryStats.completedTotal)
              : 0}{' '}
            MAD
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
          <span className="text-[11px] font-bold text-zinc-400 block">
            {pickLang(lang, {
              ar: 'أعلى حلاق أداءً في الفترة',
              fr: 'Meilleur barbier de la période',
              amz: 'ⴰⵎⵣⵣⴰⴳ ⴰⵎⵓⴼⴰⵢ',
              en: 'Top Performing Barber',
              es: 'Mejor barbero del período',
            })}
          </span>
          <div className="text-xl font-black text-white truncate">
            {summaryStats.topBarber && summaryStats.topBarber.totalHandled > 0
              ? summaryStats.topBarber.fullName
              : '—'}
          </div>
          <span className="text-[11px] text-amber-300 font-mono tabular-nums block">
            {summaryStats.topBarber && summaryStats.topBarber.totalHandled > 0
              ? `${summaryStats.topBarber.completedCount} ${pickLang(lang, { ar: 'مكتمل', fr: 'terminés', amz: 'ⵉⵎⴷⵏ', en: 'completed', es: 'completadas' })} · ${summaryStats.topBarber.revenueMAD.toLocaleString('en-US')} MAD`
              : pickLang(lang, { ar: 'بانتظار حجوزات', fr: 'En attente de RDV', amz: 'ⴰⵔ ⵉⵜⵜⵕⴰⵊⵓ', en: 'Awaiting bookings', es: 'Esperando citas' })}
          </span>
        </div>
      </div>

      {/* Recharts Grid: Peak Hours + Barber Performance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* CHART 1: PEAK BOOKING HOURS */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>
                  {pickLang(lang, {
                    ar: 'توزيع ساعات الذروة',
                    fr: 'Distribution des heures de pointe',
                    amz: 'ⴰⴱⴹⴰⵢ ⵏ ⵜⵙⵔⴰⴳⵉⵏ ⵏ ⵓⵎⵓⴷⴷⵓ',
                    en: 'Peak Booking Hours',
                    es: 'Distribución de horas pico',
                  })}
                </span>
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {pickLang(lang, {
                  ar: 'كثافة الحجوزات حسب الساعة لتحديد أوقات الاستراحة والضغط العالي',
                  fr: 'Densité des réservations par heure pour planifier pauses et affluence',
                  amz: 'ⵜⵉⵥⵥⵉⵜ ⵏ ⵉⵎⵓⵄⵉⴷⵏ ⵙ ⵜⵙⵔⴰⴳⵜ',
                  en: 'Hourly booking density to schedule breaks and manage peak traffic',
                  es: 'Densidad horaria para planificar descansos y horas pico',
                })}
              </p>
            </div>
            {summaryStats.peakHourRow && (
              <span className="text-[11px] font-mono font-bold text-red-400 tabular-nums">
                {pickLang(lang, { ar: 'الذروة:', fr: 'Pointe :', amz: 'ⴰⴼⵍⵍⴰ:', en: 'Peak:', es: 'Pico:' })} {summaryStats.peakHourRow.hour} ({summaryStats.peakHourRow.activeDemand})
              </span>
            )}
          </div>

          {summaryStats.activeTotal === 0 ? (
            <div className="h-[270px] flex flex-col items-center justify-center text-center text-zinc-500 text-xs gap-2">
              <AlertCircle className="w-6 h-6 text-zinc-600" />
              <p>
                {pickLang(lang, {
                  ar: 'لا توجد حجوزات نشطة ضمن الفترة المحددة لعرض مخطط ساعات الذروة.',
                  fr: 'Aucune réservation active sur cette période pour afficher les heures de pointe.',
                  amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⵎⵓⵄⵉⴷⵏ ⵉⵔⵎⵉⴷⵏ ⴳ ⵓⵣⵎⵣ ⴰⴷ.',
                  en: 'No active bookings in this period to display peak hours.',
                  es: 'No hay reservas activas en este período.',
                })}
              </p>
            </div>
          ) : (
            <div className="h-[270px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={peakHoursData}
                  margin={{ top: 10, right: 12, left: -16, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#27272a"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    stroke="#71717a"
                    tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#3f3f46' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="#71717a"
                    tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-700 shadow-xl text-xs space-y-1 text-start" dir={dirAttr}>
                          <div className="font-mono font-black text-amber-400 flex items-center justify-between gap-4">
                            <span>{pickLang(lang, { ar: `الساعة ${d.hour}`, fr: `Heure ${d.hour}`, amz: `ⵜⴰⵙⵔⴰⴳⵜ ${d.hour}`, en: `Hour ${d.hour}`, es: `Hora ${d.hour}` })}</span>
                            {d.isPeak && (
                              <span className="text-red-400 text-[10px]">
                                {pickLang(lang, { ar: 'وقت الذروة', fr: 'Heure de pointe', amz: 'ⴰⴼⵍⵍⴰ', en: 'Peak', es: 'Pico' })}
                              </span>
                            )}
                          </div>
                          <div className="text-zinc-200 font-mono tabular-nums">
                            {pickLang(lang, { ar: 'إجمالي الطلب النشط:', fr: 'Demande active :', amz: 'ⴰⵎⴰⵜⴰⵢ:', en: 'Active demand:', es: 'Demanda activa:' })} <strong>{d.activeDemand}</strong> ({d.sharePct}%)
                          </div>
                          <div className="text-emerald-400 font-mono tabular-nums text-[11px]">
                            {pickLang(lang, {
                              ar: `مكتمل: ${d.completed} · مؤكد: ${d.confirmed} · معلق: ${d.pending}`,
                              fr: `Terminés : ${d.completed} · Confirmés : ${d.confirmed} · Attente : ${d.pending}`,
                              amz: `ⵉⵎⴷⵏ: ${d.completed} · ⵉⵙⵏⵜⵎⵏ: ${d.confirmed} · ⵓⵔ ⵜⴰ: ${d.pending}`,
                              en: `Done: ${d.completed} · Confirmed: ${d.confirmed} · Pending: ${d.pending}`,
                              es: `Hechas: ${d.completed} · Confirmadas: ${d.confirmed} · Pend.: ${d.pending}`,
                            })}
                          </div>
                          <div className="text-zinc-400 font-mono tabular-nums text-[11px]">
                            {pickLang(lang, { ar: 'إيرادات هذه الساعة:', fr: 'Revenus :', amz: 'ⵉⴷⵔⵉⵎⵏ:', en: 'Hour revenue:', es: 'Ingresos:' })} {d.revenueMAD.toLocaleString('en-US')} MAD
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="activeDemand"
                    name={pickLang(lang, { ar: 'عدد الحجوزات', fr: 'Réservations', amz: 'ⵉⵎⵓⵄⵉⴷⵏ', en: 'Bookings', es: 'Reservas' })}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={34}
                  >
                    {peakHoursData.map((entry) => (
                      <Cell
                        key={`cell-${entry.hour}`}
                        fill={
                          entry.isPeak
                            ? '#EF4444'
                            : entry.activeDemand > 0
                            ? '#F59E0B'
                            : '#27272a'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Planning Hint Footer */}
          {summaryStats.peakHourRow && (
            <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
              <span>
                {pickLang(lang, { ar: 'أكثر ساعة ازدحاماً:', fr: 'Heure la plus chargée :', amz: 'ⵜⴰⵙⵔⴰⴳⵜ ⵉⵛⵛⵓⵕⵏ:', en: 'Busiest hour:', es: 'Hora más ocupada:' })}{' '}
                <strong className="font-mono text-red-400" dir="ltr">
                  {summaryStats.peakHourRow.hour}
                </strong>{' '}
                {pickLang(lang, {
                  ar: '(يفضل تواجد كامل الفريق دون استراحات)',
                  fr: '(équipe complète recommandée sans pauses)',
                  amz: '(ⵉⵅⵚⵚⴰ ⴰⴽⴽʷ ⵉⵎⵣⵣⴰⴳⵏ ⴰⴷ ⵉⵍⵉⵏ)',
                  en: '(full team recommended without breaks)',
                  es: '(equipo completo recomendado sin descansos)',
                })}
              </span>
              {summaryStats.quietestOpenRow &&
                summaryStats.quietestOpenRow.hour !== summaryStats.peakHourRow.hour && (
                  <span>
                    {pickLang(lang, { ar: 'الوقت الأهدأ للاستراحة:', fr: 'Créneau calme pour pause :', amz: 'ⴰⴽⵓⴷ ⵉⵔⵙⴰⵏ:', en: 'Quietest break slot:', es: 'Hora tranquila:' })}{' '}
                    <strong className="font-mono text-emerald-400" dir="ltr">
                      {summaryStats.quietestOpenRow.hour}
                    </strong>
                  </span>
                )}
            </div>
          )}
        </div>

        {/* CHART 2: BARBER PERFORMANCE COMPARISON */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>
                  {pickLang(lang, {
                    ar: 'أداء الحلاقين',
                    fr: 'Performance des Barbiers',
                    amz: 'ⵜⴰⵡⵓⵔⵉ ⵏ ⵉⵎⵣⵣⴰⴳⵏ',
                    en: 'Barber Performance',
                    es: 'Rendimiento de Barberos',
                  })}
                </span>
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {pickLang(lang, {
                  ar: 'مقارنة المواعيد المكتملة والقادمة والعائد أو الالتزام لكل حلاق',
                  fr: 'Comparaison des visites terminées, à venir, revenus et assiduité par barbier',
                  amz: 'ⴰⵙⵎⵣⴰⵣⴰⵍ ⵏ ⵉⵎⵓⵄⵉⴷⵏ ⴷ ⵉⴷⵔⵉⵎⵏ ⵉ ⴽⵓ ⴰⵎⵣⵣⴰⴳ',
                  en: 'Compare completed visits, upcoming volume, revenue, and reliability',
                  es: 'Comparación de citas, ingresos y puntualidad por barbero',
                })}
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-zinc-950 border border-zinc-800 p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setBarberMetricView('volume_revenue')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  barberMetricView === 'volume_revenue'
                    ? 'bg-emerald-500 text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {pickLang(lang, { ar: 'المواعيد والدخل', fr: 'Visites & Revenus', amz: 'ⵉⵎⵓⵄⵉⴷⵏ ⴷ ⵉⴷⵔⵉⵎⵏ', en: 'Volume & Revenue', es: 'Citas e Ingresos' })}
              </button>
              <button
                type="button"
                onClick={() => setBarberMetricView('efficiency_rating')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  barberMetricView === 'efficiency_rating'
                    ? 'bg-emerald-500 text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {pickLang(lang, { ar: 'الالتزام والتقييم', fr: 'Assiduité & Note', amz: 'ⴰⵙⵏⵜⵎ ⴷ ⵓⵙⵜⴰⵍ', en: 'Reliability & Rating', es: 'Puntualidad y Nota' })}
              </button>
            </div>
          </div>

          <div className="h-[270px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {barberMetricView === 'volume_revenue' ? (
                <ComposedChart
                  data={barberPerformanceData}
                  margin={{ top: 10, right: 8, left: -14, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#27272a"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#71717a"
                    tick={{ fill: '#e4e4e7', fontSize: 12, fontWeight: 700 }}
                    axisLine={{ stroke: '#3f3f46' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    allowDecimals={false}
                    stroke="#71717a"
                    tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#10b981"
                    tick={{ fill: '#34d399', fontSize: 10, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-700 shadow-xl text-xs space-y-1 text-start" dir={dirAttr}>
                          <div className="font-black text-white flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: d.color }}
                            />
                            <span>{d.fullName}</span>
                          </div>
                          <div className="text-emerald-400 font-mono tabular-nums">
                            {pickLang(lang, { ar: 'المكتملة:', fr: 'Terminés :', amz: 'ⵉⵎⴷⵏ:', en: 'Completed:', es: 'Completadas:' })} <strong>{d.completedCount}</strong>
                          </div>
                          <div className="text-blue-400 font-mono tabular-nums">
                            {pickLang(lang, { ar: 'القادمة / قيد المراجعة:', fr: 'À venir / en attente :', amz: 'ⴷ-ⵉⴷⴷⴰⵏ:', en: 'Upcoming / pending:', es: 'Próximas / pend.:' })} <strong>{d.upcomingCount}</strong>
                          </div>
                          <div className="text-amber-300 font-mono tabular-nums">
                            {pickLang(lang, { ar: 'الأرباح:', fr: 'Revenus :', amz: 'ⵉⴷⵔⵉⵎⵏ:', en: 'Revenue:', es: 'Ingresos:' })} <strong>{d.revenueMAD.toLocaleString('en-US')} MAD</strong>
                          </div>
                          <div className="text-zinc-400 font-mono tabular-nums text-[11px]">
                            {pickLang(lang, { ar: 'متوسط التذكرة:', fr: 'Ticket moyen :', amz: 'ⴰⵏⴰⵎⵎⴰⵙ:', en: 'Avg ticket:', es: 'Media:' })} {d.avgTicketMAD} MAD · {d.avgRating}★
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                    formatter={(value) => (
                      <span className="text-zinc-300 font-bold">{value}</span>
                    )}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="completedCount"
                    name={pickLang(lang, { ar: 'زيارات مكتملة', fr: 'Terminés', amz: 'ⵉⵎⴷⵏ', en: 'Completed', es: 'Completadas' })}
                    fill="#10B981"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={26}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="upcomingCount"
                    name={pickLang(lang, { ar: 'قادمة / معلقة', fr: 'À venir / Attente', amz: 'ⴷ-ⵉⴷⴷⴰⵏ', en: 'Upcoming', es: 'Próximas' })}
                    fill="#3B82F6"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={26}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenueMAD"
                    name={pickLang(lang, { ar: 'الإيرادات (MAD)', fr: 'Revenus (MAD)', amz: 'ⵉⴷⵔⵉⵎⵏ (MAD)', en: 'Revenue (MAD)', es: 'Ingresos (MAD)' })}
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#F59E0B', strokeWidth: 2, stroke: '#09090b' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              ) : (
                <ComposedChart
                  data={barberPerformanceData}
                  margin={{ top: 10, right: 8, left: -14, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#27272a"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#71717a"
                    tick={{ fill: '#e4e4e7', fontSize: 12, fontWeight: 700 }}
                    axisLine={{ stroke: '#3f3f46' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 100]}
                    stroke="#71717a"
                    tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 5]}
                    stroke="#f59e0b"
                    tick={{ fill: '#fbbf24', fontSize: 10, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-700 shadow-xl text-xs space-y-1 text-start" dir={dirAttr}>
                          <div className="font-black text-white">{d.fullName}</div>
                          <div className="text-emerald-400 font-mono tabular-nums">
                            {pickLang(lang, { ar: 'نسبة الالتزام بالحضور:', fr: 'Taux de présence :', amz: 'ⴰⵜⵉⴳ ⵏ ⵜⵉⵍⵉⵜ:', en: 'Attendance reliability:', es: 'Asistencia:' })} <strong>{d.reliabilityPct}%</strong>
                          </div>
                          <div className="text-amber-300 font-mono tabular-nums">
                            {pickLang(lang, { ar: 'تقييم الزبناء:', fr: 'Note clients :', amz: 'ⴰⵙⵜⴰⵍ:', en: 'Client rating:', es: 'Valoración:' })} <strong>{d.avgRating} / 5.0 ★</strong>
                          </div>
                          <div className="text-zinc-400 font-mono tabular-nums text-[11px]">
                            {pickLang(lang, { ar: 'إجمالي المواعيد:', fr: 'Total RDV :', amz: 'ⴰⵎⴰⵜⴰⵢ:', en: 'Total bookings:', es: 'Total citas:' })} {d.totalHandled}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                    formatter={(value) => (
                      <span className="text-zinc-300 font-bold">{value}</span>
                    )}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="reliabilityPct"
                    name={pickLang(lang, { ar: 'نسبة الالتزام (%)', fr: 'Assiduité (%)', amz: 'ⴰⵙⵏⵜⵎ (%)', en: 'Reliability (%)', es: 'Puntualidad (%)' })}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={34}
                  >
                    {barberPerformanceData.map((entry) => (
                      <Cell key={`rel-${entry.id}`} fill={entry.color} />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgRating"
                    name={pickLang(lang, { ar: 'تقييم الزبناء (من 5)', fr: 'Note clients (/5)', amz: 'ⴰⵙⵜⴰⵍ (/5)', en: 'Client Rating (/5)', es: 'Nota (/5)' })}
                    stroke="#FBBF24"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#FBBF24', stroke: '#09090b', strokeWidth: 2 }}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Barber Compact Tabular Legend */}
          <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {barberPerformanceData.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-1 font-mono tabular-nums text-zinc-300">
                <span className="font-sans font-bold truncate flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="truncate">{b.name}</span>
                </span>
                <span className="text-emerald-400 font-bold">
                  {b.completedCount}/{b.totalHandled}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compact Data Table for Resource Allocation Comparison */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/85 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>
              {pickLang(lang, {
                ar: `جدول مقارنة الفريق لتوزيع الموارد (${periodLabel})`,
                fr: `Tableau comparatif d’équipe (${periodLabel})`,
                amz: `ⵜⴰⴼⵍⵡⵉⵜ ⵏ ⵓⵙⵎⵣⴰⵣⴰⵍ ⵏ ⵜⵔⴰⴱⴱⵓⵜ (${periodLabel})`,
                en: `Team Comparison Table (${periodLabel})`,
                es: `Tabla comparativa del equipo (${periodLabel})`,
              })}
            </span>
          </h4>
          <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
            {barberPerformanceData.length} {pickLang(lang, { ar: 'حلاقين', fr: 'barbiers', amz: 'ⵉⵎⵣⵣⴰⴳⵏ', en: 'barbers', es: 'barberos' })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] text-zinc-400">
                <th className="py-2 px-2 font-bold">{pickLang(lang, { ar: 'الحلاق', fr: 'Barbier', amz: 'ⴰⵎⵣⵣⴰⴳ', en: 'Barber', es: 'Barbero' })}</th>
                <th className="py-2 px-2 font-bold text-center">{pickLang(lang, { ar: 'مكتملة', fr: 'Terminés', amz: 'ⵉⵎⴷⵏ', en: 'Done', es: 'Hechas' })}</th>
                <th className="py-2 px-2 font-bold text-center">{pickLang(lang, { ar: 'قادمة / معلقة', fr: 'À venir', amz: 'ⴷ-ⵉⴷⴷⴰⵏ', en: 'Upcoming', es: 'Próximas' })}</th>
                <th className="py-2 px-2 font-bold text-center">{pickLang(lang, { ar: 'الالتزام', fr: 'Assiduité', amz: 'ⴰⵙⵏⵜⵎ', en: 'Reliability', es: 'Puntualidad' })}</th>
                <th className="py-2 px-2 font-bold text-center">{pickLang(lang, { ar: 'التقييم', fr: 'Note', amz: 'ⴰⵙⵜⴰⵍ', en: 'Rating', es: 'Nota' })}</th>
                <th className="py-2 px-2 font-bold text-end">{pickLang(lang, { ar: 'الأرباح (MAD)', fr: 'Revenus (MAD)', amz: 'ⵉⴷⵔⵉⵎⵏ (MAD)', en: 'Revenue (MAD)', es: 'Ingresos (MAD)' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 font-mono tabular-nums">
              {barberPerformanceData.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-950/60 transition-colors">
                  <td className="py-2.5 px-2 font-sans font-bold text-white whitespace-nowrap">
                    {row.fullName}
                  </td>
                  <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">
                    {row.completedCount}
                  </td>
                  <td className="py-2.5 px-2 text-center text-blue-400 font-bold">
                    {row.upcomingCount}
                  </td>
                  <td className="py-2.5 px-2 text-center text-zinc-300">
                    {row.reliabilityPct}%
                  </td>
                  <td className="py-2.5 px-2 text-center text-amber-300">
                    {row.avgRating.toFixed(1)} ★
                  </td>
                  <td className="py-2.5 px-2 text-end text-emerald-300 font-black">
                    {row.revenueMAD.toLocaleString('en-US')} MAD
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
