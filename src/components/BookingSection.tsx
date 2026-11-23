import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
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
  ChevronLeft,
  BellRing,
  UserCheck,
  UserPlus,
  Sparkles as SparklesIcon,
  CalendarClock,
  History,
  Coins,
  ScanLine,
  RotateCcw,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { useLanguage } from '../context/LanguageContext';
import { SALON_INFO } from '../data/barbershopData';
import { ModalPortal } from './ModalPortal';
import { createNewBooking, subscribeToBookings, getAllBookings, normalizeMoroccanPhoneDigits } from '../utils/bookingStore';
import {
  PricingEngineResult,
  AppointmentBooking,
  CaisseBarberId,
  SelectedCartItem,
  HairColorConfig,
} from '../types';
import {
  BASE_SERVICES,
  COLOR_PRICES,
  calculateCartPricing,
  getGiftLabel,
} from '../utils/pricingEngine';
import { downloadTicketAsPng } from '../utils/ticketCanvas';
import { buildBookingCheckInQrPayload } from '../utils/clientQr';
import { buildClientTicketWhatsAppMessage } from '../utils/whatsappAutomation';
import { safeCopyToClipboard } from '../utils/safeBrowser';
import { CIH_BANK_DETAILS, processCihReceiptFile } from '../utils/cihReceipt';
import { CihBankLogo } from './CihBankLogo';
import {
  useBarberSchedules,
  evaluateBarberDayAvailability,
  getInitialBookingDate,
} from '../utils/barberScheduleStore';
import {
  useBarberProfiles,
  getMergedBarbers,
  getBarberSelectableServices,
} from '../utils/barberProfileStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import {
  getEffectiveBundlesForBarber,
  getEffectiveHiddenServiceIds,
  getEffectiveNoWaitEnabled,
  getVisibleBaseServices,
  resolveGiftWithHaircutBeardServiceId,
  useShopPricingConfig,
  resolveEffectiveServicePrices,
} from '../utils/shopPricingStore';
import {
  formatSalonDisplayPhone,
  normalizeSalonTelHref,
  normalizeSalonWhatsappDigits,
  useSalonProfileSettings,
} from '../utils/salonSettingsStore';
import { useCaisseEntries } from '../utils/caisseStore';
import {
  computeOutstandingCreditsForPhone,
  submitClientCreditDispute,
  useManualClientCredits,
} from '../utils/creditRegistryStore';
import { getBarberIdentityTokens } from '../utils/barberIdentity';
import {
  useCrmClients,
  getCrmDocId,
  redeemLoyaltyPointsForDiscount,
  consumeClientDiscountOnBooking,
} from '../utils/crmStore';
import { addToWaitlist } from '../utils/waitlistStore';
import {
  computeClientPointsSummary,
  computeLoyaltyProgress,
  getVerifiedVisitsCount,
  LOYALTY_POINT_TIERS,
} from '../utils/loyaltyEngine';
import { rememberTrackedTicket } from '../utils/clientReminderWatcher';
import { computeBarberReviewStats, useFirestoreReviews } from '../utils/reviewsStore';
import { sendDualAlert, showToast } from '../utils/notifications';
import { registerClientPushSubscription } from '../utils/webPushClient';
import { NotificationConsentModal } from './NotificationConsentModal';
import { ReturningClientLookupModal, RecognizedClientData } from './ReturningClientLookupModal';
import { ReturningLoyaltyStatusCard } from './ReturningLoyaltyStatusCard';
import { WeeklyAvailabilityVisualizer } from './WeeklyAvailabilityVisualizer';
import { pickLang } from '../utils/i18n';
import {
  MAX_ACTIVE_BOOKINGS_PER_CLIENT,
  getCachedClientIpHash,
  getClientActiveUpcomingBookings,
  getLocalTodayStr,
  getOrCreateDeviceFingerprint,
  prefetchClientIpHash,
} from '../utils/antiSpam';
import { getLiveQueueBookings } from './AdminEnterprisePanels';

interface BookingSectionProps {
  pricingResult: PricingEngineResult;
  colorConfig?: HairColorConfig;
  proteinPrice?: number;
  selectedBarberId: string;
  onSelectBarberId: (barberId: string) => void;
  selectedServiceIds: string[];
  onToggleServiceId: (serviceId: string) => void;
  onSetServiceIds?: (serviceIds: string[]) => void;
  onBookingConfirmed?: (booking: AppointmentBooking) => void;
  onClientIdentified?: (phone: string) => void;
  onOpenTrackBooking?: (ticket: string) => void;
  isEmbeddedModal?: boolean;
  allowAdminBypass?: boolean;
  onRequestClose?: () => void;
}

export const BookingSection: React.FC<BookingSectionProps> = ({
  pricingResult: _initialPricingResult,
  colorConfig = { tone: 'grey_white', coverage: 'full' },
  proteinPrice = 200,
  selectedBarberId,
  onSelectBarberId,
  selectedServiceIds,
  onToggleServiceId,
  onSetServiceIds,
  onBookingConfirmed,
  onClientIdentified,
  onOpenTrackBooking,
  isEmbeddedModal = false,
  allowAdminBypass = false,
  onRequestClose,
}) => {
  const { lang, t, isRtl } = useLanguage();
  const salonSettings = useSalonProfileSettings();
  const liveSalonDisplayPhone = formatSalonDisplayPhone(salonSettings.salonPhone);
  const liveSalonWhatsappDigits = normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp);

  // Form fields
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [date, setDate] = useState(() => getInitialBookingDate());
  const [timeSlot, setTimeSlot] = useState('FLEXIBLE');
  const [notes, setNotes] = useState('');
  const [includeWaitingSkip, setIncludeWaitingSkip] = useState<boolean>(false);
  const [cihReceiptName, setCihReceiptName] = useState('');
  const [cihReceiptPreview, setCihReceiptPreview] = useState('');
  const [cihReceiptUploadedAt, setCihReceiptUploadedAt] = useState('');
  const [copiedHolderName, setCopiedHolderName] = useState(false);
  const [copiedAccountNumber, setCopiedAccountNumber] = useState(false);

  // Device & hashed IP anti-spam identifiers (never block offline)
  const [deviceFingerprint] = useState<string>(() => getOrCreateDeviceFingerprint());
  const [clientIpHash, setClientIpHash] = useState<string | undefined>(() => getCachedClientIpHash());

  // Live Firestore Sync for Bookings, Barber Schedules, Profiles, Reviews & CRM Loyalty/Ban checks
  const [liveBookings, setLiveBookings] = useState<AppointmentBooking[]>(() => getAllBookings());
  const barberRoster = useBarberRoster();
  const barberSchedules = useBarberSchedules();
  const barberProfiles = useBarberProfiles();
  const mergedTeam = React.useMemo(
    () => getMergedBarbers(barberProfiles, barberRoster),
    [barberProfiles, barberRoster]
  );
  const crmClientsMap = useCrmClients();
  const { reviews: firestoreReviews } = useFirestoreReviews();
  const [redeemingPointsTierId, setRedeemingPointsTierId] = useState<string | null>(null);
  const [customSelectedByBarber, setCustomSelectedByBarber] = useState<Record<string, string[]>>({});

  // Smart Waitlist form state
  const [showWaitlistBox, setShowWaitlistBox] = useState(false);
  const [waitlistPreferredTime, setWaitlistPreferredTime] = useState('ANY');
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  // 6-Step Progressive Disclosure Wizard:
  // 1: Client Status, 2: Barber Selection, 3: Client Info, 4: Date & Time, 5: Services & Live Prices, 6: Confirmation & CIH
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(allowAdminBypass ? 2 : 1);
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
  const [showNotifConsentModal, setShowNotifConsentModal] = useState(false);
  const [notifSubscribedForTicket, setNotifSubscribedForTicket] = useState(false);

  // Returning Client Quick Recognition Flow
  const [clientMode, setClientMode] = useState<'first_time' | 'returning'>('first_time');
  const [isReturningLookupOpen, setIsReturningLookupOpen] = useState(false);
  const [recognizedClient, setRecognizedClient] = useState<RecognizedClientData | null>(null);
  const [showRecognizedHistory, setShowRecognizedHistory] = useState(false);

  // Smart Cross-Barber Suggestion & Barber-Assigned Flexible Time State
  const [inspectedBusySlot, setInspectedBusySlot] = useState<string | null>(null);
  const [isFlexibleBarberTime, setIsFlexibleBarberTime] = useState(true);
  const [timeOptionMode, setTimeOptionMode] = useState<'specific' | 'flexible' | 'waitlist'>('flexible');
  const [showManualDateTime, setShowManualDateTime] = useState(false);
  const [wantCihOnlinePayment, setWantCihOnlinePayment] = useState(false);

  // Client Credit Dispute / Inquiry form state (non-blocking inside credit alert)
  const [creditDisputeOpen, setCreditDisputeOpen] = useState(false);
  const [creditDisputeText, setCreditDisputeText] = useState('');
  const [creditDisputeBusy, setCreditDisputeBusy] = useState(false);
  const [creditDisputeSentForPhone, setCreditDisputeSentForPhone] = useState<string>('');

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

  useEffect(() => {
    let active = true;
    void prefetchClientIpHash().then((hash) => {
      if (active && hash) setClientIpHash(hash);
    });
    return () => {
      active = false;
    };
  }, []);

  const shopPricingConfig = useShopPricingConfig();
  const caisseEntries = useCaisseEntries();
  const manualCredits = useManualClientCredits();
  const selectedBarber = mergedTeam.find((b) => b.id === selectedBarberId) || mergedTeam[0];
  const barberNameLocalized = selectedBarber.name[lang] || selectedBarber.name.fr;

  const selectedBarberProfile = barberProfiles[selectedBarber.id as CaisseBarberId];
  const isNoWaitOptionEnabled = getEffectiveNoWaitEnabled(
    shopPricingConfig,
    selectedBarberProfile
  );
  useEffect(() => {
    if (!isNoWaitOptionEnabled && includeWaitingSkip) {
      setIncludeWaitingSkip(false);
    }
  }, [isNoWaitOptionEnabled, includeWaitingSkip]);

  const effectiveHiddenServiceIds = React.useMemo(
    () => getEffectiveHiddenServiceIds(shopPricingConfig, selectedBarberProfile),
    [shopPricingConfig, selectedBarberProfile]
  );
  const effectiveBundles = React.useMemo(
    () => getEffectiveBundlesForBarber(shopPricingConfig, selectedBarberProfile),
    [shopPricingConfig, selectedBarberProfile]
  );
  const resolvedEffectivePricing = React.useMemo(
    () =>
      resolveEffectiveServicePrices({
        dateStr: date,
        shopConfig: shopPricingConfig,
        barberProfile: selectedBarberProfile,
      }),
    [date, shopPricingConfig, selectedBarberProfile]
  );

  const liveBasePricing = React.useMemo(
    () =>
      calculateCartPricing({
        selectedIds: selectedServiceIds,
        colorConfig,
        proteinPrice,
        lang,
        effectiveServicePrices: resolvedEffectivePricing.priceMap,
        specialRuleLabel: resolvedEffectivePricing.activeSpecialRuleLabels[0],
        hiddenServiceIds: effectiveHiddenServiceIds,
        serviceBundles: effectiveBundles,
      }),
    [
      selectedServiceIds,
      colorConfig,
      proteinPrice,
      lang,
      resolvedEffectivePricing,
      effectiveHiddenServiceIds,
      effectiveBundles,
    ]
  );

  // Auto-include configured gift service ("هدية") when Haircut + Beard combo is selected
  const hasHaircutBeardCombo =
    selectedServiceIds.includes('haircut') &&
    selectedServiceIds.includes('beard') &&
    !effectiveHiddenServiceIds.includes('haircut') &&
    !effectiveHiddenServiceIds.includes('beard');

  const configuredComboGiftId = React.useMemo(
    () =>
      resolveGiftWithHaircutBeardServiceId(
        shopPricingConfig,
        selectedBarberProfile,
        resolvedEffectivePricing.priceMap
      ),
    [shopPricingConfig, selectedBarberProfile, resolvedEffectivePricing.priceMap]
  );

  const prevHaircutBeardComboRef = useRef(false);
  useEffect(() => {
    const wasActive = prevHaircutBeardComboRef.current;
    prevHaircutBeardComboRef.current = hasHaircutBeardCombo;
    if (!wasActive && hasHaircutBeardCombo && configuredComboGiftId) {
      if (!selectedServiceIds.includes(configuredComboGiftId)) {
        if (onSetServiceIds) {
          onSetServiceIds([...selectedServiceIds, configuredComboGiftId]);
        } else {
          onToggleServiceId(configuredComboGiftId);
        }
        if (currentStep === 5) {
          const giftDef = BASE_SERVICES.find((s) => s.id === configuredComboGiftId);
          const giftTitle = giftDef ? giftDef.name[lang] || giftDef.name.ar : configuredComboGiftId;
          showToast(
            pickLang(lang, {
              ar: `🎁 تمت إضافة هدية مجانية تلقائياً: ${giftTitle}`,
              fr: `🎁 Cadeau offert ajouté automatiquement : ${giftTitle}`,
              amz: `🎁 ⵜⴻⵜⵜⵓⵔⵏⴰ ⵜⵉⴽⴽⵉ ⴼⴰⴱⵓⵔ : ${giftTitle}`,
              en: `🎁 Free gift automatically added: ${giftTitle}`,
              es: `🎁 Regalo incluido automáticamente: ${giftTitle}`,
            }),
            '',
            'success'
          );
        }
      }
    }
  }, [
    hasHaircutBeardCombo,
    configuredComboGiftId,
    selectedServiceIds,
    onSetServiceIds,
    onToggleServiceId,
    currentStep,
    lang,
  ]);

  // Extra personal services added by this barber beyond canonical BASE_SERVICES
  const barberExtraServices = React.useMemo(
    () =>
      getBarberSelectableServices(
        selectedBarber.id as CaisseBarberId,
        barberProfiles,
        shopPricingConfig,
        date
      ).filter((s) => !BASE_SERVICES.some((b) => b.id === s.id)),
    [selectedBarber.id, barberProfiles, shopPricingConfig, date]
  );

  const activeExtraSelectedIds = React.useMemo(
    () =>
      (customSelectedByBarber[selectedBarber.id] || []).filter((id) =>
        barberExtraServices.some((s) => s.id === id)
      ),
    [customSelectedByBarber, selectedBarber.id, barberExtraServices]
  );

  const handleToggleExtraService = (srvId: string) => {
    setCustomSelectedByBarber((prev) => {
      const current = prev[selectedBarber.id] || [];
      const next = current.includes(srvId)
        ? current.filter((id) => id !== srvId)
        : [...current, srvId];
      return { ...prev, [selectedBarber.id]: next };
    });
  };

  const extraCartItems: SelectedCartItem[] = React.useMemo(
    () =>
      activeExtraSelectedIds
        .map((id) => barberExtraServices.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => ({
          serviceId: s.id,
          name:
            lang === 'fr'
              ? s.nameFr
              : lang === 'en'
              ? s.nameEn
              : s.nameAr,
          category: 'custom',
          originalPrice: s.priceMAD,
          finalPrice: s.priceMAD,
        })),
    [activeExtraSelectedIds, barberExtraServices, lang]
  );

  const effectiveCartItems: SelectedCartItem[] = React.useMemo(
    () => [...liveBasePricing.items, ...extraCartItems],
    [liveBasePricing.items, extraCartItems]
  );

  const extraSubtotal = extraCartItems.reduce((sum, item) => sum + item.finalPrice, 0);
  const effectiveServicesFinalTotal = liveBasePricing.finalTotal + extraSubtotal;
  const effectiveServicesOriginalSubtotal = liveBasePricing.originalSubtotal + extraSubtotal;
  const effectiveTotalSavings = liveBasePricing.totalSavings;
  const effectiveSelectedCount =
    selectedServiceIds.filter((id) => !effectiveHiddenServiceIds.includes(id)).length +
    activeExtraSelectedIds.length;

  const totalSelectedMinutes = React.useMemo(() => {
    const baseMins = liveBasePricing.items.reduce((sum, item) => {
      const baseSrv = BASE_SERVICES.find((s) => s.id === item.serviceId);
      const resolvedDur =
        resolvedEffectivePricing.durationMap[item.serviceId] ??
        baseSrv?.durationMinutes ??
        20;
      return sum + resolvedDur;
    }, 0);
    const extraMins = activeExtraSelectedIds.reduce((sum, id) => {
      const found = barberExtraServices.find((s) => s.id === id);
      return sum + (found?.durationMinutes || 30);
    }, 0);
    return baseMins + extraMins;
  }, [
    liveBasePricing.items,
    resolvedEffectivePricing.durationMap,
    activeExtraSelectedIds,
    barberExtraServices,
  ]);

  // Strict Duration-Aware Availability Evaluation (Mon OFF, 11-13 / 16-22, Fri 15-22 + Barber breaks + multi-hour spans)
  const dayAvailability = evaluateBarberDayAvailability(
    selectedBarber.id,
    date,
    barberSchedules,
    liveBookings,
    totalSelectedMinutes
  );

  // Evaluate availability for all barbers on the chosen date (used for Step 2 open counters & Step 4 cross-barber suggestions)
  const allBarbersAvailability = React.useMemo(() => {
    const map: Record<string, ReturnType<typeof evaluateBarberDayAvailability>> = {};
    mergedTeam.forEach((b) => {
      map[b.id] = evaluateBarberDayAvailability(
        b.id,
        date,
        barberSchedules,
        liveBookings,
        totalSelectedMinutes
      );
    });
    return map;
  }, [date, barberSchedules, liveBookings, totalSelectedMinutes, mergedTeam]);

  // Clear inspected busy slot when date changes or day is salon closed
  useEffect(() => {
    setInspectedBusySlot(null);
  }, [date, selectedBarber.id]);

  // Synchronize selected date & slot strictly with salon working hours, barber off-days/breaks, and live bookings.
  // In Smart Queue default mode (isFlexibleBarberTime === true), timeSlot stays 'FLEXIBLE' (never pre-assigning a fixed hour)
  // while the target working date automatically aligns to the barber's nearest open working day.
  useEffect(() => {
    const findNearestOpenWorkingDay = (preferredStartDate?: string): { dateStr: string; firstSlot: string } | null => {
      const todayStr = getLocalTodayStr();
      const startDateStr =
        preferredStartDate && preferredStartDate >= todayStr ? preferredStartDate : todayStr;
      const [sy, sm, sd] = startDateStr.split('-').map(Number);
      const baseCursor =
        Number.isFinite(sy) && Number.isFinite(sm) && Number.isFinite(sd)
          ? new Date(sy, sm - 1, sd, 12, 0, 0)
          : new Date();

      for (let i = 0; i < 14; i++) {
        const y = baseCursor.getFullYear();
        const m = String(baseCursor.getMonth() + 1).padStart(2, '0');
        const d = String(baseCursor.getDate()).padStart(2, '0');
        const candStr = `${y}-${m}-${d}`;
        const candAvail = evaluateBarberDayAvailability(
          selectedBarber.id,
          candStr,
          barberSchedules,
          liveBookings,
          totalSelectedMinutes
        );
        if (
          !candAvail.isSalonClosedDay &&
          !candAvail.isBarberOffDay &&
          candAvail.availableSlots.length > 0
        ) {
          return { dateStr: candStr, firstSlot: candAvail.availableSlots[0] };
        }
        baseCursor.setDate(baseCursor.getDate() + 1);
      }
      return null;
    };

    if (isFlexibleBarberTime) {
      if (timeSlot !== 'FLEXIBLE') {
        setTimeSlot('FLEXIBLE');
      }
      if (!showManualDateTime && timeOptionMode !== 'waitlist') {
        const todayStr = getLocalTodayStr();
        const isCurrentDateOpen =
          date >= todayStr &&
          !dayAvailability.isSalonClosedDay &&
          !dayAvailability.isBarberOffDay &&
          dayAvailability.availableSlots.length > 0;
        if (!isCurrentDateOpen) {
          const nearest = findNearestOpenWorkingDay(todayStr);
          if (nearest && nearest.dateStr !== date) {
            setDate(nearest.dateStr);
          }
        }
      }
      return;
    }

    if (dayAvailability.availableSlots.length > 0) {
      if (!dayAvailability.availableSlots.includes(timeSlot)) {
        setTimeSlot(dayAvailability.availableSlots[0]);
      }
      return;
    }

    if (!showManualDateTime && timeOptionMode !== 'waitlist') {
      const nearest = findNearestOpenWorkingDay(getLocalTodayStr());
      if (nearest) {
        if (nearest.dateStr !== date) setDate(nearest.dateStr);
        if (timeSlot !== nearest.firstSlot) setTimeSlot(nearest.firstSlot);
      } else {
        setIsFlexibleBarberTime(true);
        setTimeOptionMode('flexible');
        setTimeSlot('FLEXIBLE');
      }
    }
  }, [
    date,
    selectedBarber.id,
    dayAvailability.isSalonClosedDay,
    dayAvailability.isBarberOffDay,
    dayAvailability.availableSlots.join(','),
    timeSlot,
    isFlexibleBarberTime,
    showManualDateTime,
    timeOptionMode,
    barberSchedules,
    liveBookings,
    totalSelectedMinutes,
  ]);

  // Clear service error automatically when at least one service is picked
  useEffect(() => {
    if (effectiveSelectedCount > 0 && fieldErrors.services) {
      setFieldErrors((prev) => ({ ...prev, services: undefined }));
    }
  }, [effectiveSelectedCount]);

  // Real-time CRM recognition & outstanding credit check across ALL barbers for entered client phone
  const cleanDigits = normalizeMoroccanPhoneDigits(clientPhone);
  const outstandingPhoneCredit = React.useMemo(
    () =>
      cleanDigits.length >= 6
        ? computeOutstandingCreditsForPhone(
            clientPhone,
            caisseEntries,
            manualCredits,
            barberRoster
          )
        : null,
    [cleanDigits, clientPhone, caisseEntries, manualCredits, barberRoster]
  );

  useEffect(() => {
    setCreditDisputeOpen(false);
  }, [cleanDigits]);

  const handleSubmitCreditDispute = async () => {
    if (!outstandingPhoneCredit?.hasCredit) return;
    const msg = creditDisputeText.trim();
    if (!msg) {
      showToast(
        pickLang(lang, {
          ar: 'اكتب توضيحك أو سؤالك حول الكريدي أولاً',
          fr: 'Veuillez saisir votre remarque ou question d’abord',
          amz: 'ⴰⵔⴰ ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ ⵜⴰⵣⵡⴰⵔⴰ',
          en: 'Please enter your question or objection first',
          es: 'Escribe tu consulta u objeción primero',
        }),
        '',
        'warning'
      );
      return;
    }
    const creditorSummary =
      outstandingPhoneCredit.creditorBreakdowns
        .map((c) => `${c.creditorLabel} (${c.amountMAD} MAD)`)
        .join(' · ') || 'صالون بومليك';
    const primaryBarberCreditor = outstandingPhoneCredit.creditorBreakdowns.find(
      (c) => c.barberId && c.barberId !== 'hassan'
    )?.barberId;

    setCreditDisputeBusy(true);
    try {
      await submitClientCreditDispute({
        clientName:
          clientName.trim() ||
          recognizedClient?.clientName ||
          outstandingPhoneCredit.matchedClientNames[0] ||
          'زبون',
        clientPhone: clientPhone.trim() || recognizedClient?.clientPhone || cleanDigits,
        totalOwedSnapshotMAD: outstandingPhoneCredit.totalOwedMAD,
        creditorSummary,
        message: msg,
        targetBarberId: primaryBarberCreditor,
      });
      setCreditDisputeSentForPhone(cleanDigits);
      setCreditDisputeText('');
      setCreditDisputeOpen(false);
      showToast(
        pickLang(lang, {
          ar: 'تم إرسال اعتراضك / استفسارك بنجاح ✓',
          fr: 'Votre demande a été envoyée ✓',
          amz: 'ⵜⵜⵓⵣⵏ ⵜⴱⵔⴰⵜ ⵏⵏⴽ ✓',
          en: 'Your credit inquiry was sent ✓',
          es: 'Tu consulta fue enviada ✓',
        }),
        pickLang(lang, {
          ar: 'يمكنك إكمال الحجز بشكل عادي الآن.',
          fr: 'Vous pouvez poursuivre votre réservation normalement.',
          amz: 'ⵜⵣⵎⵔⴷ ⴰⴷ ⵜⴽⵎⵎⵍⴷ ⴰⵙⵉⵀⴰⵔ ⵏⵏⴽ.',
          en: 'You may continue completing your booking normally.',
          es: 'Puedes continuar tu reserva con normalidad.',
        }),
        'success'
      );
    } catch (err) {
      console.error('Failed to submit credit dispute:', err);
    } finally {
      setCreditDisputeBusy(false);
    }
  };

  const renderClientCreditAlertCard = (compactMode = false) => {
    if (!outstandingPhoneCredit?.hasCredit) return null;
    const isSentForThisPhone = creditDisputeSentForPhone === cleanDigits;
    return (
      <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-300 dark:border-orange-500/50 text-orange-900 dark:text-orange-200 text-xs space-y-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black">
                  {pickLang(lang, {
                    ar: `تنبيه كريدي مسجل على هذا الرقم (${outstandingPhoneCredit.totalOwedMAD} MAD)`,
                    fr: `Crédit / reste impayé détecté sur ce numéro (${outstandingPhoneCredit.totalOwedMAD} MAD)`,
                    amz: `ⵜⴰⵎⴰⵜⴰⵔⵜ ⵏ ⵓⴽⵔⵉⴷⵉ ⴰⵇⴱⵓⵔ (${outstandingPhoneCredit.totalOwedMAD} MAD)`,
                    en: `Outstanding Credit Alert on This Phone (${outstandingPhoneCredit.totalOwedMAD} MAD)`,
                    es: `Alerta de crédito pendiente en este número (${outstandingPhoneCredit.totalOwedMAD} MAD)`,
                  })}
                </span>
                {outstandingPhoneCredit.nearestCreditDate && (
                  <span
                    dir="ltr"
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/85 dark:bg-black/45 border border-orange-200 dark:border-orange-500/40 text-[10px] font-mono font-bold text-orange-800 dark:text-orange-200"
                  >
                    📅 {outstandingPhoneCredit.nearestCreditDate}
                  </span>
                )}
              </div>
              {!compactMode && (
                <p className="text-[11px] font-medium opacity-90">
                  {pickLang(lang, {
                    ar: 'هذا الرصيد مرتبط برقم هاتفك في الصالون ويظهر مع جميع الحلاقين. يمكنك إتمام حجزك بشكل عادي وتسوية الباقي عند حضورك.',
                    fr: 'Ce solde est lié à votre numéro au salon quel que soit le barbier choisi. Vous pouvez confirmer votre RDV normalement et régler sur place.',
                    amz: 'ⴰⴽⵔⵉⴷⵉ ⴰⴷ ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵉ ⵓⵟⵟⵓⵏ ⵏⵏⴽ ⴳ ⵓⵙⴰⵍⵓⵏ ⵎⴰⵕⵕⴰ. ⵜⵣⵎⵔⴷ ⴰⴷ ⵜⵙⵏⵜⵎⴷ ⴰⵙⵉⵀⴰⵔ ⵏⵏⴽ.',
                    en: 'This balance is tied to your phone across the salon regardless of which barber you choose. You may still complete your booking normally.',
                    es: 'Este saldo está vinculado a tu teléfono en todo el salón independientemente del barbero elegido. Puedes continuar tu reserva.',
                  })}
                </p>
              )}

              {/* Creditor Breakdown: WHO is owed (Strictly no client aliases or staff notes exposed) */}
              {outstandingPhoneCredit.creditorBreakdowns.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-black text-orange-800 dark:text-orange-300">
                    {pickLang(lang, {
                      ar: 'الجهة المستحقة:',
                      fr: 'Dû à :',
                      amz: 'ⵉⵜⵜⵓⴼⴽⴰ ⵉ:',
                      en: 'Owed to:',
                      es: 'Adeudado a:',
                    })}
                  </span>
                  {outstandingPhoneCredit.creditorBreakdowns.map((cred) => (
                    <span
                      key={cred.creditorKey}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/90 dark:bg-black/50 border border-orange-200 dark:border-orange-500/40 text-[11px] font-bold text-orange-900 dark:text-orange-100"
                    >
                      <span>{cred.creditorLabel}</span>
                      <span dir="ltr" className="font-mono font-black text-orange-700 dark:text-orange-300">
                        ({cred.amountMAD} MAD)
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-orange-600 text-white font-mono font-black text-xs shrink-0">
            {outstandingPhoneCredit.totalOwedMAD} MAD
          </span>
        </div>

        {/* Non-blocking Credit Dispute / Inquiry Action */}
        <div className="pt-2 border-t border-orange-200/80 dark:border-orange-500/30 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {isSentForThisPhone ? (
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>
                  {pickLang(lang, {
                    ar: 'تم إرسال استفسارك/اعتراضك للإدارة والحلاق لمراجعته ✓',
                    fr: 'Votre réclamation/question a été transmise à l’équipe ✓',
                    amz: 'ⵜⵜⵓⵣⵏ ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ ✓',
                    en: 'Inquiry sent to salon management for review ✓',
                    es: 'Tu consulta ha sido enviada al salón ✓',
                  })}
                </span>
              </span>
            ) : (
              <span className="text-[10px] text-orange-800/85 dark:text-orange-200/80 font-medium">
                {pickLang(lang, {
                  ar: 'تظن أن هناك خطأ أو سبق لك الأداء؟',
                  fr: 'Une erreur ou déjà réglé ?',
                  amz: 'ⵉⵙ ⵜⵓⵖⴰⵍⴷ ⵉⵍⵍⴰ ⵓⵣⴳⴰⵍ ?',
                  en: 'Think this is a mistake or already paid?',
                  es: '¿Crees que hay un error o ya pagaste?',
                })}
              </span>
            )}

            <button
              type="button"
              onClick={() => setCreditDisputeOpen((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-orange-300 dark:border-orange-500/50 text-orange-800 dark:text-orange-200 font-bold text-[11px] hover:bg-orange-100 dark:hover:bg-orange-950/60 transition-colors cursor-pointer"
            >
              {creditDisputeOpen
                ? pickLang(lang, {
                    ar: 'إغلاق',
                    fr: 'Fermer',
                    amz: 'ⵇⵇⵏ',
                    en: 'Close',
                    es: 'Cerrar',
                  })
                : pickLang(lang, {
                    ar: 'اعتراض أو استفسار على الكريدي',
                    fr: 'Contester ou poser une question',
                    amz: 'ⴰⵙⵙⵓⵎⵔ ⵏⵖ ⴰⵙⵇⵙⵉ ⵖⴼ ⵓⴽⵔⵉⴷⵉ',
                    en: 'Dispute or Inquire About Credit',
                    es: 'Impugnar o consultar crédito',
                  })}
            </button>
          </div>

          {creditDisputeOpen && (
            <div className="p-2.5 rounded-lg bg-white/95 dark:bg-zinc-950/90 border border-orange-200 dark:border-zinc-800 space-y-2">
              <textarea
                rows={2}
                value={creditDisputeText}
                onChange={(e) => setCreditDisputeText(e.target.value)}
                placeholder={pickLang(lang, {
                  ar: 'اشرح بإيجاز (مثال: سبق لي أن خلصت هذا المبلغ للحلاق، أو أريد توضيحاً حول المبلغ)...',
                  fr: 'Expliquez brièvement (ex: déjà réglé au barbier, ou demande de précision)...',
                  amz: 'ⵙⵙⴼⵔⵓ ⵙ ⵓⴳⵣⵣⵓⵍ...',
                  en: 'Briefly explain (e.g., already paid to the barber, or request clarification)...',
                  es: 'Explica brevemente (ej. ya pagado al barbero o solicitud de aclaración)...',
                })}
                className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={creditDisputeBusy}
                  onClick={handleSubmitCreditDispute}
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-black text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <span>
                    {creditDisputeBusy
                      ? '...'
                      : pickLang(lang, {
                          ar: 'إرسال الاستفسار بدون تعطيل الحجز',
                          fr: 'Envoyer sans bloquer le RDV',
                          amz: 'ⴰⵣⵏ ⵜⴰⵏⵏⴰⵢⵜ',
                          en: 'Send Inquiry (Keep Booking)',
                          es: 'Enviar sin bloquear la cita',
                        })}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  const crmProfile = cleanDigits.length >= 6 ? crmClientsMap[getCrmDocId(clientPhone)] : undefined;
  const clientBookingsForPhone =
    cleanDigits.length >= 6
      ? liveBookings.filter((b) => normalizeMoroccanPhoneDigits(b.clientPhone) === cleanDigits)
      : [];
  const pastVisitsCount =
    cleanDigits.length >= 6 ? getVerifiedVisitsCount(clientBookingsForPhone, crmProfile) : 0;
  const pointsSummary =
    cleanDigits.length >= 6 ? computeClientPointsSummary(pastVisitsCount, crmProfile) : null;
  const isClientBanned = Boolean(crmProfile?.isBanned);
  const nextVisitNumber = pastVisitsCount + 1;
  const isFreeWashEligible =
    cleanDigits.length >= 6 &&
    pastVisitsCount > 0 &&
    Math.floor(pastVisitsCount / 5) > (crmProfile?.freeWashesRedeemed ?? 0);

  // Anti-spam active upcoming bookings cap (max 2 per device/IP/client unless Master Admin bypass)
  const todayLocalStr = getLocalTodayStr();
  const activeClientUpcomingBookings = React.useMemo(
    () =>
      allowAdminBypass
        ? []
        : getClientActiveUpcomingBookings({
            bookings: liveBookings,
            todayStr: todayLocalStr,
            deviceFingerprint,
            clientIpHash,
            clientPhone,
          }),
    [allowAdminBypass, liveBookings, todayLocalStr, deviceFingerprint, clientIpHash, clientPhone]
  );
  const hasReachedBookingCap =
    !allowAdminBypass && activeClientUpcomingBookings.length >= MAX_ACTIVE_BOOKINGS_PER_CLIENT;

  // Live queue waiting visibility for today
  const selectedBarberTodayWaitingCount = React.useMemo(
    () => getLiveQueueBookings(liveBookings, todayLocalStr, 'master', 'all', selectedBarber.id).length,
    [liveBookings, todayLocalStr, selectedBarber.id]
  );
  const salonTodayWaitingCount = React.useMemo(
    () => getLiveQueueBookings(liveBookings, todayLocalStr, 'master', 'all', 'all').length,
    [liveBookings, todayLocalStr]
  );

  // Most recent non-cancelled booking for 1-tap Quick Rebook ("عاود نفس الحلاقة / نفس الحلاق")
  const lastRebookableBooking = React.useMemo(() => {
    const pool =
      recognizedClient?.pastBookings && recognizedClient.pastBookings.length > 0
        ? recognizedClient.pastBookings
        : clientBookingsForPhone;
    if (!pool || pool.length === 0) return null;
    const sorted = [...pool].sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
    return (
      sorted.find((b) => b.status !== 'cancelled' && b.status !== 'rejected') || sorted[0]
    );
  }, [recognizedClient, clientBookingsForPhone]);

  const handleQuickRebook = (sourceBooking: AppointmentBooking) => {
    const targetBarber =
      mergedTeam.find((b) => b.id === sourceBooking.barberId) || selectedBarber;
    onSelectBarberId(targetBarber.id);

    const targetProfile = barberProfiles[targetBarber.id as CaisseBarberId];
    const targetHiddenIds = getEffectiveHiddenServiceIds(shopPricingConfig, targetProfile);
    const selectableForTarget = getBarberSelectableServices(
      targetBarber.id as CaisseBarberId,
      barberProfiles,
      shopPricingConfig,
      date
    );

    const rawPrevIds = Array.from(
      new Set(
        (sourceBooking.cartItemsSummary || [])
          .map((item) => item.serviceId)
          .filter(Boolean)
      )
    );

    const nextBaseIds = rawPrevIds.filter(
      (id) => BASE_SERVICES.some((s) => s.id === id) && !targetHiddenIds.includes(id)
    );
    const nextExtraIds = rawPrevIds.filter((id) =>
      selectableForTarget.some(
        (s) => !BASE_SERVICES.some((b) => b.id === s.id) && s.id === id
      )
    );

    // Ensure at least one visible service is picked if previous booking only had legacy/hidden IDs
    const fallbackBaseId =
      nextBaseIds.length === 0 && nextExtraIds.length === 0
        ? getVisibleBaseServices(shopPricingConfig, targetProfile)[0]?.id
        : undefined;
    const finalBaseIds = fallbackBaseId ? [fallbackBaseId] : nextBaseIds;

    if (onSetServiceIds) {
      onSetServiceIds(finalBaseIds);
    } else {
      selectedServiceIds.forEach((id) => {
        if (!finalBaseIds.includes(id)) onToggleServiceId(id);
      });
      finalBaseIds.forEach((id) => {
        if (!selectedServiceIds.includes(id)) onToggleServiceId(id);
      });
    }

    setCustomSelectedByBarber((prev) => ({
      ...prev,
      [targetBarber.id]: nextExtraIds,
    }));
    setFieldErrors((prev) => ({ ...prev, services: undefined }));

    if (sourceBooking.clientName && !clientName.trim()) {
      setClientName(sourceBooking.clientName);
    }
    if (sourceBooking.clientPhone && !clientPhone.trim()) {
      setClientPhone(sourceBooking.clientPhone);
    }

    const targetBarberName = targetBarber.name[lang] || targetBarber.name.ar;
    showToast(
      pickLang(lang, {
        ar: 'تم اختيار نفس الحلاقة والحلاق ✓',
        fr: 'Même coupe & barbier sélectionnés ✓',
        amz: 'ⵉⵜⵜⵓⵙⵜⵉ ⵓⵎⴽⵕⴰⴹ ⴷ ⵜⵡⵓⵔⵉ ✓',
        en: 'Same haircut & barber selected ✓',
        es: 'Mismo corte y barbero seleccionados ✓',
      }),
      pickLang(lang, {
        ar: `${targetBarberName} — اختر الآن اليوم والساعة المناسبة`,
        fr: `${targetBarberName} — choisissez maintenant le jour et l’heure`,
        amz: `${targetBarberName} — ⴼⵔⵏ ⴰⵙⴰⴽⵓⴷ ⴷ ⵓⴽⵓⴷ`,
        en: `${targetBarberName} — now pick your date & time`,
        es: `${targetBarberName} — ahora elige día y hora`,
      }),
      'success'
    );

    const hasValidName = Boolean(
      (sourceBooking.clientName && sourceBooking.clientName.trim()) || clientName.trim()
    );
    const digitsAfter = (sourceBooking.clientPhone || clientPhone).replace(/\D/g, '');
    const targetStep = hasValidName && digitsAfter.length >= 9 ? 4 : 3;

    setStepDirection('next');
    setCurrentStep(targetStep);
    scrollToWizardTop();
  };

  const renderBookingCapBanner = () => {
    if (!hasReachedBookingCap) return null;
    const ticketsList = activeClientUpcomingBookings.map((b) => b.ticketNumber).join(' • ');
    return (
      <div
        role="alert"
        className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/45 border border-rose-300 dark:border-rose-500/45 text-rose-900 dark:text-rose-200 text-xs space-y-2.5"
      >
        <div className="flex items-start gap-2.5">
          <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <div className="font-black">
              {pickLang(lang, {
                ar: `عذراً، لديك حالياً ${activeClientUpcomingBookings.length} مواعيد نشطة (الحد الأقصى ${MAX_ACTIVE_BOOKINGS_PER_CLIENT} مواعيد في نفس الوقت)`,
                fr: `Limite atteinte : vous avez déjà ${activeClientUpcomingBookings.length} rendez-vous actifs (max ${MAX_ACTIVE_BOOKINGS_PER_CLIENT} à la fois)`,
                amz: `ⵜⵍⴽⵎⴷ ⴰⵡⵜⵜⵓ: ⵜⵍⴰⴷ ${activeClientUpcomingBookings.length} ⵉⵙⵉⵀⴰⵔⵏ ⵉⵕⵥⵎⵏ (ⴰⵡⵜⵜⵓ ${MAX_ACTIVE_BOOKINGS_PER_CLIENT})`,
                en: `Booking limit reached: you already have ${activeClientUpcomingBookings.length} active upcoming bookings (max ${MAX_ACTIVE_BOOKINGS_PER_CLIENT} at once)`,
                es: `Límite alcanzado: ya tienes ${activeClientUpcomingBookings.length} reservas activas (máximo ${MAX_ACTIVE_BOOKINGS_PER_CLIENT} a la vez)`,
              })}
            </div>
            <p className="text-[11px] font-medium opacity-90 leading-relaxed">
              {pickLang(lang, {
                ar: 'لتفادي الحجوزات المكررة وضمان المواعيد للجميع، يمكنك إتمام موعدك الحالي أو إلغاء أحد المواعيد السابقة من صفحة التتبع قبل حجز موعد جديد.',
                fr: 'Pour éviter les doublons, veuillez honorer ou annuler l’une de vos réservations actives avant d’en créer une nouvelle.',
                amz: 'ⴰⴼⴰⴷ ⴰⴷ ⵓⵔ ⵉⵍⵉⵏ ⵉⵙⵉⵀⴰⵔⵏ ⵉⵜⵜⵓⵄⴰⵡⴷⵏ, ⴽⵎⵎⵍ ⵏⵖ ⵙⵔ ⵢⴰⵏ ⵓⵙⵉⵀⴰⵔ.',
                en: 'To prevent duplicate bookings, please complete or cancel an existing active appointment in Ticket Tracking before booking another.',
                es: 'Para evitar reservas duplicadas, completa o cancela una reserva activa antes de crear otra.',
              })}
            </p>
            {ticketsList && (
              <div className="text-[11px] font-mono font-bold text-rose-800 dark:text-rose-300" dir="ltr">
                {ticketsList}
              </div>
            )}
          </div>
        </div>
        {onOpenTrackBooking && (
          <button
            type="button"
            onClick={() =>
              onOpenTrackBooking(
                activeClientUpcomingBookings[0]?.ticketNumber || clientPhone || ''
              )
            }
            className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'فتح التتبع لمراجعة أو إلغاء موعد حالي',
                fr: 'Ouvrir le suivi pour gérer / annuler un RDV',
                amz: 'ⵕⵥⵎ ⴰⴹⴼⴰⵕ ⵉ ⵓⵙⵡⵓⴷⴷⵓ ⵏ ⵓⵙⵉⵀⴰⵔ',
                en: 'Open Ticket Tracking to Review or Cancel',
                es: 'Abrir Seguimiento para Revisar o Cancelar',
              })}
            </span>
          </button>
        )}
      </div>
    );
  };

  // Generate Unique Check-In QR Code whenever createdBooking changes
  useEffect(() => {
    if (createdBooking) {
      const qrPayload = buildBookingCheckInQrPayload({
        ticketNumber: createdBooking.ticketNumber,
        checkInToken: createdBooking.checkInToken,
        clientPhone: createdBooking.clientPhone,
      });
      QRCode.toDataURL(qrPayload, {
        width: 220,
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

  // Calculate total with priority queue (+10 MAD only if enabled by salon/barber and toggled ON) and CRM custom discount
  const effectiveWaitingSkip = isNoWaitOptionEnabled && includeWaitingSkip;
  const waitingSkipFee = effectiveWaitingSkip ? 10 : 0;
  const crmCustomDiscount = crmProfile?.customDiscountMAD ? Math.min(effectiveServicesFinalTotal, crmProfile.customDiscountMAD) : 0;
  const grandTotal = Math.max(0, effectiveServicesFinalTotal + waitingSkipFee - crmCustomDiscount);

  const scrollToWizardTop = () => {
    setTimeout(() => {
      bookingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  };

  const handlePickDayBeforeLowerPrice = () => {
    const compareTargetIds =
      selectedServiceIds.filter((id) => !effectiveHiddenServiceIds.includes(id)).length > 0
        ? selectedServiceIds
        : resolvedEffectivePricing.specialRuleAffectedServiceIds.length > 0
        ? resolvedEffectivePricing.specialRuleAffectedServiceIds
        : ['haircut'];

    const currentRefCart = calculateCartPricing({
      selectedIds: compareTargetIds,
      colorConfig,
      proteinPrice,
      lang,
      effectiveServicePrices: resolvedEffectivePricing.priceMap,
      specialRuleLabel: resolvedEffectivePricing.activeSpecialRuleLabels[0],
      hiddenServiceIds: effectiveHiddenServiceIds,
      serviceBundles: effectiveBundles,
    });
    const currentCompareTotal = currentRefCart.finalTotal;

    const parsed = date.split('-').map(Number);
    if (parsed.length !== 3 || parsed.some((n) => !Number.isFinite(n))) return;
    const cursor = new Date(parsed[0], parsed[1] - 1, parsed[2], 12, 0, 0);

    let foundDay: { dateStr: string; totalMAD: number } | null = null;
    for (let i = 1; i <= 45; i++) {
      cursor.setDate(cursor.getDate() - 1);
      const candStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (candStr < todayLocalStr) break;

      const candAvail = evaluateBarberDayAvailability(
        selectedBarber.id,
        candStr,
        barberSchedules,
        liveBookings,
        totalSelectedMinutes
      );
      if (candAvail.isSalonClosedDay || candAvail.isBarberOffDay || candAvail.availableSlots.length === 0) {
        continue;
      }

      const candPricing = resolveEffectiveServicePrices({
        dateStr: candStr,
        shopConfig: shopPricingConfig,
        barberProfile: selectedBarberProfile,
      });
      const candCart = calculateCartPricing({
        selectedIds: compareTargetIds,
        colorConfig,
        proteinPrice,
        lang,
        effectiveServicePrices: candPricing.priceMap,
        specialRuleLabel: candPricing.activeSpecialRuleLabels[0],
        hiddenServiceIds: effectiveHiddenServiceIds,
        serviceBundles: effectiveBundles,
      });

      if (candCart.finalTotal < currentCompareTotal) {
        foundDay = { dateStr: candStr, totalMAD: candCart.finalTotal };
        break;
      }
    }

    if (foundDay) {
      setDate(foundDay.dateStr);
      setInspectedBusySlot(null);
      setFieldErrors((prev) => ({ ...prev, date: undefined, timeSlot: undefined }));
      if (currentStep !== 4) {
        setStepDirection('prev');
        setCurrentStep(4);
      }
      showToast(
        pickLang(lang, {
          ar: `تم اختيار يوم ${foundDay.dateStr} بثمن أقل (${foundDay.totalMAD} MAD) ✓`,
          fr: `Jour moins cher sélectionné : ${foundDay.dateStr} (${foundDay.totalMAD} MAD) ✓`,
          amz: `ⵉⵜⵜⵓⵙⵜⵉ ⵡⴰⵙⵙ ⵙ ⵡⴰⵜⵉⴳ ⵉⴷⵔⵓⵙⵏ : ${foundDay.dateStr} (${foundDay.totalMAD} MAD) ✓`,
          en: `Switched to earlier lower-price day: ${foundDay.dateStr} (${foundDay.totalMAD} MAD) ✓`,
          es: `Día anterior con menor precio seleccionado: ${foundDay.dateStr} (${foundDay.totalMAD} MAD) ✓`,
        }),
        '',
        'success'
      );
    } else {
      showToast(
        pickLang(lang, {
          ar: 'لا يوجد يوم سابق متاح بثمن أقل قبل هذا التاريخ',
          fr: 'Aucun jour antérieur disponible à tarif réduit avant cette date',
          amz: 'ⵓⵔ ⵉⵍⵍⵉ ⵡⴰⵙⵙ ⴷⴰⵜ ⵙ ⵡⴰⵜⵉⴳ ⵉⴷⵔⵓⵙⵏ',
          en: 'No earlier open day with a lower price found before this date',
          es: 'No hay ningún día anterior abierto con menor precio antes de esta fecha',
        }),
        pickLang(lang, {
          ar: 'يمكنك اختيار يوم آخر بعد هذه المناسبة من التقويم.',
          fr: 'Vous pouvez choisir un autre jour après cette période.',
          amz: 'ⵜⵣⵎⵔⴷ ⴰⴷ ⵜⴼⵔⵏⴷ ⴰⵙⵙ ⵢⴰⴹⵏ.',
          en: 'You can choose another day after this occasion on the calendar.',
          es: 'Puedes elegir otro día después de esta fecha.',
        }),
        'warning'
      );
    }
  };

  const handleChooseAnotherDay = () => {
    setShowManualDateTime(true);
    if (currentStep !== 4) {
      setStepDirection('prev');
      setCurrentStep(4);
    }
    setTimeout(() => {
      dateInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      dateInputRef.current?.focus();
    }, 120);
  };

  const renderSpecialRulePricingNotice = (showSubtotal = false) => {
    if (resolvedEffectivePricing.activeSpecialRuleLabels.length === 0) return null;
    return (
      <div className="p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-500/10 border border-amber-300/80 dark:border-amber-500/35 space-y-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <div className="font-black text-amber-900 dark:text-amber-200">
                {pickLang(lang, {
                  ar: `تنبيه تسعيرة خاصة / العيد (${date}): ${resolvedEffectivePricing.activeSpecialRuleLabels.join(' • ')}`,
                  fr: `Tarif spécial / Aïd (${date}) : ${resolvedEffectivePricing.activeSpecialRuleLabels.join(' • ')}`,
                  amz: `ⴰⵜⵉⴳ ⵓⵣⵍⵉⴳ (${date}) : ${resolvedEffectivePricing.activeSpecialRuleLabels.join(' • ')}`,
                  en: `Special / Eid Day Pricing (${date}): ${resolvedEffectivePricing.activeSpecialRuleLabels.join(' • ')}`,
                  es: `Tarifa Especial / Eid (${date}): ${resolvedEffectivePricing.activeSpecialRuleLabels.join(' • ')}`,
                })}
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80 font-medium leading-snug">
                {pickLang(lang, {
                  ar: 'الأثمنة المعروضة في هذا اليوم تخضع لتعريفة المناسبة. يمكنك الحجز قبل هذه الفترة بثمن أقل أو اختيار يوم آخر.',
                  fr: 'Les tarifs de cette journée suivent le barème spécial. Vous pouvez choisir un jour avant à tarif réduit ou changer de date.',
                  amz: 'ⴰⵜⵉⴳ ⵏ ⵡⴰⵙⵙ ⴰⴷ ⵉⵥⵍⵉ ⵉ ⵜⵎⵖⵔⴰ. ⵜⵣⵎⵔⴷ ⴰⴷ ⵜⴼⵔⵏⴷ ⴰⵙⵙ ⴷⴰⵜ ⵙ ⵡⴰⵜⵉⴳ ⵉⴷⵔⵓⵙⵏ.',
                  en: 'Prices on this date follow occasion rates. You can pick an earlier lower-price day or choose another date.',
                  es: 'Los precios de este día siguen la tarifa de ocasión. Puedes elegir un día anterior más económico u otra fecha.',
                })}
              </p>
            </div>
          </div>
          {showSubtotal && (
            <span className="font-mono font-black text-amber-700 dark:text-amber-300 tabular-nums shrink-0">
              {effectiveServicesFinalTotal} MAD
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePickDayBeforeLowerPrice}
            className="min-h-[34px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'اختر يوم قبل الثمن أقل',
                fr: 'Jour avant (moins cher)',
                amz: 'ⴰⵙⵙ ⴷⴰⵜ ⵙ ⵡⴰⵜⵉⴳ ⵉⴷⵔⵓⵙⵏ',
                en: 'Pick earlier day (lower price)',
                es: 'Día anterior (menor precio)',
              })}
            </span>
          </button>

          <button
            type="button"
            onClick={handleChooseAnotherDay}
            className="min-h-[34px] px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-stone-100 dark:hover:bg-zinc-800 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'اختر يوماً آخر',
                fr: 'Choisir un autre jour',
                amz: 'ⴼⵔⵏ ⴰⵙⵙ ⵢⴰⴹⵏ',
                en: 'Choose another day',
                es: 'Elegir otro día',
              })}
            </span>
          </button>
        </div>
      </div>
    );
  };

  const validateClientInfoStep = () => {
    const errors: { clientName?: string; clientPhone?: string } = {};

    if (!clientName.trim()) {
      errors.clientName = pickLang(lang, {
        ar: 'يرجى إدخال اسمك الكريم',
        fr: 'Veuillez saisir votre nom complet.',
        amz: 'ⵙⵙⴽⵛⵎ ⵉⵙⵎ ⵏⵏⴽ ⵉⵖⵓⴷⴰⵏ',
        en: 'Please enter your full name.',
        es: 'Por favor ingresa tu nombre completo.',
      });
    }

    const digits = clientPhone.replace(/\D/g, '');
    if (isClientBanned && !allowAdminBypass) {
      errors.clientPhone = pickLang(lang, {
        ar: `عذراً، هذا الرقم محظور حالياً من الحجز عبر الإنترنت. يرجى الاتصال بالإدارة (${liveSalonDisplayPhone}).`,
        fr: `Ce numéro est temporairement restreint. Veuillez contacter le salon au ${liveSalonDisplayPhone}.`,
        amz: `ⵓⵟⵟⵓⵏ ⴰⴷ ⵉⵜⵜⵓⴳⴷⵍ ⵖⵉⵍⴰ. ⵏⵢⴰⵍⴽⴰⵎ ⴷ ⵓⵙⴰⵍⵓⵏ ${liveSalonDisplayPhone}.`,
        en: `This phone number is temporarily restricted. Please contact ${liveSalonDisplayPhone}.`,
        es: `Este teléfono está restringido temporalmente. Contacta al ${liveSalonDisplayPhone}.`,
      });
    } else if (digits.length < 9) {
      errors.clientPhone = pickLang(lang, {
        ar: 'يرجى إدخال رقم هاتف مغربي صحيح (مثال: 06...)',
        fr: 'Numéro de téléphone marocain valide requis (ex: 06...)',
        amz: 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⵉⵖⵓⴷⴰⵏ',
        en: 'Valid Moroccan phone number required (e.g. 06...)',
        es: 'Se requiere un número de teléfono válido (ej: 06...)',
      });
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
      return false;
    }

    setFieldErrors((prev) => ({ ...prev, clientName: undefined, clientPhone: undefined }));
    return true;
  };

  const validateServicesStep = () => {
    if (effectiveSelectedCount === 0) {
      const msg = pickLang(lang, {
        ar: 'يرجى اختيار خدمة واحدة على الأقل للمتابعة',
        fr: 'Veuillez sélectionner au moins une prestation pour continuer.',
        amz: 'ⴼⵔⵏ ⵎⵇⵇⴰⵔ ⴷ ⵢⴰⵜ ⵜⵡⵓⵔⵉ',
        en: 'Please select at least one service to continue.',
        es: 'Por favor selecciona al menos un servicio.',
      });
      setFieldErrors((prev) => ({ ...prev, services: msg }));
      servicesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    setFieldErrors((prev) => ({ ...prev, services: undefined }));
    return true;
  };

  const validateDateTimeStep = () => {
    const errors: { date?: string; timeSlot?: string } = {};

    if (dayAvailability.isSalonClosedDay) {
      errors.date = pickLang(lang, {
        ar: 'الصالون مغلق يوم الإثنين (العطلة الأسبوعية). يرجى اختيار يوم آخر.',
        fr: 'Le salon est fermé le lundi (jour de repos). Veuillez choisir un autre jour.',
        amz: 'ⴰⵙⴰⵍⵓⵏ ⵉⵇⵇⵏ ⴰⵙⵙ ⵏ ⵓⵢⵏⴰⵙ. ⴼⵔⵏ ⴰⵙⵙ ⵢⴰⴹⵏ.',
        en: 'The salon is closed on Monday. Please choose another date.',
        es: 'El salón cierra los lunes. Por favor elige otro día.',
      });
    } else if (timeOptionMode === 'waitlist') {
      errors.timeSlot = pickLang(lang, {
        ar: 'اختر "أختار وقتي المتاح" أو "دع الحلاق يختار لك الوقت" لإتمام الحجز، أو أكمل التسجيل في قائمة الانتظار.',
        fr: 'Choisissez un créneau ou « Laisser le barbier choisir » pour continuer, ou inscrivez-vous sur la liste d’attente.',
        amz: 'ⴼⵔⵏ ⴰⴽⵓⴷ ⵏⵖ "ⴰⴷ ⵉⴼⵔⵏ ⵓⵎⵥⵥⴰⵡ ⴰⴽⵓⴷ" ⴰⴼⴰⴷ ⴰⴷ ⵜⴽⵎⵎⵍⴷ.',
        en: 'Pick a time slot or "Let barber choose" to continue, or finish joining the waitlist.',
        es: 'Elige un horario o "Deja que el barbero elija" para continuar, o únete a la lista de espera.',
      });
    } else if (!isFlexibleBarberTime) {
      if (dayAvailability.isBarberOffDay || dayAvailability.availableSlots.length === 0) {
        errors.timeSlot = pickLang(lang, {
          ar: 'جميع المواعيد ممتلئة أو الحلاق في عطلة لهذا اليوم. اختر حلاقاً متاحاً أو فعّل خيار «دع الحلاق يختار لي الوقت المناسب».',
          fr: 'Aucun créneau disponible pour ce barbier à cette date. Choisissez un autre barbier ou activez « Laisser le barbier choisir ».',
          amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⴽⵓⴷⵏ ⵉⵕⵥⵎⵏ ⴰⵙⵙ ⴰⴷ. ⴼⵔⵏ ⴰⵎⵥⵥⴰⵡ ⵢⴰⴹⵏ ⵏⵖ ⴰⴽⵓⴷ ⴰⵍⵡⵡⴰⵖ.',
          en: 'No available slots for this barber on this date. Pick another barber or enable "Let the barber choose a suitable time".',
          es: 'Sin horarios disponibles para este barbero en esta fecha. Elige otro barbero o activa el horario flexible.',
        });
      } else if (!dayAvailability.availableSlots.includes(timeSlot)) {
        errors.timeSlot = pickLang(lang, {
          ar: 'الساعة المختارة غير متاحة أو محجوزة بالفعل. يرجى اختيار ساعة متاحة أو تفعيل الاختيار المرن للحلاق.',
          fr: 'Ce créneau horaire n’est plus disponible. Sélectionnez une heure libre ou laissez le barbier choisir.',
          amz: 'ⵜⵉⵣⵉ ⴰⴷ ⵜⴻⵜⵜⵓⵃⵣⴰ ⵢⴰⴷ. ⴼⵔⵏ ⵜⵉⵣⵉ ⵢⴰⴹⵏ ⵏⵖ ⴰⴽⵓⴷ ⴰⵍⵡⵡⴰⵖ.',
          en: 'Selected time slot is unavailable. Pick an open slot or let the barber choose.',
          es: 'La hora seleccionada no está disponible. Elige otra o deja elegir al barbero.',
        });
      }
    }

    if (errors.date || errors.timeSlot) {
      setShowManualDateTime(true);
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      setTimeout(() => {
        if (errors.date) {
          dateInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          dateInputRef.current?.focus();
        } else if (errors.timeSlot) {
          timeSlotSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 90);
      return false;
    }

    setFieldErrors((prev) => ({ ...prev, date: undefined, timeSlot: undefined }));
    return true;
  };

  const handleGoToStep = (targetStep: 1 | 2 | 3 | 4 | 5 | 6) => {
    if (targetStep === currentStep) return;
    if (targetStep < currentStep) {
      setStepDirection('prev');
      setCurrentStep(targetStep);
      scrollToWizardTop();
      return;
    }
    if (targetStep >= 4 && !validateClientInfoStep()) {
      setStepDirection('next');
      setCurrentStep(3);
      return;
    }
    if (targetStep >= 5 && !validateDateTimeStep()) {
      setStepDirection('next');
      setCurrentStep(4);
      return;
    }
    if (targetStep >= 6 && !validateServicesStep()) {
      setStepDirection('next');
      setCurrentStep(5);
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
      setStepDirection('next');
      setCurrentStep(3);
      scrollToWizardTop();
    } else if (currentStep === 3) {
      if (validateClientInfoStep()) {
        setStepDirection('next');
        setCurrentStep(4);
        scrollToWizardTop();
      }
    } else if (currentStep === 4) {
      if (validateDateTimeStep()) {
        setStepDirection('next');
        setCurrentStep(5);
        scrollToWizardTop();
      }
    } else if (currentStep === 5) {
      if (validateServicesStep()) {
        setStepDirection('next');
        setCurrentStep(6);
        scrollToWizardTop();
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setStepDirection('prev');
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5 | 6);
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
          ? pickLang(lang, {
              ar: 'اليوم',
              fr: 'Aujourd’hui',
              amz: 'ⴰⵙⵙ ⴰ',
              en: 'Today',
              es: 'Hoy',
            })
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

  const validateForm = () => {
    const errors: {
      services?: string;
      date?: string;
      timeSlot?: string;
      clientName?: string;
      clientPhone?: string;
    } = {};

    if (effectiveSelectedCount === 0) {
      errors.services = pickLang(lang, {
        ar: 'يرجى اختيار خدمة واحدة على الأقل',
        fr: 'Veuillez sélectionner au moins une prestation.',
        amz: 'ⴼⵔⵏ ⵎⵇⵇⴰⵔ ⴷ ⵢⴰⵜ ⵜⵡⵓⵔⵉ',
        en: 'Please select at least one service.',
        es: 'Por favor selecciona al menos un servicio.',
      });
    }

    if (dayAvailability.isSalonClosedDay) {
      errors.date = pickLang(lang, {
        ar: 'الصالون مغلق يوم الإثنين (العطلة الأسبوعية). يرجى اختيار يوم آخر.',
        fr: 'Le salon est fermé le lundi (jour de repos). Veuillez choisir un autre jour.',
        amz: 'ⴰⵙⴰⵍⵓⵏ ⵉⵇⵇⵏ ⴰⵙⵙ ⵏ ⵓⵢⵏⴰⵙ. ⴼⵔⵏ ⴰⵙⵙ ⵢⴰⴹⵏ.',
        en: 'The salon is closed on Monday. Please choose another date.',
        es: 'El salón cierra los lunes. Por favor elige otro día.',
      });
    } else if (!isFlexibleBarberTime) {
      if (dayAvailability.isBarberOffDay || dayAvailability.availableSlots.length === 0) {
        errors.timeSlot = pickLang(lang, {
          ar: 'جميع المواعيد ممتلئة أو الحلاق في عطلة لهذا اليوم. اختر حلاقاً آخر أو فعّل الاختيار المرن للحلاق.',
          fr: 'Aucun créneau disponible pour ce barbier à cette date. Changez de barbier ou laissez le barbier choisir.',
          amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⴽⵓⴷⵏ ⵉⵕⵥⵎⵏ ⴰⵙⵙ ⴰⴷ. ⴼⵔⵏ ⴰⵎⵥⵥⴰⵡ ⵢⴰⴹⵏ ⵏⵖ ⴰⴽⵓⴷ ⴰⵍⵡⵡⴰⵖ.',
          en: 'No available slots for this barber on this date. Switch barber or let the barber choose.',
          es: 'Sin horarios disponibles para este barbero. Cambia de barbero o elige horario flexible.',
        });
      } else if (!dayAvailability.availableSlots.includes(timeSlot)) {
        errors.timeSlot = pickLang(lang, {
          ar: 'الساعة المختارة غير متاحة أو محجوزة بالفعل. يرجى اختيار ساعة أخرى أو تفعيل الاختيار المرن.',
          fr: 'Ce créneau horaire n’est plus disponible. Sélectionnez une heure libre ou laissez le barbier choisir.',
          amz: 'ⵜⵉⵣⵉ ⴰⴷ ⵜⴻⵜⵜⵓⵃⵣⴰ ⵢⴰⴷ. ⴼⵔⵏ ⵜⵉⵣⵉ ⵢⴰⴹⵏ ⵏⵖ ⴰⴽⵓⴷ ⴰⵍⵡⵡⴰⵖ.',
          en: 'Selected time slot is unavailable. Please pick an open slot or let the barber choose.',
          es: 'Esta hora no está disponible. Elige otra o deja elegir al barbero.',
        });
      }
    }

    if (!clientName.trim()) {
      errors.clientName = pickLang(lang, {
        ar: 'يرجى إدخال اسمك الكريم',
        fr: 'Veuillez saisir votre nom complet.',
        amz: 'ⵙⵙⴽⵛⵎ ⵉⵙⵎ ⵏⵏⴽ ⵉⵖⵓⴷⴰⵏ',
        en: 'Please enter your full name.',
        es: 'Por favor ingresa tu nombre completo.',
      });
    }

    const digits = clientPhone.replace(/\D/g, '');
    if (isClientBanned && !allowAdminBypass) {
      errors.clientPhone = pickLang(lang, {
        ar: `عذراً، هذا الرقم محظور حالياً من الحجز عبر الإنترنت. يرجى الاتصال بالإدارة (${liveSalonDisplayPhone}).`,
        fr: `Ce numéro est temporairement restreint. Veuillez contacter le salon au ${liveSalonDisplayPhone}.`,
        amz: `ⵓⵟⵟⵓⵏ ⴰⴷ ⵉⵜⵜⵓⴳⴷⵍ ⵖⵉⵍⴰ. ⵏⵢⴰⵍⴽⴰⵎ ⴷ ⵓⵙⴰⵍⵓⵏ ${liveSalonDisplayPhone}.`,
        en: `This phone number is temporarily restricted. Please contact ${liveSalonDisplayPhone}.`,
        es: `Este teléfono está restringido temporalmente. Contacta al ${liveSalonDisplayPhone}.`,
      });
    } else if (digits.length < 9) {
      errors.clientPhone = pickLang(lang, {
        ar: 'يرجى إدخال رقم هاتف مغربي صحيح (مثال: 06...)',
        fr: 'Numéro de téléphone marocain valide requis (ex: 06...)',
        amz: 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⵉⵖⵓⴷⴰⵏ',
        en: 'Valid Moroccan phone number required (e.g. 06...)',
        es: 'Se requiere un número de teléfono válido (ej: 06...)',
      });
    }

    setFieldErrors(errors);

    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      if (errors.clientName) {
        setCurrentStep(3);
        setTimeout(() => {
          nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          nameInputRef.current?.focus();
        }, 50);
      } else if (errors.clientPhone) {
        setCurrentStep(3);
        setTimeout(() => {
          phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          phoneInputRef.current?.focus();
        }, 50);
      } else if (errors.date) {
        setShowManualDateTime(true);
        setCurrentStep(4);
        setTimeout(() => {
          dateInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          dateInputRef.current?.focus();
        }, 90);
      } else if (errors.timeSlot) {
        setShowManualDateTime(true);
        setCurrentStep(4);
        setTimeout(() => timeSlotSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 90);
      } else if (errors.services) {
        setCurrentStep(5);
        setTimeout(() => servicesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
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

    if (!allowAdminBypass) {
      const latestBookings = liveBookings.length >= getAllBookings().length ? liveBookings : getAllBookings();
      const currentActive = getClientActiveUpcomingBookings({
        bookings: latestBookings,
        todayStr: getLocalTodayStr(),
        deviceFingerprint,
        clientIpHash,
        clientPhone,
      });
      if (currentActive.length >= MAX_ACTIVE_BOOKINGS_PER_CLIENT) {
        setFieldErrors((prev) => ({
          ...prev,
          submit: pickLang(lang, {
            ar: `عذراً، لا يمكن حجز أكثر من موعدين نشطين في نفس الوقت (${currentActive.map((b) => b.ticketNumber).join(' • ')}). يرجى إلغاء موعد حالي أولاً أو انتظار موعدك.`,
            fr: `Maximum ${MAX_ACTIVE_BOOKINGS_PER_CLIENT} rendez-vous actifs autorisés simultanément (${currentActive.map((b) => b.ticketNumber).join(' • ')}).`,
            amz: `ⴰⵡⵜⵜⵓ: 2 ⵉⵙⵉⵀⴰⵔⵏ ⵉⵕⵥⵎⵏ (${currentActive.map((b) => b.ticketNumber).join(' • ')}).`,
            en: `Limit of ${MAX_ACTIVE_BOOKINGS_PER_CLIENT} active upcoming bookings reached (${currentActive.map((b) => b.ticketNumber).join(' • ')}). Please cancel one first.`,
            es: `Límite de ${MAX_ACTIVE_BOOKINGS_PER_CLIENT} reservas activas alcanzado (${currentActive.map((b) => b.ticketNumber).join(' • ')}).`,
          }),
        }));
        return;
      }
    }

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const loyaltyTag = isFreeWashEligible
        ? pickLang(lang, {
            ar: `🎁 غسل شعر مجاني (الزيارة رقم ${nextVisitNumber})`,
            fr: `🎁 Shampoing offert (Visite #${nextVisitNumber})`,
            amz: `🎁 ⴰⵙⵉⵔⵉⴷ ⴼⴰⴱⵓⵔ (ⵜⵉⵔⵣⵉ #${nextVisitNumber})`,
            en: `🎁 Free Hair Wash (Visit #${nextVisitNumber})`,
            es: `🎁 Lavado gratis (Visita #${nextVisitNumber})`,
          })
        : crmCustomDiscount > 0
        ? pickLang(lang, {
            ar: `🎁 تخفيض ولاء (-${crmCustomDiscount} MAD)`,
            fr: `🎁 Remise fidélité (-${crmCustomDiscount} MAD)`,
            amz: `🎁 ⴰⵙⵙⵏⵇⵙ ⵏ ⵜⵖⵓⵏⵉ (-${crmCustomDiscount} MAD)`,
            en: `🎁 Loyalty Discount (-${crmCustomDiscount} MAD)`,
            es: `🎁 Descuento fidelidad (-${crmCustomDiscount} MAD)`,
          })
        : crmProfile?.isVip
        ? pickLang(lang, {
            ar: '⭐ عميل VIP',
            fr: '⭐ Client VIP',
            amz: '⭐ ⴰⵎⵙⴰⵖ VIP',
            en: '⭐ VIP Client',
            es: '⭐ Cliente VIP',
          })
        : undefined;

      const trimmedClientNotes = notes.trim().slice(0, 400);
      const effectiveTimeSlot = isFlexibleBarberTime ? 'FLEXIBLE' : timeSlot;
      const newBooking = await createNewBooking({
        services: [],
        cartItemsSummary: effectiveCartItems,
        barberId: selectedBarber.id,
        barberName: barberNameLocalized,
        barberColor: selectedBarber.themeColor || '#D97706',
        date,
        timeSlot: effectiveTimeSlot,
        isFlexibleTime: isFlexibleBarberTime,
        preferredTimeHint: isFlexibleBarberTime
          ? (inspectedBusySlot || undefined)
          : undefined,
        totalDurationMinutes: totalSelectedMinutes,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientLanguage: lang,
        clientNotes: trimmedClientNotes || undefined,
        notes: [
          trimmedClientNotes,
          isFlexibleBarberTime
            ? pickLang(lang, {
                ar: 'طلب وقت مرن (يختاره الحلاق)',
                fr: 'Horaire flexible (choisi par le barbier)',
                amz: 'ⴰⴽⵓⴷ ⴰⵍⵡⵡⴰⵖ (ⴰⴷ ⵉⴼⵔⵏ ⵓⵎⵥⵥⴰⵡ)',
                en: 'Flexible time requested (barber chooses)',
                es: 'Horario flexible (elige el barbero)',
              })
            : '',
          effectiveWaitingSkip
            ? pickLang(lang, {
                ar: 'دون الحاجة للانتظار (+10 دراهم)',
                fr: 'Sans attente / Coupe-File (+10 MAD)',
                amz: 'ⴱⵍⴰ ⵓⵇⵇⵍ (+10 MAD)',
                en: 'No Wait Priority (+10 MAD)',
                es: 'Sin Espera (+10 MAD)',
              })
            : '',
          loyaltyTag || '',
        ].filter(Boolean).join(' | '),
        originalTotalMAD: effectiveServicesOriginalSubtotal + waitingSkipFee,
        finalTotalMAD: grandTotal,
        totalSavingsMAD: effectiveTotalSavings + crmCustomDiscount,
        bookingMethod: 'site',
        status: isFlexibleBarberTime ? 'flexible_pending' : 'pending',
        cihReceiptName: cihReceiptName || undefined,
        cihReceiptPreview: cihReceiptPreview || undefined,
        cihReceiptUploadedAt: cihReceiptUploadedAt || undefined,
        loyaltyRewardApplied: loyaltyTag,
        deviceFingerprint: allowAdminBypass ? undefined : deviceFingerprint,
        clientIpHash: allowAdminBypass ? undefined : clientIpHash,
        isAdminWalkIn: allowAdminBypass ? true : undefined,
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

      if (crmCustomDiscount > 0) {
        consumeClientDiscountOnBooking(
          clientPhone.trim(),
          clientName.trim(),
          crmCustomDiscount,
          crmClientsMap
        ).catch((consumeErr) => console.warn('Discount consumption sync note:', consumeErr));
      }

      rememberTrackedTicket(newBooking.ticketNumber, newBooking.clientPhone);
      setCreatedBooking(newBooking);
      setNotes('');
      setCihReceiptName('');
      setCihReceiptPreview('');
      setCihReceiptUploadedAt('');
      setIsFlexibleBarberTime(true);
      setTimeOptionMode('flexible');
      setTimeSlot('FLEXIBLE');
      setShowManualDateTime(false);
      setWantCihOnlinePayment(false);
      setInspectedBusySlot(null);
      if (onBookingConfirmed) onBookingConfirmed(newBooking);

      // Explicit consent workflow: avoid unprompted permission calls or immediate notification spam
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          void registerClientPushSubscription({
            clientPhone: newBooking.clientPhone,
            clientName: newBooking.clientName,
            lang,
          }).then((res) => setNotifSubscribedForTicket(res.subscribed));
        } else if (Notification.permission === 'default') {
          setNotifSubscribedForTicket(false);
          setShowNotifConsentModal(true);
        } else {
          setNotifSubscribedForTicket(false);
        }
      }
    } catch (err) {
      console.error('Failed to save booking to Firestore:', err);
      setFieldErrors((prev) => ({
        ...prev,
        submit: pickLang(lang, {
          ar: 'تعذر تسجيل الحجز في السحابة حالياً. يرجى المحاولة مرة أخرى.',
          fr: 'Impossible d’enregistrer la réservation sur le serveur. Veuillez réessayer.',
          amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵣⵎⵎⴻⵎ ⴰⵙⵉⵀⵍ ⵖⵉⵍⴰ. ⴰⵔⵎ ⵜⵉⴽⴽⵍⵜ ⵢⴰⴹⵏ.',
          en: 'Unable to save booking to cloud right now. Please try again.',
          es: 'No se pudo guardar la reserva ahora. Inténtalo de nuevo.',
        }),
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
      errors.clientPhone = pickLang(lang, {
        ar: 'هذا الرقم محظور ولا يمكنه الانضمام لقائمة الانتظار.',
        fr: 'Numéro restreint.',
        amz: 'ⵓⵟⵟⵓⵏ ⴰⴷ ⵉⵜⵜⵓⴳⴷⵍ.',
        en: 'This phone number is restricted.',
        es: 'Número restringido.',
      });
    } else if (digits.length < 9) {
      errors.clientPhone = pickLang(lang, {
        ar: 'يرجى إدخال رقم هاتف صحيح للانضمام لقائمة الانتظار.',
        fr: 'Veuillez saisir votre numéro de téléphone valide.',
        amz: 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⵉⵖⵓⴷⴰⵏ.',
        en: 'Please enter a valid phone number to join the waitlist.',
        es: 'Por favor ingresa un teléfono válido.',
      });
    }

    if (!clientName.trim()) {
      errors.clientName = pickLang(lang, {
        ar: 'يرجى إدخال اسمك الكريم للانضمام لقائمة الانتظار.',
        fr: 'Veuillez saisir votre nom complet.',
        amz: 'ⵙⵙⴽⵛⵎ ⵉⵙⵎ ⵏⵏⴽ ⵉⵖⵓⴷⴰⵏ.',
        en: 'Please enter your full name to join the waitlist.',
        es: 'Por favor ingresa tu nombre completo.',
      });
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
      const anyTimeLabel = pickLang(lang, {
        ar: 'أي توقيت متاح في هذا اليوم',
        fr: 'N’importe quelle heure libre',
        amz: 'ⴽⵓ ⵜⵉⵣⵉ ⵉⵕⵥⵎⵏ',
        en: 'Any open time today',
        es: 'Cualquier hora libre ese día',
      });
      const defaultSrvLabel = pickLang(lang, {
        ar: 'حلاقة',
        fr: 'Coupe de cheveux',
        amz: 'ⵜⴰⴽⵔⴹⴰ ⵏ ⵓⵣⵣⴰⵔ',
        en: 'Haircut',
        es: 'Corte',
      });
      await addToWaitlist({
        barberId: selectedBarber.id,
        barberName: barberNameLocalized,
        date,
        preferredTime:
          waitlistPreferredTime && waitlistPreferredTime !== 'ANY'
            ? waitlistPreferredTime
            : timeSlot || anyTimeLabel,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        servicesSummary: effectiveCartItems.map((i) => i.name).join(', ') || defaultSrvLabel,
      });
      setWaitlistSuccess(true);
      setTimeout(() => setWaitlistSuccess(false), 6000);
    } catch (err) {
      console.error('Waitlist join error:', err);
      setFieldErrors((prev) => ({
        ...prev,
        submit: pickLang(lang, {
          ar: 'تعذر التسجيل في قائمة الانتظار حالياً.',
          fr: 'Erreur lors de l’inscription en liste d’attente.',
          amz: 'ⵜⵓⵛⵛⴹⴰ ⴳ ⵓⵣⵎⵎⴻⵎ ⵏ ⵓⵇⵇⵍ.',
          en: 'Unable to join the waitlist right now.',
          es: 'No se pudo unir a la lista de espera.',
        }),
      }));
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  const handleCopyTicket = (ticket: string) => {
    void safeCopyToClipboard(ticket);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
  };

  const handleCopyHolderName = () => {
    void safeCopyToClipboard(CIH_BANK_DETAILS.accountHolder);
    setCopiedHolderName(true);
    setTimeout(() => setCopiedHolderName(false), 2000);
  };

  const handleCopyAccountNumber = () => {
    void safeCopyToClipboard(CIH_BANK_DETAILS.accountNumber);
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
      ar: 'اختر الحلاق، أدخل معلوماتك، حدد اليوم والوقت ثم اختر الخدمات بالثمن المباشر لذلك اليوم.',
      fr: 'Choisissez le barbier, saisissez vos infos, la date/heure puis vos prestations au tarif du jour.',
      en: 'Pick your barber, enter your details, choose date & time, then view live service prices for that day.',
      amz: 'ⴼⵔⵏ ⴰⵎⴽⵔⴰⴹ, ⵙⵙⴽⵛⵎ ⵉⵏⵖⵎⵉⵙⵏ ⵏⵏⴽ, ⴰⵙⴰⴽⵓⴷ ⴷ ⵜⵡⵓⵔⵉⵡⵉⵏ.',
      es: 'Elige barbero, ingresa tus datos, fecha/hora y revisa los precios del día.',
    }[lang] || 'اختر الحلاق ومعلوماتك والتاريخ ثم الخدمات',
    waitingTitle: {
      ar: 'دون الحاجة للانتظار (+10 درهم)',
      fr: 'Sans attente / Coupe-File (+10 MAD)',
      en: 'No Wait Priority (+10 MAD)',
      amz: 'ⴱⵍⴰ ⵓⵇⵇⵍ (+10 ⴷⵔⵀⵎ)',
      es: 'Sin Espera (+10 MAD)',
    }[lang] || 'دون الحاجة للانتظار (+10 درهم)',
    step1: {
      ar: '1. حالة الزبون',
      fr: '1. Statut Client',
      en: '1. Client Status',
      amz: '1. ⴰⴷⴷⴰⴷ ⵏ ⵓⵎⵙⴰⵖ',
      es: '1. Estado Cliente',
    }[lang] || '1. حالة الزبون',
    step2: {
      ar: '2. اختر الحلاق المفضل *',
      fr: '2. Choisissez votre barbier favori *',
      en: '2. Choose your preferred barber *',
      amz: '2. ⴼⵔⵏ ⴰⵎⴽⵔⴰⴹ ⵏⵏⴽ ⵉⵥⵍⵉⵏ *',
      es: '2. Elige tu barbero preferido *',
    }[lang] || '2. اختر الحلاق المفضل *',
    step3: {
      ar: '3. معلوماتك وملاحظات الحلاقة *',
      fr: '3. Vos coordonnées & préférences *',
      en: '3. Your Info & Grooming Notes *',
      amz: '3. ⵉⵏⵖⵎⵉⵙⵏ ⵏⵏⴽ *',
      es: '3. Tus datos y notas *',
    }[lang] || '3. معلوماتك',
    step4: {
      ar: '4. تاريخ الموعد والتوقيت الذكي',
      fr: '4. Date & créneau horaire intelligent',
      en: '4. Smart Date & Time Slot',
      amz: '4. ⴰⵙⴰⴽⵓⴷ ⴷ ⵓⴽⵓⴷ',
      es: '4. Fecha y hora inteligente',
    }[lang] || '4. تاريخ الموعد',
    step5Services: {
      ar: `5. اختر الخدمات والباقات (${effectiveSelectedCount})`,
      fr: `5. Prestations & tarifs du ${date} (${effectiveSelectedCount})`,
      en: `5. Services & Live Prices for ${date} (${effectiveSelectedCount})`,
      amz: `5. ⵜⵉⵡⵓⵔⵉⵡⵉⵏ (${effectiveSelectedCount})`,
      es: `5. Servicios y tarifas (${effectiveSelectedCount})`,
    }[lang] || '5. اختر الخدمات',
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
    ? (mergedTeam.find((b) => b.id === createdBooking.barberId) || mergedTeam[0])
    : selectedBarber;

  const chosenBarberPhone = createdBarber.phone || salonSettings.salonPhone || '0635392503';
  const chosenBarberWa = createdBarber.whatsappNumber || liveSalonWhatsappDigits;
  const activeBarberColor = createdBarber.themeColor || '#D97706';

  const wizardSteps = [
    {
      step: 1 as const,
      label:
        lang === 'ar'
          ? 'الحالة'
          : lang === 'en'
          ? 'Status'
          : lang === 'amz'
          ? 'ⴰⴷⴷⴰⴷ'
          : lang === 'es'
          ? 'Estado'
          : 'Profil',
    },
    {
      step: 2 as const,
      label:
        lang === 'ar'
          ? 'الحلاق'
          : lang === 'en'
          ? 'Barber'
          : lang === 'amz'
          ? 'ⴰⵎⴽⵔⴰⴹ'
          : lang === 'es'
          ? 'Barbero'
          : 'Barbier',
    },
    {
      step: 3 as const,
      label:
        lang === 'ar'
          ? 'معلوماتك'
          : lang === 'en'
          ? 'Info'
          : lang === 'amz'
          ? 'ⵉⵏⵖⵎⵉⵙⵏ'
          : lang === 'es'
          ? 'Datos'
          : 'Infos',
    },
    {
      step: 4 as const,
      label:
        lang === 'ar'
          ? 'الوقت'
          : lang === 'en'
          ? 'Time'
          : lang === 'amz'
          ? 'ⴰⴽⵓⴷ'
          : lang === 'es'
          ? 'Hora'
          : 'Horaire',
    },
    {
      step: 5 as const,
      label:
        lang === 'ar'
          ? 'الخدمات'
          : lang === 'en'
          ? 'Services'
          : lang === 'amz'
          ? 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ'
          : lang === 'es'
          ? 'Servicios'
          : 'Services',
    },
    {
      step: 6 as const,
      label:
        lang === 'ar'
          ? 'التأكيد'
          : lang === 'en'
          ? 'Confirm'
          : lang === 'amz'
          ? 'ⴰⵙⵙⴷⵓ'
          : lang === 'es'
          ? 'Confirmar'
          : 'Confirmer',
    },
  ];

  const activeStepMeta = wizardSteps.find((s) => s.step === currentStep) || wizardSteps[0];
  const wizardProgressPercent = Math.round((currentStep / wizardSteps.length) * 100);

  const createdTicketHasQueueSkip = Boolean(
    createdBooking &&
      (/تفادي الانتظار|Coupe-File|Queue Avoidance/i.test(createdBooking.notes || '') ||
        (() => {
          if (!createdBooking) return false;
          const baseSum = (createdBooking.cartItemsSummary || []).reduce((acc, item) => acc + (item.finalPrice || 0), 0);
          return baseSum > 0 && (createdBooking.originalTotalMAD ?? 0) - baseSum >= 10;
        })())
  );

  const handleRedeemPointsTier = async (tier: { id: string; pointsCost: number; discountMAD: number }) => {
    const phoneToUse = clientPhone.trim() || recognizedClient?.clientPhone || '';
    const nameToUse = clientName.trim() || recognizedClient?.clientName || crmProfile?.clientName || 'Client';
    if (!phoneToUse) return;
    setRedeemingPointsTierId(tier.id);
    try {
      const saved = await redeemLoyaltyPointsForDiscount({
        phone: phoneToUse,
        clientName: nameToUse,
        pointsCost: tier.pointsCost,
        discountMAD: tier.discountMAD,
        verifiedVisits: Math.max(pastVisitsCount, recognizedClient?.verifiedVisits ?? 0),
        crmMap: crmClientsMap,
      });
      if (recognizedClient) {
        setRecognizedClient((prev) =>
          prev
            ? {
                ...prev,
                loyaltyPoints: saved.loyaltyPoints ?? Math.max(0, prev.loyaltyPoints - tier.pointsCost),
                customDiscountMAD: saved.customDiscountMAD ?? prev.customDiscountMAD + tier.discountMAD,
              }
            : null
        );
      }
      sendDualAlert(
        pickLang(lang, {
          ar: `تم تفعيل خصم -${tier.discountMAD} MAD بنجاح!`,
          fr: `Remise -${tier.discountMAD} MAD activée !`,
          amz: `ⴰⵙⵙⵏⵇⵙ -${tier.discountMAD} MAD ⵉⵕⵥⵎ!`,
          en: `-${tier.discountMAD} MAD discount activated!`,
          es: `¡Descuento de -${tier.discountMAD} MAD activado!`,
        }),
        {
          body: pickLang(lang, {
            ar: 'تم خصم المبلغ تلقائياً من مجموع هذا الطلب.',
            fr: 'La remise a été déduite automatiquement de votre total.',
            amz: 'ⵉⵜⵜⵓⵙⵏⵇⵙ ⵓⵎⵉⴹⴰⵏ ⵙⴳ ⵓⵖⵔⵓⴷ.',
            en: 'Discount automatically deducted from this booking total.',
            es: 'Descuento aplicado automáticamente a tu total.',
          }),
          type: 'success',
          skipSound: true,
        }
      );
    } finally {
      setRedeemingPointsTierId(null);
    }
  };

  const handleClientRecognized = (profile: RecognizedClientData) => {
    setRecognizedClient(profile);
    setClientMode('returning');
    setClientName(profile.clientName);
    setClientPhone(profile.clientPhone);
    if (profile.clientEmail) {
      setClientEmail(profile.clientEmail);
    }
    if (profile.preferredBarberId && mergedTeam.some((b) => b.id === profile.preferredBarberId)) {
      onSelectBarberId(profile.preferredBarberId);
    }
    if (onClientIdentified && profile.clientPhone) {
      onClientIdentified(profile.clientPhone);
    }
    setFieldErrors((prev) => ({ ...prev, clientName: undefined, clientPhone: undefined }));
  };

  const handleSelectFirstTime = () => {
    setClientMode('first_time');
    setRecognizedClient(null);
    setShowRecognizedHistory(false);
    setStepDirection('next');
    setCurrentStep(2);
    scrollToWizardTop();
  };

  const displayTimeSlotLabel =
    isFlexibleBarberTime || timeSlot === 'FLEXIBLE'
      ? pickLang(lang, {
          ar: 'يُحدَّد بعد التأكيد (طابور ذكي)',
          fr: 'À attribuer (File intelligente)',
          amz: 'ⴰⴷ ⵉⵜⵜⵓⵙⵜⵉ ⴷⴼⴼⵉⵔ ⵓⵙⵏⵜⵎ',
          en: 'Assigned upon confirmation',
          es: 'Asignado al confirmar',
        })
      : timeSlot;

  const stickyNavClass = isEmbeddedModal
    ? 'sticky bottom-0 z-30 p-2 rounded-2xl bg-white dark:bg-[#0D0F14] border border-stone-200 dark:border-zinc-800 shadow-lg grid grid-cols-3 gap-2.5'
    : 'sticky bottom-[76px] sm:bottom-3 z-30 p-2 rounded-2xl bg-white dark:bg-[#0D0F14] border border-zinc-200 dark:border-zinc-800 shadow-lg grid grid-cols-3 gap-2.5';

  const stepOffsetX = stepDirection === 'next' ? (isRtl ? -14 : 14) : isRtl ? 14 : -14;

  return (
    <section
      id="booking"
      className={
        isEmbeddedModal
          ? 'py-3 bg-transparent text-zinc-900 dark:text-white relative'
          : 'py-8 sm:py-14 bg-white dark:bg-[#090A0E] text-zinc-900 dark:text-white relative border-b border-zinc-200 dark:border-zinc-800'
      }
    >
      {/* Ambient background glows (inline mode only) */}
      {!isEmbeddedModal && (
        <>
          <div className="absolute top-1/4 right-1/4 w-[350px] sm:w-[450px] h-[300px] bg-amber-500/[0.04] blur-[140px] rounded-full pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/4 w-[350px] sm:w-[450px] h-[300px] bg-stone-400/[0.05] blur-[140px] rounded-full pointer-events-none" />
        </>
      )}

      {/* Mobile-First Container */}
      <div
        ref={bookingCardRef}
        className={isEmbeddedModal ? 'w-full relative z-10' : 'max-w-md sm:max-w-2xl mx-auto px-4 relative z-10'}
      >
        {/* Main Wizard Card Shell */}
        <div
          className={
            isEmbeddedModal
              ? 'bg-transparent p-0.5 space-y-3'
              : 'rounded-3xl bg-white dark:bg-[#0D0F14] border border-zinc-200 dark:border-amber-500/30 p-5 sm:p-7 shadow-xl space-y-5'
          }
        >
          {/* Header (Shown only in inline page mode; modal header already displays title) */}
          {!isEmbeddedModal && (
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold">
                <Ticket className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>
                  {pickLang(lang, {
                    ar: 'حجز فوري ومباشر • صالون بومليك',
                    fr: 'Réservation Directe Sans Inscription',
                    amz: 'ⴰⵙⵔⵓⵙ ⵓⵙⵔⵉⴷ • Salon Boumlik',
                    en: 'Instant Direct Booking • Salon Boumlik',
                    es: 'Reserva Directa Sin Registro',
                  })}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight font-display">
                {ui.title}
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                {ui.subtitle}
              </p>
            </div>
          )}

          {/* 6-Step Visual Progress Bar & Interactive Stepper */}
          <div className="space-y-2.5" role="region" aria-label="Booking Progress">
            {/* Numeric Progress Header + Full-Width Bar */}
            <div className="space-y-1 px-0.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-zinc-700 dark:text-zinc-200">
                  {pickLang(lang, {
                    ar: `الخطوة ${currentStep} من 6 — ${activeStepMeta.label}`,
                    fr: `Étape ${currentStep} sur 6 — ${activeStepMeta.label}`,
                    amz: `ⴰⵙⵓⵔⵉⴼ ${currentStep} ⵙⴳ 6 — ${activeStepMeta.label}`,
                    en: `Step ${currentStep} of 6 — ${activeStepMeta.label}`,
                    es: `Paso ${currentStep} de 6 — ${activeStepMeta.label}`,
                  })}
                </span>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {wizardProgressPercent}%
                </span>
              </div>
              <div
                className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-zinc-800 overflow-hidden"
                role="progressbar"
                aria-valuenow={wizardProgressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${wizardProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="relative flex items-center justify-between">
              {/* Stepper Node Connector Track */}
              <div className="absolute top-3.5 inset-x-4 sm:inset-x-6 h-0.5 bg-stone-200 dark:bg-zinc-800 rounded-full overflow-hidden flex justify-start">
                <div
                  className="h-full bg-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
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
                    aria-current={isActive ? 'step' : undefined}
                    className="relative z-10 flex flex-col items-center gap-1 group cursor-pointer focus:outline-none min-w-[44px] sm:min-w-[54px] min-h-[44px]"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black font-mono transition-all duration-200 border ${
                        isActive
                          ? 'bg-amber-500 border-amber-400 text-black scale-105 shadow-sm shadow-amber-500/25'
                          : isDone
                          ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300'
                          : 'bg-stone-100 dark:bg-[#12141B] border-stone-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 group-hover:border-amber-500/50'
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : item.step}
                    </div>
                    <span
                      className={`text-[9.5px] sm:text-[10px] font-bold transition-colors whitespace-nowrap ${
                        isActive
                          ? 'text-amber-600 dark:text-amber-400'
                          : isDone
                          ? 'text-zinc-700 dark:text-zinc-300'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Compact Live Selection Summary Strip */}
            {currentStep >= 2 && (
              <div className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#12141B] border border-stone-200 dark:border-zinc-800/90 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="inline-flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                    <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    <span className="truncate">{barberNameLocalized}</span>
                  </span>

                  {currentStep >= 4 && clientName.trim() && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span className="text-zinc-700 dark:text-zinc-300 font-semibold truncate max-w-[110px]">
                        {clientName.trim()}
                      </span>
                    </>
                  )}

                  {currentStep >= 4 && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold" dir="ltr">
                        {date.slice(5)} {displayTimeSlotLabel}
                      </span>
                    </>
                  )}

                  {currentStep >= 5 && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                        {effectiveSelectedCount > 0
                          ? `${effectiveSelectedCount} ${pickLang(lang, {
                              ar: 'خدمة',
                              fr: 'srv.',
                              amz: 'ⵜⴰⵡⵓⵔⵉ',
                              en: 'srv.',
                              es: 'serv.',
                            })} (~${totalSelectedMinutes} min)`
                          : pickLang(lang, {
                              ar: 'لم تُحدد الخدمات بعد',
                              fr: 'Aucune prestation',
                              amz: 'ⵓⵔ ⵜⵜⵓⴼⵔⵉⵏⵜ ⵜⵡⵓⵔⵉⵡⵉⵏ',
                              en: 'No service selected',
                              es: 'Sin servicios',
                            })}
                      </span>
                    </>
                  )}
                </div>

                {currentStep >= 5 && (
                  <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400 tabular-nums">
                    {grandTotal} MAD
                  </span>
                )}
              </div>
            )}
          </div>

          <MotionConfig reducedMotion="user">
            <AnimatePresence mode="wait" initial={false}>
              {/* ========================================================= */}
              {/* STEP 1: THE GATEWAY / CLIENT STATUS ONLY                  */}
              {/* ========================================================= */}
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: stepOffsetX }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -stepOffsetX }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-3 pt-0.5"
                >
                  <div className="pt-1 space-y-3.5">
                    {renderBookingCapBanner()}

                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/12 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                        <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white leading-snug">
                          {pickLang(lang, {
                            ar: 'واش هادي أول مرة كتحجز عندنا؟',
                            fr: 'Est-ce votre première réservation chez nous ?',
                            amz: 'ⵉⵙ ⵜⴳⴰ ⵜⵉⴽⴽⵍⵜ ⵜⴰⵎⵣⵡⴰⵔⵓⵜ ⵏⵏⴽ ⴷⴰ ?',
                            en: 'Is this your first time booking with us?',
                            es: '¿Es tu primera vez reservando con nosotros?',
                          })}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
                          {pickLang(lang, {
                            ar: 'اختر باش تكمل مباشرة أو تسترجع بياناتك ونقاط الولاء بسرعة.',
                            fr: 'Commencez rapidement ou retrouvez vos infos et points de fidélité.',
                            amz: 'ⵙⵙⵏⵜⵉ ⵙ ⵜⵣⵣⵉⴳⵣⵜ ⵏⵖ ⵔⴰⵔⴷ ⵉⵙⵎ ⵏⵏⴽ ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ.',
                            en: 'Start a quick booking or restore your saved details & loyalty points.',
                            es: 'Comienza rápido o recupera tus datos y puntos de fidelidad.',
                          })}
                        </p>
                      </div>
                    </div>

                {/* Two Touch-Friendly Gateway Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleSelectFirstTime}
                    className={`min-h-[48px] py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] ${
                      clientMode === 'first_time' && !recognizedClient
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white shadow-sm'
                        : 'bg-white dark:bg-black/40 text-zinc-800 dark:text-zinc-200 border-stone-200 dark:border-zinc-700 hover:border-amber-500/60'
                    }`}
                  >
                    <UserPlus className="w-4 h-4 flex-shrink-0 text-amber-500" />
                    <span>
                      {pickLang(lang, {
                        ar: 'أول مرة',
                        fr: 'Première fois',
                        amz: 'ⵜⵉⴽⴽⵍⵜ ⵜⴰⵎⵣⵡⴰⵔⵓⵜ',
                        en: 'First Time',
                        es: 'Primera vez',
                      })}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsReturningLookupOpen(true)}
                    className={`min-h-[48px] py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] ${
                      recognizedClient
                        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500 shadow-sm'
                        : 'bg-amber-500 hover:bg-amber-400 text-black border-amber-400 shadow-sm shadow-amber-500/20'
                    }`}
                  >
                    <QrCode className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {pickLang(lang, {
                        ar: 'سبق ليا حجزت / استرجاع البيانات',
                        fr: 'Déjà venu / Récupérer mes infos',
                        amz: 'ⵔⵣⵉⵖ ⵢⴰⴷ / ⵔⴰⵔⴷ ⵉⵙⵎ ⵉⵏⵓ',
                        en: 'Booked Before / Restore Details',
                        es: 'Ya reservé / Recuperar mis datos',
                      })}
                    </span>
                  </button>
                </div>

                {/* Returning Customer Loyalty Progress & Next Free Haircut Card */}
                {recognizedClient && (
                  <div className="space-y-3 pt-1">
                    <ReturningLoyaltyStatusCard
                      clientName={recognizedClient.clientName}
                      clientPhone={recognizedClient.clientPhone}
                      verifiedVisits={recognizedClient.verifiedVisits}
                      crmProfile={crmProfile}
                      loyaltyProgress={computeLoyaltyProgress(recognizedClient.verifiedVisits, lang)}
                      pointsSummary={computeClientPointsSummary(recognizedClient.verifiedVisits, crmProfile)}
                      isVip={recognizedClient.isVip}
                      customDiscountMAD={recognizedClient.customDiscountMAD}
                      lang={lang}
                      redeemingTierId={redeemingPointsTierId}
                      onRedeemTier={handleRedeemPointsTier}
                    />

                    {renderClientCreditAlertCard(true)}

                    {/* Preferred Barber + Past History Quick Controls */}
                    {(recognizedClient.preferredBarberId || recognizedClient.pastBookings.length > 0) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        {recognizedClient.preferredBarberId && (
                          <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                            <SparklesIcon className="w-3.5 h-3.5 text-amber-500" />
                            <span>
                              {pickLang(lang, {
                                ar: 'حلاقك المعتاد:',
                                fr: 'Barbier habituel :',
                                amz: 'ⴰⵎⵥⵥⴰⵡ ⵏⵏⴽ:',
                                en: 'Usual barber:',
                                es: 'Barbero habitual:',
                              })}{' '}
                              {(() => {
                                const m = mergedTeam.find((tm) => tm.id === recognizedClient.preferredBarberId);
                                return m ? m.name[lang] || m.name.ar : '';
                              })()}
                            </span>
                          </span>
                        )}

                        {recognizedClient.pastBookings.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowRecognizedHistory((prev) => !prev)}
                            className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer min-h-[36px]"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>
                              {pickLang(lang, {
                                ar: `سجل زياراتك السابقة (${recognizedClient.pastBookings.length})`,
                                fr: `Historique (${recognizedClient.pastBookings.length})`,
                                amz: `ⴰⵎⵣⵔⵓⵢ (${recognizedClient.pastBookings.length})`,
                                en: `Past visits (${recognizedClient.pastBookings.length})`,
                                es: `Historial (${recognizedClient.pastBookings.length})`,
                              })}
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    <AnimatePresence initial={false}>
                      {showRecognizedHistory && recognizedClient.pastBookings.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-1.5 max-h-32 overflow-y-auto px-1">
                            {recognizedClient.pastBookings.slice(0, 4).map((pb) => (
                              <div
                                key={pb.id}
                                className="px-2.5 py-2 rounded-xl bg-white dark:bg-black/40 border border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-[11px]"
                              >
                                <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate">
                                  {pb.ticketNumber} · {pb.barberName}
                                </span>
                                <span className="font-mono text-zinc-500 dark:text-zinc-400 flex-shrink-0" dir="ltr">
                                  {pb.date} ·{' '}
                                  {pb.timeSlot === 'FLEXIBLE'
                                    ? pickLang(lang, {
                                        ar: 'مرن',
                                        fr: 'Flex',
                                        amz: 'ⴰⵍⵡⵡⴰⵖ',
                                        en: 'Flex',
                                        es: 'Flex',
                                      })
                                    : pb.timeSlot}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 1-Tap Quick Rebook ("عاود نفس الحلاقة / نفس الحلاق") + Continue CTA */}
                    <div className="space-y-2">
                      {lastRebookableBooking && (
                        <button
                          type="button"
                          onClick={() => handleQuickRebook(lastRebookableBooking)}
                          className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center justify-between gap-2 shadow-sm active:scale-[0.99] transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <RotateCcw className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">
                              {pickLang(lang, {
                                ar: 'عاود نفس الحلاقة / نفس الحلاق',
                                fr: 'Refaire la même coupe & barbier',
                                amz: 'ⵄⴰⵡⴷ ⵜⴰⴽⵔⴹⴰ ⴷ ⵓⵎⴽⵕⴰⴹ',
                                en: 'Repeat Last Haircut & Barber',
                                es: 'Repetir mismo corte y barbero',
                              })}
                            </span>
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-black/20 text-[10px] font-bold truncate max-w-[140px] flex-shrink-0">
                            {lastRebookableBooking.barberName}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="w-full min-h-[48px] py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <span>
                          {pickLang(lang, {
                            ar: 'متابعة لاختيار الحلاق',
                            fr: 'Continuer : Choisir le Barbier',
                            amz: 'ⴽⵎⵎⵍ ⵖⵔ ⵓⵎⴽⵕⴰⴹ',
                            en: 'Continue to Choose Barber',
                            es: 'Continuar: Elegir Barbero',
                          })}
                        </span>
                        {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {!recognizedClient && (
                  <div className="text-center pt-0.5">
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 underline underline-offset-4 cursor-pointer min-h-[36px] px-3"
                    >
                      {pickLang(lang, {
                        ar: 'تخطي والمتابعة مباشرة لاختيار الحلاق',
                        fr: 'Passer et choisir directement le barbier',
                        amz: 'ⵣⵔⵉ ⴷ ⴼⵔⵏ ⴰⵎⵥⵥⴰⵡ ⵙ ⵓⵙⵔⵉⴷ',
                        en: 'Skip and choose barber directly',
                        es: 'Omitir y elegir barbero directamente',
                      })}
                    </button>
                  </div>
                )}
                  </div>
                </motion.div>
              )}

              {/* ========================================================= */}
              {/* STEP 2: COMPACT BARBER SELECTION CARDS                    */}
              {/* ========================================================= */}
              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: stepOffsetX }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -stepOffsetX }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-3 pt-0.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-amber-500" />
                      <span>{ui.step2}</span>
                    </label>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                      <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>
                        {pickLang(lang, {
                          ar: `في الانتظار اليوم: ${salonTodayWaitingCount}`,
                          fr: `En attente aujourd’hui : ${salonTodayWaitingCount}`,
                          amz: `ⴳ ⵓⵔⴰⵊⵓ ⴰⵙⵙⴰ: ${salonTodayWaitingCount}`,
                          en: `Waiting today: ${salonTodayWaitingCount}`,
                          es: `En espera hoy: ${salonTodayWaitingCount}`,
                        })}
                      </span>
                    </span>
                  </div>

                  {/* 2x2 Grid of Barbers with Restrained Availability & Identity Tone */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {mergedTeam.map((barber) => {
                      const isSelected = selectedBarberId === barber.id;
                      const bName = barber.name[lang] || barber.name.ar;
                      const bSubtitle = barber.isOwner ? ui.roleOwner : null;
                      const ratingStats = computeBarberReviewStats(
                        barber.id,
                        firestoreReviews,
                        barber.rating
                      );
                      const bAvail = allBarbersAvailability[barber.id];
                      const openCount = bAvail?.availableSlots.length ?? 0;
                      const barberTone = getBarberIdentityTokens(barber.id, barber.name.ar, barber.colorName);

                      return (
                        <button
                          key={barber.id}
                          type="button"
                          onClick={() => onSelectBarberId(barber.id)}
                          className={`p-3 rounded-2xl border text-left rtl:text-right flex flex-col gap-2 transition-all cursor-pointer group relative overflow-hidden min-h-[108px] ${
                            isSelected
                              ? 'bg-amber-50/70 dark:bg-amber-500/10 border-2 border-amber-500 shadow-sm'
                              : 'bg-stone-50/70 dark:bg-[#12141B] border-stone-200 dark:border-zinc-800 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <img
                              src={barber.avatar}
                              alt={bName}
                              className={`w-10 h-10 rounded-full object-cover object-center bg-zinc-200 dark:bg-zinc-800 flex-shrink-0 ${
                                isSelected ? 'ring-2 ring-amber-500 ring-offset-1 dark:ring-offset-[#12141B]' : ''
                              }`}
                            />
                            <div className="flex flex-col items-end gap-1">
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-xs flex-shrink-0">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                              {!bAvail?.isSalonClosedDay && (
                                <span
                                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                    bAvail?.isBarberOffDay || openCount === 0
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      : 'bg-stone-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                                  }`}
                                >
                                  {bAvail?.isBarberOffDay
                                    ? (lang === 'ar' ? 'راحة' : lang === 'amz' ? 'ⴰⵙⵓⵏⴼⵓ' : 'OFF')
                                    : `${openCount} ${lang === 'ar' ? 'متاح' : lang === 'amz' ? 'ⵉⵍⵍⴰ' : lang === 'en' ? 'open' : 'libres'}`}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <span className="font-black text-zinc-900 dark:text-white text-sm flex items-center gap-1.5 truncate">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${barberTone.dotClass}`} />
                              <span className="truncate">{bName}</span>
                            </span>
                            {bSubtitle && (
                              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 block truncate">
                                {bSubtitle}
                              </span>
                            )}

                            {/* Live Firestore Average Star-Rating Display */}
                            <div
                              className="pt-0.5 flex items-center gap-1.5 text-[11px]"
                              aria-label={`${ratingStats.averageRating} out of 5 stars from ${ratingStats.reviewCount} reviews`}
                            >
                              <div dir="ltr" className="flex items-center gap-0.5 flex-shrink-0">
                                {[1, 2, 3, 4, 5].map((starIndex) => {
                                  const fillPct = Math.max(
                                    0,
                                    Math.min(100, (ratingStats.averageRating - (starIndex - 1)) * 100)
                                  );
                                  return (
                                    <span
                                      key={starIndex}
                                      className="relative inline-block w-3 h-3 flex-shrink-0"
                                    >
                                      <Star className="w-3 h-3 text-zinc-300 dark:text-zinc-700" />
                                      {fillPct > 0 && (
                                        <span
                                          className="absolute inset-y-0 left-0 overflow-hidden"
                                          style={{ width: `${fillPct}%` }}
                                        >
                                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                              <span className="font-mono font-black text-zinc-900 dark:text-amber-300 tabular-nums">
                                {ratingStats.averageRating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Step 2 Sticky Navigation: Prev / Next */}
                  <div className={stickyNavClass}>
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="col-span-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      <span>
                        {pickLang(lang, {
                          ar: 'السابق',
                          fr: 'Retour',
                          amz: 'ⵖⵔ ⴷⴼⴼⵉⵔ',
                          en: 'Back',
                          es: 'Atrás',
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="col-span-2 min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <span>
                        {pickLang(lang, {
                          ar: 'التالي: معلوماتك',
                          fr: 'Suivant : Vos coordonnées',
                          amz: 'ⵉⴷⴷⴰⵏ: ⵉⵏⵖⵎⵉⵙⵏ ⵏⵏⴽ',
                          en: 'Next: Your Info',
                          es: 'Siguiente: Tus datos',
                        })}
                      </span>
                      {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ========================================================= */}
              {/* STEP 3: CLIENT INFO, CREDIT CHECK, LOYALTY & NOTES        */}
              {/* ========================================================= */}
              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: stepOffsetX }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -stepOffsetX }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-3 pt-0.5"
                >
                  <label className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-500" />
                    <span>{ui.step3}</span>
                  </label>

                  {/* Coordinates: Name, Phone (WhatsApp), and Optional Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                        <User className={`w-3 h-3 ${fieldErrors.clientName ? 'text-red-500' : 'text-zinc-400'}`} />
                        <span className={fieldErrors.clientName ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                          {pickLang(lang, {
                            ar: 'الاسم الكامل *',
                            fr: 'Nom complet *',
                            amz: 'ⵉⵙⵎ ⵓⵎⵎⵉⴷ *',
                            en: 'Full Name *',
                            es: 'Nombre completo *',
                          })}
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
                        placeholder={pickLang(lang, {
                          ar: 'مثال: يوسف الإدريسي',
                          fr: 'Ex: Youssef El Idrissi',
                          amz: 'ⴰⵎⴷⵢⴰ: ⵢⵓⵙⴼ',
                          en: 'e.g. Youssef El Idrissi',
                          es: 'Ej: Youssef El Idrissi',
                        })}
                        aria-invalid={Boolean(fieldErrors.clientName)}
                        required
                        className={`w-full min-h-[42px] bg-stone-50 dark:bg-[#12141B] border rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none transition-colors ${
                          fieldErrors.clientName
                            ? 'border-red-500 dark:border-red-500 ring-2 ring-red-500/20 focus:border-red-500'
                            : 'border-stone-200 dark:border-zinc-800 focus:border-amber-500'
                        }`}
                      />
                      {fieldErrors.clientName && (
                        <p role="alert" className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.clientName}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                        <Phone className={`w-3 h-3 ${fieldErrors.clientPhone ? 'text-red-500' : 'text-zinc-400'}`} />
                        <span className={fieldErrors.clientPhone ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                          {pickLang(lang, {
                            ar: 'رقم الهاتف (واتساب) *',
                            fr: 'Numéro WhatsApp *',
                            amz: 'ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ *',
                            en: 'Phone (WhatsApp) *',
                            es: 'Teléfono WhatsApp *',
                          })}
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
                        className={`w-full min-h-[42px] bg-stone-50 dark:bg-[#12141B] border rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white font-mono placeholder-zinc-400 focus:outline-none transition-colors ${
                          fieldErrors.clientPhone
                            ? 'border-red-500 dark:border-red-500 ring-2 ring-red-500/20 focus:border-red-500'
                            : 'border-stone-200 dark:border-zinc-800 focus:border-amber-500'
                        }`}
                      />
                      {fieldErrors.clientPhone && (
                        <p role="alert" className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.clientPhone}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-zinc-400" />
                        <span>
                          {pickLang(lang, {
                            ar: 'الإيميل (اختياري)',
                            fr: 'Email (Optionnel)',
                            amz: 'ⵉⵎⴰⵢⵍ (ⴰⴼⵔⴰⵏ)',
                            en: 'Email (Optional)',
                            es: 'Correo (Opcional)',
                          })}
                        </span>
                      </label>
                      <input
                        type="email"
                        dir="ltr"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="nom@exemple.com"
                        className="w-full min-h-[42px] bg-stone-50 dark:bg-[#12141B] border border-stone-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Automatic Credit Alert Across All Barbers + Who Is Owed + Dispute/Inquiry (No sensitive aliases/notes shown) */}
                  {renderClientCreditAlertCard(false)}

                  {/* Real-Time CRM Recognition Banner */}
                  {isClientBanned && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2 font-semibold">
                      <Ban className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <span>
                        {pickLang(lang, {
                          ar: `عذراً، تم تقييد هذا الرقم مؤقتاً بسبب تكرار عدم الحضور (No-Show). يرجى الاتصال بالصالون مباشرة على ${liveSalonDisplayPhone}.`,
                          fr: `Ce numéro est restreint suite à plusieurs absences (No-Show). Contactez le salon au ${liveSalonDisplayPhone}.`,
                          amz: `ⵓⵟⵟⵓⵏ ⴰⴷ ⵉⵜⵜⵓⴳⴷⵍ. ⵏⵢⴰⵍⴽⴰⵎ ⴷ ⵓⵙⴰⵍⵓⵏ ${liveSalonDisplayPhone}.`,
                          en: `This phone number is restricted due to repeated no-shows. Please call the salon at ${liveSalonDisplayPhone}.`,
                          es: `Este número está restringido por ausencias repetidas. Llama al salón: ${liveSalonDisplayPhone}.`,
                        })}
                      </span>
                    </div>
                  )}

                  {!isClientBanned && (recognizedClient || (cleanDigits.length >= 6 && (pastVisitsCount > 0 || (pointsSummary && pointsSummary.pointsBalance > 0) || crmProfile?.isVip || crmCustomDiscount > 0))) && (
                    <div className="space-y-2">
                      <ReturningLoyaltyStatusCard
                        compact
                        clientName={clientName.trim() || recognizedClient?.clientName || crmProfile?.clientName || 'Client'}
                        clientPhone={clientPhone.trim() || recognizedClient?.clientPhone}
                        verifiedVisits={Math.max(pastVisitsCount, recognizedClient?.verifiedVisits ?? 0)}
                        crmProfile={crmProfile}
                        isVip={Boolean(crmProfile?.isVip ?? recognizedClient?.isVip)}
                        customDiscountMAD={crmCustomDiscount}
                        lang={lang}
                        redeemingTierId={redeemingPointsTierId}
                        onRedeemTier={handleRedeemPointsTier}
                      />
                      {lastRebookableBooking && (
                        <button
                          type="button"
                          onClick={() => handleQuickRebook(lastRebookableBooking)}
                          className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/55 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>
                              {pickLang(lang, {
                                ar: 'عاود نفس الحلاقة / نفس الحلاق',
                                fr: 'Refaire la même coupe & barbier',
                                amz: 'ⵄⴰⵡⴷ ⵜⴰⴽⵔⴹⴰ ⴷ ⵓⵎⴽⵕⴰⴹ',
                                en: 'Repeat Last Haircut & Barber',
                                es: 'Repetir mismo corte y barbero',
                              })}
                            </span>
                          </span>
                          <span className="text-[11px] font-bold opacity-85 truncate max-w-[140px]">
                            {lastRebookableBooking.barberName}
                          </span>
                        </button>
                      )}
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
                          {pickLang(lang, {
                            ar: 'ملاحظات الزبون (اختياري)',
                            fr: 'Notes Client (Optionnel)',
                            amz: 'ⵜⵉⵏⵏⴰⵢⵉⵏ ⵏ ⵓⵎⵙⴰⵖ (ⵓⵔ ⵉⴱⵣⵣⵉⵣ)',
                            en: 'Client Notes (Optional)',
                            es: 'Notas del Cliente (Opcional)',
                          })}
                        </span>
                      </label>
                      <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                        {notes.length}/400
                      </span>
                    </div>

                    <textarea
                      id="booking-client-notes"
                      rows={2}
                      maxLength={400}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={pickLang(lang, {
                        ar: 'مثال: تدرج منخفض، الحفاظ على الطول من الأعلى، تحديد اللحية...',
                        fr: 'Ex: dégradé bas, garder longueur au-dessus, contour barbe...',
                        amz: 'ⴰⵔⴰ ⵜⵉⵏⵏⴰⵢⵉⵏ ⵏⵏⴽ ⵉ ⵓⵎⵥⵥⴰⵡ...',
                        en: 'e.g., low fade, keep length on top, sharp beard line...',
                        es: 'Ej: degradado bajo, mantener largo arriba, perfilado barba...',
                      })}
                      className="w-full min-h-[60px] resize-y bg-stone-50 dark:bg-[#12141B] border border-stone-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500 transition-colors leading-relaxed"
                    />

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(lang === 'ar'
                        ? ['تدرج منخفض', 'تدرج متوسط', 'الحفاظ على الطول', 'تحديد اللحية بالموس']
                        : lang === 'en'
                        ? ['Low Fade', 'Mid Fade', 'Keep length on top', 'Sharp beard line']
                        : lang === 'amz'
                        ? ['ⴰⵙⵓⴷⴷⵎ ⵉⵣⴷⴰⵔ', 'ⴰⵙⵓⴷⴷⵎ ⴰⵏⴰⵎⵎⴰⵙ', 'ⴰⵊⵊ ⵜⵉⵖⵣⵉ', 'ⵜⴰⵎⴰⵔⵜ ⵙ ⵓⵎⵙⴰⵍ']
                        : lang === 'es'
                        ? ['Degradado bajo', 'Degradado medio', 'Mantener largo arriba', 'Perfilado barba']
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
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                              alreadyIncluded
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 cursor-default'
                                : 'bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-stone-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer'
                            }`}
                          >
                            + {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3 Sticky Navigation: Prev / Next */}
                  <div className={stickyNavClass}>
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="col-span-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      <span>
                        {pickLang(lang, {
                          ar: 'السابق',
                          fr: 'Retour',
                          amz: 'ⵖⵔ ⴷⴼⴼⵉⵔ',
                          en: 'Back',
                          es: 'Atrás',
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="col-span-2 min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <span>
                        {pickLang(lang, {
                          ar: 'التالي: التاريخ والوقت',
                          fr: 'Suivant : Date & Heure',
                          amz: 'ⵉⴷⴷⴰⵏ: ⴰⵙⴰⴽⵓⴷ ⴷ ⵓⴽⵓⴷ',
                          en: 'Next: Date & Time',
                          es: 'Siguiente: Fecha y Hora',
                        })}
                      </span>
                      {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ========================================================= */}
              {/* STEP 4: SMART QUEUE DEFAULT + COLLAPSIBLE MANUAL OPTIONS  */}
              {/* ========================================================= */}
              {currentStep === 4 && (() => {
                const activeBarberTone = getBarberIdentityTokens(
                  selectedBarber.id,
                  selectedBarber.name.ar,
                  selectedBarber.colorName
                );
                return (
                  <motion.div
                    key="step-4"
                    initial={{ opacity: 0, x: stepOffsetX }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -stepOffsetX }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-3.5 pt-0.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-amber-500" />
                        <span>{ui.step4}</span>
                      </label>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 tabular-nums">
                        <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>
                          {pickLang(lang, {
                            ar: `في الانتظار اليوم عند ${barberNameLocalized}: ${selectedBarberTodayWaitingCount}`,
                            fr: `En attente chez ${barberNameLocalized} : ${selectedBarberTodayWaitingCount}`,
                            amz: `ⴰⵔⴰⵊⵓ ⵖⵓⵔ ${barberNameLocalized}: ${selectedBarberTodayWaitingCount}`,
                            en: `Waiting for ${barberNameLocalized} today: ${selectedBarberTodayWaitingCount}`,
                            es: `En espera con ${barberNameLocalized}: ${selectedBarberTodayWaitingCount}`,
                          })}
                        </span>
                      </span>
                    </div>

                    {/* Primary Streamlined Default Path: Smart Queue ("الطابور الذكي") */}
                    <div
                      className={`p-4 rounded-2xl bg-stone-50/90 dark:bg-[#12141B] ${activeBarberTone.borderLeftClass} space-y-3`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <div className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                              <span>
                                {timeOptionMode === 'waitlist'
                                  ? pickLang(lang, {
                                      ar: 'قائمة الانتظار الأولوية',
                                      fr: 'Liste d’attente prioritaire',
                                      amz: 'ⵜⴰⵍⴳⴰⵎⵜ ⵏ ⵓⵇⵇⵍ',
                                      en: 'Priority Waitlist Active',
                                      es: 'Lista de Espera Prioritaria',
                                    })
                                  : !isFlexibleBarberTime
                                  ? pickLang(lang, {
                                      ar: 'موعد بساعة محددة يدوياً',
                                      fr: 'Créneau horaire choisi manuellement',
                                      amz: 'ⴰⴽⵓⴷ ⵉⵜⵜⵓⵙⵜⵉⵏ ⵙ ⵓⴼⵓⵙ',
                                      en: 'Manual Time Slot Selected',
                                      es: 'Hora Elegida Manualmente',
                                    })
                                  : pickLang(lang, {
                                      ar: 'الطابور الذكي مفعّل',
                                      fr: 'File d’attente intelligente activée',
                                      amz: 'ⴰⵇⵇⵍ ⴰⵎⵉⵖⵉⵙ ⵉⵕⵥⵎ',
                                      en: 'Smart Queue Enrolled',
                                      es: 'Cola Inteligente Activa',
                                    })}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                              {timeOptionMode === 'waitlist'
                                ? pickLang(lang, {
                                    ar: 'أنت تسجّل الآن في قائمة الانتظار وسنراسلك فور توفر كرسي شاغر.',
                                    fr: 'Inscription prioritaire sur liste d’attente dès qu’une place se libère.',
                                    amz: 'ⴰⵣⵎⵎⴻⵎ ⴳ ⵓⵇⵇⵍ ⵎⴽ ⵉⵕⵥⵎ ⵓⵙⴳⵏ.',
                                    en: 'Joining priority waitlist to notify you as soon as a chair opens.',
                                    es: 'Te avisaremos en cuanto quede un asiento libre.',
                                  })
                                : isFlexibleBarberTime
                                ? pickLang(lang, {
                                    ar: `تم إدراجك في الطابور الذكي عند ${barberNameLocalized} — لن تُحدَّد ساعة الحضور إلا بعد مراجعة المشرف أو الحلاق لجدول العمل المتاح.`,
                                    fr: `Vous êtes inscrit dans la file intelligente chez ${barberNameLocalized} — l’heure exacte sera attribuée et confirmée par le superviseur ou le barbier selon le planning.`,
                                    amz: `ⵜⴻⵜⵜⵓⵣⵎⵎⴻⵎⴷ ⴳ ⵓⵇⵇⵍ ⴰⵎⵉⵖⵉⵙ ⵖⵓⵔ ${barberNameLocalized} — ⵜⵉⵣⵉ ⴰⴷ ⵜⴻⵜⵜⵓⵙⵜⵉ ⴷⴼⴼⵉⵔ ⵓⵙⵏⵜⵎ.`,
                                    en: `You are enrolled in ${barberNameLocalized}'s Smart Queue — your exact hour will be assigned by the supervisor/barber upon review of live availability.`,
                                    es: `Estás inscrito en la cola inteligente con ${barberNameLocalized} — el supervisor o barbero asignará tu hora tras confirmar.`,
                                  })
                                : pickLang(lang, {
                                    ar: `اخترت يدوياً الساعة ${timeSlot} مع ${barberNameLocalized} حسب الأوقات الشاغرة في جدول الحلاق.`,
                                    fr: `Vous avez choisi manuellement le créneau ${timeSlot} avec ${barberNameLocalized} selon le planning en direct.`,
                                    amz: `ⵜⴼⵔⵏⴷ ⵙ ⵓⴼⵓⵙ ⵜⵉⵣⵉ ${timeSlot} ⵖⵓⵔ ${barberNameLocalized}.`,
                                    en: `You manually picked ${timeSlot} with ${barberNameLocalized} from live open slots.`,
                                    es: `Has elegido manualmente las ${timeSlot} con ${barberNameLocalized}.`,
                                  })}
                            </p>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-black shrink-0">
                          {isFlexibleBarberTime ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <Check className="w-3 h-3 stroke-[3]" />
                          )}
                          <span>
                            {isFlexibleBarberTime
                              ? pickLang(lang, {
                                  ar: 'في الطابور',
                                  fr: 'En file',
                                  amz: 'ⴳ ⵓⵇⵇⵍ',
                                  en: 'Queued',
                                  es: 'En cola',
                                })
                              : pickLang(lang, {
                                  ar: 'مختار',
                                  fr: 'Choisi',
                                  amz: 'ⵉⵜⵜⵓⵙⵜⵉ',
                                  en: 'Selected',
                                  es: 'Elegido',
                                })}
                          </span>
                        </span>
                      </div>

                      {/* Clean Hairline Summary of Barber, Synced Working Date & Queue/Time Status */}
                      <div className="pt-2.5 border-t border-stone-200/80 dark:border-zinc-800/80 grid grid-cols-3 gap-2 text-center">
                        <div className="py-1 px-1.5">
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                            {pickLang(lang, {
                              ar: 'الحلاق',
                              fr: 'Barbier',
                              amz: 'ⴰⵎⴽⵔⴰⴹ',
                              en: 'Barber',
                              es: 'Barbero',
                            })}
                          </span>
                          <span className="mt-0.5 inline-flex items-center justify-center gap-1 text-xs font-black text-zinc-900 dark:text-white truncate max-w-full">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeBarberTone.dotClass}`} />
                            <span className="truncate">{barberNameLocalized}</span>
                          </span>
                        </div>

                        <div className="py-1 px-1.5 border-s border-stone-200/70 dark:border-zinc-800/70">
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                            {isFlexibleBarberTime
                              ? pickLang(lang, {
                                  ar: 'يوم العمل المتاح',
                                  fr: 'Jour ouvert',
                                  amz: 'ⴰⵙⴰⴽⵓⴷ ⵉⵕⵥⵎⵏ',
                                  en: 'Open Day',
                                  es: 'Día abierto',
                                })
                              : pickLang(lang, {
                                  ar: 'التاريخ المختار',
                                  fr: 'Date choisie',
                                  amz: 'ⴰⵙⴰⴽⵓⴷ',
                                  en: 'Chosen Date',
                                  es: 'Fecha elegida',
                                })}
                          </span>
                          <span dir="ltr" className="mt-0.5 block font-mono text-xs font-black text-zinc-900 dark:text-white tabular-nums">
                            {date}
                          </span>
                        </div>

                        <div className="py-1 px-1.5 border-s border-stone-200/70 dark:border-zinc-800/70">
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                            {isFlexibleBarberTime
                              ? pickLang(lang, {
                                  ar: 'توقيت الحضور',
                                  fr: 'Statut horaire',
                                  amz: 'ⵜⵉⵣⵉ',
                                  en: 'Time Status',
                                  es: 'Estado de hora',
                                })
                              : pickLang(lang, {
                                  ar: 'الساعة المختارة',
                                  fr: 'Heure choisie',
                                  amz: 'ⵜⵉⵣⵉ',
                                  en: 'Chosen Time',
                                  es: 'Hora elegida',
                                })}
                          </span>
                          {isFlexibleBarberTime ? (
                            <span className="mt-0.5 block text-[11px] font-black text-amber-700 dark:text-amber-300 leading-tight">
                              {pickLang(lang, {
                                ar: 'يُحدَّد بعد التأكيد',
                                fr: 'Après confirmation',
                                amz: 'ⴷⴼⴼⵉⵔ ⵓⵙⵏⵜⵎ',
                                en: 'Set upon confirm',
                                es: 'Al confirmar',
                              })}
                            </span>
                          ) : (
                            <span dir="ltr" className="mt-0.5 block font-mono text-xs font-black text-amber-600 dark:text-amber-400 tabular-nums">
                              {timeOptionMode === 'waitlist'
                                ? pickLang(lang, {
                                    ar: 'انتظار',
                                    fr: 'Attente',
                                    amz: 'ⴰⵇⵇⵍ',
                                    en: 'Waitlist',
                                    es: 'Espera',
                                  })
                                : timeSlot}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Synchronized Schedule Status Footer */}
                      <div className="pt-2 border-t border-stone-200/60 dark:border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                          <span>
                            {dayAvailability.isSalonClosedDay
                              ? pickLang(lang, {
                                  ar: 'الصالون مغلق يوم الإثنين',
                                  fr: 'Salon fermé le lundi',
                                  amz: 'ⴰⵙⴰⵍⵓⵏ ⵉⵇⵇⵏ ⴰⵢⵏⴰⵙ',
                                  en: 'Salon closed Mondays',
                                  es: 'Cerrado los lunes',
                                })
                              : dayAvailability.isBarberOffDay
                              ? pickLang(lang, {
                                  ar: `${barberNameLocalized} في راحة في هذا التاريخ`,
                                  fr: `${barberNameLocalized} est en repos ce jour`,
                                  amz: `${barberNameLocalized} ⵉⵍⵍⴰ ⴳ ⵓⵙⵓⵏⴼⵓ`,
                                  en: `${barberNameLocalized} is off this date`,
                                  es: `${barberNameLocalized} libre este día`,
                                })
                              : pickLang(lang, {
                                  ar: `متزامن مع جدول ${barberNameLocalized} (${dayAvailability.availableSlots.length} فترات شاغرة)`,
                                  fr: `Synchronisé avec le planning de ${barberNameLocalized} (${dayAvailability.availableSlots.length} créneaux ouverts)`,
                                  amz: `ⵉⵎⵙⴰⵙⴰ ⴷ ⵓⵙⵖⵉⵡⵙ (${dayAvailability.availableSlots.length} ⵉⴽⵓⴷⵏ)`,
                                  en: `Synced with ${barberNameLocalized}'s schedule (${dayAvailability.availableSlots.length} open slots)`,
                                  es: `Sincronizado con ${barberNameLocalized} (${dayAvailability.availableSlots.length} huecos libres)`,
                                })}
                          </span>
                        </span>

                        {!isFlexibleBarberTime && (
                          <button
                            type="button"
                            onClick={() => {
                              setTimeOptionMode('flexible');
                              setIsFlexibleBarberTime(true);
                              setShowWaitlistBox(false);
                              setTimeSlot('FLEXIBLE');
                              setInspectedBusySlot(null);
                              setFieldErrors((prev) => ({ ...prev, timeSlot: undefined }));
                            }}
                            className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                          >
                            {pickLang(lang, {
                              ar: 'العودة للطابور الذكي',
                              fr: 'Revenir à la file intelligente',
                              amz: 'ⵓⵖⴰⵍ ⵖⵔ ⵓⵇⵇⵍ ⴰⵎⵉⵖⵉⵙ',
                              en: 'Back to Smart Queue',
                              es: 'Volver a Cola Inteligente',
                            })}
                          </button>
                        )}
                      </div>
                    </div>

                    {renderSpecialRulePricingNotice(false)}

                    {/* Collapsible Toggle for Manual Date/Time Picker, Weekly Map & Alternative Modes */}
                    <button
                      type="button"
                      onClick={() => setShowManualDateTime((prev) => !prev)}
                      aria-expanded={showManualDateTime}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-stone-50/70 hover:bg-stone-100 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span className="truncate">
                          {pickLang(lang, {
                            ar: 'اختيار الوقت أو التاريخ يدوياً',
                            fr: 'Choisir l’heure ou la date manuellement',
                            amz: 'ⴼⵔⵏ ⴰⴽⵓⴷ ⵏⵖ ⴰⵙⴰⴽⵓⴷ ⵙ ⵓⴼⵓⵙ',
                            en: 'Choose time or date manually',
                            es: 'Elegir fecha u hora manualmente',
                          })}
                        </span>
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform duration-200 ${
                          showManualDateTime ? 'rotate-180 text-amber-600 dark:text-amber-400' : ''
                        }`}
                      />
                    </button>

                    {/* Expanded Manual Date, Weekly Map, Specific Time Slot & Waitlist Options */}
                    <AnimatePresence initial={false}>
                      {showManualDateTime && (
                        <motion.div
                          key="manual-datetime-drawer"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="pt-2 space-y-3 border-t border-stone-200/80 dark:border-zinc-800/80">
                            {/* 1-Tap Quick-Pick Upcoming Open Days */}
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                              {quickPickDates.map((d) => {
                                const isPicked = date === d.dateStr;
                                const dayCount = evaluateBarberDayAvailability(
                                  selectedBarber.id,
                                  d.dateStr,
                                  barberSchedules,
                                  liveBookings,
                                  totalSelectedMinutes
                                ).availableSlots.length;
                                return (
                                  <button
                                    key={d.dateStr}
                                    type="button"
                                    onClick={() => {
                                      setDate(d.dateStr);
                                      setInspectedBusySlot(null);
                                      setFieldErrors((prev) => ({ ...prev, date: undefined, timeSlot: undefined }));
                                    }}
                                    className={`py-2 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                                      isPicked
                                        ? 'bg-amber-500 border-amber-400 text-black shadow-sm'
                                        : 'bg-stone-50 dark:bg-[#12141B] border-stone-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-amber-500/60'
                                    }`}
                                  >
                                    <span className="block text-[10px] font-bold truncate">{d.dayShort}</span>
                                    <span dir="ltr" className="block text-xs font-mono font-black mt-0.5 tabular-nums">
                                      {d.dayNum}
                                    </span>
                                    <span
                                      className={`block text-[9px] font-mono mt-0.5 tabular-nums ${
                                        isPicked
                                          ? 'text-black/80 font-bold'
                                          : dayCount === 0
                                          ? 'text-rose-500'
                                          : 'text-zinc-500 dark:text-zinc-400'
                                      }`}
                                    >
                                      {dayCount}{' '}
                                      {pickLang(lang, {
                                        ar: 'متاح',
                                        fr: 'libres',
                                        amz: 'ⵉⵕⵥⵎⵏ',
                                        en: 'open',
                                        es: 'libres',
                                      })}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Compact Exact Date Calendar Input */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                                {pickLang(lang, {
                                  ar: 'أو اختر تاريخاً محدداً:',
                                  fr: 'Ou date précise :',
                                  amz: 'ⵏⵖ ⴰⵙⴰⴽⵓⴷ:',
                                  en: 'Or specific date:',
                                  es: 'O fecha exacta:',
                                })}
                              </label>
                              <div className="flex-1">
                                <input
                                  ref={dateInputRef}
                                  type="date"
                                  value={date}
                                  min={(() => {
                                    const d = new Date();
                                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                  })()}
                                  onChange={(e) => {
                                    setDate(e.target.value);
                                    setInspectedBusySlot(null);
                                    if (fieldErrors.date || fieldErrors.timeSlot) {
                                      setFieldErrors((prev) => ({ ...prev, date: undefined, timeSlot: undefined }));
                                    }
                                  }}
                                  aria-invalid={Boolean(fieldErrors.date)}
                                  required
                                  className={`w-full min-h-[42px] bg-stone-50 dark:bg-[#12141B] border rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none transition-colors ${
                                    fieldErrors.date
                                      ? 'border-red-500 dark:border-red-500 ring-2 ring-red-500/20 focus:border-red-500'
                                      : 'border-stone-200 dark:border-zinc-800 focus:border-amber-500'
                                  }`}
                                />
                              </div>
                            </div>
                            {fieldErrors.date && (
                              <p role="alert" className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{fieldErrors.date}</span>
                              </p>
                            )}

                            {/* Collapsible Weekly Availability Calendar Visualizer */}
                            <WeeklyAvailabilityVisualizer
                              barberId={selectedBarber.id}
                              barberName={barberNameLocalized}
                              selectedDate={date}
                              selectedTimeSlot={timeSlot}
                              isFlexibleMode={isFlexibleBarberTime}
                              schedulesMap={barberSchedules}
                              bookings={liveBookings}
                              lang={lang}
                              candidateDurationMinutes={totalSelectedMinutes}
                              onSelectDateAndSlot={(pickedDate, pickedSlot) => {
                                setDate(pickedDate);
                                setTimeOptionMode('specific');
                                setIsFlexibleBarberTime(false);
                                setShowWaitlistBox(false);
                                setInspectedBusySlot(null);
                                setTimeSlot(pickedSlot);
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  date: undefined,
                                  timeSlot: undefined,
                                }));
                              }}
                            />

                            {/* 3-Option Scheduling Mode Selector */}
                            {!dayAvailability.isSalonClosedDay && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                                  {pickLang(lang, {
                                    ar: 'طريقة تحديد التوقيت:',
                                    fr: 'Mode de créneau :',
                                    amz: 'ⵜⴰⵖⴰⵔⴰⵙⵜ ⵏ ⵓⴽⵓⴷ:',
                                    en: 'Time selection mode:',
                                    es: 'Modo de horario:',
                                  })}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTimeOptionMode('flexible');
                                      setIsFlexibleBarberTime(true);
                                      setShowWaitlistBox(false);
                                      setTimeSlot('FLEXIBLE');
                                      setFieldErrors((prev) => ({ ...prev, timeSlot: undefined }));
                                    }}
                                    className={`p-2.5 rounded-xl border text-left rtl:text-right transition-all cursor-pointer min-h-[50px] flex flex-col justify-between gap-1 ${
                                      timeOptionMode === 'flexible'
                                        ? 'bg-amber-500/12 border-amber-500 shadow-xs'
                                        : 'bg-stone-50 dark:bg-[#12141B] border-stone-200 dark:border-zinc-800 hover:border-amber-500/50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1.5">
                                      <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                      {timeOptionMode === 'flexible' && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 stroke-[3]" />}
                                    </div>
                                    <span className="text-xs font-black text-zinc-900 dark:text-white leading-snug">
                                      {pickLang(lang, {
                                        ar: 'دع الحلاق يختار لك الوقت المناسب',
                                        fr: 'Laisser le barbier choisir',
                                        amz: 'ⴰⴷ ⵉⴼⵔⵏ ⵓⵎⵥⵥⴰⵡ ⴰⴽⵓⴷ ⵉⵖⵓⴷⴰⵏ',
                                        en: 'Let barber choose best time',
                                        es: 'Deja que el barbero elija la hora',
                                      })}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTimeOptionMode('specific');
                                      setIsFlexibleBarberTime(false);
                                      setShowWaitlistBox(false);
                                      if (dayAvailability.availableSlots.length > 0 && (!timeSlot || timeSlot === 'FLEXIBLE')) {
                                        setTimeSlot(dayAvailability.availableSlots[0]);
                                      }
                                      setFieldErrors((prev) => ({ ...prev, timeSlot: undefined }));
                                    }}
                                    className={`p-2.5 rounded-xl border text-left rtl:text-right transition-all cursor-pointer min-h-[50px] flex flex-col justify-between gap-1 ${
                                      timeOptionMode === 'specific'
                                        ? 'bg-amber-500/12 border-amber-500 shadow-xs'
                                        : 'bg-stone-50 dark:bg-[#12141B] border-stone-200 dark:border-zinc-800 hover:border-amber-500/50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1.5">
                                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                      {timeOptionMode === 'specific' && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 stroke-[3]" />}
                                    </div>
                                    <span className="text-xs font-black text-zinc-900 dark:text-white leading-snug">
                                      {pickLang(lang, {
                                        ar: 'اختر وقتك المتاح',
                                        fr: 'Choisir mon heure disponible',
                                        amz: 'ⴼⵔⵏ ⴰⴽⵓⴷ ⵏⵏⴽ ⵉⵕⵥⵎⵏ',
                                        en: 'Pick my available time',
                                        es: 'Elegir mi hora disponible',
                                      })}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTimeOptionMode('waitlist');
                                      setIsFlexibleBarberTime(false);
                                      setShowWaitlistBox(true);
                                      setFieldErrors((prev) => ({ ...prev, timeSlot: undefined }));
                                    }}
                                    className={`p-2.5 rounded-xl border text-left rtl:text-right transition-all cursor-pointer min-h-[50px] flex flex-col justify-between gap-1 ${
                                      timeOptionMode === 'waitlist'
                                        ? 'bg-amber-500/12 border-amber-500 shadow-xs'
                                        : 'bg-stone-50 dark:bg-[#12141B] border-stone-200 dark:border-zinc-800 hover:border-amber-500/50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1.5">
                                      <ListPlus className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                      {timeOptionMode === 'waitlist' && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 stroke-[3]" />}
                                    </div>
                                    <span className="text-xs font-black text-zinc-900 dark:text-white leading-snug">
                                      {pickLang(lang, {
                                        ar: 'التسجيل في قائمة الانتظار',
                                        fr: 'Liste d’attente prioritaire',
                                        amz: 'ⴰⵣⵎⵎⴻⵎ ⴳ ⵓⵇⵇⵍ',
                                        en: 'Join Smart Waitlist',
                                        es: 'Unirse a Lista de Espera',
                                      })}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            )}

                            <AnimatePresence mode="wait" initial={false}>
                              {/* Option 1 Active View: Barber Picks Best Time */}
                              {!dayAvailability.isSalonClosedDay && timeOptionMode === 'flexible' && (
                                <motion.div
                                  key="time-mode-flexible"
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.16 }}
                                  className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 space-y-1 text-xs"
                                >
                                  <div className="font-black text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                    <CalendarClock className="w-4 h-4 flex-shrink-0" />
                                    <span>
                                      {pickLang(lang, {
                                        ar: `سيختار ${barberNameLocalized} أفضل وقت شاغر لك يوم ${date}`,
                                        fr: `${barberNameLocalized} sélectionnera votre meilleur créneau le ${date}`,
                                        amz: `${barberNameLocalized} ⴰⴷ ⵉⴼⵔⵏ ⴰⴽⵓⴷ ⵉⵖⵓⴷⴰⵏ ⴰⵙⵙ ⵏ ${date}`,
                                        en: `${barberNameLocalized} will pick your best open slot on ${date}`,
                                        es: `${barberNameLocalized} elegirá tu mejor horario disponible el ${date}`,
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-[11px]">
                                    {pickLang(lang, {
                                      ar: 'بمجرد تأكيد الحجز، سيصلك إشعار وتحديث فوري على تذكرتك بالساعة الدقيقة التي خصصها لك الحلاق.',
                                      fr: 'Dès validation, vous recevrez une notification et une mise à jour instantanée sur votre ticket avec l’heure assignée.',
                                      amz: 'ⵎⴽ ⵉⵜⵜⵓⵙⵙⵏⵜⵎ ⵓⵙⵔⵓⵙ, ⴰⴷ ⴽ ⵉⵍⴽⵎ ⵓⵏⵖⵎⵉⵙ ⵙ ⵓⴽⵓⴷ ⵉⵥⵍⵉⵏ.',
                                      en: 'Once confirmed, you will receive an instant notification and ticket update with your exact assigned hour.',
                                      es: 'Al confirmarse, recibirás una notificación instantánea con la hora asignada en tu ticket.',
                                    })}
                                  </p>
                                </motion.div>
                              )}

                              {/* Option 2 Active View: Pick Specific Available Time + Cross-Barber Checker */}
                              {dayAvailability.isSalonClosedDay ? (
                                <motion.div
                                  key="time-mode-closed"
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.16 }}
                                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2"
                                >
                                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                                  <span>
                                    {pickLang(lang, {
                                      ar: 'الصالون مغلق كل يوم إثنين (العطلة الأسبوعية). يرجى اختيار يوم آخر من الثلاثاء إلى الأحد.',
                                      fr: 'Le salon est fermé le Lundi (jour de repos hebdomadaire). Veuillez choisir une autre date.',
                                      amz: 'ⴰⵙⴰⵍⵓⵏ ⵉⵇⵇⵏ ⴰⵙⵙ ⵏ ⵓⵢⵏⴰⵙ. ⴼⵔⵏ ⴰⵙⵙ ⵢⴰⴹⵏ ⵙⴳ ⵓⵙⵉⵏⴰⵙ ⴰⵔ ⴰⵙⴰⵎⴰⵙ.',
                                      en: 'The salon is closed every Monday (weekly day off). Please choose another day Tuesday–Sunday.',
                                      es: 'El salón cierra los lunes (día de descanso). Por favor elige de martes a domingo.',
                                    })}
                                  </span>
                                </motion.div>
                              ) : timeOptionMode === 'specific' && (
                                <motion.div
                                  key="time-mode-specific"
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.16 }}
                                  className="space-y-3"
                                >
                                  {/* Real-Time Cross-Barber Availability Strip */}
                                  <div className="space-y-1.5">
                                    <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                                      {pickLang(lang, {
                                        ar: 'التوفر الفوري عند الحلاقين في هذا التاريخ:',
                                        fr: 'Disponibilité par barbier à cette date :',
                                        amz: 'ⵜⵉⵍⵍⵉⵜ ⵖⵓⵔ ⵉⵎⵥⵥⴰⵡⵏ ⴰⵙⵙ ⴰⴷ:',
                                        en: 'Barber availability on this date:',
                                        es: 'Disponibilidad por barbero:',
                                      })}
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                      {mergedTeam.map((b) => {
                                        const avail = allBarbersAvailability[b.id];
                                        const openSlots = avail?.availableSlots.length ?? 0;
                                        const activeB = b.id === selectedBarber.id;
                                        const bShortName = b.name[lang] || b.name.ar;
                                        const bTone = getBarberIdentityTokens(b.id, b.name.ar, b.colorName);
                                        return (
                                          <button
                                            key={b.id}
                                            type="button"
                                            onClick={() => {
                                              onSelectBarberId(b.id);
                                              setInspectedBusySlot(null);
                                              if (avail && avail.availableSlots.length > 0 && isFlexibleBarberTime) {
                                                setIsFlexibleBarberTime(false);
                                                setTimeOptionMode('specific');
                                                setTimeSlot(avail.availableSlots[0]);
                                              }
                                            }}
                                            className={`px-2.5 py-2 rounded-xl border text-left rtl:text-right transition-all cursor-pointer min-h-[44px] ${
                                              activeB
                                                ? 'bg-amber-50/70 dark:bg-amber-500/15 border-amber-500 text-zinc-900 dark:text-white shadow-xs'
                                                : 'bg-stone-50 dark:bg-[#12141B] border-stone-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-amber-500/50'
                                            }`}
                                          >
                                            <div className="flex items-center gap-1.5">
                                              <span
                                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${bTone.dotClass}`}
                                              />
                                              <span className="text-[11px] font-bold truncate">{bShortName}</span>
                                            </div>
                                            <div
                                              className={`text-[10px] font-mono font-bold mt-0.5 tabular-nums ${
                                                avail?.isBarberOffDay || openSlots === 0
                                                  ? 'text-rose-500'
                                                  : 'text-zinc-500 dark:text-zinc-400'
                                              }`}
                                            >
                                              {avail?.isBarberOffDay
                                                ? pickLang(lang, {
                                                    ar: 'في راحة',
                                                    fr: 'En repos',
                                                    amz: 'ⴰⵙⵓⵏⴼⵓ',
                                                    en: 'Day off',
                                                    es: 'Libre',
                                                  })
                                                : `${openSlots} ${pickLang(lang, {
                                                    ar: 'متاح',
                                                    fr: 'libres',
                                                    amz: 'ⵉⵕⵥⵎⵏ',
                                                    en: 'open',
                                                    es: 'libres',
                                                  })}`}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Strict 1-Hour Slot Grid */}
                                  <div ref={timeSlotSectionRef} className="space-y-2">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-zinc-500 dark:text-zinc-400 font-semibold flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                                        <span>
                                          {pickLang(lang, {
                                            ar: 'اختر التوقيت (اضغط على المحجوز لفحص البدائل):',
                                            fr: 'Créneau horaire (touchez complet pour alternatives) :',
                                            amz: 'ⴼⵔⵏ ⵜⵉⵣⵉ:',
                                            en: 'Pick a time (tap booked slots for alternatives):',
                                            es: 'Elige hora (toca ocupadas para ver opciones):',
                                          })}
                                        </span>
                                      </span>
                                      {!dayAvailability.isBarberOffDay && (
                                        <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold flex-shrink-0 tabular-nums">
                                          {dayAvailability.availableSlots.length}{' '}
                                          {pickLang(lang, {
                                            ar: 'متاح',
                                            fr: 'libre(s)',
                                            amz: 'ⵉⵕⵥⵎⵏ',
                                            en: 'open',
                                            es: 'libre(s)',
                                          })}
                                        </span>
                                      )}
                                    </div>

                                    {dayAvailability.isBarberOffDay ? (
                                      <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 text-amber-800 dark:text-amber-300 text-xs">
                                        <div className="font-semibold flex items-center gap-2">
                                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                                          <span>
                                            {pickLang(lang, {
                                              ar: `${barberNameLocalized} في عطلة أو راحة في هذا التاريخ. يمكنك اختيار حلاق متاح أعلاه أو اختيار "دع الحلاق يختار لك الوقت".`,
                                              fr: `${barberNameLocalized} est indisponible à cette date. Choisissez un autre barbier ci-dessus ou laissez le barbier choisir.`,
                                              amz: `${barberNameLocalized} ⵉⵍⵍⴰ ⴳ ⵓⵙⵓⵏⴼⵓ ⴰⵙⵙ ⴰⴷ. ⴼⵔⵏ ⴰⵎⵥⵥⴰⵡ ⵢⴰⴹⵏ ⵏⵖ ⴰⴽⵓⴷ ⴰⵍⵡⵡⴰⵖ.`,
                                              en: `${barberNameLocalized} is off on this date. Pick an available barber above or select "Let barber choose best time".`,
                                              es: `${barberNameLocalized} está libre este día. Elige otro barbero arriba o activa el horario flexible.`,
                                            })}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className={`grid grid-cols-3 sm:grid-cols-4 gap-1.5 rounded-2xl transition-all ${fieldErrors.timeSlot ? 'p-1.5 ring-2 ring-red-500/60 bg-red-500/5' : ''}`}>
                                        {dayAvailability.slots.map((slot) => {
                                          const isChosen = !isFlexibleBarberTime && slot.available && timeSlot === slot.time;
                                          const isInspectedBusy = !slot.available && inspectedBusySlot === slot.time;
                                          return (
                                            <button
                                              key={slot.time}
                                              type="button"
                                              onClick={() => {
                                                if (slot.available) {
                                                  setIsFlexibleBarberTime(false);
                                                  setInspectedBusySlot(null);
                                                  setTimeSlot(slot.time);
                                                  if (fieldErrors.timeSlot) {
                                                    setFieldErrors((prev) => ({ ...prev, timeSlot: undefined }));
                                                  }
                                                } else {
                                                  setIsFlexibleBarberTime(false);
                                                  setInspectedBusySlot(slot.time);
                                                }
                                              }}
                                              className={`min-h-[44px] py-1.5 px-2 rounded-xl border text-xs font-mono font-bold transition-all flex flex-col items-center justify-center cursor-pointer tabular-nums ${
                                                isInspectedBusy
                                                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20'
                                                  : !slot.available
                                                  ? 'bg-stone-100/80 dark:bg-zinc-900/50 border-stone-200 dark:border-zinc-800/80 text-zinc-400 dark:text-zinc-500 hover:border-amber-500/40'
                                                  : isChosen
                                                  ? 'bg-amber-500 border-amber-400 text-black shadow-sm'
                                                  : 'bg-stone-50 dark:bg-[#12141B] border-stone-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-amber-500/60'
                                              }`}
                                            >
                                              <span dir="ltr" className={!slot.available ? 'line-through opacity-80' : ''}>
                                                {slot.time}
                                              </span>
                                              {!slot.available && (
                                                <span className="text-[9px] font-sans font-semibold text-rose-500 dark:text-rose-400">
                                                  {slot.reason === 'past'
                                                    ? pickLang(lang, {
                                                        ar: 'منتهي',
                                                        fr: 'Passé',
                                                        amz: 'ⵉⵣⵔⵉ',
                                                        en: 'Passed',
                                                        es: 'Pasado',
                                                      })
                                                    : slot.reason === 'booked'
                                                    ? pickLang(lang, {
                                                        ar: 'محجوز',
                                                        fr: 'Complet',
                                                        amz: 'ⵉⵜⵜⵓⵃⵣⴰ',
                                                        en: 'Booked',
                                                        es: 'Ocupado',
                                                      })
                                                    : pickLang(lang, {
                                                        ar: 'استراحة',
                                                        fr: 'Pause',
                                                        amz: 'ⴰⵙⵓⵏⴼⵓ',
                                                        en: 'Break',
                                                        es: 'Descanso',
                                                      })}
                                                </span>
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* SMART CONFLICT & CROSS-BARBER SUGGESTION BANNER */}
                                    <AnimatePresence>
                                      {(inspectedBusySlot || dayAvailability.isFullyBooked || dayAvailability.isBarberOffDay) && (() => {
                                        const targetHour = inspectedBusySlot || timeSlot;
                                        const exactHourAlternatives = targetHour && targetHour !== 'FLEXIBLE'
                                          ? mergedTeam.filter(
                                              (b) =>
                                                b.id !== selectedBarber.id &&
                                                (allBarbersAvailability[b.id]?.availableSlots || []).includes(targetHour)
                                            )
                                          : [];
                                        const anyOpenAlternatives = mergedTeam.filter(
                                          (b) =>
                                            b.id !== selectedBarber.id &&
                                            (allBarbersAvailability[b.id]?.availableSlots.length || 0) > 0
                                        );
                                        const altNamesAr = exactHourAlternatives
                                          .map((a) => a.name[lang] || a.name.ar)
                                          .join(' / ');

                                        return (
                                          <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            transition={{ duration: 0.18 }}
                                            className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 space-y-2 text-xs"
                                          >
                                            <div className="flex items-start gap-2">
                                              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                              <div className="font-black text-zinc-900 dark:text-white">
                                                {pickLang(lang, {
                                                  ar: `توقيتك المفضل محجوز! ${inspectedBusySlot ? `(${inspectedBusySlot})` : ''}`,
                                                  fr: `Votre horaire préféré est complet ! ${inspectedBusySlot ? `(${inspectedBusySlot})` : ''}`,
                                                  amz: `ⴰⴽⵓⴷ ⴰⴷ ⵉⵜⵜⵓⵃⵣⴰ ⵢⴰⴷ! ${inspectedBusySlot ? `(${inspectedBusySlot})` : ''}`,
                                                  en: `Your preferred time is booked! ${inspectedBusySlot ? `(${inspectedBusySlot})` : ''}`,
                                                  es: `¡Tu hora preferida está ocupada! ${inspectedBusySlot ? `(${inspectedBusySlot})` : ''}`,
                                                })}
                                              </div>
                                            </div>

                                            {exactHourAlternatives.length > 0 ? (
                                              <div className="pt-2 border-t border-amber-200/70 dark:border-amber-500/25 space-y-2">
                                                <div className="font-bold text-zinc-800 dark:text-zinc-200 leading-relaxed flex items-start gap-1.5">
                                                  <SparklesIcon className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                  <span>
                                                    {pickLang(lang, {
                                                      ar: `هذا التوقيت غير متوفر عند الحلاق المختار، ولكن الحلاق (${altNamesAr}) متاح في نفس الوقت (${targetHour})! هل تحجز معه؟`,
                                                      fr: `Cet horaire est indisponible chez ce barbier, mais ${altNamesAr} est libre à ${targetHour} ! Réserver avec lui ?`,
                                                      amz: `ⴰⴽⵓⴷ ⴰⴷ ⵉⵜⵜⵓⵃⵣⴰ ⵖⵓⵔ ⵓⵎⵥⵥⴰⵡ ⴰⴷ, ⵎⴰⵛⴰ ${altNamesAr} ⵉⵕⵥⵎ ⴳ ${targetHour}!`,
                                                      en: `This time is booked with your selected barber, but ${altNamesAr} is available at ${targetHour}! Book with them?`,
                                                      es: `Esta hora está ocupada con tu barbero, ¡pero ${altNamesAr} está libre a las ${targetHour}! ¿Reservar con él?`,
                                                    })}
                                                  </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                  {exactHourAlternatives.map((alt) => {
                                                    const altName = alt.name[lang] || alt.name.ar;
                                                    return (
                                                      <button
                                                        key={alt.id}
                                                        type="button"
                                                        onClick={() => {
                                                          onSelectBarberId(alt.id);
                                                          setTimeSlot(targetHour);
                                                          setIsFlexibleBarberTime(false);
                                                          setTimeOptionMode('specific');
                                                          setInspectedBusySlot(null);
                                                          setFieldErrors((prev) => ({ ...prev, timeSlot: undefined }));
                                                        }}
                                                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                                                      >
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>
                                                          {pickLang(lang, {
                                                            ar: `حجز مع ${altName} (${targetHour})`,
                                                            fr: `Réserver avec ${altName} (${targetHour})`,
                                                            amz: `ⴰⵙⵔⵓⵙ ⴷ ${altName} (${targetHour})`,
                                                            en: `Book with ${altName} (${targetHour})`,
                                                            es: `Reservar con ${altName} (${targetHour})`,
                                                          })}
                                                        </span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            ) : anyOpenAlternatives.length > 0 ? (
                                              <div className="pt-2 border-t border-amber-200/70 dark:border-amber-500/25 space-y-2">
                                                <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                                                  {pickLang(lang, {
                                                    ar: 'حلاقون آخرون لديهم أوقات شاغرة في نفس اليوم:',
                                                    fr: 'Autres barbiers disponibles le même jour :',
                                                    amz: 'ⵉⵎⵥⵥⴰⵡⵏ ⵢⴰⴹⵏ ⵉⵕⵥⵎⵏ ⴰⵙⵙ ⴰⴷ:',
                                                    en: 'Other barbers with open slots on this day:',
                                                    es: 'Otros barberos disponibles este día:',
                                                  })}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                  {anyOpenAlternatives.map((alt) => {
                                                    const altOpen = allBarbersAvailability[alt.id]?.availableSlots || [];
                                                    return (
                                                      <button
                                                        key={alt.id}
                                                        type="button"
                                                        onClick={() => {
                                                          onSelectBarberId(alt.id);
                                                          setTimeSlot(altOpen[0]);
                                                          setIsFlexibleBarberTime(false);
                                                          setTimeOptionMode('specific');
                                                          setInspectedBusySlot(null);
                                                          setFieldErrors((prev) => ({ ...prev, timeSlot: undefined }));
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-800 dark:text-amber-200 font-bold text-[11px] cursor-pointer"
                                                      >
                                                        {alt.name[lang] || alt.name.ar} ({altOpen[0]})
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            ) : null}

                                            <button
                                              type="button"
                                              onClick={() => {
                                                setTimeOptionMode('flexible');
                                                setIsFlexibleBarberTime(true);
                                                setShowWaitlistBox(false);
                                                setTimeSlot('FLEXIBLE');
                                                setFieldErrors((prev) => ({ ...prev, timeSlot: undefined }));
                                              }}
                                              className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-black font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                                            >
                                              <CalendarClock className="w-4 h-4 flex-shrink-0" />
                                              <span>
                                                {pickLang(lang, {
                                                  ar: 'دع الحلاق يختار لي الوقت المناسب',
                                                  fr: 'Laisser le barbier choisir un créneau pour moi',
                                                  amz: 'ⴰⴷ ⵉⴼⵔⵏ ⵓⵎⵥⵥⴰⵡ ⴰⴽⵓⴷ ⵉⵖⵓⴷⴰⵏ',
                                                  en: 'Let the barber choose a suitable time for me',
                                                  es: 'Deja que el barbero elija una hora adecuada',
                                                })}
                                              </span>
                                            </button>
                                          </motion.div>
                                        );
                                      })()}
                                    </AnimatePresence>
                                  </div>
                                </motion.div>
                              )}

                              {/* Option 3 Active View: Smart Waitlist Queue */}
                              {!dayAvailability.isSalonClosedDay && timeOptionMode === 'waitlist' && (
                                <motion.div
                                  key="time-mode-waitlist"
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.16 }}
                                  className="p-3 rounded-xl bg-stone-50 dark:bg-[#12141B] space-y-2.5 text-xs"
                                >
                                  <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    <span>
                                      {pickLang(lang, {
                                        ar: 'قائمة الانتظار الذكية — سنراسلك فوراً عند توفر مقعد!',
                                        fr: 'Liste d’Attente — Notification prioritaire en cas de désistement',
                                        amz: 'ⴰⵣⵎⵎⴻⵎ ⵏ ⵓⵇⵇⵍ — ⴰⵏⵖⵎⵉⵙ ⵓⵙⵔⵉⴷ ⵎⴽ ⵉⵕⵥⵎ ⵓⵙⴳⵏ!',
                                        en: 'Smart Waitlist — Instant alert as soon as a chair opens!',
                                        es: 'Lista de Espera Inteligente — ¡Te avisamos en cuanto haya hueco!',
                                      })}
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
                                        placeholder={pickLang(lang, {
                                          ar: 'الاسم الكامل *',
                                          fr: 'Nom complet *',
                                          amz: 'ⵉⵙⵎ ⵓⵎⵎⵉⴷ *',
                                          en: 'Full Name *',
                                          es: 'Nombre completo *',
                                        })}
                                        className={`w-full min-h-[42px] bg-white dark:bg-black/60 border rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white ${
                                          fieldErrors.clientName ? 'border-red-500 ring-2 ring-red-500/20' : 'border-stone-200 dark:border-zinc-700'
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
                                        className={`w-full min-h-[42px] bg-white dark:bg-black/60 border rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-white ${
                                          fieldErrors.clientPhone ? 'border-red-500 ring-2 ring-red-500/20' : 'border-stone-200 dark:border-zinc-700'
                                        }`}
                                      />
                                      {fieldErrors.clientPhone && (
                                        <p role="alert" className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                                          {fieldErrors.clientPhone}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {renderClientCreditAlertCard(true)}

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <select
                                      value={waitlistPreferredTime}
                                      onChange={(e) => setWaitlistPreferredTime(e.target.value)}
                                      className="min-h-[42px] bg-white dark:bg-black/60 border border-stone-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white"
                                    >
                                      <option value="ANY">
                                        {pickLang(lang, {
                                          ar: 'أي توقيت متاح في هذا اليوم',
                                          fr: 'N’importe quelle heure libre',
                                          amz: 'ⴽⵓ ⵜⵉⵣⵉ ⵉⵕⵥⵎⵏ',
                                          en: 'Any open time today',
                                          es: 'Cualquier hora libre ese día',
                                        })}
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
                                      className="min-h-[42px] py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <ListPlus className="w-3.5 h-3.5" />
                                      <span>
                                        {waitlistSubmitting
                                          ? '...'
                                          : pickLang(lang, {
                                              ar: 'تسجيل في الطابور الذكي',
                                              fr: 'Confirmer sur la liste',
                                              amz: 'ⵣⵎⵎⴻⵎ ⴳ ⵓⵇⵇⵍ',
                                              en: 'Confirm on Waitlist',
                                              es: 'Confirmar en Lista',
                                            })}
                                      </span>
                                    </button>
                                  </div>
                                  {waitlistSuccess && (
                                    <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 font-bold text-[11px]">
                                      {pickLang(lang, {
                                        ar: '✅ تم تسجيلك في قائمة الانتظار! سنتصل بك أو نراسلك عبر واتساب فور شغور مكان.',
                                        fr: '✅ Inscrit sur la liste d’attente ! Nous vous contacterons dès qu’une place se libère.',
                                        amz: '✅ ⵜⴻⵜⵜⵓⵣⵎⵎⴻⵎⴷ ⴳ ⵓⵇⵇⵍ! ⴰⴷ ⴰⴽ ⵏⵖⵔ ⵎⴽ ⵉⵕⵥⵎ ⵓⵙⴳⵏ.',
                                        en: '✅ Added to the waitlist! We will call or WhatsApp you immediately if a slot opens.',
                                        es: '✅ ¡Apuntado en la lista! Te avisaremos en cuanto quede un hueco libre.',
                                      })}
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {fieldErrors.timeSlot && (
                      <p role="alert" className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.timeSlot}</span>
                      </p>
                    )}

                    {/* Step 4 Sticky Navigation: Prev / Next */}
                    <div className={stickyNavClass}>
                      <button
                        type="button"
                        onClick={handlePrevStep}
                        className="col-span-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        <span>
                          {pickLang(lang, {
                            ar: 'السابق',
                            fr: 'Retour',
                            amz: 'ⵖⵔ ⴷⴼⴼⵉⵔ',
                            en: 'Back',
                            es: 'Atrás',
                          })}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="col-span-2 min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <span>
                          {pickLang(lang, {
                            ar: 'التالي: اختيار الخدمات والأسعار',
                            fr: 'Suivant : Services & Tarifs',
                            amz: 'ⵉⴷⴷⴰⵏ: ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⴷ ⵡⴰⵜⵉⴳⵏ',
                            en: 'Next: Services & Live Prices',
                            es: 'Siguiente: Servicios y Precios',
                          })}
                        </span>
                        {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>
                );
              })()}

              {/* ========================================================= */}
              {/* STEP 5: SERVICES, PACKS & LIVE DATE-BASED PRICING         */}
              {/* ========================================================= */}
              {currentStep === 5 && (
                <motion.div
                  key="step-5"
                  ref={servicesSectionRef}
                  initial={{ opacity: 0, x: stepOffsetX }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -stepOffsetX }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-3 pt-0.5"
                >
                  <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    <span className="flex items-center gap-1.5">
                      <Scissors className={`w-4 h-4 ${fieldErrors.services ? 'text-red-500' : 'text-amber-500'}`} />
                      <span className={fieldErrors.services ? 'text-red-600 dark:text-red-400' : ''}>{ui.step5Services}</span>
                    </span>
                    {effectiveTotalSavings > 0 && (
                      <span className="text-xs text-amber-700 dark:text-amber-400 font-bold tabular-nums">
                        {pickLang(lang, {
                          ar: `وفرت ${effectiveTotalSavings} دراهم`,
                          fr: `-${effectiveTotalSavings} MAD`,
                          amz: `-${effectiveTotalSavings} MAD`,
                          en: `Saved ${effectiveTotalSavings} MAD`,
                          es: `Ahorro -${effectiveTotalSavings} MAD`,
                        })}
                      </span>
                    )}
                  </div>

                  {renderSpecialRulePricingNotice(true)}

                  {resolvedEffectivePricing.barberCustomServiceIds.length > 0 && (
                    <div className="px-3 py-2 rounded-xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {pickLang(lang, {
                          ar: `تعريفة مخصصة مفعلة عند اختيار ${barberNameLocalized}`,
                          fr: `Tarif personnalisé appliqué pour ${barberNameLocalized}`,
                          amz: `ⴰⵜⵉⴳ ⵓⵣⵍⵉⴳ ⵏ ${barberNameLocalized}`,
                          en: `Custom pricing applied for ${barberNameLocalized}`,
                          es: `Tarifa personalizada de ${barberNameLocalized}`,
                        })}
                      </span>
                    </div>
                  )}

                  <div className={`space-y-1.5 rounded-2xl transition-all ${fieldErrors.services ? 'p-2 ring-2 ring-red-500/70 bg-red-500/5 border border-red-500/60' : ''}`}>
                    {getVisibleBaseServices(shopPricingConfig, selectedBarberProfile).map((srv) => {
                      const isSelected = selectedServiceIds.includes(srv.id);
                      const srvName = srv.name[lang] || srv.name.ar;
                      const resolvedBase =
                        resolvedEffectivePricing.priceMap[srv.id] ?? srv.basePrice;
                      const displayPrice =
                        srv.id === 'hair-color' && resolvedBase === 150
                          ? COLOR_PRICES[colorConfig.tone]
                          : srv.id === 'protein' && resolvedBase === 200
                          ? proteinPrice
                          : resolvedBase;
                      const displayDuration =
                        resolvedEffectivePricing.durationMap[srv.id] ?? srv.durationMinutes;
                      const isBarberCustom =
                        resolvedEffectivePricing.barberCustomServiceIds.includes(srv.id);
                      const isSpecialRule =
                        resolvedEffectivePricing.specialRuleAffectedServiceIds.includes(srv.id);
                      const officialPrice =
                        resolvedEffectivePricing.officialShopPriceMap[srv.id] ?? srv.basePrice;
                      const isGiftFree = displayPrice === 0;
                      const isAutoComboGift =
                        isSelected && hasHaircutBeardCombo && configuredComboGiftId === srv.id;

                      return (
                        <div
                          key={srv.id}
                          onClick={() => onToggleServiceId(srv.id)}
                          className={`px-3 py-2 min-h-[44px] rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-500 shadow-xs'
                              : 'bg-stone-50/70 dark:bg-[#12141B] border-stone-200 dark:border-zinc-800 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                              {srvName}
                            </span>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                              ~{displayDuration} min
                            </span>
                            {isBarberCustom && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                                {pickLang(lang, {
                                  ar: 'سعر خاص للحلاق',
                                  fr: 'Tarif barbier',
                                  amz: 'ⴰⵜⵉⴳ ⵏ ⵓⵎⴽⵔⴰⴹ',
                                  en: 'Barber rate',
                                  es: 'Tarifa barbero',
                                })}
                              </span>
                            )}
                            {isSpecialRule && (
                              <span className="px-1.5 py-0.5 rounded bg-stone-200/80 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 text-[9px] font-bold text-stone-700 dark:text-zinc-300">
                                {pickLang(lang, {
                                  ar: 'تسعيرة اليوم',
                                  fr: 'Tarif du jour',
                                  amz: 'ⴰⵜⵉⴳ ⵏ ⵡⴰⵙⵙ',
                                  en: 'Day rate',
                                  es: 'Tarifa día',
                                })}
                              </span>
                            )}
                            {isAutoComboGift && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                                {pickLang(lang, {
                                  ar: '🎁 هدية مع حلاقة + طراساج',
                                  fr: '🎁 Cadeau Coupe + Barbe',
                                  amz: '🎁 ⵜⵉⴽⴽⵉ ⴷ ⵜⴽⵔⴹⴰ + ⵜⴰⵎⴰⵔⵜ',
                                  en: '🎁 Free with Haircut + Beard',
                                  es: '🎁 Regalo Corte + Barba',
                                })}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            {isBarberCustom && displayPrice !== officialPrice && !isSpecialRule && (
                              <span className="text-[10px] font-mono line-through text-zinc-400 tabular-nums">
                                {officialPrice}
                              </span>
                            )}
                            {isGiftFree ? (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                                🎁 {getGiftLabel(lang)}
                              </span>
                            ) : (
                              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                {displayPrice} MAD
                              </span>
                            )}
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-amber-500 text-black shadow-xs'
                                  : 'border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {barberExtraServices.map((srv) => {
                      const isSelected = activeExtraSelectedIds.includes(srv.id);
                      const srvName =
                        lang === 'fr'
                          ? srv.nameFr
                          : lang === 'en'
                          ? srv.nameEn
                          : srv.nameAr;

                      return (
                        <div
                          key={srv.id}
                          onClick={() => handleToggleExtraService(srv.id)}
                          className={`px-3 py-2 min-h-[44px] rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-500 shadow-xs'
                              : 'bg-stone-50/70 dark:bg-[#12141B] border-stone-200 dark:border-zinc-800 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                              {srvName}
                            </span>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                              ~{srv.durationMinutes} min
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                              {barberNameLocalized}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            {srv.priceMAD === 0 ? (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                                🎁 {getGiftLabel(lang)}
                              </span>
                            ) : (
                              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                {srv.priceMAD} MAD
                              </span>
                            )}
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-amber-500 text-black shadow-xs'
                                  : 'border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Instant Subtotal Bar */}
                  <div className="px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#12141B] border border-stone-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400 font-semibold">
                      {pickLang(lang, {
                        ar: `المجموع الفرعي للخدمات (~${totalSelectedMinutes} دقيقة):`,
                        fr: `Sous-total prestations (~${totalSelectedMinutes} min) :`,
                        amz: `ⴰⵖⵔⵓⴷ ⵏ ⵜⵡⵓⵔⵉⵡⵉⵏ (~${totalSelectedMinutes} min) :`,
                        en: `Services subtotal (~${totalSelectedMinutes} min):`,
                        es: `Subtotal servicios (~${totalSelectedMinutes} min):`,
                      })}
                    </span>
                    <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400 tabular-nums">
                      {effectiveServicesFinalTotal} MAD
                    </span>
                  </div>

                  {fieldErrors.services && (
                    <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 px-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{fieldErrors.services}</span>
                    </p>
                  )}

                  {/* Step 5 Sticky Navigation: Prev / Next */}
                  <div className={stickyNavClass}>
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="col-span-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      <span>
                        {pickLang(lang, {
                          ar: 'السابق',
                          fr: 'Retour',
                          amz: 'ⵖⵔ ⴷⴼⴼⵉⵔ',
                          en: 'Back',
                          es: 'Atrás',
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="col-span-2 min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <span>
                        {pickLang(lang, {
                          ar: 'التالي: التأكيد النهائي و CIH',
                          fr: 'Suivant : Confirmation & CIH',
                          amz: 'ⵉⴷⴷⴰⵏ: ⴰⵙⵙⴷⵓ ⴷ CIH',
                          en: 'Next: Confirmation & CIH',
                          es: 'Siguiente: Confirmar y CIH',
                        })}
                      </span>
                      {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ========================================================= */}
              {/* STEP 6: FINAL CONFIRMATION, CIH & QUEUE AVOIDANCE         */}
              {/* ========================================================= */}
              {currentStep === 6 && (
                <motion.div
                  key="step-6"
                  initial={{ opacity: 0, x: stepOffsetX }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -stepOffsetX }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-3 pt-0.5"
                >
                  <label className="block text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    <span>
                      {isNoWaitOptionEnabled
                        ? pickLang(lang, {
                            ar: '6. التأكيد النهائي، الدفع عبر CIH وخيار دون انتظار',
                            fr: '6. Confirmation Finale, CIH & Option Sans Attente',
                            amz: '6. ⴰⵙⵙⴷⵓ ⴰⵎⴳⴳⴰⵔⵓ ⴷ CIH',
                            en: '6. Final Confirmation, CIH & No-Wait Option',
                            es: '6. Confirmación Final, CIH y Sin Espera',
                          })
                        : pickLang(lang, {
                            ar: '6. التأكيد النهائي والدفع عبر CIH (اختياري)',
                            fr: '6. Confirmation Finale & Paiement CIH',
                            amz: '6. ⴰⵙⵙⴷⵓ ⴰⵎⴳⴳⴰⵔⵓ ⴷ CIH',
                            en: '6. Final Confirmation & CIH Payment',
                            es: '6. Confirmación Final y Pago CIH',
                          })}
                    </span>
                  </label>

                  {/* Compact Confirmed Client Details Review Pill */}
                  <div className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#12141B] border border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <User className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="font-bold text-zinc-900 dark:text-white truncate">
                        {clientName.trim()}
                      </span>
                      <span dir="ltr" className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {clientPhone.trim()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGoToStep(3)}
                      className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                    >
                      {pickLang(lang, {
                        ar: 'تعديل المعلومات',
                        fr: 'Modifier',
                        amz: 'ⵙⵏⴼⵍ',
                        en: 'Edit info',
                        es: 'Editar',
                      })}
                    </button>
                  </div>

                  {/* OPTIONAL CIH BANK TRANSFER DEPOSIT (Collapsible prompt first) */}
                  <div className={`rounded-2xl border bg-stone-50 dark:bg-[#12141B] overflow-hidden transition-all ${
                    wantCihOnlinePayment || cihReceiptName
                      ? 'border-amber-400/70 dark:border-amber-500/40'
                      : 'border-stone-200 dark:border-zinc-800'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setWantCihOnlinePayment((prev) => !prev)}
                      className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left rtl:text-right hover:bg-stone-100/70 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CihBankLogo />
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white">
                            {pickLang(lang, {
                              ar: 'هل تريد الدفع أونلاين عبر CIH Bank؟ (اختياري)',
                              fr: 'Payer en ligne via CIH Bank ? (Optionnel)',
                              amz: 'ⵉⵙ ⵜⵔⵉⴷ ⴰⴷ ⵜⴼⵔⵓⴷ ⵙ CIH Bank? (ⴰⴼⵔⴰⵏ)',
                              en: 'Pay online via CIH Bank? (Optional)',
                              es: '¿Pagar online por CIH Bank? (Opcional)',
                            })}
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                            {wantCihOnlinePayment || cihReceiptName
                              ? pickLang(lang, {
                                  ar: 'بيانات الحساب ورفع إيصال CIH ظاهرة أدناه',
                                  fr: 'Coordonnées bancaires CIH affichées ci-dessous',
                                  amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵏ CIH ⵍⵍⴰⵏ ⵉⵣⴷⴰⵔ',
                                  en: 'CIH bank details and receipt upload shown below',
                                  es: 'Datos CIH y subida de recibo mostrados abajo',
                                })
                              : pickLang(lang, {
                                  ar: 'اضغط هنا لتأكيد الموعد مسبقاً بالتحويل البنكي',
                                  fr: 'Appuyez ici pour voir le compte CIH ou joindre un reçu',
                                  amz: 'ⴰⴷⵔ ⴷⴰ ⵉ ⵓⵙⴽⵛⵎ ⵏ ⵜⵏⴼⵓⵍⵜ ⵏ CIH',
                                  en: 'Tap here to view CIH bank account or upload receipt',
                                  es: 'Toca aquí para ver la cuenta CIH o adjuntar recibo',
                                })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {cihReceiptName && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            ✓
                          </span>
                        )}
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                            wantCihOnlinePayment
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-stone-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-stone-300 dark:border-zinc-700'
                          }`}
                        >
                          {wantCihOnlinePayment
                            ? pickLang(lang, {
                                ar: 'نعم ✓',
                                fr: 'Oui ✓',
                                amz: 'ⵢⴰⵀ ✓',
                                en: 'Yes ✓',
                                es: 'Sí ✓',
                              })
                            : pickLang(lang, {
                                ar: 'عرض الحساب',
                                fr: 'Afficher',
                                amz: 'ⵙⴽⵏ',
                                en: 'Show Bank',
                                es: 'Ver Cuenta',
                              })}
                        </span>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {(wantCihOnlinePayment || Boolean(cihReceiptName)) && (
                        <motion.div
                          key="cih-expandable-content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="p-3.5 pt-2.5 border-t border-stone-200 dark:border-zinc-800/80 space-y-2.5">
                            {/* Official CIH Bank Account Box */}
                            <div className="p-3 rounded-xl bg-white dark:bg-black/50 border border-stone-200 dark:border-zinc-800 space-y-2 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-zinc-500 dark:text-zinc-400 font-semibold text-[11px]">
                                  {pickLang(lang, {
                                    ar: 'صاحب الحساب :',
                                    fr: 'Titulaire :',
                                    amz: 'ⴱⴰⴱ ⵏ ⵓⵎⵉⴹⴰⵏ :',
                                    en: 'Account Holder :',
                                    es: 'Titular :',
                                  })}
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
                                        ? 'bg-amber-500 text-black'
                                        : 'bg-stone-200 hover:bg-stone-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100'
                                    }`}
                                    aria-label="Copy CIH Holder"
                                  >
                                    {copiedHolderName ? (
                                      <>
                                        <Check className="w-3 h-3" />
                                        <span>
                                          {pickLang(lang, {
                                            ar: 'تم النسخ',
                                            fr: 'Copié',
                                            amz: 'ⵉⵜⵜⵓⵏⵖⵍ',
                                            en: 'Copied',
                                            es: 'Copiado',
                                          })}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>
                                          {pickLang(lang, {
                                            ar: 'نسخ',
                                            fr: 'Copier',
                                            amz: 'ⵏⵖⵍ',
                                            en: 'Copy',
                                            es: 'Copiar',
                                          })}
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-zinc-800/80">
                                <span className="text-zinc-500 dark:text-zinc-400 font-semibold text-[11px]">
                                  {pickLang(lang, {
                                    ar: 'رقم الحساب :',
                                    fr: 'N° Compte :',
                                    amz: 'ⵓⵟⵟⵓⵏ ⵏ ⵓⵎⵉⴹⴰⵏ :',
                                    en: 'Account Number :',
                                    es: 'N° Cuenta :',
                                  })}
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
                                        ? 'bg-amber-500 text-black'
                                        : 'bg-stone-200 hover:bg-stone-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100'
                                    }`}
                                    aria-label="Copy CIH Account Number"
                                  >
                                    {copiedAccountNumber ? (
                                      <>
                                        <Check className="w-3 h-3" />
                                        <span>
                                          {pickLang(lang, {
                                            ar: 'تم النسخ',
                                            fr: 'Copié',
                                            amz: 'ⵉⵜⵜⵓⵏⵖⵍ',
                                            en: 'Copied',
                                            es: 'Copiado',
                                          })}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>
                                          {pickLang(lang, {
                                            ar: 'نسخ',
                                            fr: 'Copier',
                                            amz: 'ⵏⵖⵍ',
                                            en: 'Copy',
                                            es: 'Copiar',
                                          })}
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Receipt Upload + Direct WhatsApp Helper */}
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <label className="flex-1 min-w-[200px] py-2 px-3 rounded-xl bg-white dark:bg-zinc-900 hover:bg-stone-100 dark:hover:bg-zinc-800 border border-dashed border-amber-500/60 text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2 cursor-pointer transition-colors">
                                  {cihReceiptName ? (
                                    <>
                                      <FileCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                      <span className="truncate">{cihReceiptName}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                      <span>
                                        {pickLang(lang, {
                                          ar: 'إرفاق إيصال تحويل CIH هنا (اختياري — صورة أو PDF)',
                                          fr: 'Joindre le reçu de virement CIH (Optionnel)',
                                          amz: 'ⵙⵙⴽⵛⵎ ⵜⴰⵏⴼⵓⵍⵜ ⵏ CIH (ⴰⴼⵔⴰⵏ)',
                                          en: 'Attach CIH transfer receipt (Optional — Image/PDF)',
                                          es: 'Adjuntar recibo CIH (Opcional — Imagen/PDF)',
                                        })}
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
                                    className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 cursor-pointer"
                                    title="Delete receipt"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              <a
                                href={`https://wa.me/${liveSalonWhatsappDigits}?text=${encodeURIComponent(
                                  pickLang(lang, {
                                    ar: `مرحباً صالون بومليك، قمت بالتحويل البنكي عبر CIH لتأكيد حجزي (${clientName.trim() || 'زبون'} - بتاريخ ${date} (${displayTimeSlotLabel}) مع ${barberNameLocalized}). مرفق طيه صورة إيصال التحويل:`,
                                    fr: `Bonjour Salon Boumlik, voici mon reçu de virement CIH pour confirmer ma réservation à l'avance (${clientName.trim() || 'Client'} - le ${date} (${displayTimeSlotLabel}) avec ${barberNameLocalized}) :`,
                                    amz: `ⴰⵣⵓⵍ Salon Boumlik, ⵀⴰⵜⵉⵏ ⵜⴰⵏⴼⵓⵍⵜ CIH ⵉ ⵓⵙⵏⵜⵎ (${clientName.trim() || 'Client'} - ${date} ${displayTimeSlotLabel} - ${barberNameLocalized}) :`,
                                    en: `Hello Salon Boumlik, here is my CIH receipt to confirm my booking in advance (${clientName.trim() || 'Client'} - on ${date} (${displayTimeSlotLabel}) with ${barberNameLocalized}):`,
                                    es: `Hola Salon Boumlik, aquí está mi recibo CIH para confirmar mi reserva (${clientName.trim() || 'Cliente'} - ${date} (${displayTimeSlotLabel}) con ${barberNameLocalized}):`,
                                  })
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                              >
                                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                                <span>
                                  {pickLang(lang, {
                                    ar: 'أو أرسل إيصال التحويل مباشرة عبر واتساب الصالون',
                                    fr: 'Ou envoyer le reçu directement sur le WhatsApp du salon',
                                    amz: 'ⵏⵖ ⴰⵣⵏ ⵜⴰⵏⴼⵓⵍⵜ ⴳ WhatsApp ⵏ ⵓⵙⴰⵍⵓⵏ',
                                    en: 'Or send CIH receipt directly via Salon WhatsApp',
                                    es: 'O enviar recibo por WhatsApp del salón',
                                  })}
                                </span>
                              </a>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Interactive "دون الحاجة للانتظار" (+10 MAD) Toggle — Strictly hidden unless enabled in salon/barber config */}
                  {isNoWaitOptionEnabled && (
                    <div
                      onClick={() => setIncludeWaitingSkip((prev) => !prev)}
                      className={`px-3.5 py-3 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 min-h-[52px] ${
                        effectiveWaitingSkip
                          ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-400 dark:border-amber-500/60 shadow-xs'
                          : 'bg-stone-50 dark:bg-zinc-900/60 border-stone-200 dark:border-zinc-800 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">
                          <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white block truncate">
                            {ui.waitingTitle}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold block tabular-nums ${
                              effectiveWaitingSkip ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-500'
                            }`}
                          >
                            {effectiveWaitingSkip ? '+10 MAD' : '0 MAD'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={effectiveWaitingSkip}
                        aria-label={ui.waitingTitle}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIncludeWaitingSkip((prev) => !prev);
                        }}
                        dir="ltr"
                        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none cursor-pointer ${
                          effectiveWaitingSkip
                            ? 'bg-amber-500 border-amber-400'
                            : 'bg-stone-300 dark:bg-zinc-700 border-stone-400 dark:border-zinc-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                            effectiveWaitingSkip ? 'translate-x-[24px]' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {/* Final Itemized Price & Appointment Summary Box */}
                  <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#12141B] border border-stone-200 dark:border-zinc-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 pb-1.5 border-b border-stone-200 dark:border-zinc-800/80">
                      <span>{barberNameLocalized}</span>
                      <span dir="ltr" className="font-mono font-bold text-zinc-900 dark:text-white">
                        {date} • {displayTimeSlotLabel}
                      </span>
                    </div>

                    {effectiveCartItems.map((item) => (
                      <div key={item.serviceId} className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                        <span className="truncate">{item.name}</span>
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            item.finalPrice === 0
                              ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                              : 'text-zinc-900 dark:text-white'
                          }`}
                        >
                          {item.finalPrice === 0 ? `🎁 ${getGiftLabel(lang)}` : `${item.finalPrice} MAD`}
                        </span>
                      </div>
                    ))}

                    {effectiveTotalSavings > 0 && (
                      <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 font-bold">
                        <span>
                          {pickLang(lang, {
                            ar: '🎁 تخفيض الباقة المطبقة:',
                            fr: '🎁 Remise bundle appliquée :',
                            amz: '🎁 ⴰⵙⵙⵏⵇⵙ ⵏ ⵓⵙⵎⵓⵏ:',
                            en: '🎁 Bundle discount applied:',
                            es: '🎁 Descuento de paquete:',
                          })}
                        </span>
                        <span className="font-mono tabular-nums">-{effectiveTotalSavings} MAD</span>
                      </div>
                    )}

                    {effectiveWaitingSkip && (
                      <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <span>⚡</span>
                          <span>
                            {pickLang(lang, {
                              ar: 'دون الحاجة للانتظار:',
                              fr: 'Option Sans Attente :',
                              amz: 'ⴱⵍⴰ ⵓⵇⵇⵍ:',
                              en: 'No Wait Priority:',
                              es: 'Sin Espera:',
                            })}
                          </span>
                        </span>
                        <span className="font-mono font-bold tabular-nums">+10 MAD</span>
                      </div>
                    )}

                    {crmCustomDiscount > 0 && (
                      <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 font-bold">
                        <span>
                          {pickLang(lang, {
                            ar: '⭐ تخفيض الولاء / VIP:',
                            fr: '⭐ Remise fidélité VIP :',
                            amz: '⭐ ⴰⵙⵙⵏⵇⵙ ⵏ ⵜⵏⴼⵍⵓⵙⵜ VIP:',
                            en: '⭐ Loyalty / VIP Discount:',
                            es: '⭐ Descuento Fidelidad VIP:',
                          })}
                        </span>
                        <span className="font-mono tabular-nums">-{crmCustomDiscount} MAD</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-stone-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-black text-zinc-900 dark:text-white block">
                          {pickLang(lang, {
                            ar: 'المجموع النهائي للطلب:',
                            fr: 'Total à payer :',
                            amz: 'ⴰⵖⵔⵓⴷ ⴰⵎⴳⴳⴰⵔⵓ :',
                            en: 'Final Total:',
                            es: 'Total a pagar:',
                          })}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {pickLang(lang, {
                            ar: 'الأداء في الصالون بعد الخدمة',
                            fr: 'Paiement au salon après la prestation',
                            amz: 'ⴰⴼⵔⴰ ⴳ ⵓⵙⴰⵍⵓⵏ ⴷⴼⴼⵉⵔ ⵜⵡⵓⵔⵉ',
                            en: 'Pay at the salon after service',
                            es: 'Pago en el salón tras el servicio',
                          })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono block tabular-nums">
                          {grandTotal} <span className="text-xs text-amber-600/80">MAD</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {renderBookingCapBanner()}

                  {fieldErrors.submit && (
                    <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-300 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                      <span>{fieldErrors.submit}</span>
                    </div>
                  )}

                  {/* Step 5 Sticky Navigation & Primary Confirm Action */}
                  <div className={stickyNavClass}>
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="col-span-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      <span>
                        {pickLang(lang, {
                          ar: 'السابق',
                          fr: 'Retour',
                          amz: 'ⵖⵔ ⴷⴼⴼⵉⵔ',
                          en: 'Back',
                          es: 'Atrás',
                        })}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmBooking}
                      disabled={
                        isSubmitting ||
                        hasReachedBookingCap ||
                        (isClientBanned && !allowAdminBypass) ||
                        dayAvailability.isSalonClosedDay ||
                        (!isFlexibleBarberTime && dayAvailability.availableSlots.length === 0)
                      }
                      className="col-span-2 min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-black flex-shrink-0" />
                      <span>
                        {isSubmitting
                          ? pickLang(lang, {
                              ar: 'جاري تسجيل الحجز...',
                              fr: 'Enregistrement...',
                              amz: 'ⴰⵣⵎⵎⴻⵎ...',
                              en: 'Saving booking...',
                              es: 'Guardando...',
                            })
                          : isClientBanned
                          ? pickLang(lang, {
                              ar: 'الحجز مقيد لهذا الرقم',
                              fr: 'Numéro restreint',
                              amz: 'ⵓⵟⵟⵓⵏ ⵉⵜⵜⵓⴳⴷⵍ',
                              en: 'Number Restricted',
                              es: 'Número restringido',
                            })
                          : ui.btnSubmit}
                      </span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </MotionConfig>

        </div>

        {/* Clean Unobtrusive Utility Link below Booking Wizard */}
        {onOpenTrackBooking && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => onOpenTrackBooking('')}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-stone-100/80 dark:hover:bg-zinc-900/60 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Ticket className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>
                {pickLang(lang, {
                  ar: 'تتبع الموعد · عرض التذكرة و QR ونقاط الولاء',
                  fr: 'Suivre mon rendez-vous · Ticket, QR & Fidélité',
                  amz: 'ⴹⴼⵕ ⴰⵙⵔⵓⵙ · ⵜⵉⴽⵉ, QR ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ',
                  en: 'Track Appointment · View Ticket, QR & Loyalty',
                  es: 'Seguir mi Cita · Ticket, QR y Puntos',
                })}
              </span>
              {isRtl ? (
                <ChevronLeft className="w-3.5 h-3.5 opacity-70" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
              )}
            </button>
          </div>
        )}

      </div>

      {/* ADVANCED DIGITAL TICKET MODAL (With Barber Color-Coding, QR Code, and Image Download) */}
      <ModalPortal>
        <MotionConfig reducedMotion="user">
          <AnimatePresence>
            {createdBooking && (
              <motion.div
                key="ticket-confirmation-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[65] flex items-center justify-center p-3 sm:p-6 sb-modal-backdrop"
              >
                <motion.div
                  key="ticket-confirmation-card"
                  initial={{ opacity: 0, scale: 0.96, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white dark:bg-[#12151E] border border-amber-300 dark:border-amber-500/40 rounded-3xl p-5 sm:p-6 max-w-md sm:max-w-lg w-full shadow-2xl space-y-4 text-center max-h-[92vh] overflow-y-auto text-slate-900 dark:text-white"
                >
            
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
                      {pickLang(lang, {
                        ar: 'الحلاق المعين',
                        fr: 'Barbier Assigné',
                        amz: 'ⴰⵎⵥⵥⴰⵡ',
                        en: 'Assigned Barber',
                        es: 'Barbero Asignado',
                      })}
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
                    ⏰{' '}
                    {createdBooking.timeSlot === 'FLEXIBLE'
                      ? pickLang(lang, {
                          ar: 'في الطابور الذكي — يحدده المشرف أو الحلاق بعد التأكيد',
                          fr: 'File intelligente — Heure attribuée après confirmation',
                          amz: 'ⴰⵇⵇⵍ ⴰⵎⵉⵖⵉⵙ — ⴰⴷ ⵜ ⵉⴼⵔⵏ ⵓⵎⵥⵥⴰⵡ',
                          en: 'Smart Queue — Assigned upon confirmation',
                          es: 'Cola inteligente — Hora asignada al confirmar',
                        })
                      : createdBooking.timeSlot}
                  </div>
                  <div className="pt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold">
                      <ScanLine className="w-3 h-3" />
                      <span>
                        {pickLang(lang, {
                          ar: 'QR Check-In الوصول السريع',
                          fr: 'QR Check-In Salon',
                          amz: 'QR Check-In ⵓⵙⴰⵍⵓⵏ',
                          en: 'Quick Arrival QR Check-In',
                          es: 'QR Check-In en Salón',
                        })}
                      </span>
                    </span>
                    {(createdBooking.clientPhone || createdBooking.checkInToken) && (
                      <span dir="ltr" className="font-mono text-[10px] text-zinc-400">
                        ID:{' '}
                        {(() => {
                          const digits = String(createdBooking.clientPhone || '').replace(/\D/g, '');
                          if (digits.startsWith('212') && digits.length >= 11) return `0${digits.slice(3)}`;
                          if (digits.length === 9 && /^[567]/.test(digits)) return `0${digits}`;
                          if (digits.length >= 6) return digits;
                          return createdBooking.checkInToken || '';
                        })()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Client Grooming Notes Indicator */}
              {createdBooking.clientNotes && (
                <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 space-y-0.5 text-start">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Pencil className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span>
                      {pickLang(lang, {
                        ar: 'ملاحظات الزبون:',
                        fr: 'Notes Client :',
                        amz: 'ⵜⵉⵏⵏⴰⵢⵉⵏ ⵏ ⵓⵎⵙⴰⵖ:',
                        en: 'Client Notes:',
                        es: 'Notas del Cliente:',
                      })}
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
                    {pickLang(lang, {
                      ar: `تم إرفاق إيصال CIH: ${createdBooking.cihReceiptName}`,
                      fr: `Reçu CIH joint : ${createdBooking.cihReceiptName}`,
                      amz: `ⵜⴰⵏⴼⵓⵍⵜ CIH : ${createdBooking.cihReceiptName}`,
                      en: `CIH receipt attached: ${createdBooking.cihReceiptName}`,
                      es: `Recibo CIH adjunto: ${createdBooking.cihReceiptName}`,
                    })}
                  </span>
                </div>
              )}

              {/* Itemized Services + Queue Avoidance + Total Breakdown (Matches PNG Ticket) */}
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-1.5 text-xs">
                {(createdBooking.cartItemsSummary || []).map((item) => (
                  <div key={item.serviceId} className="flex items-center justify-between text-zinc-300 text-[11px]">
                    <span className="truncate">{item.name}</span>
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        item.finalPrice === 0 ? 'text-emerald-300 font-bold' : 'text-white'
                      }`}
                    >
                      {item.finalPrice === 0 ? `🎁 ${getGiftLabel(lang)}` : `${item.finalPrice} MAD`}
                    </span>
                  </div>
                ))}

                {createdTicketHasQueueSkip && (
                  <div className="flex items-center justify-between text-amber-300 text-[11px] font-semibold">
                    <span>
                      ⚡{' '}
                      {pickLang(lang, {
                        ar: 'خدمة تفادي الانتظار',
                        fr: 'Service Coupe-File',
                        amz: 'ⵜⴰⵏⴰⴼⵓⵜ ⵏ ⵓⵣⵔⴰⵢ',
                        en: 'Queue Avoidance',
                        es: 'Sin Espera',
                      })}
                    </span>
                    <span className="font-mono tabular-nums">+10 MAD</span>
                  </div>
                )}

                {(createdBooking.totalSavingsMAD ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-emerald-400 text-[11px] font-bold">
                    <span>
                      {pickLang(lang, {
                        ar: 'تخفيض / وفر الباقة',
                        fr: 'Remise / Économie',
                        amz: 'ⴰⵙⵙⵏⵇⵙ',
                        en: 'Discount / Savings',
                        es: 'Descuento / Ahorro',
                      })}
                    </span>
                    <span className="font-mono tabular-nums">-{createdBooking.totalSavingsMAD} MAD</span>
                  </div>
                )}

                <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">
                    {pickLang(lang, {
                      ar: 'المجموع النهائي للطلب:',
                      fr: 'Total de la réservation:',
                      amz: 'ⴰⵖⵔⵓⴷ ⴰⵎⴳⴳⴰⵔⵓ :',
                      en: 'Booking total:',
                      es: 'Total de la reserva:',
                    })}
                  </span>
                  <span className="text-base font-black text-amber-400 font-mono tabular-nums">
                    {createdBooking.finalTotalMAD} MAD
                  </span>
                </div>
              </div>
            </div>

            {/* Recommendation Banner for Instant Confirmation */}
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-500/50 text-center space-y-1 shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-amber-800 dark:text-amber-400 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse flex-shrink-0" />
                <span>
                  {pickLang(lang, {
                    ar: 'تأكيد فوري وسريع',
                    fr: 'Confirmation Rapide Recommandée',
                    amz: 'ⴰⵙⵏⵜⵎ ⵓⵙⵔⵉⴷ ⴷ ⵓⵔⵓⵔⴰⴷ',
                    en: 'Fast Confirmation Recommended',
                    es: 'Confirmación Rápida Recomendada',
                  })}
                </span>
              </div>
              <p className="text-[11px] text-amber-900 dark:text-amber-200/95 leading-relaxed font-semibold">
                {pickLang(lang, {
                  ar: 'للحصول على تأكيد ورد سريع، يُنصح بالتواصل معنا الآن عبر الواتساب أو الاتصال.',
                  fr: 'Pour une confirmation immédiate et un traitement prioritaire, nous vous recommandons vivement de nous contacter dès maintenant.',
                  amz: 'ⵉ ⵓⵙⵏⵜⵎ ⵓⵔⵓⵔⴰⴷ, ⵏⵢⴰⵍⴽⴰⵎ ⴷⵉⴷⵏⵖ ⵖⵉⵍⴰ ⴳ WhatsApp ⵏⵖ ⵜⵉⵍⵉⴼⵓⵏ.',
                  en: 'For immediate priority confirmation, we recommend contacting us now on WhatsApp or phone.',
                  es: 'Para confirmación inmediata y prioritaria, te recomendamos contactarnos ahora por WhatsApp o teléfono.',
                })}
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
                  ? pickLang(lang, {
                      ar: 'جاري تجهيز صورة التذكرة...',
                      fr: 'Génération du ticket PNG...',
                      amz: 'ⴰⵀⵢⵢⵓ ⵏ ⵜⵉⴽⵉ PNG...',
                      en: 'Generating ticket PNG...',
                      es: 'Generando ticket PNG...',
                    })
                  : pickLang(lang, {
                      ar: 'تحميل التذكرة (صورة PNG)',
                      fr: 'Télécharger le Ticket (PNG)',
                      amz: 'ⴰⴳⵎ ⵜⵉⴽⵉ (PNG)',
                      en: 'Download Ticket (PNG)',
                      es: 'Descargar Ticket (PNG)',
                    })}
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
                  {pickLang(lang, {
                    ar: `مراسلة الحلاق عبر الواتساب (${createdBooking.barberName})`,
                    fr: `WhatsApp avec le Barbier (${createdBooking.barberName})`,
                    amz: `WhatsApp ⴷ ⵓⵎⵥⵥⴰⵡ (${createdBooking.barberName})`,
                    en: `WhatsApp Barber (${createdBooking.barberName})`,
                    es: `WhatsApp al Barbero (${createdBooking.barberName})`,
                  })}
                </span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/${liveSalonWhatsappDigits}?text=${encodeURIComponent(
                    buildClientTicketWhatsAppMessage(createdBooking, lang)
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-emerald-300 dark:border-zinc-700 text-emerald-900 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {pickLang(lang, {
                      ar: 'واتساب حسن',
                      fr: 'WhatsApp Hassan',
                      amz: 'WhatsApp ⵃⴰⵙⴰⵏ',
                      en: 'WhatsApp Hassan',
                      es: 'WhatsApp Hassan',
                    })}
                  </span>
                </a>

                <a
                  href={normalizeSalonTelHref(salonSettings.salonPhone)}
                  className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span dir="ltr">{liveSalonDisplayPhone}</span>
                </a>
              </div>
            </div>

            {/* Quick Actions: Copy Ticket, Track, Close */}
            <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={() => handleCopyTicket(createdBooking.ticketNumber)}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>
                  {copiedTicket
                    ? pickLang(lang, {
                        ar: 'تم النسخ!',
                        fr: 'Copié !',
                        amz: 'ⵉⵜⵜⵓⵏⵖⵍ!',
                        en: 'Copied!',
                        es: '¡Copiado!',
                      })
                    : pickLang(lang, {
                        ar: 'نسخ رقم التذكرة',
                        fr: 'Copier le Ticket',
                        amz: 'ⵏⵖⵍ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⴽⵉ',
                        en: 'Copy Ticket Number',
                        es: 'Copiar Número de Ticket',
                      })}
                </span>
              </button>

              {onOpenTrackBooking && (
                <button
                  type="button"
                  onClick={() => {
                    const tNum = createdBooking.ticketNumber;
                    setCreatedBooking(null);
                    onOpenTrackBooking(tNum);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Ticket className="w-4 h-4" />
                  <span>
                    {pickLang(lang, {
                      ar: 'تتبع تذكرتي الآن',
                      fr: 'Suivre mon statut',
                      amz: 'ⴹⴼⵕ ⵜⵉⴽⵉ ⵉⵏⵓ',
                      en: 'Track My Ticket',
                      es: 'Seguir mi Ticket',
                    })}
                  </span>
                </button>
              )}

              {typeof window !== 'undefined' && 'Notification' in window && (
                notifSubscribedForTicket || Notification.permission === 'granted' ? (
                  <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {pickLang(lang, {
                        ar: 'إشعارات متابعة التذكرة مفعلة على هذا الجهاز ✓',
                        fr: 'Alertes en temps réel activées sur cet appareil ✓',
                        amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵜⵉⴽⵉ ⵔⵥⵎⵏ ✓',
                        en: 'Live ticket alerts enabled on this device ✓',
                        es: 'Alertas en tiempo real activadas en este dispositivo ✓',
                      })}
                    </span>
                  </div>
                ) : Notification.permission === 'default' ? (
                  <button
                    type="button"
                    onClick={() => setShowNotifConsentModal(true)}
                    className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <BellRing className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>
                      {pickLang(lang, {
                        ar: 'تفعيل إشعارات تأكيد الموعد ونقاط الولاء',
                        fr: 'Activer les alertes de confirmation et fidélité',
                        amz: 'ⵕⵥⵎ ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵙⵏⵜⵎ ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ',
                        en: 'Enable booking & loyalty alerts',
                        es: 'Activar alertas de cita y fidelidad',
                      })}
                    </span>
                  </button>
                ) : null
              )}

              <button
                type="button"
                onClick={() => {
                  setCreatedBooking(null);
                  setShowNotifConsentModal(false);
                  setCurrentStep(1);
                  if (onRequestClose) onRequestClose();
                }}
                className="w-full py-2 text-xs font-bold text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                {pickLang(lang, {
                  ar: 'إغلاق النافذة',
                  fr: 'Fermer',
                  amz: 'ⵇⵇⵏ',
                  en: 'Close',
                  es: 'Cerrar',
                })}
              </button>
            </div>

                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </MotionConfig>
      </ModalPortal>

      {createdBooking && (
        <NotificationConsentModal
          isOpen={showNotifConsentModal}
          ticketNumber={createdBooking.ticketNumber}
          clientName={createdBooking.clientName}
          clientPhone={createdBooking.clientPhone}
          lang={lang}
          onClose={() => setShowNotifConsentModal(false)}
          onSubscribed={(granted) => setNotifSubscribedForTicket(granted)}
        />
      )}

      <ReturningClientLookupModal
        isOpen={isReturningLookupOpen}
        lang={lang}
        liveBookings={liveBookings}
        crmClientsMap={crmClientsMap}
        onClose={() => setIsReturningLookupOpen(false)}
        onRecognized={handleClientRecognized}
        onSwitchToFirstTime={handleSelectFirstTime}
      />

    </section>
  );
};
