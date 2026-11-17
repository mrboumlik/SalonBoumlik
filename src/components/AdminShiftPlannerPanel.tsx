import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarCheck2,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Repeat,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  AppointmentBooking,
  BarberScheduleConfig,
  ShiftRequest,
  ShiftRequestType,
} from '../types';
import { TEAM_MEMBERS } from '../data/barbershopData';
import {
  ALL_SALON_CONFIGURABLE_HOURS,
  evaluateBarberDayAvailability,
  getDefaultBarberSchedule,
  getInitialBookingDate,
  getSalonSlotsForDate,
  parseDateWeekday,
} from '../utils/barberScheduleStore';
import {
  approveShiftRequestAndSyncAvailability,
  createShiftRequest,
  deleteShiftRequest,
  rejectShiftRequest,
} from '../utils/shiftPlannerStore';
import { sendDualAlert } from '../utils/notifications';

interface AdminShiftPlannerPanelProps {
  requests: ShiftRequest[];
  schedules: Record<string, BarberScheduleConfig>;
  bookings: AppointmentBooking[];
  role: 'master' | 'barber';
  ownBarberId: string;
  reviewerName: string;
  todayStr: string;
}

const WEEKDAY_LABELS: Record<number, { ar: string; fr: string }> = {
  0: { ar: 'الأحد', fr: 'Dim' },
  1: { ar: 'الإثنين', fr: 'Lun' },
  2: { ar: 'الثلاثاء', fr: 'Mar' },
  3: { ar: 'الأربعاء', fr: 'Mer' },
  4: { ar: 'الخميس', fr: 'Jeu' },
  5: { ar: 'الجمعة', fr: 'Ven' },
  6: { ar: 'السبت', fr: 'Sam' },
};

function getCalendarWeekDays(weekOffset: number) {
  const now = new Date();
  const mondayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const currentDay = mondayBase.getDay();
  const diffToTuesday = currentDay === 1 ? 1 : currentDay === 0 ? -5 : 2 - currentDay;
  mondayBase.setDate(mondayBase.getDate() + diffToTuesday + weekOffset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(mondayBase);
    dt.setDate(mondayBase.getDate() + i);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const weekday = dt.getDay();
    return {
      dateStr,
      shortDate: `${dd}/${mm}`,
      weekday,
      label: WEEKDAY_LABELS[weekday],
      salonSlots: getSalonSlotsForDate(dateStr),
    };
  });
}

function getRequestTypeMeta(type: ShiftRequestType): {
  label: string;
  tone: string;
} {
  switch (type) {
    case 'day_off':
      return { label: 'إجازة يوم كامل (حجب)', tone: 'text-red-300' };
    case 'day_open':
      return { label: 'إتاحة يوم عمل (فتح)', tone: 'text-emerald-300' };
    case 'slot_block':
      return { label: 'حجب ساعات محددة', tone: 'text-amber-300' };
    case 'slot_open':
      return { label: 'إعادة فتح ساعات', tone: 'text-emerald-300' };
    case 'shift_swap':
      return { label: 'تبديل مناوبة مع زميل', tone: 'text-blue-300' };
  }
}

export const AdminShiftPlannerPanel: React.FC<AdminShiftPlannerPanelProps> = ({
  requests,
  schedules,
  bookings,
  role,
  ownBarberId,
  reviewerName,
  todayStr,
}) => {
  const defaultRequesterId =
    role === 'barber' ? ownBarberId : TEAM_MEMBERS[1]?.id || TEAM_MEMBERS[0].id;

  const [barberId, setBarberId] = useState<string>(defaultRequesterId);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [requestType, setRequestType] = useState<ShiftRequestType>('slot_block');
  const [targetDate, setTargetDate] = useState<string>(() => getInitialBookingDate());
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [swapWithBarberId, setSwapWithBarberId] = useState<string>(() => {
    const other = TEAM_MEMBERS.find((b) => b.id !== defaultRequesterId);
    return other?.id || TEAM_MEMBERS[0].id;
  });
  const [swapDate, setSwapDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>(
    'all'
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const effectiveBarberId = role === 'barber' ? ownBarberId : barberId;
  const requesterBarber =
    TEAM_MEMBERS.find((b) => b.id === effectiveBarberId) || TEAM_MEMBERS[0];
  const activeSchedule =
    schedules[effectiveBarberId] || getDefaultBarberSchedule(effectiveBarberId);
  const colleagueOptions = TEAM_MEMBERS.filter((b) => b.id !== effectiveBarberId);

  const weekDays = useMemo(() => getCalendarWeekDays(weekOffset), [weekOffset]);
  const salonSlotsForTarget = useMemo(() => getSalonSlotsForDate(targetDate), [targetDate]);
  const isTargetMonday = parseDateWeekday(targetDate) === 1;

  // Map active client bookings for the selected barber in the calendar grid
  const barberBookingsMap = useMemo(() => {
    const map = new Map<string, AppointmentBooking>();
    bookings.forEach((b) => {
      if (
        b.barberId === effectiveBarberId &&
        !['cancelled', 'rejected', 'no_show'].includes(b.status)
      ) {
        const effDate = b.rescheduledTo?.date || b.date;
        const effTime = (b.rescheduledTo?.time || b.timeSlot).trim();
        map.set(`${effDate}@${effTime}`, b);
      }
    });
    return map;
  }, [bookings, effectiveBarberId]);

  const pendingForCalendar = useMemo(
    () =>
      requests.filter(
        (r) => r.status === 'pending' && r.barberId === effectiveBarberId
      ),
    [requests, effectiveBarberId]
  );

  const visibleRequests = useMemo(() => {
    return requests.filter((req) => {
      if (role === 'barber') {
        const isMine =
          req.barberId === ownBarberId || req.swapWithBarberId === ownBarberId;
        if (!isMine) return false;
      }
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      return true;
    });
  }, [requests, role, ownBarberId, statusFilter]);

  const pendingCount = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === 'pending' &&
          (role === 'master' ||
            r.barberId === ownBarberId ||
            r.swapWithBarberId === ownBarberId)
      ).length,
    [requests, role, ownBarberId]
  );

  const approvedCount = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === 'approved' &&
          (role === 'master' ||
            r.barberId === ownBarberId ||
            r.swapWithBarberId === ownBarberId)
      ).length,
    [requests, role, ownBarberId]
  );

  const handleSelectBarberForPlanner = (nextId: string) => {
    setBarberId(nextId);
    setSelectedSlots([]);
    if (swapWithBarberId === nextId) {
      const alt = TEAM_MEMBERS.find((b) => b.id !== nextId);
      if (alt) setSwapWithBarberId(alt.id);
    }
  };

  // Calendar Click: Toggle full-day off/open request into the staged form
  const handleCalendarDayClick = (dateStr: string, isCurrentlyBarberOff: boolean) => {
    setTargetDate(dateStr);
    setSelectedSlots([]);
    if (requestType !== 'shift_swap') {
      setRequestType(isCurrentlyBarberOff ? 'day_open' : 'day_off');
    }
  };

  // Calendar Click: Stage/toggle a specific slot change directly from the calendar grid
  const handleCalendarSlotClick = (
    dateStr: string,
    slot: string,
    isCurrentlyBlocked: boolean
  ) => {
    if (targetDate !== dateStr) {
      setTargetDate(dateStr);
      setSelectedSlots([slot]);
      if (requestType !== 'shift_swap') {
        setRequestType(isCurrentlyBlocked ? 'slot_open' : 'slot_block');
      }
      return;
    }

    setSelectedSlots((prev) => {
      const exists = prev.includes(slot);
      const next = exists ? prev.filter((s) => s !== slot) : [...prev, slot].sort();
      return next;
    });

    if (requestType !== 'shift_swap') {
      setRequestType(isCurrentlyBlocked ? 'slot_open' : 'slot_block');
    }
  };

  const handleToggleSlotPill = (slot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot].sort()
    );
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!targetDate) {
      sendDualAlert('يرجى تحديد التاريخ في التقويم', { type: 'warning', skipSound: true });
      return;
    }

    if (isTargetMonday) {
      sendDualAlert('الصالون مغلق يوم الإثنين', {
        body: 'يوم الإثنين هو العطلة الأسبوعية الرسمية للصالون. اختر يوماً آخر.',
        type: 'warning',
        skipSound: true,
      });
      return;
    }

    if (
      (requestType === 'slot_block' || requestType === 'slot_open') &&
      selectedSlots.length === 0
    ) {
      sendDualAlert('اختر ساعة واحدة على الأقل من التقويم', {
        body: 'اضغط مباشرة على الساعات في التقويم أعلاه أو اخترها أدناه.',
        type: 'warning',
        skipSound: true,
      });
      return;
    }

    if (
      requestType === 'shift_swap' &&
      (!swapWithBarberId || swapWithBarberId === effectiveBarberId)
    ) {
      sendDualAlert('اختر الحلاق البديل للتبديل', {
        type: 'warning',
        skipSound: true,
      });
      return;
    }

    setSubmitting(true);
    try {
      const swapPartner = TEAM_MEMBERS.find((b) => b.id === swapWithBarberId);
      await createShiftRequest({
        barberId: effectiveBarberId,
        barberName: requesterBarber.name.ar,
        requestType,
        targetDate,
        targetSlots:
          requestType === 'slot_block' ||
          requestType === 'slot_open' ||
          (requestType === 'shift_swap' && selectedSlots.length > 0)
            ? selectedSlots
            : undefined,
        swapWithBarberId: requestType === 'shift_swap' ? swapWithBarberId : undefined,
        swapWithBarberName:
          requestType === 'shift_swap' && swapPartner ? swapPartner.name.ar : undefined,
        swapDate: requestType === 'shift_swap' && swapDate ? swapDate : undefined,
        reason: reason.trim() || undefined,
      });

      setSelectedSlots([]);
      setSwapDate('');
      setReason('');
      sendDualAlert('تم إرسال طلب تغيير التوفر بنجاح ✓', {
        body:
          role === 'master'
            ? 'تم تسجيل الطلب في قائمة المراجعة للاعتماد.'
            : 'سيراجع المدير العام الطلب ويتم تحديث التوفر في صفحة الحجز فور الموافقة.',
        type: 'success',
      });
    } catch {
      sendDualAlert('تعذر إرسال الطلب', {
        body: 'تحقق من الاتصال وحاول مرة أخرى.',
        type: 'warning',
        skipSound: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (req: ShiftRequest) => {
    if (role !== 'master') return;
    setBusyId(req.id);
    try {
      await approveShiftRequestAndSyncAvailability(
        req,
        schedules,
        reviewerName,
        reviewNotes[req.id]
      );
      sendDualAlert('تمت الموافقة ومزامنة توفر الحجز ✓', {
        body: `تم تحديث جدول ${req.barberName}${
          req.swapWithBarberName ? ` و ${req.swapWithBarberName}` : ''
        } في نظام الحجز الرئيسي مباشرة.`,
        type: 'success',
      });
    } catch {
      sendDualAlert('تعذر اعتماد الطلب', {
        body: 'حدث خطأ أثناء تحديث التوفر في قاعدة البيانات.',
        type: 'warning',
        skipSound: true,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeny = async (req: ShiftRequest) => {
    if (role !== 'master') return;
    setBusyId(req.id);
    try {
      await rejectShiftRequest(req.id, reviewerName, reviewNotes[req.id]);
      sendDualAlert('تم رفض الطلب', {
        body: `لم يتغير جدول ${req.barberName}.`,
        type: 'warning',
        skipSound: true,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (req: ShiftRequest) => {
    setBusyId(req.id);
    try {
      await deleteShiftRequest(req.id);
      sendDualAlert('تم حذف الطلب', { type: 'success', skipSound: true });
    } finally {
      setBusyId(null);
    }
  };

  const getBookingConflicts = (req: ShiftRequest) => {
    if (req.requestType === 'day_open' || req.requestType === 'slot_open') return [];
    return bookings.filter((b) => {
      if (b.barberId !== req.barberId) return false;
      if (['cancelled', 'rejected', 'no_show', 'completed'].includes(b.status)) return false;
      const effDate = b.rescheduledTo?.date || b.date;
      if (effDate !== req.targetDate) return false;
      if (req.targetSlots && req.targetSlots.length > 0) {
        const effTime = (b.rescheduledTo?.time || b.timeSlot).trim();
        return req.targetSlots.includes(effTime);
      }
      return true;
    });
  };

  const getBarberColor = (id: string) =>
    TEAM_MEMBERS.find((m) => m.id === id)?.themeColor || '#D97706';

  return (
    <div className="space-y-5 text-xs">
      {/* Header & Summary Strip */}
      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>مخطط المناوبات والتوفر • Admin Shift Planner</span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {role === 'master'
              ? 'تقويم تفاعلي لتقديم تغييرات التوفر، وموافقة أو رفض الطلبات مع مزامنة فورية لنظام الحجز.'
              : 'اضغط على أي يوم أو ساعة في التقويم لتقديم طلب تعديل توفرك أو إجازتك للمدير العام.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 font-mono tabular-nums text-[11px] flex-shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold">
            معلق: {pendingCount}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold">
            معتمد: {approvedCount}
          </span>
        </div>
      </div>

      {/* INTERACTIVE CALENDAR-BASED AVAILABILITY REQUEST BUILDER */}
      <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 overflow-hidden">
        {/* Calendar Top Toolbar: Barber Selector + Week Navigator */}
        <div className="p-4 border-b border-zinc-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white">
                1. اختر الأيام أو الساعات من التقويم:
              </span>
              {role === 'barber' && (
                <span
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border text-white"
                  style={{
                    backgroundColor: `${getBarberColor(effectiveBarberId)}25`,
                    borderColor: `${getBarberColor(effectiveBarberId)}60`,
                  }}
                >
                  {requesterBarber.name.ar}
                </span>
              )}
            </div>

            {role === 'master' && (
              <div className="flex flex-wrap items-center gap-1.5">
                {TEAM_MEMBERS.map((b) => {
                  const active = effectiveBarberId === b.id;
                  const color = b.themeColor || '#D97706';
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBarberForPlanner(b.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
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
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/70">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className={`px-2.5 py-1.5 rounded-lg font-bold border cursor-pointer ${
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
                className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>التالي</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600/40 border border-emerald-500/60 inline-block" />
                متاح (اضغط لطلب حجب)
              </span>
              <span className="flex items-center gap-1 text-red-300">
                <span className="w-2.5 h-2.5 rounded bg-red-900/60 border border-red-500/60 inline-block" />
                محجوب (اضغط لطلب فتح)
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-2.5 h-2.5 rounded bg-amber-500/40 border border-amber-400 inline-block" />
                محدد / طلب معلق
              </span>
            </div>
          </div>
        </div>

        {/* Interactive 7-Day Weekly Calendar Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-center">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="p-2.5 text-right font-black text-zinc-400 w-20 border-l border-zinc-800/80">
                  التوقيت
                </th>
                {weekDays.map((day) => {
                  const avail = evaluateBarberDayAvailability(
                    effectiveBarberId,
                    day.dateStr,
                    schedules,
                    bookings
                  );
                  const isMondayClosed = day.weekday === 1;
                  const isSelectedDay = targetDate === day.dateStr;
                  const dayPending = pendingForCalendar.some(
                    (r) => r.targetDate === day.dateStr && (!r.targetSlots || r.targetSlots.length === 0)
                  );

                  return (
                    <th
                      key={day.dateStr}
                      className={`p-2 border-l border-zinc-800/70 align-top ${
                        isSelectedDay ? 'bg-amber-500/15' : day.dateStr === todayStr ? 'bg-zinc-900/60' : ''
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-black text-xs text-white">
                          {day.label.ar}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400 tabular-nums">
                          {day.shortDate}
                        </div>

                        {isMondayClosed ? (
                          <div className="py-1 px-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px]">
                            عطلة الصالون
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleCalendarDayClick(day.dateStr, avail.isBarberOffDay)
                            }
                            className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              isSelectedDay && (requestType === 'day_off' || requestType === 'day_open')
                                ? 'bg-amber-500 text-black border-amber-400'
                                : avail.isBarberOffDay
                                ? 'bg-red-950/60 border-red-500/50 text-red-300 hover:bg-emerald-950/60 hover:text-emerald-200'
                                : 'bg-emerald-950/40 border-emerald-500/35 text-emerald-300 hover:bg-amber-500/20 hover:text-amber-200'
                            }`}
                          >
                            {dayPending
                              ? '⏳ طلب معلق'
                              : avail.isBarberOffDay
                              ? 'إجازة (اطلب فتحاً)'
                              : 'يوم عمل (اطلب إجازة)'}
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
                <tr
                  key={slot}
                  className="border-b border-zinc-800/60 last:border-b-0 hover:bg-zinc-900/40"
                >
                  <td
                    dir="ltr"
                    className="p-2 font-mono font-black text-xs text-zinc-300 bg-zinc-950/70 border-l border-zinc-800/80 tabular-nums"
                  >
                    {slot}
                  </td>

                  {weekDays.map((day) => {
                    const isMonday = day.weekday === 1;
                    const inSalonHours = day.salonSlots.includes(slot);
                    const isDayOff =
                      isMonday ||
                      activeSchedule.offWeekdays.includes(day.weekday) ||
                      activeSchedule.offDates.includes(day.dateStr);

                    if (!inSalonHours || isDayOff) {
                      return (
                        <td
                          key={`${day.dateStr}-${slot}`}
                          className="p-1.5 border-l border-zinc-800/60 bg-zinc-950/40"
                        >
                          <div className="py-1.5 rounded-lg text-[10px] text-zinc-600 font-medium">
                            {isMonday ? 'مغلق' : !inSalonHours ? 'خارج الدوام' : 'إجازة'}
                          </div>
                        </td>
                      );
                    }

                    const bookedItem = barberBookingsMap.get(`${day.dateStr}@${slot}`);
                    const key = `${day.dateStr}@${slot}`;
                    const isBlocked =
                      activeSchedule.dateSlotBlocks.includes(key) ||
                      activeSchedule.breakSlots.includes(slot);
                    const isStaged =
                      targetDate === day.dateStr && selectedSlots.includes(slot);
                    const hasPendingSlotReq = pendingForCalendar.some(
                      (r) =>
                        r.targetDate === day.dateStr &&
                        r.targetSlots?.includes(slot)
                    );

                    if (bookedItem) {
                      return (
                        <td
                          key={`${day.dateStr}-${slot}`}
                          className="p-1.5 border-l border-zinc-800/60"
                        >
                          <div
                            className="py-1.5 px-1.5 rounded-lg bg-blue-950/60 border border-blue-500/45 text-blue-200 text-[10px] font-bold truncate"
                            title={`${bookedItem.ticketNumber} — ${bookedItem.clientName}`}
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
                          onClick={() =>
                            handleCalendarSlotClick(day.dateStr, slot, isBlocked)
                          }
                          className={`w-full py-1.5 px-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                            isStaged
                              ? 'bg-amber-500 text-black border-amber-300 shadow-sm'
                              : hasPendingSlotReq
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                              : isBlocked
                              ? 'bg-red-950/65 hover:bg-emerald-950/60 border-red-500/55 text-red-200 hover:text-emerald-200'
                              : 'bg-emerald-950/35 hover:bg-amber-500/20 border-emerald-500/35 hover:border-amber-500/60 text-emerald-300 hover:text-amber-200'
                          }`}
                        >
                          {isStaged
                            ? '✓ محدد للطلب'
                            : hasPendingSlotReq
                            ? '⏳ معلق'
                            : isBlocked
                            ? '⏸ محجوب'
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

        {/* Request Confirmation & Submission Bar */}
        <form
          onSubmit={handleSubmitRequest}
          className="p-4 bg-zinc-950/80 border-t border-zinc-800 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-black text-white text-xs flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>2. تفاصيل طلب تعديل التوفر المحدد</span>
            </span>

            {/* Mode Switcher */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'slot_block', label: 'حجب ساعات', icon: Clock },
                { id: 'slot_open', label: 'فتح ساعات', icon: CalendarCheck2 },
                { id: 'day_off', label: 'يوم إجازة', icon: CalendarOff },
                { id: 'day_open', label: 'فتح يوم', icon: CalendarCheck2 },
                { id: 'shift_swap', label: 'تبديل مناوبة', icon: Repeat },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = requestType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setRequestType(opt.id as ShiftRequestType);
                      if (opt.id === 'day_off' || opt.id === 'day_open') {
                        setSelectedSlots([]);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <label className="block text-[11px] text-zinc-400 mb-1 font-bold">
                التاريخ المحدد
              </label>
              <input
                type="date"
                value={targetDate}
                min={todayStr}
                onChange={(e) => {
                  setTargetDate(e.target.value);
                  setSelectedSlots([]);
                }}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            {requestType === 'shift_swap' ? (
              <>
                <div className="md:col-span-3">
                  <label className="block text-[11px] text-amber-300 mb-1 font-bold">
                    الحلاق البديل في التبديل
                  </label>
                  <select
                    value={swapWithBarberId}
                    onChange={(e) => setSwapWithBarberId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {colleagueOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name.ar} ({c.name.fr})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[11px] text-zinc-400 mb-1 font-bold">
                    تاريخ التغطية البديل (اختياري)
                  </label>
                  <input
                    type="date"
                    value={swapDate}
                    min={todayStr}
                    onChange={(e) => setSwapDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-6">
                <label className="block text-[11px] text-zinc-400 mb-1 font-bold">
                  {requestType === 'day_off' || requestType === 'day_open'
                    ? 'نطاق التعديل'
                    : 'الساعات المحددة من التقويم'}
                </label>
                {requestType === 'day_off' || requestType === 'day_open' ? (
                  <div className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold">
                    {requestType === 'day_off'
                      ? `يوم عطلة كامل بتاريخ ${targetDate}`
                      : `فتح يوم عمل كامل بتاريخ ${targetDate}`}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {salonSlotsForTarget.map((slot) => {
                      const active = selectedSlots.includes(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => handleToggleSlotPill(slot)}
                          className={`px-2.5 py-1.5 rounded-lg border font-mono text-[11px] font-bold cursor-pointer ${
                            active
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-3">
              <label className="block text-[11px] text-zinc-400 mb-1 font-bold">
                ملاحظة / سبب (اختياري)
              </label>
              <input
                type="text"
                maxLength={250}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="سبب التعديل..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-zinc-400">
              {selectedSlots.length > 0
                ? `الساعات المحددة: ${selectedSlots.join(' · ')}`
                : isTargetMonday
                ? 'يوم الإثنين مغلق رسمياً'
                : 'اضغط على خلايا التقويم أعلاه لتحديد أو تعديل الساعات بسهولة.'}
            </span>
            <button
              type="submit"
              disabled={submitting || isTargetMonday}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>إرسال طلب تغيير التوفر</span>
            </button>
          </div>
        </form>
      </div>

      {/* MASTER ADMIN APPROVAL / DENY QUEUE & REQUEST HISTORY */}
      <div className="space-y-3">
        <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {role === 'master'
                ? 'طلبات تغيير التوفر والمناوبات (قبول أو رفض مع المزامنة التلقائية)'
                : 'سجل طلباتك المقدمة وحالة الموافقة'}
            </span>
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'pending', label: `معلق (${pendingCount})` },
              { id: 'approved', label: 'مقبول ✓' },
              { id: 'rejected', label: 'مرفوض' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-1.5">
            <Calendar className="w-7 h-7 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-300">
              لا توجد طلبات تغيير توفر في هذا القسم حالياً.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleRequests.map((req) => {
              const color = getBarberColor(req.barberId);
              const conflicts = req.status === 'pending' ? getBookingConflicts(req) : [];
              const isBusy = busyId === req.id;
              const meta = getRequestTypeMeta(req.requestType);

              return (
                <div
                  key={req.id}
                  className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    req.status === 'pending'
                      ? 'bg-zinc-900/90 border-amber-500/40'
                      : req.status === 'approved'
                      ? 'bg-emerald-950/15 border-emerald-500/35'
                      : 'bg-zinc-900/50 border-zinc-800 opacity-80'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 font-black text-white text-xs">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          {req.barberName}
                        </span>
                        <span className={`text-[11px] font-bold ${meta.tone}`}>
                          · {meta.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            req.status === 'pending'
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : req.status === 'approved'
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-red-500/15 border-red-500/40 text-red-300'
                          }`}
                        >
                          {req.status === 'pending'
                            ? 'قيد المراجعة'
                            : req.status === 'approved'
                            ? 'مقبول وتمت المزامنة ✓'
                            : 'مرفوض'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-300 tabular-nums">
                        <span>📅 {req.targetDate}</span>
                        {req.targetSlots && req.targetSlots.length > 0 && (
                          <span className="text-amber-300">
                            🕒 {req.targetSlots.join(' · ')}
                          </span>
                        )}
                        {req.requestType === 'shift_swap' && req.swapWithBarberName && (
                          <span className="font-sans text-blue-300 font-bold">
                            ⇄ مع {req.swapWithBarberName}
                            {req.swapDate ? ` (مقابل ${req.swapDate})` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {(req.status === 'pending' || role === 'master') && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(req)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="حذف / سحب الطلب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {req.reason && (
                    <p className="text-[11px] text-zinc-300 bg-black/35 px-2.5 py-1.5 rounded-lg border border-zinc-800/80">
                      السبب: {req.reason}
                    </p>
                  )}

                  {conflicts.length > 0 && (
                    <div className="p-2 rounded-lg bg-orange-950/40 border border-orange-500/40 text-orange-200 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      <span>
                        تنبيه: يوجد {conflicts.length} موعد حجز نشط لهذا الحلاق في هذا التاريخ (
                        {conflicts.map((c) => `${c.timeSlot} ${c.clientName}`).slice(0, 2).join('، ')}
                        ).
                      </span>
                    </div>
                  )}

                  {req.reviewerNote && (
                    <div className="text-[11px] text-zinc-400">
                      رد الإدارة ({req.reviewedBy || 'Master Admin'}):{' '}
                      <span className="text-zinc-200">{req.reviewerNote}</span>
                    </div>
                  )}

                  {role === 'master' && req.status === 'pending' && (
                    <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={reviewNotes[req.id] || ''}
                        onChange={(e) =>
                          setReviewNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        placeholder="ملاحظة للموظف (اختياري)..."
                        className="flex-1 bg-black/50 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleApprove(req)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {isBusy ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>موافقة ومزامنة ✓</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeny(req)}
                          className="px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-600 border border-red-500/40 text-red-200 hover:text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>رفض</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
