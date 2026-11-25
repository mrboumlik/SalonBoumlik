import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  Clock, 
  Clock3, 
  XCircle, 
  Trash2, 
  Phone, 
  MessageCircle, 
  Calendar, 
  User, 
  Filter, 
  Search, 
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Scissors,
  Check,
  RotateCcw,
  Save,
  ShieldCheck,
  Users,
  QrCode,
  Archive,
  CalendarDays,
  Sparkles,
  Camera,
  RefreshCw,
  Sliders,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Building2,
  MapPin,
  Settings,
  Star,
  ExternalLink,
  Image as ImageIcon,
  Award,
  Ban,
  ListPlus,
  UserCheck,
  Upload,
  Repeat,
  Coins,
  CalendarClock,
  BarChart3,
  Wallet,
  CreditCard,
  ScanLine,
  ChevronDown,
  ChevronUp,
  UserCog,
  UserPlus,
  Tag,
  KeyRound,
  Eye,
  MoreHorizontal
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  sendDualAlert,
  playNotificationSound,
  showToast
} from '../utils/notifications';
import { registerStaffPushSubscription } from '../utils/webPushClient';
import { 
  subscribeToBookings,
  updateBookingStatus, 
  updateBookingAdminNote,
  assignFlexibleBookingSlot,
  rescheduleBookingToNearestSlot,
  deleteBooking,
  matchesUniversalBookingQuery,
  normalizeMoroccanPhoneDigits,
  getBookingByTicket,
  checkInBookingByQr,
  markBookingCaisseLogged
} from '../utils/bookingStore';
import {
  buildClientTicketWhatsAppMessage,
  buildCreditWhatsAppReminderUrl,
  formatMoroccanWhatsAppNumber,
} from '../utils/whatsappAutomation';
import {
  useSalonProfileSettings,
  saveSalonProfileSettings,
} from '../utils/salonSettingsStore';
import {
  useBarberSchedules,
  getRankedAvailableSlotsForBarber,
} from '../utils/barberScheduleStore';
import {
  useCrmClients,
  getCrmDocId,
  toggleClientVip,
  recordClientNoShow,
  setClientBanStatus,
  confirmClientAttendance,
} from '../utils/crmStore';
import { computeLoyaltyProgress, getVerifiedVisitsCount } from '../utils/loyaltyEngine';
import { useWaitlist, addToWaitlist } from '../utils/waitlistStore';
import { useShiftRequests } from '../utils/shiftPlannerStore';
import { useFirestoreReviews } from '../utils/reviewsStore';
import {
  FinancialAnalyticsPanel,
  BarberSchedulePanel,
  CrmLoyaltyBlacklistPanel,
  WaitlistManagementPanel,
  LiveQueuePanel,
  getLiveQueueBookings,
  computeDailyCompletedRevenue,
} from './AdminEnterprisePanels';
import { AdminShiftPlannerPanel } from './AdminShiftPlannerPanel';
import { WeeklyWorkloadBarChart } from './WeeklyWorkloadBarChart';
import { LoyaltyPointsAdminPanel } from './LoyaltyPointsAdminPanel';
import { ResourcePlanningSummaryCharts } from './ResourcePlanningSummaryCharts';
import { AdminCaissePanel } from './AdminCaissePanel';
import { BarberProfileServicesPanel } from './BarberProfileServicesPanel';
import { MasterShopPricingPanel } from './MasterShopPricingPanel';
import { MasterTeamAccessPanel } from './MasterTeamAccessPanel';
import { MasterClientCreditsPanel } from './MasterClientCreditsPanel';
import { BookingSection } from './BookingSection';
import { useShopPricingConfig, resolveEffectiveServicePrices } from '../utils/shopPricingStore';
import { calculateCartPricing } from '../utils/pricingEngine';
import { getBarberIdentityTokens } from '../utils/barberIdentity';
import { useBarberRoster, authenticateStaffPin } from '../utils/barberRosterStore';
import { useBarberProfiles, getMergedBarbers } from '../utils/barberProfileStore';
import { safeStorageGet, safeStorageRemove, safeStorageSet } from '../utils/safeBrowser';
import {
  addCaisseEntry,
  getCaisseBarberMeta,
  getEffectiveCaisseCreditRemaining,
  matchesCaisseBarber,
  resolveCaisseBarberId,
  useCaisseEntries,
} from '../utils/caisseStore';
import {
  computeOutstandingCreditsForPhone,
  getEffectiveManualCreditRemaining,
  submitCreditSettlementRequest,
  useCreditDisputes,
  useCreditSettlementRequests,
  useManualClientCredits,
} from '../utils/creditRegistryStore';
import {
  ClientQrTarget,
  parseScannedQrResult,
  scanQrImageFile,
} from '../utils/clientQr';
import { ClientQrModal } from './ClientQrModal';
import { AdminQrCheckInGeneratorModal } from './AdminQrCheckInGeneratorModal';
import { AppointmentBooking, BookingStatus, CreditSettlementActionType, StaffRole } from '../types';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { safeCompareAsc, safeCompareDesc } from '../utils/safeCoerce';
import { ModalPortal } from './ModalPortal';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenClientTracking?: (searchQuery: string) => void;
}

interface StaffSession {
  barberId: string;
  name: string;
  role: StaffRole;
  title: string;
  memberId?: string;
}

const ADMIN_SESSION_STORAGE_KEY = 'salon_boumlik_admin_session_v1';
const ADMIN_NOTIFS_ENABLED_KEY = 'salon_boumlik_admin_notifs_enabled';

interface StoredAdminSession {
  session: StaffSession;
  expiresAt: number; // timestamp
}

const getLocalTodayDateStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const parseBookingStartMinutes = (timeSlot?: string): number => {
  if (!timeSlot) return 24 * 60 + 1;
  const clean = timeSlot.trim();
  if (clean === 'FLEXIBLE') return 24 * 60;
  const match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 24 * 60 + 1;
  return Number(match[1]) * 60 + Number(match[2]);
};

const readInitialAdminSession = (): StaffSession | null => {
  try {
    const raw = safeStorageGet(ADMIN_SESSION_STORAGE_KEY, 'local');
    if (raw) {
      const stored = JSON.parse(raw) as Partial<StoredAdminSession> | null;
      const s = stored?.session;
      if (
        stored &&
        typeof stored.expiresAt === 'number' &&
        stored.expiresAt > Date.now() &&
        s &&
        typeof s === 'object' &&
        typeof s.barberId === 'string' &&
        s.barberId.trim().length > 0 &&
        typeof s.name === 'string' &&
        (s.role === 'master' || s.role === 'barber' || s.role === 'caisse')
      ) {
        return s;
      }
      safeStorageRemove(ADMIN_SESSION_STORAGE_KEY, 'local');
    }
  } catch (e) {
    console.warn('Error reading admin session:', e);
    safeStorageRemove(ADMIN_SESSION_STORAGE_KEY, 'local');
  }
  return null;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  onOpenClientTracking,
}) => {
  const { lang, isRtl } = useLanguage();
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const [pinInput, setPinInput] = useState('');
  const initialSessionRef = useRef<StaffSession | null>(readInitialAdminSession());

  // Initialize session from localStorage with 7-day expiration check
  const [session, setSession] = useState<StaffSession | null>(initialSessionRef.current);

  const [pinError, setPinError] = useState(false);
  const [bookings, setBookings] = useState<AppointmentBooking[]>([]);
  
  // Notification toggle state: stored safely with storage fallback
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    const saved = safeStorageGet(ADMIN_NOTIFS_ENABLED_KEY, 'local');
    if (saved === null) return true;
    return saved === 'true';
  });

  // Track known booking IDs, CIH receipts, and waitlist entries across real-time Firestore snapshot updates
  const knownBookingIdsRef = useRef<Set<string>>(new Set());
  const knownCihReceiptMapRef = useRef<Record<string, string>>({});
  const hasLoadedInitialSnapshotRef = useRef<boolean>(false);
  const knownWaitlistIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedWaitlistRef = useRef<boolean>(false);
  const notificationsEnabledRef = useRef<boolean>(notificationsEnabled);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  // Enterprise Workspace View — Barbers & Caisse ALWAYS land Caisse-first!
  type WorkspaceSectionType =
    | 'bookings'
    | 'queue'
    | 'summary'
    | 'schedules'
    | 'shifts'
    | 'crm'
    | 'loyalty'
    | 'analytics'
    | 'waitlist'
    | 'caisse'
    | 'profile'
    | 'pricing'
    | 'staff'
    | 'credits';

  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSectionType>(() =>
    initialSessionRef.current?.role === 'barber' || initialSessionRef.current?.role === 'caisse'
      ? 'caisse'
      : 'bookings'
  );

  const [expandedBookingIds, setExpandedBookingIds] = useState<Record<string, boolean>>({});
  const [openBookingActionsId, setOpenBookingActionsId] = useState<string | null>(null);
  const [showPastTodaySlots, setShowPastTodaySlots] = useState(false);
  type BookingKpiModalKind =
    | 'today_all'
    | 'pending'
    | 'confirmed'
    | 'rejected'
    | 'queue_active'
    | 'queue_future'
    | 'queue_done';
  const [bookingKpiModal, setBookingKpiModal] = useState<BookingKpiModalKind | null>(null);
  const [deleteTargetBooking, setDeleteTargetBooking] = useState<AppointmentBooking | null>(null);
  const [deleteBookingCreditAck, setDeleteBookingCreditAck] = useState(false);
  const [deleteBookingBusy, setDeleteBookingBusy] = useState(false);
  const [rejectTargetBookingId, setRejectTargetBookingId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('');
  const [rejectBookingBusy, setRejectBookingBusy] = useState(false);

  // Version 2.0 Live Enterprise Hooks
  const barberRoster = useBarberRoster();
  const barberProfiles = useBarberProfiles();
  const mergedBarbers = getMergedBarbers(barberProfiles, barberRoster);
  const barberSchedules = useBarberSchedules();
  const crmClientsMap = useCrmClients();
  const waitlistEntries = useWaitlist();
  const shiftRequests = useShiftRequests();
  const { reviews: firestoreReviews } = useFirestoreReviews();
  const caisseEntries = useCaisseEntries();
  const manualCredits = useManualClientCredits();
  const creditDisputes = useCreditDisputes();
  const settlementRequests = useCreditSettlementRequests();
  const adminScrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Real-time session sync against live Firestore roster (keeps role/name synced across devices & revokes archived staff)
  useEffect(() => {
    if (!session || barberRoster.length === 0) return;
    const matched = barberRoster.find(
      (m) =>
        (session.memberId && m.id === session.memberId) ||
        (session.role === 'barber' && m.id === session.barberId) ||
        (session.role === 'caisse' && m.role === 'caisse' && m.nameFr === session.name)
    );
    if (!matched) return;
    if (session.role !== 'master' && matched.status === 'archived') {
      safeStorageRemove(ADMIN_SESSION_STORAGE_KEY, 'local');
      setSession(null);
      setPinInput('');
      setPinError(false);
      return;
    }
    const nextBarberId =
      matched.role === 'master' || matched.role === 'caisse'
        ? 'all'
        : matched.id;
    const nextName = matched.nameAr || matched.nameFr || session.name;
    const nextRole = matched.role;
    const nextTitle =
      nextRole === 'master'
        ? 'Master Admin / المؤسس وخبير الحلاقة'
        : nextRole === 'caisse'
        ? 'لاكيس / Caisse Salon'
        : 'Barbier / حلاق';
    if (
      session.barberId !== nextBarberId ||
      session.name !== nextName ||
      session.role !== nextRole ||
      session.memberId !== matched.id
    ) {
      const updatedSession: StaffSession = {
        ...session,
        barberId: nextBarberId,
        name: nextName,
        role: nextRole,
        title: nextTitle,
        memberId: matched.id,
      };
      setSession(updatedSession);
      try {
        const raw = safeStorageGet(ADMIN_SESSION_STORAGE_KEY, 'local');
        const parsed: StoredAdminSession | null = raw ? JSON.parse(raw) : null;
        safeStorageSet(
          ADMIN_SESSION_STORAGE_KEY,
          JSON.stringify({
            session: updatedSession,
            expiresAt: parsed?.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000,
          }),
          'local'
        );
      } catch {
        // Ignore storage errors
      }
    }
  }, [barberRoster, session]);

  // Non-blocking booking card & Caisse prompt settlement request state
  const [bookingSettlementOpenId, setBookingSettlementOpenId] = useState<string | null>(null);
  const [bookingSettlementAction, setBookingSettlementAction] = useState<CreditSettlementActionType>('pay');
  const [bookingSettlementTargetBarberId, setBookingSettlementTargetBarberId] = useState<string>('all');
  const [bookingSettlementAmount, setBookingSettlementAmount] = useState<string>('');
  const [bookingSettlementNote, setBookingSettlementNote] = useState<string>('');
  const [bookingSettlementBusy, setBookingSettlementBusy] = useState<boolean>(false);

  // Barber-scoped Credit tab settlement request state
  const [barberCreditReqKey, setBarberCreditReqKey] = useState<string | null>(null);
  const [barberCreditReqAction, setBarberCreditReqAction] = useState<CreditSettlementActionType>('pay');
  const [barberCreditReqAmount, setBarberCreditReqAmount] = useState<string>('');
  const [barberCreditReqNote, setBarberCreditReqNote] = useState<string>('');
  const [barberCreditReqBusy, setBarberCreditReqBusy] = useState<boolean>(false);

  // Prompt modal settlement mini-panel
  const [promptCreditActionOpen, setPromptCreditActionOpen] = useState<boolean>(false);
  const [promptCreditActionType, setPromptCreditActionType] = useState<CreditSettlementActionType>('pay');
  const [promptCreditActionTargetBarber, setPromptCreditActionTargetBarber] = useState<string>('all');
  const [promptCreditActionAmount, setPromptCreditActionAmount] = useState<string>('');
  const [promptCreditActionNote, setPromptCreditActionNote] = useState<string>('');
  const [promptCreditActionBusy, setPromptCreditActionBusy] = useState<boolean>(false);

  // Date Views: 'today' (Upcoming Queue) or 'archive'
  const [activeTab, setActiveTab] = useState<'today' | 'archive'>('today');
  const [archiveDateFilter, setArchiveDateFilter] = useState<string>('');

  // Status Filter: 'all', 'pending', 'confirmed', 'completed', 'rejected'
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'confirmed' | 'completed' | 'rejected'
  >('all');
  const [masterBarberFilter, setMasterBarberFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // QR Scanner Modal & Camera Controls
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannerCameraError, setScannerCameraError] = useState<string | null>(null);
  const [scannedTicketNotice, setScannedTicketNotice] = useState<string | null>(null);
  const [scannedLookupQuery, setScannedLookupQuery] = useState<string | null>(null);
  const [scannerActionMode, setScannerActionMode] = useState<'checkin' | 'tracking' | 'filter'>('checkin');
  const [qrTargetClient, setQrTargetClient] = useState<ClientQrTarget | null>(null);
  const [isQrGeneratorOpen, setIsQrGeneratorOpen] = useState(false);

  // Arrival Check-In Confirmation Modal (from QR Check-In scan)
  const [checkInConfirmModal, setCheckInConfirmModal] = useState<{
    booking: AppointmentBooking;
    tokenMatched: boolean;
  } | null>(null);

  // Attendance-to-Caisse Prompt Modal (triggered ONLY on Attended/Completed — never on booking creation)
  const [caissePromptBooking, setCaissePromptBooking] = useState<AppointmentBooking | null>(null);
  const [caissePromptPaid, setCaissePromptPaid] = useState<string>('');
  const [caissePromptExpected, setCaissePromptExpected] = useState<string>('');
  const [caissePromptHasCredit, setCaissePromptHasCredit] = useState<boolean>(false);
  const [caissePromptClientName, setCaissePromptClientName] = useState<string>('');
  const [caissePromptClientPhone, setCaissePromptClientPhone] = useState<string>('');
  const [caissePromptRepayDate, setCaissePromptRepayDate] = useState<string>('');
  const [caissePromptNote, setCaissePromptNote] = useState<string>('');
  const [caissePromptBusy, setCaissePromptBusy] = useState<boolean>(false);

  // Reschedule dialog state
  const [reschedulingBooking, setReschedulingBooking] = useState<AppointmentBooking | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('17:00');
  const [rescheduleNote, setRescheduleNote] = useState('');

  // Per-booking client note state
  const [notesState, setNotesState] = useState<Record<string, string>>({});
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  // Google Business & Salon Links Settings
  const salonSettings = useSalonProfileSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quickActionBusyId, setQuickActionBusyId] = useState<string | null>(null);
  const [lateActionBusyId, setLateActionBusyId] = useState<string | null>(null);
  const [flexAssignBusyId, setFlexAssignBusyId] = useState<string | null>(null);
  const [flexCustomTargetId, setFlexCustomTargetId] = useState<string | null>(null);
  const [flexCustomDate, setFlexCustomDate] = useState('');
  const [flexCustomTime, setFlexCustomTime] = useState('16:00');
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInBarberId, setWalkInBarberId] = useState<string>('hassan');
  const [walkInServiceIds, setWalkInServiceIds] = useState<string[]>(['haircut']);
  const shopPricingConfig = useShopPricingConfig();

  const [mapsUrlInput, setMapsUrlInput] = useState(salonSettings.googleMapsUrl);
  const [reviewUrlInput, setReviewUrlInput] = useState(salonSettings.googleReviewUrl);
  const [salonPhoneInput, setSalonPhoneInput] = useState(salonSettings.salonPhone || SALON_INFO.phone);
  const [salonWhatsappInput, setSalonWhatsappInput] = useState(
    salonSettings.salonWhatsapp || SALON_INFO.whatsappNumber
  );
  const [additionalPhonesText, setAdditionalPhonesText] = useState(
    (salonSettings.additionalPhones || []).join('\n')
  );
  const [savingProfileLinks, setSavingProfileLinks] = useState(false);
  const [profileLinksSaved, setProfileLinksSaved] = useState(false);
  const [profileLinksError, setProfileLinksError] = useState<string | null>(null);

  // CIH Bank Transfer Receipt Preview Modal
  const [previewReceipt, setPreviewReceipt] = useState<{
    ticketNumber: string;
    clientName: string;
    fileName: string;
    src: string;
  } | null>(null);

  useEffect(() => {
    setMapsUrlInput(salonSettings.googleMapsUrl);
    setReviewUrlInput(salonSettings.googleReviewUrl);
    setSalonPhoneInput(salonSettings.salonPhone || SALON_INFO.phone);
    setSalonWhatsappInput(salonSettings.salonWhatsapp || SALON_INFO.whatsappNumber);
    setAdditionalPhonesText((salonSettings.additionalPhones || []).join('\n'));
  }, [
    salonSettings.googleMapsUrl,
    salonSettings.googleReviewUrl,
    salonSettings.salonPhone,
    salonSettings.salonWhatsapp,
    salonSettings.additionalPhones,
  ]);

  const [nowClock, setNowClock] = useState<Date>(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNowClock(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = `${nowClock.getFullYear()}-${String(nowClock.getMonth() + 1).padStart(2, '0')}-${String(nowClock.getDate()).padStart(2, '0')}` || getLocalTodayDateStr();
  const nowMinutes = nowClock.getHours() * 60 + nowClock.getMinutes();

  const walkInShopPricing = resolveEffectiveServicePrices({
    dateStr: todayStr,
    shopConfig: shopPricingConfig,
  });
  const walkInPricingResult = calculateCartPricing({
    selectedIds: walkInServiceIds,
    colorConfig: { tone: 'grey_white', coverage: 'full' },
    proteinPrice: 200,
    lang,
    effectiveServicePrices: walkInShopPricing.priceMap,
    specialRuleLabel: walkInShopPricing.activeSpecialRuleLabels[0],
    hiddenServiceIds: shopPricingConfig.hiddenServiceIds,
    serviceBundles: shopPricingConfig.serviceBundles,
  });

  // Check for newly created bookings pushed by Firestore onSnapshot and trigger dual alert
  const handleSnapshotBookings = (currentList: AppointmentBooking[]) => {
    setBookings(currentList);

    // Populate initial note values for any unseen bookings without overwriting active edits
    setNotesState((prev) => {
      const next = { ...prev };
      currentList.forEach((b) => {
        if (next[b.id] === undefined) {
          next[b.id] = b.adminNotes || '';
        }
      });
      return next;
    });

    if (!hasLoadedInitialSnapshotRef.current) {
      hasLoadedInitialSnapshotRef.current = true;
      knownBookingIdsRef.current = new Set(currentList.map((b) => b.id));
      const initialCih: Record<string, string> = {};
      currentList.forEach((b) => {
        if (b.cihReceiptUploadedAt || b.cihReceiptName) {
          initialCih[b.id] = b.cihReceiptUploadedAt || b.cihReceiptName || '1';
        }
      });
      knownCihReceiptMapRef.current = initialCih;
      return;
    }

    const prevKnown = knownBookingIdsRef.current;
    const prevCihMap = knownCihReceiptMapRef.current;
    const newItems = currentList.filter((b) => !prevKnown.has(b.id));
    const newlyUploadedCih = currentList.filter((b) => {
      if (!prevKnown.has(b.id)) return false;
      const sig = b.cihReceiptUploadedAt || b.cihReceiptName || '';
      return Boolean(sig && prevCihMap[b.id] !== sig);
    });

    const matchesCurrentStaffScope = (b: AppointmentBooking) => {
      if (!session || session.role === 'master' || session.role === 'caisse') return true;
      return (
        b.barberId === session.barberId ||
        b.barberName.toLowerCase().includes(session.name.toLowerCase().split(' ')[0])
      );
    };

    if (newItems.length > 0) {
      newItems.forEach((nb) => {
        prevKnown.add(nb.id);
        if (nb.cihReceiptUploadedAt || nb.cihReceiptName) {
          prevCihMap[nb.id] = nb.cihReceiptUploadedAt || nb.cihReceiptName || '1';
        }
      });

      if (notificationsEnabledRef.current) {
        const curLang = langRef.current;
        newItems.filter(matchesCurrentStaffScope).forEach((nb) => {
          const isFlex = nb.status === 'flexible_pending' || nb.timeSlot === 'FLEXIBLE';
          const timeText = isFlex
            ? pickLang(curLang, {
                ar: 'وقت مرن — بانتظار اختيارك',
                fr: 'Horaire flexible — en attente',
                amz: 'ⴰⴽⵓⴷ ⵉⴼⵙⵙⵓⵙⵏ — ⴳ ⵓⵔⴰⵊⵓ',
                en: 'Flexible time — awaiting choice',
                es: 'Horario flexible — pendiente',
              })
            : nb.timeSlot;
          sendDualAlert(
            isFlex
              ? pickLang(curLang, {
                  ar: `⏳ طلب وقت مرن (${nb.ticketNumber}) • صالون بومليك`,
                  fr: `⏳ Demande horaire flexible (${nb.ticketNumber}) • Salon Boumlik`,
                  amz: `⏳ ⵜⵓⵜⵜⵔⴰ ⵏ ⵡⴰⴽⵓⴷ ⵉⴼⵙⵙⵓⵙⵏ (${nb.ticketNumber}) • Salon Boumlik`,
                  en: `⏳ Flexible Time Request (${nb.ticketNumber}) • Salon Boumlik`,
                  es: `⏳ Solicitud de horario flexible (${nb.ticketNumber}) • Salon Boumlik`,
                })
              : pickLang(curLang, {
                  ar: `🔔 موعد جديد (${nb.ticketNumber}) • صالون بومليك`,
                  fr: `🔔 Nouveau rendez-vous (${nb.ticketNumber}) • Salon Boumlik`,
                  amz: `🔔 ⴰⵙⵉⵀⴰⵔ ⴰⵎⴰⵢⵏⵓ (${nb.ticketNumber}) • Salon Boumlik`,
                  en: `🔔 New Appointment (${nb.ticketNumber}) • Salon Boumlik`,
                  es: `🔔 Nueva cita (${nb.ticketNumber}) • Salon Boumlik`,
                }),
            {
              body: nb.cihReceiptName
                ? pickLang(curLang, {
                    ar: `حجز #${nb.ticketNumber} - ${nb.clientName} مع ${nb.barberName} (${nb.date} ${timeText}) مع إيصال CIH.`,
                    fr: `Ticket #${nb.ticketNumber} - ${nb.clientName} avec ${nb.barberName} (${nb.date} ${timeText}) avec reçu CIH.`,
                    amz: `ⴰⵏⵜⵜⵉⴽⵉ #${nb.ticketNumber} - ${nb.clientName} ⴷ ${nb.barberName} (${nb.date} ${timeText}) ⵙ ⵜⴰⵡⵔⵉⵇⵜ CIH.`,
                    en: `Booking #${nb.ticketNumber} - ${nb.clientName} with ${nb.barberName} (${nb.date} ${timeText}) with CIH receipt.`,
                    es: `Reserva #${nb.ticketNumber} - ${nb.clientName} con ${nb.barberName} (${nb.date} ${timeText}) con recibo CIH.`,
                  })
                : pickLang(curLang, {
                    ar: `حجز #${nb.ticketNumber} - ${nb.clientName} مع ${nb.barberName} (${nb.date} ${timeText}).`,
                    fr: `Ticket #${nb.ticketNumber} - ${nb.clientName} avec ${nb.barberName} (${nb.date} ${timeText}).`,
                    amz: `ⴰⵏⵜⵜⵉⴽⵉ #${nb.ticketNumber} - ${nb.clientName} ⴷ ${nb.barberName} (${nb.date} ${timeText}).`,
                    en: `Booking #${nb.ticketNumber} - ${nb.clientName} with ${nb.barberName} (${nb.date} ${timeText}).`,
                    es: `Reserva #${nb.ticketNumber} - ${nb.clientName} con ${nb.barberName} (${nb.date} ${timeText}).`,
                  }),
              type: 'info',
              tag: `sb-admin-booking-${nb.id}`,
              data: { ticketNumber: nb.ticketNumber, url: '/#admin' },
            }
          );
        });
      }
    }

    if (newlyUploadedCih.length > 0) {
      newlyUploadedCih.forEach((b) => {
        prevCihMap[b.id] = b.cihReceiptUploadedAt || b.cihReceiptName || '1';
      });

      if (notificationsEnabledRef.current) {
        const curLang = langRef.current;
        newlyUploadedCih.filter(matchesCurrentStaffScope).forEach((b) => {
          sendDualAlert(
            pickLang(curLang, {
              ar: `🧾 إيصال تحويل CIH جديد (${b.ticketNumber})`,
              fr: `🧾 Nouveau reçu de virement CIH (${b.ticketNumber})`,
              amz: `🧾 ⵜⴰⵡⵔⵉⵇⵜ ⵜⴰⵎⴰⵢⵏⵓⵜ CIH (${b.ticketNumber})`,
              en: `🧾 New CIH Bank Receipt (${b.ticketNumber})`,
              es: `🧾 Nuevo recibo CIH (${b.ticketNumber})`,
            }),
            {
              body: pickLang(curLang, {
                ar: `قام الزبون ${b.clientName} بإرفاق إيصال التحويل البنكي CIH لموعد ${b.date} (${b.timeSlot}).`,
                fr: `${b.clientName} a joint un reçu de virement CIH pour le ${b.date} (${b.timeSlot}).`,
                amz: `${b.clientName} ⵉⵔⵏⴰ ⵜⴰⵡⵔⵉⵇⵜ CIH ⵉ ⵡⴰⵙⵙ ${b.date} (${b.timeSlot}).`,
                en: `${b.clientName} attached a CIH bank transfer receipt for ${b.date} (${b.timeSlot}).`,
                es: `${b.clientName} adjuntó un recibo bancario CIH para el ${b.date} (${b.timeSlot}).`,
              }),
              type: 'success',
              tag: `sb-admin-cih-${b.id}`,
              data: { ticketNumber: b.ticketNumber, url: '/#admin' },
            }
          );
        });
      }
    }
  };

  // Real-time Firestore synchronization via onSnapshot whenever staff session is active
  useEffect(() => {
    if (!session) {
      hasLoadedInitialSnapshotRef.current = false;
      knownBookingIdsRef.current = new Set();
      knownCihReceiptMapRef.current = {};
      hasLoadedWaitlistRef.current = false;
      knownWaitlistIdsRef.current = new Set();
      return;
    }

    // Silently keep push subscription synced if permission was already granted by staff
    if (
      session.role !== 'caisse' &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      void registerStaffPushSubscription({
        role: session.role,
        barberId: session.barberId,
        staffName: session.name,
      });
    }

    const unsubscribe = subscribeToBookings(
      (liveBookings) => {
        handleSnapshotBookings(liveBookings);
      },
      (error) => {
        console.error('AdminDashboard Firestore stream error:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [session]);

  // Real-time Staff Waitlist Alert Listener (Master Admin + Assigned Barber)
  useEffect(() => {
    if (!session) return;
    if (!hasLoadedWaitlistRef.current) {
      hasLoadedWaitlistRef.current = true;
      knownWaitlistIdsRef.current = new Set(waitlistEntries.map((w) => w.id));
      return;
    }

    const prevKnown = knownWaitlistIdsRef.current;
    const newEntries = waitlistEntries.filter(
      (w) => !prevKnown.has(w.id) && w.status === 'waiting'
    );
    waitlistEntries.forEach((w) => prevKnown.add(w.id));

    if (newEntries.length > 0 && notificationsEnabledRef.current) {
      const curLang = langRef.current;
      newEntries
        .filter(
          (w) =>
            session.role === 'master' ||
            session.role === 'caisse' ||
            w.barberId === session.barberId
        )
        .forEach((w) => {
          sendDualAlert(
            pickLang(curLang, {
              ar: '📋 زبون جديد في قائمة الانتظار!',
              fr: '📋 Nouveau client en liste d’attente !',
              amz: '📋 ⴰⵎⵣⴷⴰⵖ ⴰⵎⴰⵢⵏⵓ ⴳ ⵜⵍⴳⴰⵎⵜ ⵏ ⵓⵔⴰⵊⵓ !',
              en: '📋 New Client on the Waitlist!',
              es: '📋 ¡Nuevo cliente en lista de espera!',
            }),
            {
              body: `${w.clientName} (${w.barberName} • ${w.date} ${w.preferredTime})`,
              type: 'info',
              tag: `sb-admin-wl-${w.id}`,
              data: { url: '/#admin' },
            }
          );
        });
    }
  }, [waitlistEntries, session]);

  // Handler to open scanner with instant browser native permission request (navigator.mediaDevices.getUserMedia)
  const handleOpenScanner = async () => {
    setScannerCameraError(null);
    setIsScannerOpen(true);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacingMode },
        });
        // Immediately stop temporary test tracks after obtaining permission
        stream.getTracks().forEach((track) => track.stop());
      } catch (err: any) {
        console.warn('Initial camera permission request warning:', err);
      }
    }
  };

  // Switch between Rear (environment) and Front (user) camera
  const handleToggleCamera = () => {
    setCameraFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Unified QR Scan Result Handler (Booking Check-In QR, Client Profile QR, or Ticket QR)
  const handleDecodedQrResult = async (rawDecodedText: string) => {
    const parsed = parseScannedQrResult(rawDecodedText);
    const lookup = parsed.query || rawDecodedText.trim();
    if (!lookup) return;

    setSearchQuery(lookup);
    setScannedLookupQuery(lookup);

    // 1. Unique Check-In QR Scan for Arrival Registration
    if (
      parsed.kind === 'checkin' ||
      (scannerActionMode === 'checkin' && parsed.kind === 'ticket')
    ) {
      setScannedTicketNotice(
        pickLang(lang, {
          ar: `تم مسح رمز الوصول Check-In للتذكرة: ${lookup}`,
          fr: `QR Check-In scanné pour le ticket : ${lookup}`,
          amz: `ⵉⵜⵜⵓⵙⴽⴰⵏⴰ QR ⵏ ⵡⴰⴽⵛⵓⵎ : ${lookup}`,
          en: `Check-In QR scanned for ticket: ${lookup}`,
          es: `QR de llegada escaneado para el ticket: ${lookup}`,
        })
      );
      try {
        const cleanTarget = lookup.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
        const parsedPhoneDigits = (parsed.checkInToken || lookup).replace(/\D/g, '').slice(-9);
        let matched =
          bookings.find((b) => {
            const bPhoneDigits = String(b.clientPhone || '').replace(/\D/g, '').slice(-9);
            return (
              b.ticketNumber.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() === cleanTarget ||
              (parsed.checkInToken && b.checkInToken === parsed.checkInToken) ||
              (parsedPhoneDigits.length >= 8 && bPhoneDigits === parsedPhoneDigits)
            );
          }) || null;
        if (!matched) {
          matched = (await getBookingByTicket(lookup)) || null;
        }

        if (matched) {
          const updated = await checkInBookingByQr(matched.id);
          const resolvedBooking = updated || matched;
          const bPhoneDigits = String(resolvedBooking.clientPhone || '').replace(/\D/g, '').slice(-9);
          const tokenMatched =
            !parsed.checkInToken ||
            !resolvedBooking.checkInToken ||
            parsed.checkInToken === resolvedBooking.checkInToken ||
            (parsedPhoneDigits.length >= 8 && bPhoneDigits === parsedPhoneDigits);
          setCheckInConfirmModal({ booking: resolvedBooking, tokenMatched });
          playNotificationSound();
          sendDualAlert(
            pickLang(lang, {
              ar: `✓ تم تسجيل وصول ${resolvedBooking.clientName}`,
              fr: `✓ Arrivée enregistrée : ${resolvedBooking.clientName}`,
              amz: `✓ ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵙⵉⴹ ⵏ ${resolvedBooking.clientName}`,
              en: `✓ Checked in ${resolvedBooking.clientName}`,
              es: `✓ Llegada registrada: ${resolvedBooking.clientName}`,
            }),
            {
              body: `${resolvedBooking.ticketNumber} • ${resolvedBooking.barberName}`,
              type: 'success',
              skipSound: true,
            }
          );
          return;
        }
      } catch (err) {
        console.error('QR Check-in lookup failed:', err);
      }
    }

    setScannedTicketNotice(
      parsed.kind === 'client'
        ? pickLang(lang, {
            ar: `تم مسح رمز ملف الزبون: ${lookup}`,
            fr: `Profil client scanné : ${lookup}`,
            amz: `ⵉⵜⵜⵓⵙⴽⴰⵏⴰ ⵓⵙⴷⴰⵡ ⵏ ⵓⵎⵣⴷⴰⵖ : ${lookup}`,
            en: `Client profile QR scanned: ${lookup}`,
            es: `QR de perfil de cliente escaneado: ${lookup}`,
          })
        : pickLang(lang, {
            ar: `تم مسح التذكرة / الرمز: ${lookup}`,
            fr: `Ticket / Code scanné : ${lookup}`,
            amz: `ⵉⵜⵜⵓⵙⴽⴰⵏⴰ ⵓⵏⵜⵜⵉⴽⵉ : ${lookup}`,
            en: `Ticket / Code scanned: ${lookup}`,
            es: `Ticket / Código escaneado: ${lookup}`,
          })
    );

    const shouldOpenTracking =
      Boolean(onOpenClientTracking) &&
      (parsed.kind === 'client' || scannerActionMode === 'tracking');

    if (shouldOpenTracking && onOpenClientTracking) {
      onOpenClientTracking(lookup);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم فتح نافذة تتبع الزبون ✓',
          fr: 'Suivi client ouvert ✓',
          amz: 'ⵉⵏⵏⵓⵔⵣⵎ ⵓⴹⴼⴰⵕ ⵏ ⵓⵎⵣⴷⴰⵖ ✓',
          en: 'Client Tracking Opened ✓',
          es: 'Seguimiento de cliente abierto ✓',
        }),
        {
          body: pickLang(lang, {
            ar: `عرض الملف والولاء المباشر لـ: ${lookup}`,
            fr: `Affichage du profil et de la fidélité pour : ${lookup}`,
            amz: `ⴰⵙⴼⵙⵔ ⵏ ⵓⵙⴷⴰⵡ ⴷ ⵜⵉⵖⵓⴷⴰ ⵉ : ${lookup}`,
            en: `Showing live profile & loyalty for: ${lookup}`,
            es: `Mostrando perfil y fidelidad en vivo para: ${lookup}`,
          }),
          type: 'success',
          skipSound: true,
        }
      );
    }
  };

  const handleAdminQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScannerCameraError(null);
    try {
      const decodedText = await scanQrImageFile(file, 'admin-qr-file-temp');
      setIsScannerOpen(false);
      handleDecodedQrResult(decodedText);
    } catch (err) {
      console.error('Admin QR image scan error:', err);
      setScannerCameraError(
        pickLang(lang, {
          ar: 'تعذر قراءة رمز QR من هذه الصورة. تأكد من وضوح الرمز.',
          fr: 'Impossible de lire le QR depuis cette image. Vérifiez la netteté.',
          amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵖⵔ QR ⵙⴳ ⵜⵡⵍⴰⴼⵜ ⴰⴷ.',
          en: 'Unable to read QR code from this image. Please check clarity.',
          es: 'No se pudo leer el código QR de esta imagen. Verifica la claridad.',
        })
      );
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // QR Scanner initialization using Html5Qrcode with forced rear/environment camera by default
  useEffect(() => {
    if (!isScannerOpen) return;

    let html5Qr: Html5Qrcode | null = null;
    let isStopped = false;

    const timer = setTimeout(async () => {
      try {
        const container = document.getElementById('qr-reader-container');
        if (!container) return;

        html5Qr = new Html5Qrcode('qr-reader-container');

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5Qr.start(
          { facingMode: cameraFacingMode },
          config,
          (decodedText) => {
            if (isStopped) return;
            isStopped = true;
            if (html5Qr && html5Qr.isScanning) {
              html5Qr.stop().then(() => html5Qr?.clear()).catch(console.error);
            }
            setIsScannerOpen(false);
            handleDecodedQrResult(decodedText);
          },
          () => {
            // scanning frame noise, ignore
          }
        );
      } catch (err: any) {
        console.error('Html5Qrcode scanner failed to start:', err);
        setScannerCameraError(
          err?.message ||
            pickLang(lang, {
              ar: 'تعذر الوصول إلى الكاميرا. يرجى التحقق من أذونات المتصفح.',
              fr: 'Impossible d’accéder à la caméra. Vérifiez les autorisations du navigateur.',
              amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵍⴽⵎ ⵜⴰⴽⴰⵎⵉⵕⴰ. ⵙⵙⵏⵇⴷ ⵜⵉⵙⵓⵔⵉⴼⵉⵏ.',
              en: 'Unable to access camera. Please check your browser permissions.',
              es: 'No se puede acceder a la cámara. Verifica los permisos del navegador.',
            })
        );
      }
    }, 250);

    return () => {
      isStopped = true;
      clearTimeout(timer);
      if (html5Qr && html5Qr.isScanning) {
        html5Qr.stop().then(() => html5Qr?.clear()).catch(console.error);
      }
    };
  }, [isScannerOpen, cameraFacingMode, scannerActionMode]);

  if (!isOpen) return null;

  // RBAC Authentication via Firestore-backed dynamic roster + emergency recovery
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = authenticateStaffPin(pinInput, barberRoster);

    const newSession: StaffSession | null = matched
      ? {
          barberId:
            matched.role === 'master' || matched.role === 'caisse'
              ? 'all'
              : matched.barberId || matched.memberId,
          name: matched.name,
          role: matched.role,
          title:
            matched.role === 'master'
              ? 'Master Admin / المؤسس وخبير الحلاقة'
              : matched.role === 'caisse'
                ? 'لاكيس / Caisse Salon'
                : 'Barbier / حلاق',
          memberId: matched.memberId,
        }
      : null;

    if (newSession) {
      // Persist session for 7 days (7 * 24 * 60 * 60 * 1000 ms)
      const stored: StoredAdminSession = {
        session: newSession,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      safeStorageSet(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(stored), 'local');

      setSession(newSession);
      setWorkspaceSection(
        newSession.role === 'barber' || newSession.role === 'caisse'
          ? 'caisse'
          : 'bookings'
      );
      setPinError(false);
      setPinInput('');

      // Silently register push subscription ONLY if staff already granted permission
      if (
        newSession.role !== 'caisse' &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        void registerStaffPushSubscription({
          role: newSession.role,
          barberId: newSession.barberId,
          staffName: newSession.name,
        });
      }
      return;
    }

    // Invalid PIN
    setPinError(true);
    setPinInput('');
  };

  const handleLogout = () => {
    safeStorageRemove(ADMIN_SESSION_STORAGE_KEY, 'local');
    setSession(null);
    setPinInput('');
    setPinError(false);
  };

  // Toggle Notifications with explicit user-gesture PushManager subscription & chime
  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      const subResult =
        session && session.role !== 'caisse'
          ? await registerStaffPushSubscription({
              role: session.role,
              barberId: session.barberId,
              staffName: session.name,
            })
          : { granted: false, subscribed: false };

      setNotificationsEnabled(true);
      safeStorageSet(ADMIN_NOTIFS_ENABLED_KEY, 'true', 'local');

      playNotificationSound();
      showToast(
        subResult.subscribed
          ? pickLang(lang, {
              ar: 'تم تفعيل الإشعارات الفورية والخلفية ✓',
              fr: 'Notifications push activées ✓',
              amz: 'ⵜⵓⵏⵏⵓⵏⵉⵏ ⵉⵜⵜⵓⵙⵎⵔⵏ ✓',
              en: 'Push notifications enabled ✓',
              es: 'Notificaciones push activadas ✓',
            })
          : pickLang(lang, {
              ar: 'تم تفعيل التنبيهات الصوتية بنجاح ✓',
              fr: 'Alertes sonores activées ✓',
              amz: 'ⵉⵙⵙⵎⵔ ⵓⵙⵖⵔⵜ ⴰⵎⵙⵍⵉ ✓',
              en: 'Sound alerts enabled ✓',
              es: 'Alertas de sonido activadas ✓',
            }),
        subResult.subscribed
          ? pickLang(lang, {
              ar: 'ستصلك إشعارات الحجوزات الجديدة، إيصالات CIH، وقائمة الانتظار حتى عند إغلاق المتصفح.',
              fr: 'Vous recevrez les alertes de réservations, reçus CIH et file d’attente même navigateur fermé.',
              amz: 'ⴰⴷ ⵜⴰⵎⵥⵜ ⵜⵓⵏⵏⵓⵏⵉⵏ ⵏ ⵉⵙⵉⵀⴰⵔⵏ ⵉⵎⴰⵢⵏⵓⵜⵏ ⴷ CIH.',
              en: 'You will receive alerts for new bookings, CIH receipts, and waitlist updates even in background.',
              es: 'Recibirás alertas de nuevas reservas, recibos CIH y lista de espera en segundo plano.',
            })
          : pickLang(lang, {
              ar: 'ستصلك تنبيهات صوتية داخل لوحة التحكم عند وصول حجوزات جديدة.',
              fr: 'Vous entendrez une alerte sonore dans le tableau de bord à chaque nouvelle réservation.',
              amz: 'ⴰⴷ ⵜⴰⵎⵥⵜ ⵉⵙⵖⵔⵜⵏ ⵉⵎⵙⵍⵉⵢⵏ ⴳ ⵜⴼⵍⵡⵉⵜ.',
              en: 'You will hear sound alerts in the dashboard when new bookings arrive.',
              es: 'Escucharás alertas de sonido en el panel al llegar nuevas reservas.',
            }),
        'success'
      );
    } else {
      setNotificationsEnabled(false);
      safeStorageSet(ADMIN_NOTIFS_ENABLED_KEY, 'false', 'local');
      showToast(
        pickLang(lang, {
          ar: 'تم إيقاف الإشعارات مؤقتاً',
          fr: 'Notifications suspendues',
          amz: 'ⵜⵓⵏⵏⵓⵏⵉⵏ ⵜⵜⵓⵙⴱⴷⴷⵏⵜ',
          en: 'Notifications paused',
          es: 'Notificaciones pausadas',
        }),
        pickLang(lang, {
          ar: 'تم كتم التنبيهات التلقائية.',
          fr: 'Alertes automatiques mises en sourdine.',
          amz: 'ⵉⵙⵖⵔⵜⵏ ⵜⵜⵓⵙⴽⵏⴼⵏ.',
          en: 'Automatic alerts muted.',
          es: 'Alertas automáticas silenciadas.',
        }),
        'warning'
      );
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await updateBookingStatus(
        id,
        'confirmed',
        pickLang(lang, {
          ar: `تم التأكيد بواسطة ${session?.name || 'الصالون'}. مكانك محجوز.`,
          fr: `Confirmé par ${session?.name || 'le salon'}. Votre créneau est réservé.`,
          amz: `ⵉⵜⵜⵓⵙⵏⵜⵎ ⵙⵖⵓⵔ ${session?.name || 'ⴰⵙⴰⵍⵓⵏ'}. ⴰⴷⵖⴰⵔ ⵏⵏⴽ ⵉⵜⵜⵓⵃⴹⴰ.`,
          en: `Confirmed by ${session?.name || 'the salon'}. Your slot is reserved.`,
          es: `Confirmado por ${session?.name || 'el salón'}. Tu horario está reservado.`,
        })
      );
    } catch (err) {
      console.error('Failed to confirm booking:', err);
      sendDualAlert(
        pickLang(lang, {
          ar: 'خطأ في التحديث',
          fr: 'Erreur de mise à jour',
          amz: 'ⵜⴰⵣⴳⴰⵍⵜ ⴳ ⵓⵙⴷⵖⵉ',
          en: 'Update error',
          es: 'Error al actualizar',
        }),
        {
          body: pickLang(lang, {
            ar: 'تعذر تحديث حالة الموعد في قاعدة البيانات.',
            fr: 'Impossible de mettre à jour le rendez-vous dans la base.',
            amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵙⴷⵖⵉ ⴰⵙⵉⵀⴰⵔ.',
            en: 'Failed to update booking status in database.',
            es: 'No se pudo actualizar el estado de la cita.',
          }),
          type: 'warning',
        }
      );
    }
  };

  const handleConfirmDeleteBooking = async () => {
    if (!deleteTargetBooking || session?.role !== 'master') return;
    const creditSummary = computeOutstandingCreditsForPhone(
      deleteTargetBooking.clientPhone,
      caisseEntries,
      manualCredits,
      barberRoster
    );
    if (creditSummary.hasCredit && !deleteBookingCreditAck) {
      return;
    }
    setDeleteBookingBusy(true);
    try {
      await deleteBooking(deleteTargetBooking.id);
      showToast(
        'تم حذف الموعد بنجاح (سجلات الكريدي والمجر تبقى محفوظة)',
        'success'
      );
      setDeleteTargetBooking(null);
      setDeleteBookingCreditAck(false);
    } catch (err) {
      console.error('Failed to delete booking:', err);
      sendDualAlert('تعذر حذف الموعد', {
        body: 'حدث خطأ أثناء حذف الموعد من قاعدة البيانات.',
        type: 'warning',
      });
    } finally {
      setDeleteBookingBusy(false);
    }
  };

  const handleReject = (id: string) => {
    setRejectReasonInput(
      pickLang(lang, {
        ar: 'الموعد غير متاح، يرجى اختيار توقيت آخر.',
        fr: 'Créneau indisponible, veuillez choisir un autre horaire.',
        amz: 'ⴰⴽⵓⴷ ⴰⴷ ⵓⵔ ⵉⵍⵍⵉ, ⵙⵜⵉ ⴰⴽⵓⴷ ⵢⴰⴹⵏ.',
        en: 'Slot unavailable, please pick another time.',
        es: 'Horario no disponible, elige otro horario.',
      })
    );
    setRejectTargetBookingId(id);
  };

  const handleConfirmRejectModal = async () => {
    if (!rejectTargetBookingId || rejectBookingBusy) return;
    setRejectBookingBusy(true);
    try {
      await updateBookingStatus(
        rejectTargetBookingId,
        'rejected',
        rejectReasonInput.trim() ||
          pickLang(lang, {
            ar: 'غير متاح',
            fr: 'Non disponible',
            amz: 'ⵓⵔ ⵉⵍⵍⵉ',
            en: 'Unavailable',
            es: 'No disponible',
          })
      );
      setRejectTargetBookingId(null);
    } catch (err) {
      console.error('Failed to reject booking:', err);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تعذر رفض الموعد',
          fr: 'Impossible de refuser le RDV',
          amz: 'ⵓⵔ ⵉⵜⵜⵓⴳⵉ ⵓⵙⵉⵀⵍ',
          en: 'Could not reject booking',
          es: 'No se pudo rechazar la cita',
        }),
        {
          body: pickLang(lang, {
            ar: 'حدث خطأ أثناء تحديث الحالة.',
            fr: 'Une erreur est survenue lors de la mise à jour.',
            amz: 'ⵜⵍⵍⴰ ⵜⴰⵣⴳⴰⵍⵜ.',
            en: 'An error occurred updating the status.',
            es: 'Ocurrió un error al actualizar el estado.',
          }),
          type: 'warning',
        }
      );
    } finally {
      setRejectBookingBusy(false);
    }
  };

  const openCaissePromptForBooking = (booking: AppointmentBooking) => {
    if (booking.caisseLoggedAt) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'مسجل مسبقاً في لاكيس',
          fr: 'Déjà enregistré en Caisse',
          amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵢⴰⴷ ⴳ ⵍⴰⴽⵉⵙ',
          en: 'Already Logged in Caisse',
          es: 'Ya registrado en Caja',
        }),
        {
          body: pickLang(lang, {
            ar: `تم إدخال مبلغ تذكرة ${booking.ticketNumber} في صندوق لاكيس مسبقاً.`,
            fr: `Le montant du ticket ${booking.ticketNumber} est déjà enregistré en Caisse.`,
            amz: `ⴰⵜⵉⴳ ⵏ ⵓⵏⵜⵜⵉⴽⵉ ${booking.ticketNumber} ⵉⵍⵍⴰ ⵢⴰⴷ ⴳ ⵍⴰⴽⵉⵙ.`,
            en: `Ticket ${booking.ticketNumber} amount was already recorded in Caisse.`,
            es: `El importe del ticket ${booking.ticketNumber} ya está en Caja.`,
          }),
          type: 'info',
          skipSound: true,
        }
      );
      return;
    }
    const baseTotal = Math.max(0, Math.round(Number(booking.finalTotalMAD) || 0));
    setCaissePromptBooking(booking);
    setCaissePromptPaid(baseTotal > 0 ? String(baseTotal) : '');
    setCaissePromptExpected(baseTotal > 0 ? String(baseTotal) : '');
    setCaissePromptHasCredit(false);
    setPromptCreditActionOpen(false);
    setPromptCreditActionTargetBarber('all');
    setPromptCreditActionAmount('');
    setPromptCreditActionNote('');
    setCaissePromptClientName(booking.clientName || '');
    setCaissePromptClientPhone(booking.clientPhone || '');
    setCaissePromptRepayDate('');
    setCaissePromptNote(
      pickLang(lang, {
        ar: `موعد ${booking.ticketNumber}`,
        fr: `Ticket ${booking.ticketNumber}`,
        amz: `ⴰⵙⵉⵀⴰⵔ ${booking.ticketNumber}`,
        en: `Booking ${booking.ticketNumber}`,
        es: `Cita ${booking.ticketNumber}`,
      })
    );
  };

  const handleConfirmCaisseFromBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caissePromptBooking || !session) return;

    const paid = Math.max(0, Number(caissePromptPaid) || 0);
    const expected = caissePromptHasCredit
      ? Math.max(paid, Number(caissePromptExpected) || paid)
      : paid;
    const creditTotal = caissePromptHasCredit ? Math.max(0, expected - paid) : 0;

    if (paid <= 0 && creditTotal <= 0) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'أدخل المبلغ أولاً',
          fr: 'Entrez un montant d’abord',
          amz: 'ⵙⴽⵛⵎ ⴰⵜⵉⴳ ⵜⴰⵣⵡⴰⵔⴰ',
          en: 'Enter an amount first',
          es: 'Ingresa un monto primero',
        }),
        {
          body: pickLang(lang, {
            ar: 'أدخل المبلغ الموضوع في لاكيس أو قيمة الكريدي.',
            fr: 'Saisissez le montant encaissé ou la valeur du crédit.',
            amz: 'ⵙⴽⵛⵎ ⴰⵜⵉⴳ ⵏ ⵍⴰⴽⵉⵙ ⵏⵖ ⴰⴽⵔⵉⴷⵉ.',
            en: 'Enter the amount placed in Caisse or credit value.',
            es: 'Ingresa el monto cobrado o el valor del crédito.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }

    const targetBarberId = resolveCaisseBarberId(
      caissePromptBooking.barberId,
      caissePromptBooking.barberName,
      barberRoster
    );
    const barberMeta = getCaisseBarberMeta(targetBarberId, barberRoster);
    const serviceIds = (caissePromptBooking.services || [])
      .map((s) => s.id)
      .filter(Boolean);
    const serviceNames = (caissePromptBooking.services || [])
      .map((s) => s.name?.[lang] || s.name?.ar || s.name?.fr || s.id)
      .filter(Boolean);

    setCaissePromptBusy(true);
    try {
      const entry = await addCaisseEntry({
        barberId: targetBarberId,
        barberName: barberMeta.name,
        type: 'income',
        date: todayStr,
        serviceIds,
        serviceNames,
        expectedAmountMAD: expected,
        amountPaidMAD: paid,
        creditAmountMAD: creditTotal,
        creditRemainingMAD: creditTotal,
        creditStatus:
          creditTotal > 0 ? (paid > 0 ? 'partial' : 'open') : 'none',
        clientName: caissePromptClientName.trim() || caissePromptBooking.clientName,
        clientPhone: caissePromptClientPhone.trim() || caissePromptBooking.clientPhone,
        expectedRepaymentDate: caissePromptRepayDate || undefined,
        sourceBookingId: caissePromptBooking.id,
        sourceTicketNumber: caissePromptBooking.ticketNumber,
        note: caissePromptNote.trim() || `${caissePromptBooking.ticketNumber}`,
        createdByRole: session.role,
        createdByName: session.name,
      });

      await markBookingCaisseLogged(caissePromptBooking.id, entry.id);
      setCaissePromptBooking(null);

      const barberLabel =
        mergedBarbers.find((m) => m.id === targetBarberId)?.name?.[lang] ||
        barberMeta.arName;

      sendDualAlert(
        pickLang(lang, {
          ar: 'تم تسجيل مدخول الموعد في لاكيس ✓',
          fr: 'Revenu du RDV enregistré en Caisse ✓',
          amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⴽⵛⵓⵎ ⵏ ⵓⵙⵉⵀⴰⵔ ⴳ ⵍⴰⴽⵉⵙ ✓',
          en: 'Appointment revenue logged in Caisse ✓',
          es: 'Ingreso de la cita registrado en Caja ✓',
        }),
        {
          body:
            creditTotal > 0
              ? pickLang(lang, {
                  ar: `${paid} MAD في لاكيس + ${creditTotal} MAD كريدي على ${caissePromptBooking.clientName}.`,
                  fr: `${paid} MAD en Caisse + ${creditTotal} MAD en crédit pour ${caissePromptBooking.clientName}.`,
                  amz: `${paid} MAD ⴳ ⵍⴰⴽⵉⵙ + ${creditTotal} MAD ⴰⴽⵔⵉⴷⵉ ⵉ ${caissePromptBooking.clientName}.`,
                  en: `${paid} MAD in Caisse + ${creditTotal} MAD credit for ${caissePromptBooking.clientName}.`,
                  es: `${paid} MAD en Caja + ${creditTotal} MAD crédito para ${caissePromptBooking.clientName}.`,
                })
              : pickLang(lang, {
                  ar: `تمت إضافة ${paid} MAD لصندوق ${barberLabel}.`,
                  fr: `${paid} MAD ajoutés à la Caisse de ${barberLabel}.`,
                  amz: `ⵉⵜⵜⵓⵔⵏⴰ ${paid} MAD ⵉ ⵍⴰⴽⵉⵙ ⵏ ${barberLabel}.`,
                  en: `Added ${paid} MAD to ${barberLabel}'s Caisse.`,
                  es: `${paid} MAD añadidos a la Caja de ${barberLabel}.`,
                }),
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to add booking revenue to Caisse:', err);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تعذر التسجيل في لاكيس',
          fr: 'Échec de l’enregistrement en Caisse',
          amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵣⵎⵎⴻⵎ ⴳ ⵍⴰⴽⵉⵙ',
          en: 'Failed to log in Caisse',
          es: 'Error al registrar en Caja',
        }),
        {
          body: pickLang(lang, {
            ar: 'حدث خطأ أثناء إضافة العملية إلى صندوق لاكيس.',
            fr: 'Erreur lors de l’ajout de l’opération en Caisse.',
            amz: 'ⵜⴰⵣⴳⴰⵍⵜ ⴳ ⵜⵎⵀⵍⴰ ⵏ ⵍⴰⴽⵉⵙ.',
            en: 'An error occurred while adding the entry to Caisse.',
            es: 'Error al añadir la operación a Caja.',
          }),
          type: 'warning',
        }
      );
    } finally {
      setCaissePromptBusy(false);
    }
  };

  const handleMarkCompleted = async (booking: AppointmentBooking) => {
    if (booking.status === 'completed') {
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم تأكيد الحضور مسبقاً',
          fr: 'Présence déjà confirmée',
          amz: 'ⵜⵉⵍⵉⵏⵜ ⵜⵜⵓⵙⵏⵜⵎ ⵢⴰⴷ',
          en: 'Attendance already confirmed',
          es: 'Asistencia ya confirmada',
        }),
        {
          body: pickLang(lang, {
            ar: `تذكرة ${booking.ticketNumber} مسجلة كحاضر ومكتملة بالفعل (بدون تكرار النقاط).`,
            fr: `Le ticket ${booking.ticketNumber} est déjà complété (aucun point en double).`,
            amz: `ⴰⵏⵜⵜⵉⴽⵉ ${booking.ticketNumber} ⵉⵙⵎⴷ ⵢⴰⴷ.`,
            en: `Ticket ${booking.ticketNumber} is already completed (no duplicate points).`,
            es: `El ticket ${booking.ticketNumber} ya está completado (sin puntos duplicados).`,
          }),
          type: 'info',
          skipSound: true,
        }
      );
      return;
    }

    setQuickActionBusyId(booking.id);
    try {
      const result = await confirmClientAttendance(booking, bookings, crmClientsMap);
      if (result.alreadyCompleted) {
        sendDualAlert(
          pickLang(lang, {
            ar: 'تم تأكيد الحضور مسبقاً',
            fr: 'Présence déjà confirmée',
            amz: 'ⵜⵉⵍⵉⵏⵜ ⵜⵜⵓⵙⵏⵜⵎ ⵢⴰⴷ',
            en: 'Attendance already confirmed',
            es: 'Asistencia ya confirmada',
          }),
          {
            body: pickLang(lang, {
              ar: `لا يمكن احتساب نفس الزيارة مرتين للزبون ${booking.clientName}.`,
              fr: `Impossible de compter la même visite deux fois pour ${booking.clientName}.`,
              amz: `ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵜⵜⵓⵃⵙⴰⴱ ⵓⵔⵣⴰⴼ ⵙⵏⴰⵜ ⵜⵉⴽⴽⴰⵍ ⵉ ${booking.clientName}.`,
              en: `Cannot count the same visit twice for ${booking.clientName}.`,
              es: `No se puede contar la misma visita dos veces para ${booking.clientName}.`,
            }),
            type: 'info',
            skipSound: true,
          }
        );
        return;
      }

      if (result.unlockedMilestone) {
        sendDualAlert(
          pickLang(lang, {
            ar: `🎉 تأكيد الحضور + إنجاز ${result.unlockedMilestone} زيارات!`,
            fr: `🎉 Présence confirmée + Palier ${result.unlockedMilestone} visites !`,
            amz: `🎉 ⵜⵉⵍⵉⵏⵜ + ${result.unlockedMilestone} ⵉⵔⵣⴰⴼⵏ !`,
            en: `🎉 Attendance Confirmed + ${result.unlockedMilestone} Visits Milestone!`,
            es: `🎉 Asistencia confirmada + ¡Meta de ${result.unlockedMilestone} visitas!`,
          }),
          {
            body: pickLang(lang, {
              ar: `${booking.clientName}: أصبح لديه ${result.newVerifiedVisits} زيارة مؤكدة وتم فتح مكافأة المستوى ${result.unlockedMilestone / 5}!`,
              fr: `${booking.clientName} : ${result.newVerifiedVisits} visites vérifiées, récompense Palier ${result.unlockedMilestone / 5} débloquée !`,
              amz: `${booking.clientName}: ${result.newVerifiedVisits} ⵉⵔⵣⴰⴼⵏ, ⵜⴰⵔⵔⴰⴳⵜ ⵏ ⵓⵙⵡⵉⵔ ${result.unlockedMilestone / 5}!`,
              en: `${booking.clientName}: ${result.newVerifiedVisits} verified visits — Tier ${result.unlockedMilestone / 5} reward unlocked!`,
              es: `${booking.clientName}: ${result.newVerifiedVisits} visitas verificadas — ¡Nivel ${result.unlockedMilestone / 5} desbloqueado!`,
            }),
            type: 'success',
          }
        );
      } else {
        const progress = computeLoyaltyProgress(result.newVerifiedVisits, lang);
        sendDualAlert(
          pickLang(lang, {
            ar: `تم تأكيد الحضور وإضافة +${result.pointsEarned} نقطة ولاء ✓`,
            fr: `Présence confirmée (+${result.pointsEarned} pts ajoutés) ✓`,
            amz: `ⵜⵉⵍⵉⵏⵜ ⵜⵜⵓⵙⵏⵜⵎ (+${result.pointsEarned} pts) ✓`,
            en: `Attendance Confirmed (+${result.pointsEarned} pts added) ✓`,
            es: `Asistencia confirmada (+${result.pointsEarned} pts) ✓`,
          }),
          {
            body: pickLang(lang, {
              ar: `${booking.clientName}: ${result.newVerifiedVisits} زيارة مؤكدة (${progress.verifiedVisits}/${progress.nextMilestone} للمكافأة التالية).`,
              fr: `${booking.clientName} : ${result.newVerifiedVisits} visites vérifiées (${progress.verifiedVisits}/${progress.nextMilestone} pour la récompense).`,
              amz: `${booking.clientName}: ${result.newVerifiedVisits} ⵉⵔⵣⴰⴼⵏ (${progress.verifiedVisits}/${progress.nextMilestone}).`,
              en: `${booking.clientName}: ${result.newVerifiedVisits} verified visits (${progress.verifiedVisits}/${progress.nextMilestone} to next reward).`,
              es: `${booking.clientName}: ${result.newVerifiedVisits} visitas (${progress.verifiedVisits}/${progress.nextMilestone} para el premio).`,
            }),
            type: 'success',
            skipSound: true,
          }
        );
      }

      // Prompt staff to optionally record completed appointment payment into Caisse (never auto-added on booking)
      if (!booking.caisseLoggedAt) {
        openCaissePromptForBooking(booking);
      }
    } catch (err) {
      console.error('Failed to confirm attendance / mark completed:', err);
      sendDualAlert(
        pickLang(lang, {
          ar: 'خطأ في التحديث',
          fr: 'Erreur de mise à jour',
          amz: 'ⵜⴰⵣⴳⴰⵍⵜ ⴳ ⵓⵙⴷⵖⵉ',
          en: 'Update error',
          es: 'Error al actualizar',
        }),
        {
          body: pickLang(lang, {
            ar: 'تعذر تأكيد الحضور أو تحديث رصيد الولاء في السحابة.',
            fr: 'Impossible de confirmer la présence ou de synchroniser la fidélité.',
            amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵙⵏⵜⵎ ⵜⵉⵍⵉⵏⵜ.',
            en: 'Failed to confirm attendance or update loyalty balance.',
            es: 'No se pudo confirmar la asistencia ni actualizar la fidelidad.',
          }),
          type: 'warning',
        }
      );
    } finally {
      setQuickActionBusyId((prev) => (prev === booking.id ? null : prev));
    }
  };

  const handleQuickCancel = async (booking: AppointmentBooking) => {
    if (booking.status === 'cancelled') return;

    setQuickActionBusyId(booking.id);
    try {
      const note =
        notesState[booking.id]?.trim() ||
        booking.adminNotes?.trim() ||
        pickLang(lang, {
          ar: `تم إلغاء الموعد بواسطة ${session?.name || 'الإدارة'}.`,
          fr: `Rendez-vous annulé par ${session?.name || 'le salon'}.`,
          amz: `ⴰⵙⵉⵀⴰⵔ ⵉⵜⵜⵓⵙⵔ ⵙⵖⵓⵔ ${session?.name || 'ⴰⵙⴰⵍⵓⵏ'}.`,
          en: `Appointment cancelled by ${session?.name || 'admin'}.`,
          es: `Cita cancelada por ${session?.name || 'el salón'}.`,
        });
      await updateBookingStatus(booking.id, 'cancelled', note);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم إلغاء الموعد',
          fr: 'Rendez-vous annulé',
          amz: 'ⴰⵙⵉⵀⴰⵔ ⵉⵜⵜⵓⵙⵔ',
          en: 'Appointment Cancelled',
          es: 'Cita cancelada',
        }),
        {
          body: pickLang(lang, {
            ar: `تم تحديث حالة تذكرة ${booking.ticketNumber} (${booking.clientName}) إلى ملغى بنقرة واحدة.`,
            fr: `Ticket ${booking.ticketNumber} (${booking.clientName}) annulé en un clic.`,
            amz: `ⴰⵏⵜⵜⵉⴽⵉ ${booking.ticketNumber} (${booking.clientName}) ⵉⵜⵜⵓⵙⵔ.`,
            en: `Ticket ${booking.ticketNumber} (${booking.clientName}) marked as cancelled.`,
            es: `Ticket ${booking.ticketNumber} (${booking.clientName}) marcado como cancelado.`,
          }),
          type: 'warning',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to cancel booking:', err);
      sendDualAlert(
        pickLang(lang, {
          ar: 'خطأ في التحديث',
          fr: 'Erreur de mise à jour',
          amz: 'ⵜⴰⵣⴳⴰⵍⵜ ⴳ ⵓⵙⴷⵖⵉ',
          en: 'Update error',
          es: 'Error al actualizar',
        }),
        {
          body: pickLang(lang, {
            ar: 'تعذر إلغاء الموعد في قاعدة البيانات.',
            fr: 'Impossible d’annuler le rendez-vous.',
            amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵙⵔ ⴰⵙⵉⵀⴰⵔ.',
            en: 'Failed to cancel appointment.',
            es: 'No se pudo cancelar la cita.',
          }),
          type: 'warning',
        }
      );
    } finally {
      setQuickActionBusyId((prev) => (prev === booking.id ? null : prev));
    }
  };

  const handleRecordNoShow = async (booking: AppointmentBooking) => {
    const confirmMsg = pickLang(lang, {
      ar: `هل تغيب الزبون "${booking.clientName}" عن هذا الموعد؟\nسيتم تسجيل No-Show وحظر الرقم تلقائياً عند بلوغ تغيّبين (2 No-Shows).`,
      fr: `Le client "${booking.clientName}" est-il absent ?\nUn No-Show sera enregistré (blocage auto après 2 absences).`,
      amz: `ⵉⵙ ⵉⵏⵖⵓⴱⴰ ⵓⵎⵣⴷⴰⵖ "${booking.clientName}" ?\nⴰⴷ ⵉⵜⵜⵓⵣⵎⵎⴻⵎ No-Show (ⴰⴳⴷⴰⵍ ⵉ 2).`,
      en: `Did "${booking.clientName}" miss this appointment?\nA No-Show will be logged (auto-ban after 2 No-Shows).`,
      es: `¿No asistió "${booking.clientName}"?\nSe registrará No-Show (bloqueo automático tras 2 ausencias).`,
    });
    if (!window.confirm(confirmMsg)) return;
    try {
      const updatedProfile = await recordClientNoShow(booking, crmClientsMap);
      sendDualAlert(
        updatedProfile.isBanned
          ? pickLang(lang, {
              ar: 'تم تسجيل التغيب + الحظر التلقائي 🚫',
              fr: 'No-Show enregistré + Blocage auto 🚫',
              amz: 'No-Show + ⴰⴳⴷⴰⵍ ⴰⵡⵓⵔⵎⴰⵏ 🚫',
              en: 'No-Show Logged + Auto-Banned 🚫',
              es: 'No-Show registrado + Bloqueo automático 🚫',
            })
          : pickLang(lang, {
              ar: `تم تسجيل التغيب (${updatedProfile.noShowCount}/2) ⚠️`,
              fr: `Absence enregistrée (${updatedProfile.noShowCount}/2) ⚠️`,
              amz: `ⵜⴰⵏⵖⵓⴱⴰ ⵜⵜⵓⵣⵎⵎⴻⵎ (${updatedProfile.noShowCount}/2) ⚠️`,
              en: `No-Show Logged (${updatedProfile.noShowCount}/2) ⚠️`,
              es: `Ausencia registrada (${updatedProfile.noShowCount}/2) ⚠️`,
            }),
        {
          body: updatedProfile.isBanned
            ? pickLang(lang, {
                ar: `تم إدراج رقم ${booking.clientPhone} في القائمة السوداء تلقائياً بعد تغيّبين.`,
                fr: `Le numéro ${booking.clientPhone} a été bloqué automatiquement après 2 absences.`,
                amz: `ⵓⵟⵟⵓⵏ ${booking.clientPhone} ⵉⵜⵜⵓⴳⴷⵍ ⵙ ⵓⵡⵓⵔⵎⴰⵏ.`,
                en: `Phone ${booking.clientPhone} was auto-blacklisted after 2 no-shows.`,
                es: `El número ${booking.clientPhone} fue bloqueado automáticamente tras 2 ausencias.`,
              })
            : pickLang(lang, {
                ar: `الزبون ${booking.clientName} لديه الآن مخالفة تغيّب واحدة.`,
                fr: `${booking.clientName} a maintenant 1 absence enregistrée.`,
                amz: `${booking.clientName} ⵉⵍⴰ ⵢⵉⵡⵜ ⵜⵏⵖⵓⴱⴰ.`,
                en: `${booking.clientName} now has 1 no-show strike.`,
                es: `${booking.clientName} ahora tiene 1 ausencia registrada.`,
              }),
          type: 'warning',
        }
      );
    } catch (err) {
      console.error('Failed to record no-show:', err);
      sendDualAlert(
        pickLang(lang, {
          ar: 'خطأ في تسجيل التغيب',
          fr: 'Erreur d’enregistrement',
          amz: 'ⵜⴰⵣⴳⴰⵍⵜ ⴳ ⵓⵣⵎⵎⴻⵎ',
          en: 'Failed to log no-show',
          es: 'Error al registrar ausencia',
        }),
        {
          body: pickLang(lang, {
            ar: 'تعذر تحديث سجل CRM.',
            fr: 'Impossible de mettre à jour le CRM.',
            amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵙⴷⵖⵉ CRM.',
            en: 'Failed to update CRM record.',
            es: 'No se pudo actualizar el CRM.',
          }),
          type: 'warning',
        }
      );
    }
  };

  const handleOpenReschedule = (booking: AppointmentBooking) => {
    setReschedulingBooking(booking);
    setNewDate(booking.date);
    setNewTime(booking.timeSlot);
    setRescheduleNote(
      pickLang(lang, {
        ar: 'تم تعديل الموعد لتفادي الانتظار بالصالون.',
        fr: 'Décalé pour vous éviter l’attente au salon.',
        amz: 'ⵉⵜⵜⵓⵙⵏⴼⵍ ⵡⴰⴽⵓⴷ ⴰⴼⴰⴷ ⴰⴷ ⵓⵔ ⵜⵔⴰⵊⵓⵜ.',
        en: 'Rescheduled to save you waiting time at the shop.',
        es: 'Reprogramado para evitar esperas en el salón.',
      })
    );
  };

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingBooking) return;

    const targetBooking = reschedulingBooking;
    const targetId = targetBooking.id;
    setReschedulingBooking(null);
    try {
      await updateBookingStatus(targetId, 'rescheduled', rescheduleNote, {
        date: newDate,
        time: newTime,
      });
    } catch (err) {
      console.error('Failed to reschedule booking:', err);
      sendDualAlert(
        pickLang(lang, {
          ar: 'خطأ في تعديل الموعد',
          fr: 'Erreur de report',
          amz: 'ⵜⴰⵣⴳⴰⵍⵜ ⴳ ⵓⵙⵏⴼⵍ',
          en: 'Reschedule error',
          es: 'Error al reprogramar',
        }),
        {
          body: pickLang(lang, {
            ar: 'تعذر حفظ التوقيت الجديد في قاعدة البيانات.',
            fr: 'Impossible d’enregistrer le nouvel horaire.',
            amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵃⴹⵓ ⴰⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ.',
            en: 'Failed to save the new time in database.',
            es: 'No se pudo guardar el nuevo horario.',
          }),
          type: 'warning',
        }
      );
    }
  };

  const handleAssignFlexibleTime = async (
    booking: AppointmentBooking,
    assignedDate: string,
    assignedTime: string
  ) => {
    if (!assignedDate || !assignedTime) return;
    setFlexAssignBusyId(booking.id);
    try {
      const staffLabel = session?.name || booking.barberName;
      const customNote =
        notesState[booking.id]?.trim() ||
        pickLang(lang, {
          ar: `تم اختيار أفضل وقت متاح لك (${assignedDate} الساعة ${assignedTime}) بواسطة ${staffLabel}.`,
          fr: `Meilleur créneau attribué (${assignedDate} à ${assignedTime}) par ${staffLabel}.`,
          amz: `ⵉⵜⵜⵓⵙⵜⵉ ⵡⴰⴽⵓⴷ ⴰⵎⵓⴼⴰⵢ (${assignedDate} · ${assignedTime}) ⵙⵖⵓⵔ ${staffLabel}.`,
          en: `Best available slot assigned (${assignedDate} at ${assignedTime}) by ${staffLabel}.`,
          es: `Mejor horario asignado (${assignedDate} a las ${assignedTime}) por ${staffLabel}.`,
        });

      await assignFlexibleBookingSlot(booking.id, assignedDate, assignedTime, customNote);
      setFlexCustomTargetId(null);

      sendDualAlert(
        pickLang(lang, {
          ar: `تم تعيين الوقت وإشعار الزبون (${assignedTime}) ✓`,
          fr: `Horaire attribué et client notifié (${assignedTime}) ✓`,
          amz: `ⴰⴽⵓⴷ ⵉⵜⵜⵓⵙⵏⵜⵎ (${assignedTime}) ✓`,
          en: `Slot Assigned & Client Notified (${assignedTime}) ✓`,
          es: `Horario asignado y cliente notificado (${assignedTime}) ✓`,
        }),
        {
          body: pickLang(lang, {
            ar: `تم تحديد موعد ${booking.clientName} يوم ${assignedDate} الساعة ${assignedTime} وتأكيده مع إرسال إشعار فوري للزبون.`,
            fr: `RDV de ${booking.clientName} fixé le ${assignedDate} à ${assignedTime} et confirmé.`,
            amz: `ⴰⵙⵉⵀⴰⵔ ⵏ ${booking.clientName} ⴰⵙⵙ ${assignedDate} (${assignedTime}) ⵉⵜⵜⵓⵙⵏⵜⵎ.`,
            en: `${booking.clientName}'s appointment set for ${assignedDate} at ${assignedTime} and confirmed.`,
            es: `Cita de ${booking.clientName} fijada para el ${assignedDate} a las ${assignedTime}.`,
          }),
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to assign flexible slot:', err);
      sendDualAlert(
        pickLang(lang, {
          ar: 'خطأ في تعيين الموعد',
          fr: 'Erreur d’attribution',
          amz: 'ⵜⴰⵣⴳⴰⵍⵜ ⴳ ⵓⵙⵜⴰⵢ',
          en: 'Assignment error',
          es: 'Error al asignar',
        }),
        {
          body: pickLang(lang, {
            ar: 'تعذر تحديث التوقيت في قاعدة البيانات.',
            fr: 'Impossible de mettre à jour l’horaire.',
            amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵙⴷⵖⵉ ⴰⴽⵓⴷ.',
            en: 'Failed to update the time slot.',
            es: 'No se pudo actualizar el horario.',
          }),
          type: 'warning',
        }
      );
    } finally {
      setFlexAssignBusyId((prev) => (prev === booking.id ? null : prev));
    }
  };

  const handlePostponeLateBookingToNearest = async (booking: AppointmentBooking) => {
    setLateActionBusyId(booking.id);
    try {
      const parseSlotMin = (hhmm?: string) => {
        if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm.trim())) return nowMinutes;
        const [h, m] = hhmm.trim().split(':').map(Number);
        return h * 60 + m;
      };

      const minSearchDate = booking.date >= todayStr ? booking.date : todayStr;
      const bookingStartMin =
        booking.timeSlot && booking.timeSlot !== 'FLEXIBLE'
          ? parseSlotMin(booking.timeSlot)
          : nowMinutes;
      const hintMin = Math.min(22 * 60, Math.max(nowMinutes + 15, bookingStartMin + 30));
      const hintTime = `${String(Math.floor(hintMin / 60)).padStart(2, '0')}:${String(hintMin % 60).padStart(2, '0')}`;

      const candidates = getRankedAvailableSlotsForBarber(
        booking.barberId,
        minSearchDate,
        hintTime,
        barberSchedules,
        bookings,
        booking.totalDurationMinutes || 30
      );

      const forwardEligible = candidates
        .filter((slot) => {
          if (slot.date === booking.date && slot.time === booking.timeSlot) return false;
          if (slot.date === todayStr) {
            return parseSlotMin(slot.time) > Math.max(nowMinutes - 5, bookingStartMin);
          }
          if (slot.date === booking.date && booking.timeSlot !== 'FLEXIBLE') {
            return parseSlotMin(slot.time) > bookingStartMin;
          }
          return true;
        })
        .sort((a, b) => {
          if (a.date !== b.date) return safeCompareAsc(a.date, b.date);
          return parseSlotMin(a.time) - parseSlotMin(b.time);
        });

      const picked = forwardEligible[0];
      if (!picked) {
        sendDualAlert(
          pickLang(lang, {
            ar: 'لا يوجد وقت متاح قريباً',
            fr: 'Aucun créneau proche disponible',
            amz: 'ⵓⵔ ⵉⵍⵍⵉ ⵡⴰⴽⵓⴷ ⵉⵇⵇⵏⵏ',
            en: 'No nearby open slot found',
            es: 'No hay hueco cercano disponible',
          }),
          {
            body: pickLang(lang, {
              ar: 'يمكنك تحويل الزبون للطابور أو اختيار توقيت يدوي.',
              fr: 'Vous pouvez placer le client en liste d’attente ou choisir un horaire manuel.',
              amz: 'ⵜⵣⵎⵔⴷ ⴰⴷ ⵜⵙⵙⵉⴷⴷ ⴰⵎⵙⴰⵖ ⵉ ⵜⴰⵍⴳⴰⵎⵜ.',
              en: 'Consider moving the client to the queue or picking another day manually.',
              es: 'Puedes pasarlo a la cola o elegir otro horario manualmente.',
            }),
            type: 'warning',
          }
        );
        return;
      }

      const staffLabel = session?.name || booking.barberName;
      const noteText = pickLang(lang, {
        ar: `بسبب التأخر عن الموعد (${booking.timeSlot})، تم تأجيله إلى أقرب وقت متاح (${picked.date} · ${picked.time}) بواسطة ${staffLabel}.`,
        fr: `Suite au retard (${booking.timeSlot}), déplacé au créneau le plus proche (${picked.date} · ${picked.time}) par ${staffLabel}.`,
        amz: `ⵙ ⵓⵙⵔⴰⴳ ⵏ ⵓⵎⴰⵟⵟⵍ (${booking.timeSlot}), ⵉⵜⵜⵓⵙⵏⴼⵍ ⵉ (${picked.date} · ${picked.time}).`,
        en: `Moved due to late arrival (${booking.timeSlot}) to nearest slot (${picked.date} · ${picked.time}) by ${staffLabel}.`,
        es: `Movido por retraso (${booking.timeSlot}) al horario más cercano (${picked.date} · ${picked.time}).`,
      });

      await rescheduleBookingToNearestSlot(booking.id, picked.date, picked.time, noteText);
      sendDualAlert(
        pickLang(lang, {
          ar: `تم تأجيل الموعد لأقرب وقت (${picked.time}) ✓`,
          fr: `Déplacé au créneau le plus proche (${picked.time}) ✓`,
          amz: `ⵉⵜⵜⵓⵙⵏⴼⵍ ⵉ ⵡⴰⴽⵓⴷ (${picked.time}) ✓`,
          en: `Moved to Nearest Slot (${picked.time}) ✓`,
          es: `Movido al hueco cercano (${picked.time}) ✓`,
        }),
        {
          body: pickLang(lang, {
            ar: `تم تحرير الموعد القديم ونقل ${booking.clientName} إلى ${picked.date} الساعة ${picked.time}.`,
            fr: `L’ancien créneau est libéré et ${booking.clientName} est déplacé au ${picked.date} à ${picked.time}.`,
            amz: `ⴰⴽⵓⴷ ⴰⵣⴰⵢⴽⵓ ⵉⵔⵥⵎ, ${booking.clientName} ⵉⵜⵜⵓⵙⵏⴼⵍ ⵉ ${picked.date} · ${picked.time}.`,
            en: `Original slot freed and ${booking.clientName} moved to ${picked.date} at ${picked.time}.`,
            es: `El hueco anterior quedó libre y ${booking.clientName} pasó al ${picked.date} a las ${picked.time}.`,
          }),
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to postpone late booking to nearest slot:', err);
      showToast(
        pickLang(lang, {
          ar: 'تعذر تأجيل الموعد، يرجى المحاولة مجدداً.',
          fr: 'Impossible de décaler le rendez-vous.',
          amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵙⵏⴼⵍ ⴰⵙⵉⵀⴰⵔ.',
          en: 'Failed to move booking to nearest slot.',
          es: 'No se pudo mover la cita.',
        }),
        'warning'
      );
    } finally {
      setLateActionBusyId((prev) => (prev === booking.id ? null : prev));
    }
  };

  const handleMoveLateBookingToWaitlist = async (booking: AppointmentBooking) => {
    setLateActionBusyId(booking.id);
    try {
      const targetDate = booking.date >= todayStr ? booking.date : todayStr;
      const servicesSummary =
        (booking.cartItemsSummary || []).map((i) => i.name).filter(Boolean).join(', ') ||
        pickLang(lang, {
          ar: 'حلاقة وعناية',
          fr: 'Coupe & soins',
          amz: 'ⴰⵙⵙⴼⵔⵓ',
          en: 'Haircut & Grooming',
          es: 'Corte y cuidado',
        });

      await addToWaitlist({
        barberId: booking.barberId,
        barberName: booking.barberName,
        date: targetDate,
        preferredTime:
          booking.timeSlot === 'FLEXIBLE'
            ? pickLang(lang, {
                ar: 'أي توقيت متاح',
                fr: 'Tout horaire libre',
                amz: 'ⴰⴽⵓⴷ ⵉⵔⵥⵎⵏ',
                en: 'Any open slot',
                es: 'Cualquier hueco',
              })
            : `بعد ${booking.timeSlot} (متأخر)`,
        clientName: booking.clientName,
        clientPhone: booking.clientPhone,
        servicesSummary,
      });

      const staffLabel = session?.name || booking.barberName;
      const noteText = pickLang(lang, {
        ar: `بسبب التأخر عن الموعد (${booking.timeSlot})، تم تحويل ${booking.clientName} إلى طابور الانتظار وتحرير الحصة بواسطة ${staffLabel}.`,
        fr: `Suite au retard (${booking.timeSlot}), ${booking.clientName} a été placé en liste d’attente et le créneau libéré par ${staffLabel}.`,
        amz: `ⵙ ⵓⵙⵔⴰⴳ ⵏ ⵓⵎⴰⵟⵟⵍ, ${booking.clientName} ⵉⵜⵜⵓⵙⵙⵉⴷ ⵉ ⵜⴰⵍⴳⴰⵎⵜ ⵏ ⵓⴳⴰⵏⵉ.`,
        en: `Moved ${booking.clientName} to Smart Waitlist due to late arrival (${booking.timeSlot}) and freed slot by ${staffLabel}.`,
        es: `Pasado a lista de espera por retraso (${booking.timeSlot}) y liberado el horario por ${staffLabel}.`,
      });

      await updateBookingStatus(booking.id, 'cancelled', noteText);

      sendDualAlert(
        pickLang(lang, {
          ar: 'تم التحويل للطابور وتحرير الموعد ✓',
          fr: 'Placé en attente & créneau libéré ✓',
          amz: 'ⵉⵜⵜⵓⵙⵙⵉⴷ ⵉ ⵜⴰⵍⴳⴰⵎⵜ ✓',
          en: 'Moved to Queue & Slot Freed ✓',
          es: 'Pasado a cola y hueco libre ✓',
        }),
        {
          body: pickLang(lang, {
            ar: `تمت إضافة ${booking.clientName} لقائمة الانتظار وتحرير ساعة ${booking.timeSlot}.`,
            fr: `${booking.clientName} a rejoint la liste d’attente et ${booking.timeSlot} est libre.`,
            amz: `${booking.clientName} ⵉⵍⵍⴰ ⴳ ⵜⴰⵍⴳⴰⵎⵜ ⵏ ⵓⴳⴰⵏⵉ.`,
            en: `${booking.clientName} added to waitlist and ${booking.timeSlot} slot opened.`,
            es: `${booking.clientName} en lista de espera y horario ${booking.timeSlot} liberado.`,
          }),
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to move late booking to waitlist:', err);
      showToast(
        pickLang(lang, {
          ar: 'تعذر التحويل للطابور، يرجى المحاولة مجدداً.',
          fr: 'Impossible de transférer en attente.',
          amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵙⵙⵉⴷ ⵉ ⵜⴰⵍⴳⴰⵎⵜ.',
          en: 'Failed to move booking to waitlist.',
          es: 'No se pudo pasar a lista de espera.',
        }),
        'warning'
      );
    } finally {
      setLateActionBusyId((prev) => (prev === booking.id ? null : prev));
    }
  };

  const handleSaveClientNote = async (bookingId: string) => {
    const note = notesState[bookingId] || '';
    try {
      await updateBookingAdminNote(bookingId, note);
      setSavedNoteId(bookingId);
      setTimeout(() => setSavedNoteId(null), 2500);
    } catch (err) {
      console.error('Failed to save admin note:', err);
      sendDualAlert(
        pickLang(lang, {
          ar: 'خطأ في الحفظ',
          fr: 'Erreur d’enregistrement',
          amz: 'ⵜⴰⵣⴳⴰⵍⵜ ⴳ ⵓⵃⴹⵓ',
          en: 'Save error',
          es: 'Error al guardar',
        }),
        {
          body: pickLang(lang, {
            ar: 'تعذر حفظ الملاحظة للزبون.',
            fr: 'Impossible d’enregistrer la note.',
            amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵃⴹⵓ ⵜⴰⵏⵏⴰⵢⵜ.',
            en: 'Failed to save client note.',
            es: 'No se pudo guardar la nota.',
          }),
          type: 'warning',
        }
      );
    }
  };

  const handleSaveGoogleLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLinksError(null);
    setSavingProfileLinks(true);
    try {
      const parsedAdditionalPhones = additionalPhonesText
        .split(/[\n,،]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 6);
      await saveSalonProfileSettings(mapsUrlInput, reviewUrlInput, {
        salonPhone: salonPhoneInput.trim() || SALON_INFO.phone,
        salonWhatsapp: salonWhatsappInput.trim() || SALON_INFO.whatsappNumber,
        additionalPhones: parsedAdditionalPhones,
      });
      setProfileLinksSaved(true);
      setTimeout(() => setProfileLinksSaved(false), 2500);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم تحديث روابط Google Business',
          fr: 'Liens Google Business mis à jour',
          amz: 'ⵉⵙⵖⵡⴰⵏ ⵏ Google Business ⵜⵜⵓⵙⴷⵖⵉⵏ',
          en: 'Google Business Links Updated',
          es: 'Enlaces de Google Business actualizados',
        }),
        {
          body: pickLang(lang, {
            ar: 'تمت مزامنة روابط الخرائط والتقييم في الموقع بالكامل.',
            fr: 'Liens Maps et Avis synchronisés sur tout le site.',
            amz: 'ⵉⵙⵖⵡⴰⵏ ⵜⵜⵓⵙⵎⵙⴰⵙⴰⵏ ⴳ ⵓⵙⵉⵜ ⴰⴽⴽⵯ.',
            en: 'Maps and Review links synced across the site.',
            es: 'Enlaces de Maps y Reseñas sincronizados.',
          }),
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err: any) {
      setProfileLinksError(
        err?.message ||
          pickLang(lang, {
            ar: 'يجب أن تبدأ الروابط بـ https://',
            fr: 'Les liens doivent commencer par https://',
            amz: 'ⵉⵙⵖⵡⴰⵏ ⴰⴷ ⴱⴷⵓⵏ ⵙ https://',
            en: 'URLs must start with https://',
            es: 'Las URLs deben comenzar con https://',
          })
      );
    } finally {
      setSavingProfileLinks(false);
    }
  };

  // Helper to find barber color
  const getBarberColor = (booking: AppointmentBooking) => {
    if (booking.barberColor) return booking.barberColor;
    const found = mergedBarbers.find((b) => b.id === booking.barberId);
    return found?.themeColor || '#D97706';
  };

  // RBAC & Date Filtering:
  const visibleBookings = bookings.filter((b) => {
    if (!session) return false;

    // 1. RBAC Constraint
    if (session.role === 'barber') {
      const isAssigned = b.barberId === session.barberId || 
        b.barberName.toLowerCase().includes(session.name.toLowerCase().split(' ')[0]);
      if (!isAssigned) return false;
    } else if (session.role === 'master' || session.role === 'caisse') {
      if (masterBarberFilter !== 'all') {
        const matches = b.barberId === masterBarberFilter || 
          b.barberName.toLowerCase().includes(masterBarberFilter.toLowerCase().split('-')[0]);
        if (!matches) return false;
      }
    }

    // 2. Date View: 'today' (Today remaining + Upcoming Days/Next Week) or 'archive'
    if (activeTab === 'today') {
      if (b.date < todayStr) return false;
    } else {
      // Archive View
      if (archiveDateFilter && b.date !== archiveDateFilter) {
        return false;
      }
    }

    // 3. Status Filter (Pending / Flexible Pending, Confirmed, Completed, Rejected)
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending' && !['pending', 'flexible_pending', 'pending_quote'].includes(b.status)) return false;
      if (statusFilter === 'confirmed' && b.status !== 'confirmed') return false;
      if (statusFilter === 'completed' && b.status !== 'completed') return false;
      if (statusFilter === 'rejected' && !['rejected', 'cancelled', 'no_show'].includes(b.status)) return false;
    }

    // 4. Universal Dual Search (Ticket ID, normalized phone, or client/barber name)
    if (searchQuery.trim() && !matchesUniversalBookingQuery(b, searchQuery)) {
      return false;
    }

    return true;
  });

  const isTerminalStatus = (status: AppointmentBooking['status']) =>
    ['completed', 'rejected', 'cancelled', 'no_show'].includes(status);

  const isBookingSlotPassedToday = (b: AppointmentBooking): boolean => {
    if (b.date !== todayStr) return false;
    const rawSlot = (b.timeSlot || '').trim();
    if (!rawSlot || rawSlot === 'FLEXIBLE') return false;
    const startMin = parseBookingStartMinutes(rawSlot);
    if (startMin >= 24 * 60) return false;
    const duration = Math.max(30, Number(b.totalDurationMinutes) || 60);
    return startMin + duration < nowMinutes;
  };

  // Chronological Partitioning for activeTab === 'today'
  const todayActiveQueue = visibleBookings
    .filter(
      (b) =>
        b.date === todayStr &&
        !isTerminalStatus(b.status) &&
        !isBookingSlotPassedToday(b)
    )
    .sort((a, b) => {
      const diff = parseBookingStartMinutes(a.timeSlot) - parseBookingStartMinutes(b.timeSlot);
      if (diff !== 0) return diff;
      return safeCompareAsc(a.createdAt, b.createdAt);
    });

  const futureUpcomingQueue = visibleBookings
    .filter((b) => b.date > todayStr && !isTerminalStatus(b.status))
    .sort((a, b) => {
      const dateCmp = safeCompareAsc(a.date, b.date);
      if (dateCmp !== 0) return dateCmp;
      const timeDiff = parseBookingStartMinutes(a.timeSlot) - parseBookingStartMinutes(b.timeSlot);
      if (timeDiff !== 0) return timeDiff;
      return safeCompareAsc(a.createdAt, b.createdAt);
    });

  const todayActiveIdSet = new Set(todayActiveQueue.map((b) => b.id));
  const futureUpcomingIdSet = new Set(futureUpcomingQueue.map((b) => b.id));

  const todayPastOrDoneQueue = visibleBookings
    .filter((b) => !todayActiveIdSet.has(b.id) && !futureUpcomingIdSet.has(b.id))
    .sort((a, b) => {
      const dateCmp = safeCompareDesc(a.date, b.date);
      if (dateCmp !== 0) return dateCmp;
      return parseBookingStartMinutes(b.timeSlot) - parseBookingStartMinutes(a.timeSlot);
    });

  const sortedArchiveBookings = [...visibleBookings].sort((a, b) => {
    const dateCmp = safeCompareDesc(a.date, b.date);
    if (dateCmp !== 0) return dateCmp;
    return parseBookingStartMinutes(b.timeSlot) - parseBookingStartMinutes(a.timeSlot);
  });

  const archiveSearchMatchesCount =
    activeTab === 'today' && searchQuery.trim()
      ? bookings.filter((b) => matchesUniversalBookingQuery(b, searchQuery)).length
      : 0;

  // KPI Calculations (Scoped strictly to own barber when role === 'barber')
  const kpiSourceBookings =
    session?.role === 'barber'
      ? bookings.filter(
          (b) =>
            b.barberId === session.barberId ||
            b.barberName.toLowerCase().includes(session.name.toLowerCase().split(' ')[0])
        )
      : bookings;
  const todayTickets = kpiSourceBookings.filter((b) => b.date === todayStr);
  const pendingCount = todayTickets.filter((b) =>
    ['pending', 'flexible_pending', 'pending_quote'].includes(b.status)
  ).length;
  const confirmedCount = todayTickets.filter((b) => b.status === 'confirmed').length;
  const rejectedCount = todayTickets.filter((b) => b.status === 'rejected').length;

  const dailyRevenue = session
    ? computeDailyCompletedRevenue(bookings, todayStr, session.role, session.barberId)
    : null;

  const activeSessionTone = getBarberIdentityTokens(
    session?.barberId === 'all' ? 'hassan' : session?.barberId
  );

  return (
    <ModalPortal>
      <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-[70] overflow-y-auto flex items-center justify-center p-2 sm:p-4 lg:p-6 sb-modal-backdrop">
        <div className="relative w-full max-w-7xl bg-stone-50 dark:bg-[#11141D] text-slate-900 dark:text-zinc-100 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col my-2 sm:my-4 max-h-[95vh] overflow-hidden">
          
          {/* Subtle Per-Barber Identity Accent Line */}
          <div
            className="h-1 w-full transition-colors"
            style={{ backgroundColor: session ? activeSessionTone.accentHex : '#D97706' }}
          />

          {/* Header */}
          <div className="p-4 sm:p-5 lg:px-7 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#141720]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-black flex-shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white font-display">
                  {pickLang(lang, {
                    ar: 'فضاء الإدارة • صالون بومليك',
                    fr: 'ESPACE GESTION • SALON BOUMLIK',
                    amz: 'ⴰⵙⴰⵢⵔⴰⵔ ⵏ ⵓⵙⵡⵓⴷⴷⵓ • SALON BOUMLIK',
                    en: 'MANAGEMENT PORTAL • SALON BOUMLIK',
                    es: 'PANEL DE GESTIÓN • SALON BOUMLIK',
                  })}
                </h2>
                {session && (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border flex items-center gap-1 ${activeSessionTone.badgeClass}`}>
                    <ShieldCheck className="w-3 h-3" />
                    <span>
                      {session.name} (
                      {session.role === 'master'
                        ? pickLang(lang, {
                            ar: 'المشرف العام',
                            fr: 'Master Admin',
                            amz: 'ⴰⵏⵎⵀⴰⵍ',
                            en: 'Master Admin',
                            es: 'Admin Maestro',
                          })
                        : session.role === 'caisse'
                          ? pickLang(lang, {
                              ar: 'لاكيس',
                              fr: 'Caisse',
                              amz: 'ⵍⴰⴽⵉⵙ',
                              en: 'Caisse',
                              es: 'Caja',
                            })
                          : pickLang(lang, {
                              ar: 'حلاق',
                              fr: 'Barbier',
                              amz: 'ⴰⵎⴽⵕⴰⴹ',
                              en: 'Barber',
                              es: 'Barbero',
                            })}
                      )
                    </span>
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {session?.role === 'master' 
                  ? pickLang(lang, {
                      ar: 'الإدارة الشاملة للحجوزات وملاحظات الزبناء في الوقت الفعلي',
                      fr: 'Gestion globale des réservations & notes clients en temps réel',
                      amz: 'ⴰⵙⵡⵓⴷⴷⵓ ⴰⵎⴰⵜⴰⵢ ⵏ ⵉⵙⵉⵀⴰⵔⵏ ⴳ ⵡⴰⴽⵓⴷ ⴰⵏⵉⵍⴰⵡ',
                      en: 'Global real-time booking & client notes management',
                      es: 'Gestión global en tiempo real de reservas y notas',
                    })
                  : session?.role === 'caisse'
                    ? pickLang(lang, {
                        ar: 'صندوق لاكيس اليومي ومتابعة حجوزات الزبناء',
                        fr: 'Caisse quotidienne & suivi des rendez-vous du salon',
                        amz: 'ⵍⴰⴽⵉⵙ ⵏ ⵡⴰⵙⵙ ⴷ ⵉⵙⵉⵀⴰⵔⵏ',
                        en: 'Daily Caisse counter & salon booking tracking',
                        es: 'Caja diaria y seguimiento de citas del salón',
                      })
                    : pickLang(lang, {
                        ar: `لوحة التحكم الشخصية: ${session?.name || 'الطاقم'}`,
                        fr: `Tableau de bord personnel : ${session?.name || 'vous'}`,
                        amz: `ⵜⴰⴼⵍⵡⵉⵜ ⵏⵏⴽ: ${session?.name || 'ⴽⵢⵢ'}`,
                        en: `Personal dashboard: ${session?.name || 'you'}`,
                        es: `Panel personal: ${session?.name || 'ti'}`,
                      })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                title={pickLang(lang, {
                  ar: 'تسجيل الخروج',
                  fr: 'Déconnexion',
                  amz: 'ⵓⴼⵓⵖ',
                  en: 'Logout',
                  es: 'Cerrar sesión',
                })}
              >
                {pickLang(lang, {
                  ar: 'خروج',
                  fr: 'Déconnexion',
                  amz: 'ⵓⴼⵓⵖ',
                  en: 'Logout',
                  es: 'Salir',
                })}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SECURE PIN SCREEN (Password input type, no exposed PINs in placeholder) */}
        {!session ? (
          <div className="p-8 sm:p-12 text-center max-w-md mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mx-auto flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-lg">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                {pickLang(lang, {
                  ar: 'فضاء الطاقم والإدارة',
                  fr: 'Espace Staff & Direction',
                  amz: 'ⴰⵙⴰⵢⵔⴰⵔ ⵏ ⵜⵔⴰⴱⴱⵓⵜ',
                  en: 'Staff & Management Access',
                  es: 'Acceso Personal y Dirección',
                })}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {pickLang(lang, {
                  ar: 'دخول مؤمن لفريق صالون بومليك. أدخل رمزك السري (PIN).',
                  fr: "Accès sécurisé pour l'équipe du Salon Boumlik. Veuillez entrer votre code confidentiel.",
                  amz: 'ⴰⴽⵛⵓⵎ ⵉⵜⵜⵓⵃⴹⴰⵏ ⵉ ⵜⵔⴰⴱⴱⵓⵜ ⵏ Salon Boumlik. ⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏⵏⴽ.',
                  en: 'Secured access for Salon Boumlik team. Please enter your PIN.',
                  es: 'Acceso seguro para el equipo de Salon Boumlik. Ingresa tu PIN.',
                })}
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="••••"
                  className="w-full text-center text-2xl font-mono tracking-widest bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  autoFocus
                  required
                />
              </div>

              {pinError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
                  <span>
                    {pickLang(lang, {
                      ar: 'رمز PIN غير صحيح. حاول مجدداً.',
                      fr: 'Code PIN invalide. Veuillez réessayer.',
                      amz: 'ⵓⵟⵟⵓⵏ PIN ⵓⵔ ⵉⵖⵓⴷⴰ. ⴰⵔⵎ ⴷⴰⵖ.',
                      en: 'Invalid PIN code. Please try again.',
                      es: 'Código PIN inválido. Inténtalo de nuevo.',
                    })}
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-black font-black text-sm transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {pickLang(lang, {
                  ar: 'الدخول إلى لوحة التحكم',
                  fr: 'Connexion au Tableau de Bord',
                  amz: 'ⴰⴽⵛⵓⵎ ⵖⵔ ⵜⴼⵍⵡⵉⵜ',
                  en: 'Sign In to Dashboard',
                  es: 'Entrar al Panel',
                })}
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED STAFF DASHBOARD */
          <div
            ref={adminScrollContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 space-y-6"
          >

            {/* DAILY REVENUE SUMMARY CARD (Shown for Master Admin on Bookings tab only — clean Caisse-first for barbers) */}
            {dailyRevenue && session.role === 'master' && workspaceSection === 'bookings' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/80 dark:bg-gradient-to-br dark:from-emerald-950/35 dark:via-zinc-900/95 dark:to-zinc-950 border border-emerald-200 dark:border-emerald-500/35">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                          {pickLang(lang, {
                            ar: 'الأرباح اليومية',
                            fr: 'Revenus du Jour',
                            amz: 'ⵉⴽⵛⵓⵎⵏ ⵏ ⵡⴰⵙⵙ',
                            en: 'Daily Revenue',
                            es: 'Ingresos Diarios',
                          })}
                        </h3>
                        <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {todayStr}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {session.role === 'master'
                          ? pickLang(lang, {
                              ar: 'إجمالي مداخيل المواعيد المكتملة اليوم بناءً على الخدمات المختارة في نموذج الحجز',
                              fr: 'Total des rendez-vous terminés aujourd’hui selon les prestations choisies',
                              amz: 'ⴰⵎⵖⵔⵓⴷ ⵏ ⵉⵙⵉⵀⴰⵔⵏ ⵉⵙⵎⴷⵏ ⴰⵙⵙⴰ',
                              en: 'Total completed booking revenue today based on selected services',
                              es: 'Ingresos totales de citas completadas hoy según los servicios elegidos',
                            })
                          : pickLang(lang, {
                              ar: `مداخيل مواعيدك المكتملة اليوم (${session.name}) بناءً على الخدمات المنجزة`,
                              fr: `Revenus de vos RDV terminés aujourd’hui (${session.name})`,
                              amz: `ⵉⴽⵛⵓⵎⵏ ⵏ ⵉⵙⵉⵀⴰⵔⵏ ⵏⵏⴽ ⴰⵙⵙⴰ (${session.name})`,
                              en: `Your completed appointment revenue today (${session.name})`,
                              es: `Tus ingresos de citas completadas hoy (${session.name})`,
                            })}
                      </p>
                    </div>
                  </div>

                  <div className="sm:text-end flex sm:flex-col items-baseline sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-200 dark:border-emerald-500/15">
                    <div className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white font-mono tabular-nums tracking-tight">
                      {dailyRevenue.servicesRevenueMAD.toLocaleString('en-US')}{' '}
                      <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">MAD</span>
                    </div>
                    <div className="text-[11px] text-zinc-700 dark:text-zinc-300 font-mono tabular-nums">
                      {dailyRevenue.completedCount}{' '}
                      {pickLang(lang, {
                        ar: 'مواعيد مكتملة',
                        fr: 'RDV terminés',
                        amz: 'ⵉⵙⵉⵀⴰⵔⵏ ⵉⵙⵎⴷⵏ',
                        en: 'completed',
                        es: 'completadas',
                      })}{' '}
                      · {dailyRevenue.servicesCount}{' '}
                      {pickLang(lang, {
                        ar: 'خدمات منجزة',
                        fr: 'prestations',
                        amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ',
                        en: 'services',
                        es: 'servicios',
                      })}
                      {dailyRevenue.netCollectedMAD !== dailyRevenue.servicesRevenueMAD && (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {' '}·{' '}
                          {pickLang(lang, {
                            ar: 'الصافي',
                            fr: 'Net',
                            amz: 'ⴰⵣⴷⴷⴰⴳ',
                            en: 'Net',
                            es: 'Neto',
                          })}
                          : {dailyRevenue.netCollectedMAD.toLocaleString('en-US')} MAD
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {dailyRevenue.topServices.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-emerald-200 dark:border-emerald-500/15 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Scissors className="w-3.5 h-3.5" />
                      <span>
                        {pickLang(lang, {
                          ar: 'الخدمات المكتملة اليوم:',
                          fr: 'Prestations réalisées aujourd’hui :',
                          amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏ ⵡⴰⵙⵙⴰ:',
                          en: 'Services completed today:',
                          es: 'Servicios completados hoy:',
                        })}
                      </span>
                    </span>
                    {dailyRevenue.topServices.slice(0, 4).map((srv, idx) => (
                      <span key={srv.name} className="inline-flex items-center gap-1">
                        {idx > 0 && <span className="text-zinc-400 dark:text-zinc-600" aria-hidden="true">·</span>}
                        <span className="font-semibold text-zinc-900 dark:text-white">{srv.name}</span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                          ({srv.count}× · {srv.revenue} MAD)
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Enterprise Workspace Navigation Tabs (3 organized groups for Master Admin; streamlined Caisse-first tabs for Barbers & Caisse) */}
            {session.role === 'master' ? (() => {
              const masterGroup: 'finance' | 'operations' | 'team_config' =
                ['caisse', 'analytics', 'summary'].includes(workspaceSection)
                  ? 'finance'
                  : ['credits', 'pricing', 'staff', 'profile', 'schedules', 'shifts'].includes(workspaceSection)
                  ? 'team_config'
                  : 'operations';

              const liveQueueCount = getLiveQueueBookings(
                bookings,
                todayStr,
                session.role,
                session.barberId,
                'all'
              ).length;
              const waitingCount = waitlistEntries.filter((w) => w.status === 'waiting').length;
              const pendingShiftCount = shiftRequests.filter((r) => r.status === 'pending').length;
              const openManualDebtorsCount = manualCredits.filter(
                (r) => getEffectiveManualCreditRemaining(r) > 0
              ).length;
              const openCaisseCreditsCount = caisseEntries.filter(
                (e) => getEffectiveCaisseCreditRemaining(e) > 0
              ).length;
              const openDisputesCount = creditDisputes.filter(
                (d) => d.status !== 'resolved'
              ).length;
              const totalOpenCreditsCount =
                openManualDebtorsCount + openCaisseCreditsCount + openDisputesCount;

              return (
                <div className="space-y-2.5 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  {/* 3 Primary Master Workspace Category Groups */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (masterGroup !== 'finance') setWorkspaceSection('caisse');
                      }}
                      className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-between gap-2 transition-all cursor-pointer border ${
                        masterGroup === 'finance'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:bg-emerald-50/70 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 shrink-0" />
                        <span>1. لاكيس والحسابات</span>
                      </span>
                      <span className="text-[10px] opacity-80 font-mono">Caisse</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (masterGroup !== 'operations') setWorkspaceSection('bookings');
                      }}
                      className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-between gap-2 transition-all cursor-pointer border ${
                        masterGroup === 'operations'
                          ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-zinc-950 border-amber-600 dark:border-amber-400 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:bg-amber-50/70 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 shrink-0" />
                        <span>2. الحجوزات، الطابور والزبناء</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-black/10 dark:bg-white/10">
                        {todayTickets.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (masterGroup !== 'team_config') setWorkspaceSection('credits');
                      }}
                      className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-between gap-2 transition-all cursor-pointer border ${
                        masterGroup === 'team_config'
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>3. الطاقم، الأثمنة والكريدي</span>
                      </span>
                      {totalOpenCreditsCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-orange-500 text-white">
                          {totalOpenCreditsCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Nested Sub-Tabs for Active Master Workspace Group */}
                  <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800">
                    {masterGroup === 'finance' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('caisse')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'caisse'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>صندوق لاكيس والحسابات</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('analytics')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'analytics'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>التحليلات المالية</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('summary')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'summary'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>ملخص الموارد والأداء</span>
                        </button>
                      </>
                    )}

                    {masterGroup === 'operations' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('bookings')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'bookings'
                              ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-black border-amber-600'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>الحجوزات ({bookings.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('queue')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'queue'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>الطابور المباشر ({liveQueueCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('crm')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'crm'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>ملفات الزبناء (CRM)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('loyalty')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'loyalty'
                              ? 'bg-amber-500 text-black border-amber-500'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>نقاط الولاء</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('waitlist')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'waitlist'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                          <span>قائمة الانتظار</span>
                          {waitingCount > 0 && (
                            <span className="px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-mono">
                              {waitingCount}
                            </span>
                          )}
                        </button>
                      </>
                    )}

                    {masterGroup === 'team_config' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('credits')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'credits'
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-white dark:bg-zinc-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/40'
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>الناس لي كانتسالهم</span>
                          {totalOpenCreditsCount > 0 && (
                            <span className="px-1.5 rounded-full bg-orange-500/20 text-[10px] font-mono">
                              {totalOpenCreditsCount}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('pricing')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'pricing'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>أثمنة المحل والباقات</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('staff')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'staff'
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>الفريق وكلمات المرور</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('profile')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'profile'
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <UserCog className="w-3.5 h-3.5" />
                          <span>ملفات وخدمات الحلاقين</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('schedules')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'schedules'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>أوقات العمل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('shifts')}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                            workspaceSection === 'shifts'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <Repeat className="w-3.5 h-3.5" />
                          <span>المناوبات ({pendingShiftCount})</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setWorkspaceSection('caisse')}
                  className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
                    workspaceSection === 'caisse'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  <Wallet className="w-4 h-4 shrink-0" />
                  <span>
                    {session.role === 'barber'
                      ? 'لاكيس والحسابات ديالي'
                      : pickLang(lang, {
                          ar: 'لاكيس والحسابات',
                          fr: 'Caisse & Comptabilité',
                          amz: 'ⵍⴰⴽⵉⵙ & ⵉⵙⵉⴹⴰⵏ',
                          en: 'Caisse & Accounting',
                          es: 'Caja y Contabilidad',
                        })}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkspaceSection('bookings')}
                  className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    workspaceSection === 'bookings'
                      ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-black border-amber-600 dark:border-amber-400 shadow-sm'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>
                    {pickLang(lang, {
                      ar: 'حجوزاتي',
                      fr: 'Mes Réservations',
                      amz: 'ⵉⵙⵉⵀⴰⵔⵏ ⵉⵏⵓ',
                      en: 'My Bookings',
                      es: 'Mis Reservas',
                    })}{' '}
                    ({kpiSourceBookings.length})
                  </span>
                </button>

                {session.role !== 'caisse' && (() => {
                  const barberOpenCaisseCount = caisseEntries.filter(
                    (e) =>
                      matchesCaisseBarber(e.barberId, e.barberName, session.barberId, barberRoster) &&
                      getEffectiveCaisseCreditRemaining(e) > 0
                  ).length;
                  const barberOpenManualCount = manualCredits.filter(
                    (r) =>
                      matchesCaisseBarber(
                        r.barberId || 'hassan',
                        r.barberName,
                        session.barberId,
                        barberRoster
                      ) && getEffectiveManualCreditRemaining(r) > 0
                  ).length;
                  const barberCreditsTotalCount = barberOpenCaisseCount + barberOpenManualCount;
                  return (
                    <button
                      type="button"
                      onClick={() => setWorkspaceSection('credits')}
                      className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                        workspaceSection === 'credits'
                          ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/40 hover:bg-orange-50 dark:hover:bg-orange-950/30'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>الكريدي ديالي</span>
                      {barberCreditsTotalCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-orange-500/20">
                          {barberCreditsTotalCount}
                        </span>
                      )}
                    </button>
                  );
                })()}

                {session.role !== 'caisse' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setWorkspaceSection('profile')}
                      className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                        workspaceSection === 'profile'
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      <UserCog className="w-4 h-4" />
                      <span>
                        {pickLang(lang, {
                          ar: 'ملفي وخدماتي',
                          fr: 'Mon Profil & Services',
                          amz: 'ⴰⴼⴰⵢⵍⵓ ⵉⵏⵓ',
                          en: 'My Profile & Services',
                          es: 'Mi Perfil y Servicios',
                        })}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWorkspaceSection('schedules')}
                      className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                        workspaceSection === 'schedules'
                          ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-black border-amber-600'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>
                        {pickLang(lang, {
                          ar: 'أوقات العمل',
                          fr: 'Horaires',
                          amz: 'ⵉⴽⵓⴷⵏ',
                          en: 'Schedules',
                          es: 'Horarios',
                        })}
                      </span>
                    </button>

                    {(() => {
                      const pendingShiftCount = shiftRequests.filter(
                        (r) =>
                          r.status === 'pending' &&
                          (r.barberId === session.barberId ||
                            r.swapWithBarberId === session.barberId)
                      ).length;
                      return (
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('shifts')}
                          className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            workspaceSection === 'shifts'
                              ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-black border-amber-600'
                              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <Repeat className="w-4 h-4" />
                          <span>
                            {pickLang(lang, {
                              ar: 'المناوبات',
                              fr: 'Shifts',
                              amz: 'ⵜⵉⵙⵙⵓⵔⵉⵏ',
                              en: 'Shifts',
                              es: 'Turnos',
                            })}
                          </span>
                          {pendingShiftCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums bg-amber-500/20 text-amber-700 dark:text-amber-300">
                              {pendingShiftCount}
                            </span>
                          )}
                        </button>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* Navigation Tabs: Today's View vs. Archive / History + QR Scanner Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              {workspaceSection === 'bookings' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('today');
                      setArchiveDateFilter('');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                      activeTab === 'today'
                        ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-black border-amber-600 dark:border-amber-400 shadow-sm'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span>
                      {pickLang(lang, {
                        ar: `المواعيد القادمة (${todayStr})`,
                        fr: `Rendez-vous à venir (${todayStr})`,
                        amz: `ⵉⵙⵉⵀⴰⵔⵏ ⴷ ⵉⴷⴷⴰⵏ (${todayStr})`,
                        en: `Upcoming Queue (${todayStr})`,
                        es: `Próximas citas (${todayStr})`,
                      })}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('archive')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                      activeTab === 'archive'
                        ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-black border-amber-600 dark:border-amber-400 shadow-sm'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <Archive className="w-4 h-4" />
                    <span>
                      {pickLang(lang, {
                        ar: 'الأرشيف والسجل الكامل',
                        fr: 'Archives & Historique',
                        amz: 'ⴰⵕⵛⵉⴼ ⴷ ⵓⵎⵣⵔⵓⵢ',
                        en: 'Archive & Full History',
                        es: 'Archivo e Historial',
                      })}
                    </span>
                  </button>

                  {session.role === 'master' && (
                    <button
                      type="button"
                      onClick={() => {
                        setWalkInBarberId(
                          masterBarberFilter !== 'all' ? masterBarberFilter : 'hassan'
                        );
                        setIsWalkInModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {pickLang(lang, {
                          ar: 'حجز مباشر بالصالون (بدون حد)',
                          fr: 'Réservation directe salon (sans limite)',
                          amz: 'ⴰⵙⵉⵀⴰⵔ ⵓⵙⵔⵉⴷ (ⵡⴰⵔ ⵜⵉⵍⵉⵙⵜ)',
                          en: 'Direct Walk-In Booking (No Cap)',
                          es: 'Reserva directa salón (sin límite)',
                        })}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-xs text-zinc-400 font-semibold">
                  {workspaceSection === 'queue' &&
                    pickLang(lang, {
                      ar: '⚡ الطابور المباشر لمواعيد اليوم — معرفة التالي في الدور لحظياً',
                      fr: '⚡ File d’attente en direct du jour — suivi du tour en temps réel',
                      amz: '⚡ ⴰⴱⵔⵉⴷ ⵓⵙⵔⵉⴷ ⵏ ⵉⵙⵉⵀⴰⵔⵏ ⵏ ⵡⴰⵙⵙⴰ',
                      en: '⚡ Live queue for today — track who is next in real time',
                      es: '⚡ Cola en vivo de hoy — sigue el turno en tiempo real',
                    })}
                  {workspaceSection === 'summary' &&
                    pickLang(lang, {
                      ar: '📊 ملخص الموارد، التوزيع الأسبوعي والأداء العام',
                      fr: '📊 Synthèse des ressources, charge hebdomadaire et avis',
                      amz: '📊 ⵜⴰⴳⴹⵡⵉⵜ ⵏ ⵉⵙⵓⴳⴰⵎ ⴷ ⵜⵡⵓⵔⵉ',
                      en: '📊 Resource planning summary, weekly load & reviews',
                      es: '📊 Resumen de recursos, carga semanal y reseñas',
                    })}
                  {workspaceSection === 'analytics' &&
                    pickLang(lang, {
                      ar: '📈 إحصائيات الأرباح والخدمات (خاص بالمشرف العام)',
                      fr: '📈 Statistiques revenus et prestations (Master Admin)',
                      amz: '📈 ⵜⵉⵙⵍⴹⵉⵏ ⵏ ⵉⴽⵛⵓⵎⵏ ⴷ ⵜⵡⵓⵔⵉⵡⵉⵏ',
                      en: '📈 Revenue & service analytics (Master Admin)',
                      es: '📈 Estadísticas de ingresos y servicios',
                    })}
                  {workspaceSection === 'crm' &&
                    pickLang(lang, {
                      ar: '👑 إدارة الولاء، الزيارات والقائمة السوداء',
                      fr: '👑 Gestion fidélité, visites et liste noire',
                      amz: '👑 ⴰⵙⵡⵓⴷⴷⵓ ⵏ ⵜⵉⵖⵓⴷⴰ ⴷ ⵉⵔⵣⴰⴼⵏ',
                      en: '👑 Loyalty, verified visits & blacklist management',
                      es: '👑 Gestión de fidelidad, visitas y lista negra',
                    })}
                  {workspaceSection === 'loyalty' &&
                    pickLang(lang, {
                      ar: '🪙 إدارة نقاط الولاء حسب الخدمة (+3 إلى +22 نقطة/زيارة) والمكافآت التدريجية',
                      fr: '🪙 Points fidélité par prestation (+3 à +22 pts/visite) et récompenses progressives',
                      amz: '🪙 ⴰⵙⵡⵓⴷⴷⵓ ⵏ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵙ ⵜⵡⵓⵔⵉ (+3–22 pts)',
                      en: '🪙 Service-based loyalty points (+3 to +22 pts/visit) & progressive rewards',
                      es: '🪙 Puntos de fidelidad por servicio (+3 a +22 pts/visita) y premios progresivos',
                    })}
                  {workspaceSection === 'schedules' &&
                    pickLang(lang, {
                      ar: '🕒 تخصيص ساعات الراحة وأيام العطل لكل حلاق',
                      fr: '🕒 Configurer les pauses et jours de congé par barbier',
                      amz: '🕒 ⴰⵙⵖⵉⵡⵙ ⵏ ⵉⴽⵓⴷⵏ ⵏ ⵓⵙⵓⵏⴼⵓ ⵏ ⴽⵓ ⴰⵎⴽⵕⴰⴹ',
                      en: '🕒 Customize break hours and off days for each barber',
                      es: '🕒 Personaliza pausas y días libres de cada barbero',
                    })}
                  {workspaceSection === 'shifts' &&
                    pickLang(lang, {
                      ar: '⇄ طلبات الإجازة وتبديل المناوبات مع التحديث الفوري لصفحة الحجز',
                      fr: '⇄ Demandes de congé et échanges de créneaux synchronisés en direct',
                      amz: '⇄ ⵜⵓⵜⵜⵔⵉⵡⵉⵏ ⵏ ⵓⵙⵓⵏⴼⵓ ⴷ ⵓⵙⵏⴼⵍ ⵏ ⵜⵉⵙⵙⵓⵔⵉⵏ',
                      en: '⇄ Leave requests & shift swaps synced live with booking slots',
                      es: '⇄ Solicitudes de días libres y cambios de turno en vivo',
                    })}
                  {workspaceSection === 'waitlist' &&
                    pickLang(lang, {
                      ar: '📋 متابعة المسجلين في قائمة الانتظار الذكية',
                      fr: '📋 Suivi des clients inscrits sur la liste d’attente',
                      amz: '📋 ⴰⴹⴼⴰⵕ ⵏ ⵜⵍⴳⴰⵎⵜ ⵏ ⵓⵔⴰⵊⵓ',
                      en: '📋 Manage clients registered on the smart waitlist',
                      es: '📋 Seguimiento de la lista de espera inteligente',
                    })}
                  {workspaceSection === 'caisse' &&
                    pickLang(lang, {
                      ar: '💰 صندوق لاكيس والحسابات المعزول — المداخيل، المصاريف، الكريدي وتصفية الحسابات',
                      fr: '💰 Caisse & Comptabilité isolée — revenus, dépenses, crédits et clôture',
                      amz: '💰 ⵍⴰⴽⵉⵙ & ⵉⵙⵉⴹⴰⵏ — ⵉⴽⵛⵓⵎⵏ, ⵉⵎⵙⴰⵔⴰⵜⵏ ⴷ ⵓⴽⵔⵉⴷⵉ',
                      en: '💰 Isolated Caisse & Accounting — income, expenses, credits & settlements',
                      es: '💰 Caja y Contabilidad aislada — ingresos, gastos, créditos y cierres',
                    })}
                  {workspaceSection === 'pricing' &&
                    pickLang(lang, {
                      ar: '🏷️ إدارة أثمنة المحل الرسمية، استرجاع الأثمنة الافتراضية، وعروض الأيام والأعياد (المشرف العام فقط)',
                      fr: '🏷️ Tarifs officiels du salon, réinitialisation et règles spéciales jours/Aïd (Master Admin)',
                      amz: '🏷️ ⴰⵜⵉⴳⵏ ⵏ ⵓⵙⴰⵍⵓⵏ ⴷ ⵉⵍⵓⴳⴰⵏ ⵏ ⵓⵙⴼⵓⴳⵍⵓ',
                      en: '🏷️ Official salon pricing, default restore & special weekday/Eid rules (Master Admin only)',
                      es: '🏷️ Precios oficiales del salón y reglas especiales (Solo Admin Maestro)',
                    })}
                  {workspaceSection === 'staff' &&
                    pickLang(lang, {
                      ar: '🔐 إدارة كلمات مرور الطاقم ولاكيس + إضافة أو استبدال الحلاقين (المشرف العام فقط)',
                      fr: '🔐 Gestion des mots de passe équipe & Caisse + ajout ou remplacement de barbiers',
                      amz: '🔐 ⴰⵙⵡⵓⴷⴷⵓ ⵏ ⵉⵡⴰⵍⵉⵡⵏ ⵏ ⵜⵔⴰⴱⴱⵓⵜ & PIN',
                      en: '🔐 Team & Caisse PIN management + add or replace barbers (Master Admin only)',
                      es: '🔐 Gestión de contraseñas del equipo y Caja + añadir o reemplazar barberos',
                    })}
                  {workspaceSection === 'credits' &&
                    '📒 الناس لي كانتسالهم — كشف الكريدي اليدوي ومستحقات المواعيد مع تنبيه تلقائي برقم الهاتف'}
                </div>
              )}

              {/* Notification Alert Toggle & QR Scanner Tool */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer shadow-xs ${
                    notificationsEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-600/20 border-emerald-200 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-600/30'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                  title={pickLang(lang, {
                    ar: 'تفعيل أو كتم التنبيهات الصوتية والمنبثقة عند وصول حجز جديد',
                    fr: 'Activer ou couper les alertes sonores et notifications',
                    amz: 'ⵙⵎⵔ ⵏⵖ ⵙⵙⵏⵙ ⵜⵓⵏⵏⵓⵏⵉⵏ',
                    en: 'Enable or mute sound and push alerts',
                    es: 'Activar o silenciar alertas y notificaciones',
                  })}
                >
                  {notificationsEnabled ? (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                      <span>
                        {pickLang(lang, {
                          ar: 'الإشعارات (مفعّلة ✓)',
                          fr: 'Notifications (Activées ✓)',
                          amz: 'ⵜⵓⵏⵏⵓⵏⵉⵏ (ⵜⵜⵓⵙⵎⵔⵏⵜ ✓)',
                          en: 'Alerts (ON ✓)',
                          es: 'Alertas (ON ✓)',
                        })}
                      </span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-4 h-4 text-zinc-400" />
                      <span>
                        {pickLang(lang, {
                          ar: 'الإشعارات (معطّلة)',
                          fr: 'Notifications (Désactivées)',
                          amz: 'ⵜⵓⵏⵏⵓⵏⵉⵏ (ⵅⵙⵉⵏⵜ)',
                          en: 'Alerts (OFF)',
                          es: 'Alertas (OFF)',
                        })}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenScanner}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>
                    {pickLang(lang, {
                      ar: 'ماسح QR',
                      fr: 'Scanner QR',
                      amz: 'ⴰⵙⴽⴰⵏⴰⵔ QR',
                      en: 'QR Scanner',
                      es: 'Escáner QR',
                    })}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQrGeneratorOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {pickLang(lang, {
                      ar: 'توليد QR الوصول والولاء',
                      fr: 'Générer QR Arrivée & Fidélité',
                      amz: 'ⴰⵙⵏⵓⵍⴼⵓ ⵏ QR ⵏ ⵡⴰⴽⵛⵓⵎ',
                      en: 'Generate Check-In QR',
                      es: 'Generar QR Llegada',
                    })}
                  </span>
                </button>

                {session.role !== 'caisse' && (
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen((prev) => !prev)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                      isSettingsOpen
                        ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>
                      {pickLang(lang, {
                        ar: 'إعدادات Google Business & Maps',
                        fr: 'Paramètres Google Business & Maps',
                        amz: 'ⵜⵉⵙⵖⴰⵍ Google Business & Maps',
                        en: 'Google Business & Maps Settings',
                        es: 'Ajustes Google Business & Maps',
                      })}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Settings Panel (Google Business Profile & Maps Links) */}
            {isSettingsOpen && session.role !== 'caisse' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#141720] border border-amber-300 dark:border-amber-500/40 shadow-lg">
                {/* Google Business Profile & Google Maps Links Configuration */}
                <form onSubmit={handleSaveGoogleLinks} className="p-4 sm:p-5 rounded-xl bg-stone-50 dark:bg-[#0D1017] border border-stone-200 dark:border-zinc-800 space-y-3.5 text-xs flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-2.5">
                      <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {pickLang(lang, {
                            ar: 'روابط Google Business و Maps',
                            fr: 'Liens Google Business & Maps',
                            amz: 'ⵉⵙⵖⵡⴰⵏ Google Business & Maps',
                            en: 'Google Business & Maps Links',
                            es: 'Enlaces Google Business & Maps',
                          })}
                        </span>
                      </div>
                      <a
                        href={mapsUrlInput}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:underline flex items-center gap-1"
                      >
                        <span>
                          {pickLang(lang, {
                            ar: 'معاينة',
                            fr: 'Aperçu',
                            amz: 'ⴰⵙⴽⵏ',
                            en: 'Preview',
                            es: 'Vista previa',
                          })}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                        {pickLang(lang, {
                          ar: 'رابط خرائط Google Maps المباشر للصالون',
                          fr: 'Lien direct Google Maps du salon',
                          amz: 'ⴰⵙⵖⵏ ⵓⵙⵔⵉⴷ Google Maps',
                          en: 'Direct Google Maps Salon Link',
                          es: 'Enlace directo Google Maps del salón',
                        })}
                      </label>
                      <input
                        type="url"
                        dir="ltr"
                        required
                        disabled={session.role !== 'master'}
                        value={mapsUrlInput}
                        onChange={(e) => setMapsUrlInput(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-stone-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-[11px] disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                        {pickLang(lang, {
                          ar: 'رابط ملف Google Business وتقييمات الزبناء 5★',
                          fr: 'Lien avis Google Business 5★',
                          amz: 'ⴰⵙⵖⵏ ⵏ ⵜⴰⵏⵏⴰⵢⵉⵏ Google 5★',
                          en: 'Google Business 5★ Reviews Link',
                          es: 'Enlace de reseñas Google Business 5★',
                        })}
                      </label>
                      <input
                        type="url"
                        dir="ltr"
                        required
                        disabled={session.role !== 'master'}
                        value={reviewUrlInput}
                        onChange={(e) => setReviewUrlInput(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-stone-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-[11px] disabled:opacity-60"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-200 dark:border-zinc-800/80">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>رقم الهاتف الرسمي في الموقع</span>
                        </label>
                        <input
                          type="tel"
                          dir="ltr"
                          disabled={session.role !== 'master'}
                          value={salonPhoneInput}
                          onChange={(e) => setSalonPhoneInput(e.target.value)}
                          placeholder="+212 635 392 503"
                          className="w-full bg-white dark:bg-zinc-950 border border-stone-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-[11px] disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1 flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>رقم واتساب الرسمي (مثال: 212635392503)</span>
                        </label>
                        <input
                          type="tel"
                          dir="ltr"
                          disabled={session.role !== 'master'}
                          value={salonWhatsappInput}
                          onChange={(e) => setSalonWhatsappInput(e.target.value)}
                          placeholder="212635392503"
                          className="w-full bg-white dark:bg-zinc-950 border border-stone-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-[11px] disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                        أرقام هواتف إضافية للعرض في الموقع (رقم في كل سطر — اختياري)
                      </label>
                      <textarea
                        dir="ltr"
                        rows={2}
                        disabled={session.role !== 'master'}
                        value={additionalPhonesText}
                        onChange={(e) => setAdditionalPhonesText(e.target.value)}
                        placeholder="+212 600 000 000"
                        className="w-full bg-white dark:bg-zinc-950 border border-stone-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-[11px] disabled:opacity-60"
                      />
                    </div>

                    {profileLinksError && (
                      <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-red-950/60 border border-rose-200 dark:border-red-500/40 text-rose-700 dark:text-red-300 text-[11px] font-semibold">
                        {profileLinksError}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-stone-200 dark:border-zinc-800/80">
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {session.role === 'master'
                        ? pickLang(lang, {
                            ar: 'يتم التحديث الفوري في الهيدر، الفوتر وقسم التقييمات.',
                            fr: 'Mis à jour en direct dans l’en-tête, pied de page et avis.',
                            amz: 'ⴰⵙⴷⵖⵉ ⵓⵙⵔⵉⴷ ⴳ ⵓⵙⵉⵜ ⴰⴽⴽⵯ.',
                            en: 'Syncs live across header, footer and reviews.',
                            es: 'Se actualiza en vivo en todo el sitio.',
                          })
                        : pickLang(lang, {
                            ar: 'متاح لتعديل المشرف العام فقط (Hassan).',
                            fr: 'Réservé au Master Admin (Hassan).',
                            amz: 'ⵉ ⵓⵏⵎⵀⴰⵍ ⴽⴰ (Hassan).',
                            en: 'Master Admin only (Hassan).',
                            es: 'Solo disponible para el Admin Maestro (Hassan).',
                          })}
                    </span>
                    {session.role === 'master' && (
                      <button
                        type="submit"
                        disabled={savingProfileLinks}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>
                          {savingProfileLinks
                            ? '...'
                            : profileLinksSaved
                              ? pickLang(lang, {
                                  ar: 'تم التحديث ✓',
                                  fr: 'Mis à jour ✓',
                                  amz: 'ⵉⵜⵜⵓⵙⴷⵖⵉ ✓',
                                  en: 'Updated ✓',
                                  es: 'Actualizado ✓',
                                })
                              : pickLang(lang, {
                                  ar: 'حفظ ونشر الروابط',
                                  fr: 'Enregistrer & Publier',
                                  amz: 'ⵃⴹⵓ & ⴼⵙⵔ',
                                  en: 'Save & Publish',
                                  es: 'Guardar y Publicar',
                                })}
                        </span>
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {workspaceSection === 'queue' && session.role === 'master' && (
              <LiveQueuePanel
                bookings={bookings}
                crmMap={crmClientsMap}
                todayStr={todayStr}
                role={session.role}
                ownBarberId={session.barberId}
                busyId={quickActionBusyId}
                onConfirm={handleConfirm}
                onMarkCompleted={handleMarkCompleted}
                onQuickCancel={handleQuickCancel}
                onOpenClientTracking={onOpenClientTracking}
                onShowClientQr={setQrTargetClient}
                lateBusyId={lateActionBusyId}
                onPostponeLateToNearest={handlePostponeLateBookingToNearest}
                onMoveLateToWaitlist={handleMoveLateBookingToWaitlist}
              />
            )}

            {workspaceSection === 'summary' && session.role === 'master' && (
              <ResourcePlanningSummaryCharts
                bookings={bookings}
                reviews={firestoreReviews}
                role={session.role}
                ownBarberId={session.barberId}
              />
            )}

            {workspaceSection === 'analytics' && session.role === 'master' && (
              <FinancialAnalyticsPanel
                bookings={bookings}
                role={session.role}
                ownBarberId={session.barberId}
              />
            )}

            {workspaceSection === 'schedules' && session.role !== 'caisse' && (
              <BarberSchedulePanel
                schedules={barberSchedules}
                bookings={bookings}
                role={session.role}
                ownBarberId={session.barberId}
              />
            )}

            {workspaceSection === 'shifts' && session.role !== 'caisse' && (
              <AdminShiftPlannerPanel
                requests={shiftRequests}
                schedules={barberSchedules}
                bookings={bookings}
                role={session.role}
                ownBarberId={session.barberId}
                reviewerName={session.name}
                todayStr={todayStr}
              />
            )}

            {workspaceSection === 'crm' && session.role === 'master' && (
              <CrmLoyaltyBlacklistPanel
                bookings={bookings}
                crmMap={crmClientsMap}
                onOpenClientTracking={onOpenClientTracking}
              />
            )}

            {workspaceSection === 'loyalty' && session.role === 'master' && (
              <LoyaltyPointsAdminPanel
                bookings={bookings}
                crmMap={crmClientsMap}
                onOpenClientTracking={onOpenClientTracking}
              />
            )}

            {workspaceSection === 'waitlist' && session.role === 'master' && (
              <WaitlistManagementPanel
                entries={waitlistEntries}
                role={session.role}
                ownBarberId={session.barberId}
              />
            )}

            {workspaceSection === 'caisse' && (
              <AdminCaissePanel
                sessionRole={session.role}
                ownBarberId={session.barberId}
                staffName={session.name}
                todayStr={todayStr}
                bookings={bookings}
                onAutoExitBarberSession={handleLogout}
              />
            )}

            {workspaceSection === 'profile' && session.role !== 'caisse' && (
              <BarberProfileServicesPanel
                sessionRole={session.role}
                ownBarberId={session.barberId}
                staffName={session.name}
                sessionMemberId={session.memberId}
              />
            )}

            {workspaceSection === 'pricing' && session.role === 'master' && (
              <MasterShopPricingPanel staffName={session.name} />
            )}

            {workspaceSection === 'staff' && session.role === 'master' && (
              <MasterTeamAccessPanel staffName={session.name} />
            )}

            {workspaceSection === 'credits' && session.role === 'master' && (
              <MasterClientCreditsPanel staffName={session.name} />
            )}

            {workspaceSection === 'credits' && session.role === 'barber' && (() => {
              const myCaisseCredits = caisseEntries.filter(
                (e) =>
                  matchesCaisseBarber(e.barberId, e.barberName, session.barberId, barberRoster) &&
                  getEffectiveCaisseCreditRemaining(e) > 0
              );
              const myManualCredits = manualCredits.filter(
                (r) =>
                  matchesCaisseBarber(
                    r.barberId || 'hassan',
                    r.barberName,
                    session.barberId,
                    barberRoster
                  ) && getEffectiveManualCreditRemaining(r) > 0
              );
              const myTotalOwedMAD =
                Math.round(
                  (myCaisseCredits.reduce((s, e) => s + getEffectiveCaisseCreditRemaining(e), 0) +
                    myManualCredits.reduce((s, r) => s + getEffectiveManualCreditRemaining(r), 0)) *
                    100
                ) / 100;
              const mySettlementReqs = settlementRequests.filter((req) =>
                matchesCaisseBarber(req.barberId, req.barberName, session.barberId, barberRoster)
              );

              const handleSubmitBarberCreditRequest = async (params: {
                sourceType: 'caisse' | 'manual';
                sourceId: string;
                clientName: string;
                clientPhone?: string;
                maxAmount: number;
              }) => {
                const amt = Math.max(0, Number(barberCreditReqAmount) || params.maxAmount);
                if (amt <= 0) return;
                setBarberCreditReqBusy(true);
                try {
                  await submitCreditSettlementRequest({
                    sourceType: params.sourceType,
                    sourceId: params.sourceId,
                    barberId: session.barberId,
                    barberName: session.name,
                    clientName: params.clientName,
                    clientPhone: params.clientPhone,
                    actionType: barberCreditReqAction,
                    originalRemainingMAD: params.maxAmount,
                    requestedAmountMAD: amt,
                    note: barberCreditReqNote.trim() || undefined,
                    submittedBy: session.name,
                    submittedRole: 'barber',
                  });
                  setBarberCreditReqKey(null);
                  setBarberCreditReqAmount('');
                  setBarberCreditReqNote('');
                  showToast(
                    'تم إرسال طلبك (يخلص/يفك الكريدي) للمشرف العام بنجاح ✓',
                    '',
                    'success'
                  );
                } catch (err) {
                  console.error('Failed to submit barber credit request:', err);
                } finally {
                  setBarberCreditReqBusy(false);
                }
              };

              return (
                <div className="space-y-4 pb-20 text-xs">
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-orange-300 dark:border-orange-500/40 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                          <span>الكريدي الخاص بي ({session.name})</span>
                        </h3>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          هنا تظهر فقط ملفات الكريدي المسجلة باسمك. كل طلب خلاص أو فك يمر عبر موافقة المشرف العام.
                        </p>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/35 font-mono font-black text-base text-orange-800 dark:text-orange-200">
                        {myTotalOwedMAD} MAD
                      </div>
                    </div>
                  </div>

                  {mySettlementReqs.length > 0 && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 space-y-2.5">
                      <div className="font-black text-sm text-zinc-900 dark:text-white">
                        حالة طلبات خلاص أو فك الكريدي ({mySettlementReqs.length})
                      </div>
                      <div className="space-y-2">
                        {mySettlementReqs.slice(0, 12).map((req) => (
                          <div
                            key={req.id}
                            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-black text-zinc-900 dark:text-white">
                                {req.clientName}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  req.actionType === 'pay'
                                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                                }`}
                              >
                                {req.actionType === 'pay' ? 'يخلص' : 'يفك من الكريدي'} ({req.requestedAmountMAD} MAD)
                              </span>
                              {req.reviewerNote && (
                                <span className="text-[11px] text-zinc-500">{req.reviewerNote}</span>
                              )}
                            </div>
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-black ${
                                req.status === 'confirmed'
                                  ? 'bg-emerald-600 text-white'
                                  : req.status === 'rejected'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-amber-500 text-black'
                              }`}
                            >
                              {req.status === 'confirmed'
                                ? `تم التأكيد ✓ (${req.approvedAmountMAD ?? req.requestedAmountMAD} MAD)`
                                : req.status === 'rejected'
                                ? 'تم النفي ✕'
                                : 'بانتظار المشرف'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {myCaisseCredits.length === 0 && myManualCredits.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                      لا يوجد أي كريدي مفتوح مسجل باسمك حالياً ✓
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {myCaisseCredits.map((entry) => {
                        const rowKey = `caisse_${entry.id}`;
                        const effRem = getEffectiveCaisseCreditRemaining(entry);
                        const isOpen = barberCreditReqKey === rowKey;
                        const hasPending = mySettlementReqs.some(
                          (r) => r.sourceId === entry.id && r.status === 'pending'
                        );
                        const waUrl = buildCreditWhatsAppReminderUrl({
                          clientPhone: entry.clientPhone,
                          clientName: entry.clientName,
                          amountOwedMAD: effRem,
                          creditorName: session.name,
                          creditDate: entry.date,
                          note: entry.note,
                          lang,
                        });
                        return (
                          <div
                            key={rowKey}
                            className="p-3.5 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 border-s-4 border-s-orange-500 space-y-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                                  <span>{entry.clientName || 'زبون'}</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                    من لاكيس
                                  </span>
                                  {hasPending && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">
                                      طلب معلق
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-zinc-500 mt-0.5 flex flex-wrap items-center gap-2">
                                  {entry.clientPhone && <span dir="ltr">{entry.clientPhone}</span>}
                                  <span>· {entry.date}</span>
                                  {entry.note && <span className="font-sans">· {entry.note}</span>}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-3 py-1 rounded-xl bg-orange-50 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/30 font-mono font-black text-orange-800 dark:text-orange-200">
                                  {effRem} MAD
                                </span>
                                {waUrl && (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>واتساب</span>
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBarberCreditReqKey(isOpen ? null : rowKey);
                                    setBarberCreditReqAction('pay');
                                    setBarberCreditReqAmount(String(effRem));
                                    setBarberCreditReqNote('');
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer"
                                >
                                  يخلص ولا يفك من الكريدي
                                </button>
                              </div>
                            </div>

                            {isOpen && (
                              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setBarberCreditReqAction('pay')}
                                    className={`py-1.5 px-2 rounded-lg font-black border cursor-pointer ${
                                      barberCreditReqAction === 'pay'
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                    }`}
                                  >
                                    يخلص الكريدي (أداء)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBarberCreditReqAction('clear')}
                                    className={`py-1.5 px-2 rounded-lg font-black border cursor-pointer ${
                                      barberCreditReqAction === 'clear'
                                        ? 'bg-amber-600 text-white border-amber-600'
                                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                    }`}
                                  >
                                    يفك من الكريدي (تسوية)
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    max={effRem}
                                    value={barberCreditReqAmount}
                                    onChange={(e) => setBarberCreditReqAmount(e.target.value)}
                                    className="w-28 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-zinc-900 dark:text-white"
                                  />
                                  <input
                                    type="text"
                                    value={barberCreditReqNote}
                                    onChange={(e) => setBarberCreditReqNote(e.target.value)}
                                    placeholder="ملاحظة للمشرف العام (اختياري)..."
                                    className="flex-1 min-w-[160px] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    disabled={barberCreditReqBusy}
                                    onClick={() =>
                                      void handleSubmitBarberCreditRequest({
                                        sourceType: 'caisse',
                                        sourceId: entry.id,
                                        clientName: entry.clientName || 'زبون',
                                        clientPhone: entry.clientPhone,
                                        maxAmount: effRem,
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer disabled:opacity-50"
                                  >
                                    إرسال للمشرف ✓
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {myManualCredits.map((rec) => {
                        const rowKey = `manual_${rec.id}`;
                        const effRem = getEffectiveManualCreditRemaining(rec);
                        const isOpen = barberCreditReqKey === rowKey;
                        const allPhones = [rec.clientPhone, ...(rec.additionalPhones || [])]
                          .map((p) => String(p || '').trim())
                          .filter(Boolean);
                        const waUrl = buildCreditWhatsAppReminderUrl({
                          clientPhone: allPhones[0] || '',
                          clientName: rec.clientName,
                          amountOwedMAD: effRem,
                          creditorName: session.name,
                          creditDate: rec.creditDate || rec.createdAt.slice(0, 10),
                          note: rec.note,
                          lang,
                        });
                        return (
                          <div
                            key={rowKey}
                            className="p-3.5 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 border-s-4 border-s-amber-500 space-y-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                                  <span>{rec.clientName}</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">
                                    سجل الكريدي
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-zinc-500 mt-0.5 flex flex-wrap items-center gap-2">
                                  {allPhones.map((ph, idx) => (
                                    <span key={`${ph}-${idx}`} dir="ltr">
                                      {ph}
                                    </span>
                                  ))}
                                  <span>· {rec.creditDate || rec.createdAt.slice(0, 10)}</span>
                                  {rec.note && <span className="font-sans">· {rec.note}</span>}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-3 py-1 rounded-xl bg-orange-50 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/30 font-mono font-black text-orange-800 dark:text-orange-200">
                                  {effRem} MAD
                                </span>
                                {waUrl && (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>واتساب</span>
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBarberCreditReqKey(isOpen ? null : rowKey);
                                    setBarberCreditReqAction('pay');
                                    setBarberCreditReqAmount(String(effRem));
                                    setBarberCreditReqNote('');
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer"
                                >
                                  يخلص ولا يفك من الكريدي
                                </button>
                              </div>
                            </div>

                            {isOpen && (
                              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setBarberCreditReqAction('pay')}
                                    className={`py-1.5 px-2 rounded-lg font-black border cursor-pointer ${
                                      barberCreditReqAction === 'pay'
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                    }`}
                                  >
                                    يخلص الكريدي (أداء)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBarberCreditReqAction('clear')}
                                    className={`py-1.5 px-2 rounded-lg font-black border cursor-pointer ${
                                      barberCreditReqAction === 'clear'
                                        ? 'bg-amber-600 text-white border-amber-600'
                                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                    }`}
                                  >
                                    يفك من الكريدي (تسوية)
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    max={effRem}
                                    value={barberCreditReqAmount}
                                    onChange={(e) => setBarberCreditReqAmount(e.target.value)}
                                    className="w-28 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-zinc-900 dark:text-white"
                                  />
                                  <input
                                    type="text"
                                    value={barberCreditReqNote}
                                    onChange={(e) => setBarberCreditReqNote(e.target.value)}
                                    placeholder="ملاحظة للمشرف العام (اختياري)..."
                                    className="flex-1 min-w-[160px] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    disabled={barberCreditReqBusy}
                                    onClick={() =>
                                      void handleSubmitBarberCreditRequest({
                                        sourceType: 'manual',
                                        sourceId: rec.id,
                                        clientName: rec.clientName,
                                        clientPhone: allPhones[0],
                                        maxAmount: effRem,
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer disabled:opacity-50"
                                  >
                                    إرسال للمشرف ✓
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
              );
            })()}

            {workspaceSection === 'bookings' && (
              <>
            {scannedTicketNotice && (
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-500/40 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{scannedTicketNotice}</span>
                <div className="flex items-center gap-2">
                  {onOpenClientTracking && scannedLookupQuery && (
                    <button
                      type="button"
                      onClick={() => onOpenClientTracking(scannedLookupQuery)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>
                        {pickLang(lang, {
                          ar: 'فتح نافذة التتبع',
                          fr: 'Ouvrir le suivi',
                          amz: 'ⴰⵕⵥⵥⵓⵎ ⵏ ⵓⴹⴼⴰⵕ',
                          en: 'Open Tracking',
                          es: 'Abrir seguimiento',
                        })}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setScannedTicketNotice(null);
                      setScannedLookupQuery(null);
                    }}
                    className="p-1 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Archive Date Filter Picker (Shown only in Archive tab) */}
            {activeTab === 'archive' && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-zinc-700 dark:text-zinc-300 font-semibold flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>
                    {pickLang(lang, {
                      ar: 'تصفية الأرشيف حسب تاريخ محدد:',
                      fr: 'Filtrer les archives par date :',
                      amz: 'ⴰⵙⵜⴰⵢ ⵏ ⵓⵕⵛⵉⴼ ⵙ ⵓⵙⴰⴽⵓⴷ:',
                      en: 'Filter archive by date:',
                      es: 'Filtrar archivo por fecha:',
                    })}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={archiveDateFilter}
                    onChange={(e) => setArchiveDateFilter(e.target.value)}
                    className="bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white"
                  />
                  {archiveDateFilter && (
                    <button
                      onClick={() => setArchiveDateFilter('')}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white text-xs cursor-pointer"
                    >
                      {pickLang(lang, {
                        ar: 'عرض كل التواريخ',
                        fr: 'Toutes les dates',
                        amz: 'ⵉⵙⴰⴽⵓⴷⵏ ⴰⴽⴽⵯ',
                        en: 'Show all dates',
                        es: 'Todas las fechas',
                      })}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TODAY'S KPI METRICS (Interactive -> Centered Modal) */}
            {activeTab === 'today' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setBookingKpiModal('today_all')}
                  className="text-start p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider block">
                      {pickLang(lang, {
                        ar: 'تذاكر اليوم',
                        fr: 'Tickets du jour',
                        amz: 'ⵉⵏⵜⵜⵉⴽⵉⵜⵏ ⵏ ⵡⴰⵙⵙⴰ',
                        en: "Today's Tickets",
                        es: 'Tickets de hoy',
                      })}
                    </span>
                    <Eye className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors shrink-0" />
                  </div>
                  <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono">{todayTickets.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBookingKpiModal('pending')}
                  className="text-start p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500/60 shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold tracking-wider block">
                      {pickLang(lang, {
                        ar: 'قيد المراجعة (معلق)',
                        fr: 'En attente',
                        amz: 'ⴳ ⵓⵔⴰⵊⵓ',
                        en: 'Pending',
                        es: 'Pendientes',
                      })}
                    </span>
                    <Eye className="w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors shrink-0" />
                  </div>
                  <span className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">{pendingCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBookingKpiModal('confirmed')}
                  className="text-start p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-500/60 shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-wider block">
                      {pickLang(lang, {
                        ar: 'مؤكد ومقبول',
                        fr: 'Confirmés',
                        amz: 'ⵉⵜⵜⵓⵙⵏⵜⵎⵏ',
                        en: 'Confirmed',
                        es: 'Confirmados',
                      })}
                    </span>
                    <Eye className="w-3.5 h-3.5 text-emerald-500/70 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors shrink-0" />
                  </div>
                  <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">{confirmedCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBookingKpiModal('rejected')}
                  className="text-start p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-red-500/60 shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-rose-700 dark:text-red-400 uppercase font-bold tracking-wider block">
                      {pickLang(lang, {
                        ar: 'مرفوض / ملغى',
                        fr: 'Refusés / Annulés',
                        amz: 'ⵉⵜⵜⵓⵙⵔⵏ',
                        en: 'Rejected / Cancelled',
                        es: 'Rechazados / Cancelados',
                      })}
                    </span>
                    <Eye className="w-3.5 h-3.5 text-rose-500/70 group-hover:text-rose-700 dark:group-hover:text-red-300 transition-colors shrink-0" />
                  </div>
                  <span className="text-2xl font-black text-rose-700 dark:text-red-400 font-mono">{rejectedCount}</span>
                </button>
              </div>
            )}

            {/* WEEKLY TEAM WORKLOAD BAR CHART (Master Admin only — hidden from individual barbers) */}
            {activeTab === 'today' && session.role === 'master' && (
              <WeeklyWorkloadBarChart bookings={bookings} todayStr={todayStr} />
            )}

            {/* Filter Toolbar & Status Tabs */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                
                {/* Search Input */}
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={pickLang(lang, {
                      ar: 'بحث برقم التذكرة #SB أو الهاتف (06... / +212)...',
                      fr: 'Rechercher par ticket #SB ou tél (06... / +212)...',
                      amz: 'ⵔⵣⵓ ⵙ #SB ⵏⵖ ⵓⵟⵟⵓⵏ (06...)...',
                      en: 'Search by ticket #SB or phone (06... / +212)...',
                      es: 'Buscar por ticket #SB o teléfono (06...)...',
                    })}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl ps-9 pe-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Highly Visible Status Toggle Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer border ${
                      statusFilter === 'all'
                        ? 'bg-zinc-900 dark:bg-zinc-200 text-white dark:text-black border-zinc-900 dark:border-zinc-200 shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {pickLang(lang, {
                      ar: 'الكل',
                      fr: 'Tous',
                      amz: 'ⴰⴽⴽⵯ',
                      en: 'All',
                      es: 'Todos',
                    })}
                  </button>

                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer border ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-black border-amber-400 shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-amber-700 dark:text-amber-400 border-zinc-200 dark:border-zinc-700 hover:bg-amber-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {pickLang(lang, {
                      ar: 'معلق',
                      fr: 'En attente',
                      amz: 'ⴳ ⵓⵔⴰⵊⵓ',
                      en: 'Pending',
                      es: 'Pendiente',
                    })}
                  </button>

                  <button
                    onClick={() => setStatusFilter('confirmed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer border ${
                      statusFilter === 'confirmed'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 border-zinc-200 dark:border-zinc-700 hover:bg-emerald-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {pickLang(lang, {
                      ar: 'مقبول',
                      fr: 'Confirmé',
                      amz: 'ⵉⵜⵜⵓⵙⵏⵜⵎ',
                      en: 'Confirmed',
                      es: 'Confirmado',
                    })}
                  </button>

                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer border ${
                      statusFilter === 'completed'
                        ? 'bg-teal-600 text-white border-teal-500 shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-teal-700 dark:text-teal-400 border-zinc-200 dark:border-zinc-700 hover:bg-teal-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {pickLang(lang, {
                      ar: 'مكتمل',
                      fr: 'Terminé',
                      amz: 'ⵉⵙⵎⴷ',
                      en: 'Completed',
                      es: 'Completado',
                    })}
                  </button>

                  <button
                    onClick={() => setStatusFilter('rejected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer border ${
                      statusFilter === 'rejected'
                        ? 'bg-red-600 text-white border-red-500 shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-rose-700 dark:text-red-400 border-zinc-200 dark:border-zinc-700 hover:bg-rose-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {pickLang(lang, {
                      ar: 'مرفوض / ملغى / تغيب',
                      fr: 'Refusé / Annulé / Absent',
                      amz: 'ⵉⵜⵜⵓⵙⵔ / ⵉⵏⵖⵓⴱⴰ',
                      en: 'Rejected / Cancelled / No-Show',
                      es: 'Rechazado / Cancelado',
                    })}
                  </button>
                </div>
              </div>

              {/* Master Admin & Caisse: Barber Filter Tabs with Subtle Identity Indicators */}
              {(session.role === 'master' || session.role === 'caisse') && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 font-semibold text-[11px] flex items-center gap-1 flex-shrink-0">
                    <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>
                      {pickLang(lang, {
                        ar: 'تصفية حسب الحلاق :',
                        fr: 'Filtrer par barbier :',
                        amz: 'ⴰⵙⵜⴰⵢ ⵙ ⵓⵎⴽⵕⴰⴹ :',
                        en: 'Filter by barber:',
                        es: 'Filtrar por barbero:',
                      })}
                    </span>
                  </span>

                  <button
                    onClick={() => setMasterBarberFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                      masterBarberFilter === 'all'
                        ? 'bg-zinc-900 dark:bg-zinc-200 text-white dark:text-black border-zinc-900 dark:border-zinc-200'
                        : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    {pickLang(lang, {
                      ar: 'كل الحلاقين',
                      fr: 'Tous les barbiers',
                      amz: 'ⵉⵎⴽⵕⴰⴹⵏ ⴰⴽⴽⵯ',
                      en: 'All Barbers',
                      es: 'Todos los barberos',
                    })}{' '}
                    ({bookings.length})
                  </button>

                  {mergedBarbers.map((b) => {
                    const count = bookings.filter(
                      (item) => item.barberId === b.id || item.barberName.toLowerCase().includes(b.name.fr.toLowerCase().split(' ')[0])
                    ).length;
                    const tone = getBarberIdentityTokens(b.id, b.name.ar, b.colorName);
                    const isActive = masterBarberFilter === b.id;

                    return (
                      <button
                        key={b.id}
                        onClick={() => setMasterBarberFilter(b.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                          isActive
                            ? tone.activeTabClass
                            : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full inline-block ${
                            isActive ? 'bg-white dark:bg-current' : tone.dotClass
                          }`}
                        />
                        <span className="truncate">{b.name[lang] || b.name.ar || b.name.fr}</span>
                        <span className="opacity-75 font-mono">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Remaining Clients & Upcoming Days Summary Bar (Interactive -> Centered Modal) */}
            {activeTab === 'today' && (
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBookingKpiModal('queue_active')}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-black font-mono tabular-nums inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>باقي اليوم: {todayActiveQueue.length} زبناء</span>
                    <Eye className="w-3.5 h-3.5 opacity-75" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingKpiModal('queue_future')}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold font-mono tabular-nums inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>الأيام القادمة / الأسبوع المقبل: {futureUpcomingQueue.length}</span>
                    <Eye className="w-3.5 h-3.5 opacity-75" />
                  </button>
                  {todayPastOrDoneQueue.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBookingKpiModal('queue_done')}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold font-mono tabular-nums inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>مرت / منتهية: {todayPastOrDoneQueue.length}</span>
                      <Eye className="w-3.5 h-3.5 opacity-75" />
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  مرتبة زمنياً حسب أقرب ساعة · اضغط على أي بطاقة لعرض التفاصيل
                </span>
              </div>
            )}

            {/* Bookings List */}
            {visibleBookings.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 space-y-3">
                <CalendarDays className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto" />
                <p className="text-zinc-600 dark:text-zinc-400 text-xs font-medium">
                  {activeTab === 'today'
                    ? pickLang(lang, {
                        ar: `لا توجد مواعيد قادمة مبرمجة حالياً ابتداءً من اليوم (${todayStr}).`,
                        fr: `Aucun rendez-vous à venir programmé à partir d’aujourd’hui (${todayStr}).`,
                        amz: `ⵓⵔ ⵍⵍⵉⵏ ⵉⵙⵉⵀⴰⵔⵏ ⴷ ⵉⴷⴷⴰⵏ (${todayStr}).`,
                        en: `No upcoming appointments scheduled from today (${todayStr}).`,
                        es: `No hay próximas citas programadas desde hoy (${todayStr}).`,
                      })
                    : pickLang(lang, {
                        ar: 'لا توجد أي تذاكر مطابقة في الأرشيف أو البحث.',
                        fr: 'Aucun ticket correspondant dans les archives.',
                        amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⵏⵜⵜⵉⴽⵉⵜⵏ ⴳ ⵓⵕⵛⵉⴼ.',
                        en: 'No matching tickets found in archive.',
                        es: 'No hay tickets coincidentes en el archivo.',
                      })}
                </p>
                {activeTab === 'today' && (bookings.length > 0 || archiveSearchMatchesCount > 0) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('archive')}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {archiveSearchMatchesCount > 0
                        ? pickLang(lang, {
                            ar: `تم العثور على ${archiveSearchMatchesCount} نتيجة مطابقة في الأرشيف الكامل — عرض الآن`,
                            fr: `${archiveSearchMatchesCount} résultat(s) trouvé(s) dans les archives — Afficher`,
                            amz: `ⵜⵜⵓⴼⴰⵏ ${archiveSearchMatchesCount} ⴳ ⵓⵕⵛⵉⴼ — ⵙⴼⵙⵔ`,
                            en: `Found ${archiveSearchMatchesCount} match(es) in full archive — View now`,
                            es: `${archiveSearchMatchesCount} resultado(s) en archivo — Ver ahora`,
                          })
                        : pickLang(lang, {
                            ar: `عرض جميع الحجوزات بالأرشيف (${bookings.length} حجز)`,
                            fr: `Voir toutes les archives (${bookings.length} tickets)`,
                            amz: `ⵙⴼⵙⵔ ⴰⵕⵛⵉⴼ ⴰⴽⴽⵯ (${bookings.length})`,
                            en: `View all archived bookings (${bookings.length})`,
                            es: `Ver todo el archivo (${bookings.length})`,
                          })}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              (() => {
                const renderBookingCard = (booking: AppointmentBooking) => {
                  const clientPhoneClean = formatMoroccanWhatsAppNumber(booking.clientPhone);
                  const isNoteSaved = savedNoteId === booking.id;
                  const barberTone = getBarberIdentityTokens(booking.barberId, booking.barberName);
                  const isCardExpanded = Boolean(expandedBookingIds[booking.id]);
                  const clientNormalized = normalizeMoroccanPhoneDigits(booking.clientPhone);
                  const crmProfile = crmClientsMap[getCrmDocId(booking.clientPhone)];
                  const clientBookingsForPhone = clientNormalized
                    ? bookings.filter(
                        (item) =>
                          normalizeMoroccanPhoneDigits(item.clientPhone) === clientNormalized
                      )
                    : [];
                  const verifiedVisitsCount = getVerifiedVisitsCount(clientBookingsForPhone, crmProfile);
                  const loyaltyState = computeLoyaltyProgress(verifiedVisitsCount, lang);
                  const bookingCredit = computeOutstandingCreditsForPhone(
                    booking.clientPhone,
                    caisseEntries,
                    manualCredits,
                    barberRoster
                  );
                  const durationLabel = booking.totalDurationMinutes
                    ? `${booking.totalDurationMinutes}m`
                    : '60m';

                  return (
                    <div
                      key={booking.id}
                      className={`rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-all ${barberTone.borderLeftClass}`}
                    >
                      {/* Compact Single-Line Booking Header (Expandable on Tap) */}
                      <div className="p-3 sm:px-4 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedBookingIds((prev) => ({
                              ...prev,
                              [booking.id]: !prev[booking.id],
                            }))
                          }
                          className="flex-1 min-w-[200px] flex items-center gap-2.5 text-start cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-sm text-zinc-900 dark:text-white truncate">
                                {booking.clientName}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${barberTone.badgeClass}`}>
                                {booking.barberName.split(' ')[0]}
                              </span>
                              <span className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                                {booking.timeSlot === 'FLEXIBLE' ? 'مرن' : booking.timeSlot} · {booking.date.slice(5)} · {durationLabel}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                booking.status === 'completed'
                                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300'
                                  : booking.status === 'confirmed'
                                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                  : booking.status === 'flexible_pending'
                                  ? 'bg-purple-50 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                                  : ['rejected', 'cancelled', 'no_show'].includes(booking.status)
                                  ? 'bg-rose-50 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                                  : 'bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                              }`}>
                                {booking.status === 'completed'
                                  ? 'حضر ✓'
                                  : booking.status === 'confirmed'
                                  ? 'مقبول'
                                  : booking.status === 'flexible_pending'
                                  ? 'وقت مرن'
                                  : booking.status === 'no_show'
                                  ? 'تغيب'
                                  : booking.status === 'cancelled'
                                  ? 'ملغى'
                                  : booking.status === 'rejected'
                                  ? 'مرفوض'
                                  : 'معلق'}
                              </span>
                              {bookingCredit.hasCredit && (
                                <span
                                  className="px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-300 dark:border-orange-500/40"
                                  title={`عليه كريدي سابق: ${bookingCredit.totalOwedMAD} MAD`}
                                >
                                  كريدي: {bookingCredit.totalOwedMAD} MAD
                                </span>
                              )}
                            </div>
                          </div>
                          {isCardExpanded ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                          )}
                        </button>

                        {/* Quick Single-Line Actions: WhatsApp + حضر */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(
                              buildClientTicketWhatsAppMessage(booking)
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">واتساب</span>
                          </a>

                          {booking.status !== 'completed' &&
                            booking.status !== 'cancelled' &&
                            booking.status !== 'rejected' && (
                              <button
                                type="button"
                                disabled={quickActionBusyId === booking.id}
                                onClick={() => handleMarkCompleted(booking)}
                                className="min-h-[34px] px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>حضر</span>
                              </button>
                            )}

                          {!booking.caisseLoggedAt &&
                            !['cancelled', 'rejected'].includes(booking.status) && (
                            <button
                              type="button"
                              onClick={() => openCaissePromptForBooking(booking)}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>للاكيس</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Full Details & Secondary Controls */}
                      {isCardExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                      {/* Top Bar: Ticket #, Barber Tag, Date & Time, Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-zinc-900 dark:text-white bg-zinc-100 dark:bg-black/60 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                            {booking.ticketNumber}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                            {booking.date} • {booking.timeSlot}
                          </span>
                        </div>

                        {/* Status Badge + Inline CRM / Verified Milestone Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {crmProfile?.isVip && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-400/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                              👑 VIP
                            </span>
                          )}
                          {crmProfile?.isBanned && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-red-600/30 border border-rose-300 dark:border-red-500/60 text-rose-800 dark:text-red-200 text-[10px] font-bold">
                              🚫{' '}
                              {pickLang(lang, {
                                ar: 'محظور',
                                fr: 'Bloqué',
                                amz: 'ⵉⵜⵜⵓⴳⴷⵍ',
                                en: 'Banned',
                                es: 'Bloqueado',
                              })}
                            </span>
                          )}
                          <span
                            className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold tabular-nums flex items-center gap-1"
                            title={pickLang(lang, {
                              ar: 'تُحتسب الزيارات فقط بعد الضغط على تأكيد الحضور',
                              fr: 'Les visites ne sont comptées qu’après confirmation de présence',
                              amz: 'ⵉⵔⵣⴰⴼⵏ ⵜⵜⵓⵃⵙⴰⴱⵏ ⴷⴼⴼⵉⵔ ⵜⵉⵍⵉⵏⵜ',
                              en: 'Visits count only after confirming attendance',
                              es: 'Las visitas solo cuentan al confirmar asistencia',
                            })}
                          >
                            <span>
                              {pickLang(lang, {
                                ar: 'زيارات مؤكدة:',
                                fr: 'Visites vérifiées:',
                                amz: 'ⵉⵔⵣⴰⴼⵏ:',
                                en: 'Verified visits:',
                                es: 'Visitas:',
                              })}{' '}
                              {loyaltyState.verifiedVisits}
                            </span>
                            <span className="text-zinc-400 dark:text-zinc-500">·</span>
                            {loyaltyState.justUnlockedMilestone ? (
                              <span className="text-emerald-700 dark:text-emerald-300">
                                {loyaltyState.justUnlockedMilestone}/{loyaltyState.justUnlockedMilestone}{' '}
                                {pickLang(lang, {
                                  ar: 'مكتمل ✓',
                                  fr: 'Atteint ✓',
                                  amz: 'ⵉⵙⵎⴷ ✓',
                                  en: 'Unlocked ✓',
                                  es: 'Completado ✓',
                                })}{' '}
                                → {loyaltyState.nextMilestone}
                              </span>
                            ) : (
                              <span className="text-zinc-700 dark:text-zinc-300">
                                {loyaltyState.verifiedVisits}/{loyaltyState.nextMilestone}
                              </span>
                            )}
                          </span>
                          {booking.checkedInAt && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-400/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                              <ScanLine className="w-3 h-3" />
                              <span>
                                {pickLang(lang, {
                                  ar: 'وصل عبر QR ✓',
                                  fr: 'Arrivé via QR ✓',
                                  amz: 'ⵉⵓⵙⴰ ⵙ QR ✓',
                                  en: 'QR Checked-In ✓',
                                  es: 'Llegó por QR ✓',
                                })}
                              </span>
                            </span>
                          )}
                          {booking.caisseLoggedAt && (
                            <span className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/20 border border-teal-300 dark:border-teal-400/50 text-teal-800 dark:text-teal-200 text-[10px] font-bold flex items-center gap-1">
                              <Wallet className="w-3 h-3" />
                              <span>
                                {pickLang(lang, {
                                  ar: 'مسجل في لاكيس ✓',
                                  fr: 'Enregistré en Caisse ✓',
                                  amz: 'ⵉⵍⵍⴰ ⴳ ⵍⴰⴽⵉⵙ ✓',
                                  en: 'In Caisse ✓',
                                  es: 'En Caja ✓',
                                })}
                              </span>
                            </span>
                          )}
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                            booking.status === 'completed' ? 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-400/50' :
                            booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40' :
                            booking.status === 'flexible_pending' ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-400/50' :
                            booking.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40' :
                            booking.status === 'rescheduled' ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40' :
                            booking.status === 'no_show' ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40' :
                            booking.status === 'cancelled' ? 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-700/40 dark:text-zinc-300 dark:border-zinc-600' :
                            'bg-rose-100 text-rose-800 border-rose-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40'
                          }`}>
                            {booking.status === 'completed'
                              ? pickLang(lang, {
                                  ar: 'مكتمل — حضر ✓',
                                  fr: 'Terminé — Présent ✓',
                                  amz: 'ⵉⵙⵎⴷ — ⵉⵍⵍⴰ ✓',
                                  en: 'Completed ✓',
                                  es: 'Completado ✓',
                                })
                              : booking.status === 'confirmed'
                                ? pickLang(lang, {
                                    ar: 'مقبول',
                                    fr: 'Confirmé',
                                    amz: 'ⵉⵜⵜⵓⵙⵏⵜⵎ',
                                    en: 'Confirmed',
                                    es: 'Confirmado',
                                  })
                                : booking.status === 'flexible_pending'
                                  ? pickLang(lang, {
                                      ar: 'وقت مرن — بانتظار التعيين',
                                      fr: 'Horaire flexible — en attente',
                                      amz: 'ⴰⴽⵓⴷ ⵉⴼⵙⵙⵓⵙⵏ — ⴳ ⵓⵔⴰⵊⵓ',
                                      en: 'Flexible — Awaiting Barber',
                                      es: 'Flexible — Pendiente',
                                    })
                                  : booking.status === 'pending' || booking.status === 'pending_quote'
                                    ? pickLang(lang, {
                                        ar: 'معلق',
                                        fr: 'En attente',
                                        amz: 'ⴳ ⵓⵔⴰⵊⵓ',
                                        en: 'Pending',
                                        es: 'Pendiente',
                                      })
                                    : booking.status === 'rescheduled'
                                      ? pickLang(lang, {
                                          ar: 'معدل',
                                          fr: 'Reporté',
                                          amz: 'ⵉⵜⵜⵓⵙⵏⴼⵍ',
                                          en: 'Rescheduled',
                                          es: 'Reprogramado',
                                        })
                                      : booking.status === 'no_show'
                                        ? pickLang(lang, {
                                            ar: 'تغيب',
                                            fr: 'Absent',
                                            amz: 'ⵉⵏⵖⵓⴱⴰ',
                                            en: 'No-Show',
                                            es: 'Ausente',
                                          })
                                        : booking.status === 'cancelled'
                                          ? pickLang(lang, {
                                              ar: 'ملغى',
                                              fr: 'Annulé',
                                              amz: 'ⵉⵜⵜⵓⵙⵔ',
                                              en: 'Cancelled',
                                              es: 'Cancelado',
                                            })
                                          : pickLang(lang, {
                                              ar: 'مرفوض',
                                              fr: 'Refusé',
                                              amz: 'ⵉⵜⵜⵓⴳⵉ',
                                              en: 'Rejected',
                                              es: 'Rechazado',
                                            })}
                          </span>
                        </div>
                      </div>

                      {/* Barber-Assigned Optimal Time Selector for Flexible Bookings */}
                      {booking.status === 'flexible_pending' && (() => {
                        const rankedSlots = getRankedAvailableSlotsForBarber(
                          booking.barberId,
                          booking.date,
                          booking.preferredTimeHint,
                          barberSchedules,
                          bookings,
                          booking.totalDurationMinutes || 30
                        ).slice(0, 6);
                        const isCustomOpen = flexCustomTargetId === booking.id;
                        const isFlexBusy = flexAssignBusyId === booking.id;

                        return (
                          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/35 border border-purple-200 dark:border-purple-500/40 space-y-2.5 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 font-black text-purple-900 dark:text-purple-200">
                                <CalendarClock className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                                <span>
                                  {pickLang(lang, {
                                    ar: 'الزبون طلب اختيار أفضل وقت متاح له • اضغط لتعيين الساعة وإشعار الزبون تلقائياً',
                                    fr: 'Le client vous laisse choisir le meilleur créneau • Cliquez pour attribuer et notifier',
                                    amz: 'ⴰⵎⵣⴷⴰⵖ ⵉⵙⵙⵓⵜⵔ ⴰⴽⵓⴷ ⴰⵎⵓⴼⴰⵢ • ⴰⴷⵔ ⵉ ⵓⵙⵏⵜⵎ',
                                    en: 'Client asked you to pick the best time • Tap a slot to assign & notify',
                                    es: 'El cliente pidió que elijas el mejor horario • Toca para asignar y notificar',
                                  })}
                                </span>
                              </div>
                              {booking.preferredTimeHint && (
                                <span className="text-[11px] font-mono text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-500/30">
                                  {pickLang(lang, {
                                    ar: 'كان يفضل:',
                                    fr: 'Souhaité :',
                                    amz: 'ⵉⵔⴰ:',
                                    en: 'Preferred:',
                                    es: 'Preferido:',
                                  })}{' '}
                                  {booking.preferredTimeHint}
                                </span>
                              )}
                            </div>

                            {rankedSlots.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {rankedSlots.map((slotOpt) => (
                                  <button
                                    key={`${slotOpt.date}-${slotOpt.time}`}
                                    type="button"
                                    disabled={isFlexBusy}
                                    onClick={() => handleAssignFlexibleTime(booking, slotOpt.date, slotOpt.time)}
                                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                                  >
                                    {isFlexBusy ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {slotOpt.date === booking.date
                                        ? pickLang(lang, {
                                            ar: 'نفس اليوم',
                                            fr: 'Même jour',
                                            amz: 'ⴰⵙⵙ ⴰⴷ',
                                            en: 'Same day',
                                            es: 'Mismo día',
                                          })
                                        : slotOpt.date.slice(5)}{' '}
                                      · {slotOpt.time}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-700 dark:text-amber-300">
                                {pickLang(lang, {
                                  ar: 'لا توجد ساعات شاغرة تلقائياً في الأيام الثلاثة القادمة، يمكنك تخصيص تاريخ ووقت يدوياً:',
                                  fr: 'Aucun créneau libre sur 3 jours, saisissez une date et heure manuellement :',
                                  amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⴽⵓⴷⵏ ⴼⵙⵙⵓⵙⵏⵉⵏ, ⵙⴽⵛⵎ ⴰⵙⴰⴽⵓⴷ ⵙ ⵓⴼⵓⵙ:',
                                  en: 'No automatic slots free over the next 3 days. Set a date and time manually:',
                                  es: 'No hay horarios automáticos en 3 días. Asigna fecha y hora manualmente:',
                                })}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isCustomOpen) {
                                    setFlexCustomTargetId(null);
                                  } else {
                                    setFlexCustomTargetId(booking.id);
                                    setFlexCustomDate(booking.date);
                                    setFlexCustomTime(booking.preferredTimeHint || rankedSlots[0]?.time || '16:00');
                                  }
                                }}
                                className="text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
                              >
                                {isCustomOpen
                                  ? pickLang(lang, {
                                      ar: 'إخفاء التخصيص اليدوي',
                                      fr: 'Masquer la saisie manuelle',
                                      amz: 'ⵙⵙⵏⵜⵍ ⴰⵙⵖⵉⵡⵙ',
                                      en: 'Hide custom picker',
                                      es: 'Ocultar selector manual',
                                    })
                                  : pickLang(lang, {
                                      ar: 'تخصيص تاريخ وساعة أخرى يدوياً...',
                                      fr: 'Choisir une autre date/heure manuellement...',
                                      amz: 'ⵙⵜⵉ ⴰⵙⴰⴽⵓⴷ ⵢⴰⴹⵏ ⵙ ⵓⴼⵓⵙ...',
                                      en: 'Assign custom date & time...',
                                      es: 'Asignar fecha y hora manualmente...',
                                    })}
                              </button>
                            </div>

                            {isCustomOpen && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                <input
                                  type="date"
                                  value={flexCustomDate}
                                  min={todayStr}
                                  onChange={(e) => setFlexCustomDate(e.target.value)}
                                  className="bg-white dark:bg-black/60 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-900 dark:text-white"
                                />
                                <input
                                  type="time"
                                  value={flexCustomTime}
                                  onChange={(e) => setFlexCustomTime(e.target.value)}
                                  className="bg-white dark:bg-black/60 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-900 dark:text-white font-mono"
                                />
                                <button
                                  type="button"
                                  disabled={isFlexBusy}
                                  onClick={() => handleAssignFlexibleTime(booking, flexCustomDate, flexCustomTime)}
                                  className="min-h-[38px] px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>
                                    {pickLang(lang, {
                                      ar: 'تعيين وإشعار الزبون',
                                      fr: 'Attribuer et notifier',
                                      amz: 'ⵙⵏⵜⵎ & ⵣⵏ ⵜⵓⵣⵉⵏⵜ',
                                      en: 'Assign & Notify',
                                      es: 'Asignar y Notificar',
                                    })}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Quick Actions for Pending Appointments (Single-Tap Verify Completion & Cancel) */}
                      {(booking.status === 'pending' || booking.status === 'pending_quote') && (
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <span>
                              {pickLang(lang, {
                                ar: 'إجراءات سريعة للطلب المعلق',
                                fr: 'Actions rapides (en attente)',
                                amz: 'ⵜⵉⴳⴰⵡⵉⵏ ⵜⵉⵔⵓⵔⴰⴷⵉⵏ',
                                en: 'Quick Actions for Pending Request',
                                es: 'Acciones rápidas (pendiente)',
                              })}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              disabled={quickActionBusyId === booking.id}
                              onClick={() => handleMarkCompleted(booking)}
                              className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm border border-teal-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {quickActionBusyId === booking.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                              ) : (
                                <Award className="w-4 h-4 flex-shrink-0" />
                              )}
                              <span>
                                {pickLang(lang, {
                                  ar: 'تأكيد الحضور والاكتمال',
                                  fr: 'Confirmer Présence',
                                  amz: 'ⵙⵏⵜⵎ ⵜⵉⵍⵉⵏⵜ',
                                  en: 'Verify Completion',
                                  es: 'Confirmar Asistencia',
                                })}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={quickActionBusyId === booking.id}
                              onClick={() => handleQuickCancel(booking)}
                              className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm border border-red-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {quickActionBusyId === booking.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 flex-shrink-0" />
                              )}
                              <span>
                                {pickLang(lang, {
                                  ar: 'إلغاء الحجز',
                                  fr: 'Annuler',
                                  amz: 'ⵙⵔ ⴰⵙⵉⵀⴰⵔ',
                                  en: 'Cancel Booking',
                                  es: 'Cancelar',
                                })}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      {booking.loyaltyRewardApplied && (
                        <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          <span>{booking.loyaltyRewardApplied}</span>
                        </div>
                      )}

                      {bookingCredit.hasCredit && (
                        <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/35 border border-orange-300 dark:border-orange-500/45 text-xs space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 font-black text-orange-900 dark:text-orange-200">
                              <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                              <span>
                                تنبيه كريدي على الزبون ({bookingCredit.totalOwedMAD} MAD) — معلومة فقط ولا يمنع الحجز
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (bookingSettlementOpenId === booking.id) {
                                  setBookingSettlementOpenId(null);
                                } else {
                                  setBookingSettlementOpenId(booking.id);
                                  setBookingSettlementAction('pay');
                                  setBookingSettlementTargetBarberId('all');
                                  setBookingSettlementAmount(String(bookingCredit.totalOwedMAD));
                                  setBookingSettlementNote('');
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] cursor-pointer"
                            >
                              {bookingSettlementOpenId === booking.id
                                ? 'إغلاق'
                                : 'يخلص ولا يفك من الكريدي'}
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {bookingCredit.creditorBreakdowns.map((cred) => (
                              <span
                                key={cred.creditorKey}
                                className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-orange-200 dark:border-orange-500/35 text-[11px] font-bold text-orange-900 dark:text-orange-200"
                              >
                                {cred.creditorLabel}: {cred.amountMAD} MAD
                              </span>
                            ))}
                          </div>

                          {bookingSettlementOpenId === booking.id && (
                            <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-500/40 space-y-2">
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setBookingSettlementAction('pay')}
                                  className={`py-1.5 px-2 rounded-lg font-black text-[11px] border cursor-pointer ${
                                    bookingSettlementAction === 'pay'
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                  }`}
                                >
                                  يخلص الكريدي (أداء)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBookingSettlementAction('clear')}
                                  className={`py-1.5 px-2 rounded-lg font-black text-[11px] border cursor-pointer ${
                                    bookingSettlementAction === 'clear'
                                      ? 'bg-amber-600 text-white border-amber-600'
                                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                  }`}
                                >
                                  يفك من الكريدي (تسوية)
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {bookingCredit.creditorBreakdowns.length > 1 && (
                                  <select
                                    value={bookingSettlementTargetBarberId}
                                    onChange={(e) => setBookingSettlementTargetBarberId(e.target.value)}
                                    className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs font-bold text-zinc-900 dark:text-white"
                                  >
                                    <option value="all">الكل ({bookingCredit.totalOwedMAD} MAD)</option>
                                    {bookingCredit.creditorBreakdowns.map((b) => (
                                      <option key={b.creditorKey} value={b.barberId || b.creditorKey}>
                                        {b.creditorLabel} ({b.amountMAD} MAD)
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <input
                                  type="number"
                                  min={1}
                                  max={bookingCredit.totalOwedMAD}
                                  value={bookingSettlementAmount}
                                  onChange={(e) => setBookingSettlementAmount(e.target.value)}
                                  className="w-24 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 font-mono font-bold text-zinc-900 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bookingSettlementNote}
                                  onChange={(e) => setBookingSettlementNote(e.target.value)}
                                  placeholder="ملاحظة للمشرف العام (اختياري)..."
                                  className="flex-1 min-w-[140px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-900 dark:text-white"
                                />
                                <button
                                  type="button"
                                  disabled={bookingSettlementBusy}
                                  onClick={async () => {
                                    const chosen =
                                      bookingSettlementTargetBarberId !== 'all'
                                        ? bookingCredit.creditorBreakdowns.find(
                                            (b) =>
                                              (b.barberId || b.creditorKey) ===
                                              bookingSettlementTargetBarberId
                                          )
                                        : undefined;
                                    const maxTarget = chosen
                                      ? chosen.amountMAD
                                      : bookingCredit.totalOwedMAD;
                                    const amt = Math.max(
                                      0,
                                      Number(bookingSettlementAmount) || maxTarget
                                    );
                                    if (amt <= 0) return;
                                    setBookingSettlementBusy(true);
                                    try {
                                      await submitCreditSettlementRequest({
                                        sourceType: 'aggregate',
                                        barberId: chosen?.barberId,
                                        barberName: chosen?.creditorLabel,
                                        clientName: booking.clientName,
                                        clientPhone: booking.clientPhone,
                                        actionType: bookingSettlementAction,
                                        originalRemainingMAD: maxTarget,
                                        requestedAmountMAD: amt,
                                        note: bookingSettlementNote.trim() || undefined,
                                        submittedBy: session.name,
                                        submittedRole:
                                          session.role === 'caisse'
                                            ? 'caisse'
                                            : session.role === 'master'
                                            ? 'master'
                                            : 'barber',
                                      });
                                      setBookingSettlementOpenId(null);
                                      showToast(
                                        'تم إرسال طلب خلاص/فك الكريدي للمشرف العام ✓',
                                        '',
                                        'success'
                                      );
                                    } catch (err) {
                                      console.error('Failed to submit booking credit request:', err);
                                    } finally {
                                      setBookingSettlementBusy(false);
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer disabled:opacity-50"
                                >
                                  {bookingSettlementBusy ? '...' : 'إرسال الطلب للمشرف ✓'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Client Info with DIRECT WHATSAPP BUTTON */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {pickLang(lang, {
                                ar: 'الزبون :',
                                fr: 'Client :',
                                amz: 'ⴰⵎⵣⴷⴰⵖ :',
                                en: 'Client:',
                                es: 'Cliente:',
                              })}
                            </span>
                            <span className="font-bold text-zinc-900 dark:text-white text-sm">{booking.clientName}</span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800/80">
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {pickLang(lang, {
                                ar: 'الهاتف :',
                                fr: 'Téléphone :',
                                amz: 'ⵜⵉⵍⵉⴼⵓⵏ :',
                                en: 'Phone:',
                                es: 'Teléfono:',
                              })}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span dir="ltr" className="font-mono text-zinc-800 dark:text-zinc-200">{booking.clientPhone}</span>
                              
                              {/* Direct WhatsApp Client Button */}
                              <a
                                href={`https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(
                                  buildClientTicketWhatsAppMessage(booking)
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors shadow-xs"
                                title={pickLang(lang, {
                                  ar: 'مراسلة الزبون عبر واتساب مع تفاصيل التذكرة',
                                  fr: 'Contacter sur WhatsApp avec récapitulatif',
                                  amz: 'ⴰⵣⵏ ⵜⵓⵣⵉⵏⵜ ⴳ WhatsApp',
                                  en: 'Message client on WhatsApp with full summary',
                                  es: 'Contactar por WhatsApp con resumen',
                                })}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>
                                  {pickLang(lang, {
                                    ar: 'واتساب الزبون',
                                    fr: 'WhatsApp Client',
                                    amz: 'WhatsApp',
                                    en: 'WhatsApp',
                                    es: 'WhatsApp',
                                  })}
                                </span>
                              </a>

                              {/* Client Profile Unique QR Button */}
                              <button
                                type="button"
                                onClick={() =>
                                  setQrTargetClient({
                                    id: getCrmDocId(booking.clientPhone),
                                    clientName: booking.clientName,
                                    phoneDisplay: booking.clientPhone,
                                    normalizedPhone: normalizeMoroccanPhoneDigits(booking.clientPhone),
                                    verifiedVisits: loyaltyState.verifiedVisits,
                                    isVip: crmProfile?.isVip,
                                    isBanned: crmProfile?.isBanned,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold text-[11px] transition-colors cursor-pointer"
                                title={pickLang(lang, {
                                  ar: 'عرض رمز QR الخاص بملف هذا الزبون',
                                  fr: 'Afficher le QR du profil client',
                                  amz: 'ⵙⴽⵏ QR ⵏ ⵓⵎⵣⴷⴰⵖ',
                                  en: 'Show client profile QR code',
                                  es: 'Ver código QR del cliente',
                                })}
                              >
                                <QrCode className="w-3 h-3" />
                                <span>
                                  {pickLang(lang, {
                                    ar: 'QR الزبون',
                                    fr: 'QR Client',
                                    amz: 'QR',
                                    en: 'Client QR',
                                    es: 'QR Cliente',
                                  })}
                                </span>
                              </button>
                            </div>
                          </div>

                          {(booking.clientNotes || booking.notes) && (
                            <div className="pt-1 text-[11px] text-zinc-700 dark:text-zinc-300 space-y-0.5">
                              {booking.clientNotes && (
                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-900 dark:text-amber-200">
                                  <span className="text-amber-700 dark:text-amber-400 font-bold">
                                    {pickLang(lang, {
                                      ar: 'ملاحظات الزبون (التفضيلات): ',
                                      fr: 'Préférences client : ',
                                      amz: 'ⵜⵉⵏⵏⴰⵢⵉⵏ ⵏ ⵓⵎⵣⴷⴰⵖ: ',
                                      en: 'Client Notes: ',
                                      es: 'Notas del cliente: ',
                                    })}
                                  </span>
                                  <span className="break-words">{booking.clientNotes}</span>
                                </div>
                              )}
                              {booking.notes && booking.notes !== booking.clientNotes && (
                                <div className="text-zinc-600 dark:text-zinc-400">
                                  <span className="text-zinc-500 font-semibold">
                                    {pickLang(lang, {
                                      ar: 'ملاحظة / إضافات: ',
                                      fr: 'Note / Extras : ',
                                      amz: 'ⵜⴰⵏⵏⴰⵢⵜ: ',
                                      en: 'Note / Extras: ',
                                      es: 'Nota / Extras: ',
                                    })}
                                  </span>
                                  <span>{booking.notes}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {booking.cihReceiptName && (
                            <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/40 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                  <span>
                                    {pickLang(lang, {
                                      ar: 'إيصال تحويل CIH Bank',
                                      fr: 'Reçu de virement CIH Bank',
                                      amz: 'ⵜⴰⵡⵔⵉⵇⵜ CIH Bank',
                                      en: 'CIH Bank Receipt',
                                      es: 'Recibo CIH Bank',
                                    })}
                                  </span>
                                </div>
                                <div className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300 truncate">{booking.cihReceiptName}</div>
                              </div>
                              {booking.cihReceiptPreview && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewReceipt({
                                      ticketNumber: booking.ticketNumber,
                                      clientName: booking.clientName,
                                      fileName: booking.cihReceiptName || 'CIH Receipt',
                                      src: booking.cihReceiptPreview!,
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 flex-shrink-0 cursor-pointer"
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  <span>
                                    {pickLang(lang, {
                                      ar: 'عرض الإيصال',
                                      fr: 'Voir reçu',
                                      amz: 'ⵙⴽⵏ',
                                      en: 'View Receipt',
                                      es: 'Ver recibo',
                                    })}
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Services & Total */}
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800/80 space-y-1.5 text-xs">
                          <div className="text-zinc-500 dark:text-zinc-400 font-semibold text-[11px]">
                            {pickLang(lang, {
                              ar: 'الخدمات المطلوبة :',
                              fr: 'Prestations demandées :',
                              amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵉⵜⵜⵓⵙⵜⵉⵏ :',
                              en: 'Requested Services:',
                              es: 'Servicios solicitados:',
                            })}
                          </div>
                          <div className="space-y-0.5">
                            {(booking.cartItemsSummary || []).map((itm, i) => (
                              <div key={i} className="flex justify-between text-zinc-700 dark:text-zinc-300 text-[11px]">
                                <span>• {itm.name}</span>
                                <span className="font-mono font-bold text-zinc-900 dark:text-white">{itm.finalPrice} MAD</span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-1.5 border-t border-zinc-200 dark:border-zinc-800 flex justify-between font-bold">
                            <span className="text-zinc-700 dark:text-zinc-300">
                              {pickLang(lang, {
                                ar: 'المجموع المطلوب للأداء :',
                                fr: 'Total à payer :',
                                amz: 'ⴰⵎⵖⵔⵓⴷ :',
                                en: 'Total Due:',
                                es: 'Total a pagar:',
                              })}
                            </span>
                            <span className="text-amber-700 dark:text-amber-400 font-mono text-sm">{booking.finalTotalMAD} MAD</span>
                          </div>
                        </div>
                      </div>

                      {/* CLIENT STATUS NOTE (Universal Ticket Tools) */}
                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                          <label className="font-bold text-zinc-800 dark:text-zinc-300 flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>
                              {pickLang(lang, {
                                ar: 'ملاحظة أو رد مخصص للزبون :',
                                fr: 'Note / Réponse pour le client :',
                                amz: 'ⵜⴰⵏⵏⴰⵢⵜ ⵉ ⵓⵎⵣⴷⴰⵖ :',
                                en: 'Custom Client Note:',
                                es: 'Nota / Respuesta para el cliente:',
                              })}
                            </span>
                          </label>
                          <span className="text-[10px] text-zinc-500">
                            {pickLang(lang, {
                              ar: '(تظهر مباشرة في صفحة تتبع الزبون فور حفظها)',
                              fr: '(Visible immédiatement sur la page de suivi)',
                              amz: '(ⵜⵜⵓⵙⴽⵏ ⵓⵙⵔⵉⴷ ⴳ ⵜⵙⵏⴰ ⵏ ⵓⴹⴼⴰⵕ)',
                              en: '(Shown live on client tracking page once saved)',
                              es: '(Visible en vivo en la página de seguimiento)',
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={notesState[booking.id] ?? ''}
                            onChange={(e) => setNotesState({ ...notesState, [booking.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveClientNote(booking.id);
                              }
                            }}
                            placeholder={pickLang(lang, {
                              ar: 'مثال: تم حجز الكرسي، مرحباً بك قبل الموعد بـ 5 دقائق...',
                              fr: 'Ex : Votre fauteuil est réservé, merci d’arriver 5 min avant...',
                              amz: 'ⴰⵎⴷⵢⴰ: ⴰⴷⵖⴰⵔ ⵏⵏⴽ ⵉⵜⵜⵓⵃⴹⴰ...',
                              en: 'e.g. Your chair is reserved, please arrive 5 mins early...',
                              es: 'Ej: Tu silla está reservada, llega 5 min antes...',
                            })}
                            className="flex-1 bg-white dark:bg-black/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveClientNote(booking.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                              isNoteSaved
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
                            }`}
                          >
                            {isNoteSaved ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>
                                  {pickLang(lang, {
                                    ar: 'تم الحفظ!',
                                    fr: 'Enregistré !',
                                    amz: 'ⵉⵜⵜⵓⵃⴹⴰ !',
                                    en: 'Saved!',
                                    es: '¡Guardado!',
                                  })}
                                </span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                <span>
                                  {pickLang(lang, {
                                    ar: 'حفظ الرد',
                                    fr: 'Enregistrer',
                                    amz: 'ⵃⴹⵓ',
                                    en: 'Save Reply',
                                    es: 'Guardar',
                                  })}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Primary Booking Card Actions + Clean Collapsible Secondary Actions ("المزيد") */}
                      <div className="pt-2.5 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {booking.status === 'flexible_pending' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setFlexCustomTargetId(booking.id);
                                  setFlexCustomDate(booking.date);
                                  setFlexCustomTime(booking.preferredTimeHint || '16:00');
                                  setOpenBookingActionsId(null);
                                }}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                              >
                                <Clock3 className="w-3.5 h-3.5" />
                                <span>
                                  {pickLang(lang, {
                                    ar: 'تحديد الساعة وتأكيد',
                                    fr: 'Fixer l’heure & Confirmer',
                                    amz: 'ⴼⵔⵏ ⵜⵉⵣⵉ & ⵙⵏⵜⵎ',
                                    en: 'Assign Time & Confirm',
                                    es: 'Asignar Hora y Confirmar',
                                  })}
                                </span>
                              </button>
                            ) : (
                              booking.status !== 'confirmed' &&
                              booking.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => handleConfirm(booking.id)}
                                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>
                                    {pickLang(lang, {
                                      ar: 'قبول وتأكيد',
                                      fr: 'Accepter & Confirmer',
                                      amz: 'ⵙⵏⵜⵎ',
                                      en: 'Accept & Confirm',
                                      es: 'Aceptar y Confirmar',
                                    })}
                                  </span>
                                </button>
                              )
                            )}

                            {booking.status !== 'completed' &&
                              booking.status !== 'cancelled' &&
                              booking.status !== 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkCompleted(booking)}
                                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-xs border border-teal-500 transition-colors cursor-pointer"
                                >
                                  <Award className="w-4 h-4" />
                                  <span>
                                    {pickLang(lang, {
                                      ar: 'تأكيد الحضور / مكتمل',
                                      fr: 'Confirmer Présence / Terminé',
                                      amz: 'ⵙⵏⵜⵎ ⵜⵉⵍⵉⵏⵜ / ⵉⵙⵎⴷ',
                                      en: 'Confirm Attendance / Completed',
                                      es: 'Confirmar Asistencia',
                                    })}
                                  </span>
                                </button>
                              )}

                            {booking.status === 'completed' && (
                              <span className="min-h-[38px] px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-500/40 text-teal-800 dark:text-teal-300 text-xs font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                <span>
                                  {pickLang(lang, {
                                    ar: 'حضر ✓ (+1 ولاء)',
                                    fr: 'Présent ✓ (+1 fidélité)',
                                    amz: 'ⵉⵍⵍⴰ ✓ (+1 ⵜⵉⵖⵓⴷⴰ)',
                                    en: 'Attended ✓ (+1 loyalty)',
                                    es: 'Asistió ✓ (+1 fidelidad)',
                                  })}
                                </span>
                              </span>
                            )}

                            {!booking.caisseLoggedAt &&
                              !['cancelled', 'rejected'].includes(booking.status) && (
                                <button
                                  type="button"
                                  onClick={() => openCaissePromptForBooking(booking)}
                                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                  <span>
                                    {pickLang(lang, {
                                      ar: 'إضافة للاكيس',
                                      fr: 'Ajouter en Caisse',
                                      amz: 'ⵔⵏⵓ ⵉ ⵍⴰⴽⵉⵙ',
                                      en: 'Add to Caisse',
                                      es: 'Añadir a Caja',
                                    })}
                                  </span>
                                </button>
                              )}

                            <button
                              type="button"
                              onClick={() => handleOpenReschedule(booking)}
                              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Clock3 className="w-3.5 h-3.5" />
                              <span>
                                {pickLang(lang, {
                                  ar: 'تعديل الموعد',
                                  fr: 'Décaler RDV',
                                  amz: 'ⵙⵏⴼⵍ ⴰⴽⵓⴷ',
                                  en: 'Reschedule',
                                  es: 'Reprogramar',
                                })}
                              </span>
                            </button>
                          </div>

                          {/* Compact Overflow Menu Trigger ("المزيد") */}
                          <button
                            type="button"
                            aria-expanded={openBookingActionsId === booking.id}
                            onClick={() =>
                              setOpenBookingActionsId((prev) =>
                                prev === booking.id ? null : booking.id
                              )
                            }
                            className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                              openBookingActionsId === booking.id
                                ? 'bg-zinc-900 text-white border-zinc-800 dark:bg-amber-500 dark:text-black dark:border-amber-400'
                                : 'bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-stone-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                            }`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                            <span>
                              {pickLang(lang, {
                                ar: 'المزيد',
                                fr: 'Plus',
                                amz: 'ⵓⴳⴳⴰⵔ',
                                en: 'More',
                                es: 'Más',
                              })}
                            </span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                                openBookingActionsId === booking.id ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {/* Collapsible Secondary Actions Tray (Unclipped on All Viewports) */}
                        {openBookingActionsId === booking.id && (
                          <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-950/75 border border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {booking.status !== 'completed' &&
                                booking.status !== 'cancelled' &&
                                booking.status !== 'rejected' && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={lateActionBusyId === booking.id}
                                      onClick={() => {
                                        setOpenBookingActionsId(null);
                                        handlePostponeLateBookingToNearest(booking);
                                      }}
                                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      {lateActionBusyId === booking.id ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Clock className="w-3.5 h-3.5" />
                                      )}
                                      <span>
                                        {pickLang(lang, {
                                          ar: 'تأجيل لأقرب وقت متاح',
                                          fr: 'Décaler au plus tôt',
                                          amz: 'ⵙⵏⴼⵍ ⵉ ⵡⴰⴽⵓⴷ ⴰⵎⵣⵡⴰⵔⵓ',
                                          en: 'Nearest Open Slot',
                                          es: 'Hueco más cercano',
                                        })}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={lateActionBusyId === booking.id}
                                      onClick={() => {
                                        setOpenBookingActionsId(null);
                                        handleMoveLateBookingToWaitlist(booking);
                                      }}
                                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900 border border-sky-300 dark:border-sky-500/40 text-sky-800 dark:text-sky-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      <ListPlus className="w-3.5 h-3.5" />
                                      <span>
                                        {pickLang(lang, {
                                          ar: 'تحويل للطابور',
                                          fr: 'Mettre en attente',
                                          amz: 'ⵙⵙⵉⴷ ⵉ ⵜⴰⵍⴳⴰⵎⵜ',
                                          en: 'Move to Queue',
                                          es: 'Pasar a espera',
                                        })}
                                      </span>
                                    </button>
                                  </>
                                )}

                              {booking.status !== 'no_show' && booking.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenBookingActionsId(null);
                                    handleRecordNoShow(booking);
                                  }}
                                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/70 dark:hover:bg-orange-900 border border-orange-200 dark:border-orange-500/40 text-orange-700 dark:text-orange-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title={pickLang(lang, {
                                    ar: 'تسجيل عدم الحضور (تغيبان = حظر تلقائي)',
                                    fr: 'Signaler absence (2 absences = blocage auto)',
                                    amz: 'ⵣⵎⵎⴻⵎ ⵜⴰⵏⵖⵓⴱⴰ',
                                    en: 'Log No-Show (2 strikes = auto-ban)',
                                    es: 'Registrar ausencia (2 = bloqueo auto)',
                                  })}
                                >
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>
                                    {pickLang(lang, {
                                      ar: 'تغيب',
                                      fr: 'Absent',
                                      amz: 'ⵉⵏⵖⵓⴱⴰ',
                                      en: 'No-Show',
                                      es: 'Ausente',
                                    })}
                                  </span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenBookingActionsId(null);
                                  toggleClientVip(booking.clientPhone, booking.clientName, crmClientsMap);
                                }}
                                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border cursor-pointer ${
                                  crmProfile?.isVip
                                    ? 'bg-amber-500 text-black border-amber-400'
                                    : 'bg-white hover:bg-stone-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-amber-700 dark:text-amber-300 border-stone-200 dark:border-zinc-700'
                                }`}
                              >
                                <Star className="w-3.5 h-3.5" />
                                <span>VIP</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenBookingActionsId(null);
                                  setClientBanStatus(
                                    booking.clientPhone,
                                    booking.clientName,
                                    !crmProfile?.isBanned,
                                    !crmProfile?.isBanned
                                      ? pickLang(lang, {
                                          ar: 'حظر يدوي من التذكرة',
                                          fr: 'Blocage manuel depuis le ticket',
                                          amz: 'ⴰⴳⴷⴰⵍ ⵙ ⵓⴼⵓⵙ',
                                          en: 'Manual ban from ticket',
                                          es: 'Bloqueo manual desde el ticket',
                                        })
                                      : pickLang(lang, {
                                          ar: 'رفع الحظر يدوياً',
                                          fr: 'Déblocage manuel',
                                          amz: 'ⴽⴽⵙ ⴰⴳⴷⴰⵍ',
                                          en: 'Manual unban',
                                          es: 'Desbloqueo manual',
                                        }),
                                    crmClientsMap
                                  );
                                }}
                                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border cursor-pointer ${
                                  crmProfile?.isBanned
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                                    : 'bg-white hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-red-950 text-zinc-700 dark:text-zinc-300 hover:text-rose-700 dark:hover:text-red-300 border-stone-200 dark:border-zinc-700'
                                }`}
                              >
                                {crmProfile?.isBanned ? (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>
                                      {pickLang(lang, {
                                        ar: 'رفع الحظر',
                                        fr: 'Débloquer',
                                        amz: 'ⴽⴽⵙ ⴰⴳⴷⴰⵍ',
                                        en: 'Unban',
                                        es: 'Desbloquear',
                                      })}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>
                                      {pickLang(lang, {
                                        ar: 'حظر',
                                        fr: 'Bloquer',
                                        amz: 'ⴰⴳⴷⴰⵍ',
                                        en: 'Ban',
                                        es: 'Bloquear',
                                      })}
                                    </span>
                                  </>
                                )}
                              </button>

                              {booking.status !== 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenBookingActionsId(null);
                                    handleReject(booking.id);
                                  }}
                                  className="min-h-[34px] px-3 py-1 rounded-lg bg-white hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-red-950 text-zinc-600 dark:text-zinc-300 hover:text-rose-700 dark:hover:text-red-400 border border-stone-200 dark:border-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  {pickLang(lang, {
                                    ar: 'رفض الطلب',
                                    fr: 'Refuser',
                                    amz: 'ⴰⴳⵉ',
                                    en: 'Reject',
                                    es: 'Rechazar',
                                  })}
                                </button>
                              )}

                              {session.role === 'master' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenBookingActionsId(null);
                                    setDeleteTargetBooking(booking);
                                    setDeleteBookingCreditAck(false);
                                  }}
                                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-black inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  title="حذف هذا الموعد فقط مع فحص الكريدي"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>
                                    {pickLang(lang, {
                                      ar: 'حذف',
                                      fr: 'Supprimer',
                                      amz: 'ⴽⴽⵙ',
                                      en: 'Delete',
                                      es: 'Eliminar',
                                    })}
                                  </span>
                                </button>
                              )}
                            </div>

                            <span className="text-[10px] font-mono text-zinc-400">
                              ID: {booking.id.slice(0, 12)}...
                            </span>
                          </div>
                        )}
                      </div>
                      </div>
                      )}

                    </div>
                  );
                };

                if (activeTab === 'archive') {
                  return <div className="space-y-2.5">{sortedArchiveBookings.map(renderBookingCard)}</div>;
                }

                return (
                  <div className="space-y-4">
                    {/* 1. Today's Remaining Active Appointments (Chronological Order) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>مواعيد اليوم المتبقية ({todayStr})</span>
                        </h4>
                        <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {todayActiveQueue.length} زبناء
                        </span>
                      </div>
                      {todayActiveQueue.length === 0 ? (
                        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 dark:text-zinc-400">
                          لا توجد مواعيد متبقية لبقية اليوم.
                        </div>
                      ) : (
                        <div className="space-y-2">{todayActiveQueue.map(renderBookingCard)}</div>
                      )}
                    </div>

                    {/* 2. Upcoming Future Days / Next Week Appointments (Chronological Order) */}
                    {futureUpcomingQueue.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between px-1">
                          <h4 className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>الأيام القادمة والأسبوع المقبل</span>
                          </h4>
                          <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400">
                            {futureUpcomingQueue.length} موعد
                          </span>
                        </div>
                        <div className="space-y-2">{futureUpcomingQueue.map(renderBookingCard)}</div>
                      </div>
                    )}

                    {/* 3. Collapsed Passed / Completed Today Slots */}
                    {todayPastOrDoneQueue.length > 0 && (
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setShowPastTodaySlots((prev) => !prev)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Archive className="w-3.5 h-3.5 text-zinc-500" />
                            <span>أوقات مرت أو منتهية ({todayPastOrDoneQueue.length})</span>
                          </span>
                          {showPastTodaySlots ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          )}
                        </button>
                        {showPastTodaySlots && (
                          <div className="space-y-2 mt-2.5 opacity-85">
                            {todayPastOrDoneQueue.map(renderBookingCard)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
              </>
            )}

          </div>
        )}

        {/* Compact Quick Scroll Up / Scroll Down Buttons ("بطونات صغار") inside Admin & Caisse Modal */}
        {session && (
          <div className="absolute bottom-3 end-3 z-30 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                const el = adminScrollContainerRef.current;
                if (!el) return;
                const nextTop = Math.max(0, el.scrollTop - 420);
                try {
                  el.scrollTo({ top: nextTop, behavior: 'smooth' });
                } catch {
                  el.scrollTop = nextTop;
                }
              }}
              aria-label="التمرير للأعلى"
              title="للأعلى"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-amber-50 dark:hover:bg-zinc-800 shadow-md flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const el = adminScrollContainerRef.current;
                if (!el) return;
                const nextTop = el.scrollTop + 420;
                try {
                  el.scrollTo({ top: nextTop, behavior: 'smooth' });
                } catch {
                  el.scrollTop = nextTop;
                }
              }}
              aria-label="التمرير للأسفل"
              title="للأسفل"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-amber-50 dark:hover:bg-zinc-800 shadow-md flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        )}

      </div>

      {/* QR Code Scanner Dialog Modal (Forced Rear/Environment by default, with camera switcher & Client Tracking launch) */}
      {isScannerOpen && (
        <ModalPortal>
          <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop">
            <div className="bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-4 text-center shadow-2xl">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold text-sm">
                  <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>
                    {pickLang(lang, {
                      ar: 'ماسح QR الزبناء والتذاكر',
                      fr: 'Scanner QR Clients & Tickets',
                      amz: 'ⴰⵙⴽⴰⵏⴰⵔ QR ⵏ ⵉⵎⵣⴷⴰⵖⵏ',
                      en: 'Client & Ticket QR Scanner',
                      es: 'Escáner QR de Clientes y Tickets',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Switch Camera Button */}
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1 border border-stone-200 dark:border-zinc-700 transition-colors cursor-pointer"
                    title={pickLang(lang, {
                      ar: 'تبديل الكاميرا (خلفية / أمامية)',
                      fr: 'Changer de caméra (Arrière / Avant)',
                      amz: 'ⵙⵏⴼⵍ ⵜⴰⴽⴰⵎⵉⵕⴰ',
                      en: 'Switch camera (Rear / Front)',
                      es: 'Cambiar cámara (Trasera / Frontal)',
                    })}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {cameraFacingMode === 'environment'
                        ? pickLang(lang, {
                            ar: 'خلفية 🔄',
                            fr: 'Arrière 🔄',
                            amz: 'ⵜⴰⴹⴼⴼⵓⵔⵜ 🔄',
                            en: 'Rear 🔄',
                            es: 'Trasera 🔄',
                          })
                        : pickLang(lang, {
                            ar: 'أمامية 🔄',
                            fr: 'Avant 🔄',
                            amz: 'ⵜⴰⵎⵣⵡⴰⵔⵓⵜ 🔄',
                            en: 'Front 🔄',
                            es: 'Frontal 🔄',
                          })}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scanner Action Mode Toggle */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-[10px] sm:text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setScannerActionMode('checkin')}
                  className={`py-2 px-1.5 rounded-lg transition-colors cursor-pointer ${
                    scannerActionMode === 'checkin'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {pickLang(lang, {
                    ar: 'تسجيل الوصول',
                    fr: 'Check-In',
                    amz: 'ⴰⴽⵛⵓⵎ',
                    en: 'Check-In',
                    es: 'Check-In',
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => setScannerActionMode('tracking')}
                  className={`py-2 px-1.5 rounded-lg transition-colors cursor-pointer ${
                    scannerActionMode === 'tracking'
                      ? 'bg-amber-500 text-black'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {pickLang(lang, {
                    ar: 'تتبع الزبون',
                    fr: 'Suivi Client',
                    amz: 'ⴰⴹⴼⴰⵕ',
                    en: 'Track Client',
                    es: 'Seguir Cliente',
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => setScannerActionMode('filter')}
                  className={`py-2 px-1.5 rounded-lg transition-colors cursor-pointer ${
                    scannerActionMode === 'filter'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {pickLang(lang, {
                    ar: 'تصفية القائمة',
                    fr: 'Filtrer Liste',
                    amz: 'ⴰⵙⵜⴰⵢ',
                    en: 'Filter List',
                    es: 'Filtrar Lista',
                  })}
                </button>
              </div>

              {/* Error banner if browser denied or camera unavailable */}
              {scannerCameraError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-red-950/60 border border-rose-200 dark:border-red-500/40 text-rose-700 dark:text-red-300 text-xs font-semibold">
                  {scannerCameraError}
                </div>
              )}

              <div id="qr-reader-container" className="w-full rounded-xl overflow-hidden bg-black min-h-[250px] border border-stone-200 dark:border-zinc-800" />

              {/* Upload QR Image Alternative */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-amber-300 dark:border-zinc-700 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {pickLang(lang, {
                      ar: 'رفع صورة QR من الجهاز',
                      fr: 'Importer image QR',
                      amz: 'ⵙⴽⵛⵎ ⵜⴰⵡⵍⴰⴼⵜ QR',
                      en: 'Upload QR Image',
                      es: 'Subir imagen QR',
                    })}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAdminQrImageUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-blue-700 dark:text-blue-300 text-xs font-bold cursor-pointer"
                >
                  {pickLang(lang, {
                    ar: 'تبديل الكاميرا',
                    fr: 'Changer caméra',
                    amz: 'ⵙⵏⴼⵍ',
                    en: 'Switch Camera',
                    es: 'Cambiar cámara',
                  })}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Hidden container for Admin QR file scanning */}
      <div id="admin-qr-file-temp" className="hidden" aria-hidden="true" />

      {/* Client Profile QR Modal */}
      <ClientQrModal
        client={qrTargetClient}
        onClose={() => setQrTargetClient(null)}
        onOpenClientTracking={onOpenClientTracking}
      />

      {/* Quick Arrival QR Code Generator & Loyalty Point Attribution Modal */}
      <AdminQrCheckInGeneratorModal
        isOpen={isQrGeneratorOpen}
        onClose={() => setIsQrGeneratorOpen(false)}
        bookings={bookings}
        crmClientsMap={crmClientsMap}
        scopedBarberId={session?.barberId || 'all'}
        onMarkBookingCompleted={handleMarkCompleted}
      />

      {/* Reschedule Dialog Modal */}
      {reschedulingBooking && (
        <ModalPortal>
          <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop">
            <div className="bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {pickLang(lang, {
                    ar: `تعديل الموعد المقترح لـ ${reschedulingBooking.clientName}`,
                    fr: `Modifier le créneau de ${reschedulingBooking.clientName}`,
                    amz: `ⵙⵏⴼⵍ ⴰⵙⵉⵀⴰⵔ ⵏ ${reschedulingBooking.clientName}`,
                    en: `Reschedule appointment for ${reschedulingBooking.clientName}`,
                    es: `Reprogramar cita para ${reschedulingBooking.clientName}`,
                  })}
                </h3>
                <button
                  type="button"
                  onClick={() => setReschedulingBooking(null)}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <form onSubmit={handleSaveReschedule} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    {pickLang(lang, {
                      ar: 'التاريخ الجديد :',
                      fr: 'Nouvelle date :',
                      amz: 'ⴰⵙⴰⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ :',
                      en: 'New Date:',
                      es: 'Nueva fecha:',
                    })}
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                    className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    {pickLang(lang, {
                      ar: 'التوقيت الجديد :',
                      fr: 'Nouvel horaire :',
                      amz: 'ⴰⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ :',
                      en: 'New Time:',
                      es: 'Nueva hora:',
                    })}
                  </label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    required
                    className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    {pickLang(lang, {
                      ar: 'رسالة توضيحية للزبون :',
                      fr: 'Message pour le client :',
                      amz: 'ⵜⵓⵣⵉⵏⵜ ⵉ ⵓⵎⵣⴷⴰⵖ :',
                      en: 'Note for Client:',
                      es: 'Mensaje para el cliente:',
                    })}
                  </label>
                  <input
                    type="text"
                    value={rescheduleNote}
                    onChange={(e) => setRescheduleNote(e.target.value)}
                    placeholder={pickLang(lang, {
                      ar: 'مثال: تم تأخير الموعد بـ 30 دقيقة لتفادي الانتظار بالصالون...',
                      fr: 'Ex : Décalé de 30 min pour vous éviter l’attente...',
                      amz: 'ⴰⵎⴷⵢⴰ: ⵉⵜⵜⵓⵙⵏⴼⵍ ⵡⴰⴽⵓⴷ...',
                      en: 'e.g. Moved by 30 mins to avoid waiting at the salon...',
                      es: 'Ej: Movido 30 min para evitar esperas...',
                    })}
                    className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReschedulingBooking(null)}
                    className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
                  >
                    {pickLang(lang, {
                      ar: 'إلغاء',
                      fr: 'Annuler',
                      amz: 'ⵙⵔ',
                      en: 'Cancel',
                      es: 'Cancelar',
                    })}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                  >
                    {pickLang(lang, {
                      ar: 'تحديث وإشعار الزبون',
                      fr: 'Mettre à jour et notifier',
                      amz: 'ⵙⴷⵖⵉ & ⵣⵏ',
                      en: 'Update & Notify Client',
                      es: 'Actualizar y Notificar',
                    })}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* CIH Receipt Preview Modal */}
      {previewReceipt && (
        <ModalPortal>
          <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop">
            <div className="bg-white dark:bg-[#141720] border border-emerald-300 dark:border-emerald-500/40 rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-3">
                <div className="text-xs">
                  <div className="font-bold text-emerald-700 dark:text-emerald-400">
                    {pickLang(lang, {
                      ar: `إيصال تحويل CIH Bank — ${previewReceipt.ticketNumber}`,
                      fr: `Reçu virement CIH Bank — ${previewReceipt.ticketNumber}`,
                      amz: `ⵜⴰⵡⵔⵉⵇⵜ CIH Bank — ${previewReceipt.ticketNumber}`,
                      en: `CIH Bank Receipt — ${previewReceipt.ticketNumber}`,
                      es: `Recibo CIH Bank — ${previewReceipt.ticketNumber}`,
                    })}
                  </div>
                  <div className="text-slate-500 dark:text-zinc-400 font-mono text-[11px]">{previewReceipt.clientName} • {previewReceipt.fileName}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewReceipt(null)}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-stone-100 dark:bg-black rounded-xl overflow-hidden border border-stone-200 dark:border-zinc-800 flex items-center justify-center max-h-[65vh]">
                <img
                  src={previewReceipt.src}
                  alt={previewReceipt.fileName}
                  className="max-w-full max-h-[62vh] object-contain"
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* QR Arrival Check-In Confirmation Modal */}
      {checkInConfirmModal && (
        <ModalPortal>
          <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop">
            <div className="bg-white dark:bg-[#141720] border-2 border-emerald-400 dark:border-emerald-500/50 rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-black text-sm">
                  <ScanLine className="w-5 h-5" />
                  <span>
                    {pickLang(lang, {
                      ar: 'تسجيل وصول الزبون عبر QR Check-In ✓',
                      fr: 'Arrivée enregistrée via QR Check-In ✓',
                      amz: 'ⴰⴽⵛⵓⵎ ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵙ QR ✓',
                      en: 'Client Checked In via QR ✓',
                      es: 'Llegada registrada por QR ✓',
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckInConfirmModal(null)}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/35 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white text-base">
                    {checkInConfirmModal.booking.clientName}
                  </span>
                  <span className="font-mono font-bold text-amber-800 dark:text-amber-300 bg-white dark:bg-black/60 px-2.5 py-0.5 rounded border border-amber-300 dark:border-amber-500/30">
                    {checkInConfirmModal.booking.ticketNumber}
                  </span>
                </div>
                <div className="text-slate-700 dark:text-zinc-300">
                  {pickLang(lang, {
                    ar: 'الحلاق:',
                    fr: 'Barbier :',
                    amz: 'ⴰⵎⴽⵕⴰⴹ :',
                    en: 'Barber:',
                    es: 'Barbero:',
                  })}{' '}
                  <span className="font-bold text-slate-900 dark:text-white">{checkInConfirmModal.booking.barberName}</span> ·{' '}
                  <span className="font-mono">{checkInConfirmModal.booking.date} ({checkInConfirmModal.booking.timeSlot})</span>
                </div>
                {(checkInConfirmModal.booking.clientPhone || checkInConfirmModal.booking.checkInToken) && (
                  <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 font-bold">
                    {pickLang(lang, {
                      ar: 'معرّف الزبون:',
                      fr: 'ID Client :',
                      amz: 'ⵜⴰⵎⴰⵜⴰⵔⵜ :',
                      en: 'Client ID:',
                      es: 'ID Cliente:',
                    })}{' '}
                    <span dir="ltr">
                      {(() => {
                        const digits = String(checkInConfirmModal.booking.clientPhone || '').replace(/\D/g, '');
                        if (digits.startsWith('212') && digits.length >= 11) return `0${digits.slice(3)}`;
                        if (digits.length === 9 && /^[567]/.test(digits)) return `0${digits}`;
                        if (digits.length >= 6) return digits;
                        return checkInConfirmModal.booking.checkInToken || '';
                      })()}
                    </span>{' '}
                    {checkInConfirmModal.tokenMatched
                      ? pickLang(lang, {
                          ar: '(مطابق ✓)',
                          fr: '(Conforme ✓)',
                          amz: '(ⵉⵎⵙⴰⵙⴰ ✓)',
                          en: '(Matched ✓)',
                          es: '(Verificado ✓)',
                        })
                      : ''}
                  </div>
                )}
                <div className="text-[11px] text-slate-700 dark:text-zinc-300">
                  {pickLang(lang, {
                    ar: 'الخدمات:',
                    fr: 'Prestations :',
                    amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ :',
                    en: 'Services:',
                    es: 'Servicios:',
                  })}{' '}
                  {(checkInConfirmModal.booking.services || []).map((s) => s.name?.[lang] || s.name?.ar || s.id).join(' + ')}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {checkInConfirmModal.booking.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = checkInConfirmModal.booking;
                      setCheckInConfirmModal(null);
                      void handleMarkCompleted(target);
                    }}
                    className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    <span>
                      {pickLang(lang, {
                        ar: 'تأكيد الحضور والولاء + إضافة للاكيس',
                        fr: 'Confirmer Présence + Fidélité + Caisse',
                        amz: 'ⵙⵏⵜⵎ ⵜⵉⵍⵉⵏⵜ + ⵍⴰⴽⵉⵙ',
                        en: 'Confirm Attendance & Add to Caisse',
                        es: 'Confirmar Asistencia + Caja',
                      })}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCheckInConfirmModal(null)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-bold text-xs cursor-pointer"
                >
                  {pickLang(lang, {
                    ar: 'إغلاق (تم تسجيل الوصول)',
                    fr: 'Fermer (Arrivée enregistrée)',
                    amz: 'ⵇⵇⵏ (ⵉⵜⵜⵓⵣⵎⵎⴻⵎ)',
                    en: 'Close (Checked In)',
                    es: 'Cerrar (Registrado)',
                  })}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Attendance-to-Caisse Prompt Modal (Never triggered on booking creation — only on attendance confirmation) */}
      {caissePromptBooking && (
        <ModalPortal>
          <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop">
            <form
              onSubmit={handleConfirmCaisseFromBooking}
              className="bg-white dark:bg-[#141720] border-2 border-emerald-400 dark:border-emerald-500/50 rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl"
            >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-black text-sm">
                <Wallet className="w-5 h-5" />
                <span>
                  {pickLang(lang, {
                    ar: 'إضافة مبلغ الموعد إلى لاكيس؟',
                    fr: 'Ajouter le montant en Caisse ?',
                    amz: 'ⵔⵏⵓ ⴰⵜⵉⴳ ⵖⵔ ⵍⴰⴽⵉⵙ ?',
                    en: 'Add Appointment Amount to Caisse?',
                    es: '¿Añadir el importe a Caja?',
                  })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCaissePromptBooking(null)}
                className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-black text-zinc-900 dark:text-white">{caissePromptBooking.clientName}</span>
                <span className="font-mono text-amber-700 dark:text-amber-300">{caissePromptBooking.ticketNumber}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>
                  {pickLang(lang, {
                    ar: 'الحلاق:',
                    fr: 'Barbier :',
                    amz: 'ⴰⵎⴽⵕⴰⴹ :',
                    en: 'Barber:',
                    es: 'Barbero:',
                  })}{' '}
                  {caissePromptBooking.barberName}
                </span>
                <span dir="ltr" className="font-mono">{caissePromptBooking.clientPhone}</span>
              </div>
              <div className="text-zinc-700 dark:text-zinc-300">
                {pickLang(lang, {
                  ar: 'الخدمات:',
                  fr: 'Prestations :',
                  amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ :',
                  en: 'Services:',
                  es: 'Servicios:',
                })}{' '}
                {(caissePromptBooking.services || []).map((s) => s.name?.[lang] || s.name?.ar || s.id).join(' + ')}
              </div>
              <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800 flex justify-between font-bold text-zinc-800 dark:text-zinc-200">
                <span>ثمن الموعد المسجل:</span>
                <span className="font-mono text-amber-700 dark:text-amber-300">
                  {Math.max(0, Math.round(Number(caissePromptBooking.finalTotalMAD) || 0))} MAD
                </span>
              </div>
            </div>

            {(() => {
              const promptCredit = computeOutstandingCreditsForPhone(
                caissePromptBooking.clientPhone,
                caisseEntries,
                manualCredits,
                barberRoster
              );
              if (!promptCredit.hasCredit) return null;
              return (
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/35 border border-orange-300 dark:border-orange-500/45 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                      <span>
                        عليه كريدي سابق: {promptCredit.totalOwedMAD} MAD (معلومة فقط — لا يمنع التسجيل)
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPromptCreditActionOpen((p) => !p);
                        if (!promptCreditActionAmount) {
                          setPromptCreditActionAmount(String(promptCredit.totalOwedMAD));
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] cursor-pointer"
                    >
                      {promptCreditActionOpen ? 'إغلاق' : 'يخلص ولا يفك من الكريدي'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {promptCredit.creditorBreakdowns.map((b) => (
                      <span
                        key={b.creditorKey}
                        className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-orange-200 dark:border-orange-500/35 text-[10px] font-bold text-orange-900 dark:text-orange-200"
                      >
                        {b.creditorLabel}: {b.amountMAD} MAD
                      </span>
                    ))}
                  </div>
                  {promptCreditActionOpen && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-500/40 space-y-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPromptCreditActionType('pay')}
                          className={`py-1.5 px-2 rounded-lg font-black text-[11px] border cursor-pointer ${
                            promptCreditActionType === 'pay'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          يخلص الكريدي (أداء)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPromptCreditActionType('clear')}
                          className={`py-1.5 px-2 rounded-lg font-black text-[11px] border cursor-pointer ${
                            promptCreditActionType === 'clear'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          يفك من الكريدي (تسوية)
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {promptCredit.creditorBreakdowns.length > 1 && (
                          <select
                            value={promptCreditActionTargetBarber}
                            onChange={(e) => setPromptCreditActionTargetBarber(e.target.value)}
                            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs font-bold text-zinc-900 dark:text-white"
                          >
                            <option value="all">الكل ({promptCredit.totalOwedMAD} MAD)</option>
                            {promptCredit.creditorBreakdowns.map((b) => (
                              <option key={b.creditorKey} value={b.barberId || b.creditorKey}>
                                {b.creditorLabel} ({b.amountMAD} MAD)
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="number"
                          min={1}
                          max={promptCredit.totalOwedMAD}
                          value={promptCreditActionAmount}
                          onChange={(e) => setPromptCreditActionAmount(e.target.value)}
                          className="w-24 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 font-mono font-bold text-zinc-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={promptCreditActionNote}
                          onChange={(e) => setPromptCreditActionNote(e.target.value)}
                          placeholder="ملاحظة للمشرف العام..."
                          className="flex-1 min-w-[120px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-900 dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={promptCreditActionBusy}
                          onClick={async () => {
                            const chosen =
                              promptCreditActionTargetBarber !== 'all'
                                ? promptCredit.creditorBreakdowns.find(
                                    (b) =>
                                      (b.barberId || b.creditorKey) ===
                                      promptCreditActionTargetBarber
                                  )
                                : undefined;
                            const maxTarget = chosen
                              ? chosen.amountMAD
                              : promptCredit.totalOwedMAD;
                            const amt = Math.max(
                              0,
                              Number(promptCreditActionAmount) || maxTarget
                            );
                            if (amt <= 0) return;
                            setPromptCreditActionBusy(true);
                            try {
                              await submitCreditSettlementRequest({
                                sourceType: 'aggregate',
                                barberId: chosen?.barberId,
                                barberName: chosen?.creditorLabel,
                                clientName: caissePromptBooking.clientName,
                                clientPhone: caissePromptBooking.clientPhone,
                                actionType: promptCreditActionType,
                                originalRemainingMAD: maxTarget,
                                requestedAmountMAD: amt,
                                note: promptCreditActionNote.trim() || undefined,
                                submittedBy: session?.name || 'الطاقم',
                                submittedRole:
                                  session?.role === 'caisse'
                                    ? 'caisse'
                                    : session?.role === 'master'
                                    ? 'master'
                                    : 'barber',
                              });
                              setPromptCreditActionOpen(false);
                              showToast(
                                'تم إرسال طلب خلاص/فك الكريدي للمشرف العام ✓',
                                '',
                                'success'
                              );
                            } catch (err) {
                              console.error('Failed to submit prompt credit request:', err);
                            } finally {
                              setPromptCreditActionBusy(false);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer disabled:opacity-50"
                        >
                          {promptCreditActionBusy ? '...' : 'إرسال للمشرف ✓'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {(() => {
              const paidNum = Math.max(0, Number(caissePromptPaid) || 0);
              const expectedNum = Math.max(
                paidNum,
                Number(caissePromptExpected) || Math.round(Number(caissePromptBooking.finalTotalMAD) || 0)
              );
              const computedRemaining = Math.max(0, expectedNum - paidNum);

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-black mb-1">
                        {pickLang(lang, {
                          ar: 'شحال عطاني (المبلغ المدفوع - MAD) *',
                          fr: 'Montant donné / encaissé (MAD) *',
                          amz: 'ⵎⵛⵃⴰⵍ ⵉⴼⴽⴰ (MAD) *',
                          en: 'Amount Paid ("شحال عطاني" - MAD) *',
                          es: 'Monto pagado (MAD) *',
                        })}
                      </label>
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        value={caissePromptPaid}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setCaissePromptPaid(nextVal);
                          const nextPaidNum = Math.max(0, Number(nextVal) || 0);
                          const currentExp = Math.max(
                            0,
                            Number(caissePromptExpected) || Math.round(Number(caissePromptBooking.finalTotalMAD) || 0)
                          );
                          if (nextVal !== '' && nextPaidNum < currentExp) {
                            setCaissePromptHasCredit(true);
                          }
                        }}
                        className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm font-mono font-bold text-zinc-900 dark:text-white outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                        {pickLang(lang, {
                          ar: 'ملاحظة',
                          fr: 'Note',
                          amz: 'ⵜⴰⵏⵏⴰⵢⵜ',
                          en: 'Note',
                          es: 'Nota',
                        })}
                      </label>
                      <input
                        type="text"
                        value={caissePromptNote}
                        onChange={(e) => setCaissePromptNote(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCaissePromptHasCredit((p) => !p)}
                    className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-black border flex items-center justify-between gap-2 cursor-pointer ${
                      caissePromptHasCredit
                        ? 'bg-orange-50 dark:bg-orange-500/20 border-orange-400 text-orange-800 dark:text-orange-200'
                        : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <span>
                        {pickLang(lang, {
                          ar: 'واش كيتسالو باقي؟ (تسجيل الباقي كـ كريدي)',
                          fr: 'Reste à payer ? (Enregistrer le reste en Crédit)',
                          amz: 'ⵉⵙ ⵉⵍⵍⴰ ⵓⴽⵔⵉⴷⵉ ?',
                          en: 'Balance Owed? (Record Remainder as Credit)',
                          es: '¿Saldo pendiente? (Registrar como Crédito)',
                        })}
                      </span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/5 dark:bg-white/10">
                      {caissePromptHasCredit ? 'نعم ✓' : 'لا'}
                    </span>
                  </button>

                  {caissePromptHasCredit && (
                    <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-500/35 space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-orange-800 dark:text-orange-200 font-bold mb-1">
                            {pickLang(lang, {
                              ar: 'مبلغ الكريدي الباقي (MAD)',
                              fr: 'Crédit restant (MAD)',
                              amz: 'ⴰⴽⵔⵉⴷⵉ ⵉⵇⵇⵉⵎⵏ (MAD)',
                              en: 'Credit Remaining (MAD)',
                              es: 'Crédito pendiente (MAD)',
                            })}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={computedRemaining > 0 ? String(computedRemaining) : ''}
                            onChange={(e) => {
                              const rem = Math.max(0, Number(e.target.value) || 0);
                              setCaissePromptExpected(String(paidNum + rem));
                            }}
                            placeholder="0"
                            className="w-full bg-white dark:bg-black border border-orange-300 dark:border-orange-500/50 rounded-lg px-2.5 py-1.5 font-mono font-black text-orange-700 dark:text-orange-300"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                            {pickLang(lang, {
                              ar: 'أو الإجمالي المتفق عليه (MAD)',
                              fr: 'Ou Total convenu (MAD)',
                              amz: 'ⵏⵖ ⴰⵎⵖⵔⵓⴷ (MAD)',
                              en: 'Or Agreed Total (MAD)',
                              es: 'O Total acordado (MAD)',
                            })}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={caissePromptExpected}
                            onChange={(e) => setCaissePromptExpected(e.target.value)}
                            className="w-full bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono text-zinc-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                            اسم الزبون
                          </label>
                          <input
                            type="text"
                            value={caissePromptClientName}
                            onChange={(e) => setCaissePromptClientName(e.target.value)}
                            className="w-full bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                            رقم الهاتف
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            value={caissePromptClientPhone}
                            onChange={(e) => setCaissePromptClientPhone(e.target.value)}
                            className="w-full bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono text-zinc-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                            تاريخ الأداء المتوقع
                          </label>
                          <input
                            type="date"
                            value={caissePromptRepayDate}
                            onChange={(e) => setCaissePromptRepayDate(e.target.value)}
                            className="w-full bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono text-zinc-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-orange-200 dark:border-orange-500/30 flex items-center justify-between text-xs font-black text-orange-900 dark:text-orange-200">
                        <span>الباقي كـ كريدي (برقم {caissePromptClientPhone || caissePromptBooking.clientPhone}):</span>
                        <span className="font-mono text-sm px-2.5 py-0.5 rounded-lg bg-orange-600 text-white">
                          {computedRemaining} MAD
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={caissePromptBusy}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {caissePromptBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>
                  {pickLang(lang, {
                    ar: 'تأكيد وإضافة للاكيس',
                    fr: 'Confirmer & Ajouter en Caisse',
                    amz: 'ⵙⵏⵜⵎ & ⵔⵏⵓ ⵉ ⵍⴰⴽⵉⵙ',
                    en: 'Confirm & Add to Caisse',
                    es: 'Confirmar y Añadir a Caja',
                  })}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCaissePromptBooking(null)}
                className="px-4 min-h-[42px] rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold cursor-pointer"
              >
                {pickLang(lang, {
                  ar: 'تخطي الآن',
                  fr: 'Passer',
                  amz: 'ⵣⵔⵉ',
                  en: 'Skip for now',
                  es: 'Omitir',
                })}
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Master Admin Direct Walk-In Booking Modal (Bypasses 2-Booking Anti-Spam Limit) */}
      {isWalkInModalOpen && session?.role === 'master' && (
        <ModalPortal>
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="fixed inset-0 z-[100] sb-modal-backdrop flex items-center justify-center p-3 sm:p-5"
            onClick={() => setIsWalkInModalOpen(false)}
          >
            <div
              className="w-full max-w-3xl max-h-[92vh] rounded-3xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="px-4 sm:px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 bg-stone-50 dark:bg-zinc-900">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white truncate">
                    {pickLang(lang, {
                      ar: 'حجز مباشر بالصالون — صلاحية المشرف العام (بدون حد أقصى)',
                      fr: 'Réservation directe salon — Accès Patron (sans limite)',
                      amz: 'ⴰⵙⵉⵀⴰⵔ ⵓⵙⵔⵉⴷ — ⴰⵏⴱⴱⴰⴹ',
                      en: 'Master Direct Walk-In Booking (Cap Bypassed)',
                      es: 'Reserva directa salón — Sin límite',
                    })}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {pickLang(lang, {
                      ar: 'يُسجل الموعد مباشرة باسم الزبون مع تجاوز حد الحجزين تلقائياً.',
                      fr: 'Enregistre le RDV sans blocage même si le client a déjà 2 réservations.',
                      amz: 'ⵉⵣⵎⵎⴻⵎ ⴰⵙⵉⵀⴰⵔ ⵡⴰⵔ ⵜⵉⵍⵉⵙⵜ ⵏ ⵙⵉⵏ ⵉⵙⵉⵀⴰⵔⵏ.',
                      en: 'Books any client directly without triggering the 2-booking anti-spam limit.',
                      es: 'Permite reservar sin restricciones aunque tenga 2 citas activas.',
                    })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkInModalOpen(false)}
                className="min-h-[38px] min-w-[38px] p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 sm:px-5 bg-white dark:bg-zinc-950">
              <BookingSection
                isEmbeddedModal
                allowAdminBypass
                pricingResult={walkInPricingResult}
                selectedBarberId={walkInBarberId}
                onSelectBarberId={setWalkInBarberId}
                selectedServiceIds={walkInServiceIds}
                onToggleServiceId={(id) =>
                  setWalkInServiceIds((prev) =>
                    prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
                  )
                }
                onSetServiceIds={setWalkInServiceIds}
                onRequestClose={() => setIsWalkInModalOpen(false)}
                onBookingConfirmed={(created) => {
                  showToast(
                    pickLang(lang, {
                      ar: `تم إضافة حجز مباشر لـ ${created.clientName} (${created.timeSlot}) ✓`,
                      fr: `Réservation directe ajoutée pour ${created.clientName} ✓`,
                      amz: `ⴰⵙⵉⵀⴰⵔ ⵓⵙⵔⵉⴷ ⵉⵜⵜⵓⵔⵏⴰ ⵉ ${created.clientName} ✓`,
                      en: `Direct walk-in booking created for ${created.clientName} ✓`,
                      es: `Reserva directa creada para ${created.clientName} ✓`,
                    }),
                    'success'
                  );
                }}
              />
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* Centered Interactive Booking KPI / Queue Details Modal (Mobile & Desktop) */}
      {bookingKpiModal && (() => {
        const modalConfig: Record<
          BookingKpiModalKind,
          { title: string; subtitle: string; items: AppointmentBooking[]; badgeClass: string }
        > = {
          today_all: {
            title: pickLang(lang, {
              ar: 'تذاكر اليوم',
              fr: 'Tickets du jour',
              amz: 'ⵉⵏⵜⵜⵉⴽⵉⵜⵏ ⵏ ⵡⴰⵙⵙⴰ',
              en: "Today's Tickets",
              es: 'Tickets de hoy',
            }),
            subtitle: `${todayStr}`,
            items: [...todayTickets].sort(
              (a, b) => parseBookingStartMinutes(a.timeSlot) - parseBookingStartMinutes(b.timeSlot)
            ),
            badgeClass: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
          },
          pending: {
            title: pickLang(lang, {
              ar: 'حجوزات اليوم قيد المراجعة (معلق)',
              fr: 'En attente aujourd’hui',
              amz: 'ⴳ ⵓⵔⴰⵊⵓ ⴰⵙⵙⴰ',
              en: "Today's Pending Bookings",
              es: 'Pendientes de hoy',
            }),
            subtitle: `${todayStr}`,
            items: todayTickets
              .filter((b) => ['pending', 'flexible_pending', 'pending_quote'].includes(b.status))
              .sort(
                (a, b) => parseBookingStartMinutes(a.timeSlot) - parseBookingStartMinutes(b.timeSlot)
              ),
            badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
          },
          confirmed: {
            title: pickLang(lang, {
              ar: 'المواعيد المؤكدة اليوم',
              fr: 'Rendez-vous confirmés aujourd’hui',
              amz: 'ⵉⵙⵉⵀⴰⵔⵏ ⵉⵜⵜⵓⵙⵏⵜⵎⵏ ⴰⵙⵙⴰ',
              en: "Today's Confirmed Appointments",
              es: 'Confirmados de hoy',
            }),
            subtitle: `${todayStr}`,
            items: todayTickets
              .filter((b) => b.status === 'confirmed')
              .sort(
                (a, b) => parseBookingStartMinutes(a.timeSlot) - parseBookingStartMinutes(b.timeSlot)
              ),
            badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
          },
          rejected: {
            title: pickLang(lang, {
              ar: 'المرفوضة اليوم',
              fr: 'Refusés aujourd’hui',
              amz: 'ⵉⵜⵜⵓⵙⵔⵏ ⴰⵙⵙⴰ',
              en: "Today's Rejected",
              es: 'Rechazados de hoy',
            }),
            subtitle: `${todayStr}`,
            items: todayTickets
              .filter((b) => b.status === 'rejected')
              .sort(
                (a, b) => parseBookingStartMinutes(a.timeSlot) - parseBookingStartMinutes(b.timeSlot)
              ),
            badgeClass: 'bg-rose-100 text-rose-800 dark:bg-red-500/20 dark:text-red-300',
          },
          queue_active: {
            title: 'باقي اليوم (الزبناء القادمون)',
            subtitle: `مواعيد نشطة لليوم (${todayStr})`,
            items: todayActiveQueue,
            badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
          },
          queue_future: {
            title: 'الأيام القادمة / الأسبوع المقبل',
            subtitle: `المواعيد المبرمجة بعد ${todayStr}`,
            items: futureUpcomingQueue,
            badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
          },
          queue_done: {
            title: 'مواعيد مرت أو منتهية',
            subtitle: 'الحجوزات المكتملة، الملغاة، أو التي انتهى وقتها',
            items: todayPastOrDoneQueue,
            badgeClass: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
          },
        };

        const activeCfg = modalConfig[bookingKpiModal];

        return (
          <ModalPortal>
            <div
              dir={isRtl ? 'rtl' : 'ltr'}
              className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 sb-modal-backdrop"
              onClick={() => setBookingKpiModal(null)}
            >
              <div
                className="w-full max-w-3xl rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/90">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white truncate">
                      {activeCfg.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black font-mono ${activeCfg.badgeClass}`}>
                      {activeCfg.items.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                    {activeCfg.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingKpiModal(null)}
                  className="min-h-[36px] min-w-[36px] p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1">
                {activeCfg.items.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <CalendarDays className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      لا توجد مواعيد في هذه القائمة حالياً.
                    </p>
                  </div>
                ) : (
                  activeCfg.items.map((booking) => {
                    const tone = getBarberIdentityTokens(booking.barberId, booking.barberName);
                    const phoneWa = formatMoroccanWhatsAppNumber(booking.clientPhone);
                    const servicesText =
                      (booking.cartItemsSummary || []).map((i) => i.name).filter(Boolean).join(' + ') ||
                      (booking.services || [])
                        .map((s) => s.name?.[lang] || s.name?.ar || s.name?.fr)
                        .filter(Boolean)
                        .join(' + ') ||
                      'حلاقة';

                    return (
                      <div
                        key={booking.id}
                        className={`p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-2 ${tone.borderLeftClass}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white">
                                {booking.clientName}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                                {booking.ticketNumber}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${tone.badgeClass}`}>
                                {booking.barberName.split(' ')[0]}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                              <span className="font-mono font-bold">
                                {booking.date} · {booking.timeSlot === 'FLEXIBLE' ? 'مرن' : booking.timeSlot}
                              </span>
                              {' · '}
                              <span>{servicesText}</span>
                              {(booking.finalTotalMAD ?? 0) > 0 && (
                                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                                  {' · '}
                                  {booking.finalTotalMAD} MAD
                                </span>
                              )}
                            </p>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              booking.status === 'completed'
                                ? 'bg-teal-50 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300'
                                : booking.status === 'confirmed'
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                : booking.status === 'flexible_pending'
                                ? 'bg-purple-50 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                                : ['rejected', 'cancelled', 'no_show'].includes(booking.status)
                                ? 'bg-rose-50 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                            }`}
                          >
                            {booking.status === 'completed'
                              ? 'حضر ✓'
                              : booking.status === 'confirmed'
                              ? 'مقبول'
                              : booking.status === 'flexible_pending'
                              ? 'وقت مرن'
                              : booking.status === 'no_show'
                              ? 'تغيب'
                              : booking.status === 'cancelled'
                              ? 'ملغى'
                              : booking.status === 'rejected'
                              ? 'مرفوض'
                              : 'معلق'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-zinc-200/70 dark:border-zinc-800">
                          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400" dir="ltr">
                            {booking.clientPhone}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <a
                              href={`https://wa.me/${phoneWa}?text=${encodeURIComponent(
                                buildClientTicketWhatsAppMessage(booking)
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>واتساب</span>
                            </a>

                            {['pending', 'pending_quote'].includes(booking.status) &&
                              session?.role !== 'caisse' && (
                                <button
                                  type="button"
                                  onClick={() => handleConfirm(booking.id)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>تأكيد</span>
                                </button>
                              )}

                            {booking.status !== 'completed' &&
                              booking.status !== 'cancelled' &&
                              booking.status !== 'rejected' && (
                                <button
                                  type="button"
                                  disabled={quickActionBusyId === booking.id}
                                  onClick={() => handleMarkCompleted(booking)}
                                  className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>حضر</span>
                                </button>
                              )}

                            {!booking.caisseLoggedAt &&
                              !['cancelled', 'rejected'].includes(booking.status) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBookingKpiModal(null);
                                  openCaissePromptForBooking(booking);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Wallet className="w-3 h-3" />
                                <span>للاكيس</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery(booking.ticketNumber || booking.clientPhone);
                                setStatusFilter('all');
                                setMasterBarberFilter('all');
                                setExpandedBookingIds((prev) => ({
                                  ...prev,
                                  [booking.id]: true,
                                }));
                                setBookingKpiModal(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-[11px] cursor-pointer"
                            >
                              عرض في القائمة
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}

      {/* Booking Rejection Reason Modal */}
      {rejectTargetBookingId && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[105] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => !rejectBookingBusy && setRejectTargetBookingId(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white dark:bg-[#141720] border border-rose-300 dark:border-rose-500/40 shadow-2xl p-5 space-y-3 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {pickLang(lang, {
                    ar: 'سبب رفض الموعد أو ملاحظة للزبون',
                    fr: 'Motif du refus ou note au client',
                    amz: 'ⵜⴰⵎⵏⵜⵉⵍⵜ ⵏ ⵡⴰⴳⵉ',
                    en: 'Booking Rejection Reason',
                    es: 'Motivo del rechazo',
                  })}
                </h3>
                <button
                  type="button"
                  disabled={rejectBookingBusy}
                  onClick={() => setRejectTargetBookingId(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={3}
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-rose-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={rejectBookingBusy}
                  onClick={() => setRejectTargetBookingId(null)}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold cursor-pointer"
                >
                  {pickLang(lang, { ar: 'إلغاء', fr: 'Annuler', amz: 'ⵙⵔⵓⵙ', en: 'Cancel', es: 'Cancelar' })}
                </button>
                <button
                  type="button"
                  disabled={rejectBookingBusy}
                  onClick={() => void handleConfirmRejectModal()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black cursor-pointer disabled:opacity-50"
                >
                  {pickLang(lang, { ar: 'تأكيد الرفض', fr: 'Confirmer le refus', amz: 'ⵙⵙⴷⵓ ⴰⴳⵉ', en: 'Confirm Rejection', es: 'Confirmar rechazo' })}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Single Booking Selective Delete Modal with Credit Protection (Master Admin only) */}
      {deleteTargetBooking && session?.role === 'master' && (() => {
        const creditSummary = computeOutstandingCreditsForPhone(
          deleteTargetBooking.clientPhone,
          caisseEntries,
          manualCredits,
          barberRoster
        );
        const canConfirmDelete = !creditSummary.hasCredit || deleteBookingCreditAck;

        return (
          <ModalPortal>
            <div
              className="fixed inset-0 z-[130] sb-modal-backdrop flex items-center justify-center p-3 sm:p-4"
              onClick={() => {
                if (!deleteBookingBusy) setDeleteTargetBooking(null);
              }}
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden text-right"
                dir="rtl"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/40 flex items-center justify-center text-rose-700 dark:text-rose-300">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                      تأكيد حذف الموعد الانتقائي
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      حذف هذا الحجز فقط دون المساس بباقي سجلات الزبون أو حسابات المجر
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={deleteBookingBusy}
                  onClick={() => setDeleteTargetBooking(null)}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3.5">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-zinc-900 dark:text-white">
                      {deleteTargetBooking.clientName}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-zinc-600 dark:text-zinc-300" dir="ltr">
                      {deleteTargetBooking.clientPhone}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>
                      {deleteTargetBooking.date} • {deleteTargetBooking.timeSlot} • {deleteTargetBooking.barberName}
                    </span>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                      {deleteTargetBooking.finalTotalMAD ??
                        deleteTargetBooking.originalTotalMAD ??
                        deleteTargetBooking.services.reduce((sum, s) => sum + (s.basePrice || 0), 0)}{' '}
                      MAD
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-300">
                    الخدمة:{' '}
                    {deleteTargetBooking.services
                      .map((s) => s.name?.ar || s.name?.fr || s.id)
                      .join(' + ')}
                  </div>
                </div>

                {creditSummary.hasCredit ? (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-400 dark:border-rose-500/60 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs">
                        <p className="font-black text-rose-900 dark:text-rose-200">
                          ⚠️ تنبيه حماية الكريدي: هاد الزبون عندو كريدي باقي ما تخلصش!
                        </p>
                        <p className="text-[11px] text-rose-800 dark:text-rose-300">
                          مجموع الكريدي المفتوح على الرقم{' '}
                          <span className="font-mono font-black" dir="ltr">
                            {deleteTargetBooking.clientPhone}
                          </span>
                          : <strong className="font-mono">{creditSummary.totalOwedMAD} MAD</strong>
                        </p>
                        {creditSummary.creditorBreakdowns.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {creditSummary.creditorBreakdowns.map((item) => (
                              <span
                                key={item.creditorKey}
                                className="px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-500/40 text-[10px] font-bold text-rose-800 dark:text-rose-200"
                              >
                                {item.creditorLabel}: {item.amountMAD} MAD
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 pt-1">
                          ملاحظة: حذف الحجز لا يحذف الكريدي أبداً؛ سجل الكريدي ومداخيل المجر سيبقون محفوظين.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-start gap-2 p-2.5 rounded-lg bg-white/90 dark:bg-zinc-900/80 border border-rose-300 dark:border-rose-500/50 cursor-pointer text-[11px] font-bold text-rose-900 dark:text-rose-100">
                      <input
                        type="checkbox"
                        checked={deleteBookingCreditAck}
                        onChange={(e) => setDeleteBookingCreditAck(e.target.checked)}
                        className="mt-0.5 rounded accent-rose-600"
                      />
                      <span>
                        فهمت أن الزبون عليه كريدي ({creditSummary.totalOwedMAD} MAD) وأن سجل الكريدي غيبقى محفوظ، وأريد حذف هذا الحجز فقط.
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>✓ لا يوجد كريدي مفتوح مسجل على رقم هذا الزبون.</span>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={deleteBookingBusy}
                  onClick={() => setDeleteTargetBooking(null)}
                  className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={!canConfirmDelete || deleteBookingBusy}
                  onClick={handleConfirmDeleteBooking}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleteBookingBusy ? 'جاري الحذف...' : 'حذف الحجز الآن'}</span>
                </button>
              </div>
            </div>
            </div>
          </ModalPortal>
        );
      })()}

      </div>
    </ModalPortal>
  );
};
