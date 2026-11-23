import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { AppointmentBooking } from '../types';
import { getMergedBarbers, useBarberProfiles } from '../utils/barberProfileStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface WeeklyWorkloadBarChartProps {
  bookings: AppointmentBooking[];
  todayStr: string;
}

function getEffectiveBookingDate(b: AppointmentBooking): string {
  return b.rescheduledTo?.date || b.date;
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getWeekBounds(todayStr: string, mode: 'calendar_week' | 'rolling_7d'): {
  startStr: string;
  endStr: string;
  label: string;
} {
  const [y, m, d] = todayStr.split('-').map(Number);
  const base = new Date(y, m - 1, d, 12, 0, 0);

  if (mode === 'rolling_7d') {
    const start = new Date(base);
    start.setDate(base.getDate() - 6);
    return {
      startStr: toIsoDate(start),
      endStr: todayStr,
      label: `${toIsoDate(start)} ← ${todayStr}`,
    };
  }

  // Current ISO-style salon week (Mon..Sun containing today)
  const day = base.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startStr: toIsoDate(monday),
    endStr: toIsoDate(sunday),
    label: `${toIsoDate(monday)} ← ${toIsoDate(sunday)}`,
  };
}

export const WeeklyWorkloadBarChart: React.FC<WeeklyWorkloadBarChartProps> = ({
  bookings,
  todayStr,
}) => {
  const { lang } = useLanguage();
  const roster = useBarberRoster();
  const profilesMap = useBarberProfiles();
  const mergedBarbers = useMemo(
    () => getMergedBarbers(profilesMap, roster),
    [profilesMap, roster]
  );
  const [rangeMode, setRangeMode] = useState<'calendar_week' | 'rolling_7d'>('calendar_week');

  const bounds = useMemo(
    () => getWeekBounds(todayStr, rangeMode),
    [todayStr, rangeMode]
  );

  const chartStats = useMemo(() => {
    const completedInWeek = bookings.filter((b) => {
      if (b.status !== 'completed') return false;
      const effDate = getEffectiveBookingDate(b);
      return effDate >= bounds.startStr && effDate <= bounds.endStr;
    });

    const perBarber = mergedBarbers.map((barber) => {
      const count = completedInWeek.filter(
        (b) =>
          b.barberId === barber.id ||
          b.barberName.toLowerCase().includes(barber.name.fr.toLowerCase().split(' ')[0])
      ).length;

      return {
        barber,
        count,
      };
    });

    const totalCompleted = perBarber.reduce((sum, item) => sum + item.count, 0);
    const maxCount = Math.max(4, ...perBarber.map((item) => item.count));
    // Round Y-axis ceiling to a clean multiple of 2 or 4
    const yMax = maxCount <= 4 ? 4 : Math.ceil(maxCount / 2) * 2;
    const avgCount = mergedBarbers.length > 0 ? totalCompleted / mergedBarbers.length : 0;

    return {
      perBarber,
      totalCompleted,
      yMax,
      avgCount,
    };
  }, [bookings, bounds.startStr, bounds.endStr, mergedBarbers]);

  const yTicks = [
    chartStats.yMax,
    Math.round(chartStats.yMax * 0.75),
    Math.round(chartStats.yMax * 0.5),
    Math.round(chartStats.yMax * 0.25),
    0,
  ];

  const avgPctFromBottom =
    chartStats.yMax > 0
      ? Math.min(100, Math.max(0, (chartStats.avgCount / chartStats.yMax) * 100))
      : 0;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/85 border border-zinc-800 space-y-4">
      {/* Header + Range Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-zinc-800/80 pb-3">
        <div>
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>
              {pickLang(lang, {
                ar: 'توزيع المواعيد المكتملة هذا الأسبوع',
                fr: 'Répartition hebdomadaire des rendez-vous terminés',
                amz: 'ⴰⴱⴹⴰⵢ ⵏ ⵉⵎⵓⵄⵉⴷⵏ ⵉⵎⴷⵏ ⵉⵎⴰⵍⴰⵙⵙ ⴰⴷ',
                en: 'Weekly Team Completed Workload',
                es: 'Carga semanal completada del equipo',
              })}
            </span>
          </h4>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {pickLang(lang, {
              ar: `عدد المواعيد المكتملة لكل حلاق لمتابعة توازن ضغط العمل بين أعضاء الفريق (${bounds.label})`,
              fr: `Nombre de rendez-vous terminés par barbier pour suivre l’équilibre de charge (${bounds.label})`,
              amz: `ⴰⵎⴹⴰⵏ ⵏ ⵉⵎⵓⵄⵉⴷⵏ ⵉⵎⴷⵏ ⵉ ⴽⵓ ⴰⵎⵣⵣⴰⴳ ⵉ ⵓⴹⴼⴰⵕ ⵏ ⵜⵡⵓⵔⵉ (${bounds.label})`,
              en: `Completed appointments per barber to monitor team workload balance (${bounds.label})`,
              es: `Citas completadas por barbero para equilibrar la carga (${bounds.label})`,
            })}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="inline-flex rounded-xl bg-zinc-950 border border-zinc-800 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setRangeMode('calendar_week')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                rangeMode === 'calendar_week'
                  ? 'bg-amber-500 text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {pickLang(lang, { ar: 'هذا الأسبوع', fr: 'Cette semaine', amz: 'ⵉⵎⴰⵍⴰⵙⵙ ⴰⴷ', en: 'This Week', es: 'Esta semana' })}
            </button>
            <button
              type="button"
              onClick={() => setRangeMode('rolling_7d')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                rangeMode === 'rolling_7d'
                  ? 'bg-amber-500 text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {pickLang(lang, { ar: 'آخر 7 أيام', fr: '7 derniers jours', amz: '7 ⵡⵓⵙⵙⴰⵏ', en: 'Last 7 Days', es: 'Últimos 7 días' })}
            </button>
          </div>

          <span className="text-[11px] font-mono font-bold text-emerald-300 tabular-nums">
            {pickLang(lang, { ar: 'المجموع:', fr: 'Total :', amz: 'ⴰⵎⴰⵜⴰⵢ:', en: 'Total:', es: 'Total:' })} {chartStats.totalCompleted}
          </span>
        </div>
      </div>

      {/* Bar Chart Plot Area */}
      <div className="relative pt-4 pb-1">
        <div className="flex items-stretch gap-3">
          {/* Y-Axis Scale */}
          <div
            dir="ltr"
            className="w-7 flex flex-col justify-between text-right text-[10px] font-mono text-zinc-500 tabular-nums h-44 select-none"
          >
            {yTicks.map((tick, idx) => (
              <span key={`${tick}-${idx}`} className="leading-none -translate-y-1">
                {tick}
              </span>
            ))}
          </div>

          {/* Plot Grid + Columns */}
          <div className="flex-1 relative h-44 border-b border-l border-zinc-800/90">
            {/* Horizontal Gridlines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {yTicks.slice(0, -1).map((_, idx) => (
                <div
                  key={idx}
                  className="w-full border-t border-dashed border-zinc-800/70"
                />
              ))}
              <div className="w-full" />
            </div>

            {/* Team Average Reference Line */}
            {chartStats.totalCompleted > 0 && (
              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-400/70 pointer-events-none z-10 flex justify-end"
                style={{ bottom: `${avgPctFromBottom}%` }}
              >
                <span className=" -translate-y-4 px-1.5 py-0.5 rounded bg-zinc-950/90 border border-amber-500/35 text-[9px] font-mono text-amber-300 tabular-nums">
                  {pickLang(lang, { ar: 'المتوسط:', fr: 'Moy. :', amz: 'ⴰⵏⴰⵎⵎⴰⵙ:', en: 'Avg:', es: 'Prom.:' })} {chartStats.avgCount.toFixed(1)}
                </span>
              </div>
            )}

            {/* Vertical Bars */}
            <div
              className="relative z-10 h-full grid gap-3 sm:gap-6 px-3 sm:px-6 items-end"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, chartStats.perBarber.length)}, minmax(0, 1fr))`,
              }}
            >
              {chartStats.perBarber.map(({ barber, count }) => {
                const heightPct =
                  chartStats.yMax > 0
                    ? Math.round((count / chartStats.yMax) * 100)
                    : 0;
                const sharePct =
                  chartStats.totalCompleted > 0
                    ? Math.round((count / chartStats.totalCompleted) * 100)
                    : 0;
                const color = barber.themeColor || '#D97706';
                const barberLabel = barber.name[lang] || barber.name.ar || barber.name.fr;

                return (
                  <div
                    key={barber.id}
                    className="h-full flex flex-col justify-end items-center group"
                    title={`${barberLabel}: ${count} (${sharePct}%)`}
                  >
                    {/* Count Label Above Bar */}
                    <div className="mb-1 text-[11px] font-mono font-black text-white tabular-nums transition-transform group-hover:scale-110 flex-shrink-0">
                      {count}
                    </div>

                    {/* Bar Column */}
                    <div className="w-full max-w-[54px] flex-1 min-h-0 flex items-end justify-center">
                      <div
                        className="w-full rounded-t-xl transition-all duration-500 border border-b-0"
                        style={{
                          height: count === 0 ? '4px' : `${Math.max(8, heightPct)}%`,
                          backgroundColor: count === 0 ? '#27272a' : `${color}CC`,
                          borderColor: count === 0 ? '#3f3f46' : color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* X-Axis Barber Labels */}
        <div className="flex items-start gap-3 mt-2">
          <div className="w-7 flex-shrink-0" />
          <div
            className="flex-1 grid gap-3 sm:gap-6 px-3 sm:px-6 text-center"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, chartStats.perBarber.length)}, minmax(0, 1fr))`,
            }}
          >
            {chartStats.perBarber.map(({ barber, count }) => {
              const sharePct =
                chartStats.totalCompleted > 0
                  ? Math.round((count / chartStats.totalCompleted) * 100)
                  : 0;
              const color = barber.themeColor || '#D97706';
              const barberFirst = (barber.name[lang] || barber.name.ar || barber.name.fr).split(' ')[0];

              return (
                <div key={barber.id} className="min-w-0 space-y-0.5">
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-white truncate">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{barberFirst}</span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 tabular-nums">
                    {sharePct}% · {count}{' '}
                    {pickLang(lang, { ar: 'موعد', fr: 'RDV', amz: 'ⴰⵎⵓⵄⵉⴷ', en: 'visits', es: 'citas' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
