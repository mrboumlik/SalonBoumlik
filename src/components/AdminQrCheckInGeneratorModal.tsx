import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Download,
  MessageCircle,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { AppointmentBooking, CrmClientProfile } from '../types';
import { getMergedBarbers, useBarberProfiles } from '../utils/barberProfileStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import {
  buildBookingCheckInQrPayload,
  generateCheckInToken,
  normalizePhoneForQrId,
} from '../utils/clientQr';
import {
  adjustClientLoyaltyPoints,
  getCrmDocId,
} from '../utils/crmStore';
import {
  computeClientPointsSummary,
  getVerifiedVisitsCount,
  POINTS_PER_VISIT,
} from '../utils/loyaltyEngine';
import { normalizeMoroccanPhoneDigits } from '../utils/bookingStore';
import { formatMoroccanWhatsAppNumber } from '../utils/whatsappAutomation';
import { sendDualAlert, showToast } from '../utils/notifications';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { safeCopyToClipboard } from '../utils/safeBrowser';
import { ModalPortal } from './ModalPortal';

interface AdminQrCheckInGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: AppointmentBooking[];
  crmClientsMap: Record<string, CrmClientProfile>;
  scopedBarberId: string; // 'all' for Master Admin or barberId
  onMarkBookingCompleted: (booking: AppointmentBooking) => Promise<void> | void;
}

export const AdminQrCheckInGeneratorModal: React.FC<AdminQrCheckInGeneratorModalProps> = ({
  isOpen,
  onClose,
  bookings,
  crmClientsMap,
  scopedBarberId,
  onMarkBookingCompleted,
}) => {
  const { lang, isRtl } = useLanguage();
  const roster = useBarberRoster();
  const profilesMap = useBarberProfiles();
  const mergedBarbers = useMemo(
    () => getMergedBarbers(profilesMap, roster),
    [profilesMap, roster]
  );
  const [mode, setMode] = useState<'booking' | 'walkin'>('booking');
  const [bookingSearch, setBookingSearch] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');

  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinBarberId, setWalkinBarberId] = useState(
    scopedBarberId !== 'all' ? scopedBarberId : mergedBarbers[0]?.id || 'hassan'
  );
  const [uniqueToken, setUniqueToken] = useState<string>(() => generateCheckInToken());

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [isAwardingPoints, setIsAwardingPoints] = useState(false);
  const [lastAttributedMsg, setLastAttributedMsg] = useState<string | null>(null);

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  const eligibleBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    return bookings
      .filter((b) => {
        if (scopedBarberId !== 'all' && b.barberId !== scopedBarberId) return false;
        if (['cancelled', 'rejected', 'no_show'].includes(b.status)) return false;
        if (!q) return true;
        return (
          b.clientName.toLowerCase().includes(q) ||
          b.clientPhone.toLowerCase().includes(q) ||
          b.ticketNumber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aScore = (a.date === todayIso ? 2 : 0) + (a.status !== 'completed' ? 1 : 0);
        const bScore = (b.date === todayIso ? 2 : 0) + (b.status !== 'completed' ? 1 : 0);
        if (aScore !== bScore) return bScore - aScore;
        return b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, 15);
  }, [bookings, scopedBarberId, bookingSearch, todayIso]);

  const selectedBooking = useMemo(() => {
    if (mode !== 'booking') return null;
    return (
      eligibleBookings.find((b) => b.id === selectedBookingId) ||
      eligibleBookings[0] ||
      null
    );
  }, [mode, eligibleBookings, selectedBookingId]);

  useEffect(() => {
    if (isOpen && !selectedBookingId && eligibleBookings.length > 0) {
      setSelectedBookingId(eligibleBookings[0].id);
    }
  }, [isOpen, eligibleBookings, selectedBookingId]);

  useEffect(() => {
    if (!isOpen) {
      setLastAttributedMsg(null);
      return;
    }
    setUniqueToken(generateCheckInToken());
  }, [isOpen]);

  const walkInDefaultName = pickLang(lang, {
    ar: 'زبون مباشر (Walk-In)',
    fr: 'Client sans RDV (Walk-In)',
    amz: 'ⴰⵎⵙⴰⵖ ⵓⵙⵔⵉⴷ (Walk-In)',
    en: 'Walk-In Client',
    es: 'Cliente Directo (Walk-In)',
  });

  const activeClientContext = useMemo(() => {
    if (mode === 'booking' && selectedBooking) {
      const digits = normalizeMoroccanPhoneDigits(selectedBooking.clientPhone);
      const crm =
        crmClientsMap[getCrmDocId(selectedBooking.clientPhone)] ||
        Object.values(crmClientsMap).find(
          (c) => normalizeMoroccanPhoneDigits(c.normalizedPhone || c.phoneDisplay) === digits
        );
      const history = bookings.filter(
        (b) => digits.length >= 6 && normalizeMoroccanPhoneDigits(b.clientPhone) === digits
      );
      const verifiedVisits = getVerifiedVisitsCount(history, crm);
      const points = computeClientPointsSummary(verifiedVisits, crm);
      const phoneId = normalizePhoneForQrId(selectedBooking.clientPhone);
      const token =
        phoneId ||
        (selectedBooking.checkInToken && !selectedBooking.checkInToken.startsWith('CHK-')
          ? selectedBooking.checkInToken
          : '') ||
        uniqueToken;
      const qrPayload = buildBookingCheckInQrPayload({
        ticketNumber: selectedBooking.ticketNumber,
        checkInToken: token,
        clientPhone: selectedBooking.clientPhone,
      });

      return {
        clientName: selectedBooking.clientName,
        clientPhone: selectedBooking.clientPhone,
        barberName: selectedBooking.barberName,
        ticketOrRef: selectedBooking.ticketNumber,
        token,
        qrPayload,
        verifiedVisits,
        pointsBalance: points.pointsBalance,
        isBookingCompleted: selectedBooking.status === 'completed',
      };
    }

    const cleanName = walkinName.trim() || walkInDefaultName;
    const cleanPhone = walkinPhone.trim();
    const walkinPhoneId = normalizePhoneForQrId(cleanPhone);
    const digits = normalizeMoroccanPhoneDigits(cleanPhone);
    const crm =
      digits.length >= 6
        ? crmClientsMap[getCrmDocId(cleanPhone)] ||
          Object.values(crmClientsMap).find(
            (c) => normalizeMoroccanPhoneDigits(c.normalizedPhone || c.phoneDisplay) === digits
          )
        : undefined;
    const history =
      digits.length >= 6
        ? bookings.filter((b) => normalizeMoroccanPhoneDigits(b.clientPhone) === digits)
        : [];
    const verifiedVisits = getVerifiedVisitsCount(history, crm);
    const points = computeClientPointsSummary(verifiedVisits, crm);
    const barberObj =
      mergedBarbers.find((b) => b.id === walkinBarberId) || mergedBarbers[0];
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://salonboumlik.com';
    const resolvedWalkinToken = walkinPhoneId || generateCheckInToken(cleanPhone);
    const lookupKey = walkinPhoneId || resolvedWalkinToken;
    const qrPayload = `${origin}/#checkin=${encodeURIComponent(lookupKey)}&k=${encodeURIComponent(
      resolvedWalkinToken
    )}`;

    return {
      clientName: crm?.clientName && !walkinName.trim() ? crm.clientName : cleanName,
      clientPhone: cleanPhone,
      barberName: barberObj?.name[lang] || barberObj?.name.fr || 'Salon Boumlik',
      ticketOrRef: resolvedWalkinToken,
      token: resolvedWalkinToken,
      qrPayload,
      verifiedVisits,
      pointsBalance: points.pointsBalance,
      isBookingCompleted: false,
    };
  }, [
    mode,
    selectedBooking,
    walkinName,
    walkInDefaultName,
    walkinPhone,
    walkinBarberId,
    uniqueToken,
    crmClientsMap,
    bookings,
    lang,
  ]);

  useEffect(() => {
    if (!isOpen || !activeClientContext.qrPayload) return;
    let cancelled = false;
    setIsGenerating(true);

    QRCode.toDataURL(activeClientContext.qrPayload, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#09090B', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => console.error('QR generation error:', err))
      .finally(() => {
        if (!cancelled) setIsGenerating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeClientContext.qrPayload]);

  if (!isOpen) return null;

  const ui = {
    title: pickLang(lang, {
      ar: 'مولد رمز الوصول والولاء السريع (QR Check-In)',
      fr: 'Générateur QR Check-In & Points Fidélité',
      amz: 'ⴰⵙⵏⵓⵍⴼⵓ ⵏ QR Check-In ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ',
      en: 'QR Check-In & Loyalty Generator',
      es: 'Generador QR Check-In y Puntos',
    }),
    subtitle: pickLang(lang, {
      ar: 'توليد رمز QR فريد عند وصول الزبون ومنح نقاط الولاء في ثوانٍ',
      fr: 'Générez un QR unique à l’arrivée du client et attribuez ses points en un clic',
      amz: 'ⵙⵏⵓⵍⴼⵓ ⴰⴽⵓⴷ QR ⵉ ⵓⵎⵙⴰⵖ ⴷ ⵓⵜⵜⵉⵍ ⵏ ⵜⵏⵇⵇⵉⴹⵉⵏ',
      en: 'Generate a unique arrival QR code and award loyalty points in seconds',
      es: 'Genera un QR único a la llegada del cliente y asigna puntos',
    }),
    closeAria: pickLang(lang, {
      ar: 'إغلاق',
      fr: 'Fermer',
      amz: 'ⵇⵇⵏ',
      en: 'Close',
      es: 'Cerrar',
    }),
    modeBooking: pickLang(lang, {
      ar: 'من حجز حالي',
      fr: 'Depuis un RDV',
      amz: 'ⵙⴳ ⵓⵙⵉⵀⵍ',
      en: 'From Booking',
      es: 'Desde una Cita',
    }),
    modeWalkin: pickLang(lang, {
      ar: 'زبون مباشر (Walk-In)',
      fr: 'Client sans RDV',
      amz: 'ⴰⵎⵙⴰⵖ ⵓⵙⵔⵉⴷ',
      en: 'Walk-In Client',
      es: 'Cliente Directo',
    }),
    searchPlaceholder: pickLang(lang, {
      ar: 'ابحث بالاسم، الهاتف، أو #SB-1234...',
      fr: 'Rechercher par nom, téléphone ou #SB-1234...',
      amz: 'ⵔⵣⵓ ⵙ ⵉⵙⵎ, ⵜⵉⵍⵉⴼⵓⵏ ⵏⵖ #SB-1234...',
      en: 'Search by name, phone, or #SB-1234...',
      es: 'Buscar por nombre, teléfono o #SB-1234...',
    }),
    emptyBookings: pickLang(lang, {
      ar: 'لا توجد مواعيد مطابقة حالياً. يمكنك استخدام تبويب «زبون مباشر».',
      fr: 'Aucun rendez-vous trouvé. Utilisez l’onglet « Client sans RDV ».',
      amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⵙⵉⵀⴰⵍⵏ. ⵙⵙⵎⵔⵙ « ⴰⵎⵙⴰⵖ ⵓⵙⵔⵉⴷ ».',
      en: 'No matching bookings found. Switch to Walk-In Client.',
      es: 'No hay citas coincidentes. Usa la pestaña Cliente Directo.',
    }),
    completedBadge: pickLang(lang, {
      ar: 'مكتمل ✓',
      fr: 'Terminé ✓',
      amz: 'ⵉⵎⴷⴰ ✓',
      en: 'Completed ✓',
      es: 'Completado ✓',
    }),
    expectedBadge: pickLang(lang, {
      ar: 'وصول منتظر',
      fr: 'Attendu',
      amz: 'ⵉⵜⵜⵓⵔⴰⵊⵓ',
      en: 'Expected',
      es: 'Esperado',
    }),
    walkinNameLabel: pickLang(lang, {
      ar: 'اسم الزبون:',
      fr: 'Nom du client :',
      amz: 'ⵉⵙⵎ ⵏ ⵓⵎⵙⴰⵖ:',
      en: 'Client Name:',
      es: 'Nombre del cliente:',
    }),
    walkinNamePlaceholder: pickLang(lang, {
      ar: 'مثال: سعيد أمين',
      fr: 'Ex : Saïd Amine',
      amz: 'ⴰⵎⴷⵢⴰ: Saïd',
      en: 'Ex: Said Amine',
      es: 'Ej: Said Amine',
    }),
    walkinPhoneLabel: pickLang(lang, {
      ar: 'رقم الهاتف (لربط نقاط الولاء):',
      fr: 'Téléphone (pour attribuer les points) :',
      amz: 'ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ (ⵉ ⵜⵏⵇⵇⵉⴹⵉⵏ):',
      en: 'Phone Number (to link loyalty points):',
      es: 'Teléfono (para vincular puntos):',
    }),
    barberLabel: pickLang(lang, {
      ar: 'الحلاق المسؤول:',
      fr: 'Barbier assigné :',
      amz: 'ⴰⵎⴽⵔⴰⴹ:',
      en: 'Assigned Barber:',
      es: 'Barbero asignado:',
    }),
    regenerateBtn: pickLang(lang, {
      ar: 'توليد رمز وصول فريد جديد',
      fr: 'Générer un nouveau code unique',
      amz: 'ⵙⵏⵓⵍⴼⵓ ⴰⴽⵓⴷ ⴰⵎⴰⵢⵏⵓ',
      en: 'Generate New Unique Token',
      es: 'Generar nuevo código único',
    }),
    pointsUnit: pickLang(lang, {
      ar: 'نقطة',
      fr: 'pts',
      amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ',
      en: 'pts',
      es: 'pts',
    }),
    visitsUnit: pickLang(lang, {
      ar: 'زيارة',
      fr: 'visites',
      amz: 'ⵜⵉⵔⵣⵉⵡⵉⵏ',
      en: 'visits',
      es: 'visitas',
    }),
    awarding: pickLang(lang, {
      ar: 'جاري تسجيل النقاط...',
      fr: 'Attribution en cours...',
      amz: 'ⴰⵣⵎⵎⴻⵎ...',
      en: 'Recording points...',
      es: 'Registrando puntos...',
    }),
    confirmAndAward: pickLang(lang, {
      ar: `تأكيد الوصول ومنح +${POINTS_PER_VISIT} نقاط ولاء`,
      fr: `Valider l’arrivée & créditer +${POINTS_PER_VISIT} pts`,
      amz: `ⵙⵙⴷⵓ ⴰⵡⵡⴰⴹ ⴷ ⵜⵉⴽⴽⵉ +${POINTS_PER_VISIT} pts`,
      en: `Check-In & Award +${POINTS_PER_VISIT} Points`,
      es: `Confirmar llegada y dar +${POINTS_PER_VISIT} pts`,
    }),
    awardArrivalOnly: pickLang(lang, {
      ar: `منح +${POINTS_PER_VISIT} نقاط ولاء وصول`,
      fr: `Créditer +${POINTS_PER_VISIT} pts de fidélité`,
      amz: `ⴰⴽⴽⴰ +${POINTS_PER_VISIT} ⵜⵏⵇⵇⵉⴹⵉⵏ`,
      en: `Award +${POINTS_PER_VISIT} Loyalty Points`,
      es: `Otorgar +${POINTS_PER_VISIT} puntos`,
    }),
    copied: pickLang(lang, {
      ar: 'نُسخ',
      fr: 'Copié',
      amz: 'ⵉⵜⵜⵓⵏⵖⵍ',
      en: 'Copied',
      es: 'Copiado',
    }),
    copy: pickLang(lang, {
      ar: 'نسخ',
      fr: 'Copier',
      amz: 'ⵏⵖⵍ',
      en: 'Copy',
      es: 'Copiar',
    }),
    whatsapp: pickLang(lang, {
      ar: 'واتساب',
      fr: 'WhatsApp',
      amz: 'ⵡⴰⵜⵙⴰⴱ',
      en: 'WhatsApp',
      es: 'WhatsApp',
    }),
  };

  const handleRegenerateToken = () => {
    setUniqueToken(generateCheckInToken(walkinPhone));
    setLastAttributedMsg(null);
  };

  const handleCopyPayload = () => {
    void safeCopyToClipboard(activeClientContext.qrPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 1800);
  };

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    const safeName =
      activeClientContext.clientName.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Client';
    link.download = `Salon_Boumlik_CheckIn_${safeName}_${activeClientContext.token}.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleQuickAwardPoints = async (pointsToAdd = POINTS_PER_VISIT) => {
    if (isAwardingPoints) return;

    if (mode === 'booking' && selectedBooking) {
      if (selectedBooking.status !== 'completed' && pointsToAdd === POINTS_PER_VISIT) {
        setIsAwardingPoints(true);
        try {
          await onMarkBookingCompleted(selectedBooking);
          setLastAttributedMsg(
            pickLang(lang, {
              ar: `✓ تم تسجيل حضور ${selectedBooking.clientName} ومنح +${POINTS_PER_VISIT} نقطة ولاء بنجاح!`,
              fr: `✓ Arrivée de ${selectedBooking.clientName} validée (+${POINTS_PER_VISIT} pts crédités) !`,
              amz: `✓ ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵡⵡⴰⴹ ⵏ ${selectedBooking.clientName} (+${POINTS_PER_VISIT} pts) !`,
              en: `✓ Checked in ${selectedBooking.clientName} and awarded +${POINTS_PER_VISIT} points!`,
              es: `✓ Asistencia de ${selectedBooking.clientName} confirmada (+${POINTS_PER_VISIT} pts)!`,
            })
          );
        } finally {
          setIsAwardingPoints(false);
        }
        return;
      }
    }

    const phone = activeClientContext.clientPhone.trim();
    const digits = normalizeMoroccanPhoneDigits(phone);
    if (digits.length < 6) {
      showToast(
        pickLang(lang, {
          ar: 'رقم الهاتف مطلوب',
          fr: 'Téléphone requis',
          amz: 'ⵉⵅⵚⵚⴰ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ',
          en: 'Phone number required',
          es: 'Teléfono obligatorio',
        }),
        pickLang(lang, {
          ar: 'يرجى إدخال رقم هاتف صحيح للزبون لربط نقاط الولاء بملفه في Firestore.',
          fr: 'Veuillez saisir un numéro valide pour lier les points au profil client.',
          amz: 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵉⵥⵉⵍⵏ ⵉ ⵓⵣⵎⵎⴻⵎ ⵏ ⵜⵏⵇⵇⵉⴹⵉⵏ.',
          en: 'Please enter a valid client phone number to link points.',
          es: 'Introduce un teléfono válido para asignar puntos.',
        }),
        'warning'
      );
      return;
    }

    setIsAwardingPoints(true);
    try {
      const updated = await adjustClientLoyaltyPoints({
        phone,
        clientName: activeClientContext.clientName,
        pointsDelta: pointsToAdd,
        note: `✓ QR Check-In (${activeClientContext.token}) (+${pointsToAdd} pts)`,
        crmMap: crmClientsMap,
      });

      const msg = pickLang(lang, {
        ar: `✓ تم منح +${pointsToAdd} نقطة ولاء لـ ${updated.clientName} (الرصيد الآن: ${updated.loyaltyPoints} نقطة)`,
        fr: `✓ +${pointsToAdd} pts crédités à ${updated.clientName} (Solde : ${updated.loyaltyPoints} pts)`,
        amz: `✓ +${pointsToAdd} pts ⵉ ${updated.clientName} (${updated.loyaltyPoints} pts)`,
        en: `✓ +${pointsToAdd} pts awarded to ${updated.clientName} (Balance: ${updated.loyaltyPoints} pts)`,
        es: `✓ +${pointsToAdd} pts añadidos a ${updated.clientName} (Saldo: ${updated.loyaltyPoints} pts)`,
      });
      setLastAttributedMsg(msg);
      sendDualAlert(`+${pointsToAdd} pts ✓`, {
        body: msg,
        type: 'success',
        skipSound: true,
      });
    } catch (err: any) {
      showToast(
        pickLang(lang, {
          ar: 'تعذر إضافة النقاط',
          fr: 'Échec de l’attribution',
          amz: 'ⵓⵔ ⵉⵜⵜⵓⵣⵎⵎⴻⵎ',
          en: 'Could not award points',
          es: 'Error al asignar puntos',
        }),
        err?.message || 'Error',
        'warning'
      );
    } finally {
      setIsAwardingPoints(false);
    }
  };

  const clientWa = formatMoroccanWhatsAppNumber(activeClientContext.clientPhone || '');
  const waText = pickLang(lang, {
    ar: `مرحباً ${activeClientContext.clientName}، هذا رمز الوصول السريع (Check-In QR) الخاص بك في صالون بومليك لتأكيد الحضور وكسب نقاط الولاء:\nرمز التحقق: ${activeClientContext.token}\n${activeClientContext.qrPayload}`,
    fr: `Bonjour ${activeClientContext.clientName}, voici votre QR Check-In Salon Boumlik pour confirmer votre arrivée et cumuler vos points :\nCode : ${activeClientContext.token}\n${activeClientContext.qrPayload}`,
    amz: `Azul ${activeClientContext.clientName}, ⵀⴰⵜ ⴰⴽⵓⴷ Check-In QR ⵏⵏⴽ ⴳ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ :\n${activeClientContext.token}\n${activeClientContext.qrPayload}`,
    en: `Hello ${activeClientContext.clientName}, here is your Salon Boumlik Check-In QR code:\nToken: ${activeClientContext.token}\n${activeClientContext.qrPayload}`,
    es: `Hola ${activeClientContext.clientName}, aquí tienes tu código QR Check-In de Salon Boumlik:\nCódigo: ${activeClientContext.token}\n${activeClientContext.qrPayload}`,
  });

  return (
    <ModalPortal>
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 sb-modal-backdrop overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-generator-modal-title"
      >
        <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-[#141720] border border-amber-300 dark:border-amber-500/40 shadow-2xl overflow-hidden my-auto">
          {/* Top Modal Header */}
          <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-[#191D28] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="qr-generator-modal-title"
                  className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate"
                >
                  {ui.title}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{ui.subtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={ui.closeAria}
              className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Grid */}
          <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Left Column */}
            <div className="md:col-span-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('booking');
                    setLastAttributedMsg(null);
                  }}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    mode === 'booking'
                      ? 'bg-amber-500 text-black'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>{ui.modeBooking}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('walkin');
                    setLastAttributedMsg(null);
                  }}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    mode === 'walkin'
                      ? 'bg-amber-500 text-black'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{ui.modeWalkin}</span>
                </button>
              </div>

              {mode === 'booking' ? (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      placeholder={ui.searchPlaceholder}
                      className="w-full min-h-[40px] bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl ps-9 pe-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 pe-0.5">
                    {eligibleBookings.length === 0 ? (
                      <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-center text-slate-500 dark:text-zinc-400">
                        {ui.emptyBookings}
                      </div>
                    ) : (
                      eligibleBookings.map((b) => {
                        const isSelected = selectedBooking?.id === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setSelectedBookingId(b.id);
                              setLastAttributedMsg(null);
                            }}
                            className={`w-full p-2.5 rounded-xl border text-start transition-all cursor-pointer flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-500 text-slate-900 dark:text-white'
                                : 'bg-stone-50 dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-stone-300 dark:hover:border-zinc-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-bold truncate">{b.clientName}</div>
                              <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono truncate" dir="ltr">
                                {b.ticketNumber} · {b.date} ({b.timeSlot})
                              </div>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold flex-shrink-0 ${
                                b.status === 'completed'
                                  ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300'
                                  : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {b.status === 'completed' ? ui.completedBadge : ui.expectedBadge}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                      {ui.walkinNameLabel}
                    </label>
                    <input
                      type="text"
                      value={walkinName}
                      onChange={(e) => setWalkinName(e.target.value)}
                      placeholder={ui.walkinNamePlaceholder}
                      className="w-full min-h-[40px] bg-white dark:bg-zinc-950 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                      {ui.walkinPhoneLabel}
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      value={walkinPhone}
                      onChange={(e) => setWalkinPhone(e.target.value)}
                      placeholder="06XXXXXXXX"
                      className="w-full min-h-[40px] bg-white dark:bg-zinc-950 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white text-left focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                      {ui.barberLabel}
                    </label>
                    <select
                      value={walkinBarberId}
                      onChange={(e) => setWalkinBarberId(e.target.value)}
                      className="w-full min-h-[40px] bg-white dark:bg-zinc-950 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    >
                      {mergedBarbers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name[lang] || b.name.fr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleRegenerateToken}
                    className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{ui.regenerateBtn}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="md:col-span-6 p-4 sm:p-5 rounded-2xl bg-stone-50 dark:bg-[#191D28] border border-stone-200 dark:border-zinc-800 flex flex-col items-center justify-between gap-3.5 text-center">
              <div className="w-full space-y-1">
                <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {activeClientContext.clientName}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                  <span className="text-amber-700 dark:text-amber-300 font-bold">{activeClientContext.token}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                    {activeClientContext.pointsBalance} {ui.pointsUnit}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeClientContext.verifiedVisits} {ui.visitsUnit}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white border-4 border-stone-200 dark:border-zinc-800 shadow-lg w-44 h-44 flex items-center justify-center">
                {isGenerating || !qrDataUrl ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
                ) : (
                  <img
                    src={qrDataUrl}
                    alt={`Check-In QR ${activeClientContext.token}`}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="w-full space-y-2">
                <button
                  type="button"
                  disabled={isAwardingPoints}
                  onClick={() => void handleQuickAwardPoints(POINTS_PER_VISIT)}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 cursor-pointer disabled:opacity-60 transition-colors"
                >
                  <Award className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {isAwardingPoints
                      ? ui.awarding
                      : mode === 'booking' &&
                        selectedBooking &&
                        !activeClientContext.isBookingCompleted
                      ? ui.confirmAndAward
                      : ui.awardArrivalOnly}
                  </span>
                </button>

                {lastAttributedMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{lastAttributedMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={handleDownloadQrPng}
                    disabled={!qrDataUrl}
                    className="min-h-[38px] px-2 py-1.5 rounded-xl bg-white hover:bg-stone-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-stone-200 dark:border-zinc-700 text-slate-900 dark:text-white font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="min-h-[38px] px-2 py-1.5 rounded-xl bg-white hover:bg-stone-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-stone-200 dark:border-zinc-700 text-slate-900 dark:text-white font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedPayload ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    )}
                    <span>{copiedPayload ? ui.copied : ui.copy}</span>
                  </button>

                  {clientWa ? (
                    <a
                      href={`https://wa.me/${clientWa}?text=${encodeURIComponent(waText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{ui.whatsapp}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleQuickAwardPoints(20)}
                      disabled={isAwardingPoints}
                      className="min-h-[38px] px-2 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>+20</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
