import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  X,
  Search,
  Camera,
  Upload,
  UserCheck,
  AlertCircle,
  Loader2,
  QrCode,
  CheckCircle2,
  UserPlus,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc } from 'firebase/firestore';
import { AppointmentBooking, CrmClientProfile, Language } from '../types';
import {
  fetchAllBookingsOnce,
  findBookingsUniversal,
  normalizeMoroccanPhoneDigits,
} from '../utils/bookingStore';
import { getCrmDocId } from '../utils/crmStore';
import { parseScannedQrResult, scanQrImageFile } from '../utils/clientQr';
import { computeClientPointsSummary, getVerifiedVisitsCount } from '../utils/loyaltyEngine';
import { db } from '../utils/firebase';
import { pickLang } from '../utils/i18n';
import { safeCompareDesc } from '../utils/safeCoerce';
import { ModalPortal } from './ModalPortal';

export interface RecognizedClientData {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  preferredBarberId?: string;
  loyaltyPoints: number;
  verifiedVisits: number;
  isVip: boolean;
  isBanned: boolean;
  customDiscountMAD: number;
  pastBookings: AppointmentBooking[];
}

interface ReturningClientLookupModalProps {
  isOpen: boolean;
  lang: Language;
  liveBookings: AppointmentBooking[];
  crmClientsMap: Record<string, CrmClientProfile>;
  onClose: () => void;
  onRecognized: (profile: RecognizedClientData) => void;
  onSwitchToFirstTime: () => void;
}

export const ReturningClientLookupModal: React.FC<ReturningClientLookupModalProps> = ({
  isOpen,
  lang,
  liveBookings,
  crmClientsMap,
  onClose,
  onRecognized,
  onSwitchToFirstTime,
}) => {
  const [queryInput, setQueryInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsCameraOpen(false);
      setCameraError(null);
      setLookupError(null);
    }
  }, [isOpen]);

  // Camera QR Scanner using Html5Qrcode rear camera
  useEffect(() => {
    if (!isOpen || !isCameraOpen) return;

    let html5Qr: Html5Qrcode | null = null;
    let isStopped = false;

    const timer = setTimeout(async () => {
      try {
        const el = document.getElementById('returning-client-qr-reader');
        if (!el) return;

        html5Qr = new Html5Qrcode('returning-client-qr-reader');
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
          (decodedText) => {
            if (isStopped) return;
            isStopped = true;
            const parsed = parseScannedQrResult(decodedText);
            const lookup = parsed.clientId || parsed.query || decodedText.trim();
            if (html5Qr && html5Qr.isScanning) {
              html5Qr.stop().then(() => html5Qr?.clear()).catch(console.error);
            }
            setIsCameraOpen(false);
            setQueryInput(lookup);
            void handleVerifyClient(lookup);
          },
          () => {
            // ignore scanning frame noise
          }
        );
      } catch (err: any) {
        setCameraError(
          err?.message ||
            pickLang(lang, {
              ar: 'تعذر فتح الكاميرا. يمكنك رفع صورة رمز QR أو إدخال رقم الهاتف يدوياً.',
              fr: 'Impossible d’accéder à la caméra. Importez une image QR ou saisissez votre numéro.',
              amz: 'ⵓⵔ ⵉⵏⵏⵓⵕⵥⵎ ⵓⴽⴰⵎⵉⵔⴰ. ⵙⵙⴽⵛⵎ ⵜⴰⵡⵍⴰⴼⵜ QR ⵏⵖ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ.',
              en: 'Unable to access camera. Upload a QR image or type your phone number.',
              es: 'No se pudo abrir la cámara. Sube una imagen QR o escribe tu teléfono.',
            })
        );
      }
    }, 220);

    return () => {
      isStopped = true;
      clearTimeout(timer);
      if (html5Qr && html5Qr.isScanning) {
        html5Qr.stop().then(() => html5Qr?.clear()).catch(console.error);
      }
    };
  }, [isOpen, isCameraOpen]);

  const handleVerifyClient = async (overrideQuery?: string) => {
    const raw = (overrideQuery ?? queryInput).trim();
    if (!raw) {
      setLookupError(
        pickLang(lang, {
          ar: 'يرجى إدخال رقم الهاتف أو رقم التذكرة (#SB-1234) أو مسح رمز QR.',
          fr: 'Veuillez saisir votre téléphone, numéro de ticket (#SB-1234) ou scanner votre QR.',
          amz: 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⵏⵖ #SB-1234 ⵏⵖ ⵙⴽⴰⵏ QR.',
          en: 'Please enter your phone number, ticket ID (#SB-1234), or scan your QR code.',
          es: 'Introduce tu teléfono, número de ticket (#SB-1234) o escanea tu código QR.',
        })
      );
      return;
    }

    const parsedQr = parseScannedQrResult(raw);
    const searchKey = parsedQr.query || raw;

    setIsSearching(true);
    setLookupError(null);

    try {
      // Query fresh Cloud Firestore bookings in addition to real-time cache
      let sourceBookings = liveBookings;
      try {
        const fresh = await fetchAllBookingsOnce();
        if (fresh && fresh.length > 0) {
          sourceBookings = fresh;
        }
      } catch {
        // Fallback smoothly to subscribed snapshot cache
      }

      const matchedBookings = findBookingsUniversal(searchKey, sourceBookings);
      const firstMatch = matchedBookings[0];

      // Determine canonical phone & CRM doc ID to also verify directly in crm_clients collection
      const candidateCid =
        parsedQr.clientId ||
        (firstMatch ? getCrmDocId(firstMatch.clientPhone) : getCrmDocId(searchKey));

      let crmProfile: CrmClientProfile | undefined =
        crmClientsMap[candidateCid] ||
        Object.values(crmClientsMap).find((c) => {
          const norm = normalizeMoroccanPhoneDigits(searchKey);
          return norm.length >= 6 && c.normalizedPhone === norm;
        });

      if (!crmProfile && candidateCid && /^c_[a-zA-Z0-9_-]+$/.test(candidateCid)) {
        try {
          const crmSnap = await getDoc(doc(db, 'crm_clients', candidateCid));
          if (crmSnap.exists()) {
            crmProfile = { ...(crmSnap.data() as CrmClientProfile), id: crmSnap.id };
          }
        } catch {
          // ignore if direct read misses
        }
      }

      if (!firstMatch && !crmProfile) {
        setLookupError(
          pickLang(lang, {
            ar: 'لم نجد سجلاً مطابقاً في قاعدة البيانات. تأكد من رقم الهاتف أو التذكرة، أو متابعة كحجز جديد.',
            fr: 'Aucun profil trouvé pour ces informations. Vérifiez votre numéro/ticket ou continuez en tant que nouveau client.',
            amz: 'ⵓⵔ ⵏⵓⴼⵉ ⴰⵎⵉⴹⴰⵏ ⵉ ⵉⵏⵖⵎⵉⵙⵏ ⴰⴷ. ⵥⵕ ⵓⵟⵟⵓⵏ ⵏⵏⴽ ⵏⵖ ⴽⵎⵎⵍ ⴰⵎ ⴰⵎⵙⴰⵖ ⴰⵎⴰⵢⵏⵓ.',
            en: 'No matching client record was found. Double-check your phone/ticket ID or proceed as First Time.',
            es: 'No se encontró ningún registro coincidente. Verifica tu número/ticket o continúa como nuevo cliente.',
          })
        );
        return;
      }

      const resolvedPhone =
        firstMatch?.clientPhone || crmProfile?.phoneDisplay || crmProfile?.normalizedPhone || searchKey;
      const cleanDigits = normalizeMoroccanPhoneDigits(resolvedPhone);

      const historyForClient =
        cleanDigits.length >= 6
          ? sourceBookings
              .filter((b) => normalizeMoroccanPhoneDigits(b.clientPhone) === cleanDigits)
              .sort((a, b) => safeCompareDesc(a.createdAt, b.createdAt))
          : matchedBookings;

      const resolvedName =
        crmProfile?.clientName ||
        firstMatch?.clientName ||
        pickLang(lang, { ar: 'زبون كريم', fr: 'Client', amz: 'ⴰⵎⵙⴰⵖ', en: 'Client', es: 'Cliente' });
      const resolvedEmail = historyForClient.find((b) => b.clientEmail)?.clientEmail;
      const preferredBarberId = historyForClient.find(
        (b) => !['cancelled', 'rejected'].includes(b.status)
      )?.barberId;

      const verifiedVisits = getVerifiedVisitsCount(historyForClient, crmProfile);
      const pointsSummary = computeClientPointsSummary(verifiedVisits, crmProfile, historyForClient);

      onRecognized({
        clientName: resolvedName,
        clientPhone: resolvedPhone,
        clientEmail: resolvedEmail,
        preferredBarberId,
        loyaltyPoints: pointsSummary.pointsBalance,
        verifiedVisits,
        isVip: Boolean(crmProfile?.isVip),
        isBanned: Boolean(crmProfile?.isBanned),
        customDiscountMAD: crmProfile?.customDiscountMAD ?? 0,
        pastBookings: historyForClient,
      });
      onClose();
    } finally {
      setIsSearching(false);
    }
  };

  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLookupError(null);
    setCameraError(null);
    try {
      const decodedText = await scanQrImageFile(file, 'returning-qr-file-temp');
      const parsed = parseScannedQrResult(decodedText);
      const lookup = parsed.clientId || parsed.query || decodedText.trim();
      setQueryInput(lookup);
      await handleVerifyClient(lookup);
    } catch {
      setLookupError(
        pickLang(lang, {
          ar: 'تعذر قراءة رمز QR من الصورة المرفوعة. جرب صورة أوضح أو أدخل رقم هاتفك.',
          fr: 'Impossible de lire le QR code sur cette image. Essayez une image plus nette ou saisissez votre numéro.',
          amz: 'ⵓⵔ ⵉⵜⵜⵓⵖⵔⴰ ⵓⴽⵓⴷ QR ⴳ ⵜⵡⵍⴰⴼⵜ ⴰⴷ. ⴰⵔⵎ ⵜⴰⵡⵍⴰⴼⵜ ⵢⴰⴹⵏ ⵏⵖ ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ.',
          en: 'Could not decode QR code from this image. Try a clearer image or type your phone.',
          es: 'No se pudo leer el código QR de la imagen. Prueba otra imagen o escribe tu teléfono.',
        })
      );
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleOpenCamera = async () => {
    setCameraError(null);
    setIsCameraOpen((prev) => !prev);
  };

  return (
    <ModalPortal>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="returning-lookup-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-2 sm:p-4 sb-modal-backdrop"
              onClick={onClose}
            >
              <motion.div
                key="returning-lookup-dialog"
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg max-h-[88vh] overflow-y-auto overscroll-contain bg-white dark:bg-[#11141D] border border-stone-200 dark:border-zinc-800 rounded-3xl shadow-2xl"
              >
              <div className="p-4 sm:p-5 space-y-3.5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/12 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white leading-tight">
                        {pickLang(lang, {
                          ar: 'أنا زبون دائم • التعرف السريع',
                          fr: 'Client Fidèle • Reconnaissance Rapide',
                          amz: 'ⴰⵎⵙⴰⵖ ⴰⵇⴱⵓⵔ • ⴰⵙⵏⵓⴱⴳ ⴰⵣⵔⴰⴱ',
                          en: 'Returning Client Lookup',
                          es: 'Cliente Habitual • Acceso Rápido',
                        })}
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                        {pickLang(lang, {
                          ar: 'استرجع بياناتك ونقاط الولاء تلقائياً',
                          fr: 'Retrouvez vos infos et points en 1 seconde',
                          amz: 'ⵔⴰⵔⴷ ⵉⵙⵎ ⵏⵏⴽ ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵏⵏⴽ',
                          en: 'Auto-fill your details & loyalty points',
                          es: 'Recupera tus datos y puntos de fidelidad',
                        })}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="min-w-[40px] min-h-[40px] rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Close lookup modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

          {/* Lookup Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleVerifyClient();
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                {pickLang(lang, {
                  ar: 'رقم الهاتف أو رقم التذكرة (مثل 0635392503 أو #SB-1234)',
                  fr: 'Téléphone ou Numéro de Ticket (ex : 06... ou #SB-1234)',
                  amz: 'ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⵏⵖ ⵓⵜⵉⴽⵉ (#SB-1234)',
                  en: 'Phone Number or Ticket ID (e.g. 06... or #SB-1234)',
                  es: 'Teléfono o Número de Ticket (ej: 06... o #SB-1234)',
                })}
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  dir="ltr"
                  value={queryInput}
                  onChange={(e) => {
                    setQueryInput(e.target.value);
                    if (lookupError) setLookupError(null);
                  }}
                  placeholder="06 35 39 25 03  /  #SB-1234"
                  autoFocus
                  className="w-full min-h-[46px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl ps-10 pe-3.5 py-2.5 text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {pickLang(lang, {
                      ar: 'جاري التحقق من قاعدة البيانات...',
                      fr: 'Vérification en cours...',
                      amz: 'ⴰⵙⵉⵜⴳ...',
                      en: 'Verifying...',
                      es: 'Verificando...',
                    })}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {pickLang(lang, {
                      ar: 'تحقق واسترجاع حسابي الآن',
                      fr: 'Vérifier et Pré-remplir mes Coordonnées',
                      amz: 'ⵙⵙⵏⵜⵎ ⴷ ⵔⴰⵔⴷ ⴰⵎⵉⴹⴰⵏ ⵉⵏⵓ',
                      en: 'Verify & Auto-Fill My Details',
                      es: 'Verificar y Rellenar Mis Datos',
                    })}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-semibold">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span>
              {pickLang(lang, {
                ar: 'أو عبر مسح رمز QR التذكرة / البطاقة',
                fr: 'Ou via QR Code',
                amz: 'ⵏⵖ ⵙ QR Code',
                en: 'Or via QR Code',
                es: 'O mediante código QR',
              })}
            </span>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {/* QR Camera Scan & Image Upload Options */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleOpenCamera}
              className={`min-h-[44px] py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                isCameraOpen
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-stone-50 dark:bg-zinc-900 hover:bg-stone-100 dark:hover:bg-zinc-800 border-stone-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-amber-500/50'
              }`}
            >
              <Camera className={`w-4 h-4 ${isCameraOpen ? 'text-black' : 'text-amber-600 dark:text-amber-400'}`} />
              <span>
                {isCameraOpen
                  ? pickLang(lang, {
                      ar: 'إغلاق الكاميرا',
                      fr: 'Fermer Caméra',
                      amz: 'ⵇⵇⵏ ⵜⴰⴽⴰⵎⵉⵔⴰⵜ',
                      en: 'Close Camera',
                      es: 'Cerrar Cámara',
                    })
                  : pickLang(lang, {
                      ar: 'مسح بالكاميرا',
                      fr: 'Scanner Caméra',
                      amz: 'ⵙⴽⴰⵏ ⵙ ⵜⴽⴰⵎⵉⵔⴰⵜ',
                      en: 'Scan Camera',
                      es: 'Escanear Cámara',
                    })}
              </span>
            </button>

            <label className="min-h-[44px] py-2 px-3 rounded-xl bg-stone-50 dark:bg-zinc-900 hover:bg-stone-100 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 hover:border-amber-500/50 text-zinc-800 dark:text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
              <Upload className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                {pickLang(lang, {
                  ar: 'رفع صورة QR',
                  fr: 'Importer Image QR',
                  amz: 'ⵙⵙⴽⵛⵎ ⵜⴰⵡⵍⴰⴼⵜ QR',
                  en: 'Upload QR Image',
                  es: 'Subir Imagen QR',
                })}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleQrImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Active Camera Scanner Container */}
          <AnimatePresence>
            {isCameraOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-2.5 rounded-2xl bg-black border border-zinc-800 space-y-2 text-center">
                  <div className="text-[11px] text-zinc-300 flex items-center justify-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {pickLang(lang, {
                        ar: 'وجّه الكاميرا نحو رمز QR التذكرة أو بطاقة الولاء',
                        fr: 'Placez le QR code face à la caméra',
                        amz: 'ⵙⵏⵎⴰⵍⴰ ⵜⴰⴽⴰⵎⵉⵔⴰⵜ ⵉ QR Code',
                        en: 'Point camera at ticket or loyalty QR code',
                        es: 'Apunta la cámara al código QR',
                      })}
                    </span>
                  </div>
                  <div
                    id="returning-client-qr-reader"
                    className="w-full rounded-xl overflow-hidden bg-zinc-950 min-h-[200px]"
                  />
                  {cameraError && (
                    <p className="text-[11px] text-red-400 font-medium">{cameraError}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Feedback */}
          {lookupError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{lookupError}</span>
            </div>
          )}

              {/* Fallback Switch to First-Time Booking */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">
                  {pickLang(lang, {
                    ar: 'أول مرة تزورنا؟',
                    fr: 'Première visite ?',
                    amz: 'ⵜⵉⵔⵣⵉ ⵜⴰⵎⵣⵡⴰⵔⵓⵜ?',
                    en: 'First visit?',
                    es: '¿Primera visita?',
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onSwitchToFirstTime();
                    onClose();
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {pickLang(lang, {
                      ar: 'حجز جديد',
                      fr: 'Nouvelle Réservation',
                      amz: 'ⴰⵙⵔⵓⵙ ⴰⵎⴰⵢⵏⵓ',
                      en: 'New Booking',
                      es: 'Nueva Reserva',
                    })}
                  </span>
                </button>
              </div>
              </div>

              {/* Hidden node required by Html5Qrcode.scanFile */}
              <div id="returning-qr-file-temp" className="hidden" aria-hidden="true" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
    </ModalPortal>
  );
};
