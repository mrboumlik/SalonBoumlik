import React, { useMemo, useRef, useState } from 'react';
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
  Maximize2,
  Minimize2,
  Shield,
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
import { buildWhatsAppInquiryMessage } from '../utils/whatsappAutomation';
import {
  SALON_WIFI_CONFIG,
  buildSalonWifiUri,
  copyWifiPasswordSafely,
  copyWifiSsidSafely,
} from '../utils/wifiConnect';
import { ModalPortal } from './ModalPortal';
import { BrandMark } from './BrandMark';

interface HeroProps {
  onOpenBooking: () => void;
  onOpenTrackBooking?: () => void;
  onOpenAdmin?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onOpenBooking,
  onOpenTrackBooking,
  onOpenAdmin,
}) => {
  const { lang, t } = useLanguage();
  const salonSettings = useSalonProfileSettings();
  const [isWifiModalOpen, setIsWifiModalOpen] = useState(false);
  const [isWifiQrZoomed, setIsWifiQrZoomed] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [copiedSsid, setCopiedSsid] = useState(false);
  const [quickConnectHint, setQuickConnectHint] = useState(false);
  const [hoveredSocialHint, setHoveredSocialHint] = useState<string | null>(null);
  const logoTapTimestampsRef = useRef<number[]>([]);

  const handleBrandLogoClick = () => {
    if (!onOpenAdmin) return;
    const now = Date.now();
    const recent = logoTapTimestampsRef.current.filter((ts) => now - ts <= 700);
    recent.push(now);
    logoTapTimestampsRef.current = recent;
    if (recent.length >= 3) {
      logoTapTimestampsRef.current = [];
      onOpenAdmin();
    }
  };

  const isOpenNow = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    if (day === 5) return hour >= 15 && hour < 22;
    return (hour >= 11 && hour < 13) || (hour >= 16 && hour < 22);
  }, []);

  const handleCopyWifi = () => {
    void copyWifiPasswordSafely();
    setCopiedWifi(true);
    setTimeout(() => setCopiedWifi(false), 2200);
  };

  const handleCopySsid = () => {
    void copyWifiSsidSafely();
    setCopiedSsid(true);
    setTimeout(() => setCopiedSsid(false), 2000);
  };

  const handleQuickConnectWifi = () => {
    void copyWifiPasswordSafely();
    setCopiedWifi(true);
    setQuickConnectHint(true);
    setTimeout(() => setCopiedWifi(false), 2200);
    setTimeout(() => setQuickConnectHint(false), 5000);
  };

  const wifiUri = buildSalonWifiUri();
  const heroWhatsappHref = useMemo(() => {
    const digits = normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp);
    const text = buildWhatsAppInquiryMessage({
      lang,
      requestType: 'inquiry',
      includeMessagePrompt: true,
    });
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }, [lang, salonSettings.salonWhatsapp]);

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
    socialTitle: pickLang(lang, {
      ar: 'مواقع التواصل:',
      fr: 'Réseaux sociaux :',
      amz: 'ⵉⵥⴹⵡⴰⵏ :',
      en: 'Social Media:',
      es: 'Redes sociales:',
    }),
    instagramLabel: pickLang(lang, {
      ar: 'إنستغرام',
      fr: 'Instagram',
      amz: 'إنستغرام',
      en: 'Instagram',
      es: 'Instagram',
    }),
    facebookLabel: pickLang(lang, {
      ar: 'فيسبوك',
      fr: 'Facebook',
      amz: 'فيسبوك',
      en: 'Facebook',
      es: 'Facebook',
    }),
    callLabel: pickLang(lang, {
      ar: 'اتصال',
      fr: 'Appeler',
      amz: 'ⵜⵉⵍⵉⴼⵓⵏ',
      en: 'Call',
      es: 'Llamar',
    }),
    wifiBtnLabel: pickLang(lang, {
      ar: 'واي فاي مجاني',
      fr: 'Wi-Fi Gratuit',
      amz: 'Wi-Fi',
      en: 'Free Wi-Fi',
      es: 'Wi-Fi Gratis',
    }),
    wifiTitle: pickLang(lang, {
      ar: 'واي فاي مجاني بالصالون',
      fr: 'Wi-Fi Gratuit du Salon',
      amz: 'ⵡⴰⵢ-ⴼⴰⵢ ⴼⴰⴱⵓⵕ',
      en: 'Free Salon Wi-Fi',
      es: 'Wi-Fi Gratis del Salón',
    }),
    wifiSubtitle: pickLang(lang, {
      ar: 'امسح الباركود أو استخدم الاتصال السريع وكلمة المرور أدناه',
      fr: 'Scannez le QR ou connectez-vous directement avec les identifiants',
      amz: 'ⵙⴽⴰⵏ ⴱⴰⵔⴽⵓⴷ ⵏⵖ ⵙⵎⵔⵙ ⵜⴰⴳⵓⵔⵉ ⵏ ⵓⵣⵔⴰⵢ',
      en: 'Scan the QR code or use quick connect & credentials below',
      es: 'Escanea el QR o conéctate directamente con las credenciales',
    }),
    ssidLabel: pickLang(lang, {
      ar: 'اسم الشبكة (SSID):',
      fr: 'Réseau (SSID) :',
      amz: 'ⴰⵥⵟⵟⴰ (SSID):',
      en: 'Network (SSID):',
      es: 'Red (SSID):',
    }),
    securityLabel: pickLang(lang, {
      ar: 'الحماية:',
      fr: 'Sécurité :',
      amz: 'ⵜⴰⵏⴼⵔⵓⵜ:',
      en: 'Security:',
      es: 'Seguridad:',
    }),
    passLabel: pickLang(lang, {
      ar: 'كلمة المرور:',
      fr: 'Mot de passe :',
      amz: 'ⴰⵙⴰⵔⵓⵜ:',
      en: 'Password:',
      es: 'Contraseña:',
    }),
    quickConnectWifi: pickLang(lang, {
      ar: 'اتصال مباشر بالواي فاي',
      fr: 'Connexion rapide Wi-Fi',
      amz: 'ⴰⵎⵢⴰⵡⴰⴹ ⵓⵙⵔⵉⴷ Wi-Fi',
      en: 'Quick-Connect Wi-Fi',
      es: 'Conexión rápida Wi-Fi',
    }),
    quickConnectNote: pickLang(lang, {
      ar: 'تم نسخ كلمة المرور (@SalonBoumlik). إذا لم يفتح الاتصال التلقائي على جهازك، اختر شبكة @SalonBoumlik من إعدادات الواي فاي والصق كلمة المرور.',
      fr: 'Mot de passe copié (@SalonBoumlik). Si votre appareil ne lance pas la connexion auto, sélectionnez @SalonBoumlik dans vos réglages Wi-Fi.',
      amz: 'ⵉⵜⵜⵓⵏⵖⴰⵍ ⵓⵙⴰⵔⵓⵜ (@SalonBoumlik). ⵙⵜⵢ @SalonBoumlik ⴳ Wi-Fi.',
      en: 'Password copied (@SalonBoumlik). If your device does not auto-prompt, select @SalonBoumlik in Wi-Fi settings and paste.',
      es: 'Contraseña copiada (@SalonBoumlik). Si no abre automáticamente, elige @SalonBoumlik en Wi-Fi.',
    }),
    zoomQr: pickLang(lang, {
      ar: 'تكبير الباركود',
      fr: 'Agrandir QR',
      amz: 'ⵙⵉⵎⵖⵓⵔ QR',
      en: 'Enlarge QR',
      es: 'Ampliar QR',
    }),
    shrinkQr: pickLang(lang, {
      ar: 'تصغير الباركود',
      fr: 'Réduire QR',
      amz: 'ⵙⵉⵎⵥⵉ QR',
      en: 'Normal Size',
      es: 'Tamaño normal',
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Balanced Wide Desktop Hero Card / Compact Mobile Stack */}
        <div className="rounded-3xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-5 sm:p-8 lg:p-10 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
            {/* Start Column: Salon Identity, Status & Quick Social/Utility Links */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-start gap-4 sm:gap-5">
              <div className="flex flex-col items-center lg:items-start gap-2.5">
                <div onClick={handleBrandLogoClick} className="inline-flex select-none">
                  <BrandMark variant="hero" className="flex-shrink-0" />
                </div>
                <h1 className="sr-only">SALON BOUMLIK</h1>
                <p className="text-xs sm:text-sm lg:text-base font-semibold text-amber-800 dark:text-amber-300/95 leading-relaxed text-balance max-w-xl">
                  {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
                </p>
              </div>

              <div className="space-y-2.5 max-w-2xl">
                <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-300 leading-relaxed text-balance flex items-start sm:items-center justify-center lg:justify-start gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <span>{SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}</span>
                </p>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-2.5 gap-y-1.5 text-xs sm:text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
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
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>5.0 Google</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-stone-400 dark:text-zinc-500" />
                    <span>{t.mensOnly}</span>
                  </span>
                </div>
              </div>

              {/* Social Media & Utility Links: Unified Monochrome Icon Row on Mobile / Restrained Desktop Hover Links */}
              <div className="w-full pt-1 space-y-2">
                <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
                  {labels.socialTitle}
                </div>

                {/* Mobile (< sm): Unified single monochrome icon-only row without text labels */}
                <div className="flex sm:hidden items-center justify-center gap-2.5">
                  <a
                    href={SALON_INFO.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram @SalonBoumlik"
                    title="Instagram @SalonBoumlik"
                    className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 inline-flex items-center justify-center transition-colors active:scale-95"
                  >
                    <Instagram className="w-4 h-4" />
                    <span className="sr-only">{labels.instagramLabel}</span>
                  </a>

                  <a
                    href={SALON_INFO.social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook Salon Boumlik"
                    title="Facebook Salon Boumlik"
                    className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 inline-flex items-center justify-center transition-colors active:scale-95"
                  >
                    <Facebook className="w-4 h-4" />
                    <span className="sr-only">{labels.facebookLabel}</span>
                  </a>

                  <a
                    href={heroWhatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp Salon Boumlik"
                    title={`WhatsApp ${formatSalonDisplayPhone(salonSettings.salonWhatsapp)}`}
                    className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 inline-flex items-center justify-center transition-colors active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="sr-only">{labels.whatsapp}</span>
                  </a>

                  <a
                    href={normalizeSalonTelHref(salonSettings.salonPhone)}
                    aria-label={labels.callAria}
                    title={formatSalonDisplayPhone(salonSettings.salonPhone)}
                    className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 inline-flex items-center justify-center transition-colors active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="sr-only">{labels.callLabel}</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setIsWifiModalOpen(true)}
                    aria-label={labels.wifiAria}
                    title={labels.wifiAria}
                    className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 inline-flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                  >
                    <Wifi className="w-4 h-4" />
                    <span className="sr-only">{labels.wifiBtnLabel}</span>
                  </button>
                </div>

                {/* Desktop (sm+): Restrained monochrome styling with crisp hover feedback */}
                <div className="hidden sm:block space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                    <a
                      href={SALON_INFO.social.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram @SalonBoumlik"
                      title="Instagram @SalonBoumlik"
                      onMouseEnter={() => setHoveredSocialHint('Instagram · @SalonBoumlik')}
                      onMouseLeave={() => setHoveredSocialHint(null)}
                      onFocus={() => setHoveredSocialHint('Instagram · @SalonBoumlik')}
                      onBlur={() => setHoveredSocialHint(null)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 hover:border-stone-400 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all duration-150 active:scale-95"
                    >
                      <Instagram className="w-4 h-4 flex-shrink-0" />
                      <span>{labels.instagramLabel}</span>
                    </a>

                    <a
                      href={SALON_INFO.social.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook Salon Boumlik"
                      title="Facebook Salon Boumlik"
                      onMouseEnter={() => setHoveredSocialHint('Facebook · Salon Boumlik')}
                      onMouseLeave={() => setHoveredSocialHint(null)}
                      onFocus={() => setHoveredSocialHint('Facebook · Salon Boumlik')}
                      onBlur={() => setHoveredSocialHint(null)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 hover:border-stone-400 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all duration-150 active:scale-95"
                    >
                      <Facebook className="w-4 h-4 flex-shrink-0" />
                      <span>{labels.facebookLabel}</span>
                    </a>

                    <a
                      href={heroWhatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp Salon Boumlik"
                      title={`WhatsApp ${formatSalonDisplayPhone(salonSettings.salonWhatsapp)}`}
                      onMouseEnter={() =>
                        setHoveredSocialHint(
                          `WhatsApp · ${formatSalonDisplayPhone(salonSettings.salonWhatsapp)}`
                        )
                      }
                      onMouseLeave={() => setHoveredSocialHint(null)}
                      onFocus={() =>
                        setHoveredSocialHint(
                          `WhatsApp · ${formatSalonDisplayPhone(salonSettings.salonWhatsapp)}`
                        )
                      }
                      onBlur={() => setHoveredSocialHint(null)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 hover:border-stone-400 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all duration-150 active:scale-95"
                    >
                      <MessageCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{labels.whatsapp}</span>
                    </a>

                    <a
                      href={normalizeSalonTelHref(salonSettings.salonPhone)}
                      aria-label={labels.callAria}
                      title={formatSalonDisplayPhone(salonSettings.salonPhone)}
                      onMouseEnter={() =>
                        setHoveredSocialHint(formatSalonDisplayPhone(salonSettings.salonPhone))
                      }
                      onMouseLeave={() => setHoveredSocialHint(null)}
                      onFocus={() =>
                        setHoveredSocialHint(formatSalonDisplayPhone(salonSettings.salonPhone))
                      }
                      onBlur={() => setHoveredSocialHint(null)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 hover:border-stone-400 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all duration-150 active:scale-95"
                    >
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{labels.callLabel}</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setIsWifiModalOpen(true)}
                      aria-label={labels.wifiAria}
                      title={labels.wifiAria}
                      onMouseEnter={() =>
                        setHoveredSocialHint(`Wi-Fi · ${SALON_WIFI_CONFIG.ssid}`)
                      }
                      onMouseLeave={() => setHoveredSocialHint(null)}
                      onFocus={() =>
                        setHoveredSocialHint(`Wi-Fi · ${SALON_WIFI_CONFIG.ssid}`)
                      }
                      onBlur={() => setHoveredSocialHint(null)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 hover:border-stone-400 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer"
                    >
                      <Wifi className="w-4 h-4 flex-shrink-0" />
                      <span>{labels.wifiBtnLabel}</span>
                    </button>
                  </div>

                  <p
                    className="min-h-[16px] text-[11px] font-mono text-stone-500 dark:text-zinc-400 transition-opacity duration-150"
                    dir="ltr"
                  >
                    {hoveredSocialHint || '\u00A0'}
                  </p>
                </div>
              </div>
            </div>

            {/* End Column: Primary Booking & Quick Action Panel */}
            <div className="lg:col-span-5 lg:p-6 lg:rounded-2xl lg:bg-stone-50 lg:dark:bg-[#181B23] lg:border lg:border-stone-200 lg:dark:border-zinc-800 space-y-2.5">
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
                  className="w-full min-h-[50px] px-5 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-slate-900 dark:text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.99]"
                >
                  <Ticket className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <span>{labels.trackBooking}</span>
                </button>
              )}

              {/* 3. Side-by-Side WhatsApp + Directions Buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={heroWhatsappHref}
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
                  className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-white hover:bg-stone-100 dark:bg-zinc-950 dark:hover:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Navigation className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <span>{labels.directions}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Wi-Fi QR Popup with Direct Quick-Connect & Enlarge Option */}
      {isWifiModalOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => setIsWifiModalOpen(false)}
          >
            <div
              className="bg-white dark:bg-[#111318] border border-stone-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center space-y-4"
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

              <div className="space-y-1 pt-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {labels.wifiTitle}
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                  {labels.wifiSubtitle}
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-white rounded-2xl border border-stone-200 dark:border-zinc-700 inline-block shadow-xs">
                  <img
                    src={SALON_INFO.media.qrWifi}
                    alt="Wi-Fi QR Code"
                    className={`${
                      isWifiQrZoomed ? 'w-60 h-60' : 'w-40 h-40'
                    } object-contain mx-auto rounded-lg transition-all duration-200`}
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setIsWifiQrZoomed((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-[11px] font-bold text-slate-700 dark:text-zinc-200 cursor-pointer transition-colors"
                  >
                    {isWifiQrZoomed ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>{labels.shrinkQr}</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>{labels.zoomQr}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3.5 bg-stone-100 dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800 text-start text-xs space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-stone-500 dark:text-zinc-400">{labels.ssidLabel}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                      {SALON_WIFI_CONFIG.ssid}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySsid}
                      aria-label={labels.ssidLabel}
                      className="p-1 rounded bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300 cursor-pointer"
                    >
                      {copiedSsid ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-stone-200 dark:border-zinc-800">
                  <span className="text-stone-500 dark:text-zinc-400">{labels.securityLabel}</span>
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700 dark:text-emerald-400" dir="ltr">
                    <Shield className="w-3 h-3" />
                    <span>{SALON_WIFI_CONFIG.security}</span>
                  </span>
                </div>

                <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-stone-200 dark:border-zinc-800">
                  <span className="text-stone-500 dark:text-zinc-400">{labels.passLabel}</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400" dir="ltr">
                    {SALON_WIFI_CONFIG.password}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={wifiUri}
                  onClick={handleQuickConnectWifi}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Wifi className="w-4 h-4 flex-shrink-0" />
                  <span>{labels.quickConnectWifi}</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyWifi}
                  className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedWifi ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <Copy className="w-4 h-4 flex-shrink-0" />}
                  <span>{copiedWifi ? labels.copiedWifi : labels.copyWifi}</span>
                </button>
              </div>

              {quickConnectHint && (
                <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-700/50 rounded-xl p-2.5 text-start">
                  {labels.quickConnectNote}
                </p>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  );
};
