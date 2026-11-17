import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Scissors,
  CheckCircle2,
  MessageCircle,
  Ticket,
  AlertCircle,
  Sparkles,
  Copy,
  ChevronDown,
  Zap,
  Check,
  CheckSquare,
  Square,
  Pencil,
  PhoneCall,
  Mail,
  ShieldCheck,
  ArrowRight,
  Download,
  QrCode,
  Upload,
  FileCheck,
  Trash2,
  Star,
  Ban,
  ListPlus,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { useLanguage } from '../context/LanguageContext';
import { TEAM_MEMBERS, SALON_INFO } from '../data/barbershopData';
import { createNewBooking, subscribeToBookings, getAllBookings, normalizeMoroccanPhoneDigits } from '../utils/bookingStore';
import { PricingEngineResult, AppointmentBooking } from '../types';
import { BASE_SERVICES } from '../utils/pricingEngine';
import { downloadTicketAsPng } from '../utils/ticketCanvas';
import { buildClientTicketWhatsAppMessage } from '../utils/whatsappAutomation';
import { CIH_BANK_DETAILS, processCihReceiptFile } from '../utils/cihReceipt';
import { CihBankLogo } from './CihBankLogo';
import {
  useBarberSchedules,
  evaluateBarberDayAvailability,
  getInitialBookingDate,
} from '../utils/barberScheduleStore';
import { useCrmClients, getCrmDocId } from '../utils/crmStore';
import { addToWaitlist } from '../utils/waitlistStore';
import { getVerifiedVisitsCount } from '../utils/loyaltyEngine';
import { rememberTrackedTicket } from '../utils/clientReminderWatcher';

import { requestWebNotificationPermission, sendWebNotification } from '../utils/notifications';

interface BookingSectionProps {
  pricingResult: PricingEngineResult;
  selectedBarberId: string;
  onSelectBarberId: (barberId: string) => void;
  selectedServiceIds: string[];
  onToggleServiceId: (serviceId: string) => void;
  onBookingConfirmed?: (booking: AppointmentBooking) => void;
  onOpenTrackBooking?: (ticket: string) => void;
}

export const BookingSection: React.FC<BookingSectionProps> = ({
  pricingResult,
  selectedBarberId,
  onSelectBarberId,
  selectedServiceIds,
  onToggleServiceId,
  onBookingConfirmed,
  onOpenTrackBooking,
}) => {
  const { lang, t, isRtl } = useLanguage();

  // Form fields
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [date, setDate] = useState(() => getInitialBookingDate());
  const [timeSlot, setTimeSlot] = useState('16:00');
  const [notes, setNotes] = useState('');
  const [includeWaitingSkip, setIncludeWaitingSkip] = useState<boolean>(true);
  const [cihReceiptName, setCihReceiptName] = useState('');
  const [cihReceiptPreview, setCihReceiptPreview] = useState('');
  const [cihReceiptUploadedAt, setCihReceiptUploadedAt] = useState('');
  const [copiedHolderName, setCopiedHolderName] = useState(false);
  const [copiedAccountNumber, setCopiedAccountNumber] = useState(false);

  // Live Firestore Sync for Bookings, Barber Schedules & CRM Loyalty/Ban checks
  const [liveBookings, setLiveBookings] = useState<AppointmentBooking[]>(() => getAllBookings());
  const barberSchedules = useBarberSchedules();
  const crmClientsMap = useCrmClients();

  // Smart Waitlist form state
  const [showWaitlistBox, setShowWaitlistBox] = useState(false);
  const [waitlistPreferredTime, setWaitlistPreferredTime] = useState('أي توقيت متاح');
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  // Multi-step Wizard State (1: Barber, 2: Services, 3: Date & Time, 4: Info + CIH + Queue Skip + Confirm)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [stepDirection, setStepDirection] = useState<'next' | 'prev'>('next');

  // Ticket modal state
  const [createdBooking, setCreatedBooking] = useState<AppointmentBooking | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    services?: string;
    date?: string;
    timeSlot?: string;
    clientName?: string;
    clientPhone?: string;
    submit?: string;
  }>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bookingCardRef = useRef<HTMLDivElement>(null);
  const ticketCardRef = useRef<HTMLDivElement>(null);
  const servicesSectionRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeSlotSectionRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeToBookings((items) => setLiveBookings(items));
    return () => unsub();
  }, []);

  const selectedBarber = TEAM_MEMBERS.find((b) => b.id === selectedBarberId) || TEAM_MEMBERS[0];
  const barberNameLocalized = selectedBarber.name[lang] || selectedBarber.name.fr;

  // Strict Availability Evaluation (Mon OFF, 11-13 / 16-22, Fri 15-22, 1-hour slots + Barber breaks + Booked slots)
  const dayAvailability = evaluateBarberDayAvailability(
    selectedBarber.id,
    date,
    barberSchedules,
    liveBookings
  );

  // Auto-select first open slot if currently picked slot is no longer available
  useEffect(() => {
    if (dayAvailability.availableSlots.length > 0) {
      if (!dayAvailability.availableSlots.includes(timeSlot)) {
        setTimeSlot(dayAvailability.availableSlots[0]);
      }
    }
  }, [date, selectedBarber.id, dayAvailability.availableSlots.join(','), timeSlot]);

  // Clear service error automatically when at least one service is picked
  useEffect(() => {
    if (selectedServiceIds.length > 0 && fieldErrors.services) {
      setFieldErrors((prev) => ({ ...prev, services: undefined }));
    }
  }, [selectedServiceIds.length]);

  // Real-time CRM recognition for entered client phone (strictly verified attended visits only)
  const cleanDigits = normalizeMoroccanPhoneDigits(clientPhone);
  const crmProfile = cleanDigits.length >= 6 ? crmClientsMap[getCrmDocId(clientPhone)] : undefined;
  const clientBookingsForPhone =
    cleanDigits.length >= 6
      ? liveBookings.filter((b) => normalizeMoroccanPhoneDigits(b.clientPhone) === cleanDigits)
      : [];
  const pastVisitsCount =
    cleanDigits.length >= 6 ? getVerifiedVisitsCount(clientBookingsForPhone, crmProfile) : 0;
  const isClientBanned = Boolean(crmProfile?.isBanned);
  const nextVisitNumber = pastVisitsCount + 1;
  const isFreeWashEligible =
    cleanDigits.length >= 6 &&
    pastVisitsCount > 0 &&
    Math.floor(pastVisitsCount / 5) > (crmProfile?.freeWashesRedeemed ?? 0);

  // Generate QR Code whenever createdBooking changes
  useEffect(() => {
    if (createdBooking) {
      // Embed tracking URL or Ticket ID
      const qrPayload = `${window.location.origin}/#track=${encodeURIComponent(createdBooking.ticketNumber)}`;
      QRCode.toDataURL(qrPayload, {
        width: 180,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('QR code generation error:', err));
    } else {
      setQrCodeDataUrl('');
    }
  }, [createdBooking]);

  // Calculate total with priority queue (+10 MAD if checked) and CRM custom discount
  const waitingSkipFee = includeWaitingSkip ? 10 : 0;
  const crmCustomDiscount = crmProfile?.customDiscountMAD ? Math.min(pricingResult.finalTotal, crmProfile.customDiscountMAD) : 0;
  const grandTotal = Math.max(0, pricingResult.finalTotal + waitingSkipFee - crmCustomDiscount);

  const scrollToWizardTop = () => {
    setTimeout(() => {
      bookingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  };

  const validateStep2 = () => {
    if (selectedServiceIds.length === 0) {
      const msg =
        lang === 'ar'
          ? 'يرجى اختيار خدمة واحدة على الأقل للمتابعة'
          : lang === 'amz'
          ? 'ⴼⵔⵏ ⵎⵇⵇⴰⵔ ⴷ ⵢⴰⵜ ⵜⵡⵓⵔⵉ'
          : lang === 'en'
          ? 'Please select at least one service to continue.'
          : lang === 'es'
          ? 'Por favor selecciona al menos un servicio.'
          : 'Veuillez sélectionner au moins une prestation pour continuer.';
      setFieldErrors((prev) => ({ ...prev, services: msg }));
      servicesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    setFieldErrors((prev) => ({ ...prev, services: undefined }));
    return true;
  };

  const validateStep3 = () => {
    const errors: { date?: string; timeSlot?: string } = {};

    if (dayAvailability.isSalonClosedDay) {
      errors.date =
        lang === 'ar'
          ? 'الصالون مغلق يوم الإثنين (العطلة الأسبوعية). يرجى اختيار يوم آخر.'
          : lang === 'en'
          ? 'The salon is closed on Monday. Please choose another date.'
          : lang === 'es'
          ? 'El salón cierra los lunes. Por favor elige otro día.'
          : 'Le salon est fermé le lundi (jour de repos). Veuillez choisir un autre jour.';
    } else if (dayAvailability.isBarberOffDay || dayAvailability.availableSlots.length === 0) {
      errors.timeSlot =
        lang === 'ar'
          ? 'جميع المواعيد ممتلئة أو الحلاق في عطلة لهذا اليوم. يمكنك التسجيل في قائمة الانتظار أو اختيار توقيت/يوم آخر.'
          : lang === 'en'
          ? 'No available slots for this barber on this date. Join the waitlist or choose another day.'
          : 'Aucun créneau disponible pour ce barbier à cette date. Rejoignez la liste d’attente ou choisissez un autre jour.';
    } else if (!dayAvailability.availableSlots.includes(timeSlot)) {
      errors.timeSlot =
        lang === 'ar'
          ? 'الساعة المختارة غير متاحة أو محجوزة بالفعل. يرجى اختيار ساعة أخرى من القائمة.'
          : lang === 'en'
          ? 'Selected time slot is unavailable. Please pick an open slot.'
          : 'Ce créneau horaire n’est plus disponible. Veuillez sélectionner une heure libre.';
    }

    if (errors.date || errors.timeSlot) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      if (errors.date) {
        dateInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dateInputRef.current?.focus();
      } else if (errors.timeSlot) {
        timeSlotSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    setFieldErrors((prev) => ({ ...prev, date: undefined, timeSlot: undefined }));
    return true;
  };

  const handleGoToStep = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep === currentStep) return;
    if (targetStep < currentStep) {
      setStepDirection('prev');
      setCurrentStep(targetStep);
      scrollToWizardTop();
      return;
    }
    if (targetStep >= 3 && !validateStep2()) {
      setStepDirection('next');
      setCurrentStep(2);
      return;
    }
    if (targetStep >= 4 && !validateStep3()) {
      setStepDirection('next');
      setCurrentStep(3);
      return;
    }
    setStepDirection('next');
    setCurrentStep(targetStep);
    scrollToWizardTop();
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      setStepDirection('next');
      setCurrentStep(2);
      scrollToWizardTop();
    } else if (currentStep === 2) {
      if (validateStep2()) {
        setStepDirection('next');
        setCurrentStep(3);
        scrollToWizardTop();
      }
    } else if (currentStep === 3) {
      if (validateStep3()) {
        setStepDirection('next');
        setCurrentStep(4);
        scrollToWizardTop();
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setStepDirection('prev');
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
      scrollToWizardTop();
    }
  };

  // Upcoming 6 open days (skipping Mondays) for 1-tap date quick-pick
  const quickPickDates = React.useMemo(() => {
    const days: { dateStr: string; dayShort: string; dayNum: string }[] = [];
    const cursor = new Date();
    const locale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'fr-FR';
    let guard = 0;
    while (days.length < 6 && guard < 18) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      if (cursor.getDay() !== 1) {
        const isToday = guard === 0;
        const dayShort = isToday
          ? (lang === 'ar' ? 'اليوم' : lang === 'en' ? 'Today' : 'Aujourd’hui')
          : cursor.toLocaleDateString(locale, { weekday: 'short' });
        days.push({
          dateStr,
          dayShort,
          dayNum: `${d}/${m}`,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    return days;
  }, [lang]);

  const totalSelectedMinutes = pricingResult.items.reduce((sum, item) => {
    const baseSrv = BASE_SERVICES.find((s) => s.id === item.serviceId);
    return sum + (baseSrv?.durationMinutes || 20);
  }, 0);

  const validateForm = () => {
    const errors: {
      services?: string;
      date?: string;
      timeSlot?: string;
      clientName?: string;
      clientPhone?: string;
    } = {};

    if (selectedServiceIds.length === 0) {
      errors.services =
        lang === 'ar'
          ? 'يرجى اختيار خدمة واحدة على الأقل'
          : lang === 'amz'
          ? 'ⴼⵔⵏ ⵎⵇⵇⴰⵔ ⴷ ⵢⴰⵜ ⵜⵡⵓⵔⵉ'
          : lang === 'en'
          ? 'Please select at least one service.'
          : lang === 'es'
          ? 'Por favor selecciona al menos un servicio.'
          : 'Veuillez sélectionner au moins une prestation.';
    }

    if (dayAvailability.isSalonClosedDay) {
      errors.date =
        lang === 'ar'
          ? 'الصالون مغلق يوم الإثنين (العطلة الأسبوعية). يرجى اختيار يوم آخر.'
          : lang === 'en'
          ? 'The salon is closed on Monday. Please choose another date.'
          : lang === 'es'
          ? 'El salón cierra los lunes. Por favor elige otro día.'
          : 'Le salon est fermé le lundi (jour de repos). Veuillez choisir un autre jour.';
    } else if (dayAvailability.isBarberOffDay || dayAvailability.availableSlots.length === 0) {
      errors.timeSlot =
        lang === 'ar'
          ? 'جميع المواعيد ممتلئة أو الحلاق في عطلة لهذا اليوم. يمكنك التسجيل في قائمة الانتظار أو اختيار توقيت/يوم آخر.'
          : lang === 'en'
          ? 'No available slots for this barber on this date. Join the waitlist or choose another day.'
          : 'Aucun créneau disponible pour ce barbier à cette date. Rejoignez la liste d’attente ou choisissez un autre jour.';
    } else if (!dayAvailability.availableSlots.includes(timeSlot)) {
      errors.timeSlot =
        lang === 'ar'
          ? 'الساعة المختارة غير متاحة أو محجوزة بالفعل. يرجى اختيار ساعة أخرى من القائمة.'
          : lang === 'en'
          ? 'Selected time slot is unavailable. Please pick an open slot.'
          : 'Ce créneau horaire n’est plus disponible. Veuillez sélectionner une heure libre.';
    }

    if (!clientName.trim()) {
      errors.clientName =
        lang === 'ar'
          ? 'يرجى إدخال اسمك الكريم'
          : lang === 'amz'
          ? 'ⵙⵙⴽⵛⵎ ⵉⵙⵎ ⵏⵏⴽ ⵉⵖⵓⴷⴰⵏ'
          : lang === 'en'
          ? 'Please enter your full name.'
          : lang === 'es'
          ? 'Por favor ingresa tu nombre completo.'
          : 'Veuillez saisir votre nom complet.';
    }

    const digits = clientPhone.replace(/\D/g, '');
    if (isClientBanned) {
      errors.clientPhone =
        lang === 'ar'
          ? 'عذراً، هذا الرقم محظور حالياً من الحجز عبر الإنترنت. يرجى الاتصال بالإدارة (0635392503).'
          : lang === 'en'
          ? 'This phone number is temporarily restricted. Please contact 0635392503.'
          : 'Ce numéro est temporairement restreint. Veuillez contacter le salon au 0635392503.';
    } else if (digits.length < 9) {
      errors.clientPhone =
        lang === 'ar'
          ? 'يرجى إدخال رقم هاتف مغربي صحيح (مثال: 06...)'
          : lang === 'amz'
          ? 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⵉⵖⵓⴷⴰⵏ'
          : lang === 'en'
          ? 'Valid Moroccan phone number required (e.g. 06...)'
          : lang === 'es'
          ? 'Se requiere un número de teléfono válido (ej: 06...)'
          : 'Numéro de téléphone marocain valide requis (ex: 06...)';
    }

    setFieldErrors(errors);

    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      if (errors.services) {
        setCurrentStep(2);
        setTimeout(() => servicesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      } else if (errors.date) {
        setCurrentStep(3);
        setTimeout(() => {
          dateInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          dateInputRef.current?.focus();
        }, 50);
      } else if (errors.timeSlot) {
        setCurrentStep(3);
        setTimeout(() => timeSlotSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      } else if (errors.clientName) {
        setCurrentStep(4);
        setTimeout(() => {
          nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          nameInputRef.current?.focus();
        }, 50);
      } else if (errors.clientPhone) {
        setCurrentStep(4);
        setTimeout(() => {
          phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          phoneInputRef.current?.focus();
        }, 50);
      }
      return false;
    }

    return true;
  };

  // Single Primary Submit Action: Confirm Booking & Get Ticket (Routes directly to Cloud Firestore)
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const loyaltyTag = isFreeWashEligible
        ? `🎁 غسل شعر مجاني (الزيارة رقم ${nextVisitNumber})`
        : crmCustomDiscount > 0
        ? `🎁 تخفيض ولاء (-${crmCustomDiscount} MAD)`
        : crmProfile?.isVip
        ? '⭐ عميل VIP'
        : undefined;

      const trimmedClientNotes = notes.trim().slice(0, 400);
      const newBooking = await createNewBooking({
        services: [],
        cartItemsSummary: pricingResult.items,
        barberId: selectedBarber.id,
        barberName: barberNameLocalized,
        barberColor: selectedBarber.themeColor || '#D97706',
        date,
        timeSlot,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientLanguage: lang,
        clientNotes: trimmedClientNotes || undefined,
        notes: [
          trimmedClientNotes,
          includeWaitingSkip ? (lang === 'ar' ? 'خدمة تفادي الانتظار (+10 دراهم)' : 'Service Coupe-File (+10 MAD)') : '',
          loyaltyTag || '',
        ].filter(Boolean).join(' | '),
        originalTotalMAD: pricingResult.originalSubtotal + waitingSkipFee,
        finalTotalMAD: grandTotal,
        totalSavingsMAD: pricingResult.totalSavings + crmCustomDiscount,
        bookingMethod: 'site',
        status: 'pending',
        cihReceiptName: cihReceiptName || undefined,
        cihReceiptPreview: cihReceiptPreview || undefined,
        cihReceiptUploadedAt: cihReceiptUploadedAt || undefined,
        loyaltyRewardApplied: loyaltyTag,
      });

      try {
        confetti({
          particleCount: 80,
          spread: 90,
          origin: { y: 0.6 },
          colors: ['#eab308', '#dc2626', '#ffffff', '#2563eb'],
        });
      } catch {
        // ignore
      }

      rememberTrackedTicket(newBooking.ticketNumber, newBooking.clientPhone);
      setCreatedBooking(newBooking);
      setNotes('');
      setCihReceiptName('');
      setCihReceiptPreview('');
      setCihReceiptUploadedAt('');
      if (onBookingConfirmed) onBookingConfirmed(newBooking);

      // Request Web Notification permission for clients immediately AFTER digital ticket is generated
      requestWebNotificationPermission().then((permission) => {
        if (permission === 'granted') {
          sendWebNotification(
            lang === 'ar' ? 'تم تسجيل تذكرتك بنجاح • صالون بومليك' : 'Réservation Confirmée • Salon Boumlik',
            {
              body: lang === 'ar'
                ? `تذكرتك: ${newBooking.ticketNumber} مع ${newBooking.barberName} بتاريخ ${newBooking.date} الساعة ${newBooking.timeSlot}`
                : `Billet ${newBooking.ticketNumber} avec ${newBooking.barberName} le ${newBooking.date} à ${newBooking.timeSlot}`,
            }
          );
        }
      });
    } catch (err) {
      console.error('Failed to save booking to Firestore:', err);
      setFieldErrors((prev) => ({
        ...prev,
        submit:
          lang === 'ar'
            ? 'تعذر تسجيل الحجز في السحابة حالياً. يرجى المحاولة مرة أخرى.'
            : 'Impossible d’enregistrer la réservation sur le serveur. Veuillez réessayer.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Smart Waitlist Submit Handler
  const handleJoinWaitlist = async () => {
    const errors: { clientName?: string; clientPhone?: string; submit?: string } = {};
    const digits = clientPhone.replace(/\D/g, '');

    if (isClientBanned) {
      errors.clientPhone =
        lang === 'ar' ? 'هذا الرقم محظور ولا يمكنه الانضمام لقائمة الانتظار.' : 'Numéro restreint.';
    } else if (digits.length < 9) {
      errors.clientPhone =
        lang === 'ar'
          ? 'يرجى إدخال رقم هاتف صحيح للانضمام لقائمة الانتظار.'
          : 'Veuillez saisir votre numéro de téléphone valide.';
    }

    if (!clientName.trim()) {
      errors.clientName =
        lang === 'ar'
          ? 'يرجى إدخال اسمك الكريم للانضمام لقائمة الانتظار.'
          : 'Veuillez saisir votre nom complet.';
    }

    if (errors.clientName || errors.clientPhone) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      if (errors.clientName) {
        nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nameInputRef.current?.focus();
      } else if (errors.clientPhone) {
        phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        phoneInputRef.current?.focus();
      }
      return;
    }

    setFieldErrors((prev) => ({ ...prev, clientName: undefined, clientPhone: undefined, submit: undefined }));
    setWaitlistSubmitting(true);
    try {
      await addToWaitlist({
        barberId: selectedBarber.id,
        barberName: barberNameLocalized,
        date,
        preferredTime: waitlistPreferredTime || timeSlot || 'أي وقت',
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        servicesSummary: pricingResult.items.map((i) => i.name).join(', ') || 'حلاقة',
      });
      setWaitlistSuccess(true);
      setTimeout(() => setWaitlistSuccess(false), 6000);
    } catch (err) {
      console.error('Waitlist join error:', err);
      setFieldErrors((prev) => ({
        ...prev,
        submit: lang === 'ar' ? 'تعذر التسجيل في قائمة الانتظار حالياً.' : 'Erreur lors de l’inscription en liste d’attente.',
      }));
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  const handleCopyTicket = (ticket: string) => {
    navigator.clipboard.writeText(ticket);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
  };

  const handleCopyHolderName = () => {
    navigator.clipboard.writeText(CIH_BANK_DETAILS.accountHolder);
    setCopiedHolderName(true);
    setTimeout(() => setCopiedHolderName(false), 2000);
  };

  const handleCopyAccountNumber = () => {
    navigator.clipboard.writeText(CIH_BANK_DETAILS.accountNumber);
    setCopiedAccountNumber(true);
    setTimeout(() => setCopiedAccountNumber(false), 2000);
  };

  // Compress image CIH receipts cleanly so they sync safely inside Firestore
  const handleCihReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const processed = await processCihReceiptFile(file);
    setCihReceiptName(processed.cihReceiptName);
    setCihReceiptPreview(processed.cihReceiptPreview);
    setCihReceiptUploadedAt(processed.cihReceiptUploadedAt);
  };

  // Foolproof Programmatic PNG Ticket Download via HTML5 <canvas>
  const handleDownloadTicketPng = async () => {
    if (!createdBooking || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadTicketAsPng(createdBooking, qrCodeDataUrl, lang);
    } catch (err) {
      console.error('Programmatic PNG ticket download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Localized UI Texts
  const ui = {
    title: {
      ar: 'طلب موعد وتسعيرة',
      fr: 'Demande de Rendez-vous & Devis',
      en: 'Appointment Request & Pricing',
      amz: 'ⴰⵙⵓⵜⵔ ⵏ ⵓⵙⵔⵓⵙ ⴷ ⵡⴰⵜⵉⴳ',
      es: 'Solicitud de Cita y Presupuesto',
    }[lang] || 'طلب موعد وتسعيرة',
    subtitle: {
      ar: 'اختر الحلاق أولاً، ثم حدد الخدمات وتاريخ الموعد لتسجيل حجزك واستخراج تذكرتك الإلكترونية فوراً.',
      fr: 'Choisissez d’abord votre barbier, puis vos prestations et votre créneau horaire.',
      en: 'Choose your barber first, then select services and appointment details.',
      amz: 'ⴼⵔⵏ ⴰⵎⴽⵔⴰⴹ ⴷⴰⵜ, ⵉⵍⵎⵎⴰ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⴽ.',
      es: 'Elige tu barbero primero, luego tus servicios y detalles.',
    }[lang] || 'اختر الحلاق والخدمات',
    waitingTitle: {
      ar: 'خدمة تفادي الانتظار (+10 درهم)',
      fr: 'Service Coupe-File (+10 MAD)',
      en: 'Queue Avoidance (+10 MAD)',
      amz: 'ⵜⴰⵏⴰⴼⵓⵜ ⵏ ⵓⵙⵙⵉⴷⵔ ⵏ ⵓⵇⵇⵍ (+10 ⴷⵔⵀⵎ)',
      es: 'Servicio Sin Espera (+10 MAD)',
    }[lang] || 'خدمة تفادي الانتظار (+10 درهم)',
    step1: {
      ar: '1. اختر الحلاق المفضل *',
      fr: '1. Choisissez votre barbier favori *',
      en: '1. Choose your preferred barber *',
      amz: '1. ⴼⵔⵏ ⴰⵎⴽⵔⴰⴹ ⵏⵏⴽ ⵉⵥⵍⵉⵏ *',
      es: '1. Elige tu barbero preferido *',
    }[lang] || '1. اختر الحلاق المفضل *',
    step2: {
      ar: `2. اختر الخدمات التي ترغب بها (${selectedServiceIds.length})`,
      fr: `2. Choisissez vos prestations (${selectedServiceIds.length})`,
      en: `2. Select Your Services (${selectedServiceIds.length})`,
      amz: `2. ⴼⵔⵏ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⴽ (${selectedServiceIds.length})`,
      es: `2. Elige los servicios (${selectedServiceIds.length})`,
    }[lang] || '2. اختر الخدمات',
    step3: {
      ar: '3. تاريخ الموعد والتوقيت والمعلومات',
      fr: '3. Date, horaire & coordonnées',
      en: '3. Date, time slot & details',
      amz: '3. ⴰⵙⴰⴽⵓⴷ ⴷ ⵓⴽⵓⴷ ⴷ ⵉⵏⵖⵎⵉⵙⵏ',
      es: '3. Fecha, hora y contacto',
    }[lang] || '3. تاريخ الموعد',
    btnSubmit: {
      ar: 'تأكيد الحجز واستخراج التذكرة',
      fr: 'Confirmer la Réservation & Obtenir mon Ticket',
      en: 'Confirm Booking & Get Ticket',
      amz: 'ⵙⵙⴷⵓ ⴰⵙⵔⵓⵙ ⴷ ⵜⵉⴽⵉ',
      es: 'Confirmar Reserva y Obtener Ticket',
    }[lang] || 'تأكيد الحجز واستخراج التذكرة',
    roleOwner: {
      ar: 'المالك وخبير الحلاقة',
      fr: 'Propriétaire & Maître Barbier',
      en: 'Owner & Master Barber',
      amz: 'ⴰⵎⵙⴱⴷⴰⴷ',
      es: 'Propietario y Maestro Barbero',
    }[lang] || 'المالك',
  };

  // Find barber contact for modal buttons
  const createdBarber = createdBooking 
    ? (TEAM_MEMBERS.find((b) => b.id === createdBooking.barberId) || TEAM_MEMBERS[0])
    : selectedBarber;

  const chosenBarberPhone = createdBarber.phone || '0635392503';
  const chosenBarberWa = createdBarber.whatsappNumber || '212635392503';
  const activeBarberColor = createdBarber.themeColor || '#D97706';

  const wizardSteps = [
    {
      step: 1 as const,
      label: lang === 'ar' ? 'الحلاق' : lang === 'en' ? 'Barber' : lang === 'es' ? 'Barbero' : 'Barbier',
    },
    {
      step: 2 as const,
      label: lang === 'ar' ? 'الخدمات' : lang === 'en' ? 'Services' : lang === 'es' ? 'Servicios' : 'Prestations',
    },
    {
      step: 3 as const,
      label: lang === 'ar' ? 'الموعد' : lang === 'en' ? 'Date & Time' : lang === 'es' ? 'Fecha y Hora' : 'Date & Heure',
    },
    {
      step: 4 as const,
      label: lang === 'ar' ? 'التأكيد' : lang === 'en' ? 'Confirm' : lang === 'es' ? 'Confirmar' : 'Confirmation',
    },
  ];

  const createdTicketHasQueueSkip = Boolean(
    createdBooking &&
      (/تفادي الانتظار|Coupe-File|Queue Avoidance/i.test(createdBooking.notes || '') ||
        (() => {
          if (!createdBooking) return false;
          const baseSum = (createdBooking.cartItemsSummary || []).reduce((acc, item) => acc + (item.finalPrice || 0), 0);
          return baseSum > 0 && (createdBooking.originalTotalMAD ?? 0) - baseSum >= 10;
        })())
  );

  return (
    <section id="booking" className="py-8 sm:py-14 bg-white dark:bg-[#090A0E] text-zinc-900 dark:text-white relative border-b border-zinc-200 dark:border-zinc-800">
      
      {/* Ambient background glows */}
      <div className="absolute top-1/4 right-1/4 w-[350px] sm:w-[450px] h-[300px] bg-red-600/5 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[350px] sm:w-[450px] h-[300px] bg-blue-600/5 blur-[140px] rounded-full pointer-events-none" />

      {/* Mobile-First Container */}
      <div ref={bookingCardRef} className="max-w-md sm:max-w-2xl mx-auto px-4 relative z-10">
        
        {/* Main Wizard Card Shell */}
        <div className="rounded-3xl bg-white dark:bg-[#0D0F14] border border-zinc-200 dark:border-amber-500/30 p-5 sm:p-7 shadow-xl space-y-5">
          
          {/* Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold">
              <Ticket className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{lang === 'ar' ? 'حجز فوري ومباشر • صالون بومليك' : 'Réservation Directe Sans Inscription'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight font-display">
              {ui.title}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
              {ui.subtitle}
            </p>
          </div>

          {/* 4-Step Modern Planity/Fresha Stepper Bar */}
          <div className="space-y-3 pt-1">
            <div className="relative flex items-center justify-between">
              {/* Background progress track (flex start-aligned so RTL right-to-left fills seamlessly) */}
              <div className="absolute top-4 inset-x-7 h-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex justify-start">
                <div
                  className="h-full bg-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                />
              </div>

              {wizardSteps.map((item) => {
                const isActive = currentStep === item.step;
                const isDone = currentStep > item.step;
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => handleGoToStep(item.step)}
                    className="relative z-10 flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none min-w-[60px] min-h-[44px]"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black font-mono transition-all duration-200 border-2 ${
                        isActive
                          ? 'bg-amber-500 border-amber-400 text-black scale-110 shadow-md shadow-amber-500/30'
                          : isDone
                          ? 'bg-emerald-500 border-emerald-400 text-white'
                          : 'bg-zinc-100 dark:bg-[#12141B] border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 group-hover:border-amber-500/50'
                      }`}
                    >
                      {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : item.step}
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap ${
                        isActive
                          ? 'text-amber-600 dark:text-amber-400'
                          : isDone
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Compact Live Selection Summary Strip */}
            <div className="px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800/90 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedBarber.themeColor || '#D97706' }}
                  />
                  <span className="truncate">{barberNameLocalized}</span>
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                  {selectedServiceIds.length > 0
                    ? `${selectedServiceIds.length} ${lang === 'ar' ? 'خدمة' : 'srv.'} (~${totalSelectedMinutes} min)`
                    : lang === 'ar'
                    ? 'لم تُحدد الخدمات بعد'
                    : 'Aucune prestation'}
                </span>
                {currentStep >= 3 && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold" dir="ltr">
                      {date.slice(5)} {timeSlot}
                    </span>
                  </>
                )}
              </div>

              <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400 tabular-nums">
                {grandTotal} MAD
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* STEP 1: CHOOSE BARBER                                     */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div key="step-1" className={`space-y-4 pt-1 ${stepDirection === 'next' ? 'wizard-step-next' : 'wizard-step-prev'}`}>
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-500" />
                  <span>{ui.step1}</span>
                </label>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white font-mono"
                  style={{ backgroundColor: selectedBarber.themeColor || '#D97706' }}
                >
                  {selectedBarber.colorName || 'Active'}
                </span>
              </div>

              {/* 2x2 Grid of Barbers */}
              <div className="grid grid-cols-2 gap-3">
                {TEAM_MEMBERS.map((barber) => {
                  const isSelected = selectedBarberId === barber.id;
                  const bName = barber.name[lang] || barber.name.ar;
                  const bSpecialty =
                    barber.specialty?.[lang] ||
                    barber.specialty?.ar ||
                    (barber.isOwner ? ui.roleOwner : lang === 'ar' ? 'حلاق محترف' : 'Barbier');
                  const bColor = barber.themeColor || '#D97706';

                  return (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => onSelectBarberId(barber.id)}
                      className={`p-3.5 rounded-2xl border text-left rtl:text-right flex flex-col gap-2.5 transition-all cursor-pointer group relative overflow-hidden min-h-[112px] ${
                        isSelected
                          ? 'bg-amber-50/60 dark:bg-zinc-900 border-2 shadow-md'
                          : 'bg-zinc-50/60 dark:bg-[#12141B] border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                      style={{
                        borderColor: isSelected ? bColor : undefined,
                      }}
                    >
                      <div
                        className="absolute top-0 inset-x-0 h-1"
                        style={{ backgroundColor: bColor }}
                      />

                      <div className="flex items-center justify-between gap-2">
                        <img
                          src={barber.avatar}
                          alt={bName}
                          className="w-12 h-12 rounded-full object-cover object-center bg-zinc-200 dark:bg-zinc-800 flex-shrink-0 shadow-xs"
                          style={{
                            outline: isSelected ? `2px solid ${bColor}` : '2px solid transparent',
                            outlineOffset: '2px',
                          }}
                        />
                        {isSelected && (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white shadow-xs flex-shrink-0"
                            style={{ backgroundColor: bColor }}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="font-black text-zinc-900 dark:text-white text-sm block truncate">
                          {bName}
                        </span>
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                          {bSpecialty}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Step 1 Next CTA */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span>
                    {lang === 'ar'
                      ? 'التالي: اختيار الخدمات'
                      : lang === 'en'
                      ? 'Next: Select Services'
                      : lang === 'es'
                      ? 'Siguiente: Elegir Servicios'
                      : 'Suivant : Choisir les Prestations'}
                  </span>
                  {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: SELECT SERVICES                                   */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div
              key="step-2"
              ref={servicesSectionRef}
              className={`space-y-4 pt-1 ${stepDirection === 'next' ? 'wizard-step-next' : 'wizard-step-prev'}`}
            >
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100">
                <span className="flex items-center gap-1.5">
                  <Scissors className={`w-4 h-4 ${fieldErrors.services ? 'text-red-500' : 'text-amber-500'}`} />
                  <span className={fieldErrors.services ? 'text-red-600 dark:text-red-400' : ''}>{ui.step2}</span>
                </span>
                {pricingResult.totalSavings > 0 && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    {lang === 'ar' ? `وفرت ${pricingResult.totalSavings} دراهم` : `-${pricingResult.totalSavings} MAD`}
                  </span>
                )}
              </div>

              <div className={`space-y-2 rounded-2xl transition-all ${fieldErrors.services ? 'p-2 ring-2 ring-red-500/70 bg-red-500/5 border border-red-500/60' : ''}`}>
                {BASE_SERVICES.map((srv) => {
                  const isSelected = selectedServiceIds.includes(srv.id);
                  const srvName = srv.name[lang] || srv.name.ar;

                  return (
                    <div
                      key={srv.id}
                      onClick={() => onToggleServiceId(srv.id)}
                      className={`px-3.5 py-3 min-h-[50px] rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all select-none ${
                        isSelected
                          ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-500 shadow-xs'
                          : 'bg-zinc-50/70 dark:bg-[#12141B] border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {srvName}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                          ~{srv.durationMinutes} min
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                          {srv.basePrice} MAD
                        </span>
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-amber-500 text-black shadow-xs'
                              : 'border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {fieldErrors.services && (
                <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 px-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{fieldErrors.services}</span>
                </p>
              )}

              {/* Step 2 Navigation: Prev / Next */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="col-span-1 min-h-[48px] py-3 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  <span>{lang === 'ar' ? 'السابق' : lang === 'en' ? 'Back' : 'Retour'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="col-span-2 min-h-[48px] py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span>
                    {lang === 'ar'
                      ? 'التالي: التاريخ والوقت'
                      : lang === 'en'
                      ? 'Next: Date & Time'
                      : lang === 'es'
                      ? 'Siguiente: Fecha y Hora'
                      : 'Suivant : Date & Heure'}
                  </span>
                  {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: DATE & TIME SLOT SELECTION                        */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div key="step-3" className={`space-y-4 pt-1 ${stepDirection === 'next' ? 'wizard-step-next' : 'wizard-step-prev'}`}>
              <label className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span>
                  {lang === 'ar'
                    ? '3. اختر تاريخ الموعد والساعة المتاحة'
                    : lang === 'en'
                    ? '3. Select Appointment Date & Time'
                    : '3. Choisissez la Date & l’Horaire'}
                </span>
              </label>

              {/* 1-Tap Quick-Pick Upcoming Open Days */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {quickPickDates.map((d) => {
                  const isPicked = date === d.dateStr;
                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => {
                        setDate(d.dateStr);
                        setFieldErrors((prev) => ({ ...prev, date: undefined, timeSlot: undefined }));
                      }}
                      className={`py-2 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                        isPicked
                          ? 'bg-amber-500 border-amber-400 text-black shadow-sm'
                          : 'bg-zinc-50 dark:bg-[#12141B] border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-amber-500/60'
                      }`}
                    >
                      <span className="block text-[10px] font-bold truncate">{d.dayShort}</span>
                      <span dir="ltr" className="block text-xs font-mono font-black mt-0.5">
                        {d.dayNum}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Exact Date Calendar Input */}
              <div>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                  {lang === 'ar'
                    ? 'أو اختر تاريخاً محدداً (الإثنين مغلق • الجمعة 15-22 • باقي الأيام 11-13 و 16-22)'
                    : 'Ou choisissez une date (Fermé Lundi • Ven 15-22 • Autres jours 11-13 & 16-22)'}
                </label>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (fieldErrors.date || fieldErrors.timeSlot) {
                      setFieldErrors((prev) => ({ ...prev, date: undefined, timeSlot: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.date)}
                  required
                  className={`w-full min-h-[44px] bg-zinc-50 dark:bg-[#12141B] border rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none transition-colors ${
                    fieldErrors.date
                      ? 'border-red-500 dark:border-red-500 ring-2 ring-red-500/20 focus:border-red-500'
                      : 'border-zinc-200 dark:border-zinc-800 focus:border-amber-500'
                  }`}
                />
                {fieldErrors.date && (
                  <p role="alert" className="mt-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.date}</span>
                  </p>
                )}
              </div>

              {/* Strict 1-Hour Slot Grid with Real-Time Booked & Break Blocking */}
              <div ref={timeSlotSectionRef} className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500 dark:text-zinc-400 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>{lang === 'ar' ? 'اختر التوقيت (حصص ساعة كاملة):' : 'Créneau horaire (1 heure) :'}</span>
                  </span>
                  {!dayAvailability.isSalonClosedDay && !dayAvailability.isBarberOffDay && (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {dayAvailability.availableSlots.length} {lang === 'ar' ? 'متاح' : 'libre(s)'}
                    </span>
                  )}
                </div>

                {dayAvailability.isSalonClosedDay ? (
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                    <span>
                      {lang === 'ar'
                        ? 'الصالون مغلق كل يوم إثنين (العطلة الأسبوعية). يرجى اختيار يوم آخر من الثلاثاء إلى الأحد.'
                        : 'Le salon est fermé le Lundi (jour de repos hebdomadaire). Veuillez choisir une autre date.'}
                    </span>
                  </div>
                ) : dayAvailability.isBarberOffDay ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs space-y-2">
                    <div className="font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                      <span>
                        {lang === 'ar'
                          ? `${barberNameLocalized} في عطلة أو راحة في هذا التاريخ. يمكنك اختيار حلاق آخر أو الانضمام لقائمة الانتظار.`
                          : `${barberNameLocalized} est indisponible à cette date. Choisissez un autre barbier ou rejoignez la liste d’attente.`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`grid grid-cols-3 sm:grid-cols-4 gap-2 rounded-2xl transition-all ${fieldErrors.timeSlot ? 'p-1.5 ring-2 ring-red-500/60 bg-red-500/5' : ''}`}>
                    {dayAvailability.slots.map((slot) => {
                      const isChosen = slot.available && timeSlot === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => {
                            setTimeSlot(slot.time);
                            if (fieldErrors.timeSlot) {
                              setFieldErrors((prev) => ({ ...prev, timeSlot: undefined }));
                            }
                          }}
                          className={`min-h-[44px] py-2 px-2 rounded-xl border text-xs font-mono font-bold transition-all flex flex-col items-center justify-center ${
                            !slot.available
                              ? 'bg-zinc-100 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/60 text-zinc-400 dark:text-zinc-600 line-through cursor-not-allowed opacity-70'
                              : isChosen
                              ? 'bg-amber-500 border-amber-400 text-black shadow-md shadow-amber-500/20 cursor-pointer'
                              : 'bg-zinc-50 dark:bg-[#12141B] border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-amber-500/60 cursor-pointer'
                          }`}
                        >
                          <span dir="ltr">{slot.time}</span>
                          {!slot.available && (
                            <span className="text-[9px] font-sans font-normal no-underline">
                              {slot.reason === 'booked'
                                ? (lang === 'ar' ? 'محجوز' : 'Réservé')
                                : (lang === 'ar' ? 'استراحة' : 'Pause')}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {fieldErrors.timeSlot && (
                  <p role="alert" className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.timeSlot}</span>
                  </p>
                )}

                {/* Smart Waitlist Trigger */}
                {(dayAvailability.isFullyBooked ||
                  dayAvailability.slots.some((s) => !s.available) ||
                  dayAvailability.isBarberOffDay) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowWaitlistBox((prev) => !prev)}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ListPlus className="w-4 h-4 text-blue-500" />
                      <span>
                        {dayAvailability.isFullyBooked
                          ? (lang === 'ar'
                              ? 'جميع المواعيد ممتلئة! اضغط للانضمام إلى قائمة الانتظار الذكية'
                              : 'Complet ! Rejoindre la Liste d’Attente Intelligente')
                          : (lang === 'ar'
                              ? 'توقيتك المفضل محجوز؟ سجّل في قائمة الانتظار الذكية'
                              : 'Créneau souhaité pris ? Rejoindre la Liste d’Attente')}
                      </span>
                    </button>

                    {showWaitlistBox && (
                      <div className="mt-2 p-3.5 rounded-2xl bg-blue-50/70 dark:bg-zinc-900/90 border border-blue-300 dark:border-blue-500/40 space-y-2.5 text-xs">
                        <div className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                          <span>
                            {lang === 'ar'
                              ? 'قائمة الانتظار الذكية — سنراسلك فوراً عند توفر مقعد!'
                              : 'Liste d’Attente — Notification prioritaire en cas de désistement'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <input
                              ref={nameInputRef}
                              type="text"
                              value={clientName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setClientName(val);
                                if (fieldErrors.clientName && val.trim()) {
                                  setFieldErrors((prev) => ({ ...prev, clientName: undefined }));
                                }
                              }}
                              placeholder={lang === 'ar' ? 'الاسم الكامل *' : 'Nom complet *'}
                              className={`w-full bg-white dark:bg-black/60 border rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white ${
                                fieldErrors.clientName ? 'border-red-500 ring-2 ring-red-500/20' : 'border-zinc-300 dark:border-zinc-700'
                              }`}
                            />
                            {fieldErrors.clientName && (
                              <p role="alert" className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                                {fieldErrors.clientName}
                              </p>
                            )}
                          </div>
                          <div>
                            <input
                              ref={phoneInputRef}
                              type="tel"
                              dir="ltr"
                              value={clientPhone}
                              onChange={(e) => {
                                const val = e.target.value;
                                setClientPhone(val);
                                if (fieldErrors.clientPhone && val.replace(/\D/g, '').length >= 9) {
                                  setFieldErrors((prev) => ({ ...prev, clientPhone: undefined }));
                                }
                              }}
                              placeholder="06 35 39 25 03 *"
                              className={`w-full bg-white dark:bg-black/60 border rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-white ${
                                fieldErrors.clientPhone ? 'border-red-500 ring-2 ring-red-500/20' : 'border-zinc-300 dark:border-zinc-700'
                              }`}
                            />
                            {fieldErrors.clientPhone && (
                              <p role="alert" className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                                {fieldErrors.clientPhone}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={waitlistPreferredTime}
                            onChange={(e) => setWaitlistPreferredTime(e.target.value)}
                            className="bg-white dark:bg-black/60 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white"
                          >
                            <option value="أي توقيت متاح">
                              {lang === 'ar' ? 'أي توقيت متاح في هذا اليوم' : 'N’importe quelle heure libre'}
                            </option>
                            {dayAvailability.baseSlots.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={waitlistSubmitting}
                            onClick={handleJoinWaitlist}
                            className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                            <span>
                              {waitlistSubmitting
                                ? '...'
                                : (lang === 'ar' ? 'تسجيل في قائمة الانتظار' : 'Confirmer sur la liste')}
                            </span>
                          </button>
                        </div>
                        {waitlistSuccess && (
                          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                            {lang === 'ar'
                              ? '✅ تم تسجيلك في قائمة الانتظار! سنتصل بك أو نراسلك عبر واتساب فور شغور مكان.'
                              : '✅ Inscrit sur la liste d’attente ! Nous vous contacterons dès qu’une place se libère.'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 3 Navigation: Prev / Next */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="col-span-1 min-h-[48px] py-3 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  <span>{lang === 'ar' ? 'السابق' : lang === 'en' ? 'Back' : 'Retour'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="col-span-2 min-h-[48px] py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span>
                    {lang === 'ar'
                      ? 'التالي: معلوماتك والتأكيد'
                      : lang === 'en'
                      ? 'Next: Details & Confirm'
                      : lang === 'es'
                      ? 'Siguiente: Datos y Confirmar'
                      : 'Suivant : Coordonnées & Confirmer'}
                  </span>
                  {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: CLIENT INFO, CIH PAYMENT & FINAL CONFIRMATION     */}
          {/* ========================================================= */}
          {currentStep === 4 && (
            <div key="step-4" className={`space-y-4 pt-1 ${stepDirection === 'next' ? 'wizard-step-next' : 'wizard-step-prev'}`}>
              <label className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <span>
                  {lang === 'ar'
                    ? '4. معلوماتك الشخصية، الأداء، وتأكيد الحجز'
                    : lang === 'en'
                    ? '4. Your Details, Payment & Confirmation'
                    : '4. Vos Coordonnées, Paiement & Confirmation'}
                </span>
              </label>

              {/* Coordinates: Name, Phone (WhatsApp), and Optional Email */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                    <User className={`w-3 h-3 ${fieldErrors.clientName ? 'text-red-500' : 'text-zinc-400'}`} />
                    <span className={fieldErrors.clientName ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                      {lang === 'ar' ? 'الاسم الكامل *' : lang === 'en' ? 'Full Name *' : 'Nom complet *'}
                    </span>
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={clientName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClientName(val);
                      if (fieldErrors.clientName && val.trim()) {
                        setFieldErrors((prev) => ({ ...prev, clientName: undefined }));
                      }
                    }}
                    placeholder={lang === 'ar' ? 'مثال: يوسف الإدريسي' : 'Ex: Youssef El Idrissi'}
                    aria-invalid={Boolean(fieldErrors.clientName)}
                    required
                    className={`w-full min-h-[44px] bg-zinc-50 dark:bg-[#12141B] border rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none transition-colors ${
                      fieldErrors.clientName
                        ? 'border-red-500 dark:border-red-500 ring-2 ring-red-500/20 focus:border-red-500'
                        : 'border-zinc-200 dark:border-zinc-800 focus:border-amber-500'
                    }`}
                  />
                  {fieldErrors.clientName && (
                    <p role="alert" className="mt-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{fieldErrors.clientName}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                    <Phone className={`w-3 h-3 ${fieldErrors.clientPhone ? 'text-red-500' : 'text-emerald-500'}`} />
                    <span className={fieldErrors.clientPhone ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                      {lang === 'ar' ? 'رقم الهاتف (واتساب) *' : lang === 'en' ? 'Phone (WhatsApp) *' : 'Numéro WhatsApp *'}
                    </span>
                  </label>
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    dir="ltr"
                    value={clientPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClientPhone(val);
                      if (fieldErrors.clientPhone && val.replace(/\D/g, '').length >= 9 && !isClientBanned) {
                        setFieldErrors((prev) => ({ ...prev, clientPhone: undefined }));
                      }
                    }}
                    placeholder="06 35 39 25 03"
                    aria-invalid={Boolean(fieldErrors.clientPhone)}
                    required
                    className={`w-full min-h-[44px] bg-zinc-50 dark:bg-[#12141B] border rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white font-mono placeholder-zinc-400 focus:outline-none transition-colors ${
                      fieldErrors.clientPhone
                        ? 'border-red-500 dark:border-red-500 ring-2 ring-red-500/20 focus:border-red-500'
                        : 'border-zinc-200 dark:border-zinc-800 focus:border-amber-500'
                    }`}
                  />
                  {fieldErrors.clientPhone && (
                    <p role="alert" className="mt-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{fieldErrors.clientPhone}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-blue-500" />
                    <span>{lang === 'ar' ? 'الإيميل (اختياري)' : 'Email (Optionnel)'}</span>
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="w-full min-h-[44px] bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Real-Time CRM Recognition Banner */}
              {isClientBanned && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2 font-semibold">
                  <Ban className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? 'عذراً، تم تقييد هذا الرقم مؤقتاً بسبب تكرار عدم الحضور (No-Show). يرجى الاتصال بالصالون مباشرة على 0635392503.'
                      : 'Ce numéro est restreint suite à plusieurs absences (No-Show). Contactez le salon au 0635392503.'}
                  </span>
                </div>
              )}

              {!isClientBanned && cleanDigits.length >= 6 && (pastVisitsCount > 0 || crmProfile?.isVip || crmCustomDiscount > 0) && (
                <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/40 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                    <span>
                      {crmProfile?.isVip ? '👑 VIP • ' : ''}
                      {lang === 'ar'
                        ? `مرحباً بعودتك! رصيدك المؤكد: ${pastVisitsCount} زيارة`
                        : `Bon retour ! ${pastVisitsCount} visite(s) confirmée(s)`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isFreeWashEligible && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                        {lang === 'ar' ? '🎁 غسل شعر مجاني مستحق!' : '🎁 Shampoing Gratuit offert !'}
                      </span>
                    )}
                    {crmCustomDiscount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                        {lang === 'ar' ? `تخفيض ولاء -${crmCustomDiscount} MAD` : `Remise fidélité -${crmCustomDiscount} MAD`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Optional Client Notes Text Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="booking-client-notes"
                    className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5"
                  >
                    <Pencil className="w-3 h-3 text-amber-500" />
                    <span>
                      {lang === 'ar'
                        ? 'ملاحظات الزبون — قصة الشعر أو التفضيلات الخاصة (اختياري)'
                        : lang === 'en'
                        ? 'Client Notes — Hair Style or Grooming Preferences (Optional)'
                        : lang === 'es'
                        ? 'Notas del Cliente — Estilo o Preferencias (Opcional)'
                        : lang === 'amz'
                        ? 'ⵜⵉⵏⵏⴰⵢⵉⵏ ⵏ ⵓⵎⵙⴰⵖ — ⵜⴰⵖⴰⵔⴰ ⵏ ⵓⵣⵣⴰⵔ (ⵓⵔ ⵉⴱⵣⵣⵉⵣ)'
                        : 'Notes Client — Style de coupe ou préférences (Optionnel)'}
                    </span>
                  </label>
                  <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                    {notes.length}/400
                  </span>
                </div>

                <textarea
                  id="booking-client-notes"
                  rows={3}
                  maxLength={400}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'اكتب أي طلبات خاصة للحلاق مثل: تدرج منخفض، الحفاظ على الطول من الأعلى، تحديد اللحية بالموس...'
                      : lang === 'en'
                      ? 'Share special requests for your barber: e.g., low skin fade, keep length on top, sharp beard line...'
                      : lang === 'es'
                      ? 'Indica preferencias especiales para tu barbero: degradado bajo, mantener largo arriba, perfilado de barba...'
                      : 'Indiquez vos préférences au barbier : ex. dégradé bas, garder de la longueur au-dessus, contour barbe...'
                  }
                  className="w-full min-h-[84px] resize-y bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500 transition-colors leading-relaxed"
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  {(lang === 'ar'
                    ? ['تدرج منخفض', 'تدرج متوسط', 'الحفاظ على الطول', 'تحديد اللحية بالموس']
                    : lang === 'en'
                    ? ['Low Fade', 'Mid Fade', 'Keep length on top', 'Sharp beard line']
                    : ['Dégradé bas', 'Taper fade', 'Garder longueur', 'Contours barbe']
                  ).map((preset) => {
                    const alreadyIncluded = notes.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (alreadyIncluded) return;
                          const next = notes.trim() ? `${notes.trim()}، ${preset}` : preset;
                          setNotes(next.slice(0, 400));
                        }}
                        disabled={alreadyIncluded}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                          alreadyIncluded
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300 cursor-default'
                            : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer'
                        }`}
                      >
                        + {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OPTIONAL CIH BANK TRANSFER DEPOSIT & RECEIPT UPLOAD */}
              <div className="p-4 rounded-2xl border bg-zinc-50 dark:bg-[#12141B] border-emerald-500/35 dark:border-emerald-500/35 space-y-3 transition-all">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <CihBankLogo />

                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white">
                        {lang === 'ar'
                          ? 'التحويل البنكي CIH Bank (اختياري)'
                          : lang === 'en'
                          ? 'CIH Bank Transfer (Optional)'
                          : lang === 'es'
                          ? 'Transferencia Bancaria CIH (Opcional)'
                          : 'Virement Bancaire CIH Bank (Optionnel)'}
                      </h4>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 font-medium leading-relaxed mt-0.5">
                        {lang === 'ar'
                          ? 'التحويل البنكي CIH (اختياري) - مستحسن لتأكيد الموعد مسبقاً دون الحاجة للتنقل للمحل'
                          : lang === 'en'
                          ? 'CIH Bank transfer (optional) — recommended to confirm your appointment in advance without visiting the salon.'
                          : lang === 'es'
                          ? 'Transferencia CIH (opcional) — recomendada para confirmar la cita con antelación sin desplazarse al salón.'
                          : 'Virement CIH (optionnel) — recommandé pour confirmer le rendez-vous à l’avance sans avoir à vous déplacer au salon.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Official CIH Bank Account Box */}
                <div className="p-3 rounded-xl bg-white dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-zinc-500 dark:text-zinc-400 font-semibold text-[11px]">
                      Titulaire :
                    </span>
                    <div className="flex items-center gap-2">
                      <span dir="ltr" className="font-black text-zinc-900 dark:text-white font-mono text-xs">
                        {CIH_BANK_DETAILS.accountHolder}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyHolderName}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          copiedHolderName
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100'
                        }`}
                        aria-label="Copier le nom du titulaire CIH"
                      >
                        {copiedHolderName ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'تم النسخ' : 'Copié'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <span className="text-zinc-500 dark:text-zinc-400 font-semibold text-[11px]">
                      {lang === 'ar' ? 'رقم الحساب :' : lang === 'en' ? 'Account Number :' : 'رقم الحساب / N° Compte :'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span dir="ltr" className="font-mono font-black text-zinc-900 dark:text-amber-300 tracking-wider text-xs sm:text-sm">
                        {CIH_BANK_DETAILS.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAccountNumber}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          copiedAccountNumber
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100'
                        }`}
                        aria-label="Copier le numéro de compte CIH"
                      >
                        {copiedAccountNumber ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'تم النسخ' : 'Copié'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Receipt Upload + Direct WhatsApp Helper */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex-1 min-w-[200px] py-2.5 px-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-dashed border-emerald-500/60 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2 cursor-pointer transition-colors">
                      {cihReceiptName ? (
                        <>
                          <FileCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{cihReceiptName}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span>
                            {lang === 'ar'
                              ? 'إرفاق إيصال تحويل CIH هنا (اختياري — صورة أو PDF)'
                              : 'Joindre le reçu de virement CIH (Optionnel)'}
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleCihReceiptUpload}
                        className="hidden"
                      />
                    </label>

                    {cihReceiptName && (
                      <button
                        type="button"
                        onClick={() => {
                          setCihReceiptName('');
                          setCihReceiptPreview('');
                          setCihReceiptUploadedAt('');
                        }}
                        className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 cursor-pointer"
                        title="Supprimer le reçu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <a
                    href={`https://wa.me/${SALON_INFO.whatsappNumber}?text=${encodeURIComponent(
                      lang === 'ar'
                        ? `مرحباً صالون بومليك، قمت بالتحويل البنكي عبر CIH لتأكيد حجزي (${clientName.trim() || 'زبون'} - بتاريخ ${date} الساعة ${timeSlot} مع ${barberNameLocalized}). مرفق طيه صورة إيصال التحويل:`
                        : `Bonjour Salon Boumlik, voici mon reçu de virement CIH pour confirmer ma réservation à l'avance (${clientName.trim() || 'Client'} - le ${date} à ${timeSlot} avec ${barberNameLocalized}) :`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition-all"
                  >
                    <MessageCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {lang === 'ar'
                        ? 'أو أرسل إيصال التحويل مباشرة عبر واتساب الصالون'
                        : lang === 'en'
                        ? 'Or send CIH receipt directly via Salon WhatsApp'
                        : 'Ou envoyer le reçu directement sur le WhatsApp du salon'}
                    </span>
                  </a>
                </div>
              </div>

              {/* Interactive Queue Avoidance Toggle (+10 MAD) — Directly below CIH Bank & right above Price Summary */}
              <div
                onClick={() => setIncludeWaitingSkip((prev) => !prev)}
                className={`px-4 py-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 min-h-[56px] ${
                  includeWaitingSkip
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/60 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex-shrink-0">
                    <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-400 block truncate">
                      {ui.waitingTitle}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold block tabular-nums ${
                        includeWaitingSkip ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'
                      }`}
                    >
                      {includeWaitingSkip ? '+10 MAD' : '0 MAD'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={includeWaitingSkip}
                  aria-label={ui.waitingTitle}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIncludeWaitingSkip((prev) => !prev);
                  }}
                  dir="ltr"
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none cursor-pointer ${
                    includeWaitingSkip
                      ? 'bg-amber-500 border-amber-400'
                      : 'bg-zinc-300 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                      includeWaitingSkip ? 'translate-x-[24px]' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Final Itemized Price & Appointment Summary Box */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 pb-2 border-b border-zinc-200 dark:border-zinc-800/80">
                  <span>{barberNameLocalized}</span>
                  <span dir="ltr" className="font-mono font-bold text-zinc-900 dark:text-white">
                    {date} • {timeSlot}
                  </span>
                </div>

                {pricingResult.items.map((item) => (
                  <div key={item.serviceId} className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                    <span className="truncate">{item.name}</span>
                    <span className="font-mono font-semibold text-zinc-900 dark:text-white tabular-nums">
                      {item.finalPrice} MAD
                    </span>
                  </div>
                ))}

                {pricingResult.totalSavings > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>{lang === 'ar' ? '🎁 تخفيض الباقة المطبقة:' : '🎁 Remise bundle appliquée:'}</span>
                    <span className="font-mono tabular-nums">-{pricingResult.totalSavings} MAD</span>
                  </div>
                )}

                {includeWaitingSkip && (
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <span>⚡</span>
                      <span>{lang === 'ar' ? 'خدمة تفادي الانتظار:' : 'Service Coupe-File:'}</span>
                    </span>
                    <span className="font-mono font-bold tabular-nums">+10 MAD</span>
                  </div>
                )}

                {crmCustomDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>{lang === 'ar' ? '⭐ تخفيض الولاء / VIP:' : '⭐ Remise fidélité VIP :'}</span>
                    <span className="font-mono tabular-nums">-{crmCustomDiscount} MAD</span>
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-black text-zinc-900 dark:text-white block">
                      {lang === 'ar' ? 'المجموع النهائي للطلب:' : 'Total à payer :'}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {lang === 'ar' ? 'الأداء في الصالون بعد الخدمة' : 'Paiement au salon après la prestation'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono block tabular-nums">
                      {grandTotal} <span className="text-xs text-amber-600/80">MAD</span>
                    </span>
                  </div>
                </div>
              </div>

              {fieldErrors.submit && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{fieldErrors.submit}</span>
                </div>
              )}

              {/* Step 4 Navigation & Primary Confirm Action */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="col-span-1 min-h-[52px] py-3 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  <span>{lang === 'ar' ? 'السابق' : lang === 'en' ? 'Back' : 'Retour'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={isSubmitting || isClientBanned || dayAvailability.isSalonClosedDay || dayAvailability.availableSlots.length === 0}
                  className="col-span-2 min-h-[52px] py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-black flex-shrink-0" />
                  <span>
                    {isSubmitting
                      ? (lang === 'ar' ? 'جاري تسجيل الحجز...' : 'Enregistrement...')
                      : isClientBanned
                      ? (lang === 'ar' ? 'الحجز مقيد لهذا الرقم' : 'Numéro restreint')
                      : ui.btnSubmit}
                  </span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ADVANCED DIGITAL TICKET MODAL (With Barber Color-Coding, QR Code, and Image Download) */}
      {createdBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0E1015] border border-amber-500/40 rounded-3xl p-5 sm:p-6 max-w-sm sm:max-w-md w-full shadow-2xl space-y-4 text-center animate-in fade-in duration-300 max-h-[92vh] overflow-y-auto text-white">
            
            {/* The Actual Digital Ticket Card Preview */}
            <div 
              ref={ticketCardRef}
              data-ticket-card="true"
              className="p-5 rounded-3xl bg-[#12141B] border-2 shadow-2xl space-y-4 text-left relative overflow-hidden"
              style={{
                borderColor: activeBarberColor,
              }}
            >
              {/* Barber Pole Top Line */}
              <div className="h-1.5 -mx-5 -mt-5 mb-4 bg-gradient-to-r from-red-600 via-white to-blue-600" />

              {/* Barber Identity Badge */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3.5 h-3.5 rounded-full shadow-sm"
                    style={{ backgroundColor: activeBarberColor }}
                  />
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                      {lang === 'ar' ? 'الحلاق المعين' : 'Barbier Assigné'}
                    </span>
                    <span className="text-xs font-black text-white">
                      {createdBooking.barberName}
                    </span>
                  </div>
                </div>

                <span 
                  className="px-2.5 py-1 rounded-lg text-white font-bold text-[10px] font-mono shadow-xs"
                  style={{ backgroundColor: activeBarberColor }}
                >
                  {createdBooking.ticketNumber.startsWith('#') ? createdBooking.ticketNumber : `#${createdBooking.ticketNumber}`}
                </span>
              </div>

              {/* QR Code & Main Ticket Info */}
              <div className="flex items-center gap-4 bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800">
                {qrCodeDataUrl ? (
                  <div className="p-1.5 bg-white rounded-xl flex-shrink-0 shadow-md">
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Booking QR Code" 
                      className="w-20 h-20 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-8 h-8 text-zinc-500 animate-pulse" />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-[10px] text-zinc-400 block uppercase">Salon Boumlik</span>
                  <div className="text-sm font-bold text-white truncate">
                    {createdBooking.clientName}
                  </div>
                  <div className="text-xs text-amber-400 font-mono font-semibold">
                    📅 {createdBooking.date}
                  </div>
                  <div className="text-xs text-blue-400 font-mono font-bold">
                    ⏰ {createdBooking.timeSlot}
                  </div>
                </div>
              </div>

              {/* Client Grooming Notes Indicator */}
              {createdBooking.clientNotes && (
                <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 space-y-0.5 text-start">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Pencil className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span>
                      {lang === 'ar'
                        ? 'ملاحظات الزبون:'
                        : lang === 'en'
                        ? 'Client Notes:'
                        : lang === 'es'
                        ? 'Notas del Cliente:'
                        : 'Notes Client :'}
                    </span>
                  </div>
                  <p className="text-zinc-200 leading-relaxed break-words">
                    {createdBooking.clientNotes}
                  </p>
                </div>
              )}

              {/* CIH Receipt Attached Indicator */}
              {createdBooking.cihReceiptName && (
                <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-[11px] text-emerald-300 font-semibold">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="truncate">
                    {lang === 'ar' ? `تم إرفاق إيصال CIH: ${createdBooking.cihReceiptName}` : `Reçu CIH joint : ${createdBooking.cihReceiptName}`}
                  </span>
                </div>
              )}

              {/* Itemized Services + Queue Avoidance + Total Breakdown (Matches PNG Ticket) */}
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-1.5 text-xs">
                {(createdBooking.cartItemsSummary || []).map((item) => (
                  <div key={item.serviceId} className="flex items-center justify-between text-zinc-300 text-[11px]">
                    <span className="truncate">{item.name}</span>
                    <span className="font-mono font-semibold text-white tabular-nums">{item.finalPrice} MAD</span>
                  </div>
                ))}

                {createdTicketHasQueueSkip && (
                  <div className="flex items-center justify-between text-amber-300 text-[11px] font-semibold">
                    <span>⚡ {lang === 'ar' ? 'خدمة تفادي الانتظار' : 'Service Coupe-File'}</span>
                    <span className="font-mono tabular-nums">+10 MAD</span>
                  </div>
                )}

                {(createdBooking.totalSavingsMAD ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-emerald-400 text-[11px] font-bold">
                    <span>{lang === 'ar' ? 'تخفيض / وفر الباقة' : 'Remise / Économie'}</span>
                    <span className="font-mono tabular-nums">-{createdBooking.totalSavingsMAD} MAD</span>
                  </div>
                )}

                <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">
                    {lang === 'ar' ? 'المجموع النهائي للطلب:' : 'Total de la réservation:'}
                  </span>
                  <span className="text-base font-black text-amber-400 font-mono tabular-nums">
                    {createdBooking.finalTotalMAD} MAD
                  </span>
                </div>
              </div>
            </div>

            {/* Recommendation Banner for Instant Confirmation */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/30 to-amber-950/40 border border-amber-500/50 text-center space-y-1 shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
                <span>
                  {lang === 'ar' ? 'تأكيد فوري وسريع' : 'Confirmation Rapide Recommandée'}
                </span>
              </div>
              <p className="text-[11px] text-amber-200/95 leading-relaxed font-semibold">
                {lang === 'ar' 
                  ? 'للحصول على تأكيد ورد سريع، يُنصح بالتواصل معنا الآن عبر الواتساب أو الاتصال.' 
                  : 'Pour une confirmation immédiate et un traitement prioritaire, nous vous recommandons vivement de nous contacter dès maintenant.'}
              </p>
            </div>

            {/* Foolproof Programmatic PNG Ticket Download Button */}
            <button
              type="button"
              onClick={handleDownloadTicketPng}
              disabled={isDownloading}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 border border-amber-400 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-[0.99]"
            >
              <Download className="w-4 h-4 text-black" />
              <span>
                {isDownloading
                  ? (lang === 'ar' ? 'جاري تجهيز صورة التذكرة...' : 'Génération du ticket PNG...')
                  : lang === 'ar'
                  ? 'تحميل التذكرة (صورة PNG)'
                  : lang === 'es'
                  ? 'Descargar Ticket (PNG)'
                  : lang === 'en'
                  ? 'Download Ticket (PNG)'
                  : 'Télécharger le Ticket (PNG)'}
              </span>
            </button>

            {/* Direct Contact Buttons (Barber & Hassan with Dynamic Multilingual Pre-filled Message) */}
            <div className="space-y-2">
              <a
                href={`https://wa.me/${chosenBarberWa}?text=${encodeURIComponent(
                  buildClientTicketWhatsAppMessage(createdBooking, lang)
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white flex-shrink-0" />
                <span>
                  {lang === 'ar' ? `مراسلة الحلاق عبر الواتساب (${createdBooking.barberName})` : `WhatsApp avec le Barbier (${createdBooking.barberName})`}
                </span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/212635392503?text=${encodeURIComponent(
                    buildClientTicketWhatsAppMessage(createdBooking, lang)
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lang === 'ar' ? 'واتساب حسن' : 'WhatsApp Hassan'}</span>
                </a>

                <a
                  href="tel:0635392503"
                  className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-blue-400" />
                  <span>06 35 39 25 03</span>
                </a>
              </div>
            </div>

            {/* Quick Actions: Copy Ticket, Track, Close */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => handleCopyTicket(createdBooking.ticketNumber)}
                className="w-full py-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4 text-amber-400" />
                <span>{copiedTicket ? (lang === 'ar' ? 'تم النسخ!' : 'Copié !') : (lang === 'ar' ? 'نسخ رقم التذكرة' : 'Copier le Ticket')}</span>
              </button>

              {onOpenTrackBooking && (
                <button
                  type="button"
                  onClick={() => {
                    const tNum = createdBooking.ticketNumber;
                    setCreatedBooking(null);
                    onOpenTrackBooking(tNum);
                  }}
                  className="w-full py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Ticket className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تتبع تذكرتي الآن' : 'Suivre mon statut'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCreatedBooking(null);
                  setCurrentStep(1);
                }}
                className="w-full py-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق النافذة' : 'Fermer'}
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};
