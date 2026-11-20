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
  Send,
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
  ScanLine
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
  deleteBooking,
  matchesUniversalBookingQuery,
  normalizeMoroccanPhoneDigits,
  getBookingByTicket,
  checkInBookingByQr,
  markBookingCaisseLogged
} from '../utils/bookingStore';
import {
  getWhatsAppAutomationConfig,
  saveWhatsAppAutomationConfig,
  buildClientTicketWhatsAppMessage,
  dispatchAutomatedWhatsAppMessage,
  formatMoroccanWhatsAppNumber,
  WhatsAppAutomationConfig,
  WhatsAppProvider,
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
import { useWaitlist } from '../utils/waitlistStore';
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
import {
  addCaisseEntry,
  resolveCaisseBarberId,
  getCaisseBarberMeta,
} from '../utils/caisseStore';
import {
  ClientQrTarget,
  parseScannedQrResult,
  scanQrImageFile,
} from '../utils/clientQr';
import { ClientQrModal } from './ClientQrModal';
import { AdminQrCheckInGeneratorModal } from './AdminQrCheckInGeneratorModal';
import { AppointmentBooking, BookingStatus } from '../types';
import { SALON_INFO, TEAM_MEMBERS } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenClientTracking?: (searchQuery: string) => void;
}

interface StaffSession {
  barberId: 'all' | 'hassan' | 'anouar-arif' | 'lahcen-lhanz' | 'mounir-querdeny';
  name: string;
  role: 'master' | 'barber';
  title: string;
}

const ADMIN_SESSION_STORAGE_KEY = 'salon_boumlik_admin_session_v1';
const ADMIN_NOTIFS_ENABLED_KEY = 'salon_boumlik_admin_notifs_enabled';

interface StoredAdminSession {
  session: StaffSession;
  expiresAt: number; // timestamp
}

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
  
  // Initialize session from localStorage with 7-day expiration check
  const [session, setSession] = useState<StaffSession | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
        if (raw) {
          const stored: StoredAdminSession = JSON.parse(raw);
          if (stored && stored.expiresAt > Date.now()) {
            return stored.session;
          } else {
            localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          }
        }
      }
    } catch (e) {
      console.warn('Error reading admin session:', e);
    }
    return null;
  });

  const [pinError, setPinError] = useState(false);
  const [bookings, setBookings] = useState<AppointmentBooking[]>([]);
  
  // Notification toggle state: stored in localStorage
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(ADMIN_NOTIFS_ENABLED_KEY) === 'true';
      }
    } catch {
      // ignore
    }
    return true; // enabled by default for admin awareness
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

  // Enterprise Workspace View
  const [workspaceSection, setWorkspaceSection] = useState<
    'bookings' | 'queue' | 'summary' | 'schedules' | 'shifts' | 'crm' | 'loyalty' | 'analytics' | 'waitlist' | 'caisse'
  >('bookings');

  // Version 2.0 Live Enterprise Hooks
  const barberSchedules = useBarberSchedules();
  const crmClientsMap = useCrmClients();
  const waitlistEntries = useWaitlist();
  const shiftRequests = useShiftRequests();
  const { reviews: firestoreReviews } = useFirestoreReviews();

  // Date Views: 'today' or 'archive'
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

  // WhatsApp Automation (Green-API / UltraMsg) & Google Business Settings
  const salonSettings = useSalonProfileSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [waConfig, setWaConfig] = useState<WhatsAppAutomationConfig>(() =>
    getWhatsAppAutomationConfig()
  );
  const [waSavedNotice, setWaSavedNotice] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [quickActionBusyId, setQuickActionBusyId] = useState<string | null>(null);
  const [flexAssignBusyId, setFlexAssignBusyId] = useState<string | null>(null);
  const [flexCustomTargetId, setFlexCustomTargetId] = useState<string | null>(null);
  const [flexCustomDate, setFlexCustomDate] = useState('');
  const [flexCustomTime, setFlexCustomTime] = useState('16:00');

  const [mapsUrlInput, setMapsUrlInput] = useState(salonSettings.googleMapsUrl);
  const [reviewUrlInput, setReviewUrlInput] = useState(salonSettings.googleReviewUrl);
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
  }, [salonSettings.googleMapsUrl, salonSettings.googleReviewUrl]);

  const todayStr = new Date().toISOString().split('T')[0];

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
      if (!session || session.role === 'master') return true;
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
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
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
        .filter((w) => session.role === 'master' || w.barberId === session.barberId)
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
        let matched =
          bookings.find(
            (b) =>
              b.ticketNumber.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() === cleanTarget ||
              (parsed.checkInToken && b.checkInToken === parsed.checkInToken)
          ) || null;
        if (!matched) {
          matched = (await getBookingByTicket(lookup)) || null;
        }

        if (matched) {
          const updated = await checkInBookingByQr(matched.id);
          const resolvedBooking = updated || matched;
          const tokenMatched =
            !parsed.checkInToken ||
            !resolvedBooking.checkInToken ||
            parsed.checkInToken === resolvedBooking.checkInToken;
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

  // RBAC Authentication (Password input type, no exposed PINs in placeholder)
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();

    let newSession: StaffSession | null = null;

    // 1. Hassan (Master Admin): PINs 1994 OR 0635392503
    if (cleanPin === '1994' || cleanPin === '0635392503' || cleanPin === '212635392503') {
      newSession = {
        barberId: 'all',
        name: 'Hassan ait boumlik',
        role: 'master',
        title: 'Master Admin / المؤسس وخبير الحلاقة',
      };
    } else if (cleanPin === '1234') {
      // 2. Anouar (Barber): PIN 1234
      newSession = {
        barberId: 'anouar-arif',
        name: 'Anouar arif',
        role: 'barber',
        title: 'Barbier / حلاق',
      };
    } else if (cleanPin === '5678') {
      // 3. Lahcen (Barber): PIN 5678
      newSession = {
        barberId: 'lahcen-lhanz',
        name: 'Lahcen lhanz',
        role: 'barber',
        title: 'Barbier / حلاق',
      };
    } else if (cleanPin === '1111') {
      // 4. Mounir (Barber): PIN 1111
      newSession = {
        barberId: 'mounir-querdeny',
        name: 'Mounir querdeny',
        role: 'barber',
        title: 'Barbier / حلاق',
      };
    }

    if (newSession) {
      // Persist session for 7 days (7 * 24 * 60 * 60 * 1000 ms)
      const stored: StoredAdminSession = {
        session: newSession,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      try {
        localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(stored));
      } catch (e) {
        console.warn('Error saving admin session:', e);
      }

      setSession(newSession);
      setPinError(false);
      setPinInput('');

      // Silently register push subscription ONLY if staff already granted permission
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
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
    try {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setSession(null);
    setPinInput('');
    setPinError(false);
  };

  // Toggle Notifications with explicit user-gesture PushManager subscription & chime
  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      const subResult = session
        ? await registerStaffPushSubscription({
            role: session.role,
            barberId: session.barberId,
            staffName: session.name,
          })
        : { granted: false, subscribed: false };

      setNotificationsEnabled(true);
      try {
        localStorage.setItem(ADMIN_NOTIFS_ENABLED_KEY, 'true');
      } catch {}

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
      try {
        localStorage.setItem(ADMIN_NOTIFS_ENABLED_KEY, 'false');
      } catch {}
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
      const targetBooking = bookings.find((b) => b.id === id);
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

      if (targetBooking && waConfig.enabled && waConfig.autoSendOnConfirm) {
        const res = await dispatchAutomatedWhatsAppMessage(
          { ...targetBooking, status: 'confirmed' },
          'confirmation',
          waConfig
        );
        if (res.success) {
          sendDualAlert(
            pickLang(lang, {
              ar: `تم إرسال إشعار واتساب (${res.provider})`,
              fr: `Notification WhatsApp envoyée (${res.provider})`,
              amz: `ⵜⵓⵣⵏ ⵜⵓⵣⵉⵏⵜ WhatsApp (${res.provider})`,
              en: `WhatsApp notification sent (${res.provider})`,
              es: `Notificación WhatsApp enviada (${res.provider})`,
            }),
            {
              body: pickLang(lang, {
                ar: `تم إرسال تأكيد الموعد تلقائياً إلى ${targetBooking.clientName}.`,
                fr: `Confirmation envoyée automatiquement à ${targetBooking.clientName}.`,
                amz: `ⴰⵙⵏⵜⵎ ⵉⵜⵜⵓⵣⵏ ⵉ ${targetBooking.clientName}.`,
                en: `Confirmation automatically sent to ${targetBooking.clientName}.`,
                es: `Confirmación enviada automáticamente a ${targetBooking.clientName}.`,
              }),
              type: 'success',
              skipSound: true,
            }
          );
        }
      }
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

  const handleReject = async (id: string) => {
    const reason = window.prompt(
      pickLang(lang, {
        ar: 'سبب الرفض أو امتلاء الموعد (اختياري):',
        fr: 'Motif du refus ou créneau complet (optionnel) :',
        amz: 'ⵜⴰⵎⵏⵜⵉⵍⵜ ⵏ ⵡⴰⴳⵉ (ⵉⴼⵔⴰⵏ) :',
        en: 'Rejection reason or full slot note (optional):',
        es: 'Motivo del rechazo o nota (opcional):',
      }),
      pickLang(lang, {
        ar: 'الموعد غير متاح، يرجى اختيار توقيت آخر.',
        fr: 'Créneau indisponible, veuillez choisir un autre horaire.',
        amz: 'ⴰⴽⵓⴷ ⴰⴷ ⵓⵔ ⵉⵍⵍⵉ, ⵙⵜⵉ ⴰⴽⵓⴷ ⵢⴰⴹⵏ.',
        en: 'Slot unavailable, please pick another time.',
        es: 'Horario no disponible, elige otro horario.',
      })
    );
    if (reason !== null) {
      try {
        await updateBookingStatus(
          id,
          'rejected',
          reason ||
            pickLang(lang, {
              ar: 'غير متاح',
              fr: 'Non disponible',
              amz: 'ⵓⵔ ⵉⵍⵍⵉ',
              en: 'Unavailable',
              es: 'No disponible',
            })
        );
      } catch (err) {
        console.error('Failed to reject booking:', err);
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
              fr: 'Impossible de mettre à jour le rendez-vous.',
              amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵙⴷⵖⵉ ⴰⵙⵉⵀⴰⵔ.',
              en: 'Failed to update booking status.',
              es: 'No se pudo actualizar la cita.',
            }),
            type: 'warning',
          }
        );
      }
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
      caissePromptBooking.barberName
    );
    const barberMeta = getCaisseBarberMeta(targetBarberId);
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
        clientName: caissePromptBooking.clientName,
        clientPhone: caissePromptBooking.clientPhone,
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
        TEAM_MEMBERS.find((m) => m.id === targetBarberId)?.name?.[lang] ||
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
            ar: 'تم تأكيد الحضور واحتساب نقطة الولاء ✓',
            fr: 'Présence confirmée & point fidélité ajouté ✓',
            amz: 'ⵜⵉⵍⵉⵏⵜ ⵜⵜⵓⵙⵏⵜⵎ + ⵜⴰⵏⵇⵇⵉⴹⵜ ⵏ ⵜⵉⵖⵓⴷⴰ ✓',
            en: 'Attendance Confirmed & Loyalty Point Added ✓',
            es: 'Asistencia confirmada y punto añadido ✓',
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

      if (waConfig.enabled && waConfig.autoSendOnReschedule) {
        const res = await dispatchAutomatedWhatsAppMessage(
          {
            ...targetBooking,
            status: 'rescheduled',
            rescheduledTo: { date: newDate, time: newTime },
          },
          'reschedule',
          waConfig
        );
        if (res.success) {
          sendDualAlert(
            pickLang(lang, {
              ar: `تم إرسال إشعار التعديل (${res.provider})`,
              fr: `Notification de report envoyée (${res.provider})`,
              amz: `ⵜⵓⵣⵏ ⵜⵓⵣⵉⵏⵜ ⵏ ⵓⵙⵏⴼⵍ (${res.provider})`,
              en: `Reschedule notice sent (${res.provider})`,
              es: `Aviso de cambio enviado (${res.provider})`,
            }),
            {
              body: pickLang(lang, {
                ar: `تم إرسال التوقيت الجديد للزبون ${targetBooking.clientName}.`,
                fr: `Nouvel horaire envoyé à ${targetBooking.clientName}.`,
                amz: `ⴰⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ ⵉⵜⵜⵓⵣⵏ ⵉ ${targetBooking.clientName}.`,
                en: `New time sent to ${targetBooking.clientName}.`,
                es: `Nuevo horario enviado a ${targetBooking.clientName}.`,
              }),
              type: 'success',
              skipSound: true,
            }
          );
        }
      }
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

      if (waConfig.enabled && waConfig.autoSendOnConfirm) {
        await dispatchAutomatedWhatsAppMessage(
          {
            ...booking,
            date: assignedDate,
            timeSlot: assignedTime,
            status: 'confirmed',
          },
          'confirmation',
          waConfig
        );
      }
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

  const handleSaveWaConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveWhatsAppAutomationConfig(waConfig);
    setWaSavedNotice(true);
    setTimeout(() => setWaSavedNotice(false), 2500);
    sendDualAlert(
      pickLang(lang, {
        ar: 'تم حفظ إعدادات واتساب API',
        fr: 'Configuration WhatsApp API enregistrée',
        amz: 'ⵉⵜⵜⵓⵃⴹⴰ WhatsApp API',
        en: 'WhatsApp API Settings Saved',
        es: 'Configuración de WhatsApp API guardada',
      }),
      {
        body: `${waConfig.provider === 'green-api' ? 'Green-API' : 'UltraMsg'}`,
        type: 'success',
        skipSound: true,
      }
    );
  };

  const handleSaveGoogleLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLinksError(null);
    setSavingProfileLinks(true);
    try {
      await saveSalonProfileSettings(mapsUrlInput, reviewUrlInput);
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

  const handleSendWhatsAppApiReminder = async (booking: AppointmentBooking) => {
    if (!waConfig.enabled || !waConfig.instanceId.trim() || !waConfig.token.trim()) {
      setIsSettingsOpen(true);
      sendDualAlert(
        pickLang(lang, {
          ar: 'أدخل بيانات الربط أولاً',
          fr: 'Entrez les identifiants API d’abord',
          amz: 'ⵙⴽⵛⵎ ⵉⵙⴼⴽⴰ API ⵜⴰⵣⵡⴰⵔⴰ',
          en: 'Enter API credentials first',
          es: 'Ingresa las credenciales primero',
        }),
        {
          body: pickLang(lang, {
            ar: 'يرجى تفعيل Green-API أو UltraMsg وإدخال Instance ID و Token في لوحة الإعدادات.',
            fr: 'Activez Green-API ou UltraMsg et saisissez Instance ID & Token.',
            amz: 'ⵙⵎⵔ Green-API ⵏⵖ UltraMsg ⴷ Instance ID.',
            en: 'Enable Green-API or UltraMsg and enter Instance ID & Token in Settings.',
            es: 'Activa Green-API o UltraMsg e ingresa Instance ID y Token.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }

    setSendingReminderId(booking.id);
    const res = await dispatchAutomatedWhatsAppMessage(booking, 'reminder_1h', waConfig);
    setSendingReminderId(null);

    if (res.success) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم إرسال التذكير الآلي بنجاح ✅',
          fr: 'Rappel automatique envoyé ✅',
          amz: 'ⴰⵙⴽⵜⵉ ⵉⵜⵜⵓⵣⵏ ✅',
          en: 'Automated Reminder Sent ✅',
          es: 'Recordatorio automático enviado ✅',
        }),
        {
          body: `${res.provider} → ${booking.clientName}`,
          type: 'success',
        }
      );
    } else {
      sendDualAlert(
        pickLang(lang, {
          ar: 'تعذر الإرسال عبر API',
          fr: 'Échec de l’envoi API',
          amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵣⵏ ⵙ API',
          en: 'API Dispatch Failed',
          es: 'Error al enviar vía API',
        }),
        {
          body:
            res.reason ||
            pickLang(lang, {
              ar: 'تحقق من حالة الجلسة في بوابة واتساب.',
              fr: 'Vérifiez la session sur votre passerelle WhatsApp.',
              amz: 'ⵙⵙⵏⵇⴷ ⴰⵙⵙⴰⵖ ⵏ WhatsApp.',
              en: 'Check your WhatsApp gateway session status.',
              es: 'Verifica la sesión en tu pasarela WhatsApp.',
            }),
          type: 'warning',
        }
      );
    }
  };

  // Helper to find barber color
  const getBarberColor = (booking: AppointmentBooking) => {
    if (booking.barberColor) return booking.barberColor;
    const found = TEAM_MEMBERS.find((b) => b.id === booking.barberId);
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
    } else if (session.role === 'master') {
      if (masterBarberFilter !== 'all') {
        const matches = b.barberId === masterBarberFilter || 
          b.barberName.toLowerCase().includes(masterBarberFilter.toLowerCase().split('-')[0]);
        if (!matches) return false;
      }
    }

    // 2. Date View: 'today' or 'archive'
    if (activeTab === 'today') {
      if (b.date !== todayStr) return false;
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

  const archiveSearchMatchesCount =
    activeTab === 'today' && searchQuery.trim()
      ? bookings.filter((b) => matchesUniversalBookingQuery(b, searchQuery)).length
      : 0;

  // KPI Calculations
  const todayTickets = bookings.filter((b) => b.date === todayStr);
  const pendingCount = todayTickets.filter((b) =>
    ['pending', 'flexible_pending', 'pending_quote'].includes(b.status)
  ).length;
  const confirmedCount = todayTickets.filter((b) => b.status === 'confirmed').length;
  const rejectedCount = todayTickets.filter((b) => b.status === 'rejected').length;

  const dailyRevenue = session
    ? computeDailyCompletedRevenue(bookings, todayStr, session.role, session.barberId)
    : null;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col my-6 max-h-[92vh] overflow-hidden">
        
        {/* Barber Pole Top Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-white to-blue-600" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 font-black flex-shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white font-display">
                  {pickLang(lang, {
                    ar: 'فضاء الإدارة • صالون بومليك',
                    fr: 'ESPACE GESTION • SALON BOUMLIK',
                    amz: 'ⴰⵙⴰⵢⵔⴰⵔ ⵏ ⵓⵙⵡⵓⴷⴷⵓ • SALON BOUMLIK',
                    en: 'MANAGEMENT PORTAL • SALON BOUMLIK',
                    es: 'PANEL DE GESTIÓN • SALON BOUMLIK',
                  })}
                </h2>
                {session && (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                    session.role === 'master' 
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                      : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  }`}>
                    <ShieldCheck className="w-3 h-3" />
                    <span>
                      {session.name} (
                      {session.role === 'master'
                        ? pickLang(lang, {
                            ar: 'المدير العام',
                            fr: 'Master Admin',
                            amz: 'ⴰⵏⵎⵀⴰⵍ',
                            en: 'Master Admin',
                            es: 'Admin Maestro',
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
              <p className="text-xs text-zinc-400">
                {session?.role === 'master' 
                  ? pickLang(lang, {
                      ar: 'الإدارة الشاملة للحجوزات وملاحظات الزبناء في الوقت الفعلي',
                      fr: 'Gestion globale des réservations & notes clients en temps réel',
                      amz: 'ⴰⵙⵡⵓⴷⴷⵓ ⴰⵎⴰⵜⴰⵢ ⵏ ⵉⵙⵉⵀⴰⵔⵏ ⴳ ⵡⴰⴽⵓⴷ ⴰⵏⵉⵍⴰⵡ',
                      en: 'Global real-time booking & client notes management',
                      es: 'Gestión global en tiempo real de reservas y notas',
                    })
                  : pickLang(lang, {
                      ar: `لوحة التحكم الشخصية: المواعيد المخصصة لـ ${session?.name || 'لك'}`,
                      fr: `Tableau de bord personnel : rendez-vous assignés à ${session?.name || 'vous'}`,
                      amz: `ⵜⴰⴼⵍⵡⵉⵜ ⵏⵏⴽ: ⵉⵙⵉⵀⴰⵔⵏ ⵏ ${session?.name || 'ⴽⵢⵢ'}`,
                      en: `Personal dashboard: appointments assigned to ${session?.name || 'you'}`,
                      es: `Panel personal: citas asignadas a ${session?.name || 'ti'}`,
                    })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
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
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SECURE PIN SCREEN (Password input type, no exposed PINs in placeholder) */}
        {!session ? (
          <div className="p-8 sm:p-12 text-center max-w-md mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-amber-400 shadow-xl">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">
                {pickLang(lang, {
                  ar: 'فضاء الطاقم والإدارة',
                  fr: 'Espace Staff & Direction',
                  amz: 'ⴰⵙⴰⵢⵔⴰⵔ ⵏ ⵜⵔⴰⴱⴱⵓⵜ',
                  en: 'Staff & Management Access',
                  es: 'Acceso Personal y Dirección',
                })}
              </h3>
              <p className="text-xs text-zinc-400">
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
                  className="w-full text-center text-2xl font-mono tracking-widest bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  autoFocus
                  required
                />
              </div>

              {pinError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
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
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

            {/* DAILY REVENUE SUMMARY CARD (Top of Admin Dashboard) */}
            {dailyRevenue && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/35 via-zinc-900/95 to-zinc-950 border border-emerald-500/35">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-black text-white">
                          {pickLang(lang, {
                            ar: 'الأرباح اليومية',
                            fr: 'Revenus du Jour',
                            amz: 'ⵉⴽⵛⵓⵎⵏ ⵏ ⵡⴰⵙⵙ',
                            en: 'Daily Revenue',
                            es: 'Ingresos Diarios',
                          })}
                        </h3>
                        <span className="text-[11px] font-mono text-emerald-400 tabular-nums">
                          {todayStr}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
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

                  <div className="sm:text-end flex sm:flex-col items-baseline sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-500/15">
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums tracking-tight">
                      {dailyRevenue.servicesRevenueMAD.toLocaleString('en-US')}{' '}
                      <span className="text-xs sm:text-sm font-bold text-emerald-400">MAD</span>
                    </div>
                    <div className="text-[11px] text-zinc-300 font-mono tabular-nums">
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
                        <span className="text-emerald-300">
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
                  <div className="mt-3 pt-2.5 border-t border-emerald-500/15 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-300">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
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
                        {idx > 0 && <span className="text-zinc-600" aria-hidden="true">·</span>}
                        <span className="font-semibold text-white">{srv.name}</span>
                        <span className="font-mono text-zinc-400 tabular-nums">
                          ({srv.count}× · {srv.revenue} MAD)
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Enterprise v2.0 Workspace Tabs */}
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-zinc-800">
              <button
                type="button"
                onClick={() => setWorkspaceSection('bookings')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  workspaceSection === 'bookings'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                <span>
                  {pickLang(lang, {
                    ar: 'الحجوزات',
                    fr: 'Réservations',
                    amz: 'ⵉⵙⵉⵀⴰⵔⵏ',
                    en: 'Bookings',
                    es: 'Reservas',
                  })}{' '}
                  ({bookings.length})
                </span>
              </button>

              {(() => {
                const liveQueueCount = getLiveQueueBookings(
                  bookings,
                  todayStr,
                  session.role,
                  session.barberId,
                  'all'
                ).length;
                return (
                  <button
                    type="button"
                    onClick={() => setWorkspaceSection('queue')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      workspaceSection === 'queue'
                        ? 'bg-emerald-500 text-black shadow-md'
                        : 'bg-zinc-900 text-emerald-300 hover:bg-zinc-800 border border-zinc-800'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>
                      {pickLang(lang, {
                        ar: 'الطابور المباشر',
                        fr: 'File en Direct',
                        amz: 'ⴰⴱⵔⵉⴷ ⵓⵙⵔⵉⴷ',
                        en: 'Live Queue',
                        es: 'Cola en Vivo',
                      })}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
                        workspaceSection === 'queue'
                          ? 'bg-black/20 text-black font-black'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {liveQueueCount}
                    </span>
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={() => setWorkspaceSection('summary')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  workspaceSection === 'summary'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-zinc-900 text-amber-300 hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>
                  {pickLang(lang, {
                    ar: 'ملخص الموارد',
                    fr: 'Synthèse',
                    amz: 'ⵜⴰⴳⴹⵡⵉⵜ',
                    en: 'Summary',
                    es: 'Resumen',
                  })}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWorkspaceSection('analytics')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  workspaceSection === 'analytics'
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'bg-zinc-900 text-emerald-300 hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>
                  {pickLang(lang, {
                    ar: 'التحليلات والأداء',
                    fr: 'Analytique',
                    amz: 'ⵜⵉⵙⵍⴹⵉⵏ',
                    en: 'Analytics',
                    es: 'Analítica',
                  })}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWorkspaceSection('crm')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  workspaceSection === 'crm'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>
                  {pickLang(lang, {
                    ar: 'الزبناء والولاء CRM',
                    fr: 'Clients & Fidélité CRM',
                    amz: 'ⵉⵎⵣⴷⴰⵖⵏ & ⵜⵉⵖⵓⴷⴰ CRM',
                    en: 'Clients & CRM',
                    es: 'Clientes y CRM',
                  })}
                </span>
                {Object.values(crmClientsMap).filter((c) => c.isBanned).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-mono">
                    {Object.values(crmClientsMap).filter((c) => c.isBanned).length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setWorkspaceSection('loyalty')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  workspaceSection === 'loyalty'
                    ? 'bg-amber-400 text-black shadow-md'
                    : 'bg-zinc-900 text-amber-300 hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>
                  {pickLang(lang, {
                    ar: 'نقاط الولاء',
                    fr: 'Points Fidélité',
                    amz: 'ⵜⵉⵏⵇⵇⴰⴹ ⵏ ⵜⵉⵖⵓⴷⴰ',
                    en: 'Loyalty Points',
                    es: 'Puntos de Fidelidad',
                  })}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWorkspaceSection('schedules')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  workspaceSection === 'schedules'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>
                  {pickLang(lang, {
                    ar: 'أوقات الحلاقين',
                    fr: 'Horaires Coiffeurs',
                    amz: 'ⵉⴽⵓⴷⵏ ⵏ ⵉⵎⴽⵕⴰⴹⵏ',
                    en: 'Barber Schedules',
                    es: 'Horarios Barberos',
                  })}
                </span>
              </button>

              {(() => {
                const pendingShiftCount = shiftRequests.filter(
                  (r) =>
                    r.status === 'pending' &&
                    (session.role === 'master' ||
                      r.barberId === session.barberId ||
                      r.swapWithBarberId === session.barberId)
                ).length;
                return (
                  <button
                    type="button"
                    onClick={() => setWorkspaceSection('shifts')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      workspaceSection === 'shifts'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-zinc-900 text-amber-300 hover:bg-zinc-800 border border-zinc-800'
                    }`}
                  >
                    <Repeat className="w-4 h-4" />
                    <span>
                      {pickLang(lang, {
                        ar: 'تخطيط المناوبات',
                        fr: 'Planning & Shifts',
                        amz: 'ⴰⵙⵖⵉⵡⵙ ⵏ ⵜⵉⵙⵙⵓⵔⵉⵏ',
                        en: 'Shift Planner',
                        es: 'Turnos',
                      })}
                    </span>
                    {pendingShiftCount > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
                          workspaceSection === 'shifts'
                            ? 'bg-black/20 text-black font-black'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {pendingShiftCount}
                      </span>
                    )}
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={() => setWorkspaceSection('waitlist')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  workspaceSection === 'waitlist'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-zinc-900 text-blue-300 hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                <ListPlus className="w-4 h-4" />
                <span>
                  {pickLang(lang, {
                    ar: 'قائمة الانتظار',
                    fr: 'Liste d’Attente',
                    amz: 'ⵜⴰⵍⴳⴰⵎⵜ ⵏ ⵓⵔⴰⵊⵓ',
                    en: 'Waitlist',
                    es: 'Lista de Espera',
                  })}
                </span>
                {waitlistEntries.filter((w) => w.status === 'waiting').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-mono">
                    {waitlistEntries.filter((w) => w.status === 'waiting').length}
                  </span>
                )}
              </button>

              {/* Visually Distinct Separator & Dedicated Caisse & Accounting Sticker Tab */}
              <div className="hidden sm:block h-7 w-px bg-emerald-500/35 mx-1" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setWorkspaceSection('caisse')}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border-2 shadow-md ${
                  workspaceSection === 'caisse'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black border-emerald-300 shadow-emerald-950/60'
                    : 'bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/60 border-emerald-500/50'
                }`}
              >
                <Wallet className="w-4 h-4 shrink-0" />
                <span>
                  {pickLang(lang, {
                    ar: 'لاكيس والحسابات',
                    fr: 'Caisse & Comptabilité',
                    amz: 'ⵍⴰⴽⵉⵙ & ⵉⵙⵉⴹⴰⵏ',
                    en: 'Caisse & Accounting',
                    es: 'Caja y Contabilidad',
                  })}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    workspaceSection === 'caisse'
                      ? 'bg-black/20 text-black'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {pickLang(lang, {
                    ar: 'صندوق مالي',
                    fr: 'Caisse',
                    amz: 'ⴰⴼⵏⵉⵇ',
                    en: 'Finance',
                    es: 'Caja',
                  })}
                </span>
              </button>
            </div>

            {/* Navigation Tabs: Today's View vs. Archive / History + QR Scanner Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              {workspaceSection === 'bookings' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('today');
                      setArchiveDateFilter('');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'today'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span>
                      {pickLang(lang, {
                        ar: `تذاكر اليوم (${todayStr})`,
                        fr: `Tickets du jour (${todayStr})`,
                        amz: `ⵉⵏⵜⵜⵉⴽⵉⵜⵏ ⵏ ⵡⴰⵙⵙⴰ (${todayStr})`,
                        en: `Today's Tickets (${todayStr})`,
                        es: `Tickets de hoy (${todayStr})`,
                      })}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('archive')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'archive'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
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
                      ar: '📈 إحصائيات الأرباح والخدمات (خاص بالمدير العام)',
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
                      ar: '🪙 إدارة نقاط الولاء واستبدالها بتخفيضات على الخدمات القادمة (+10 نقاط لكل زيارة مؤكدة)',
                      fr: '🪙 Gestion des points de fidélité et échanges en remises (+10 pts / visite confirmée)',
                      amz: '🪙 ⴰⵙⵡⵓⴷⴷⵓ ⵏ ⵜⵏⵇⵇⴰⴹ ⵏ ⵜⵉⵖⵓⴷⴰ (+10 ⵉ ⴽⵓ ⴰⵔⵣⴰⴼ)',
                      en: '🪙 Manage loyalty points & redeem discounts (+10 pts per confirmed visit)',
                      es: '🪙 Gestiona puntos de fidelidad y canjes (+10 pts por visita)',
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
                </div>
              )}

              {/* Notification Alert Toggle & QR Scanner Tool */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer shadow-sm ${
                    notificationsEnabled
                      ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
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
                      <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
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
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
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
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
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

                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    isSettingsOpen
                      ? 'bg-amber-500 text-black border-amber-400 shadow-md'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>
                    {pickLang(lang, {
                      ar: 'إعدادات WhatsApp & Google',
                      fr: 'Paramètres WhatsApp & Google',
                      amz: 'ⵜⵉⵙⵖⴰⵍ WhatsApp & Google',
                      en: 'WhatsApp & Google Settings',
                      es: 'Ajustes WhatsApp & Google',
                    })}
                  </span>
                </button>
              </div>
            </div>

            {/* Collapsible Settings & Integrations Panel (WhatsApp API & Google Business Profile) */}
            {isSettingsOpen && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/40 shadow-xl">
                {/* Automated WhatsApp Gateway (Green-API / UltraMsg) */}
                <form onSubmit={handleSaveWaConfig} className="p-4 rounded-xl bg-black/50 border border-zinc-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-2 font-bold text-emerald-400">
                      <MessageCircle className="w-4 h-4" />
                      <span>
                        {pickLang(lang, {
                          ar: 'أتمتة رسائل WhatsApp (Green-API / UltraMsg)',
                          fr: 'Automatisation WhatsApp (Green-API / UltraMsg)',
                          amz: 'ⵜⵓⵣⵉⵏⵉⵏ WhatsApp (Green-API / UltraMsg)',
                          en: 'Automated WhatsApp (Green-API / UltraMsg)',
                          es: 'Automatización WhatsApp (Green-API / UltraMsg)',
                        })}
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-zinc-200">
                      <input
                        type="checkbox"
                        checked={waConfig.enabled}
                        onChange={(e) => setWaConfig({ ...waConfig, enabled: e.target.checked })}
                        className="accent-emerald-500 w-4 h-4"
                      />
                      <span>
                        {pickLang(lang, {
                          ar: 'تفعيل',
                          fr: 'Activer',
                          amz: 'ⵙⵎⵔ',
                          en: 'Enable',
                          es: 'Activar',
                        })}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
                        {pickLang(lang, {
                          ar: 'مزود البوابة',
                          fr: 'Fournisseur API',
                          amz: 'ⴰⵎⵙⴰⵖ ⵏ API',
                          en: 'Gateway Provider',
                          es: 'Proveedor API',
                        })}
                      </label>
                      <select
                        value={waConfig.provider}
                        onChange={(e) => {
                          const prov = e.target.value as WhatsAppProvider;
                          setWaConfig({
                            ...waConfig,
                            provider: prov,
                            apiUrl: prov === 'green-api' ? 'https://api.green-api.com' : 'https://api.ultramsg.com',
                          });
                        }}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                      >
                        <option value="green-api">Green-API</option>
                        <option value="ultramsg">UltraMsg</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
                        {pickLang(lang, {
                          ar: 'وقت التذكير قبل الموعد',
                          fr: 'Délai de rappel',
                          amz: 'ⴰⴽⵓⴷ ⵏ ⵓⵙⴽⵜⵉ',
                          en: 'Reminder Lead Time',
                          es: 'Tiempo de recordatorio',
                        })}
                      </label>
                      <select
                        value={waConfig.reminderMinutesBefore}
                        onChange={(e) =>
                          setWaConfig({ ...waConfig, reminderMinutesBefore: Number(e.target.value) })
                        }
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                      >
                        <option value={30}>
                          {pickLang(lang, {
                            ar: '30 دقيقة قبل الموعد',
                            fr: '30 minutes avant',
                            amz: '30 ⵏ ⵜⵓⵙⴷⴰⴷⵉⵏ ⴷⴰⵜ',
                            en: '30 minutes before',
                            es: '30 minutos antes',
                          })}
                        </option>
                        <option value={60}>
                          {pickLang(lang, {
                            ar: 'ساعة واحدة قبل الموعد',
                            fr: '1 heure avant',
                            amz: '1 ⵏ ⵜⵙⵔⴰⴳⵜ ⴷⴰⵜ',
                            en: '1 hour before',
                            es: '1 hora antes',
                          })}
                        </option>
                        <option value={120}>
                          {pickLang(lang, {
                            ar: 'ساعتان قبل الموعد',
                            fr: '2 heures avant',
                            amz: '2 ⵜⵙⵔⴰⴳⵉⵏ ⴷⴰⵜ',
                            en: '2 hours before',
                            es: '2 horas antes',
                          })}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">API Base URL</label>
                    <input
                      type="url"
                      dir="ltr"
                      value={waConfig.apiUrl}
                      onChange={(e) => setWaConfig({ ...waConfig, apiUrl: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px]"
                      placeholder="https://api.green-api.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Instance ID</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={waConfig.instanceId}
                        onChange={(e) => setWaConfig({ ...waConfig, instanceId: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px]"
                        placeholder="1101xxxxxx"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">API Token</label>
                      <input
                        type="password"
                        dir="ltr"
                        value={waConfig.token}
                        onChange={(e) => setWaConfig({ ...waConfig, token: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px]"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-300 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={waConfig.autoSendOnConfirm}
                        onChange={(e) =>
                          setWaConfig({ ...waConfig, autoSendOnConfirm: e.target.checked })
                        }
                        className="accent-emerald-500"
                      />
                      <span>
                        {pickLang(lang, {
                          ar: 'إرسال تلقائي عند التأكيد',
                          fr: 'Envoi auto à la confirmation',
                          amz: 'ⴰⵣⵏ ⵙ ⵓⵡⵓⵔⵎⴰⵏ ⴳ ⵓⵙⵏⵜⵎ',
                          en: 'Auto-send on confirm',
                          es: 'Envío auto al confirmar',
                        })}
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={waConfig.autoSendOnReschedule}
                        onChange={(e) =>
                          setWaConfig({ ...waConfig, autoSendOnReschedule: e.target.checked })
                        }
                        className="accent-emerald-500"
                      />
                      <span>
                        {pickLang(lang, {
                          ar: 'إرسال تلقائي عند التعديل',
                          fr: 'Envoi auto au report',
                          amz: 'ⴰⵣⵏ ⵙ ⵓⵡⵓⵔⵎⴰⵏ ⴳ ⵓⵙⵏⴼⵍ',
                          en: 'Auto-send on reschedule',
                          es: 'Envío auto al reprogramar',
                        })}
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500">
                      {pickLang(lang, {
                        ar: 'تُحفظ مفاتيح الربط محلياً في متصفح الإدارة فقط.',
                        fr: 'Clés API enregistrées localement sur cet appareil.',
                        amz: 'ⵜⵉⵙⴰⵔⵓⵜⵉⵏ ⵜⵜⵓⵃⴹⴰⵏⵜ ⴳ ⵡⴰⵍⵍⴰⵍ ⴰⴷ ⴽⴰ.',
                        en: 'API keys are stored locally in this browser only.',
                        es: 'Las claves API se guardan solo localmente.',
                      })}
                    </span>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {waSavedNotice
                          ? pickLang(lang, {
                              ar: 'تم الحفظ ✓',
                              fr: 'Enregistré ✓',
                              amz: 'ⵉⵜⵜⵓⵃⴹⴰ ✓',
                              en: 'Saved ✓',
                              es: 'Guardado ✓',
                            })
                          : pickLang(lang, {
                              ar: 'حفظ إعدادات API',
                              fr: 'Enregistrer API',
                              amz: 'ⵃⴹⵓ API',
                              en: 'Save API Settings',
                              es: 'Guardar API',
                            })}
                      </span>
                    </button>
                  </div>
                </form>

                {/* Google Business Profile & Google Maps Links Configuration */}
                <form onSubmit={handleSaveGoogleLinks} className="p-4 rounded-xl bg-black/50 border border-zinc-800 space-y-3 text-xs flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <div className="flex items-center gap-2 font-bold text-blue-400">
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
                        className="text-[11px] text-blue-300 hover:underline flex items-center gap-1"
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
                      <label className="block text-[11px] text-zinc-400 mb-1">
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
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
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
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] disabled:opacity-60"
                      />
                    </div>

                    {profileLinksError && (
                      <div className="p-2 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-[11px]">
                        {profileLinksError}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500">
                      {session.role === 'master'
                        ? pickLang(lang, {
                            ar: 'يتم التحديث الفوري في الهيدر، الفوتر وقسم التقييمات.',
                            fr: 'Mis à jour en direct dans l’en-tête, pied de page et avis.',
                            amz: 'ⴰⵙⴷⵖⵉ ⵓⵙⵔⵉⴷ ⴳ ⵓⵙⵉⵜ ⴰⴽⴽⵯ.',
                            en: 'Syncs live across header, footer and reviews.',
                            es: 'Se actualiza en vivo en todo el sitio.',
                          })
                        : pickLang(lang, {
                            ar: 'متاح لتعديل المدير العام فقط (Hassan).',
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

            {workspaceSection === 'queue' && (
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
              />
            )}

            {workspaceSection === 'summary' && (
              <ResourcePlanningSummaryCharts
                bookings={bookings}
                reviews={firestoreReviews}
                role={session.role}
                ownBarberId={session.barberId}
              />
            )}

            {workspaceSection === 'analytics' && (
              <FinancialAnalyticsPanel
                bookings={bookings}
                role={session.role}
                ownBarberId={session.barberId}
              />
            )}

            {workspaceSection === 'schedules' && (
              <BarberSchedulePanel
                schedules={barberSchedules}
                bookings={bookings}
                role={session.role}
                ownBarberId={session.barberId}
              />
            )}

            {workspaceSection === 'shifts' && (
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

            {workspaceSection === 'crm' && (
              <CrmLoyaltyBlacklistPanel
                bookings={bookings}
                crmMap={crmClientsMap}
                onOpenClientTracking={onOpenClientTracking}
              />
            )}

            {workspaceSection === 'loyalty' && (
              <LoyaltyPointsAdminPanel
                bookings={bookings}
                crmMap={crmClientsMap}
                onOpenClientTracking={onOpenClientTracking}
              />
            )}

            {workspaceSection === 'waitlist' && (
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
              />
            )}

            {workspaceSection === 'bookings' && (
              <>
            {scannedTicketNotice && (
              <div className="p-3 bg-blue-950/40 border border-blue-500/40 rounded-xl text-xs text-blue-200 flex flex-wrap items-center justify-between gap-2">
                <span>{scannedTicketNotice}</span>
                <div className="flex items-center gap-2">
                  {onOpenClientTracking && scannedLookupQuery && (
                    <button
                      type="button"
                      onClick={() => onOpenClientTracking(scannedLookupQuery)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] flex items-center gap-1 cursor-pointer"
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
                    className="text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Archive Date Filter Picker (Shown only in Archive tab) */}
            {activeTab === 'archive' && (
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-amber-400" />
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
                    className="bg-black border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  {archiveDateFilter && (
                    <button
                      onClick={() => setArchiveDateFilter('')}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs"
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

            {/* TODAY'S KPI METRICS */}
            {activeTab === 'today' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                    {pickLang(lang, {
                      ar: 'تذاكر اليوم',
                      fr: 'Tickets du jour',
                      amz: 'ⵉⵏⵜⵜⵉⴽⵉⵜⵏ ⵏ ⵡⴰⵙⵙⴰ',
                      en: "Today's Tickets",
                      es: 'Tickets de hoy',
                    })}
                  </span>
                  <span className="text-2xl font-black text-white font-mono">{todayTickets.length}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">
                    {pickLang(lang, {
                      ar: 'قيد المراجعة (معلق)',
                      fr: 'En attente',
                      amz: 'ⴳ ⵓⵔⴰⵊⵓ',
                      en: 'Pending',
                      es: 'Pendientes',
                    })}
                  </span>
                  <span className="text-2xl font-black text-amber-400 font-mono">{pendingCount}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                    {pickLang(lang, {
                      ar: 'مؤكد ومقبول',
                      fr: 'Confirmés',
                      amz: 'ⵉⵜⵜⵓⵙⵏⵜⵎⵏ',
                      en: 'Confirmed',
                      es: 'Confirmados',
                    })}
                  </span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">{confirmedCount}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-red-400 uppercase font-bold tracking-wider block">
                    {pickLang(lang, {
                      ar: 'مرفوض / ملغى',
                      fr: 'Refusés / Annulés',
                      amz: 'ⵉⵜⵜⵓⵙⵔⵏ',
                      en: 'Rejected / Cancelled',
                      es: 'Rechazados / Cancelados',
                    })}
                  </span>
                  <span className="text-2xl font-black text-red-400 font-mono">{rejectedCount}</span>
                </div>
              </div>
            )}

            {/* WEEKLY TEAM WORKLOAD BAR CHART */}
            {activeTab === 'today' && (
              <WeeklyWorkloadBarChart bookings={bookings} todayStr={todayStr} />
            )}

            {/* Filter Toolbar & Status Tabs */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                
                {/* Search Input */}
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-zinc-500 absolute start-3 top-1/2 -translate-y-1/2" />
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
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl ps-9 pe-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Highly Visible Status Toggle Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-zinc-200 text-black shadow'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-zinc-800 text-amber-400 hover:bg-zinc-700'
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'confirmed'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-zinc-800 text-emerald-400 hover:bg-zinc-700'
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'completed'
                        ? 'bg-teal-600 text-white shadow'
                        : 'bg-zinc-800 text-teal-400 hover:bg-zinc-700'
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'rejected'
                        ? 'bg-red-600 text-white shadow'
                        : 'bg-zinc-800 text-red-400 hover:bg-zinc-700'
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

              {/* Master Admin Only: Barber Filter Tabs with Barber Color Indicators */}
              {session.role === 'master' && (
                <div className="pt-2 border-t border-zinc-800 flex items-center gap-2 overflow-x-auto text-xs">
                  <span className="text-zinc-400 font-semibold text-[11px] flex items-center gap-1 flex-shrink-0">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
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
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      masterBarberFilter === 'all'
                        ? 'bg-zinc-200 text-black'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
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

                  {TEAM_MEMBERS.map((b) => {
                    const count = bookings.filter(
                      (item) => item.barberId === b.id || item.barberName.toLowerCase().includes(b.name.fr.toLowerCase().split(' ')[0])
                    ).length;
                    const bColor = b.themeColor || '#D97706';

                    return (
                      <button
                        key={b.id}
                        onClick={() => setMasterBarberFilter(b.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          masterBarberFilter === b.id
                            ? 'text-white shadow ring-1'
                            : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                        style={{
                          backgroundColor: masterBarberFilter === b.id ? bColor : undefined,
                          borderColor: bColor,
                        }}
                      >
                        <span 
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: bColor }}
                        />
                        <span className="truncate">{b.name[lang] || b.name.ar || b.name.fr}</span>
                        <span className="opacity-75 font-mono">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bookings List */}
            {visibleBookings.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
                <CalendarDays className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-zinc-400 text-xs font-medium">
                  {activeTab === 'today'
                    ? pickLang(lang, {
                        ar: `لا توجد أي حجوزات مبرمجة بالضبط لتاريخ اليوم (${todayStr}).`,
                        fr: `Aucune réservation prévue exactement pour aujourd’hui (${todayStr}).`,
                        amz: `ⵓⵔ ⵍⵍⵉⵏ ⵉⵙⵉⵀⴰⵔⵏ ⵉ ⵡⴰⵙⵙⴰ (${todayStr}).`,
                        en: `No appointments scheduled for today (${todayStr}).`,
                        es: `No hay citas programadas para hoy (${todayStr}).`,
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
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
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
              <div className="space-y-4">
                {visibleBookings.map((booking) => {
                  const clientPhoneClean = formatMoroccanWhatsAppNumber(booking.clientPhone);
                  const isNoteSaved = savedNoteId === booking.id;
                  const barberColor = getBarberColor(booking);
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

                  return (
                    <div
                      key={booking.id}
                      className="p-4 sm:p-5 rounded-2xl bg-zinc-900/70 border-2 hover:border-zinc-700/80 transition-all space-y-4 shadow-lg relative overflow-hidden"
                      style={{
                        borderColor: `${barberColor}60`,
                      }}
                    >
                      {/* Barber Color Indicator Top Line */}
                      <div 
                        className="h-1 -mx-5 -mt-5 mb-3"
                        style={{ backgroundColor: barberColor }}
                      />

                      {/* Top Bar: Ticket #, Barber Tag with Hex Color, Date & Time, Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-base font-black text-white bg-black/60 px-2.5 py-1 rounded-lg border border-zinc-800">
                            {booking.ticketNumber}
                          </span>

                          {/* Distinct Barber Hex Color Badge */}
                          <div 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white font-bold text-xs shadow-xs"
                            style={{ backgroundColor: barberColor }}
                          >
                            <span className="w-2 h-2 rounded-full bg-white" />
                            <span>{booking.barberName}</span>
                          </div>

                          <span className="text-xs text-zinc-400 font-mono tabular-nums">
                            📅 {booking.date} • ⏰{' '}
                            {booking.timeSlot === 'FLEXIBLE'
                              ? pickLang(lang, {
                                  ar: 'وقت مرن (يختاره الحلاق)',
                                  fr: 'Horaire flexible (choisi par le barbier)',
                                  amz: 'ⴰⴽⵓⴷ ⵉⴼⵙⵙⵓⵙⵏ',
                                  en: 'Flexible time (barber choice)',
                                  es: 'Horario flexible (elige barbero)',
                                })
                              : booking.timeSlot}
                          </span>
                        </div>

                        {/* Status Badge + Inline CRM / Verified Milestone Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {crmProfile?.isVip && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
                              👑 VIP
                            </span>
                          )}
                          {crmProfile?.isBanned && (
                            <span className="px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500/60 text-red-200 text-[10px] font-bold">
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
                            className="px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-amber-300 text-[10px] font-mono font-bold tabular-nums flex items-center gap-1"
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
                            <span className="text-zinc-500">·</span>
                            {loyaltyState.justUnlockedMilestone ? (
                              <span className="text-emerald-300">
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
                              <span className="text-zinc-300">
                                {loyaltyState.verifiedVisits}/{loyaltyState.nextMilestone}
                              </span>
                            )}
                          </span>
                          {booking.checkedInAt && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
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
                            <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/50 text-teal-200 text-[10px] font-bold flex items-center gap-1">
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
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            booking.status === 'completed' ? 'bg-teal-500/20 text-teal-300 border border-teal-400/50' :
                            booking.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                            booking.status === 'flexible_pending' ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50' :
                            booking.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                            booking.status === 'rescheduled' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                            booking.status === 'no_show' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' :
                            booking.status === 'cancelled' ? 'bg-zinc-700/40 text-zinc-300 border border-zinc-600' :
                            'bg-red-500/20 text-red-400 border border-red-500/40'
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
                          bookings
                        ).slice(0, 6);
                        const isCustomOpen = flexCustomTargetId === booking.id;
                        const isFlexBusy = flexAssignBusyId === booking.id;

                        return (
                          <div className="p-3 rounded-xl bg-purple-950/35 border border-purple-500/40 space-y-2.5 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 font-black text-purple-200">
                                <CalendarClock className="w-4 h-4 text-purple-400 flex-shrink-0" />
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
                                <span className="text-[11px] font-mono text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
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
                              <div className="text-[11px] text-amber-300">
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
                                className="text-[11px] font-bold text-purple-300 hover:text-white underline cursor-pointer"
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
                                  className="bg-black/60 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white"
                                />
                                <input
                                  type="time"
                                  value={flexCustomTime}
                                  onChange={(e) => setFlexCustomTime(e.target.value)}
                                  className="bg-black/60 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white font-mono"
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
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
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
                              className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-teal-950/50 border border-teal-400/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                              className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-red-950/50 border border-red-400/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span>{booking.loyaltyRewardApplied}</span>
                        </div>
                      )}

                      {/* Client Info with DIRECT WHATSAPP BUTTON */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">
                              {pickLang(lang, {
                                ar: 'الزبون :',
                                fr: 'Client :',
                                amz: 'ⴰⵎⵣⴷⴰⵖ :',
                                en: 'Client:',
                                es: 'Cliente:',
                              })}
                            </span>
                            <span className="font-bold text-white text-sm">{booking.clientName}</span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800/80">
                            <span className="text-zinc-400">
                              {pickLang(lang, {
                                ar: 'الهاتف :',
                                fr: 'Téléphone :',
                                amz: 'ⵜⵉⵍⵉⴼⵓⵏ :',
                                en: 'Phone:',
                                es: 'Teléfono:',
                              })}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span dir="ltr" className="font-mono text-zinc-200">{booking.clientPhone}</span>
                              
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

                              {/* Automated API Reminder Dispatch Button (Green-API / UltraMsg) */}
                              <button
                                type="button"
                                disabled={sendingReminderId === booking.id}
                                onClick={() => handleSendWhatsAppApiReminder(booking)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-950/70 hover:bg-teal-900 border border-teal-500/40 text-teal-300 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                                title={pickLang(lang, {
                                  ar: 'إرسال تذكير آلي عبر بوابة Green-API أو UltraMsg',
                                  fr: 'Envoyer un rappel automatique via API',
                                  amz: 'ⴰⵣⵏ ⴰⵙⴽⵜⵉ ⵙ API',
                                  en: 'Send automated reminder via API',
                                  es: 'Enviar recordatorio automático vía API',
                                })}
                              >
                                <Send className="w-3 h-3" />
                                <span>
                                  {sendingReminderId === booking.id
                                    ? '...'
                                    : pickLang(lang, {
                                        ar: 'تذكير API',
                                        fr: 'Rappel API',
                                        amz: 'ⴰⵙⴽⵜⵉ API',
                                        en: 'API Reminder',
                                        es: 'Aviso API',
                                      })}
                                </span>
                              </button>

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
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-[11px] transition-colors cursor-pointer"
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
                            <div className="pt-1 text-[11px] text-zinc-300 space-y-0.5">
                              {booking.clientNotes && (
                                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200">
                                  <span className="text-amber-400 font-bold">
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
                                <div className="text-zinc-400">
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
                            <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
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
                                <div className="text-[10px] font-mono text-zinc-300 truncate">{booking.cihReceiptName}</div>
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
                        <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 space-y-1.5 text-xs">
                          <div className="text-zinc-400 font-semibold text-[11px]">
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
                              <div key={i} className="flex justify-between text-zinc-300 text-[11px]">
                                <span>• {itm.name}</span>
                                <span className="font-mono font-bold text-white">{itm.finalPrice} MAD</span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-1.5 border-t border-zinc-800 flex justify-between font-bold">
                            <span className="text-zinc-300">
                              {pickLang(lang, {
                                ar: 'المجموع المطلوب للأداء :',
                                fr: 'Total à payer :',
                                amz: 'ⴰⵎⵖⵔⵓⴷ :',
                                en: 'Total Due:',
                                es: 'Total a pagar:',
                              })}
                            </span>
                            <span className="text-amber-400 font-mono text-sm">{booking.finalTotalMAD} MAD</span>
                          </div>
                        </div>
                      </div>

                      {/* CLIENT STATUS NOTE (Universal Ticket Tools) */}
                      <div className="p-3 rounded-xl bg-[#12141B] border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                          <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
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
                            className="flex-1 bg-black/60 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveClientNote(booking.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isNoteSaved
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
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

                      {/* Action Triggers: Accept / Complete / Reschedule / No-Show / VIP / Ban / Reject */}
                      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {booking.status !== 'confirmed' && booking.status !== 'completed' && (
                            <button
                              onClick={() => handleConfirm(booking.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
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
                          )}

                          {booking.status !== 'completed' && booking.status !== 'cancelled' && booking.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleMarkCompleted(booking)}
                              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-teal-900/40 border border-teal-400/40 transition-colors cursor-pointer"
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
                            <>
                              <span className="min-h-[38px] px-3 py-1.5 rounded-lg bg-teal-950/70 border border-teal-500/40 text-teal-300 text-xs font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
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
                              {!booking.caisseLoggedAt && (
                                <button
                                  type="button"
                                  onClick={() => openCaissePromptForBooking(booking)}
                                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
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
                            </>
                          )}

                          <button
                            onClick={() => handleOpenReschedule(booking)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
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

                          {booking.status !== 'no_show' && booking.status !== 'completed' && (
                            <button
                              onClick={() => handleRecordNoShow(booking)}
                              className="px-2.5 py-1.5 rounded-lg bg-orange-950/70 hover:bg-orange-900 border border-orange-500/40 text-orange-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
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
                            onClick={() =>
                              toggleClientVip(booking.clientPhone, booking.clientName, crmClientsMap)
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border cursor-pointer ${
                              crmProfile?.isVip
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border-zinc-700'
                            }`}
                          >
                            <Star className="w-3.5 h-3.5" />
                            <span>VIP</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
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
                              )
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border cursor-pointer ${
                              crmProfile?.isBanned
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                                : 'bg-zinc-800 hover:bg-red-950 text-zinc-300 hover:text-red-300 border-zinc-700'
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
                              onClick={() => handleReject(booking.id)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 text-xs font-semibold transition-colors cursor-pointer"
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
                        </div>

                        <span className="text-[10px] text-zinc-500">
                          ID: {booking.id.slice(0, 14)}...
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
              </>
            )}

          </div>
        )}

      </div>

      {/* QR Code Scanner Dialog Modal (Forced Rear/Environment by default, with camera switcher & Client Tracking launch) */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                <Camera className="w-4 h-4 text-blue-400" />
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
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-blue-300 hover:text-white text-xs font-semibold flex items-center gap-1 border border-zinc-700 transition-colors cursor-pointer"
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
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scanner Action Mode Toggle */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] sm:text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setScannerActionMode('checkin')}
                className={`py-2 px-1.5 rounded-lg transition-colors cursor-pointer ${
                  scannerActionMode === 'checkin'
                    ? 'bg-emerald-500 text-black'
                    : 'text-zinc-400 hover:text-white'
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
                    : 'text-zinc-400 hover:text-white'
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
                    : 'text-zinc-400 hover:text-white'
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
              <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
                {scannerCameraError}
              </div>
            )}

            <div id="qr-reader-container" className="w-full rounded-xl overflow-hidden bg-black min-h-[250px] border border-zinc-800" />

            {/* Upload QR Image Alternative */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <label className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
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
                className="min-h-[40px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-blue-300 text-xs font-bold cursor-pointer"
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-white text-base">
              {pickLang(lang, {
                ar: `تعديل الموعد المقترح لـ ${reschedulingBooking.clientName}`,
                fr: `Modifier le créneau de ${reschedulingBooking.clientName}`,
                amz: `ⵙⵏⴼⵍ ⴰⵙⵉⵀⴰⵔ ⵏ ${reschedulingBooking.clientName}`,
                en: `Reschedule appointment for ${reschedulingBooking.clientName}`,
                es: `Reprogramar cita para ${reschedulingBooking.clientName}`,
              })}
            </h3>
            
            <form onSubmit={handleSaveReschedule} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
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
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
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
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
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
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReschedulingBooking(null)}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer"
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
      )}

      {/* CIH Receipt Preview Modal */}
      {previewReceipt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85">
          <div className="bg-zinc-950 border border-emerald-500/40 rounded-2xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="text-xs">
                <div className="font-bold text-emerald-400">
                  {pickLang(lang, {
                    ar: `إيصال تحويل CIH Bank — ${previewReceipt.ticketNumber}`,
                    fr: `Reçu virement CIH Bank — ${previewReceipt.ticketNumber}`,
                    amz: `ⵜⴰⵡⵔⵉⵇⵜ CIH Bank — ${previewReceipt.ticketNumber}`,
                    en: `CIH Bank Receipt — ${previewReceipt.ticketNumber}`,
                    es: `Recibo CIH Bank — ${previewReceipt.ticketNumber}`,
                  })}
                </div>
                <div className="text-zinc-400 font-mono text-[11px]">{previewReceipt.clientName} • {previewReceipt.fileName}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-black rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center max-h-[65vh]">
              <img
                src={previewReceipt.src}
                alt={previewReceipt.fileName}
                className="max-w-full max-h-[62vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* QR Arrival Check-In Confirmation Modal */}
      {checkInConfirmModal && (
        <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-zinc-950 border-2 border-emerald-500/50 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-300 font-black text-sm">
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
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/35 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-white text-base">
                  {checkInConfirmModal.booking.clientName}
                </span>
                <span className="font-mono font-bold text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-500/30">
                  {checkInConfirmModal.booking.ticketNumber}
                </span>
              </div>
              <div className="text-zinc-300">
                {pickLang(lang, {
                  ar: 'الحلاق:',
                  fr: 'Barbier :',
                  amz: 'ⴰⵎⴽⵕⴰⴹ :',
                  en: 'Barber:',
                  es: 'Barbero:',
                })}{' '}
                <span className="font-bold text-white">{checkInConfirmModal.booking.barberName}</span> ·{' '}
                <span className="font-mono">{checkInConfirmModal.booking.date} ({checkInConfirmModal.booking.timeSlot})</span>
              </div>
              {checkInConfirmModal.booking.checkInToken && (
                <div className="text-[11px] font-mono text-emerald-300">
                  {pickLang(lang, {
                    ar: 'رمز التحقق:',
                    fr: 'Code vérif. :',
                    amz: 'ⵜⴰⵎⴰⵜⴰⵔⵜ :',
                    en: 'Token:',
                    es: 'Código:',
                  })}{' '}
                  {checkInConfirmModal.booking.checkInToken}{' '}
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
              <div className="text-[11px] text-zinc-300">
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
                className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer"
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
      )}

      {/* Attendance-to-Caisse Prompt Modal (Never triggered on booking creation — only on attendance confirmation) */}
      {caissePromptBooking && (
        <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmCaisseFromBooking}
            className="bg-zinc-950 border-2 border-emerald-500/50 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-300 font-black text-sm">
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
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-black text-white">{caissePromptBooking.clientName}</span>
                <span className="font-mono text-amber-300">{caissePromptBooking.ticketNumber}</span>
              </div>
              <div className="text-zinc-400">
                {pickLang(lang, {
                  ar: 'الحلاق:',
                  fr: 'Barbier :',
                  amz: 'ⴰⵎⴽⵕⴰⴹ :',
                  en: 'Barber:',
                  es: 'Barbero:',
                })}{' '}
                {caissePromptBooking.barberName}
              </div>
              <div className="text-zinc-300">
                {pickLang(lang, {
                  ar: 'الخدمات:',
                  fr: 'Prestations :',
                  amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ :',
                  en: 'Services:',
                  es: 'Servicios:',
                })}{' '}
                {(caissePromptBooking.services || []).map((s) => s.name?.[lang] || s.name?.ar || s.id).join(' + ')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  {pickLang(lang, {
                    ar: 'المبلغ المستخلص في لاكيس (MAD) *',
                    fr: 'Montant encaissé en Caisse (MAD) *',
                    amz: 'ⴰⵜⵉⴳ ⵉⵜⵜⵓⵙⵔⵙⵏ ⴳ ⵍⴰⴽⵉⵙ (MAD) *',
                    en: 'Amount Collected in Caisse (MAD) *',
                    es: 'Monto cobrado en Caja (MAD) *',
                  })}
                </label>
                <input
                  type="number"
                  min={0}
                  value={caissePromptPaid}
                  onChange={(e) => setCaissePromptPaid(e.target.value)}
                  className="w-full bg-black border border-zinc-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
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
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCaissePromptHasCredit((p) => !p)}
              className={`w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 cursor-pointer ${
                caissePromptHasCredit
                  ? 'bg-orange-500/20 border-orange-400 text-orange-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              }`}
            >
              <CreditCard className="w-4 h-4 text-orange-400" />
              <span>
                {pickLang(lang, {
                  ar: 'تسجيل الباقي كـ كريدي (الكريدي)',
                  fr: 'Enregistrer le reste en Crédit',
                  amz: 'ⵣⵎⵎⴻⵎ ⵎⴰⴷ ⵉⵖⴰⵎⴰⵏ ⴰⵎ ⵓⴽⵔⵉⴷⵉ',
                  en: 'Record Remainder as Credit',
                  es: 'Registrar resto como Crédito',
                })}
              </span>
            </button>

            {caissePromptHasCredit && (
              <div className="p-3 rounded-xl bg-orange-950/30 border border-orange-500/35 grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-orange-200 font-bold mb-1">
                    {pickLang(lang, {
                      ar: 'الإجمالي المتفق عليه (MAD)',
                      fr: 'Total convenu (MAD)',
                      amz: 'ⴰⵎⵖⵔⵓⴷ (MAD)',
                      en: 'Agreed Total (MAD)',
                      es: 'Total acordado (MAD)',
                    })}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={caissePromptExpected}
                    onChange={(e) => setCaissePromptExpected(e.target.value)}
                    className="w-full bg-black border border-orange-500/40 rounded-lg px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    {pickLang(lang, {
                      ar: 'تاريخ الأداء المتوقع',
                      fr: 'Date de remboursement prévue',
                      amz: 'ⴰⵙⴰⴽⵓⴷ ⵏ ⵓⴼⵔⵓ',
                      en: 'Expected Repayment Date',
                      es: 'Fecha de pago prevista',
                    })}
                  </label>
                  <input
                    type="date"
                    value={caissePromptRepayDate}
                    onChange={(e) => setCaissePromptRepayDate(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
              </div>
            )}

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
                className="px-4 min-h-[42px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
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
      )}

    </div>
  );
};
