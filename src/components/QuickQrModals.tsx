import React, { useState } from 'react';
import { 
  Instagram, 
  Wifi, 
  MessageCircle, 
  Star, 
  QrCode, 
  X, 
  Copy, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';

export const QuickQrModals: React.FC = () => {
  const { lang } = useLanguage();
  const [activeModal, setActiveModal] = useState<'instagram' | 'wifi' | 'whatsapp' | 'reviews' | null>(null);
  const [copiedWifi, setCopiedWifi] = useState(false);

  const handleCopyWifi = () => {
    navigator.clipboard.writeText(SALON_INFO.media.wifiPassword);
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
      {/* 4 Quick Access Pills in Hero/Homepage */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-xl mx-auto w-full pt-1">
        
        {/* 1. Instagram */}
        <button
          type="button"
          onClick={() => setActiveModal('instagram')}
          className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-pink-500/50 flex items-center justify-center gap-2 transition-all shadow-sm group active:scale-95 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Instagram className="w-4 h-4" />
          </div>
          <div className="text-left rtl:text-right">
            <span className="text-[11px] font-bold text-zinc-900 dark:text-white block group-hover:text-pink-600 dark:group-hover:text-pink-400">
              {lang === 'ar' ? 'إنستغرام' : 'Instagram'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono block">QR Code</span>
          </div>
        </button>

        {/* 2. Wi-Fi */}
        <button
          type="button"
          onClick={() => setActiveModal('wifi')}
          className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50 flex items-center justify-center gap-2 transition-all shadow-sm group active:scale-95 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Wifi className="w-4 h-4" />
          </div>
          <div className="text-left rtl:text-right">
            <span className="text-[11px] font-bold text-zinc-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {lang === 'ar' ? 'واي فاي' : 'Wi-Fi'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono block">Connect</span>
          </div>
        </button>

        {/* 3. WhatsApp */}
        <button
          type="button"
          onClick={() => setActiveModal('whatsapp')}
          className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 flex items-center justify-center gap-2 transition-all shadow-sm group active:scale-95 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <MessageCircle className="w-4 h-4 fill-white" />
          </div>
          <div className="text-left rtl:text-right">
            <span className="text-[11px] font-bold text-zinc-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              {lang === 'ar' ? 'واتساب' : 'WhatsApp'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono block">Direct</span>
          </div>
        </button>

        {/* 4. Google Reviews */}
        <button
          type="button"
          onClick={() => setActiveModal('reviews')}
          className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 flex items-center justify-center gap-2 transition-all shadow-sm group active:scale-95 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center flex-shrink-0 shadow-sm">
            <Star className="w-4 h-4 fill-black" />
          </div>
          <div className="text-left rtl:text-right">
            <span className="text-[11px] font-bold text-zinc-900 dark:text-white block group-hover:text-amber-600 dark:group-hover:text-amber-400">
              {lang === 'ar' ? 'تقييم Google' : 'Avis 5.0'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono block">5.0 ★</span>
          </div>
        </button>

      </div>

      {/* MODAL POPUP */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0E1015] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl relative text-center space-y-4">
            
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-zinc-900 dark:text-white font-display pt-2">
              {modalTitles[activeModal][lang] || modalTitles[activeModal].fr}
            </h3>

            {/* INSTAGRAM QR */}
            {activeModal === 'instagram' && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 inline-block shadow-inner">
                  <img
                    src={SALON_INFO.media.qrInstagram}
                    alt="Instagram QR Code"
                    className="w-48 h-48 object-contain mx-auto rounded-lg"
                  />
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  {lang === 'ar' ? 'امسح الكود بكاميرا هاتفك للمتابعة المباشرة' : 'Scannez pour suivre @salonboumlik'}
                </p>
                <a
                  href={SALON_INFO.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:brightness-105 transition-all"
                >
                  <Instagram className="w-4 h-4" />
                  <span>@salonboumlik</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </a>
              </div>
            )}

            {/* WI-FI QR */}
            {activeModal === 'wifi' && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 inline-block shadow-inner">
                  <img
                    src={SALON_INFO.media.qrWifi}
                    alt="Wi-Fi QR Code"
                    className="w-48 h-48 object-contain mx-auto rounded-lg"
                  />
                </div>
                <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-left rtl:text-right text-xs space-y-1">
                  <div className="flex justify-between items-center text-zinc-500">
                    <span>SSID:</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-white">@SalonBoumlik</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-500">
                    <span>Password:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">@SalonBoumlik</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWifi}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  {copiedWifi ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedWifi ? (lang === 'ar' ? 'تم نسخ كلمة المرور!' : 'Mot de passe copié !') : (lang === 'ar' ? 'نسخ كلمة مرور الواي فاي' : 'Copier le mot de passe')}</span>
                </button>
              </div>
            )}

            {/* WHATSAPP QR */}
            {activeModal === 'whatsapp' && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 inline-block shadow-inner">
                  <img
                    src={SALON_INFO.media.qrWhatsApp}
                    alt="WhatsApp QR Code"
                    className="w-48 h-48 object-contain mx-auto rounded-lg"
                  />
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                  {SALON_INFO.displayPhone}
                </p>
                <a
                  href={`https://wa.me/${SALON_INFO.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>{lang === 'ar' ? 'فتح محادثة واتساب الآن' : 'Ouvrir WhatsApp'}</span>
                </a>
              </div>
            )}

            {/* GOOGLE REVIEWS QR */}
            {activeModal === 'reviews' && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 inline-block shadow-inner">
                  <img
                    src={SALON_INFO.media.qrGoogleReview}
                    alt="Google Review QR Code"
                    className="w-48 h-48 object-contain mx-auto rounded-lg"
                  />
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  {lang === 'ar' ? 'رأيكم يهمنا! اترك تقييم 5 نجوم على خرائط Google' : 'Laissez un avis 5 étoiles pour soutenir le salon !'}
                </p>
                <a
                  href={SALON_INFO.social.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <Star className="w-4 h-4 fill-black" />
                  <span>{lang === 'ar' ? 'كتابة تقييم 5.0 الآن' : 'Laisser un avis Google'}</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </a>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
};
