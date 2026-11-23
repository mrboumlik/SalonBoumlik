import React, { useMemo, useState } from 'react';
import {
  MapPin,
  Star,
  Scissors,
  Ticket,
  MessageCircle,
  Instagram,
  Facebook,
  Phone,
  Wifi,
  ShieldCheck,
  Navigation,
  X,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import {
  useSalonProfileSettings,
  formatSalonDisplayPhone,
  normalizeSalonTelHref,
  normalizeSalonWhatsappDigits,
} from '../utils/salonSettingsStore';
import { pickLang } from '../utils/i18n';
import { safeCopyToClipboard } from '../utils/safeBrowser';
import { ModalPortal } from './ModalPortal';
import heroLogoImage from '../assets/images/regenerated_image_1793760774705.png';

interface HeroProps {
  onOpenBooking: () => void;
  onOpenTrackBooking?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking, onOpenTrackBooking }) => {
  const { lang, t } = useLanguage();
  const salonSettings = useSalonProfileSettings();
  const [isWifiModalOpen, setIsWifiModalOpen] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);

  const isOpenNow = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    if (day === 5) return hour >= 15 && hour < 22;
    return (hour >= 11 && hour < 13) || (hour >= 16 && hour < 22);
  }, []);

  const handleCopyWifi = () => {
    void safeCopyToClipboard(SALON_INFO.media.wifiPassword);
    setCopiedWifi(true);
    setTimeout(() => setCopiedWifi(false), 2000);
  };

  const labels = {
    bookNow: pickLang(lang, {
      ar: 'احجز موعد',
      fr: 'Réserver un rendez-vous',
      amz: 'ⵃⵊⵣ ⴰⵙⵉⵀⵍ',
      en: 'Book Appointment',
      es: 'Reservar cita',
    }),
    trackBooking: pickLang(lang, {
      ar: 'تتبع الموعد',
      fr: 'Suivre mon rendez-vous',
      amz: 'ⴹⴼⵕ ⴰⵙⵉⵀⵍ',
      en: 'Track Appointment',
      es: 'Seguir mi cita',
    }),
    whatsapp: pickLang(lang, {
      ar: 'واتساب',
      fr: 'WhatsApp',
      amz: 'ⵡⴰⵜⵙⴰⴱ',
      en: 'WhatsApp',
      es: 'WhatsApp',
    }),
    directions: pickLang(lang, {
      ar: 'الاتجاهات',
      fr: 'Itinéraire',
      amz: 'ⴰⵖⴰⵔⴰⵙ',
      en: 'Directions',
      es: 'Cómo llegar',
    }),
    wifiTitle: pickLang(lang, {
      ar: 'واي فاي مجاني بالصالون',
      fr: 'Wi-Fi Gratuit du Salon',
      amz: 'ⵡⴰⵢ-ⴼⴰⵢ ⴼⴰⴱⵓⵕ',
      en: 'Free Salon Wi-Fi',
      es: 'Wi-Fi Gratis del Salón',
    }),
    copyWifi: pickLang(lang, {
      ar: 'نسخ كلمة المرور',
      fr: 'Copier le mot de passe',
      amz: 'ⵏⵖⵍ ⵜⴰⴳⵓⵔⵉ ⵏ ⵓⵣⵔⴰⵢ',
      en: 'Copy Wi-Fi Password',
      es: 'Copiar contraseña',
    }),
    copiedWifi: pickLang(lang, {
      ar: 'تم النسخ!',
      fr: 'Mot de passe copié !',
      amz: 'ⵉⵜⵜⵓⵏⵖⴰⵍ!',
      en: 'Copied!',
      es: '¡Copiado!',
    }),
    wifiAria: pickLang(lang, {
      ar: 'واي فاي الصالون',
      fr: 'Wi-Fi du salon',
      amz: 'ⵡⴰⵢ-ⴼⴰⵢ',
      en: 'Salon Wi-Fi',
      es: 'Wi-Fi del salón',
    }),
    callAria: pickLang(lang, {
      ar: 'اتصال هاتفي',
      fr: 'Appeler le salon',
      amz: 'ⵜⵉⵍⵉⴼⵓⵏ',
      en: 'Call salon',
      es: 'Llamar al salón',
    }),
    closeLabel: pickLang(lang, {
      ar: 'إغلاق',
      fr: 'Fermer',
      amz: 'ⵇⵇⵏ',
      en: 'Close',
      es: 'Cerrar',
    }),
  };

  return (
    <section className="relative pt-5 pb-6 sm:pt-8 sm:pb-8 bg-[#FAF9F6] dark:bg-[#0B0C10]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-3.5">
        {/* Clean Compact Salon Header Card */}
        <div className="rounded-3xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-5 sm:p-6 shadow-xs space-y-5">
          {/* Centered Salon Identity & Balanced Social Icons */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 sm:w-[74px] sm:h-[74px] rounded-2xl p-1.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700/80 flex items-center justify-center shadow-2xs">
              <img
                src={heroLogoImage || SALON_INFO.media.logoClean}
                alt="Salon Boumlik"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-1.5 max-w-lg mx-auto">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-slate-900 dark:text-white leading-tight">
                SALON{' '}
                <span className="text-amber-700 dark:text-amber-400">
                  BOUMLIK
                </span>
              </h1>

              <p className="text-xs sm:text-sm font-medium text-stone-700 dark:text-zinc-300 leading-relaxed text-balance">
                {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
              </p>

              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-zinc-400 leading-snug text-balance">
                {SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-1 text-[11px] text-stone-500 dark:text-zinc-400">
                <span
                  className={
                    isOpenNow
                      ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                      : 'font-semibold text-amber-700 dark:text-amber-400'
                  }
                >
                  {isOpenNow ? t.openStatus : t.closedStatus}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span>5.0 Google</span>
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-stone-400 dark:text-zinc-500" />
                  <span>{t.mensOnly}</span>
                </span>
              </div>
            </div>

            {/* Centered, Evenly Spaced Muted Monochrome Social & Utility Icons */}
            <div className="flex items-center justify-center gap-4 pt-1">
              <a
                href={SALON_INFO.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @SalonBoumlik"
                title="Instagram @SalonBoumlik"
                className="w-10 h-10 rounded-xl bg-stone-100/80 hover:bg-stone-200/90 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 border border-stone-200/80 dark:border-zinc-800/90 hover:border-stone-300 dark:hover:border-zinc-700 text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 flex items-center justify-center transition-all duration-200 active:scale-95"
              >
                <Instagram className="w-4 h-4" />
              </a>

              <a
                href={SALON_INFO.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook Salon Boumlik"
                title="Facebook Salon Boumlik"
                className="w-10 h-10 rounded-xl bg-stone-100/80 hover:bg-stone-200/90 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 border border-stone-200/80 dark:border-zinc-800/90 hover:border-stone-300 dark:hover:border-zinc-700 text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 flex items-center justify-center transition-all duration-200 active:scale-95"
              >
                <Facebook className="w-4 h-4" />
              </a>

              <a
                href={normalizeSalonTelHref(salonSettings.salonPhone)}
                aria-label={labels.callAria}
                title={formatSalonDisplayPhone(salonSettings.salonPhone)}
                className="w-10 h-10 rounded-xl bg-stone-100/80 hover:bg-stone-200/90 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 border border-stone-200/80 dark:border-zinc-800/90 hover:border-stone-300 dark:hover:border-zinc-700 text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 flex items-center justify-center transition-all duration-200 active:scale-95"
              >
                <Phone className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => setIsWifiModalOpen(true)}
                aria-label={labels.wifiAria}
                title={labels.wifiAria}
                className="w-10 h-10 rounded-xl bg-stone-100/80 hover:bg-stone-200/90 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 border border-stone-200/80 dark:border-zinc-800/90 hover:border-stone-300 dark:hover:border-zinc-700 text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
              >
                <Wifi className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Focused Primary Action Stack (Direct Modal Booking -> Track -> WhatsApp & Directions) */}
          <div className="space-y-2.5 pt-1.5">
            {/* 1. Primary Large Booking Button */}
            <button
              type="button"
              onClick={onOpenBooking}
              className="w-full min-h-[54px] px-6 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white font-black text-base flex items-center justify-center gap-2.5 shadow-sm transition-all duration-150 cursor-pointer"
            >
              <Scissors className="w-5 h-5" />
              <span>{labels.bookNow}</span>
            </button>

            {/* 2. Matching-Weight Track Appointment Button directly below */}
            {onOpenTrackBooking && (
              <button
                type="button"
                onClick={onOpenTrackBooking}
                className="w-full min-h-[50px] px-5 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-slate-900 dark:text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.99]"
              >
                <Ticket className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>{labels.trackBooking}</span>
              </button>
            )}

            {/* 3. Side-by-Side WhatsApp + Directions Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={`https://wa.me/${normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 dark:border-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <MessageCircle className="w-4 h-4 text-white" />
                <span>{labels.whatsapp}</span>
              </a>

              <a
                href={salonSettings.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-white hover:bg-stone-50 dark:bg-zinc-950/80 dark:hover:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Navigation className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>{labels.directions}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Wi-Fi QR Popup */}
      {isWifiModalOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => setIsWifiModalOpen(false)}
          >
            <div
              className="bg-white dark:bg-[#111318] border border-stone-200 dark:border-zinc-800 rounded-3xl p-6 max-w-xs w-full shadow-2xl relative text-center space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsWifiModalOpen(false)}
                aria-label={labels.closeLabel}
                className="absolute top-3.5 right-3.5 rtl:right-auto rtl:left-3.5 p-2 rounded-xl text-stone-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-sm font-black text-slate-900 dark:text-white pt-1">
                {labels.wifiTitle}
              </h3>

              <div className="p-3 bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 inline-block">
                <img
                  src={SALON_INFO.media.qrWifi}
                  alt="Wi-Fi QR Code"
                  className="w-44 h-44 object-contain mx-auto rounded-lg"
                />
              </div>

              <div className="p-3 bg-stone-100 dark:bg-zinc-900 rounded-xl text-start text-xs space-y-1">
                <div className="flex justify-between items-center text-stone-500 dark:text-zinc-400">
                  <span>SSID:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                    {SALON_INFO.media.wifiSsid}
                  </span>
                </div>
                <div className="flex justify-between items-center text-stone-500 dark:text-zinc-400">
                  <span>Code:</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400" dir="ltr">
                    {SALON_INFO.media.wifiPassword}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyWifi}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copiedWifi ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedWifi ? labels.copiedWifi : labels.copyWifi}</span>
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  );
};
