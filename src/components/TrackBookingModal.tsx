import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Ticket, 
  Phone, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Clock3, 
  XCircle, 
  Sparkles,
  MessageCircle,
  Copy,
  Scissors,
  RefreshCw,
  Camera,
  Bell,
  Upload,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  FileCheck,
  History,
  Award,
  Star,
  Gift
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useLanguage } from '../context/LanguageContext';
import { 
  subscribeToBookings,
  getAllBookings,
  findBookingsUniversal,
  normalizeMoroccanPhoneDigits,
  clientRescheduleResponse,
  cancelClientBooking,
  updateBookingCihReceipt
} from '../utils/bookingStore';
import { useCrmClients, getCrmDocId } from '../utils/crmStore';
import { computeLoyaltyProgress, getVerifiedVisitsCount } from '../utils/loyaltyEngine';
import { rememberTrackedTicket } from '../utils/clientReminderWatcher';
import { 
  requestWebNotificationPermission, 
  sendDualAlert 
} from '../utils/notifications';
import { buildClientTicketWhatsAppMessage } from '../utils/whatsappAutomation';
import { CIH_BANK_DETAILS, processCihReceiptFile } from '../utils/cihReceipt';
import { CihBankLogo } from './CihBankLogo';
import { AppointmentBooking, BookingStatus } from '../types';
import { SALON_INFO } from '../data/barbershopData';

interface TrackBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSearch?: string;
}

export const TrackBookingModal: React.FC<TrackBookingModalProps> = ({
  isOpen,
  onClose,
  initialSearch = '',
}) => {
  const { lang, t, isRtl } = useLanguage();
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [foundBookings, setFoundBookings] = useState<AppointmentBooking[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState<string | null>(null);

  // Live bookings array synced in real time via Firestore onSnapshot
  const [liveBookings, setLiveBookings] = useState<AppointmentBooking[]>(() => getAllBookings());
  const [isSyncingFirestore, setIsSyncingFirestore] = useState<boolean>(true);
  const crmClientsMap = useCrmClients();

  // Client QR Scanner state
  const [isClientScannerOpen, setIsClientScannerOpen] = useState(false);
  const [clientScannerError, setClientScannerError] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<NotificationPermission>('default');

  // Post-booking CIH Payment & Receipt Upload state
  const [expandedCihId, setExpandedCihId] = useState<string | null>(null);
  const [copiedCihField, setCopiedCihField] = useState<'holder' | 'account' | null>(null);
  const [uploadingCihId, setUploadingCihId] = useState<string | null>(null);
  const [cihUploadError, setCihUploadError] = useState<string | null>(null);
  const [showLoyaltyHistoryLog, setShowLoyaltyHistoryLog] = useState<boolean>(true);
  const [showFullHistoryArchive, setShowFullHistoryArchive] = useState<boolean>(true);

  const performSearch = (query: string, source: AppointmentBooking[] = liveBookings) => {
    let q = query.trim();
    if (q.toLowerCase().includes('track=')) {
      const extracted = q.split(/track=/i)[1]?.split('&')[0] || '';
      try {
        q = decodeURIComponent(extracted).trim();
      } catch {
        q = extracted.trim();
      }
    }
    if (!q) {
      setFoundBookings(source.length > 0 ? [source[0]] : []);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    const matches = findBookingsUniversal(q, source);
    setFoundBookings(matches);
    if (matches.length > 0) {
      rememberTrackedTicket(matches[0].ticketNumber, matches[0].clientPhone);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialSearch) {
        setSearchTerm(initialSearch);
      } else {
        setHasSearched(false);
      }
    }
  }, [isOpen, initialSearch]);

  // Real-time Firestore synchronization via onSnapshot whenever modal is open
  useEffect(() => {
    if (!isOpen) return;
    setIsSyncingFirestore(true);

    const unsubscribe = subscribeToBookings(
      (snapshotBookings) => {
        setLiveBookings(snapshotBookings);
        setIsSyncingFirestore(false);
      },
      (error) => {
        console.error('TrackBookingModal Firestore stream error:', error);
        setIsSyncingFirestore(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  // Re-evaluate displayed results whenever live Firestore bookings or searchTerm update
  useEffect(() => {
    if (!isOpen) return;
    if (searchTerm.trim()) {
      performSearch(searchTerm, liveBookings);
    } else {
      setFoundBookings(liveBookings.length > 0 ? [liveBookings[0]] : []);
      setHasSearched(false);
    }
  }, [isOpen, liveBookings, searchTerm]);

  // Notification permission check on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifStatus(Notification.permission);
    }
  }, [isOpen]);

  const handleEnableNotifications = async () => {
    const perm = await requestWebNotificationPermission();
    setNotifStatus(perm);
    if (perm === 'granted') {
      sendDualAlert(
        lang === 'ar' ? 'تم تفعيل الإشعارات بنجاح • صالون بومليك' : 'Notifications Activées • Salon Boumlik',
        {
          body: lang === 'ar' 
            ? 'ستصلك تنبيهات صوتية فورية بأي تحديث بخصوص موعدك وتجهيز الكرسي.'
            : 'Vous recevrez des alertes sonores pour les mises à jour de votre créneau.',
          type: 'success',
        }
      );
    }
  };

  const handleOpenClientScanner = async () => {
    setClientScannerError(null);
    setIsClientScannerOpen(true);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err: any) {
        console.warn('Camera permission check note:', err);
      }
    }
  };

  // Decode uploaded QR code image using Html5Qrcode.scanFile
  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Create off-screen scanner instance for file decoding
      const html5Qr = new Html5Qrcode('qr-temp-scanner-hidden');
      const decodedText = await html5Qr.scanFile(file, true);
      
      let ticket = decodedText.trim();
      if (decodedText.includes('track=')) {
        ticket = decodeURIComponent(decodedText.split('track=')[1].split('&')[0]).trim();
      }

      setSearchTerm(ticket);
      performSearch(ticket);
      sendDualAlert(
        lang === 'ar' ? 'تم مسح صورة الـ QR بنجاح!' : 'QR Code analysé avec succès !',
        {
          body: `${lang === 'ar' ? 'تم استخراج التذكرة:' : 'Ticket:'} ${ticket}`,
          type: 'success',
        }
      );
    } catch (err: any) {
      console.error('Error scanning uploaded QR image:', err);
      const errMsg = lang === 'ar'
        ? 'لم يتم العثور على رمز QR صالح في الصورة المرفوعة. تأكد من وضوح الصورة.'
        : 'Impossible de lire le code QR sur cette image. Veuillez réessayer.';
      alert(errMsg);
    } finally {
      // Reset input value so same file can be chosen again if needed
      if (e.target) e.target.value = '';
    }
  };

  // Client QR Scanner lifecycle using html5-qrcode strictly with facingMode: "environment"
  useEffect(() => {
    if (!isClientScannerOpen) return;

    let html5Qr: Html5Qrcode | null = null;
    let isStopped = false;

    const timer = setTimeout(async () => {
      try {
        const container = document.getElementById('client-qr-reader-container');
        if (!container) return;

        html5Qr = new Html5Qrcode('client-qr-reader-container');

        const config = {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        };

        await html5Qr.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isStopped) return;
            isStopped = true;
            let ticket = decodedText.trim();
            if (decodedText.includes('track=')) {
              ticket = decodeURIComponent(decodedText.split('track=')[1].split('&')[0]).trim();
            }
            setSearchTerm(ticket);
            performSearch(ticket);
            if (html5Qr && html5Qr.isScanning) {
              html5Qr.stop().then(() => html5Qr?.clear()).catch(console.error);
            }
            setIsClientScannerOpen(false);
          },
          () => {
            // frame scanning noise, ignore
          }
        );
      } catch (err: any) {
        console.error('Html5Qrcode client scanner error:', err);
        setClientScannerError(
          err?.message || (lang === 'ar' ? 'تعذر فتح الكاميرا. يرجى السماح بالإذن في المتصفح.' : 'Impossible d’accéder à la caméra.')
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
  }, [isClientScannerOpen, lang]);

  if (!isOpen) return null;

  const handleCopy = (ticket: string) => {
    navigator.clipboard.writeText(ticket);
    setCopiedTicket(ticket);
    setTimeout(() => setCopiedTicket(null), 2000);
  };

  const handleCopyCihDetail = (field: 'holder' | 'account', value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedCihField(field);
    setTimeout(() => setCopiedCihField(null), 2000);
  };

  const handlePostBookingCihUpload = async (
    bookingId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCihUploadError(null);
    setUploadingCihId(bookingId);

    try {
      const processed = await processCihReceiptFile(file);
      await updateBookingCihReceipt(bookingId, processed);
      sendDualAlert(
        lang === 'ar' ? 'تم رفع إيصال CIH وحفظه بنجاح ✅' : 'Reçu CIH envoyé avec succès ✅',
        {
          body: lang === 'ar'
            ? 'تم ربط الإيصال بتذكرتك وظهوره مباشرة في لوحة الصالون.'
            : 'Votre reçu est maintenant visible instantanément par le salon.',
          type: 'success',
        }
      );
    } catch (err) {
      console.error('Post-booking CIH receipt upload failed:', err);
      setCihUploadError(
        lang === 'ar'
          ? 'تعذر حفظ الإيصال حالياً. يرجى المحاولة مرة أخرى.'
          : 'Impossible d’enregistrer le reçu pour le moment.'
      );
      sendDualAlert(
        lang === 'ar' ? 'تعذر رفع الإيصال' : 'Erreur d’envoi du reçu',
        {
          body: lang === 'ar' ? 'يرجى التحقق من الاتصال والمحاولة مجدداً.' : 'Veuillez réessayer.',
          type: 'warning',
        }
      );
    } finally {
      setUploadingCihId(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleClientRescheduleDecision = async (bookingId: string, accepted: boolean) => {
    try {
      await clientRescheduleResponse(bookingId, accepted);
      if (accepted) {
        sendDualAlert(
          lang === 'ar' ? 'تم قبول الموعد الجديد وقفل الكرسي ✅' : 'Nouvel horaire accepté ✅',
          {
            body: lang === 'ar' ? 'تم تأكيد موعدك بالتوقيت الجديد بنجاح في صالون بومليك.' : 'Votre créneau est confirmé avec succès.',
            type: 'success',
          }
        );
      } else {
        sendDualAlert(
          lang === 'ar' ? 'تم رفض الموعد وتحرير الوقت' : 'Rendez-vous annulé',
          {
            body: lang === 'ar' ? 'تم إلغاء الموعد وتحرير الكرسي لزبائن آخرين.' : 'Le créneau a été libéré.',
            type: 'warning',
          }
        );
      }
    } catch (err) {
      console.error('Failed to respond to reschedule:', err);
      sendDualAlert(
        lang === 'ar' ? 'تعذر تحديث الموعد' : 'Erreur de mise à jour',
        {
          body: lang === 'ar' ? 'يرجى المحاولة مرة أخرى.' : 'Veuillez réessayer.',
          type: 'warning',
        }
      );
    }
  };

  const handleClientCancel = async (booking: AppointmentBooking) => {
    const confirmMsg = lang === 'ar'
      ? 'هل أنت متأكد من رغبتك في إلغاء هذا الموعد وتحرير الوقت لزبون آخر؟'
      : 'Êtes-vous sûr de vouloir annuler ce rendez-vous ?';
    if (window.confirm(confirmMsg)) {
      try {
        await cancelClientBooking(booking.id, 'قام الزبون بإلغاء الموعد عبر صفحة التتبع.');
      } catch (err) {
        console.error('Failed to cancel booking:', err);
        sendDualAlert(
          lang === 'ar' ? 'تعذر إلغاء الموعد' : 'Erreur d’annulation',
          {
            body: lang === 'ar' ? 'يرجى المحاولة مرة أخرى.' : 'Veuillez réessayer.',
            type: 'warning',
          }
        );
      }
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/20 border border-emerald-400/50 text-emerald-300 font-bold text-xs">
            <Award className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'تمت الخدمة بنجاح ✓' : lang === 'es' ? 'Servicio completado ✓' : 'Prestation Terminée ✓'}
            </span>
          </div>
        );
      case 'confirmed':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'تم تأكيد وقبول الموعد' : lang === 'es' ? 'Reserva confirmada' : 'Rendez-vous Confirmé'}
            </span>
          </div>
        );
      case 'rescheduled':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold text-xs animate-pulse">
            <Clock3 className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'اقتراح توقيت جديد (بانتظار موافقتك)' : lang === 'es' ? 'Nuevo horario propuesto' : 'Hora Réaménagée (En attente)'}
            </span>
          </div>
        );
      case 'no_show':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-300 font-bold text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'تغيب عن الموعد (No-Show)' : 'Absence (No-Show)'}
            </span>
          </div>
        );
      case 'cancelled':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold text-xs">
            <XCircle className="w-3.5 h-3.5 text-zinc-500" />
            <span>
              {lang === 'ar' ? 'موعد ملغى وتم تحرير الكرسي' : lang === 'es' ? 'Cita cancelada' : 'Rendez-vous Annulé'}
            </span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-xs">
            <XCircle className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'الموعد غير متاح' : lang === 'es' ? 'Cita cancelada/no disponible' : 'Demande Non Disponible'}
            </span>
          </div>
        );
      case 'pending':
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'قيد المراجعة وتجهيز الكرسي' : lang === 'es' ? 'Pendiente de confirmación' : 'En Attente de Validation'}
            </span>
          </div>
        );
    }
  };

  // CRM Archive calculation for the matched client phone (strictly verified completed visits for Loyalty!)
  const primaryMatchedBooking = foundBookings[0];
  const primaryClientDigits = primaryMatchedBooking
    ? normalizeMoroccanPhoneDigits(primaryMatchedBooking.clientPhone)
    : '';
  const crmClientProfile =
    primaryClientDigits.length >= 4
      ? crmClientsMap[getCrmDocId(primaryMatchedBooking!.clientPhone)]
      : undefined;
  const fullClientCrmHistory =
    primaryClientDigits.length >= 4
      ? liveBookings
          .filter((b) => normalizeMoroccanPhoneDigits(b.clientPhone) === primaryClientDigits)
          .sort((a, b) =>
            b.date === a.date
              ? b.timeSlot.localeCompare(a.timeSlot)
              : b.date.localeCompare(a.date)
          )
      : [];

  // Completed visits ordered oldest->newest for accurate visit numbering (#1, #2, ..., #5, #10...)
  const completedVisitsChronological = [...fullClientCrmHistory]
    .filter((b) => b.status === 'completed')
    .sort((a, b) => {
      const timeA = a.attendanceConfirmedAt || `${a.date}T${a.timeSlot}:00`;
      const timeB = b.attendanceConfirmedAt || `${b.date}T${b.timeSlot}:00`;
      return timeA.localeCompare(timeB);
    });
  const loyaltyHistoryEntries = completedVisitsChronological
    .map((booking, idx) => ({
      visitNumber: idx + 1,
      booking,
    }))
    .reverse(); // Newest completed visit first for display

  // Fallback CRM match when searched by phone or CRM ID (`c_...`) with 0 booking documents
  const cleanSearchTrimmed = searchTerm.trim();
  const searchedCrmFallback =
    !primaryMatchedBooking && hasSearched && cleanSearchTrimmed
      ? crmClientsMap[cleanSearchTrimmed] ||
        crmClientsMap[getCrmDocId(cleanSearchTrimmed)] ||
        Object.values(crmClientsMap).find((c) => {
          const searchNorm = normalizeMoroccanPhoneDigits(
            cleanSearchTrimmed.toLowerCase().startsWith('c_')
              ? cleanSearchTrimmed.slice(2)
              : cleanSearchTrimmed
          );
          return searchNorm.length >= 6 && c.normalizedPhone === searchNorm;
        })
      : undefined;

  const activeCrmProfile = crmClientProfile || searchedCrmFallback;
  const verifiedVisitsTotal = primaryMatchedBooking
    ? getVerifiedVisitsCount(fullClientCrmHistory, activeCrmProfile)
    : activeCrmProfile?.verifiedVisits ?? 0;
  const loyaltyProgress = computeLoyaltyProgress(verifiedVisitsTotal, lang);

  const ui = {
    title: {
      fr: 'Suivi de Votre Réservation en Temps Réel',
      ar: 'تتبع موعدك وحالة الحجز مباشرة',
      en: 'Real-Time Appointment Tracking',
      amz: 'ⵜⵉⴹⴰⴼ ⵏ ⵓⵙⵔⵓⵙ ⵏⵏⴽ',
      es: 'Seguimiento de tu reserva en tiempo real',
    }[lang] || 'Suivi de Réservation',
    subtitle: {
      fr: 'Entrez votre numéro de ticket (ex: #SB-1024) ou votre numéro de téléphone',
      ar: 'أدخل رقم التذكرة (مثل: #SB-1024) أو رقم هاتفك لمعرفة الحالة الحالية',
      en: 'Enter your ticket number (e.g., #SB-1024) or phone number to view live status',
      amz: 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⴽⵉ ⵏⵖ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ',
      es: 'Introduce tu número de ticket (ej: #SB-1024) o tu teléfono',
    }[lang] || 'Entrez votre numéro de ticket',
    placeholder: {
      fr: 'Rechercher par #SB-XXXX ou Téléphone...',
      ar: 'ابحث برقم التذكرة أو رقم الهاتف...',
      en: 'Search by #SB-XXXX or Phone...',
      amz: 'ⵔⵣⵓ ⵙ #SB-XXXX ⵏⵖ ⵜⵉⵍⵉⴼⵓⵏ...',
      es: 'Buscar por #SB-XXXX o teléfono...',
    }[lang] || 'Rechercher...',
    searchBtn: {
      fr: 'Vérifier',
      ar: 'تحقق الآن',
      en: 'Check Status',
      amz: 'ⵥⵕ',
      es: 'Comprobar',
    }[lang] || 'Vérifier',
    noResults: {
      fr: 'Aucune réservation trouvée pour cette recherche.',
      ar: 'لم يتم العثور على أي حجز مطابق. تأكد من رقم التذكرة أو رقم الهاتف.',
      en: 'No booking found matching your search.',
      amz: 'ⵓⵔ ⵉⵍⵍⵉ ⵓⵙⵔⵓⵙ ⵙ ⵓⵟⵟⵓⵏ ⴰⴷ.',
      es: 'No se encontró ninguna reserva para esta búsqueda.',
    }[lang] || 'Aucune réservation trouvée.',
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8">
        
        {/* Header with barber pole top line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-white to-blue-600" />
        
        <div className="p-6 border-b border-zinc-800 flex items-start justify-between bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400">
              <Ticket className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">{ui.title}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">{ui.subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Client-Side QR Scanner Button */}
        <div className="p-6 pb-2">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              performSearch(searchTerm);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={ui.placeholder}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Camera Scanner Button */}
              <button
                type="button"
                onClick={handleOpenClientScanner}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-blue-300 hover:text-white font-bold text-xs rounded-xl border border-zinc-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                title="Scanner le QR code du ticket avec la caméra"
              >
                <Camera className="w-4 h-4 text-blue-400" />
                <span>{lang === 'ar' ? 'مسح الكاميرا' : lang === 'es' ? 'Cámara QR' : 'Scanner Caméra'}</span>
              </button>

              {/* Upload QR Image File Button */}
              <label 
                className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-white font-bold text-xs rounded-xl border border-zinc-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                title="Charger une image ou capture d'écran du QR code"
              >
                <Upload className="w-4 h-4 text-amber-400" />
                <span>{lang === 'ar' ? 'تحميل صورة QR' : lang === 'es' ? 'Subir imagen QR' : 'Uploader Image QR'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrImageUpload}
                  className="hidden"
                />
              </label>

              {/* Submit Search Button */}
              <button
                type="submit"
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{ui.searchBtn}</span>
              </button>
            </div>
          </form>

          {/* Hidden container for off-screen QR file scanning */}
          <div id="qr-temp-scanner-hidden" className="hidden" aria-hidden="true" />

          {/* Quick Notification Permission Bell Button for Client */}
          <div className="mt-2.5 flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px]">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'ar' ? 'تفعيل رنين وإشعارات الموعد في المتصفح' : 'Alertes sonores & notifications'}</span>
            </span>
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bell className="w-3 h-3 text-amber-400" />
              <span>{notifStatus === 'granted' ? (lang === 'ar' ? 'الإشعارات مفعلة ✓' : 'Activé ✓') : (lang === 'ar' ? '🔔 تفعيل الإشعارات' : '🔔 Activer')}</span>
            </button>
          </div>
        </div>

        {/* Client QR Scanner Modal Dialog (Strictly facingMode: environment) */}
        {isClientScannerOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4 text-center">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span>{lang === 'ar' ? 'مسح رمز التذكرة بالكاميرا' : 'Scanner le ticket QR'}</span>
                </div>

                <button 
                  onClick={() => setIsClientScannerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {clientScannerError && (
                <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
                  {clientScannerError}
                </div>
              )}

              <div 
                id="client-qr-reader-container" 
                className="w-full rounded-xl overflow-hidden bg-black min-h-[260px] border border-zinc-800" 
              />

              <div className="text-[11px] text-zinc-400">
                <span>{lang === 'ar' ? 'قم بتوجيه الكاميرا الخلفية نحو رمز الـ QR للتذكرة' : 'Visez le QR code avec votre caméra arrière'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="p-6 pt-3 space-y-4 max-h-[60vh] overflow-y-auto">
          {isSyncingFirestore && foundBookings.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-xs">
              <RefreshCw className="w-7 h-7 text-amber-400 mx-auto mb-2 animate-spin" />
              <p>{lang === 'ar' ? 'جاري جلب التذاكر من السحابة...' : 'Synchronisation en cours...'}</p>
            </div>
          ) : foundBookings.length === 0 && hasSearched && searchedCrmFallback ? (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/12 via-zinc-900/95 to-zinc-900 border border-amber-500/35 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-white flex items-center gap-2">
                    <span>{searchedCrmFallback.clientName}</span>
                    {searchedCrmFallback.isVip && (
                      <span className="text-amber-300 text-xs font-bold">· 👑 VIP</span>
                    )}
                  </div>
                  <div dir="ltr" className="text-zinc-400 font-mono mt-0.5">
                    {searchedCrmFallback.phoneDisplay || searchedCrmFallback.normalizedPhone}
                  </div>
                </div>
                <div className="font-mono font-black text-amber-400 text-base tabular-nums">
                  {loyaltyProgress.verifiedVisits} / {loyaltyProgress.nextMilestone}
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full bg-black/70 border border-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${loyaltyProgress.progressPercent}%` }}
                />
              </div>
              <p className="text-zinc-400">
                {lang === 'ar'
                  ? 'تم التعرف على ملف الزبون بنجاح في برنامج الولاء (لا توجد حجوزات نشطة حالياً).'
                  : 'Profil client reconnu dans le programme de fidélité (aucune réservation active).'}
              </p>
            </div>
          ) : foundBookings.length === 0 && hasSearched ? (
            <div className="text-center py-8 text-zinc-400 text-xs">
              <AlertCircle className="w-8 h-8 text-amber-500/80 mx-auto mb-2" />
              <p>{ui.noResults}</p>
            </div>
          ) : (
            <>
              {/* Multi-Tier Verified Loyalty Program Card (5, 10, 15...) */}
              {primaryMatchedBooking && primaryClientDigits.length >= 4 && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/12 via-zinc-900/95 to-zinc-900 border border-amber-500/35 space-y-3.5 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center flex-shrink-0 text-amber-400">
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                          <span>
                            {lang === 'ar'
                              ? 'برنامج الولاء والمكافآت'
                              : lang === 'en'
                              ? 'Loyalty Program'
                              : lang === 'es'
                              ? 'Programa de Fidelidad'
                              : 'Programme de Fidélité'}
                          </span>
                          {crmClientProfile?.isVip && (
                            <span className="text-[11px] font-bold text-amber-300">· 👑 VIP</span>
                          )}
                        </h3>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {lang === 'ar'
                            ? `زيارات مؤكدة بالحضور: ${loyaltyProgress.verifiedVisits} · المستوى ${loyaltyProgress.currentTierNumber}`
                            : lang === 'en'
                            ? `Verified visits: ${loyaltyProgress.verifiedVisits} · Tier ${loyaltyProgress.currentTierNumber}`
                            : lang === 'es'
                            ? `Visitas confirmadas: ${loyaltyProgress.verifiedVisits} · Nivel ${loyaltyProgress.currentTierNumber}`
                            : `Visites confirmées : ${loyaltyProgress.verifiedVisits} · Palier ${loyaltyProgress.currentTierNumber}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1 font-mono tabular-nums">
                      <span className="text-lg font-black text-amber-400">
                        {loyaltyProgress.verifiedVisits}
                      </span>
                      <span className="text-xs text-zinc-500 font-bold">
                        / {loyaltyProgress.nextMilestone}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Multi-Tier Milestone Stepper (5 -> 10 -> 15 -> ...) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {loyaltyProgress.tiers.map((tier) => (
                      <div
                        key={tier.targetVisits}
                        className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
                          tier.unlocked
                            ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                            : tier.isCurrentTarget
                            ? 'bg-amber-500/15 border-amber-400/60 text-amber-300'
                            : 'bg-black/40 border-zinc-800 text-zinc-500'
                        }`}
                      >
                        <span className="font-mono font-black tabular-nums">
                          {tier.unlocked ? `${tier.targetVisits}/${tier.targetVisits}✓` : `${tier.targetVisits}`}
                        </span>
                        <span className="truncate max-w-[140px]">{tier.rewardTitle}</span>
                      </div>
                    ))}
                  </div>

                  {/* Active 5-Step Bracket Track toward Next Milestone */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono tabular-nums">
                      <span>
                        {lang === 'ar'
                          ? `المرحلة الحالية (${loyaltyProgress.previousMilestone} ← ${loyaltyProgress.nextMilestone})`
                          : `Palier actuel (${loyaltyProgress.previousMilestone} → ${loyaltyProgress.nextMilestone})`}
                      </span>
                      <span className="text-amber-300 font-bold">
                        {loyaltyProgress.stepsInCurrentBracket} / 5
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden flex justify-start">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                        style={{
                          width: `${
                            loyaltyProgress.justUnlockedMilestone
                              ? 100
                              : Math.min(100, loyaltyProgress.progressPercent)
                          }%`,
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((stepOffset) => {
                        const absoluteVisitNum = loyaltyProgress.previousMilestone + stepOffset;
                        const activeFilledCount = loyaltyProgress.justUnlockedMilestone
                          ? 5
                          : loyaltyProgress.stepsInCurrentBracket;
                        const isEarned = stepOffset <= activeFilledCount;
                        const isRewardStep = stepOffset === 5;
                        const stampNumber = loyaltyProgress.justUnlockedMilestone
                          ? loyaltyProgress.justUnlockedMilestone - 5 + stepOffset
                          : absoluteVisitNum;

                        return (
                          <div
                            key={stepOffset}
                            className={`py-1.5 px-1 rounded-xl border text-center flex flex-col items-center justify-center gap-0.5 transition-colors ${
                              isEarned
                                ? isRewardStep
                                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                                  : 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                                : 'bg-black/40 border-zinc-800 text-zinc-500'
                            }`}
                          >
                            {isRewardStep ? (
                              <Gift className={`w-3.5 h-3.5 ${isEarned ? 'text-emerald-400' : 'text-zinc-500'}`} />
                            ) : isEarned ? (
                              <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />
                            ) : (
                              <Star className="w-3 h-3 text-zinc-600" />
                            )}
                            <span className="text-[10px] font-mono font-bold tabular-nums">
                              #{stampNumber}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Unlocked / Next Milestone Summary & Verification Note */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/80 text-[11px]">
                    {loyaltyProgress.justUnlockedMilestone && (
                      <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                        <Gift className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span>
                          {lang === 'ar'
                            ? `مبروك! أكملت ${loyaltyProgress.justUnlockedMilestone} زيارات (${loyaltyProgress.justUnlockedRewardTitle}) — هدفك القادم: ${loyaltyProgress.nextMilestone}!`
                            : lang === 'en'
                            ? `Congrats! ${loyaltyProgress.justUnlockedMilestone} visits reached (${loyaltyProgress.justUnlockedRewardTitle}) — Next target: ${loyaltyProgress.nextMilestone}!`
                            : `Félicitations ! ${loyaltyProgress.justUnlockedMilestone} visites atteintes (${loyaltyProgress.justUnlockedRewardTitle}) — Prochain palier : ${loyaltyProgress.nextMilestone} !`}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-zinc-300 font-medium">
                        {lang === 'ar'
                          ? `متبقي ${loyaltyProgress.visitsRemaining} ${loyaltyProgress.visitsRemaining === 1 ? 'زيارة مؤكدة واحدة' : 'زيارات مؤكدة'} نحو مكافأة ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`
                          : lang === 'en'
                          ? `${loyaltyProgress.visitsRemaining} verified visit(s) away from ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`
                          : `Plus que ${loyaltyProgress.visitsRemaining} visite(s) confirmée(s) avant le palier ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`}
                      </span>

                      {(crmClientProfile?.customDiscountMAD ?? 0) > 0 && (
                        <span className="font-mono font-bold text-amber-300 tabular-nums">
                          {lang === 'ar'
                            ? `خصم نشط: -${crmClientProfile?.customDiscountMAD} MAD`
                            : `Remise active : -${crmClientProfile?.customDiscountMAD} MAD`}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-zinc-500">
                      {lang === 'ar'
                        ? 'ملاحظة: تُحتسب نقاط الولاء تلقائياً فقط عند تأكيد حضورك في الصالون.'
                        : lang === 'en'
                        ? 'Note: Points are credited strictly after admin attendance confirmation at the salon.'
                        : 'Note : Les points sont validés uniquement après confirmation de votre présence au salon.'}
                    </p>
                  </div>

                  {crmClientProfile?.rewardNote && (
                    <div className="text-[11px] text-emerald-300 font-semibold">
                      {crmClientProfile.rewardNote}
                    </div>
                  )}

                  {/* Dedicated Loyalty History Log (Every Confirmed Attended Visit) */}
                  <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowLoyaltyHistoryLog((prev) => !prev)}
                      className="w-full flex items-center justify-between gap-2 text-left rtl:text-right cursor-pointer"
                    >
                      <span className="text-[11px] font-black text-white flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {lang === 'ar'
                            ? `سجل نقاط الولاء والزيارات المؤكدة (${loyaltyHistoryEntries.length})`
                            : lang === 'en'
                            ? `Loyalty History (${loyaltyHistoryEntries.length} verified)`
                            : `Historique de Fidélité (${loyaltyHistoryEntries.length} validées)`}
                        </span>
                      </span>
                      {showLoyaltyHistoryLog ? (
                        <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                    </button>

                    {showLoyaltyHistoryLog && (
                      loyaltyHistoryEntries.length === 0 ? (
                        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800 text-[11px] text-zinc-400">
                          {lang === 'ar'
                            ? 'لا توجد زيارات مكتملة مسجلة بعد. سيظهر كل موعد مؤكد بالحضور هنا مع توقيت التوثيق.'
                            : lang === 'en'
                            ? 'No completed visits logged yet. Once your barber confirms attendance, your timestamped history appears here.'
                            : 'Aucune visite confirmée enregistrée pour le moment. Votre historique horodaté apparaîtra après votre passage.'}
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {loyaltyHistoryEntries.map(({ visitNumber, booking: visit }) => {
                            const isMilestoneVisit = visitNumber % 5 === 0;
                            const confirmedDateText = visit.attendanceConfirmedAt
                              ? new Date(visit.attendanceConfirmedAt).toLocaleString(
                                  lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-GB' : 'fr-FR',
                                  {
                                    year: 'numeric',
                                    month: 'short',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )
                              : `${visit.date} • ${visit.timeSlot}`;
                            const serviceLabels =
                              (visit.cartItemsSummary || []).map((i) => i.name).join(' + ') ||
                              'Prestation Salon';

                            return (
                              <div
                                key={`loyalty-log-${visit.id}`}
                                className={`p-2.5 rounded-xl border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                                  isMilestoneVisit
                                    ? 'bg-emerald-950/35 border-emerald-500/45'
                                    : 'bg-black/45 border-zinc-800/80'
                                }`}
                              >
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <span
                                    className={`px-2 py-0.5 rounded-lg font-mono font-black text-[10px] tabular-nums flex-shrink-0 ${
                                      isMilestoneVisit
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    }`}
                                  >
                                    #{visitNumber}{isMilestoneVisit ? ' 🏆' : ''}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-white truncate">
                                      {serviceLabels}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 flex flex-wrap items-center gap-2 font-mono tabular-nums">
                                      <span>{visit.ticketNumber}</span>
                                      <span>•</span>
                                      <span>{visit.barberName}</span>
                                      <span>•</span>
                                      <span dir="ltr">{confirmedDateText}</span>
                                    </div>
                                  </div>
                                </div>

                                <span className="font-mono font-bold text-emerald-400 text-[11px] tabular-nums flex-shrink-0">
                                  +1 pt · {visit.finalTotalMAD ?? 0} MAD
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {foundBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-4 hover:border-zinc-700 transition-all shadow-lg"
              >
                {/* Top card bar: Ticket & Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: booking.barberColor || '#D97706' }}
                    />
                    <span className="font-mono text-base font-black text-white tracking-wider">
                      {booking.ticketNumber}
                    </span>
                    <button
                      onClick={() => handleCopy(booking.ticketNumber)}
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors text-xs flex items-center gap-1"
                      title="Copier le ticket"
                    >
                      {copiedTicket === booking.ticketNumber ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {getStatusBadge(booking.status)}
                </div>

                {/* Reschedule alert banner with explicit Client Acceptance / Rejection */}
                {booking.status === 'rescheduled' && booking.rescheduledTo && (
                  <div className="p-4 bg-blue-950/50 border border-blue-500/50 rounded-xl text-xs space-y-3">
                    <div className="flex items-start gap-2">
                      <Clock3 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-bold text-blue-300 block text-xs">
                          {lang === 'ar' 
                            ? '🔔 اقترح الحلاق توقيتاً جديداً لموعدك:' 
                            : lang === 'es'
                            ? '🔔 El barbero ha propuesto un nuevo horario:'
                            : '🔔 Le barbier propose un nouvel horaire :'}
                        </span>
                        <p className="font-mono text-sm font-black text-amber-300 mt-1">
                          📅 {booking.rescheduledTo.date} • ⏰ {booking.rescheduledTo.time}
                        </p>
                        <p className="text-[11px] text-zinc-300 mt-1">
                          {lang === 'ar'
                            ? 'يرجى قبول التوقيت الجديد لتأكيد الموعد وقفل المقعد، أو الرفض لتحرير الكرسي.'
                            : lang === 'es'
                            ? 'Por favor acepte el nuevo horario para confirmar la cita o rechace para liberar el turno.'
                            : 'Veuillez accepter le nouvel horaire pour confirmer le créneau ou refuser pour libérer la place.'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleClientRescheduleDecision(booking.id, true)}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'قبول الوقت الجديد' : lang === 'es' ? 'Aceptar nuevo horario' : 'Accepter l\'horaire'}</span>
                      </button>

                      <button
                        onClick={() => handleClientRescheduleDecision(booking.id, false)}
                        className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-950 transition-all cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'رفض وإلغاء الموعد' : lang === 'es' ? 'Rechazar y cancelar' : 'Refuser & Annuler'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Staff Note from Dashboard (Visible to Client) */}
                {booking.adminNotes && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300 text-[11px]">
                      <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === 'ar' ? 'ملاحظة خاصة من الحلاق:' : 'Message de confirmation du Barbier :'}</span>
                    </div>
                    <p className="text-xs text-zinc-200 font-medium leading-relaxed italic">
                      "{booking.adminNotes}"
                    </p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {lang === 'ar' ? 'الزبون' : 'Client'}
                    </span>
                    <span className="font-bold text-white truncate block">{booking.clientName}</span>
                    <span dir="ltr" className="text-[11px] font-mono text-zinc-400 block">{booking.clientPhone}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {lang === 'ar' ? 'الحلاق المختار' : 'Barbier Assigné'}
                    </span>
                    <span className="font-bold text-red-400 truncate block">{booking.barberName}</span>
                    <span className="text-[11px] text-zinc-400 block">{lang === 'ar' ? 'كرسي خاص' : 'Fauteuil réservé'}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {lang === 'ar' ? 'التاريخ المجدول' : 'Date de passage'}
                    </span>
                    <span className="font-mono font-bold text-white block">{booking.date}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {lang === 'ar' ? 'التوقيت المختار' : 'Heure de Passage'}
                    </span>
                    <span className="font-mono font-bold text-blue-400 block">{booking.timeSlot}</span>
                  </div>
                </div>

                {/* Cart summary */}
                <div className="p-3 bg-black/50 rounded-xl border border-zinc-800/80 space-y-2 text-xs">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                    {lang === 'ar' ? 'الخدمات المحجوزة' : 'Prestations Demandées'}
                  </span>
                  <div className="space-y-1">
                    {(booking.cartItemsSummary || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-zinc-300">
                        <span>• {item.name} {item.discountApplied ? <span className="text-[10px] text-emerald-400">({item.discountApplied})</span> : null}</span>
                        <span className="font-mono font-bold text-white">{item.finalPrice} MAD</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex justify-between items-center font-bold">
                    <span className="text-zinc-300">{lang === 'ar' ? 'المجموع النهائي:' : 'Montant Total :'}</span>
                    <div className="text-right">
                      {(booking.totalSavingsMAD || 0) > 0 && (
                        <span className="text-[10px] text-emerald-400 block font-normal">
                          {lang === 'ar' ? `وفّرت: ${booking.totalSavingsMAD} MAD` : `Économie : ${booking.totalSavingsMAD} MAD`}
                        </span>
                      )}
                      <span className="text-base text-red-500 font-black font-mono">
                        {booking.finalTotalMAD ?? 0} MAD
                      </span>
                    </div>
                  </div>
                  {booking.clientNotes && (
                    <div className="mt-2 pt-2 border-t border-zinc-800 text-[11px] text-amber-200/95 space-y-0.5">
                      <span className="text-[10px] text-amber-400 font-bold uppercase block">
                        {lang === 'ar'
                          ? 'ملاحظات الزبون وتفضيلات الحلاقة:'
                          : lang === 'en'
                          ? 'Client Notes & Grooming Preferences:'
                          : 'Notes Client & Préférences :'}
                      </span>
                      <p className="text-zinc-200 leading-relaxed break-words">
                        {booking.clientNotes}
                      </p>
                    </div>
                  )}
                  {booking.cihReceiptName && (
                    <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between gap-2 text-[11px] text-emerald-300">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{lang === 'ar' ? 'إيصال تحويل CIH مرفق:' : 'Reçu virement CIH joint :'}</span>
                      </span>
                      <span className="font-mono text-zinc-200 truncate max-w-[160px]">{booking.cihReceiptName}</span>
                    </div>
                  )}
                </div>

                {/* Post-Booking CIH Payment Info & Receipt Upload (Expandable) */}
                <div className="rounded-xl bg-black/50 border border-zinc-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCihId((prev) => (prev === booking.id ? null : booking.id))
                    }
                    className="w-full p-3 flex items-center justify-between gap-2 text-left rtl:text-right hover:bg-zinc-900/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CihBankLogo className="w-7 h-7" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">
                          {lang === 'ar'
                            ? 'معلومات الأداء البنكي ورفع إيصال CIH'
                            : lang === 'en'
                            ? 'CIH Bank Info & Receipt Upload'
                            : 'Infos Bancaires CIH & Envoi du Reçu'}
                        </span>
                        <span className="text-[10px] text-zinc-400 block truncate">
                          {booking.cihReceiptName
                            ? (lang === 'ar' ? 'تم إرفاق الإيصال — اضغط للتحديث' : 'Reçu joint — Appuyez pour modifier')
                            : (lang === 'ar' ? 'اضغط لعرض رقم الحساب أو رفع الإيصال بعد الحجز' : 'Voir le compte CIH ou envoyer votre reçu')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {booking.cihReceiptName && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                          ✓
                        </span>
                      )}
                      {expandedCihId === booking.id ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  </button>

                  {expandedCihId === booking.id && (
                    <div className="p-3.5 pt-2 border-t border-zinc-800/80 space-y-3 bg-zinc-950/70 text-xs">
                      <div className="flex items-center gap-2.5">
                        <CihBankLogo className="w-10 h-10" />
                        <div>
                          <div className="font-black text-white text-xs">CIH Bank — Salon Boumlik</div>
                          <div className="text-[11px] text-emerald-300/90 leading-relaxed">
                            {lang === 'ar'
                              ? 'التحويل البنكي CIH (اختياري) - مستحسن لتأكيد الموعد مسبقاً دون الحاجة للتنقل للمحل'
                              : lang === 'en'
                              ? 'CIH transfer (optional) — recommended to confirm in advance without visiting the salon.'
                              : 'Virement CIH (optionnel) — recommandé pour confirmer à l’avance sans vous déplacer au salon.'}
                          </div>
                        </div>
                      </div>

                      {/* Account Holder + Account Number with Copy Buttons */}
                      <div className="p-3 rounded-xl bg-black/70 border border-zinc-800 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-zinc-400 font-semibold text-[11px]">Titulaire :</span>
                          <div className="flex items-center gap-2">
                            <span dir="ltr" className="font-mono font-black text-white text-xs">
                              {CIH_BANK_DETAILS.accountHolder}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCihDetail('holder', CIH_BANK_DETAILS.accountHolder)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                copiedCihField === 'holder'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                              }`}
                            >
                              {copiedCihField === 'holder' ? (
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

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                          <span className="text-zinc-400 font-semibold text-[11px]">
                            {lang === 'ar' ? 'رقم الحساب :' : 'رقم الحساب / N° Compte :'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span dir="ltr" className="font-mono font-black text-amber-300 tracking-wider text-xs sm:text-sm">
                              {CIH_BANK_DETAILS.accountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCihDetail('account', CIH_BANK_DETAILS.accountNumber)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                copiedCihField === 'account'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                              }`}
                            >
                              {copiedCihField === 'account' ? (
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

                      {booking.cihReceiptPreview && (
                        <div className="rounded-xl overflow-hidden border border-emerald-500/30 bg-black p-2 text-center space-y-1.5">
                          <img
                            src={booking.cihReceiptPreview}
                            alt={booking.cihReceiptName || 'CIH Receipt'}
                            className="max-h-36 mx-auto rounded-lg object-contain"
                          />
                          <div className="text-[10px] font-mono text-emerald-300 truncate">
                            {booking.cihReceiptName}
                          </div>
                        </div>
                      )}

                      {cihUploadError && (
                        <div className="p-2 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-[11px]">
                          {cihUploadError}
                        </div>
                      )}

                      <label
                        className={`w-full py-2.5 px-3.5 rounded-xl border border-dashed border-emerald-500/60 text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                          uploadingCihId === booking.id
                            ? 'bg-zinc-900 text-zinc-400 cursor-wait'
                            : 'bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-300 cursor-pointer'
                        }`}
                      >
                        {uploadingCihId === booking.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                            <span>{lang === 'ar' ? 'جاري رفع ومزامنة الإيصال...' : 'Envoi vers le salon...'}</span>
                          </>
                        ) : booking.cihReceiptName ? (
                          <>
                            <FileCheck className="w-4 h-4 text-emerald-400" />
                            <span>
                              {lang === 'ar'
                                ? 'تحديث أو استبدال إيصال CIH (.jpg, .png, .pdf)'
                                : 'Mettre à jour le reçu CIH (.jpg, .png, .pdf)'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-emerald-400" />
                            <span>
                              {lang === 'ar'
                                ? 'رفع إيصال التحويل CIH (.jpg, .png, .pdf)'
                                : 'Envoyer le reçu CIH (.jpg, .png, .pdf)'}
                            </span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          disabled={uploadingCihId === booking.id}
                          onChange={(e) => handlePostBookingCihUpload(booking.id, e)}
                          className="hidden"
                        />
                      </label>

                      <a
                        href={`https://wa.me/${SALON_INFO.whatsappNumber}?text=${encodeURIComponent(
                          lang === 'ar'
                            ? `مرحباً صالون بومليك، هذا إيصال التحويل البنكي عبر CIH لتأكيد تذكرتي ${booking.ticketNumber} (${booking.clientName} - ${booking.date} الساعة ${booking.timeSlot}).`
                            : `Bonjour Salon Boumlik, voici mon reçu CIH pour confirmer le ticket ${booking.ticketNumber} (${booking.clientName} - ${booking.date} à ${booking.timeSlot}).`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'ar'
                            ? 'أو إرسال الإيصال عبر واتساب الصالون مباشرة'
                            : 'Ou envoyer le reçu sur WhatsApp'}
                        </span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Direct Help Button & Client-Side Cancellation Action */}
                <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <a
                    href={`https://wa.me/${SALON_INFO.whatsappNumber}?text=${encodeURIComponent(
                      buildClientTicketWhatsAppMessage(booking, lang)
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تواصل معنا واتساب حول التذكرة' : 'Contacter le Salon par WhatsApp'}</span>
                  </a>

                  {booking.status !== 'cancelled' && booking.status !== 'rejected' && booking.status !== 'completed' && (
                    <button
                      onClick={() => handleClientCancel(booking)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-red-950/60 border border-zinc-700 hover:border-red-600/50 text-zinc-300 hover:text-red-400 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                      <span>{lang === 'ar' ? 'إلغاء الموعد وتحرير الوقت' : lang === 'es' ? 'Cancelar cita' : 'Annuler le rendez-vous'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            </>
          )}

          {/* Full Past Booking History (CRM Archive) & Loyalty Progress Card */}
          {foundBookings.length > 0 && fullClientCrmHistory.length > 0 && (
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-amber-500/30 space-y-3 text-xs">
              <button
                type="button"
                onClick={() => setShowFullHistoryArchive((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 text-left rtl:text-right cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div>
                    <span className="font-black text-white block">
                      {lang === 'ar'
                        ? `سجل الحجوزات السابق والولاء (${fullClientCrmHistory.length})`
                        : `Historique Complet & Fidélité CRM (${fullClientCrmHistory.length})`}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {crmClientProfile?.isVip ? '👑 VIP • ' : ''}
                      {lang === 'ar'
                        ? `الزيارات المؤكدة: ${loyaltyProgress.verifiedVisits} (${loyaltyProgress.verifiedVisits}/${loyaltyProgress.nextMilestone})`
                        : `Visites confirmées : ${loyaltyProgress.verifiedVisits} (${loyaltyProgress.verifiedVisits}/${loyaltyProgress.nextMilestone})`}
                    </span>
                  </div>
                </div>
                {showFullHistoryArchive ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </button>

              {showFullHistoryArchive && (
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  {/* Chronological past/other bookings list */}
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {fullClientCrmHistory.map((hist) => (
                      <div
                        key={`hist-${hist.id}`}
                        className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: hist.barberColor || '#D97706' }}
                          />
                          <span className="font-mono font-bold text-white">{hist.ticketNumber}</span>
                          <span className="text-zinc-400 font-mono">
                            {hist.date} • {hist.timeSlot}
                          </span>
                          <span className="text-zinc-300 truncate">{hist.barberName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-300">
                            {hist.finalTotalMAD ?? 0} MAD
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-semibold">
                            {hist.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
            <span>{lang === 'ar' ? 'التحديث التلقائي الفوري مفعّل' : 'Synchronisation directe avec le salon'}</span>
          </span>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
          >
            {lang === 'ar' ? 'إغلاق' : 'Fermer'}
          </button>
        </div>

      </div>
    </div>
  );
};
