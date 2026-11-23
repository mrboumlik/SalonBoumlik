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
  Gift,
  Coins,
  QrCode,
  ScanLine
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import { useLanguage } from '../context/LanguageContext';
import { buildBookingCheckInQrPayload, parseScannedQrResult } from '../utils/clientQr';
import { 
  subscribeToBookings,
  getAllBookings,
  findBookingsUniversal,
  normalizeMoroccanPhoneDigits,
  clientRescheduleResponse,
  cancelClientBooking,
  updateBookingCihReceipt
} from '../utils/bookingStore';
import { useCrmClients, getCrmDocId, redeemLoyaltyPointsForDiscount } from '../utils/crmStore';
import {
  computeLoyaltyProgress,
  computeClientPointsSummary,
  getVerifiedVisitsCount,
  LOYALTY_POINT_TIERS,
  LoyaltyPointRewardTier,
} from '../utils/loyaltyEngine';
import { rememberTrackedTicket } from '../utils/clientReminderWatcher';
import { 
  requestWebNotificationPermission, 
  sendDualAlert,
  showToast,
  playNotificationSound
} from '../utils/notifications';
import { registerClientPushSubscription } from '../utils/webPushClient';
import { buildClientTicketWhatsAppMessage } from '../utils/whatsappAutomation';
import { CIH_BANK_DETAILS, processCihReceiptFile } from '../utils/cihReceipt';
import { CihBankLogo } from './CihBankLogo';
import { LoyaltyProgressCard } from './LoyaltyProgressCard';
import { AppointmentBooking, BookingStatus, Language } from '../types';
import { SALON_INFO } from '../data/barbershopData';
import { pickLang } from '../utils/i18n';
import { getGiftLabel } from '../utils/pricingEngine';
import {
  normalizeSalonWhatsappDigits,
  useSalonProfileSettings,
} from '../utils/salonSettingsStore';
import { submitBarberReview, useFirestoreReviews } from '../utils/reviewsStore';

interface TrackBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSearch?: string;
}

const CheckInQrPassBox: React.FC<{ booking: AppointmentBooking; lang: Language }> = ({
  booking,
  lang,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const payload = buildBookingCheckInQrPayload({
      ticketNumber: booking.ticketNumber,
      checkInToken: booking.checkInToken,
      clientPhone: booking.clientPhone,
    });
    QRCode.toDataURL(payload, {
      width: 200,
      margin: 1,
      color: { dark: '#09090B', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, [booking.ticketNumber, booking.checkInToken, booking.clientPhone]);

  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    return null;
  }

  return (
    <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/35 flex items-center justify-between gap-3">
      <div className="space-y-1 text-xs min-w-0">
        <div className="font-black text-emerald-300 flex items-center gap-1.5">
          <ScanLine className="w-4 h-4 shrink-0" />
          <span>
            {pickLang(lang, {
              ar: 'رمز الوصول السريع (Check-In QR)',
              fr: 'QR Code Check-In (Arrivée Rapide)',
              amz: 'ⴰⵙⵏⵉ ⵏ ⵓⴽⵛⵓⵎ (Check-In QR)',
              en: 'Fast Arrival Check-In QR',
              es: 'QR Check-In de Llegada Rápida',
            })}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          {booking.checkedInAt
            ? pickLang(lang, {
                ar: '✓ تم تسجيل وصولك بالصالون بنجاح!',
                fr: '✓ Arrivée enregistrée au salon !',
                amz: '✓ ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⴽⵛⵓⵎ ⵏⵏⴽ!',
                en: '✓ Your arrival has been checked in!',
                es: '✓ ¡Llegada registrada con éxito!',
              })
            : pickLang(lang, {
                ar: 'أظهر هذا الرمز للحلاق عند وصولك لتسجيل الحضور فوراً.',
                fr: 'Présentez ce QR au barbier à votre arrivée pour un check-in instantané.',
                amz: 'ⵙⵙⴽⵏ QR ⴰⴷ ⵉ ⵓⵎⴽⵕⴰⴹ ⵉⵖ ⵜⵍⴽⵎⴷ.',
                en: 'Show this QR code to your barber upon arrival for instant check-in.',
                es: 'Muestra este QR a tu barbero al llegar para registrarte al instante.',
              })}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {(booking.clientPhone || booking.checkInToken) && (
            <span dir="ltr" className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-amber-300">
              ID:{' '}
              {(() => {
                const digits = String(booking.clientPhone || '').replace(/\D/g, '');
                if (digits.startsWith('212') && digits.length >= 11) return `0${digits.slice(3)}`;
                if (digits.length === 9 && /^[567]/.test(digits)) return `0${digits}`;
                if (digits.length >= 6) return digits;
                return booking.checkInToken || '';
              })()}
            </span>
          )}
          {booking.checkedInAt && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold">
              {pickLang(lang, {
                ar: 'وصلت للصالون ✓',
                fr: 'Arrivé ✓',
                amz: 'ⵉⵍⴽⵎ ✓',
                en: 'Checked In ✓',
                es: 'Registrado ✓',
              })}
            </span>
          )}
        </div>
      </div>

      {qrUrl ? (
        <div className="p-1.5 bg-white rounded-xl shrink-0 shadow-md">
          <img src={qrUrl} alt={`Check-In QR ${booking.ticketNumber}`} className="w-20 h-20 block" />
        </div>
      ) : (
        <div className="w-20 h-20 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          <QrCode className="w-6 h-6 text-zinc-500" />
        </div>
      )}
    </div>
  );
};

export const TrackBookingModal: React.FC<TrackBookingModalProps> = ({
  isOpen,
  onClose,
  initialSearch = '',
}) => {
  const { lang, t, isRtl } = useLanguage();
  const salonSettings = useSalonProfileSettings();
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
  const [redeemingTierId, setRedeemingTierId] = useState<string | null>(null);
  const [redeemFeedback, setRedeemFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Post-visit quick rating state
  const { reviews: firestoreReviews } = useFirestoreReviews();
  const [quickRatingsMap, setQuickRatingsMap] = useState<Record<string, number>>({});
  const [quickCommentsMap, setQuickCommentsMap] = useState<Record<string, string>>({});
  const [submittingRatingBookingId, setSubmittingRatingBookingId] = useState<string | null>(null);

  const handleSubmitQuickRating = async (booking: AppointmentBooking) => {
    const ratingVal = quickRatingsMap[booking.id] || 5;
    const rawComment = (quickCommentsMap[booking.id] || '').trim();
    const defaultComment = pickLang(lang, {
      ar: `خدمة ممتازة مع ${booking.barberName} ⭐`,
      fr: `Très bon service avec ${booking.barberName} ⭐`,
      amz: `ⵜⴰⵡⵓⵔⵉ ⵉⵖⵓⴷⴰⵏ ⴷ ${booking.barberName} ⭐`,
      en: `Great experience with ${booking.barberName} ⭐`,
      es: `Excelente atención con ${booking.barberName} ⭐`,
    });
    const serviceLabel =
      (booking.cartItemsSummary || []).map((i) => i.name).join(' + ') || undefined;

    setSubmittingRatingBookingId(booking.id);
    try {
      await submitBarberReview({
        barberId: booking.barberId,
        author: booking.clientName || 'Client',
        serviceName: serviceLabel,
        rating: ratingVal,
        comment: rawComment || defaultComment,
        dateLabel: booking.date,
        bookingId: booking.id,
      });
      showToast(
        pickLang(lang, {
          ar: 'شكراً على تقييمك! ⭐',
          fr: 'Merci pour votre avis ! ⭐',
          amz: 'ⵜⴰⵏⵎⵎⵉⵔⵜ ⵖⴼ ⵓⵜⵉⴳ ⵏⵏⴽ! ⭐',
          en: 'Thank you for your feedback! ⭐',
          es: '¡Gracias por tu valoración! ⭐',
        }),
        pickLang(lang, {
          ar: 'تم حفظ تقييمك للحلاق بنجاح.',
          fr: 'Votre note a été enregistrée avec succès.',
          amz: 'ⵉⵜⵜⵓⵃⴹⴰ ⵓⵜⵉⴳ ⵏⵏⴽ.',
          en: 'Your rating has been saved.',
          es: 'Tu reseña se ha guardado correctamente.',
        }),
        'success'
      );
    } catch (err) {
      console.error('Quick post-visit rating failed:', err);
    } finally {
      setSubmittingRatingBookingId(null);
    }
  };

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
    const phone =
      foundBookings[0]?.clientPhone ||
      activeCrmProfile?.phoneDisplay ||
      activeCrmProfile?.normalizedPhone ||
      '';
    const name = foundBookings[0]?.clientName || activeCrmProfile?.clientName || 'Client';

    if (phone) {
      const result = await registerClientPushSubscription({
        clientPhone: phone,
        clientName: name,
        lang,
      });
      setNotifStatus(result.granted ? 'granted' : Notification.permission);
      if (result.granted) {
        playNotificationSound();
        showToast(
          pickLang(lang, {
            ar: 'تم تفعيل الإشعارات بنجاح • صالون بومليك',
            fr: 'Notifications Activées • Salon Boumlik',
            amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵕⵥⵎⵏ • Salon Boumlik',
            en: 'Notifications Enabled • Salon Boumlik',
            es: 'Notificaciones Activadas • Salon Boumlik',
          }),
          pickLang(lang, {
            ar: 'ستصلك تنبيهات موثوقة عند تأكيد الموعد، تعديل التوقيت، أو تحديث نقاط الولاء.',
            fr: 'Vous recevrez des alertes fiables pour vos confirmations, horaires et points.',
            amz: 'ⴰⴷ ⵜⴰⵎⵥⴷ ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵉⵙⵉⵀⴰⵍⵏ ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵏⵏⴽ.',
            en: 'You will receive live alerts for confirmations, reschedules, and loyalty points.',
            es: 'Recibirás alertas en vivo de confirmaciones, cambios y puntos.',
          }),
          'success'
        );
      }
      return;
    }

    const perm = await requestWebNotificationPermission();
    setNotifStatus(perm);
    if (perm === 'granted') {
      playNotificationSound();
      showToast(
        pickLang(lang, {
          ar: 'تم تفعيل الإشعارات بنجاح • صالون بومليك',
          fr: 'Notifications Activées • Salon Boumlik',
          amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵕⵥⵎⵏ • Salon Boumlik',
          en: 'Notifications Enabled • Salon Boumlik',
          es: 'Notificaciones Activadas • Salon Boumlik',
        }),
        pickLang(lang, {
          ar: 'ستصلك تنبيهات موثوقة بأي تحديث بخصوص موعدك وتجهيز الكرسي.',
          fr: 'Vous recevrez des alertes fiables pour les mises à jour de votre créneau.',
          amz: 'ⴰⴷ ⵜⴰⵎⵥⴷ ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵙⵉⵀⵍ ⵏⵏⴽ.',
          en: 'You will receive real-time updates for your booking status.',
          es: 'Recibirás actualizaciones de tu cita en tiempo real.',
        }),
        'success'
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
      const parsed = parseScannedQrResult(decodedText);
      const ticket = parsed.query || decodedText.trim();

      setSearchTerm(ticket);
      performSearch(ticket);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم مسح صورة الـ QR بنجاح!',
          fr: 'QR Code analysé avec succès !',
          amz: 'ⵉⵜⵜⵓⵙⴽⴰⵏⴰ ⵓⵏⴳⴰⵍ QR!',
          en: 'QR Code scanned successfully!',
          es: '¡Código QR escaneado con éxito!',
        }),
        {
          body: `${pickLang(lang, {
            ar: 'تم استخراج التذكرة:',
            fr: 'Ticket :',
            amz: 'ⵜⵉⴽⵉ:',
            en: 'Ticket:',
            es: 'Ticket:',
          })} ${ticket}`,
          type: 'success',
        }
      );
    } catch (err: any) {
      console.error('Error scanning uploaded QR image:', err);
      const errMsg = pickLang(lang, {
        ar: 'لم يتم العثور على رمز QR صالح في الصورة المرفوعة. تأكد من وضوح الصورة.',
        fr: 'Impossible de lire le code QR sur cette image. Veuillez réessayer.',
        amz: 'ⵓⵔ ⵉⵜⵜⵢⴰⴼⴰ ⵓⵏⴳⴰⵍ QR ⵉⵖⵓⴷⴰⵏ ⴳ ⵜⵡⵍⴰⴼⵜ ⴰⴷ.',
        en: 'No valid QR code found in the uploaded image. Please check image clarity.',
        es: 'No se encontró un código QR válido en la imagen.',
      });
      showToast(
        pickLang(lang, {
          ar: 'تعذر قراءة رمز QR',
          fr: 'Lecture QR impossible',
          amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵖⵔ QR',
          en: 'Unable to read QR code',
          es: 'No se pudo leer el QR',
        }),
        errMsg,
        'warning'
      );
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
            const parsed = parseScannedQrResult(decodedText);
            const ticket = parsed.query || decodedText.trim();
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
          err?.message ||
            pickLang(lang, {
              ar: 'تعذر فتح الكاميرا. يرجى السماح بالإذن في المتصفح.',
              fr: 'Impossible d’accéder à la caméra.',
              amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵕⵥⵎ ⵜⴰⴽⴰⵎⵉⵔⴰ.',
              en: 'Unable to open camera. Please allow camera permission.',
              es: 'No se pudo abrir la cámara. Permite el acceso en el navegador.',
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
        pickLang(lang, {
          ar: 'تم رفع إيصال CIH وحفظه بنجاح ✅',
          fr: 'Reçu CIH envoyé avec succès ✅',
          amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵙⵉⵍⵖ ⵏ CIH ✅',
          en: 'CIH Receipt Uploaded Successfully ✅',
          es: 'Recibo CIH subido con éxito ✅',
        }),
        {
          body: pickLang(lang, {
            ar: 'تم ربط الإيصال بتذكرتك وظهوره مباشرة في لوحة الصالون.',
            fr: 'Votre reçu est maintenant visible instantanément par le salon.',
            amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⴳ ⵜⴼⵍⵡⵉⵜ ⵏ ⵓⵙⴰⵍⵓⵏ.',
            en: 'Your receipt is now visible on the salon dashboard.',
            es: 'Tu recibo ya es visible en el panel del salón.',
          }),
          type: 'success',
        }
      );
    } catch (err) {
      console.error('Post-booking CIH receipt upload failed:', err);
      setCihUploadError(
        pickLang(lang, {
          ar: 'تعذر حفظ الإيصال حالياً. يرجى المحاولة مرة أخرى.',
          fr: 'Impossible d’enregistrer le reçu pour le moment.',
          amz: 'ⵓⵔ ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵙⵉⵍⵖ ⵖⵉⵍⴰⴷ.',
          en: 'Could not save the receipt right now. Please try again.',
          es: 'No se pudo guardar el recibo ahora. Inténtalo de nuevo.',
        })
      );
      sendDualAlert(
        pickLang(lang, {
          ar: 'تعذر رفع الإيصال',
          fr: 'Erreur d’envoi du reçu',
          amz: 'ⴰⵣⴳⴰⵍ ⴳ ⵓⵙⵉⵍⵖ',
          en: 'Receipt upload failed',
          es: 'Error al subir recibo',
        }),
        {
          body: pickLang(lang, {
            ar: 'يرجى التحقق من الاتصال والمحاولة مجدداً.',
            fr: 'Veuillez réessayer.',
            amz: 'ⴰⵔⵎ ⵜⵉⴽⴽⵍⵜ ⵢⴰⴹⵏ.',
            en: 'Please check your connection and try again.',
            es: 'Verifica tu conexión e inténtalo de nuevo.',
          }),
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
          pickLang(lang, {
            ar: 'تم قبول الموعد الجديد وقفل الكرسي ✅',
            fr: 'Nouvel horaire accepté ✅',
            amz: 'ⴰⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ ⵉⵜⵜⵓⵙⵙⴷⴰ ✅',
            en: 'New Time Accepted ✅',
            es: 'Nuevo horario aceptado ✅',
          }),
          {
            body: pickLang(lang, {
              ar: 'تم تأكيد موعدك بالتوقيت الجديد بنجاح في صالون بومليك.',
              fr: 'Votre créneau est confirmé avec succès.',
              amz: 'ⴰⵙⵉⵀⵍ ⵏⵏⴽ ⵉⵜⵜⵓⵙⵙⴷⴰ ⴳ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ.',
              en: 'Your booking is confirmed at Salon Boumlik.',
              es: 'Tu cita está confirmada en Salon Boumlik.',
            }),
            type: 'success',
          }
        );
      } else {
        sendDualAlert(
          pickLang(lang, {
            ar: 'تم رفض الموعد وتحرير الوقت',
            fr: 'Rendez-vous annulé',
            amz: 'ⴰⵙⵉⵀⵍ ⵉⵜⵜⵓⵙⵔ',
            en: 'Booking Declined & Released',
            es: 'Cita rechazada y cancelada',
          }),
          {
            body: pickLang(lang, {
              ar: 'تم إلغاء الموعد وتحرير الكرسي لزبائن آخرين.',
              fr: 'Le créneau a été libéré.',
              amz: 'ⴰⴽⵓⴷ ⵉⵜⵜⵓⵙⵍⵍⵉ ⵉ ⵉⵎⵙⴰⵖⵏ ⵢⴰⴹⵏ.',
              en: 'The slot has been released for other clients.',
              es: 'El turno ha sido liberado.',
            }),
            type: 'warning',
          }
        );
      }
    } catch (err) {
      console.error('Failed to respond to reschedule:', err);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تعذر تحديث الموعد',
          fr: 'Erreur de mise à jour',
          amz: 'ⴰⵣⴳⴰⵍ ⴳ ⵓⵙⴷⵖⵉ',
          en: 'Update failed',
          es: 'Error al actualizar',
        }),
        {
          body: pickLang(lang, {
            ar: 'يرجى المحاولة مرة أخرى.',
            fr: 'Veuillez réessayer.',
            amz: 'ⴰⵔⵎ ⵜⵉⴽⴽⵍⵜ ⵢⴰⴹⵏ.',
            en: 'Please try again.',
            es: 'Inténtalo de nuevo.',
          }),
          type: 'warning',
        }
      );
    }
  };

  const handleClientCancel = async (booking: AppointmentBooking) => {
    const confirmMsg = pickLang(lang, {
      ar: 'هل أنت متأكد من رغبتك في إلغاء هذا الموعد وتحرير الوقت لزبون آخر؟',
      fr: 'Êtes-vous sûr de vouloir annuler ce rendez-vous ?',
      amz: 'ⵉⵙ ⵜⵔⵉⴷ ⴰⴷ ⵜⵙⵔⴷ ⴰⵙⵉⵀⵍ ⴰⴷ?',
      en: 'Are you sure you want to cancel this appointment?',
      es: '¿Seguro que deseas cancelar esta cita?',
    });
    if (window.confirm(confirmMsg)) {
      try {
        await cancelClientBooking(
          booking.id,
          pickLang(lang, {
            ar: 'قام الزبون بإلغاء الموعد عبر صفحة التتبع.',
            fr: 'Annulé par le client depuis la page de suivi.',
            amz: 'ⵉⵙⵔ ⵓⵎⵙⴰⵖ ⴰⵙⵉⵀⵍ ⵙⴳ ⵜⴼⵍⵡⵉⵜ ⵏ ⵓⴹⴼⴰⵕ.',
            en: 'Cancelled by client from the booking tracker.',
            es: 'Cancelado por el cliente desde el seguimiento.',
          })
        );
      } catch (err) {
        console.error('Failed to cancel booking:', err);
        sendDualAlert(
          pickLang(lang, {
            ar: 'تعذر إلغاء الموعد',
            fr: 'Erreur d’annulation',
            amz: 'ⴰⵣⴳⴰⵍ ⴳ ⵓⵙⵔ',
            en: 'Cancellation failed',
            es: 'Error al cancelar',
          }),
          {
            body: pickLang(lang, {
              ar: 'يرجى المحاولة مرة أخرى.',
              fr: 'Veuillez réessayer.',
              amz: 'ⴰⵔⵎ ⵜⵉⴽⴽⵍⵜ ⵢⴰⴹⵏ.',
              en: 'Please try again.',
              es: 'Inténtalo de nuevo.',
            }),
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
              {pickLang(lang, {
                ar: 'تمت الخدمة بنجاح ✓',
                fr: 'Prestation Terminée ✓',
                amz: 'ⵜⴰⵡⵓⵔⵉ ⵜⵎⴷⴰ ✓',
                en: 'Service Completed ✓',
                es: 'Servicio completado ✓',
              })}
            </span>
          </div>
        );
      case 'confirmed':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'تم تأكيد وقبول الموعد',
                fr: 'Rendez-vous Confirmé',
                amz: 'ⴰⵙⵉⵀⵍ ⵉⵜⵜⵓⵙⵙⴷⴰ',
                en: 'Booking Confirmed',
                es: 'Reserva confirmada',
              })}
            </span>
          </div>
        );
      case 'rescheduled':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold text-xs animate-pulse">
            <Clock3 className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'اقتراح توقيت جديد (بانتظار موافقتك)',
                fr: 'Horaire Réaménagé (En attente)',
                amz: 'ⴰⵙⵙⵓⵎⵔ ⵏ ⵓⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ',
                en: 'New Time Proposed (Pending)',
                es: 'Nuevo horario propuesto',
              })}
            </span>
          </div>
        );
      case 'no_show':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-300 font-bold text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'تغيب عن الموعد (No-Show)',
                fr: 'Absence (No-Show)',
                amz: 'ⵓⵔ ⵉⴷⴷⵉ (No-Show)',
                en: 'Missed (No-Show)',
                es: 'Ausencia (No-Show)',
              })}
            </span>
          </div>
        );
      case 'cancelled':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold text-xs">
            <XCircle className="w-3.5 h-3.5 text-zinc-500" />
            <span>
              {pickLang(lang, {
                ar: 'موعد ملغى وتم تحرير الكرسي',
                fr: 'Rendez-vous Annulé',
                amz: 'ⴰⵙⵉⵀⵍ ⵉⵜⵜⵓⵙⵔ',
                en: 'Appointment Cancelled',
                es: 'Cita cancelada',
              })}
            </span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-xs">
            <XCircle className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'الموعد غير متاح',
                fr: 'Demande Non Disponible',
                amz: 'ⴰⴽⵓⴷ ⵓⵔ ⵉⵍⵍⵉ',
                en: 'Slot Unavailable',
                es: 'No disponible',
              })}
            </span>
          </div>
        );
      case 'flexible_pending':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-400/40 text-purple-300 font-bold text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'وقت مرن — الحلاق يختار لك أفضل توقيت متاح',
                fr: 'Horaire flexible — Le barbier attribue votre créneau',
                amz: 'ⴰⴽⵓⴷ ⴰⵍⴰⵡⴰⵏ — ⴰⵎⴽⵕⴰⴹ ⴰⴷ ⵉⴼⵔⵏ',
                en: 'Flexible Time — Barber Assigning Optimal Slot',
                es: 'Horario flexible — Asignación del barbero',
              })}
            </span>
          </div>
        );
      case 'pending':
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {pickLang(lang, {
                ar: 'قيد المراجعة وتجهيز الكرسي',
                fr: 'En Attente de Validation',
                amz: 'ⴳ ⵓⵎⵏⵉⴷ ⵏ ⵓⵙⵙⴷⵓ',
                en: 'Pending Confirmation',
                es: 'Pendiente de confirmación',
              })}
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
  const pointsSummary = computeClientPointsSummary(verifiedVisitsTotal, activeCrmProfile);

  const profilePhone =
    primaryMatchedBooking?.clientPhone ||
    activeCrmProfile?.phoneDisplay ||
    activeCrmProfile?.normalizedPhone ||
    '';
  const profileName =
    primaryMatchedBooking?.clientName || activeCrmProfile?.clientName || 'Client';

  const handleRedeemPointsTier = async (tier: LoyaltyPointRewardTier) => {
    if (!profilePhone || pointsSummary.pointsBalance < tier.pointsCost || redeemingTierId) {
      return;
    }
    setRedeemingTierId(tier.id);
    setRedeemFeedback(null);
    try {
      const langKey: 'ar' | 'fr' | 'en' | 'es' =
        lang === 'ar' || lang === 'en' || lang === 'es' ? lang : 'fr';
      await redeemLoyaltyPointsForDiscount({
        phone: profilePhone,
        clientName: profileName,
        pointsCost: tier.pointsCost,
        discountMAD: tier.discountMAD,
        label: `🎟️ ${tier.label[langKey]} (-${tier.discountMAD} MAD) · ${tier.pointsCost} pts`,
        verifiedVisits: verifiedVisitsTotal,
        crmMap: crmClientsMap,
      });
      setRedeemFeedback({
        type: 'success',
        message: pickLang(lang, {
          ar: `تم استبدال ${tier.pointsCost} نقطة بنجاح! خصم -${tier.discountMAD} MAD جاهز وسيُطبق تلقائياً في حجزك القادم.`,
          fr: `${tier.pointsCost} pts échangés ! Une remise de -${tier.discountMAD} MAD s'appliquera à votre prochaine réservation.`,
          amz: `ⵙⵏⴼⵍⵏ ${tier.pointsCost} ⵏ ⵜⵏⵇⵇⵉⴹⵉⵏ! ⴰⵙⵙⵏⵇⵙ -${tier.discountMAD} MAD ⵉⵀⵢⵢⴰ ⵉ ⵓⵙⵉⵀⵍ ⵉⴷⴷⴰⵏ.`,
          en: `Redeemed ${tier.pointsCost} pts! -${tier.discountMAD} MAD discount is now active for your next booking.`,
          es: `¡Canjeados ${tier.pointsCost} pts! Descuento de -${tier.discountMAD} MAD activo para tu próxima reserva.`,
        }),
      });
    } catch (err: any) {
      setRedeemFeedback({
        type: 'error',
        message:
          err?.message ||
          pickLang(lang, {
            ar: 'تعذر استبدال النقاط حالياً.',
            fr: 'Échec de l’échange.',
            amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵙⵏⴼⵍ ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵖⵉⵍⴰ.',
            en: 'Unable to redeem points right now.',
            es: 'No se pudieron canjear los puntos ahora.',
          }),
      });
    } finally {
      setRedeemingTierId(null);
    }
  };

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
                <span>
                  {pickLang(lang, {
                    ar: 'مسح الكاميرا',
                    fr: 'Scanner Caméra',
                    amz: 'ⴰⵙⴽⴰⵏⵉ ⵙ ⵜⴽⴰⵎⵉⵔⴰ',
                    en: 'Camera Scan',
                    es: 'Cámara QR',
                  })}
                </span>
              </button>

              {/* Upload QR Image File Button */}
              <label 
                className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-white font-bold text-xs rounded-xl border border-zinc-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-amber-400" />
                <span>
                  {pickLang(lang, {
                    ar: 'تحميل صورة QR',
                    fr: 'Uploader Image QR',
                    amz: 'ⵙⵙⴽⵛⵎ ⵜⴰⵡⵍⴰⴼⵜ QR',
                    en: 'Upload QR Image',
                    es: 'Subir imagen QR',
                  })}
                </span>
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
              <span>
                {pickLang(lang, {
                  ar: 'تفعيل رنين وإشعارات الموعد في المتصفح',
                  fr: 'Alertes sonores & notifications',
                  amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵙⵉⵀⵍ',
                  en: 'Browser sound & push alerts',
                  es: 'Alertas y notificaciones',
                })}
              </span>
            </span>
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Bell className="w-3 h-3 text-amber-400" />
              <span>
                {notifStatus === 'granted'
                  ? pickLang(lang, {
                      ar: 'الإشعارات مفعلة ✓',
                      fr: 'Activé ✓',
                      amz: 'ⵉⵕⵥⵎ ✓',
                      en: 'Enabled ✓',
                      es: 'Activado ✓',
                    })
                  : pickLang(lang, {
                      ar: '🔔 تفعيل الإشعارات',
                      fr: '🔔 Activer',
                      amz: '🔔 ⵕⵥⵎ',
                      en: '🔔 Enable',
                      es: '🔔 Activar',
                    })}
              </span>
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
                  <span>
                    {pickLang(lang, {
                      ar: 'مسح رمز التذكرة بالكاميرا',
                      fr: 'Scanner le ticket QR',
                      amz: 'ⴰⵙⴽⴰⵏⵉ ⵏ QR ⵙ ⵜⴽⴰⵎⵉⵔⴰ',
                      en: 'Scan Ticket QR',
                      es: 'Escanear QR del ticket',
                    })}
                  </span>
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
                <span>
                  {pickLang(lang, {
                    ar: 'قم بتوجيه الكاميرا الخلفية نحو رمز الـ QR للتذكرة',
                    fr: 'Visez le QR code avec votre caméra arrière',
                    amz: 'ⵙⵙⵡⴰⵍⴰ ⵜⴰⴽⴰⵎⵉⵔⴰ ⵜⴰⵎⴰⴳⵓⵣⵜ ⵖⵔ ⵓⵏⴳⴰⵍ QR',
                    en: 'Point your rear camera at the ticket QR code',
                    es: 'Apunta la cámara trasera al código QR del ticket',
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="p-6 pt-3 space-y-4 max-h-[60vh] overflow-y-auto">
          {isSyncingFirestore && foundBookings.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-xs">
              <RefreshCw className="w-7 h-7 text-amber-400 mx-auto mb-2 animate-spin" />
              <p>
                {pickLang(lang, {
                  ar: 'جاري جلب التذاكر من السحابة...',
                  fr: 'Synchronisation en cours...',
                  amz: 'ⴰⵙⵎⵙⴰⵙⴰ ⵉⵍⵍⴰ ⴳ ⵜⵉⵍⴰⵡⵜ...',
                  en: 'Syncing bookings from cloud...',
                  es: 'Sincronizando reservas...',
                })}
              </p>
            </div>
          ) : foundBookings.length === 0 && hasSearched && searchedCrmFallback ? (
            <div className="space-y-4">
              <LoyaltyProgressCard
                clientName={searchedCrmFallback.clientName}
                crmProfile={searchedCrmFallback}
                loyaltyProgress={loyaltyProgress}
                pointsSummary={pointsSummary}
                lang={lang}
              />

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
                <p className="text-zinc-400">
                  {pickLang(lang, {
                    ar: 'تم التعرف على ملف الزبون بنجاح في برنامج الولاء (لا توجد حجوزات نشطة حالياً).',
                    fr: 'Profil client reconnu dans le programme de fidélité (aucune réservation active).',
                    amz: 'ⵉⵜⵜⵓⵙⵙⴰⵏ ⵓⴼⴰⵢⵍⵓ ⵏ ⵓⵎⵙⴰⵖ ⴳ ⵓⵖⴰⵡⴰⵙ ⵏ ⵜⵏⴼⵍⵓⵙⵜ (ⵓⵔ ⵍⵍⵉⵏ ⵉⵙⵉⵀⵍⵏ ⵖⵉⵍⴰ).',
                    en: 'Client profile recognized in Loyalty Program (no active bookings right now).',
                    es: 'Perfil de cliente reconocido en el programa de fidelidad (sin citas activas ahora).',
                  })}
                </p>

              {/* Loyalty Points Balance & Redeem Box inside CRM-only Profile */}
              <div className="pt-3 border-t border-zinc-800/80 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-black text-amber-300">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span>
                      {pickLang(lang, {
                        ar: 'نقاط الولاء والاستبدال بخصم',
                        fr: 'Points de Fidélité & Remises',
                        amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵏ ⵜⵏⴼⵍⵓⵙⵜ ⴷ ⵓⵙⵙⵏⵇⵙ',
                        en: 'Loyalty Points & Discounts',
                        es: 'Puntos de Fidelidad y Descuentos',
                      })}
                    </span>
                  </div>
                  <div className="font-mono font-black text-amber-400 text-sm tabular-nums">
                    {pointsSummary.pointsBalance} pts
                    <span className="text-[10px] text-zinc-400 font-normal ms-1.5">
                      (+{pointsSummary.pointsPerVisit}/
                      {pickLang(lang, {
                        ar: 'زيارة',
                        fr: 'visite',
                        amz: 'ⵜⵉⵔⵣⴰ',
                        en: 'visit',
                        es: 'visita',
                      })}
                      )
                    </span>
                  </div>
                </div>

                {pointsSummary.activeDiscountMAD > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold flex items-center justify-between">
                    <span>
                      {pickLang(lang, {
                        ar: 'رصيد خصم نشط للحجز القادم:',
                        fr: 'Crédit remise actif pour votre prochain RDV :',
                        amz: 'ⴰⵙⵙⵏⵇⵙ ⵉⵜⵜⵓⵕⵥⵎⵏ ⵉ ⵓⵙⵉⵀⵍ ⵉⴷⴷⴰⵏ:',
                        en: 'Active discount ready for next booking:',
                        es: 'Descuento activo para tu próxima cita:',
                      })}
                    </span>
                    <span className="font-mono font-black tabular-nums">-{pointsSummary.activeDiscountMAD} MAD</span>
                  </div>
                )}

                {redeemFeedback && (
                  <div
                    className={`p-2.5 rounded-xl border text-[11px] font-semibold ${
                      redeemFeedback.type === 'success'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-500/15 border-red-500/40 text-red-300'
                    }`}
                  >
                    {redeemFeedback.message}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {LOYALTY_POINT_TIERS.map((tier) => {
                    const canRedeem = pointsSummary.pointsBalance >= tier.pointsCost;
                    const isBusy = redeemingTierId === tier.id;
                    const langKey: 'ar' | 'fr' | 'en' | 'es' =
                      lang === 'ar' || lang === 'en' || lang === 'es' ? lang : 'fr';
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        disabled={!canRedeem || Boolean(redeemingTierId)}
                        onClick={() => handleRedeemPointsTier(tier)}
                        className={`p-2.5 rounded-xl border text-left rtl:text-right transition-all flex flex-col justify-between gap-1.5 ${
                          canRedeem
                            ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/50 text-white cursor-pointer'
                            : 'bg-black/40 border-zinc-800 text-zinc-500 opacity-70 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-black text-amber-300 text-[11px] tabular-nums">
                            {tier.pointsCost} pts
                          </span>
                          <span className="font-mono font-black text-emerald-400 text-[11px] tabular-nums">
                            -{tier.discountMAD} MAD
                          </span>
                        </div>
                        <div className="text-[10px] font-bold">
                          {isBusy
                            ? '...'
                            : canRedeem
                            ? pickLang(lang, {
                                ar: `استبدل الآن ← ${tier.label.ar}`,
                                fr: `Échanger ${tier.label[langKey]}`,
                                amz: `ⵙⵏⴼⵍ ${tier.label.fr}`,
                                en: `Redeem ${tier.label[langKey]}`,
                                es: `Canjear ${tier.label[langKey]}`,
                              })
                            : pickLang(lang, {
                                ar: `تحتاج ${tier.pointsCost - pointsSummary.pointsBalance} نقطة`,
                                fr: `${tier.pointsCost - pointsSummary.pointsBalance} pts manquants`,
                                amz: `ⵉⵅⵚⵚⴰ ⴽ ${tier.pointsCost - pointsSummary.pointsBalance} pts`,
                                en: `${tier.pointsCost - pointsSummary.pointsBalance} pts needed`,
                                es: `Faltan ${tier.pointsCost - pointsSummary.pointsBalance} pts`,
                              })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>
          ) : foundBookings.length === 0 && hasSearched ? (
            <div className="text-center py-8 text-zinc-400 text-xs">
              <AlertCircle className="w-8 h-8 text-amber-500/80 mx-auto mb-2" />
              <p>{ui.noResults}</p>
            </div>
          ) : (
            <>
              {/* Visual Circular Loyalty Progress Component + Multi-Tier Verified Loyalty Program */}
              {primaryMatchedBooking && primaryClientDigits.length >= 4 && (
                <>
                <LoyaltyProgressCard
                  clientName={primaryMatchedBooking.clientName}
                  crmProfile={crmClientProfile}
                  loyaltyProgress={loyaltyProgress}
                  pointsSummary={pointsSummary}
                  lang={lang}
                />
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/12 via-zinc-900/95 to-zinc-900 border border-amber-500/35 space-y-3.5 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center flex-shrink-0 text-amber-400">
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                          <span>
                            {pickLang(lang, {
                              ar: 'برنامج الولاء والمكافآت',
                              fr: 'Programme de Fidélité',
                              amz: 'ⴰⵖⴰⵡⴰⵙ ⵏ ⵜⵏⴼⵍⵓⵙⵜ',
                              en: 'Loyalty Program',
                              es: 'Programa de Fidelidad',
                            })}
                          </span>
                          {crmClientProfile?.isVip && (
                            <span className="text-[11px] font-bold text-amber-300">· 👑 VIP</span>
                          )}
                        </h3>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {pickLang(lang, {
                            ar: `زيارات مؤكدة بالحضور: ${loyaltyProgress.verifiedVisits} · المستوى ${loyaltyProgress.currentTierNumber}`,
                            fr: `Visites confirmées : ${loyaltyProgress.verifiedVisits} · Palier ${loyaltyProgress.currentTierNumber}`,
                            amz: `ⵜⵉⵔⵣⵉⵡⵉⵏ ⵉⵜⵜⵓⵙⵙⵏⵜⵎⵏ: ${loyaltyProgress.verifiedVisits} · ⴰⵙⵡⵉⵔ ${loyaltyProgress.currentTierNumber}`,
                            en: `Verified visits: ${loyaltyProgress.verifiedVisits} · Tier ${loyaltyProgress.currentTierNumber}`,
                            es: `Visitas confirmadas: ${loyaltyProgress.verifiedVisits} · Nivel ${loyaltyProgress.currentTierNumber}`,
                          })}
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
                        {pickLang(lang, {
                          ar: `المرحلة الحالية (${loyaltyProgress.previousMilestone} ← ${loyaltyProgress.nextMilestone})`,
                          fr: `Palier actuel (${loyaltyProgress.previousMilestone} → ${loyaltyProgress.nextMilestone})`,
                          amz: `ⴰⵙⵡⵉⵔ ⴰⵎⵉⵔⴰⵏ (${loyaltyProgress.previousMilestone} → ${loyaltyProgress.nextMilestone})`,
                          en: `Current stage (${loyaltyProgress.previousMilestone} → ${loyaltyProgress.nextMilestone})`,
                          es: `Tramo actual (${loyaltyProgress.previousMilestone} → ${loyaltyProgress.nextMilestone})`,
                        })}
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
                          {pickLang(lang, {
                            ar: `مبروك! أكملت ${loyaltyProgress.justUnlockedMilestone} زيارات (${loyaltyProgress.justUnlockedRewardTitle}) — هدفك القادم: ${loyaltyProgress.nextMilestone}!`,
                            fr: `Félicitations ! ${loyaltyProgress.justUnlockedMilestone} visites atteintes (${loyaltyProgress.justUnlockedRewardTitle}) — Prochain palier : ${loyaltyProgress.nextMilestone} !`,
                            amz: `ⴰⵢⵢⵓⵣ! ⵜⵍⴽⵎⵜ ${loyaltyProgress.justUnlockedMilestone} ⵏ ⵜⵔⵣⴰ (${loyaltyProgress.justUnlockedRewardTitle}) — ⴰⵙⵡⵉⵔ ⵉⴷⴷⴰⵏ: ${loyaltyProgress.nextMilestone}!`,
                            en: `Congrats! ${loyaltyProgress.justUnlockedMilestone} visits reached (${loyaltyProgress.justUnlockedRewardTitle}) — Next target: ${loyaltyProgress.nextMilestone}!`,
                            es: `¡Felicidades! ${loyaltyProgress.justUnlockedMilestone} visitas alcanzadas (${loyaltyProgress.justUnlockedRewardTitle}) — Siguiente objetivo: ${loyaltyProgress.nextMilestone}!`,
                          })}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-zinc-300 font-medium">
                        {pickLang(lang, {
                          ar: `متبقي ${loyaltyProgress.visitsRemaining} ${loyaltyProgress.visitsRemaining === 1 ? 'زيارة مؤكدة واحدة' : 'زيارات مؤكدة'} نحو مكافأة ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`,
                          fr: `Plus que ${loyaltyProgress.visitsRemaining} visite(s) confirmée(s) avant le palier ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`,
                          amz: `ⴰⵔ ⵉⵜⵜⴰⴳⴳⵯⴰ ${loyaltyProgress.visitsRemaining} ⵏ ⵜⵔⵣⴰ ⵉ ⵜⵙⵎⵖⵓⵔⵜ ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`,
                          en: `${loyaltyProgress.visitsRemaining} verified visit(s) away from ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`,
                          es: `Faltan ${loyaltyProgress.visitsRemaining} visita(s) confirmada(s) para ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`,
                        })}
                      </span>

                      {(crmClientProfile?.customDiscountMAD ?? 0) > 0 && (
                        <span className="font-mono font-bold text-amber-300 tabular-nums">
                          {pickLang(lang, {
                            ar: `خصم نشط: -${crmClientProfile?.customDiscountMAD} MAD`,
                            fr: `Remise active : -${crmClientProfile?.customDiscountMAD} MAD`,
                            amz: `ⴰⵙⵙⵏⵇⵙ ⵉⵕⵥⵎⵏ : -${crmClientProfile?.customDiscountMAD} MAD`,
                            en: `Active discount: -${crmClientProfile?.customDiscountMAD} MAD`,
                            es: `Descuento activo: -${crmClientProfile?.customDiscountMAD} MAD`,
                          })}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-zinc-500">
                      {pickLang(lang, {
                        ar: 'ملاحظة: تُحتسب نقاط الولاء تلقائياً فقط عند تأكيد حضورك في الصالون.',
                        fr: 'Note : Les points sont validés uniquement après confirmation de votre présence au salon.',
                        amz: 'ⵜⴰⵎⵍⴰⵢⵜ: ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵜⵜⵓⵙⵙⵏⵜⵎⵏ ⵖⴰⵙ ⴷⴼⴼⵉⵔ ⵓⵜⵜⴱⵜ ⵏ ⵓⵍⵍⵓⵖ ⵏⵏⴽ ⴳ ⵓⵙⴰⵍⵓⵏ.',
                        en: 'Note: Points are credited strictly after admin attendance confirmation at the salon.',
                        es: 'Nota: Los puntos se acreditan solo tras confirmar tu asistencia en el salón.',
                      })}
                    </p>
                  </div>

                  {crmClientProfile?.rewardNote && (
                    <div className="text-[11px] text-emerald-300 font-semibold">
                      {crmClientProfile.rewardNote}
                    </div>
                  )}

                  {/* Loyalty Points Balance & Discount Redemption Section */}
                  <div className="pt-3 border-t border-zinc-800/80 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400">
                          <Coins className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>
                              {pickLang(lang, {
                                ar: 'نقاط الولاء • خصم الخدمات القادمة',
                                fr: 'Points de Fidélité • Échanger contre Remises',
                                amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵏ ⵜⵏⴼⵍⵓⵙⵜ • ⴰⵙⵙⵏⵇⵙ ⵏ ⵜⵡⵓⵔⵉⵡⵉⵏ',
                                en: 'Loyalty Points • Redeem for Discounts',
                                es: 'Puntos de Fidelidad • Canjear Descuentos',
                              })}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {pickLang(lang, {
                              ar: `تكسب +${pointsSummary.pointsPerVisit} نقاط عن كل زيارة مكتملة · المكتسب: ${pointsSummary.pointsEarnedTotal} | المستبدل: ${pointsSummary.pointsRedeemedTotal}`,
                              fr: `+${pointsSummary.pointsPerVisit} pts / visite confirmée · Gagnés : ${pointsSummary.pointsEarnedTotal} | Utilisés : ${pointsSummary.pointsRedeemedTotal}`,
                              amz: `+${pointsSummary.pointsPerVisit} pts / ⵜⵉⵔⵣⴰ · ⵉⵜⵜⵓⵙⵎⵓⵏⵏ: ${pointsSummary.pointsEarnedTotal} | ⵉⵜⵜⵓⵙⵏⴼⵍⵏ: ${pointsSummary.pointsRedeemedTotal}`,
                              en: `Earn +${pointsSummary.pointsPerVisit} pts per verified visit · Earned: ${pointsSummary.pointsEarnedTotal} | Redeemed: ${pointsSummary.pointsRedeemedTotal}`,
                              es: `+${pointsSummary.pointsPerVisit} pts / visita · Ganados: ${pointsSummary.pointsEarnedTotal} | Canjeados: ${pointsSummary.pointsRedeemedTotal}`,
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="text-right rtl:text-left">
                        <div className="font-mono font-black text-base text-amber-400 tabular-nums">
                          {pointsSummary.pointsBalance} <span className="text-[11px] font-bold">pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar toward next redeemable points tier */}
                    {pointsSummary.nextTier && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono tabular-nums">
                          <span>
                            {pickLang(lang, {
                              ar: `الهدف القادم للاستبدال: ${pointsSummary.nextTier.pointsCost} نقطة ← خصم -${pointsSummary.nextTier.discountMAD} MAD`,
                              fr: `Prochain palier : ${pointsSummary.nextTier.pointsCost} pts → -${pointsSummary.nextTier.discountMAD} MAD`,
                              amz: `ⴰⵙⵡⵉⵔ ⵉⴷⴷⴰⵏ: ${pointsSummary.nextTier.pointsCost} pts → -${pointsSummary.nextTier.discountMAD} MAD`,
                              en: `Next reward tier: ${pointsSummary.nextTier.pointsCost} pts → -${pointsSummary.nextTier.discountMAD} MAD off`,
                              es: `Próximo nivel: ${pointsSummary.nextTier.pointsCost} pts → -${pointsSummary.nextTier.discountMAD} MAD`,
                            })}
                          </span>
                          <span className="text-amber-300 font-bold">
                            {pointsSummary.pointsBalance} / {pointsSummary.nextTier.pointsCost}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                            style={{ width: `${pointsSummary.progressToNextTierPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Active Discount Credit Ready for Next Booking */}
                    {pointsSummary.activeDiscountMAD > 0 && (
                      <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center justify-between gap-2">
                        <span>
                          {pickLang(lang, {
                            ar: '🎟️ لديك رصيد خصم نشط سيُخصم تلقائياً عند الحجز القادم:',
                            fr: '🎟️ Bon de réduction actif pour votre prochain rendez-vous :',
                            amz: '🎟️ ⵜⵍⵍⴰ ⵖⵓⵔⴽ ⵜⵏⴼⵓⵍⵜ ⵏ ⵓⵙⵙⵏⵇⵙ ⵉ ⵓⵙⵉⵀⵍ ⵉⴷⴷⴰⵏ:',
                            en: '🎟️ Active discount voucher ready for your next booking:',
                            es: '🎟️ Cupón de descuento activo para tu próxima cita:',
                          })}
                        </span>
                        <span className="font-mono font-black text-sm tabular-nums">
                          -{pointsSummary.activeDiscountMAD} MAD
                        </span>
                      </div>
                    )}

                    {redeemFeedback && (
                      <div
                        className={`p-2.5 rounded-xl border text-[11px] font-semibold ${
                          redeemFeedback.type === 'success'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-red-500/15 border-red-500/40 text-red-300'
                        }`}
                      >
                        {redeemFeedback.message}
                      </div>
                    )}

                    {/* Redeemable Point Tiers */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {LOYALTY_POINT_TIERS.map((tier) => {
                        const canRedeem = pointsSummary.pointsBalance >= tier.pointsCost;
                        const isBusy = redeemingTierId === tier.id;
                        const langKey: 'ar' | 'fr' | 'en' | 'es' =
                          lang === 'ar' || lang === 'en' || lang === 'es' ? lang : 'fr';
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            disabled={!canRedeem || Boolean(redeemingTierId)}
                            onClick={() => handleRedeemPointsTier(tier)}
                            className={`p-2.5 rounded-xl border text-left rtl:text-right transition-all flex flex-col justify-between gap-1 ${
                              canRedeem
                                ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/50 text-white cursor-pointer shadow-sm'
                                : 'bg-black/40 border-zinc-800 text-zinc-500 opacity-75 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-black text-amber-300 text-[11px] tabular-nums">
                                {tier.pointsCost} pts
                              </span>
                              <span className="font-mono font-black text-emerald-400 text-xs tabular-nums">
                                -{tier.discountMAD} MAD
                              </span>
                            </div>
                            <div className="text-[11px] font-bold truncate">{tier.label[langKey]}</div>
                            <div className="text-[10px] font-semibold text-zinc-300">
                              {isBusy
                                ? '...'
                                : canRedeem
                                ? pickLang(lang, {
                                    ar: 'استبدال النقاط ← خصم فوري',
                                    fr: 'Échanger maintenant',
                                    amz: 'ⵙⵏⴼⵍ ⵖⵉⵍⴰ',
                                    en: 'Redeem Now',
                                    es: 'Canjear ahora',
                                  })
                                : pickLang(lang, {
                                    ar: `ينقصك ${tier.pointsCost - pointsSummary.pointsBalance} نقطة`,
                                    fr: `${tier.pointsCost - pointsSummary.pointsBalance} pts restants`,
                                    amz: `ⵉⵅⵚⵚⴰ ⴽ ${tier.pointsCost - pointsSummary.pointsBalance} pts`,
                                    en: `${tier.pointsCost - pointsSummary.pointsBalance} pts left`,
                                    es: `Faltan ${tier.pointsCost - pointsSummary.pointsBalance} pts`,
                                  })}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

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
                          {pickLang(lang, {
                            ar: `سجل نقاط الولاء والزيارات المؤكدة (${loyaltyHistoryEntries.length})`,
                            fr: `Historique de Fidélité (${loyaltyHistoryEntries.length} validées)`,
                            amz: `ⴰⵎⵣⵔⵓⵢ ⵏ ⵜⵏⴼⵍⵓⵙⵜ (${loyaltyHistoryEntries.length})`,
                            en: `Loyalty History (${loyaltyHistoryEntries.length} verified)`,
                            es: `Historial de Fidelidad (${loyaltyHistoryEntries.length} confirmadas)`,
                          })}
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
                          {pickLang(lang, {
                            ar: 'لا توجد زيارات مكتملة مسجلة بعد. سيظهر كل موعد مؤكد بالحضور هنا مع توقيت التوثيق.',
                            fr: 'Aucune visite confirmée enregistrée pour le moment. Votre historique horodaté apparaîtra après votre passage.',
                            amz: 'ⵓⵔ ⵜⴰ ⵍⵍⵉⵏⵜ ⵜⵔⵣⵉⵡⵉⵏ ⵉⵜⵜⵓⵙⵙⵏⵜⵎⵏ ⵖⵉⵍⴰ.',
                            en: 'No completed visits logged yet. Once your barber confirms attendance, your timestamped history appears here.',
                            es: 'Aún no hay visitas completadas registradas.',
                          })}
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {loyaltyHistoryEntries.map(({ visitNumber, booking: visit }) => {
                            const isMilestoneVisit = visitNumber % 5 === 0;
                            const confirmedDateText = visit.attendanceConfirmedAt
                              ? new Date(visit.attendanceConfirmedAt).toLocaleString(
                                  lang === 'ar'
                                    ? 'ar-MA'
                                    : lang === 'en'
                                    ? 'en-GB'
                                    : lang === 'es'
                                    ? 'es-ES'
                                    : 'fr-FR',
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
                              pickLang(lang, {
                                ar: 'خدمات الصالون',
                                fr: 'Prestation Salon',
                                amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏ ⵓⵙⴰⵍⵓⵏ',
                                en: 'Salon Service',
                                es: 'Servicio del Salón',
                              });

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
                </>
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
                          {pickLang(lang, {
                            ar: '🔔 اقترح الحلاق توقيتاً جديداً لموعدك:',
                            fr: '🔔 Le barbier propose un nouvel horaire :',
                            amz: '🔔 ⵉⵙⵓⵎⵔ ⵓⵎⵥⵥⴰⵡ ⴰⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ:',
                            en: '🔔 The barber suggested a new time:',
                            es: '🔔 El barbero ha propuesto un nuevo horario:',
                          })}
                        </span>
                        <p className="font-mono text-sm font-black text-amber-300 mt-1">
                          📅 {booking.rescheduledTo.date} • ⏰ {booking.rescheduledTo.time}
                        </p>
                        <p className="text-[11px] text-zinc-300 mt-1">
                          {pickLang(lang, {
                            ar: 'يرجى قبول التوقيت الجديد لتأكيد الموعد وقفل المقعد، أو الرفض لتحرير الكرسي.',
                            fr: 'Veuillez accepter le nouvel horaire pour confirmer le créneau ou refuser pour libérer la place.',
                            amz: 'ⵇⴱⵍ ⴰⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ ⵉ ⵓⵙⵏⵜⵎ ⵏ ⵓⵙⵉⵀⵍ ⵏⵖ ⴰⴳⵉ ⴰⴼⴰⴷ ⴰⴷ ⵢⵉⵍⵉ ⵓⵙⴳⵏ.',
                            en: 'Please accept the new time to confirm your seat, or decline to release the slot.',
                            es: 'Por favor acepte el nuevo horario para confirmar la cita o rechace para liberar el turno.',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleClientRescheduleDecision(booking.id, true)}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {pickLang(lang, {
                            ar: 'قبول الوقت الجديد',
                            fr: "Accepter l'horaire",
                            amz: 'ⵇⴱⵍ ⴰⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ',
                            en: 'Accept New Time',
                            es: 'Aceptar nuevo horario',
                          })}
                        </span>
                      </button>

                      <button
                        onClick={() => handleClientRescheduleDecision(booking.id, false)}
                        className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-950 transition-all cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>
                          {pickLang(lang, {
                            ar: 'رفض وإلغاء الموعد',
                            fr: 'Refuser & Annuler',
                            amz: 'ⴰⴳⵉ ⴷ ⵓⵙⵔⵓⵙ',
                            en: 'Decline & Cancel',
                            es: 'Rechazar y cancelar',
                          })}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Staff Note from Dashboard (Visible to Client) */}
                {booking.adminNotes && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300 text-[11px]">
                      <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {pickLang(lang, {
                          ar: 'ملاحظة خاصة من الحلاق:',
                          fr: 'Message de confirmation du Barbier :',
                          amz: 'ⵜⴰⴱⵔⴰⵜ ⵙⴳ ⵓⵎⵥⵥⴰⵡ:',
                          en: 'Message from Barber:',
                          es: 'Mensaje del barbero:',
                        })}
                      </span>
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
                      {pickLang(lang, {
                        ar: 'الزبون',
                        fr: 'Client',
                        amz: 'ⴰⵎⵙⴰⵖ',
                        en: 'Client',
                        es: 'Cliente',
                      })}
                    </span>
                    <span className="font-bold text-white truncate block">{booking.clientName}</span>
                    <span dir="ltr" className="text-[11px] font-mono text-zinc-400 block">{booking.clientPhone}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {pickLang(lang, {
                        ar: 'الحلاق المختار',
                        fr: 'Barbier Assigné',
                        amz: 'ⴰⵎⵥⵥⴰⵡ',
                        en: 'Assigned Barber',
                        es: 'Barbero Asignado',
                      })}
                    </span>
                    <span className="font-bold text-red-400 truncate block">{booking.barberName}</span>
                    <span className="text-[11px] text-zinc-400 block">
                      {pickLang(lang, {
                        ar: 'كرسي خاص',
                        fr: 'Fauteuil réservé',
                        amz: 'ⴰⵙⵖⵉⵎ ⵉⵜⵜⵓⵃⵣⴰⵏ',
                        en: 'Reserved Chair',
                        es: 'Sillón reservado',
                      })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {pickLang(lang, {
                        ar: 'التاريخ المجدول',
                        fr: 'Date de passage',
                        amz: 'ⴰⵙⴰⴽⵓⴷ',
                        en: 'Scheduled Date',
                        es: 'Fecha programada',
                      })}
                    </span>
                    <span className="font-mono font-bold text-white block">{booking.date}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {pickLang(lang, {
                        ar: 'التوقيت المختار',
                        fr: 'Heure de Passage',
                        amz: 'ⵜⵉⵣⵉ',
                        en: 'Time Slot',
                        es: 'Hora seleccionada',
                      })}
                    </span>
                    <span className="font-mono font-bold text-blue-400 block">
                      {booking.timeSlot === 'FLEXIBLE'
                        ? pickLang(lang, {
                            ar: 'مرن (بانتظار تحديد الحلاق)',
                            fr: 'Flexible (Choix barbier)',
                            amz: 'ⴰⴽⵓⴷ ⴰⵍⵡⵡⴰⵖ',
                            en: 'Flexible (Barber assigned)',
                            es: 'Flexible (Elige barbero)',
                          })
                        : booking.timeSlot}
                    </span>
                  </div>
                </div>

                {/* Cart summary */}
                <div className="p-3 bg-black/50 rounded-xl border border-zinc-800/80 space-y-2 text-xs">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                    {pickLang(lang, {
                      ar: 'الخدمات المحجوزة',
                      fr: 'Prestations Demandées',
                      amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵉⵜⵜⵓⵙⵓⵜⵔⵏ',
                      en: 'Booked Services',
                      es: 'Servicios solicitados',
                    })}
                  </span>
                  <div className="space-y-1">
                    {(booking.cartItemsSummary || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-zinc-300">
                        <span>• {item.name} {item.discountApplied ? <span className="text-[10px] text-emerald-400">({item.discountApplied})</span> : null}</span>
                        <span className={`font-mono font-bold ${item.finalPrice === 0 ? 'text-emerald-300' : 'text-white'}`}>
                          {item.finalPrice === 0 ? `🎁 ${getGiftLabel(lang)}` : `${item.finalPrice} MAD`}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex justify-between items-center font-bold">
                    <span className="text-zinc-300">
                      {pickLang(lang, {
                        ar: 'المجموع النهائي:',
                        fr: 'Montant Total :',
                        amz: 'ⴰⵖⵔⵓⴷ ⴰⵎⴳⴳⴰⵔⵓ:',
                        en: 'Final Total:',
                        es: 'Importe Total:',
                      })}
                    </span>
                    <div className="text-right">
                      {(booking.totalSavingsMAD || 0) > 0 && (
                        <span className="text-[10px] text-emerald-400 block font-normal">
                          {pickLang(lang, {
                            ar: `وفّرت: ${booking.totalSavingsMAD} MAD`,
                            fr: `Économie : ${booking.totalSavingsMAD} MAD`,
                            amz: `ⵜⵓⵙⵙⵓⴼⵖⵜ: ${booking.totalSavingsMAD} MAD`,
                            en: `Saved: ${booking.totalSavingsMAD} MAD`,
                            es: `Ahorro: ${booking.totalSavingsMAD} MAD`,
                          })}
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
                        {pickLang(lang, {
                          ar: 'ملاحظات الزبون وتفضيلات الحلاقة:',
                          fr: 'Notes Client & Préférences :',
                          amz: 'ⵜⵉⵎⵍⴰⵢⵉⵏ ⵏ ⵓⵎⵙⴰⵖ:',
                          en: 'Client Notes & Grooming Preferences:',
                          es: 'Notas y Preferencias del Cliente:',
                        })}
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
                        <span>
                          {pickLang(lang, {
                            ar: 'إيصال تحويل CIH مرفق:',
                            fr: 'Reçu virement CIH joint :',
                            amz: 'ⵜⴰⵏⴼⵓⵍⵜ ⵏ CIH:',
                            en: 'CIH Transfer Receipt Attached:',
                            es: 'Recibo CIH adjunto:',
                          })}
                        </span>
                      </span>
                      <span className="font-mono text-zinc-200 truncate max-w-[160px]">{booking.cihReceiptName}</span>
                    </div>
                  )}
                </div>

                {/* Unique Arrival Check-In QR Pass */}
                <CheckInQrPassBox booking={booking} lang={lang} />

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
                          {pickLang(lang, {
                            ar: 'معلومات الأداء البنكي ورفع إيصال CIH',
                            fr: 'Infos Bancaires CIH & Envoi du Reçu',
                            amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵏ CIH ⴷ ⵜⵏⴼⵓⵍⵜ',
                            en: 'CIH Bank Info & Receipt Upload',
                            es: 'Datos CIH y Envío de Recibo',
                          })}
                        </span>
                        <span className="text-[10px] text-zinc-400 block truncate">
                          {booking.cihReceiptName
                            ? pickLang(lang, {
                                ar: 'تم إرفاق الإيصال — اضغط للتحديث',
                                fr: 'Reçu joint — Appuyez pour modifier',
                                amz: 'ⵜⴻⵜⵜⵓⵙⴽⵛⵎ ⵜⵏⴼⵓⵍⵜ — ⴰⴷⵔ ⵉ ⵓⵙⵏⴼⵍ',
                                en: 'Receipt attached — Tap to update',
                                es: 'Recibo adjunto — Toca para actualizar',
                              })
                            : pickLang(lang, {
                                ar: 'اضغط لعرض رقم الحساب أو رفع الإيصال بعد الحجز',
                                fr: 'Voir le compte CIH ou envoyer votre reçu',
                                amz: 'ⵥⵕ ⵓⵟⵟⵓⵏ ⵏ CIH ⵏⵖ ⴰⵣⵏ ⵜⴰⵏⴼⵓⵍⵜ',
                                en: 'View CIH account or upload receipt',
                                es: 'Ver cuenta CIH o subir recibo',
                              })}
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
                            {pickLang(lang, {
                              ar: 'التحويل البنكي CIH (اختياري) - مستحسن لتأكيد الموعد مسبقاً دون الحاجة للتنقل للمحل',
                              fr: 'Virement CIH (optionnel) — recommandé pour confirmer à l’avance sans vous déplacer au salon.',
                              amz: 'ⴰⵙⵉⵡⴹ ⵏ CIH (ⴰⴼⵔⴰⵏ) - ⵉⵜⵜⵓⵙⵓⵜⵔ ⵉ ⵓⵙⵏⵜⵎ ⵏ ⵓⵙⵉⵀⵍ.',
                              en: 'CIH transfer (optional) — recommended to confirm in advance without visiting the salon.',
                              es: 'Transferencia CIH (opcional) — recomendada para confirmar por adelantado.',
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Account Holder + Account Number with Copy Buttons */}
                      <div className="p-3 rounded-xl bg-black/70 border border-zinc-800 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-zinc-400 font-semibold text-[11px]">
                            {pickLang(lang, {
                              ar: 'صاحب الحساب:',
                              fr: 'Titulaire :',
                              amz: 'ⴱⴰⴱ ⵏ ⵓⵎⵉⴹⴰⵏ:',
                              en: 'Account Holder:',
                              es: 'Titular:',
                            })}
                          </span>
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

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                          <span className="text-zinc-400 font-semibold text-[11px]">
                            {pickLang(lang, {
                              ar: 'رقم الحساب :',
                              fr: 'N° Compte :',
                              amz: 'ⵓⵟⵟⵓⵏ ⵏ ⵓⵎⵉⴹⴰⵏ:',
                              en: 'Account Number:',
                              es: 'N° Cuenta:',
                            })}
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
                            <span>
                              {pickLang(lang, {
                                ar: 'جاري رفع ومزامنة الإيصال...',
                                fr: 'Envoi vers le salon...',
                                amz: 'ⴰⵙⵙⴽⵛⵎ ⵏ ⵜⵏⴼⵓⵍⵜ...',
                                en: 'Uploading receipt...',
                                es: 'Subiendo recibo...',
                              })}
                            </span>
                          </>
                        ) : booking.cihReceiptName ? (
                          <>
                            <FileCheck className="w-4 h-4 text-emerald-400" />
                            <span>
                              {pickLang(lang, {
                                ar: 'تحديث أو استبدال إيصال CIH (.jpg, .png, .pdf)',
                                fr: 'Mettre à jour le reçu CIH (.jpg, .png, .pdf)',
                                amz: 'ⵙⴷⵖⵉ ⵜⴰⵏⴼⵓⵍⵜ CIH (.jpg, .png, .pdf)',
                                en: 'Update CIH receipt (.jpg, .png, .pdf)',
                                es: 'Actualizar recibo CIH (.jpg, .png, .pdf)',
                              })}
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-emerald-400" />
                            <span>
                              {pickLang(lang, {
                                ar: 'رفع إيصال التحويل CIH (.jpg, .png, .pdf)',
                                fr: 'Envoyer le reçu CIH (.jpg, .png, .pdf)',
                                amz: 'ⵙⵙⴽⵛⵎ ⵜⴰⵏⴼⵓⵍⵜ CIH (.jpg, .png, .pdf)',
                                en: 'Upload CIH transfer receipt (.jpg, .png, .pdf)',
                                es: 'Subir recibo CIH (.jpg, .png, .pdf)',
                              })}
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
                        href={`https://wa.me/${normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp)}?text=${encodeURIComponent(
                          pickLang(lang, {
                            ar: `مرحباً صالون بومليك، هذا إيصال التحويل البنكي عبر CIH لتأكيد تذكرتي ${booking.ticketNumber} (${booking.clientName} - ${booking.date} الساعة ${booking.timeSlot}).`,
                            fr: `Bonjour Salon Boumlik, voici mon reçu CIH pour confirmer le ticket ${booking.ticketNumber} (${booking.clientName} - ${booking.date} à ${booking.timeSlot}).`,
                            amz: `ⴰⵣⵓⵍ Salon Boumlik, ⵀⴰⵜⵉⵏ ⵜⴰⵏⴼⵓⵍⵜ ⵏ CIH ⵉ ⵜⵉⴽⵉ ${booking.ticketNumber} (${booking.clientName} - ${booking.date} ${booking.timeSlot}).`,
                            en: `Hello Salon Boumlik, here is my CIH transfer receipt to confirm ticket ${booking.ticketNumber} (${booking.clientName} - ${booking.date} at ${booking.timeSlot}).`,
                            es: `Hola Salon Boumlik, aquí está mi recibo CIH para confirmar el ticket ${booking.ticketNumber} (${booking.clientName} - ${booking.date} a las ${booking.timeSlot}).`,
                          })
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>
                          {pickLang(lang, {
                            ar: 'أو إرسال الإيصال عبر واتساب الصالون مباشرة',
                            fr: 'Ou envoyer le reçu sur WhatsApp',
                            amz: 'ⵏⵖ ⴰⵣⵏ ⵜⴰⵏⴼⵓⵍⵜ ⴳ WhatsApp',
                            en: 'Or send receipt via Salon WhatsApp',
                            es: 'O enviar recibo por WhatsApp',
                          })}
                        </span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Post-Visit Quick Rating / Feedback (Shown once appointment is completed) */}
                {booking.status === 'completed' && (() => {
                  const existingReview = firestoreReviews.find(
                    (rev) => rev.bookingId === booking.id
                  );
                  const chosenStars = quickRatingsMap[booking.id] ?? 5;
                  const commentDraft = quickCommentsMap[booking.id] ?? '';
                  const isBusyRating = submittingRatingBookingId === booking.id;

                  if (existingReview) {
                    return (
                      <div className="p-3 rounded-xl bg-emerald-950/35 border border-emerald-500/40 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-emerald-300 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span>
                            {pickLang(lang, {
                              ar: 'شكراً على تقييمك لهذه الزيارة!',
                              fr: 'Merci pour votre avis sur cette visite !',
                              amz: 'ⵜⴰⵏⵎⵎⵉⵔⵜ ⵖⴼ ⵓⵜⵉⴳ ⵏⵏⴽ!',
                              en: 'Thanks for rating this visit!',
                              es: '¡Gracias por valorar esta visita!',
                            })}
                          </span>
                        </div>
                        <div dir="ltr" className="flex items-center gap-0.5 flex-shrink-0">
                          {[1, 2, 3, 4, 5].map((st) => (
                            <Star
                              key={st}
                              className={`w-3.5 h-3.5 ${
                                st <= existingReview.rating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-zinc-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/35 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-black text-amber-200 flex items-center gap-1.5">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
                          <span>
                            {pickLang(lang, {
                              ar: `قيّم تجربتك السريعة مع ${booking.barberName}`,
                              fr: `Notez votre visite avec ${booking.barberName}`,
                              amz: `ⴰⵡⵙ ⴰⵜⵉⴳ ⵉ ${booking.barberName}`,
                              en: `Quick Rating for ${booking.barberName}`,
                              es: `Valora tu visita con ${booking.barberName}`,
                            })}
                          </span>
                        </div>
                        <div dir="ltr" className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((starNum) => (
                            <button
                              key={starNum}
                              type="button"
                              onClick={() =>
                                setQuickRatingsMap((prev) => ({
                                  ...prev,
                                  [booking.id]: starNum,
                                }))
                              }
                              aria-label={`${starNum} stars`}
                              className="p-1 rounded-lg hover:bg-amber-500/20 transition-colors cursor-pointer"
                            >
                              <Star
                                className={`w-5 h-5 transition-transform ${
                                  starNum <= chosenStars
                                    ? 'text-amber-400 fill-amber-400 scale-105'
                                    : 'text-zinc-600'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          maxLength={240}
                          value={commentDraft}
                          onChange={(e) =>
                            setQuickCommentsMap((prev) => ({
                              ...prev,
                              [booking.id]: e.target.value,
                            }))
                          }
                          placeholder={pickLang(lang, {
                            ar: 'أضف كلمة قصيرة أو ملاحظة (اختياري)...',
                            fr: 'Un petit commentaire (optionnel)...',
                            amz: 'ⵜⴰⵏⵏⴰⵢⵜ ⵜⴰⵎⵥⵥⵢⴰⵏⵜ (ⴰⴼⵔⴰⵏ)...',
                            en: 'Add a quick note (optional)...',
                            es: 'Comentario breve (opcional)...',
                          })}
                          className="flex-1 bg-black/55 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          disabled={isBusyRating}
                          onClick={() => handleSubmitQuickRating(booking)}
                          className="min-h-[38px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
                        >
                          {isBusyRating ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Star className="w-3.5 h-3.5 fill-black" />
                          )}
                          <span>
                            {pickLang(lang, {
                              ar: 'إرسال التقييم',
                              fr: 'Envoyer',
                              amz: 'ⴰⵣⵏ ⴰⵜⵉⴳ',
                              en: 'Send Rating',
                              es: 'Enviar',
                            })}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Direct Help Button & Client-Side Cancellation Action */}
                <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <a
                    href={`https://wa.me/${normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp)}?text=${encodeURIComponent(
                      buildClientTicketWhatsAppMessage(booking, lang)
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>
                      {pickLang(lang, {
                        ar: 'تواصل معنا واتساب حول التذكرة',
                        fr: 'Contacter le Salon par WhatsApp',
                        amz: 'ⵏⵢⴰⵍⴽⴰⵎ ⴷⵉⴷⵏⵖ ⴳ WhatsApp',
                        en: 'Contact Salon on WhatsApp',
                        es: 'Contactar por WhatsApp',
                      })}
                    </span>
                  </a>

                  {booking.status !== 'cancelled' && booking.status !== 'rejected' && booking.status !== 'completed' && (
                    <button
                      onClick={() => handleClientCancel(booking)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-red-950/60 border border-zinc-700 hover:border-red-600/50 text-zinc-300 hover:text-red-400 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                      <span>
                        {pickLang(lang, {
                          ar: 'إلغاء الموعد وتحرير الوقت',
                          fr: 'Annuler le rendez-vous',
                          amz: 'ⵙⵙⵓⵔ ⴰⵙⵉⵀⵍ',
                          en: 'Cancel Appointment',
                          es: 'Cancelar cita',
                        })}
                      </span>
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
                      {pickLang(lang, {
                        ar: `سجل الحجوزات السابق والولاء (${fullClientCrmHistory.length})`,
                        fr: `Historique Complet & Fidélité CRM (${fullClientCrmHistory.length})`,
                        amz: `ⴰⵎⵣⵔⵓⵢ ⵏ ⵉⵙⵉⵀⵍⵏ (${fullClientCrmHistory.length})`,
                        en: `Full History & Loyalty (${fullClientCrmHistory.length})`,
                        es: `Historial Completo y Fidelidad (${fullClientCrmHistory.length})`,
                      })}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {crmClientProfile?.isVip ? '👑 VIP • ' : ''}
                      {pickLang(lang, {
                        ar: `الزيارات المؤكدة: ${loyaltyProgress.verifiedVisits} (${loyaltyProgress.verifiedVisits}/${loyaltyProgress.nextMilestone})`,
                        fr: `Visites confirmées : ${loyaltyProgress.verifiedVisits} (${loyaltyProgress.verifiedVisits}/${loyaltyProgress.nextMilestone})`,
                        amz: `ⵜⵉⵔⵣⵉⵡⵉⵏ: ${loyaltyProgress.verifiedVisits} (${loyaltyProgress.verifiedVisits}/${loyaltyProgress.nextMilestone})`,
                        en: `Verified visits: ${loyaltyProgress.verifiedVisits} (${loyaltyProgress.verifiedVisits}/${loyaltyProgress.nextMilestone})`,
                        es: `Visitas confirmadas: ${loyaltyProgress.verifiedVisits} (${loyaltyProgress.verifiedVisits}/${loyaltyProgress.nextMilestone})`,
                      })}
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
            <span>
              {pickLang(lang, {
                ar: 'التحديث التلقائي الفوري مفعّل',
                fr: 'Synchronisation directe avec le salon',
                amz: 'ⴰⵙⴷⵖⵉ ⵓⵙⵔⵉⴷ ⵉⵕⵥⵎ',
                en: 'Live sync with Salon Boumlik active',
                es: 'Sincronización en vivo activa',
              })}
            </span>
          </span>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
          >
            {pickLang(lang, {
              ar: 'إغلاق',
              fr: 'Fermer',
              amz: 'ⵇⵇⵏ',
              en: 'Close',
              es: 'Cerrar',
            })}
          </button>
        </div>

      </div>
    </div>
  );
};
