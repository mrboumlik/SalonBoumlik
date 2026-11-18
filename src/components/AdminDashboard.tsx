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
  BarChart3
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
  normalizeMoroccanPhoneDigits
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
import {
  ClientQrTarget,
  parseScannedQrResult,
  scanQrImageFile,
} from '../utils/clientQr';
import { ClientQrModal } from './ClientQrModal';
import { AppointmentBooking, BookingStatus } from '../types';
import { SALON_INFO, TEAM_MEMBERS } from '../data/barbershopData';

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
    'bookings' | 'queue' | 'summary' | 'schedules' | 'shifts' | 'crm' | 'loyalty' | 'analytics' | 'waitlist'
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
  const [scannerActionMode, setScannerActionMode] = useState<'tracking' | 'filter'>('tracking');
  const [qrTargetClient, setQrTargetClient] = useState<ClientQrTarget | null>(null);

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
        newItems.filter(matchesCurrentStaffScope).forEach((nb) => {
          const isFlex = nb.status === 'flexible_pending' || nb.timeSlot === 'FLEXIBLE';
          const timeText = isFlex ? 'وقت مرن — بانتظار اختيارك' : nb.timeSlot;
          sendDualAlert(
            isFlex
              ? `⏳ طلب وقت مرن (${nb.ticketNumber}) • صالون بومليك`
              : `🔔 موعد جديد (${nb.ticketNumber}) • صالون بومليك`,
            {
              body: nb.cihReceiptName
                ? `حجز #${nb.ticketNumber} - ${nb.clientName} مع ${nb.barberName} (${nb.date} ${timeText}) مع إيصال CIH.`
                : `حجز #${nb.ticketNumber} - ${nb.clientName} مع ${nb.barberName} (${nb.date} ${timeText}).`,
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
        newlyUploadedCih.filter(matchesCurrentStaffScope).forEach((b) => {
          sendDualAlert(`🧾 إيصال تحويل CIH جديد (${b.ticketNumber})`, {
            body: `قام الزبون ${b.clientName} بإرفاق إيصال التحويل البنكي CIH لموعد ${b.date} (${b.timeSlot}).`,
            type: 'success',
            tag: `sb-admin-cih-${b.id}`,
            data: { ticketNumber: b.ticketNumber, url: '/#admin' },
          });
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
      newEntries
        .filter((w) => session.role === 'master' || w.barberId === session.barberId)
        .forEach((w) => {
          sendDualAlert('📋 زبون جديد في قائمة الانتظار!', {
            body: `${w.clientName} (${w.barberName} • ${w.date} ${w.preferredTime})`,
            type: 'info',
            tag: `sb-admin-wl-${w.id}`,
            data: { url: '/#admin' },
          });
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

  // Unified QR Scan Result Handler (Client Profile QR or Ticket QR)
  const handleDecodedQrResult = (rawDecodedText: string) => {
    const parsed = parseScannedQrResult(rawDecodedText);
    const lookup = parsed.query || rawDecodedText.trim();
    if (!lookup) return;

    setSearchQuery(lookup);
    setScannedLookupQuery(lookup);
    setScannedTicketNotice(
      parsed.kind === 'client'
        ? `تم مسح رمز ملف الزبون: ${lookup}`
        : `تم مسح التذكرة / الرمز: ${lookup}`
    );

    const shouldOpenTracking =
      Boolean(onOpenClientTracking) &&
      (parsed.kind === 'client' || scannerActionMode === 'tracking');

    if (shouldOpenTracking && onOpenClientTracking) {
      onOpenClientTracking(lookup);
      sendDualAlert('تم فتح نافذة تتبع الزبون ✓', {
        body: `عرض الملف والولاء المباشر لـ: ${lookup}`,
        type: 'success',
        skipSound: true,
      });
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
      setScannerCameraError('تعذر قراءة رمز QR من هذه الصورة. تأكد من وضوح الرمز.');
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
          err?.message || 'Impossible d’accéder à la caméra. Vérifiez les autorisations de votre navigateur.'
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
          ? 'تم تفعيل الإشعارات الفورية والخلفية ✓'
          : 'تم تفعيل التنبيهات الصوتية بنجاح ✓',
        subResult.subscribed
          ? 'ستصلك إشعارات الحجوزات الجديدة، إيصالات CIH، وقائمة الانتظار حتى عند إغلاق المتصفح.'
          : 'ستصلك تنبيهات صوتية داخل لوحة التحكم عند وصول حجوزات جديدة.',
        'success'
      );
    } else {
      setNotificationsEnabled(false);
      try {
        localStorage.setItem(ADMIN_NOTIFS_ENABLED_KEY, 'false');
      } catch {}
      showToast('تم إيقاف الإشعارات مؤقتاً', 'تم كتم التنبيهات التلقائية.', 'warning');
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      const targetBooking = bookings.find((b) => b.id === id);
      await updateBookingStatus(
        id,
        'confirmed',
        `Confirmé par ${session?.name || 'le salon'}. Votre créneau est réservé.`
      );

      if (targetBooking && waConfig.enabled && waConfig.autoSendOnConfirm) {
        const res = await dispatchAutomatedWhatsAppMessage(
          { ...targetBooking, status: 'confirmed' },
          'confirmation',
          waConfig
        );
        if (res.success) {
          sendDualAlert(`تم إرسال إشعار واتساب (${res.provider})`, {
            body: `تم إرسال تأكيد الموعد تلقائياً إلى ${targetBooking.clientName}.`,
            type: 'success',
            skipSound: true,
          });
        }
      }
    } catch (err) {
      console.error('Failed to confirm booking:', err);
      sendDualAlert('خطأ في التحديث', {
        body: 'تعذر تحديث حالة الموعد في قاعدة البيانات.',
        type: 'warning',
      });
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt(
      'Motif du refus ou créneau complet (optionnel) :',
      'Créneau indisponible, veuillez choisir un autre horaire.'
    );
    if (reason !== null) {
      try {
        await updateBookingStatus(id, 'rejected', reason || 'Non disponible');
      } catch (err) {
        console.error('Failed to reject booking:', err);
        sendDualAlert('خطأ في التحديث', {
          body: 'تعذر تحديث حالة الموعد في قاعدة البيانات.',
          type: 'warning',
        });
      }
    }
  };

  const handleMarkCompleted = async (booking: AppointmentBooking) => {
    if (booking.status === 'completed') {
      sendDualAlert('تم تأكيد الحضور مسبقاً', {
        body: `تذكرة ${booking.ticketNumber} مسجلة كحاضر ومكتملة بالفعل (بدون تكرار النقاط).`,
        type: 'info',
        skipSound: true,
      });
      return;
    }

    setQuickActionBusyId(booking.id);
    try {
      const result = await confirmClientAttendance(booking, bookings, crmClientsMap);
      if (result.alreadyCompleted) {
        sendDualAlert('تم تأكيد الحضور مسبقاً', {
          body: `لا يمكن احتساب نفس الزيارة مرتين للزبون ${booking.clientName}.`,
          type: 'info',
          skipSound: true,
        });
        return;
      }

      if (result.unlockedMilestone) {
        sendDualAlert(`🎉 تأكيد الحضور + إنجاز ${result.unlockedMilestone} زيارات!`, {
          body: `${booking.clientName}: أصبح لديه ${result.newVerifiedVisits} زيارة مؤكدة وتم فتح مكافأة المستوى ${result.unlockedMilestone / 5}!`,
          type: 'success',
        });
      } else {
        const progress = computeLoyaltyProgress(result.newVerifiedVisits, 'ar');
        sendDualAlert('تم تأكيد الحضور واحتساب نقطة الولاء ✓', {
          body: `${booking.clientName}: ${result.newVerifiedVisits} زيارة مؤكدة (${progress.verifiedVisits}/${progress.nextMilestone} للمكافأة التالية).`,
          type: 'success',
          skipSound: true,
        });
      }
    } catch (err) {
      console.error('Failed to confirm attendance / mark completed:', err);
      sendDualAlert('خطأ في التحديث', {
        body: 'تعذر تأكيد الحضور أو تحديث رصيد الولاء في السحابة.',
        type: 'warning',
      });
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
        `تم إلغاء الموعد بواسطة ${session?.name || 'الإدارة'}.`;
      await updateBookingStatus(booking.id, 'cancelled', note);
      sendDualAlert('تم إلغاء الموعد (Cancelled)', {
        body: `تم تحديث حالة تذكرة ${booking.ticketNumber} (${booking.clientName}) إلى ملغى بنقرة واحدة.`,
        type: 'warning',
        skipSound: true,
      });
    } catch (err) {
      console.error('Failed to cancel booking:', err);
      sendDualAlert('خطأ في التحديث', {
        body: 'تعذر إلغاء الموعد في قاعدة البيانات.',
        type: 'warning',
      });
    } finally {
      setQuickActionBusyId((prev) => (prev === booking.id ? null : prev));
    }
  };

  const handleRecordNoShow = async (booking: AppointmentBooking) => {
    const confirmMsg = `هل تغيب الزبون "${booking.clientName}" عن هذا الموعد؟\nسيتم تسجيل No-Show وحظر الرقم تلقائياً عند بلوغ تغيّبين (2 No-Shows).`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const updatedProfile = await recordClientNoShow(booking, crmClientsMap);
      sendDualAlert(
        updatedProfile.isBanned
          ? 'تم تسجيل التغيب + الحظر التلقائي 🚫'
          : `تم تسجيل التغيب (${updatedProfile.noShowCount}/2) ⚠️`,
        {
          body: updatedProfile.isBanned
            ? `تم إدراج رقم ${booking.clientPhone} في القائمة السوداء تلقائياً بعد تغيّبين.`
            : `الزبون ${booking.clientName} لديه الآن مخالفة تغيّب واحدة.`,
          type: 'warning',
        }
      );
    } catch (err) {
      console.error('Failed to record no-show:', err);
      sendDualAlert('خطأ في تسجيل التغيب', {
        body: 'تعذر تحديث سجل CRM.',
        type: 'warning',
      });
    }
  };

  const handleOpenReschedule = (booking: AppointmentBooking) => {
    setReschedulingBooking(booking);
    setNewDate(booking.date);
    setNewTime(booking.timeSlot);
    setRescheduleNote('Décalé pour vous éviter l’attente au salon.');
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
          sendDualAlert(`تم إرسال إشعار التعديل (${res.provider})`, {
            body: `تم إرسال التوقيت الجديد للزبون ${targetBooking.clientName}.`,
            type: 'success',
            skipSound: true,
          });
        }
      }
    } catch (err) {
      console.error('Failed to reschedule booking:', err);
      sendDualAlert('خطأ في تعديل الموعد', {
        body: 'تعذر حفظ التوقيت الجديد في قاعدة البيانات.',
        type: 'warning',
      });
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
        `تم اختيار أفضل وقت متاح لك (${assignedDate} الساعة ${assignedTime}) بواسطة ${staffLabel}.`;

      await assignFlexibleBookingSlot(booking.id, assignedDate, assignedTime, customNote);
      setFlexCustomTargetId(null);

      sendDualAlert(`تم تعيين الوقت وإشعار الزبون (${assignedTime}) ✓`, {
        body: `تم تحديد موعد ${booking.clientName} يوم ${assignedDate} الساعة ${assignedTime} وتأكيده مع إرسال إشعار فوري للزبون.`,
        type: 'success',
        skipSound: true,
      });

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
      sendDualAlert('خطأ في تعيين الموعد', {
        body: 'تعذر تحديث التوقيت في قاعدة البيانات.',
        type: 'warning',
      });
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
      sendDualAlert('خطأ في الحفظ', {
        body: 'تعذر حفظ الملاحظة للزبون.',
        type: 'warning',
      });
    }
  };

  const handleSaveWaConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveWhatsAppAutomationConfig(waConfig);
    setWaSavedNotice(true);
    setTimeout(() => setWaSavedNotice(false), 2500);
    sendDualAlert('تم حفظ إعدادات واتساب API', {
      body: `المزود المختار: ${waConfig.provider === 'green-api' ? 'Green-API' : 'UltraMsg'}`,
      type: 'success',
      skipSound: true,
    });
  };

  const handleSaveGoogleLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLinksError(null);
    setSavingProfileLinks(true);
    try {
      await saveSalonProfileSettings(mapsUrlInput, reviewUrlInput);
      setProfileLinksSaved(true);
      setTimeout(() => setProfileLinksSaved(false), 2500);
      sendDualAlert('تم تحديث روابط Google Business', {
        body: 'تمت مزامنة روابط الخرائط والتقييم في الموقع بالكامل.',
        type: 'success',
        skipSound: true,
      });
    } catch (err: any) {
      setProfileLinksError(err?.message || 'يجب أن تبدأ الروابط بـ https://');
    } finally {
      setSavingProfileLinks(false);
    }
  };

  const handleSendWhatsAppApiReminder = async (booking: AppointmentBooking) => {
    if (!waConfig.enabled || !waConfig.instanceId.trim() || !waConfig.token.trim()) {
      setIsSettingsOpen(true);
      sendDualAlert('أدخل بيانات الربط أولاً', {
        body: 'يرجى تفعيل Green-API أو UltraMsg وإدخال Instance ID و Token في لوحة الإعدادات.',
        type: 'warning',
        skipSound: true,
      });
      return;
    }

    setSendingReminderId(booking.id);
    const res = await dispatchAutomatedWhatsAppMessage(booking, 'reminder_1h', waConfig);
    setSendingReminderId(null);

    if (res.success) {
      sendDualAlert('تم إرسال التذكير الآلي بنجاح ✅', {
        body: `تم إرسال تذكير واتساب عبر ${res.provider} إلى ${booking.clientName}.`,
        type: 'success',
      });
    } else {
      sendDualAlert('تعذر الإرسال عبر API', {
        body: `السبب: ${res.reason || 'تحقق من حالة الجلسة في بوابة واتساب.'}`,
        type: 'warning',
      });
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
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md">
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
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white font-display">
                  ESPACE GESTION • SALON BOUMLIK
                </h2>
                {session && (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                    session.role === 'master' 
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                      : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  }`}>
                    <ShieldCheck className="w-3 h-3" />
                    <span>{session.name} ({session.role === 'master' ? 'Master Admin' : 'Barbier'})</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                {session?.role === 'master' 
                  ? 'Gestion globale des réservations & notes clients en temps réel' 
                  : `Tableau de bord personnel : rendez-vous assignés à ${session?.name || 'vous'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                title="Déconnexion"
              >
                Déconnexion
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
              <h3 className="text-xl font-bold text-white">Espace Staff & Direction</h3>
              <p className="text-xs text-zinc-400">
                Accès sécurisé pour l'équipe du Salon Boumlik. Veuillez entrer votre code confidentiel.
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
                  <span>Code PIN invalide. Veuillez réessayer.</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Connexion au Tableau de Bord
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
                          الأرباح اليومية • Daily Revenue
                        </h3>
                        <span className="text-[11px] font-mono text-emerald-400 tabular-nums">
                          {todayStr}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {session.role === 'master'
                          ? 'إجمالي مداخيل المواعيد المكتملة اليوم بناءً على الخدمات المختارة في نموذج الحجز'
                          : `مداخيل مواعيدك المكتملة اليوم (${session.name}) بناءً على الخدمات المنجزة`}
                      </p>
                    </div>
                  </div>

                  <div className="sm:text-right flex sm:flex-col items-baseline sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-500/15">
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums tracking-tight">
                      {dailyRevenue.servicesRevenueMAD.toLocaleString('en-US')}{' '}
                      <span className="text-xs sm:text-sm font-bold text-emerald-400">MAD</span>
                    </div>
                    <div className="text-[11px] text-zinc-300 font-mono tabular-nums">
                      {dailyRevenue.completedCount} مواعيد مكتملة · {dailyRevenue.servicesCount} خدمات منجزة
                      {dailyRevenue.netCollectedMAD !== dailyRevenue.servicesRevenueMAD && (
                        <span className="text-emerald-300">
                          {' '}· الصافي: {dailyRevenue.netCollectedMAD.toLocaleString('en-US')} MAD
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {dailyRevenue.topServices.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-emerald-500/15 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-300">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Scissors className="w-3.5 h-3.5" />
                      <span>الخدمات المكتملة اليوم:</span>
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
                <span>الحجوزات ({bookings.length})</span>
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
                    <span>الطابور المباشر • Live Queue</span>
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
                <span>ملخص الموارد • Summary</span>
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
                <span>التحليلات والأداء • Analytics</span>
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
                <span>الزبناء والولاء CRM</span>
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
                <span>نقاط الولاء • Loyalty Points</span>
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
                <span>أوقات الحلاقين</span>
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
                    <span>تخطيط المناوبات • Shift Planner</span>
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
                <span>قائمة الانتظار</span>
                {waitlistEntries.filter((w) => w.status === 'waiting').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-mono">
                    {waitlistEntries.filter((w) => w.status === 'waiting').length}
                  </span>
                )}
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
                    <span>تذاكر اليوم ({todayStr})</span>
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
                    <span>الأرشيف والسجل الكامل</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-zinc-400 font-semibold">
                  {workspaceSection === 'queue' && '⚡ الطابور المباشر لمواعيد اليوم — معرفة التالي في الدور لحظياً'}
                  {workspaceSection === 'analytics' && '📊 إحصائيات الأرباح والخدمات (خاص بالمدير العام)'}
                  {workspaceSection === 'crm' && '👑 إدارة الولاء، الزيارات والقائمة السوداء'}
                  {workspaceSection === 'loyalty' && '🪙 إدارة نقاط الولاء واستبدالها بتخفيضات على الخدمات القادمة (+10 نقاط لكل زيارة مؤكدة)'}
                  {workspaceSection === 'schedules' && '🕒 تخصيص ساعات الراحة وأيام العطل لكل حلاق'}
                  {workspaceSection === 'shifts' && '⇄ طلبات الإجازة وتبديل المناوبات مع التحديث الفوري لصفحة الحجز'}
                  {workspaceSection === 'waitlist' && '📋 متابعة المسجلين في قائمة الانتظار الذكية'}
                </div>
              )}

              {/* Notification Alert Toggle & QR Scanner Tool */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer shadow-sm ${
                    notificationsEnabled
                      ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                  }`}
                  title="تفعيل أو كتم التنبيهات الصوتية والمنبثقة عند وصول حجز جديد"
                >
                  {notificationsEnabled ? (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span>تفعيل الإشعارات الصوتية والمنبثقة (مفعّل ✓)</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-4 h-4 text-zinc-400" />
                      <span>تفعيل الإشعارات الصوتية والمنبثقة (معطّل)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenScanner}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>ماسح التذاكر (QR Scanner)</span>
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
                  <span>إعدادات WhatsApp API & Google</span>
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
                      <span>أتمتة رسائل وتذكيرات WhatsApp (Green-API / UltraMsg)</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-zinc-200">
                      <input
                        type="checkbox"
                        checked={waConfig.enabled}
                        onChange={(e) => setWaConfig({ ...waConfig, enabled: e.target.checked })}
                        className="accent-emerald-500 w-4 h-4"
                      />
                      <span>تفعيل</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">مزود البوابة (Provider)</label>
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
                      <label className="block text-[11px] text-zinc-400 mb-1">وقت التذكير قبل الموعد</label>
                      <select
                        value={waConfig.reminderMinutesBefore}
                        onChange={(e) =>
                          setWaConfig({ ...waConfig, reminderMinutesBefore: Number(e.target.value) })
                        }
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                      >
                        <option value={30}>30 دقيقة قبل الموعد</option>
                        <option value={60}>ساعة واحدة قبل الموعد</option>
                        <option value={120}>ساعتان قبل الموعد</option>
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
                      <span>إرسال تلقائي عند التأكيد</span>
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
                      <span>إرسال تلقائي عند التعديل</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500">تُحفظ مفاتيح الربط محلياً في متصفح الإدارة فقط.</span>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{waSavedNotice ? 'تم الحفظ ✓' : 'حفظ إعدادات API'}</span>
                    </button>
                  </div>
                </form>

                {/* Google Business Profile & Google Maps Links Configuration */}
                <form onSubmit={handleSaveGoogleLinks} className="p-4 rounded-xl bg-black/50 border border-zinc-800 space-y-3 text-xs flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <div className="flex items-center gap-2 font-bold text-blue-400">
                        <MapPin className="w-4 h-4" />
                        <span>روابط Google Business Profile & Google Maps</span>
                      </div>
                      <a
                        href={mapsUrlInput}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-300 hover:underline flex items-center gap-1"
                      >
                        <span>معاينة</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
                        رابط خرائط Google Maps المباشر للصالون
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
                        رابط ملف Google Business وتقييمات الزبناء 5★
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
                        ? 'يتم التحديث الفوري في الهيدر، الفوتر وقسم التقييمات.'
                        : 'متاح لتعديل المدير العام فقط (Hassan).'}
                    </span>
                    {session.role === 'master' && (
                      <button
                        type="submit"
                        disabled={savingProfileLinks}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingProfileLinks ? '...' : profileLinksSaved ? 'تم التحديث ✓' : 'حفظ ونشر الروابط'}</span>
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
                      <span>فتح نافذة التتبع</span>
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
                  <span>تصفية الأرشيف حسب تاريخ محدد:</span>
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
                      عرض كل التواريخ
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
                    تذاكر اليوم
                  </span>
                  <span className="text-2xl font-black text-white font-mono">{todayTickets.length}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">
                    قيد المراجعة (معلق)
                  </span>
                  <span className="text-2xl font-black text-amber-400 font-mono">{pendingCount}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                    مؤكد ومقبول
                  </span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">{confirmedCount}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-red-400 uppercase font-bold tracking-wider block">
                    مرفوض / ملغى
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
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث برقم التذكرة #SB أو الهاتف (06... / +212)..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Highly Visible Status Toggle Tabs: Pending (معلق), Confirmed (مقبول), Rejected (مرفوض) */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-zinc-200 text-black shadow'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    الكل
                  </button>

                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-zinc-800 text-amber-400 hover:bg-zinc-700'
                    }`}
                  >
                    معلق (Pending)
                  </button>

                  <button
                    onClick={() => setStatusFilter('confirmed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'confirmed'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-zinc-800 text-emerald-400 hover:bg-zinc-700'
                    }`}
                  >
                    مقبول (Confirmed)
                  </button>

                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'completed'
                        ? 'bg-teal-600 text-white shadow'
                        : 'bg-zinc-800 text-teal-400 hover:bg-zinc-700'
                    }`}
                  >
                    مكتمل (Completed)
                  </button>

                  <button
                    onClick={() => setStatusFilter('rejected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'rejected'
                        ? 'bg-red-600 text-white shadow'
                        : 'bg-zinc-800 text-red-400 hover:bg-zinc-700'
                    }`}
                  >
                    مرفوض / ملغى / تغيب
                  </button>
                </div>
              </div>

              {/* Master Admin Only: Barber Filter Tabs with Barber Color Indicators */}
              {session.role === 'master' && (
                <div className="pt-2 border-t border-zinc-800 flex items-center gap-2 overflow-x-auto text-xs">
                  <span className="text-zinc-400 font-semibold text-[11px] flex items-center gap-1 flex-shrink-0">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>تصفية حسب الحلاق :</span>
                  </span>

                  <button
                    onClick={() => setMasterBarberFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      masterBarberFilter === 'all'
                        ? 'bg-zinc-200 text-black'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    كل الحلاقين ({bookings.length})
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
                        <span className="truncate">{b.name.ar}</span>
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
                    ? `لا توجد أي حجوزات مبرمجة بالضبط لتاريخ اليوم (${todayStr}).`
                    : 'لا توجد أي تذاكر مطابقة في الأرشيف أو البحث.'}
                </p>
                {activeTab === 'today' && (bookings.length > 0 || archiveSearchMatchesCount > 0) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('archive')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {archiveSearchMatchesCount > 0
                        ? `تم العثور على ${archiveSearchMatchesCount} نتيجة مطابقة في الأرشيف الكامل — عرض الآن`
                        : `عرض جميع الحجوزات بالأرشيف (${bookings.length} حجز)`}
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
                  const loyaltyState = computeLoyaltyProgress(verifiedVisitsCount, 'ar');

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
                              ? 'وقت مرن (يختاره الحلاق)'
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
                              🚫 محظور
                            </span>
                          )}
                          <span
                            className="px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-amber-300 text-[10px] font-mono font-bold tabular-nums flex items-center gap-1"
                            title="تُحتسب الزيارات فقط بعد الضغط على تأكيد الحضور"
                          >
                            <span>
                              زيارات مؤكدة: {loyaltyState.verifiedVisits}
                            </span>
                            <span className="text-zinc-500">·</span>
                            {loyaltyState.justUnlockedMilestone ? (
                              <span className="text-emerald-300">
                                {loyaltyState.justUnlockedMilestone}/{loyaltyState.justUnlockedMilestone} مكتمل ✓ → {loyaltyState.nextMilestone}
                              </span>
                            ) : (
                              <span className="text-zinc-300">
                                {loyaltyState.verifiedVisits}/{loyaltyState.nextMilestone}
                              </span>
                            )}
                          </span>
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
                            {booking.status === 'completed' ? 'مكتمل — حضر ✓' :
                             booking.status === 'confirmed' ? 'مقبول (Confirmed)' :
                             booking.status === 'flexible_pending' ? 'وقت مرن — بانتظار تعيين الحلاق' :
                             booking.status === 'pending' ? 'معلق (Pending)' :
                             booking.status === 'rescheduled' ? 'معدل (Rescheduled)' :
                             booking.status === 'no_show' ? 'تغيب (No-Show)' :
                             booking.status === 'cancelled' ? 'ملغى (Cancelled)' :
                             'مرفوض (Rejected)'}
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
                                  الزبون طلب اختيار أفضل وقت متاح له • اضغط لتعيين الساعة وإشعار الزبون تلقائياً
                                </span>
                              </div>
                              {booking.preferredTimeHint && (
                                <span className="text-[11px] font-mono text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                                  كان يفضل: {booking.preferredTimeHint}
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
                                      {slotOpt.date === booking.date ? 'نفس اليوم' : slotOpt.date.slice(5)} · {slotOpt.time}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-300">
                                لا توجد ساعات شاغرة تلقائياً في الأيام الثلاثة القادمة، يمكنك تخصيص تاريخ ووقت يدوياً:
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
                                {isCustomOpen ? 'إخفاء التخصيص اليدوي' : 'تخصيص تاريخ وساعة أخرى يدوياً...'}
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
                                  <span>تعيين وإشعار الزبون</span>
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
                            <span>إجراءات سريعة للطلب المعلق (Quick Actions)</span>
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
                              <span>تأكيد الحضور • Verify Completion</span>
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
                              <span>إلغاء الحجز • Cancel</span>
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
                            <span className="text-zinc-400">الزبون :</span>
                            <span className="font-bold text-white text-sm">{booking.clientName}</span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800/80">
                            <span className="text-zinc-400">الهاتف :</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span dir="ltr" className="font-mono text-zinc-200">{booking.clientPhone}</span>
                              
                              {/* Direct WhatsApp Client Button (Dynamic Multilingual Format) */}
                              <a
                                href={`https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(
                                  buildClientTicketWhatsAppMessage(booking)
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors shadow-xs"
                                title="Contacter directement sur WhatsApp avec récapitulatif complet"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp Client</span>
                              </a>

                              {/* Automated API Reminder Dispatch Button (Green-API / UltraMsg) */}
                              <button
                                type="button"
                                disabled={sendingReminderId === booking.id}
                                onClick={() => handleSendWhatsAppApiReminder(booking)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-950/70 hover:bg-teal-900 border border-teal-500/40 text-teal-300 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                                title="إرسال تذكير آلي عبر بوابة Green-API أو UltraMsg"
                              >
                                <Send className="w-3 h-3" />
                                <span>{sendingReminderId === booking.id ? '...' : 'تذكير API'}</span>
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
                                title="عرض رمز QR الخاص بملف هذا الزبون"
                              >
                                <QrCode className="w-3 h-3" />
                                <span>QR الزبون</span>
                              </button>
                            </div>
                          </div>

                          {(booking.clientNotes || booking.notes) && (
                            <div className="pt-1 text-[11px] text-zinc-300 space-y-0.5">
                              {booking.clientNotes && (
                                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200">
                                  <span className="text-amber-400 font-bold">ملاحظات الزبون (التفضيلات): </span>
                                  <span className="break-words">{booking.clientNotes}</span>
                                </div>
                              )}
                              {booking.notes && booking.notes !== booking.clientNotes && (
                                <div className="text-zinc-400">
                                  <span className="text-zinc-500 font-semibold">ملاحظة / إضافات: </span>
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
                                  <span>إيصال تحويل CIH Bank</span>
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
                                  <span>عرض الإيصال</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Services & Total */}
                        <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 space-y-1.5 text-xs">
                          <div className="text-zinc-400 font-semibold text-[11px]">الخدمات المطلوبة :</div>
                          <div className="space-y-0.5">
                            {(booking.cartItemsSummary || []).map((itm, i) => (
                              <div key={i} className="flex justify-between text-zinc-300 text-[11px]">
                                <span>• {itm.name}</span>
                                <span className="font-mono font-bold text-white">{itm.finalPrice} MAD</span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-1.5 border-t border-zinc-800 flex justify-between font-bold">
                            <span className="text-zinc-300">المجموع المطلوب للأداء :</span>
                            <span className="text-amber-400 font-mono text-sm">{booking.finalTotalMAD} MAD</span>
                          </div>
                        </div>
                      </div>

                      {/* CLIENT STATUS NOTE (Universal Ticket Tools) */}
                      <div className="p-3 rounded-xl bg-[#12141B] border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>ملاحظة أو رد مخصص للزبون (Client Note) :</span>
                          </label>
                          <span className="text-[10px] text-zinc-500">
                            (تظهر مباشرة في صفحة تتبع الزبون فور حفظها)
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
                            placeholder="مثال: تم حجز الكرسي، مرحباً بك قبل الموعد بـ 5 دقائق..."
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
                                <span>تم الحفظ!</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                <span>حفظ الرد</span>
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
                              <span>قبول وتأكيد</span>
                            </button>
                          )}

                          {booking.status !== 'completed' && booking.status !== 'cancelled' && booking.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleMarkCompleted(booking)}
                              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-teal-900/40 border border-teal-400/40 transition-colors cursor-pointer"
                            >
                              <Award className="w-4 h-4" />
                              <span>تأكيد الحضور / حضر عندي (Completed)</span>
                            </button>
                          )}

                          {booking.status === 'completed' && (
                            <span className="min-h-[38px] px-3 py-1.5 rounded-lg bg-teal-950/70 border border-teal-500/40 text-teal-300 text-xs font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                              <span>حضر عندي ✓ (+1 ولاء)</span>
                            </span>
                          )}

                          <button
                            onClick={() => handleOpenReschedule(booking)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Clock3 className="w-3.5 h-3.5" />
                            <span>تعديل الموعد</span>
                          </button>

                          {booking.status !== 'no_show' && booking.status !== 'completed' && (
                            <button
                              onClick={() => handleRecordNoShow(booking)}
                              className="px-2.5 py-1.5 rounded-lg bg-orange-950/70 hover:bg-orange-900 border border-orange-500/40 text-orange-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="تسجيل عدم الحضور (تغيبان = حظر تلقائي)"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>تغيب (No-Show)</span>
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
                                !crmProfile?.isBanned ? 'حظر يدوي من التذكرة' : 'رفع الحظر يدوياً',
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
                                <span>رفع الحظر</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                <span>حظر</span>
                              </>
                            )}
                          </button>

                          {booking.status !== 'rejected' && (
                            <button
                              onClick={() => handleReject(booking.id)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              رفض الطلب
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
                <span>ماسح QR الزبناء والتذاكر</span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Switch Camera Button (Toggles between environment and user) */}
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-blue-300 hover:text-white text-xs font-semibold flex items-center gap-1 border border-zinc-700 transition-colors cursor-pointer"
                  title="Changer de caméra (Arrière / Avant)"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{cameraFacingMode === 'environment' ? 'خلفية 🔄' : 'أمامية 🔄'}</span>
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
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setScannerActionMode('tracking')}
                className={`py-2 px-2 rounded-lg transition-colors cursor-pointer ${
                  scannerActionMode === 'tracking'
                    ? 'bg-amber-500 text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                فتح تتبع الزبون (Tracking)
              </button>
              <button
                type="button"
                onClick={() => setScannerActionMode('filter')}
                className={`py-2 px-2 rounded-lg transition-colors cursor-pointer ${
                  scannerActionMode === 'filter'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                تصفية قائمة الإدارة
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
                <span>رفع صورة QR من الجهاز</span>
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
                تبديل الكاميرا
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

      {/* Reschedule Dialog Modal */}
      {reschedulingBooking && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-white text-base">
              تعديل الموعد المقترح لـ {reschedulingBooking.clientName}
            </h3>
            
            <form onSubmit={handleSaveReschedule} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">التاريخ الجديد :</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">التوقيت الجديد :</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">رسالة توضيحية للزبون :</label>
                <input
                  type="text"
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                  placeholder="مثال: تم تأخير الموعد بـ 30 دقيقة لتفادي الانتظار بالصالون..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReschedulingBooking(null)}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  تحديث وإشعار الزبون
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
                <div className="font-bold text-emerald-400">إيصال تحويل CIH Bank — {previewReceipt.ticketNumber}</div>
                <div className="text-zinc-400 font-mono text-[11px]">{previewReceipt.clientName} • {previewReceipt.fileName}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
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

    </div>
  );
};
