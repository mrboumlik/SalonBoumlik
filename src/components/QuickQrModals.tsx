import React, { useState } from 'react';
import {
  Instagram,
  Wifi,
  MessageCircle,
  Star,
  X,
  Copy,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import {
  useSalonProfileSettings,
  formatSalonDisplayPhone,
  normalizeSalonWhatsappDigits,
} from '../utils/salonSettingsStore';
import { pickLang } from '../utils/i18n';
import { safeCopyToClipboard } from '../utils/safeBrowser';

export const QuickQrModals: React.FC = () => {
  const { lang } = useLanguage();
  const salonSettings = useSalonProfileSettings();
  const [activeModal, setActiveModal] = useState<'instagram' | 'wifi' | 'whatsapp' | 'reviews' | null>(null);
  const [copiedWifi, setCopiedWifi] = useState(false);

  const handleCopyWifi = () => {
    void safeCopyToClipboard(SALON_INFO.media.wifiPassword);
    setCopiedWifi(true);
    setTimeout(() => setCopiedWifi(false), 2000);
  };

  const modalTitles = {
    instagram: {
      ar: 'إنستغرام الصالون الرسمي',
      fr: 'Instagram Officiel',
      en: 'Official Instagram',
      amz: 'ⵉⵏⵙⵜⴰⴳⵔⴰⵎ ⴰⵎⴰⴷⴷⵓⴷ',
      es: 'Instagram Oficial',
    },
    wifi: {
      ar: 'واي فاي مجاني عالي السرعة (Wi-Fi)',
      fr: 'Wi-Fi Fibre Gratuit',
      en: 'Free High-Speed Wi-Fi',
      amz: 'ⵡⴰⵢ ⴼⴰⵢ ⴼⴰⴱⵓⵕ',
      es: 'Wi-Fi Gratuito de Alta Velocidad',
    },
    whatsapp: {
      ar: 'واتساب الصالون المباشر',
      fr: 'WhatsApp Direct',
      en: 'Direct WhatsApp',
      amz: 'ⵡⴰⵜⵙⴰⴱ ⵓⵙⵔⵉⴷ',
      es: 'WhatsApp Directo',
    },
    reviews: {
      ar: 'تقييم 5 نجوم على Google',
      fr: 'Avis 5 Étoiles sur Google',
      en: '5-Star Google Review',
      amz: 'ⴰⵙⵓⵜⴳ 5 ⵉⵜⵔⴰⵏ ⴳ Google',
      es: 'Reseña de 5 Estrellas en Google',
    },
  };

  return (
    <>
      {/* Restrained Quick QR Access Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
        {/* 1. Wi-Fi */}
        <button
          type="button"
          onClick={() => setActiveModal('wifi')}
          className="p-3 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 hover:border-amber-500/60 flex items-center gap-2.5 transition-colors shadow-2xs group active:scale-[0.98] cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-zinc-800 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Wifi className="w-4 h-4" />
          </div>
          <div className="text-start min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
              {pickLang(lang, {
                ar: 'واي فاي مجاني',
                fr: 'Wi-Fi Salon',
                amz: 'ⵡⴰⵢ ⴼⴰⵢ',
                en: 'Free Wi-Fi',
                es: 'Wi-Fi Gratis',
              })}
            </span>
            <span className="text-[10px] text-stone-500 dark:text-zinc-400 font-mono block">
              QR Connect
            </span>
          </div>
        </button>

        {/* 2. WhatsApp */}
        <button
          type="button"
          onClick={() => setActiveModal('whatsapp')}
          className="p-3 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 hover:border-amber-500/60 flex items-center gap-2.5 transition-colors shadow-2xs group active:scale-[0.98] cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div className="text-start min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
              {pickLang(lang, {
                ar: 'واتساب مباشر',
                fr: 'WhatsApp',
                amz: 'ⵡⴰⵜⵙⴰⴱ',
                en: 'WhatsApp',
                es: 'WhatsApp',
              })}
            </span>
            <span dir="ltr" className="text-[10px] text-stone-500 dark:text-zinc-400 font-mono block">
              {formatSalonDisplayPhone(salonSettings.salonWhatsapp)}
            </span>
          </div>
        </button>

        {/* 3. Instagram */}
        <button
          type="button"
          onClick={() => setActiveModal('instagram')}
          className="p-3 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 hover:border-amber-500/60 flex items-center gap-2.5 transition-colors shadow-2xs group active:scale-[0.98] cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-zinc-800 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Instagram className="w-4 h-4" />
          </div>
          <div className="text-start min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
              {pickLang(lang, {
                ar: 'إنستغرام',
                fr: 'Instagram',
                amz: 'ⵉⵏⵙⵜⴰⴳⵔⴰⵎ',
                en: 'Instagram',
                es: 'Instagram',
              })}
            </span>
            <span className="text-[10px] text-stone-500 dark:text-zinc-400 font-mono block truncate">
              @salonboumlik
            </span>
          </div>
        </button>

        {/* 4. Google Reviews */}
        <button
          type="button"
          onClick={() => setActiveModal('reviews')}
          className="p-3 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 hover:border-amber-500/60 flex items-center gap-2.5 transition-colors shadow-2xs group active:scale-[0.98] cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
          </div>
          <div className="text-start min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
              {pickLang(lang, {
                ar: 'تقييم Google',
                fr: 'Avis Google',
                amz: 'ⴰⵙⵓⵜⴳ Google',
                en: 'Google Reviews',
                es: 'Reseñas Google',
              })}
            </span>
            <span className="text-[10px] text-stone-500 dark:text-zinc-400 font-mono block">
              5.0 ★
            </span>
          </div>
        </button>
      </div>

      {/* MODAL POPUP */}
      {activeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sb-modal-backdrop">
          <div className="bg-white dark:bg-[#111318] border border-stone-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl relative text-center space-y-4">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-stone-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-slate-900 dark:text-white font-display pt-2">
              {modalTitles[activeModal][lang] || modalTitles[activeModal].fr}
            </h3>

            {activeModal === 'instagram' && (
              <div className="space-y-4">
                <div className="p-4 bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 inline-block">
                  <img
                    src={SALON_INFO.media.qrInstagram}
                    alt="Instagram QR Code"
                    className="w-48 h-48 object-contain mx-auto rounded-lg"
                  />
                </div>
                <p className="text-xs text-stone-600 dark:text-zinc-400 font-medium">
                  {pickLang(lang, {
                    ar: 'امسح الكود بكاميرا هاتفك للمتابعة المباشرة',
                    fr: 'Scannez pour suivre @salonboumlik',
                    amz: 'ⵙⴽⴰⵏⵉ ⵉ ⵓⴹⴼⴰⵕ ⵏ @salonboumlik',
                    en: 'Scan with your camera to follow @salonboumlik',
                    es: 'Escanea para seguir a @salonboumlik',
                  })}
                </p>
                <a
                  href={SALON_INFO.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                  <span>@salonboumlik</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {activeModal === 'wifi' && (
              <div className="space-y-4">
                <div className="p-4 bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 inline-block">
                  <img
                    src={SALON_INFO.media.qrWifi}
                    alt="Wi-Fi QR Code"
                    className="w-48 h-48 object-contain mx-auto rounded-lg"
                  />
                </div>
                <div className="p-3 bg-stone-100 dark:bg-zinc-900 rounded-xl text-start text-xs space-y-1">
                  <div className="flex justify-between items-center text-stone-500">
                    <span>SSID:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{SALON_INFO.media.wifiSsid}</span>
                  </div>
                  <div className="flex justify-between items-center text-stone-500">
                    <span>
                      {pickLang(lang, {
                        ar: 'كلمة المرور:',
                        fr: 'Mot de passe :',
                        amz: 'ⵜⴰⴳⵓⵔⵉ ⵏ ⵓⵣⵔⴰⵢ:',
                        en: 'Password:',
                        es: 'Contraseña:',
                      })}
                    </span>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{SALON_INFO.media.wifiPassword}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWifi}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {copiedWifi ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>
                    {copiedWifi
                      ? pickLang(lang, {
                          ar: 'تم نسخ كلمة المرور!',
                          fr: 'Mot de passe copié !',
                          amz: 'ⵉⵜⵜⵓⵏⵖⵍ ⵓⵣⵔⴰⵢ!',
                          en: 'Password copied!',
                          es: '¡Contraseña copiada!',
                        })
                      : pickLang(lang, {
                          ar: 'نسخ كلمة مرور الواي فاي',
                          fr: 'Copier le mot de passe',
                          amz: 'ⵏⵖⵍ ⵜⴰⴳⵓⵔⵉ ⵏ ⵡⴰⵢ ⴼⴰⵢ',
                          en: 'Copy Wi-Fi Password',
                          es: 'Copiar contraseña Wi-Fi',
                        })}
                  </span>
                </button>
              </div>
            )}

            {activeModal === 'whatsapp' && (
              <div className="space-y-4">
                <div className="p-4 bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 inline-block">
                  <img
                    src={SALON_INFO.media.qrWhatsApp}
                    alt="WhatsApp QR Code"
                    className="w-48 h-48 object-contain mx-auto rounded-lg"
                  />
                </div>
                <p dir="ltr" className="text-xs text-stone-600 dark:text-zinc-400 font-mono">
                  {formatSalonDisplayPhone(salonSettings.salonWhatsapp)}
                </p>
                <a
                  href={`https://wa.me/${normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {pickLang(lang, {
                      ar: 'فتح محادثة واتساب الآن',
                      fr: 'Ouvrir WhatsApp',
                      amz: 'ⵕⵥⵎ ⵡⴰⵜⵙⴰⴱ ⵖⵉⵍⴰⴷ',
                      en: 'Open WhatsApp Chat',
                      es: 'Abrir WhatsApp ahora',
                    })}
                  </span>
                </a>
              </div>
            )}

            {activeModal === 'reviews' && (
              <div className="space-y-4">
                <div className="p-4 bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 inline-block">
                  <img
                    src={SALON_INFO.media.qrGoogleReview}
                    alt="Google Review QR Code"
                    className="w-48 h-48 object-contain mx-auto rounded-lg"
                  />
                </div>
                <p className="text-xs text-stone-600 dark:text-zinc-400 font-medium">
                  {pickLang(lang, {
                    ar: 'رأيكم يهمنا! اترك تقييم 5 نجوم على خرائط Google',
                    fr: 'Laissez un avis 5 étoiles sur Google !',
                    amz: 'ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ ⵜⵙⵡⴰ! ⴼⴽ 5 ⵉⵜⵔⴰⵏ ⴳ Google',
                    en: 'We value your feedback! Leave a 5-star Google review',
                    es: '¡Tu opinión importa! Déjanos 5 estrellas en Google',
                  })}
                </p>
                <a
                  href={salonSettings.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Star className="w-4 h-4 fill-white" />
                  <span>
                    {pickLang(lang, {
                      ar: 'كتابة تقييم 5.0 الآن',
                      fr: 'Laisser un avis Google',
                      amz: 'ⴰⵔⴰ ⵜⴰⵏⵏⴰⵢⵜ 5.0 ⵖⵉⵍⴰⴷ',
                      en: 'Write 5.0 Review Now',
                      es: 'Escribir reseña 5.0',
                    })}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
