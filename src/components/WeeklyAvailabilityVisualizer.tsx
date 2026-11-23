import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Sparkles,
} from 'lucide-react';
import { AppointmentBooking, BarberScheduleConfig, Language } from '../types';
import {
  ALL_SALON_CONFIGURABLE_HOURS,
  evaluateBarberDayAvailability,
} from '../utils/barberScheduleStore';
import { pickLang } from '../utils/i18n';

/**
 * Canonical Barbershop Opening Hours mirrored from index.html Schema.org OpeningHoursSpecification:
 * - Tuesday, Wednesday, Thursday, Saturday, Sunday: 11:00–13:00 & 16:00–22:00
 * - Friday: 15:00–22:00
 * - Monday: Closed (Weekly rest day)
 */
export const INDEX_HTML_OPENING_HOURS_SPEC = [
  {
    days: ['Tue', 'Wed', 'Thu', 'Sat', 'Sun'],
    dayIndices: [2, 3, 4, 6, 0],
    opens: '11:00',
    closes: '13:00',
  },
  {
    days: ['Tue', 'Wed', 'Thu', 'Sat', 'Sun'],
    dayIndices: [2, 3, 4, 6, 0],
    opens: '16:00',
    closes: '22:00',
  },
  {
    days: ['Fri'],
    dayIndices: [5],
    opens: '15:00',
    closes: '22:00',
  },
] as const;

interface WeeklyAvailabilityVisualizerProps {
  barberId: string;
  barberName: string;
  selectedDate: string;
  selectedTimeSlot: string;
  isFlexibleMode: boolean;
  schedulesMap: Record<string, BarberScheduleConfig>;
  bookings: AppointmentBooking[];
  lang: Language;
  candidateDurationMinutes?: number;
  onSelectDateAndSlot: (dateStr: string, timeSlot: string) => void;
}

function formatLocalYyyyMmDd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const WeeklyAvailabilityVisualizer: React.FC<WeeklyAvailabilityVisualizerProps> = ({
  barberId,
  barberName,
  selectedDate,
  selectedTimeSlot,
  isFlexibleMode,
  schedulesMap,
  bookings,
  lang,
  candidateDurationMinutes = 30,
  onSelectDateAndSlot,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [weekOffset, setWeekOffset] = useState<number>(0);

  const todayStr = useMemo(() => formatLocalYyyyMmDd(new Date()), []);

  // Build 7 consecutive days starting from Today + weekOffset * 7
  const weekDays = useMemo(() => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    base.setDate(base.getDate() + weekOffset * 7);

    const locale =
      lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'fr-FR';

    return Array.from({ length: 7 }, (_, i) => {
      const current = new Date(base);
      current.setDate(base.getDate() + i);
      const dateStr = formatLocalYyyyMmDd(current);
      const weekday = current.getDay();
      const summary = evaluateBarberDayAvailability(
        barberId,
        dateStr,
        schedulesMap,
        bookings,
        candidateDurationMinutes
      );

      const dayShort =
        lang === 'amz'
          ? ['ⴰⵙⴰⵎ', 'ⴰⵢⵏⴰ', 'ⴰⵙⵉⵏ', 'ⴰⴽⵕⴰ', 'ⴰⴽⵡⴰ', 'ⴰⵙⵉⵎ', 'ⴰⵙⵉⴹ'][weekday]
          : current.toLocaleDateString(locale, { weekday: 'short' });

      const dateLabel = `${String(current.getDate()).padStart(2, '0')}/${String(
        current.getMonth() + 1
      ).padStart(2, '0')}`;

      const isToday = dateStr === todayStr;

      // Exact opening window label matching index.html openingHoursSpecification
      const openWindowLabel =
        weekday === 1
          ? pickLang(lang, {
              ar: 'مغلق',
              fr: 'Fermé',
              amz: 'ⵉⵇⵇⵏ',
              en: 'Closed',
              es: 'Cerrado',
            })
          : weekday === 5
          ? '15-22'
          : '11-13 · 16-22';

      return {
        dateStr,
        weekday,
        dayShort,
        dateLabel,
        isToday,
        openWindowLabel,
        summary,
      };
    });
  }, [barberId, weekOffset, schedulesMap, bookings, lang, todayStr, candidateDurationMinutes]);

  const totalOpenInWeek = useMemo(() => {
    return weekDays.reduce((acc, d) => acc + d.summary.availableSlots.length, 0);
  }, [weekDays]);

  return (
    <div className="rounded-2xl bg-zinc-50 dark:bg-[#101218] border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
      {/* Header / Expand Collapse Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left rtl:text-right hover:bg-stone-100/80 dark:hover:bg-zinc-900/60 transition-colors cursor-pointer"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/12 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
              <span>
                {pickLang(lang, {
                  ar: 'خريطة التوفر الأسبوعي وساعات العمل',
                  amz: 'ⴰⵙⵖⵉⵡⵙ ⵏ ⵉⵎⴰⵍⴰⵙⵙ',
                  en: 'Weekly Availability Visualizer',
                  es: 'Disponibilidad Semanal',
                  fr: 'Calendrier Hebdomadaire des Disponibilités',
                })}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
              {barberName} ·{' '}
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {totalOpenInWeek}
              </span>{' '}
              {pickLang(lang, {
                ar: 'ساعة متاحة هذا الأسبوع',
                amz: 'ⵜⵉⵙⵔⴰⴳⵉⵏ ⵉⵍⵍⴰⵏ',
                en: 'open slots this week',
                es: 'huecos libres esta semana',
                fr: 'créneaux libres cette semaine',
              })}
            </p>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-zinc-500 transition-transform duration-200 flex-shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="weekly-visualizer-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-zinc-200/80 dark:border-zinc-800/80">
          {/* Week Navigation & Index.html Hours Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="text-[10px] text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-bold text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                {pickLang(lang, {
                  ar: 'ساعات الصالون:',
                  amz: 'ⵜⵉⵙⵔⴰⴳⵉⵏ:',
                  en: 'Hours:',
                  es: 'Horario:',
                  fr: 'Horaires :',
                })}{' '}
              </span>
              <span>
                {pickLang(lang, {
                  ar: 'ثلا-أحد 11–13 و 16–22',
                  amz: 'ⴰⵙⵉⵏ–ⴰⵙⴰⵎ 11–13 & 16–22',
                  en: 'Tue–Sun 11–13 & 16–22',
                  es: 'Mar–Dom 11–13 y 16–22',
                  fr: 'Mar–Dim 11h–13h & 16h–22h',
                })}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {pickLang(lang, {
                  ar: 'الجمعة 15–22',
                  amz: 'ⴰⵙⵉⵎ 15–22',
                  en: 'Fri 15–22',
                  es: 'Vie 15–22',
                  fr: 'Ven 15h–22h',
                })}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-red-600 dark:text-red-400 font-semibold">
                {pickLang(lang, {
                  ar: 'الإثنين مغلق',
                  amz: 'ⴰⵢⵏⴰⵙ ⵉⵇⵇⵏ',
                  en: 'Mon Closed',
                  es: 'Lun Cerrado',
                  fr: 'Lun Fermé',
                })}
              </span>
            </div>

            <div className="inline-flex items-center gap-1" dir="ltr">
              <button
                type="button"
                disabled={weekOffset <= 0}
                onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                aria-label="Previous week"
                className="min-h-[30px] min-w-[30px] p-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 cursor-pointer hover:border-amber-500 transition-colors flex items-center justify-center"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-[10px] font-bold font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                {weekOffset === 0
                  ? pickLang(lang, {
                      ar: 'الأسبوع 1',
                      amz: 'ⵉⵎⴰⵍⴰⵙⵙ 1',
                      en: 'Week 1',
                      es: 'Semana 1',
                      fr: 'Semaine 1',
                    })
                  : pickLang(lang, {
                      ar: `الأسبوع +${weekOffset}`,
                      amz: `ⵉⵎⴰⵍⴰⵙⵙ +${weekOffset}`,
                      en: `Week +${weekOffset}`,
                      es: `Semana +${weekOffset}`,
                      fr: `Semaine +${weekOffset}`,
                    })}
              </span>
              <button
                type="button"
                disabled={weekOffset >= 4}
                onClick={() => setWeekOffset((w) => Math.min(4, w + 1))}
                aria-label="Next week"
                className="min-h-[30px] min-w-[30px] p-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 cursor-pointer hover:border-amber-500 transition-colors flex items-center justify-center"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 7-Day × Opening Hours Matrix */}
          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <div className="min-w-[560px] grid grid-cols-[54px_repeat(7,minmax(0,1fr))] gap-1 text-[10px]">
              {/* Matrix Header Row */}
              <div className="flex items-end justify-center pb-1 text-[9px] font-bold text-zinc-400 font-mono">
                {pickLang(lang, {
                  ar: 'الساعة',
                  amz: 'ⵜⴰⵙⵔⴰⴳⵜ',
                  en: 'Time',
                  es: 'Hora',
                  fr: 'Heure',
                })}
              </div>
              {weekDays.map((day) => {
                const isSelectedDay = day.dateStr === selectedDate;
                return (
                  <div
                    key={day.dateStr}
                    className={`p-1.5 rounded-xl border text-center transition-colors ${
                      day.summary.isSalonClosedDay
                        ? 'bg-stone-100/80 dark:bg-zinc-900/60 border-stone-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500'
                        : isSelectedDay
                        ? 'bg-amber-500/15 border-amber-500 text-zinc-900 dark:text-white'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="font-black truncate">{day.dayShort}</div>
                    <div className="font-mono font-bold tabular-nums opacity-85" dir="ltr">
                      {day.dateLabel}
                    </div>
                    <div
                      className="text-[8px] font-mono opacity-75 truncate mt-0.5"
                      dir="ltr"
                      title={day.openWindowLabel}
                    >
                      {day.openWindowLabel}
                    </div>
                  </div>
                );
              })}

              {/* Hour Rows Mapped Directly from index.html Opening Hours */}
              {ALL_SALON_CONFIGURABLE_HOURS.map((hour) => (
                <React.Fragment key={hour}>
                  <div
                    dir="ltr"
                    className="flex items-center justify-center font-mono font-bold text-[10px] text-zinc-600 dark:text-zinc-400 tabular-nums"
                  >
                    {hour}
                  </div>

                  {weekDays.map((day) => {
                    const isWithinIndexHtmlHours = day.summary.baseSlots.includes(hour);
                    if (day.summary.isSalonClosedDay || !isWithinIndexHtmlHours) {
                      return (
                        <div
                          key={`${day.dateStr}-${hour}`}
                          title={
                            day.summary.isSalonClosedDay
                              ? pickLang(lang, {
                                  ar: 'الصالون مغلق الإثنين',
                                  amz: 'ⵉⵇⵇⵏ ⴰⵢⵏⴰⵙ',
                                  en: 'Salon closed on Mondays',
                                  es: 'Cerrado los lunes',
                                  fr: 'Salon fermé le Lundi',
                                })
                              : pickLang(lang, {
                                  ar: 'خارج ساعات العمل',
                                  amz: 'ⴱⵕⵕⴰ ⵏ ⵜⵙⵔⴰⴳⵉⵏ',
                                  en: 'Outside opening hours',
                                  es: 'Fuera de horario',
                                  fr: 'Hors horaires d’ouverture',
                                })
                          }
                          className="h-8 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/40 border border-dashed border-zinc-200/70 dark:border-zinc-800/60 flex items-center justify-center text-zinc-400 dark:text-zinc-600 select-none"
                        >
                          —
                        </div>
                      );
                    }

                    if (day.summary.isBarberOffDay) {
                      return (
                        <div
                          key={`${day.dateStr}-${hour}`}
                          title={pickLang(lang, {
                            ar: 'الحلاق في عطلة',
                            amz: 'ⴰⵙⵓⵏⴼⵓ',
                            en: 'Barber off',
                            es: 'Barbero libre',
                            fr: 'Barbier en repos',
                          })}
                          className="h-8 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-center justify-center text-[9px] font-bold text-amber-600/70 dark:text-amber-500/60"
                        >
                          {pickLang(lang, {
                            ar: 'راحة',
                            amz: 'ⴰⵙⵓⵏⴼⵓ',
                            en: 'OFF',
                            es: 'OFF',
                            fr: 'OFF',
                          })}
                        </div>
                      );
                    }

                    const slotInfo = day.summary.slots.find((s) => s.time === hour);
                    const isAvailable = Boolean(slotInfo?.available);
                    const isSelectedCell =
                      !isFlexibleMode && selectedDate === day.dateStr && selectedTimeSlot === hour;

                    if (isAvailable) {
                      return (
                        <button
                          key={`${day.dateStr}-${hour}`}
                          type="button"
                          onClick={() => onSelectDateAndSlot(day.dateStr, hour)}
                          title={`${day.dayShort} ${day.dateLabel} · ${hour}`}
                          className={`h-8 rounded-lg border font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 tabular-nums ${
                            isSelectedCell
                              ? 'bg-amber-500 border-amber-400 text-black shadow-sm scale-[1.03]'
                              : 'bg-amber-50/60 dark:bg-amber-500/10 border-amber-300/60 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 hover:bg-amber-500 hover:text-black dark:hover:bg-amber-500 dark:hover:text-black'
                          }`}
                        >
                          {isSelectedCell ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <span className="text-[9px]">
                              {pickLang(lang, {
                                ar: 'متاح',
                                amz: 'ⵉⵍⵍⴰ',
                                en: 'Open',
                                es: 'Libre',
                                fr: 'Libre',
                              })}
                            </span>
                          )}
                        </button>
                      );
                    }

                    return (
                      <div
                        key={`${day.dateStr}-${hour}`}
                        title={
                          slotInfo?.reason === 'past'
                            ? pickLang(lang, {
                                ar: 'انتهى الوقت',
                                amz: 'ⵉⵣⵔⵉ ⵡⴰⴽⵓⴷ',
                                en: 'Time passed',
                                es: 'Hora pasada',
                                fr: 'Créneau passé',
                              })
                            : slotInfo?.reason === 'break'
                            ? pickLang(lang, {
                                ar: 'استراحة الحلاق',
                                amz: 'ⴰⵙⵓⵏⴼⵓ',
                                en: 'Barber break',
                                es: 'Descanso',
                                fr: 'Pause barbier',
                              })
                            : pickLang(lang, {
                                ar: 'محجوز بالفعل',
                                amz: 'ⵉⵜⵜⵓⵟⵟⴼ',
                                en: 'Booked',
                                es: 'Reservado',
                                fr: 'Déjà réservé',
                              })
                        }
                        className="h-8 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70 border border-zinc-300/60 dark:border-zinc-700/60 flex items-center justify-center text-zinc-500 dark:text-zinc-500"
                      >
                        <Lock className="w-3 h-3 opacity-70" />
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Explicit Accessible Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-zinc-600 dark:text-zinc-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-400/60 inline-block" />
                <span>
                  {pickLang(lang, {
                    ar: 'متاح (اضغط للاختيار)',
                    amz: 'ⵉⵍⵍⴰ (ⵙⵜⵢ)',
                    en: 'Open (tap)',
                    es: 'Disponible',
                    fr: 'Disponible (cliquez)',
                  })}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                <span>
                  {pickLang(lang, {
                    ar: 'موعدك المختار',
                    amz: 'ⵉⵜⵜⵓⵙⵜⵢ',
                    en: 'Selected',
                    es: 'Elegido',
                    fr: 'Sélectionné',
                  })}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-zinc-300 dark:bg-zinc-700 inline-block" />
                <span>
                  {pickLang(lang, {
                    ar: 'محجوز / غير متاح',
                    amz: 'ⵉⵜⵜⵓⵟⵟⴼ',
                    en: 'Booked',
                    es: 'Ocupado',
                    fr: 'Occupé',
                  })}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-dashed border-zinc-400 inline-block" />
                <span>
                  {pickLang(lang, {
                    ar: 'خارج ساعات العمل',
                    amz: 'ⵉⵇⵇⵏ',
                    en: 'Closed',
                    es: 'Cerrado',
                    fr: 'Fermé',
                  })}
                </span>
              </span>
            </div>

            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              <Sparkles className="w-3 h-3" />
              <span>
                {pickLang(lang, {
                  ar: 'تحديث فوري مباشر',
                  amz: 'ⴰⵙⵎⵉⵔ ⵓⵙⵔⵉⴷ',
                  en: 'Live updates',
                  es: 'Tiempo real',
                  fr: 'Temps réel',
                })}
              </span>
            </span>
          </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
