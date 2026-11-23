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
  Language,
  ShiftRequest,
  ShiftRequestType,
  StaffRole,
} from '../types';
import { getMergedBarbers, useBarberProfiles } from '../utils/barberProfileStore';
import { useBarberRoster } from '../utils/barberRosterStore';
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
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface AdminShiftPlannerPanelProps {
  requests: ShiftRequest[];
  schedules: Record<string, BarberScheduleConfig>;
  bookings: AppointmentBooking[];
  role: StaffRole;
  ownBarberId: string;
  reviewerName: string;
  todayStr: string;
}

const WEEKDAY_LABELS: Record<number, Record<Language, string>> = {
  0: { ar: 'الأحد', fr: 'Dim', amz: 'ⴰⵙⴰⵎⴰⵙ', en: 'Sun', es: 'Dom' },
  1: { ar: 'الإثنين', fr: 'Lun', amz: 'ⴰⵢⵏⴰⵙ', en: 'Mon', es: 'Lun' },
  2: { ar: 'الثلاثاء', fr: 'Mar', amz: 'ⴰⵙⵉⵏⴰⵙ', en: 'Tue', es: 'Mar' },
  3: { ar: 'الأربعاء', fr: 'Mer', amz: 'ⴰⴽⵕⴰⵙ', en: 'Wed', es: 'Mié' },
  4: { ar: 'الخميس', fr: 'Jeu', amz: 'ⴰⴽⵡⴰⵙ', en: 'Thu', es: 'Jue' },
  5: { ar: 'الجمعة', fr: 'Ven', amz: 'ⴰⵙⵉⵎⵡⴰⵙ', en: 'Fri', es: 'Vie' },
  6: { ar: 'السبت', fr: 'Sam', amz: 'ⴰⵙⵉⴹⵢⴰⵙ', en: 'Sat', es: 'Sáb' },
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

function getRequestTypeMeta(type: ShiftRequestType, lang: Language): {
  label: string;
  tone: string;
} {
  switch (type) {
    case 'day_off':
      return {
        label: pickLang(lang, {
          ar: 'إجازة يوم كامل (حجب)',
          fr: 'Journée de congé (bloquer)',
          amz: 'ⴰⵙⵙ ⵏ ⵓⵙⵓⵏⴼⵓ',
          en: 'Full Day Off (Block)',
          es: 'Día libre (bloquear)',
        }),
        tone: 'text-red-300',
      };
    case 'day_open':
      return {
        label: pickLang(lang, {
          ar: 'إتاحة يوم عمل (فتح)',
          fr: 'Ouvrir journée de travail',
          amz: 'ⵕⵥⵎ ⴰⵙⵙ ⵏ ⵜⵡⵓⵔⵉ',
          en: 'Open Work Day',
          es: 'Abrir día laboral',
        }),
        tone: 'text-emerald-300',
      };
    case 'slot_block':
      return {
        label: pickLang(lang, {
          ar: 'حجب ساعات محددة',
          fr: 'Bloquer des créneaux',
          amz: 'ⵇⵇⵏ ⵜⵉⵙⵔⴰⴳⵉⵏ',
          en: 'Block Specific Hours',
          es: 'Bloquear horas',
        }),
        tone: 'text-amber-300',
      };
    case 'slot_open':
      return {
        label: pickLang(lang, {
          ar: 'إعادة فتح ساعات',
          fr: 'Rouvrir des créneaux',
          amz: 'ⵕⵥⵎ ⵜⵉⵙⵔⴰⴳⵉⵏ',
          en: 'Reopen Hours',
          es: 'Reabrir horas',
        }),
        tone: 'text-emerald-300',
      };
    case 'shift_swap':
      return {
        label: pickLang(lang, {
          ar: 'تبديل مناوبة مع زميل',
          fr: 'Échange de créneau avec collègue',
          amz: 'ⴰⵙⵏⴼⵍ ⵏ ⵜⵡⵓⵔⵉ ⴷ ⵓⵎⴷⴷⴰⴽⴽʷⵍ',
          en: 'Shift Swap with Colleague',
          es: 'Cambio de turno con colega',
        }),
        tone: 'text-blue-300',
      };
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
  const { lang } = useLanguage();
  const roster = useBarberRoster();
  const profilesMap = useBarberProfiles();
  const mergedBarbers = useMemo(
    () => getMergedBarbers(profilesMap, roster),
    [profilesMap, roster]
  );
  const defaultRequesterId =
    role === 'barber' ? ownBarberId : mergedBarbers[1]?.id || mergedBarbers[0]?.id || 'hassan';

  const [barberId, setBarberId] = useState<string>(defaultRequesterId);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [requestType, setRequestType] = useState<ShiftRequestType>('slot_block');
  const [targetDate, setTargetDate] = useState<string>(() => getInitialBookingDate());
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [swapWithBarberId, setSwapWithBarberId] = useState<string>(() => {
    const other = mergedBarbers.find((b) => b.id !== defaultRequesterId);
    return other?.id || mergedBarbers[0]?.id || 'hassan';
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
    mergedBarbers.find((b) => b.id === effectiveBarberId) || mergedBarbers[0];
  const requesterBarberLabel = requesterBarber.name[lang] || requesterBarber.name.ar || requesterBarber.name.fr;
  const activeSchedule =
    schedules[effectiveBarberId] || getDefaultBarberSchedule(effectiveBarberId);
  const colleagueOptions = mergedBarbers.filter((b) => b.id !== effectiveBarberId);

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
      const alt = mergedBarbers.find((b) => b.id !== nextId);
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
      sendDualAlert(
        pickLang(lang, {
          ar: 'يرجى تحديد التاريخ في التقويم',
          fr: 'Veuillez sélectionner une date dans le calendrier',
          amz: 'ⵙⵜⵉ ⴰⵙⴰⴽⵓⴷ ⴳ ⵓⵙⵎⵍⵓⵙⵙⴰⵏ',
          en: 'Please select a date on the calendar',
          es: 'Por favor selecciona una fecha en el calendario',
        }),
        { type: 'warning', skipSound: true }
      );
      return;
    }

    if (isTargetMonday) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'الصالون مغلق يوم الإثنين',
          fr: 'Le salon est fermé le lundi',
          amz: 'ⵜⴰⵃⴰⵏⵓⵜ ⵜⵇⵇⵏ ⴰⵙⵙ ⵏ ⵓⵢⵏⴰⵙ',
          en: 'The salon is closed on Mondays',
          es: 'El salón cierra los lunes',
        }),
        {
          body: pickLang(lang, {
            ar: 'يوم الإثنين هو العطلة الأسبوعية الرسمية للصالون. اختر يوماً آخر.',
            fr: 'Le lundi est le jour de repos hebdomadaire officiel. Choisissez un autre jour.',
            amz: 'ⴰⵙⵙ ⵏ ⵓⵢⵏⴰⵙ ⵉⴳⴰ ⴰⵙⵙ ⵏ ⵓⵙⵓⵏⴼⵓ.',
            en: 'Monday is the salon’s weekly day off. Please pick another day.',
            es: 'El lunes es el día de descanso oficial. Elige otro día.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }

    if (
      (requestType === 'slot_block' || requestType === 'slot_open') &&
      selectedSlots.length === 0
    ) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'اختر ساعة واحدة على الأقل من التقويم',
          fr: 'Sélectionnez au moins un créneau',
          amz: 'ⵙⵜⵉ ⵜⴰⵙⵔⴰⴳⵜ ⵢⴰⵜ ⵖⵓⵔ ⵓⴷⵔⵓⵙ',
          en: 'Select at least one time slot',
          es: 'Selecciona al menos una hora',
        }),
        {
          body: pickLang(lang, {
            ar: 'اضغط مباشرة على الساعات في التقويم أعلاه أو اخترها أدناه.',
            fr: 'Cliquez directement sur les créneaux ci-dessus ou ci-dessous.',
            amz: 'ⴰⴷⵔ ⵖⴼ ⵜⵙⵔⴰⴳⵉⵏ ⴰⴼⵍⵍⴰ ⵏⵖ ⵉⵣⴷⴰⵔ.',
            en: 'Click directly on the hours in the calendar above or pick below.',
            es: 'Haz clic en las horas del calendario superior o inferior.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }

    if (
      requestType === 'shift_swap' &&
      (!swapWithBarberId || swapWithBarberId === effectiveBarberId)
    ) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'اختر الحلاق البديل للتبديل',
          fr: 'Choisissez le barbier pour l’échange',
          amz: 'ⵙⵜⵉ ⴰⵎⵣⵣⴰⴳ ⵉ ⵓⵙⵏⴼⵍ',
          en: 'Select a colleague for the shift swap',
          es: 'Elige el barbero para el intercambio',
        }),
        { type: 'warning', skipSound: true }
      );
      return;
    }

    setSubmitting(true);
    try {
      const swapPartner = mergedBarbers.find((b) => b.id === swapWithBarberId);
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
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم إرسال طلب تغيير التوفر بنجاح ✓',
          fr: 'Demande de modification envoyée ✓',
          amz: 'ⵉⵜⵜⵓⵢⴰⵣⵏ ⵓⵙⵓⵜⵔ ✓',
          en: 'Availability request submitted ✓',
          es: 'Solicitud de disponibilidad enviada ✓',
        }),
        {
          body:
            role === 'master'
              ? pickLang(lang, {
                  ar: 'تم تسجيل الطلب في قائمة المراجعة للاعتماد.',
                  fr: 'Enregistrée dans la file de validation.',
                  amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵙⵓⵜⵔ.',
                  en: 'Recorded in the review queue for approval.',
                  es: 'Registrada en la cola de aprobación.',
                })
              : pickLang(lang, {
                  ar: 'سيراجع المشرف العام الطلب ويتم تحديث التوفر في صفحة الحجز فور الموافقة.',
                  fr: 'La direction examinera la demande ; le calendrier sera mis à jour dès approbation.',
                  amz: 'ⴰⴷ ⵜ ⵉⵥⵕ ⵓⵏⵎⵀⴰⵍ ⵉⵙⵎⴰⵢⵏⵓ ⴰⵙⵎⵍⵓⵙⵙⴰⵏ.',
                  en: 'Management will review it and booking availability will sync upon approval.',
                  es: 'La dirección la revisará y se sincronizará al aprobarse.',
                }),
          type: 'success',
        }
      );
    } catch {
      sendDualAlert(
        pickLang(lang, {
          ar: 'تعذر إرسال الطلب',
          fr: 'Échec de l’envoi',
          amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵜⵜⵓⵢⴰⵣⵏ',
          en: 'Failed to submit request',
          es: 'No se pudo enviar la solicitud',
        }),
        {
          body: pickLang(lang, {
            ar: 'تحقق من الاتصال وحاول مرة أخرى.',
            fr: 'Vérifiez votre connexion et réessayez.',
            amz: 'ⵙⵙⴼⵇⴷ ⴰⵣⴷⴰⵢ ⵏⵏⴽ.',
            en: 'Check your connection and try again.',
            es: 'Comprueba tu conexión e inténtalo de nuevo.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
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
      sendDualAlert(
        pickLang(lang, {
          ar: 'تمت الموافقة ومزامنة توفر الحجز ✓',
          fr: 'Approuvé et synchronisé avec les réservations ✓',
          amz: 'ⵉⵜⵜⵓⵇⴱⵍ ⵉⵜⵜⵓⵙⵎⴰⵢⵏⵓ ✓',
          en: 'Approved and synced with booking availability ✓',
          es: 'Aprobado y sincronizado ✓',
        }),
        {
          body: pickLang(lang, {
            ar: `تم تحديث جدول ${req.barberName}${req.swapWithBarberName ? ` و ${req.swapWithBarberName}` : ''} في نظام الحجز الرئيسي مباشرة.`,
            fr: `Planning de ${req.barberName}${req.swapWithBarberName ? ` et ${req.swapWithBarberName}` : ''} mis à jour en direct.`,
            amz: `ⵉⵜⵜⵓⵙⵎⴰⵢⵏⵓ ⵓⵙⵎⵍⵓⵙⵙⴰⵏ ⵏ ${req.barberName}.`,
            en: `Updated ${req.barberName}${req.swapWithBarberName ? ` & ${req.swapWithBarberName}` : ''} schedule live.`,
            es: `Horario de ${req.barberName} actualizado en vivo.`,
          }),
          type: 'success',
        }
      );
    } catch {
      sendDualAlert(
        pickLang(lang, { ar: 'تعذر اعتماد الطلب', fr: 'Échec de l’approbation', amz: 'ⴰⵣⴳⴰⵍ', en: 'Failed to approve request', es: 'Error al aprobar' }),
        {
          body: pickLang(lang, {
            ar: 'حدث خطأ أثناء تحديث التوفر في قاعدة البيانات.',
            fr: 'Erreur lors de la mise à jour en base de données.',
            amz: 'ⵜⴰⵣⴳⴰⵍⵜ ⴳ ⵓⵙⵎⴰⵢⵏⵓ.',
            en: 'Database error while updating availability.',
            es: 'Error al actualizar la disponibilidad.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDeny = async (req: ShiftRequest) => {
    if (role !== 'master') return;
    setBusyId(req.id);
    try {
      await rejectShiftRequest(req.id, reviewerName, reviewNotes[req.id]);
      sendDualAlert(
        pickLang(lang, { ar: 'تم رفض الطلب', fr: 'Demande refusée', amz: 'ⵉⵜⵜⵓⵢⴰⴳⵉ ⵓⵙⵓⵜⵔ', en: 'Request rejected', es: 'Solicitud rechazada' }),
        {
          body: pickLang(lang, {
            ar: `لم يتغير جدول ${req.barberName}.`,
            fr: `Le planning de ${req.barberName} reste inchangé.`,
            amz: `ⵓⵔ ⵉⵏⴼⵍ ⵓⵙⵎⵍⵓⵙⵙⴰⵏ ⵏ ${req.barberName}.`,
            en: `${req.barberName} schedule unchanged.`,
            es: `El horario de ${req.barberName} no ha cambiado.`,
          }),
          type: 'warning',
          skipSound: true,
        }
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (req: ShiftRequest) => {
    setBusyId(req.id);
    try {
      await deleteShiftRequest(req.id);
      sendDualAlert(
        pickLang(lang, { ar: 'تم حذف الطلب', fr: 'Demande supprimée', amz: 'ⵉⵜⵜⵓⴽⴽⵙ ⵓⵙⵓⵜⵔ', en: 'Request deleted', es: 'Solicitud eliminada' }),
        { type: 'success', skipSound: true }
      );
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
    mergedBarbers.find((m) => m.id === id)?.themeColor || '#D97706';

  return (
    <div className="space-y-5 text-xs">
      {/* Header & Summary Strip */}
      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>
              {pickLang(lang, {
                ar: 'مخطط المناوبات والتوفر',
                fr: 'Planificateur d’équipes & disponibilités',
                amz: 'ⴰⵖⴰⵡⴰⵙ ⵏ ⵜⵡⵓⵔⵉ ⴷ ⵓⵜⵓⴼⵔ',
                en: 'Admin Shift & Availability Planner',
                es: 'Planificador de Turnos y Disponibilidad',
              })}
            </span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {role === 'master'
              ? pickLang(lang, {
                  ar: 'تقويم تفاعلي لتقديم تغييرات التوفر، وموافقة أو رفض الطلبات مع مزامنة فورية لنظام الحجز.',
                  fr: 'Calendrier interactif pour soumettre et valider les changements de disponibilité en temps réel.',
                  amz: 'ⴰⵙⵎⵍⵓⵙⵙⴰⵏ ⵉ ⵓⵙⵎⴰⵢⵏⵓ ⵏ ⵓⵜⵓⴼⵔ ⴷ ⵜⵓⵔⴰⴳⵜ ⵏ ⵉⵙⵓⵜⴰⵔ.',
                  en: 'Interactive calendar to submit, approve, or deny availability changes with real-time booking sync.',
                  es: 'Calendario interactivo para gestionar y aprobar cambios de disponibilidad en tiempo real.',
                })
              : pickLang(lang, {
                  ar: 'اضغط على أي يوم أو ساعة في التقويم لتقديم طلب تعديل توفرك أو إجازتك للمشرف العام.',
                  fr: 'Cliquez sur un jour ou créneau du calendrier pour soumettre une demande de congé ou modification.',
                  amz: 'ⴰⴷⵔ ⵖⴼ ⵡⴰⵙⵙ ⵏⵖ ⵜⴰⵙⵔⴰⴳⵜ ⵉ ⵓⵙⵓⵜⵔ ⵏ ⵓⵙⵓⵏⴼⵓ.',
                  en: 'Click any day or hour in the calendar to submit an availability or leave request.',
                  es: 'Haz clic en cualquier día u hora para solicitar un cambio o día libre.',
                })}
          </p>
        </div>

        <div className="flex items-center gap-2.5 font-mono tabular-nums text-[11px] flex-shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold">
            {pickLang(lang, { ar: 'معلق:', fr: 'En attente :', amz: 'ⵓⵔ ⵜⴰ:', en: 'Pending:', es: 'Pendiente:' })} {pendingCount}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold">
            {pickLang(lang, { ar: 'معتمد:', fr: 'Approuvé :', amz: 'ⵉⵜⵜⵓⵇⴱⵍ:', en: 'Approved:', es: 'Aprobado:' })} {approvedCount}
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
                {pickLang(lang, {
                  ar: '1. اختر الأيام أو الساعات من التقويم:',
                  fr: '1. Sélectionnez les jours ou créneaux du calendrier :',
                  amz: '1. ⵙⵜⵉ ⵓⵙⵙⴰⵏ ⵏⵖ ⵜⵉⵙⵔⴰⴳⵉⵏ ⵙⴳ ⵓⵙⵎⵍⵓⵙⵙⴰⵏ:',
                  en: '1. Select days or hours from the calendar:',
                  es: '1. Selecciona días u horas del calendario:',
                })}
              </span>
              {role === 'barber' && (
                <span
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border text-white"
                  style={{
                    backgroundColor: `${getBarberColor(effectiveBarberId)}25`,
                    borderColor: `${getBarberColor(effectiveBarberId)}60`,
                  }}
                >
                  {requesterBarberLabel}
                </span>
              )}
            </div>

            {role === 'master' && (
              <div className="flex flex-wrap items-center gap-1.5">
                {mergedBarbers.map((b) => {
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
                      <span>{b.name[lang] || b.name.ar || b.name.fr}</span>
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
                <span>{pickLang(lang, { ar: 'السابق', fr: 'Précédent', amz: 'ⵉⵣⵔⵉⵏ', en: 'Prev', es: 'Anterior' })}</span>
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
                {pickLang(lang, { ar: 'الأسبوع الحالي', fr: 'Semaine actuelle', amz: 'ⵉⵎⴰⵍⴰⵙⵙ ⴰⴷ', en: 'Current Week', es: 'Semana actual' })}
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>{pickLang(lang, { ar: 'التالي', fr: 'Suivant', amz: 'ⴷ-ⵉⴷⴷⴰⵏ', en: 'Next', es: 'Siguiente' })}</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600/40 border border-emerald-500/60 inline-block" />
                {pickLang(lang, { ar: 'متاح (اضغط لطلب حجب)', fr: 'Disponible (cliquer pour bloquer)', amz: 'ⵉⵍⵍⴰ (ⴰⴷⵔ ⵉ ⵓⵇⵇⵏ)', en: 'Available (click to block)', es: 'Disponible (clic para bloquear)' })}
              </span>
              <span className="flex items-center gap-1 text-red-300">
                <span className="w-2.5 h-2.5 rounded bg-red-900/60 border border-red-500/60 inline-block" />
                {pickLang(lang, { ar: 'محجوب (اضغط لطلب فتح)', fr: 'Bloqué (cliquer pour ouvrir)', amz: 'ⵉⵇⵇⵏ (ⴰⴷⵔ ⵉ ⵓⵕⵥⴰⵎ)', en: 'Blocked (click to open)', es: 'Bloqueado (clic para abrir)' })}
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-2.5 h-2.5 rounded bg-amber-500/40 border border-amber-400 inline-block" />
                {pickLang(lang, { ar: 'محدد / طلب معلق', fr: 'Sélectionné / En attente', amz: 'ⵉⵜⵜⵓⵙⵜⵉ / ⵓⵔ ⵜⴰ', en: 'Selected / Pending', es: 'Seleccionado / Pendiente' })}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive 7-Day Weekly Calendar Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-center">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="p-2.5 text-start font-black text-zinc-400 w-20 border-l border-zinc-800/80">
                  {pickLang(lang, { ar: 'التوقيت', fr: 'Heure', amz: 'ⴰⴽⵓⴷ', en: 'Time', es: 'Hora' })}
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
                          {day.label[lang] || day.label.ar}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400 tabular-nums">
                          {day.shortDate}
                        </div>

                        {isMondayClosed ? (
                          <div className="py-1 px-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px]">
                            {pickLang(lang, { ar: 'عطلة الصالون', fr: 'Salon fermé', amz: 'ⵉⵇⵇⵏ', en: 'Salon Closed', es: 'Cerrado' })}
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
                              ? pickLang(lang, { ar: '⏳ طلب معلق', fr: '⏳ En attente', amz: '⏳ ⵓⵔ ⵜⴰ', en: '⏳ Pending', es: '⏳ Pendiente' })
                              : avail.isBarberOffDay
                              ? pickLang(lang, { ar: 'إجازة (اطلب فتحاً)', fr: 'Repos (ouvrir)', amz: 'ⴰⵙⵓⵏⴼⵓ (ⵕⵥⵎ)', en: 'Off (Request Open)', es: 'Libre (abrir)' })
                              : pickLang(lang, { ar: 'يوم عمل (اطلب إجازة)', fr: 'Travail (congé)', amz: 'ⵜⴰⵡⵓⵔⵉ (ⴰⵙⵓⵏⴼⵓ)', en: 'Workday (Req. Off)', es: 'Laboral (pedir libre)' })}
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
                            {isMonday
                              ? pickLang(lang, { ar: 'مغلق', fr: 'Fermé', amz: 'ⵉⵇⵇⵏ', en: 'Closed', es: 'Cerrado' })
                              : !inSalonHours
                              ? pickLang(lang, { ar: 'خارج الدوام', fr: 'Hors horaire', amz: 'ⴱⵕⵕⴰ', en: 'Off Hours', es: 'Fuera horario' })
                              : pickLang(lang, { ar: 'إجازة', fr: 'Congé', amz: 'ⴰⵙⵓⵏⴼⵓ', en: 'Off', es: 'Libre' })}
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
                            ? pickLang(lang, { ar: '✓ محدد للطلب', fr: '✓ Sélectionné', amz: '✓ ⵉⵜⵜⵓⵙⵜⵉ', en: '✓ Selected', es: '✓ Selec.' })
                            : hasPendingSlotReq
                            ? pickLang(lang, { ar: '⏳ معلق', fr: '⏳ Attente', amz: '⏳ ⵓⵔ ⵜⴰ', en: '⏳ Pending', es: '⏳ Pend.' })
                            : isBlocked
                            ? pickLang(lang, { ar: '⏸ محجوب', fr: '⏸ Bloqué', amz: '⏸ ⵉⵇⵇⵏ', en: '⏸ Blocked', es: '⏸ Bloq.' })
                            : pickLang(lang, { ar: '✓ متاح', fr: '✓ Libre', amz: '✓ ⵉⵍⵍⴰ', en: '✓ Open', es: '✓ Libre' })}
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
              <span>
                {pickLang(lang, {
                  ar: '2. تفاصيل طلب تعديل التوفر المحدد',
                  fr: '2. Détails de la demande sélectionnée',
                  amz: '2. ⵉⴼⵔⵓⵔⵉⵜⵏ ⵏ ⵓⵙⵓⵜⵔ',
                  en: '2. Request Details',
                  es: '2. Detalles de la solicitud',
                })}
              </span>
            </span>

            {/* Mode Switcher */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'slot_block', label: pickLang(lang, { ar: 'حجب ساعات', fr: 'Bloquer heures', amz: 'ⵇⵇⵏ ⵜⵉⵙⵔⴰⴳⵉⵏ', en: 'Block Hours', es: 'Bloquear horas' }), icon: Clock },
                { id: 'slot_open', label: pickLang(lang, { ar: 'فتح ساعات', fr: 'Ouvrir heures', amz: 'ⵕⵥⵎ ⵜⵉⵙⵔⴰⴳⵉⵏ', en: 'Open Hours', es: 'Abrir horas' }), icon: CalendarCheck2 },
                { id: 'day_off', label: pickLang(lang, { ar: 'يوم إجازة', fr: 'Jour de congé', amz: 'ⴰⵙⵙ ⵏ ⵓⵙⵓⵏⴼⵓ', en: 'Day Off', es: 'Día libre' }), icon: CalendarOff },
                { id: 'day_open', label: pickLang(lang, { ar: 'فتح يوم', fr: 'Ouvrir jour', amz: 'ⵕⵥⵎ ⴰⵙⵙ', en: 'Open Day', es: 'Abrir día' }), icon: CalendarCheck2 },
                { id: 'shift_swap', label: pickLang(lang, { ar: 'تبديل مناوبة', fr: 'Échanger', amz: 'ⵙⵏⴼⵍ ⵜⴰⵡⵓⵔⵉ', en: 'Shift Swap', es: 'Cambiar turno' }), icon: Repeat },
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
                {pickLang(lang, { ar: 'التاريخ المحدد', fr: 'Date choisie', amz: 'ⴰⵙⴰⴽⵓⴷ ⵉⵜⵜⵓⵙⵜⵉⵏ', en: 'Selected Date', es: 'Fecha' })}
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
                    {pickLang(lang, { ar: 'الحلاق البديل في التبديل', fr: 'Barbier d’échange', amz: 'ⴰⵎⵣⵣⴰⴳ ⴰⵎⴰⴷⴷⴰⴽⴽʷⵍ', en: 'Swap With Barber', es: 'Intercambiar con' })}
                  </label>
                  <select
                    value={swapWithBarberId}
                    onChange={(e) => setSwapWithBarberId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {colleagueOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name[lang] || c.name.ar || c.name.fr}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[11px] text-zinc-400 mb-1 font-bold">
                    {pickLang(lang, { ar: 'تاريخ التغطية البديل (اختياري)', fr: 'Date de remplacement (opt.)', amz: 'ⴰⵙⴰⴽⵓⴷ ⵏ ⵓⵙⵏⴼⵍ', en: 'Replacement Date (opt.)', es: 'Fecha reemplazo (opc.)' })}
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
                    ? pickLang(lang, { ar: 'نطاق التعديل', fr: 'Portée', amz: 'ⴰⵙⴰⵜⴰⵍ', en: 'Scope', es: 'Alcance' })
                    : pickLang(lang, { ar: 'الساعات المحددة من التقويم', fr: 'Créneaux sélectionnés', amz: 'ⵜⵉⵙⵔⴰⴳⵉⵏ ⵉⵜⵜⵓⵙⵜⵉⵏ', en: 'Selected Time Slots', es: 'Horas seleccionadas' })}
                </label>
                {requestType === 'day_off' || requestType === 'day_open' ? (
                  <div className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold">
                    {requestType === 'day_off'
                      ? pickLang(lang, { ar: `يوم عطلة كامل بتاريخ ${targetDate}`, fr: `Journée complète de congé : ${targetDate}`, amz: `ⴰⵙⵙ ⵏ ⵓⵙⵓⵏⴼⵓ ${targetDate}`, en: `Full day off on ${targetDate}`, es: `Día libre completo el ${targetDate}` })
                      : pickLang(lang, { ar: `فتح يوم عمل كامل بتاريخ ${targetDate}`, fr: `Ouvrir journée complète : ${targetDate}`, amz: `ⵕⵥⵎ ⴰⵙⵙ ${targetDate}`, en: `Open full workday on ${targetDate}`, es: `Abrir día completo el ${targetDate}` })}
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
                {pickLang(lang, { ar: 'ملاحظة / سبب (اختياري)', fr: 'Note / Motif (optionnel)', amz: 'ⵜⴰⵎⵍⴰⵢⵜ (ⵓⵔ ⵉⴱⵣⵣⵉⵣ)', en: 'Note / Reason (optional)', es: 'Nota / Motivo (opc.)' })}
              </label>
              <input
                type="text"
                maxLength={250}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={pickLang(lang, { ar: 'سبب التعديل...', fr: 'Motif...', amz: 'ⵜⴰⵎⵍⴰⵢⵜ...', en: 'Reason...', es: 'Motivo...' })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-zinc-400">
              {selectedSlots.length > 0
                ? `${pickLang(lang, { ar: 'الساعات المحددة:', fr: 'Créneaux :', amz: 'ⵜⵉⵙⵔⴰⴳⵉⵏ:', en: 'Selected slots:', es: 'Horas:' })} ${selectedSlots.join(' · ')}`
                : isTargetMonday
                ? pickLang(lang, { ar: 'يوم الإثنين مغلق رسمياً', fr: 'Fermé le lundi', amz: 'ⵉⵇⵇⵏ ⴰⵙⵙ ⵏ ⵓⵢⵏⴰⵙ', en: 'Salon closed on Mondays', es: 'Cerrado los lunes' })
                : pickLang(lang, {
                    ar: 'اضغط على خلايا التقويم أعلاه لتحديد أو تعديل الساعات بسهولة.',
                    fr: 'Cliquez sur les cellules du calendrier ci-dessus pour sélectionner vos créneaux.',
                    amz: 'ⴰⴷⵔ ⵖⴼ ⵜⵙⵔⴰⴳⵉⵏ ⴰⴼⵍⵍⴰ.',
                    en: 'Click calendar cells above to select or modify slots easily.',
                    es: 'Haz clic en las celdas del calendario arriba para seleccionar horas.',
                  })}
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
              <span>
                {pickLang(lang, {
                  ar: 'إرسال طلب تغيير التوفر',
                  fr: 'Envoyer la demande',
                  amz: 'ⴰⵣⵏ ⴰⵙⵓⵜⵔ',
                  en: 'Submit Availability Request',
                  es: 'Enviar solicitud',
                })}
              </span>
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
                ? pickLang(lang, {
                    ar: 'طلبات تغيير التوفر والمناوبات (قبول أو رفض مع المزامنة التلقائية)',
                    fr: 'Demandes de disponibilité et d’échanges (approbation avec synchro auto)',
                    amz: 'ⵉⵙⵓⵜⴰⵔ ⵏ ⵓⵙⵏⴼⵍ ⵏ ⵜⵡⵓⵔⵉ',
                    en: 'Shift & Availability Requests (Approve / Deny with Auto-Sync)',
                    es: 'Solicitudes de turnos (aprobar o rechazar con sincronización)',
                  })
                : pickLang(lang, {
                    ar: 'سجل طلباتك المقدمة وحالة الموافقة',
                    fr: 'Historique de vos demandes et statuts',
                    amz: 'ⴰⵎⵣⵔⵓⵢ ⵏ ⵉⵙⵓⵜⴰⵔ ⵏⵏⴽ',
                    en: 'Your Submitted Requests & Approval Status',
                    es: 'Historial de tus solicitudes',
                  })}
            </span>
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'all', label: pickLang(lang, { ar: 'الكل', fr: 'Tous', amz: 'ⴰⴽⴽʷ', en: 'All', es: 'Todos' }) },
              { id: 'pending', label: `${pickLang(lang, { ar: 'معلق', fr: 'Attente', amz: 'ⵓⵔ ⵜⴰ', en: 'Pending', es: 'Pendiente' })} (${pendingCount})` },
              { id: 'approved', label: pickLang(lang, { ar: 'مقبول ✓', fr: 'Approuvé ✓', amz: 'ⵉⵜⵜⵓⵇⴱⵍ ✓', en: 'Approved ✓', es: 'Aprobado ✓' }) },
              { id: 'rejected', label: pickLang(lang, { ar: 'مرفوض', fr: 'Refusé', amz: 'ⵉⵜⵜⵓⵢⴰⴳⵉ', en: 'Rejected', es: 'Rechazado' }) },
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
              {pickLang(lang, {
                ar: 'لا توجد طلبات تغيير توفر في هذا القسم حالياً.',
                fr: 'Aucune demande de disponibilité dans cette section.',
                amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⵙⵓⵜⴰⵔ ⴳ ⵓⴳⵣⵣⵓⵎ ⴰⴷ.',
                en: 'No availability change requests in this section.',
                es: 'No hay solicitudes en esta sección.',
              })}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleRequests.map((req) => {
              const color = getBarberColor(req.barberId);
              const conflicts = req.status === 'pending' ? getBookingConflicts(req) : [];
              const isBusy = busyId === req.id;
              const meta = getRequestTypeMeta(req.requestType, lang);
              const reqBarberObj = mergedBarbers.find((m) => m.id === req.barberId);
              const reqBarberName = reqBarberObj ? (reqBarberObj.name[lang] || req.barberName) : req.barberName;
              const swapPartnerObj = req.swapWithBarberId
                ? mergedBarbers.find((m) => m.id === req.swapWithBarberId)
                : undefined;
              const swapPartnerName = swapPartnerObj
                ? swapPartnerObj.name[lang] || req.swapWithBarberName
                : req.swapWithBarberName;

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
                          {reqBarberName}
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
                            ? pickLang(lang, { ar: 'قيد المراجعة', fr: 'En attente', amz: 'ⵓⵔ ⵜⴰ', en: 'Pending', es: 'Pendiente' })
                            : req.status === 'approved'
                            ? pickLang(lang, { ar: 'مقبول وتمت المزامنة ✓', fr: 'Approuvé & synchro ✓', amz: 'ⵉⵜⵜⵓⵇⴱⵍ ✓', en: 'Approved & Synced ✓', es: 'Aprobado ✓' })
                            : pickLang(lang, { ar: 'مرفوض', fr: 'Refusé', amz: 'ⵉⵜⵜⵓⵢⴰⴳⵉ', en: 'Rejected', es: 'Rechazado' })}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-300 tabular-nums">
                        <span>📅 {req.targetDate}</span>
                        {req.targetSlots && req.targetSlots.length > 0 && (
                          <span className="text-amber-300">
                            🕒 {req.targetSlots.join(' · ')}
                          </span>
                        )}
                        {req.requestType === 'shift_swap' && swapPartnerName && (
                          <span className="font-sans text-blue-300 font-bold">
                            ⇄ {pickLang(lang, { ar: `مع ${swapPartnerName}`, fr: `avec ${swapPartnerName}`, amz: `ⴷ ${swapPartnerName}`, en: `with ${swapPartnerName}`, es: `con ${swapPartnerName}` })}
                            {req.swapDate ? ` (${req.swapDate})` : ''}
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
                        title={pickLang(lang, { ar: 'حذف / سحب الطلب', fr: 'Supprimer la demande', amz: 'ⴽⴽⵙ ⴰⵙⵓⵜⵔ', en: 'Delete / Withdraw Request', es: 'Eliminar solicitud' })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {req.reason && (
                    <p className="text-[11px] text-zinc-300 bg-black/35 px-2.5 py-1.5 rounded-lg border border-zinc-800/80">
                      {pickLang(lang, { ar: 'السبب:', fr: 'Motif :', amz: 'ⵜⴰⵎⵍⴰⵢⵜ:', en: 'Reason:', es: 'Motivo:' })} {req.reason}
                    </p>
                  )}

                  {conflicts.length > 0 && (
                    <div className="p-2 rounded-lg bg-orange-950/40 border border-orange-500/40 text-orange-200 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      <span>
                        {pickLang(lang, {
                          ar: `تنبيه: يوجد ${conflicts.length} موعد حجز نشط لهذا الحلاق في هذا التاريخ (${conflicts.map((c) => `${c.timeSlot} ${c.clientName}`).slice(0, 2).join('، ')}).`,
                          fr: `Attention : ${conflicts.length} RDV actif(s) à cette date (${conflicts.map((c) => `${c.timeSlot} ${c.clientName}`).slice(0, 2).join(', ')}).`,
                          amz: `ⵜⴰⵖⴹⴼⵜ: ⵍⵍⴰⵏ ${conflicts.length} ⵉⵎⵓⵄⵉⴷⵏ ⴳ ⵓⵙⴰⴽⵓⴷ ⴰⴷ.`,
                          en: `Warning: ${conflicts.length} active booking(s) on this date (${conflicts.map((c) => `${c.timeSlot} ${c.clientName}`).slice(0, 2).join(', ')}).`,
                          es: `Aviso: ${conflicts.length} cita(s) activa(s) en esta fecha (${conflicts.map((c) => `${c.timeSlot} ${c.clientName}`).slice(0, 2).join(', ')}).`,
                        })}
                      </span>
                    </div>
                  )}

                  {req.reviewerNote && (
                    <div className="text-[11px] text-zinc-400">
                      {pickLang(lang, { ar: 'رد الإدارة', fr: 'Réponse direction', amz: 'ⵜⴰⵎⵔⴰⵔⵓⵜ', en: 'Management note', es: 'Respuesta dirección' })} ({req.reviewedBy || 'Master Admin'}):{' '}
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
                        placeholder={pickLang(lang, {
                          ar: 'ملاحظة للموظف (اختياري)...',
                          fr: 'Note au collaborateur (optionnel)...',
                          amz: 'ⵜⴰⵎⵍⴰⵢⵜ (ⵓⵔ ⵉⴱⵣⵣⵉⵣ)...',
                          en: 'Note for staff (optional)...',
                          es: 'Nota para el personal (opcional)...',
                        })}
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
                          <span>
                            {pickLang(lang, { ar: 'موافقة ومزامنة ✓', fr: 'Approuver ✓', amz: 'ⵇⴱⵍ ✓', en: 'Approve & Sync ✓', es: 'Aprobar ✓' })}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeny(req)}
                          className="px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-600 border border-red-500/40 text-red-200 hover:text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{pickLang(lang, { ar: 'رفض', fr: 'Refuser', amz: 'ⴰⴳⵉ', en: 'Deny', es: 'Rechazar' })}</span>
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
