import React, { useState } from 'react';
import { 
  Wifi, 
  Tv, 
  Coffee, 
  Sparkles, 
  ShieldCheck, 
  QrCode, 
  X,
  CheckCircle2,
  Wind
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';

export const AmenitiesSection: React.FC = () => {
  const { lang, t, isRtl } = useLanguage();
  const [wifiModalOpen, setWifiModalOpen] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(SALON_INFO.media.wifiPassword);
    setCopiedWifi(true);
    setTimeout(() => setCopiedWifi(false), 2000);
  };

  const amenities = [
    {
      icon: Wifi,
      title: {
        fr: 'Wi-Fi Fibre Dédié aux Clients',
        ar: 'إنترنت ويفي فائق السرعة للزبائن',
        en: 'High-Speed Fiber Wi-Fi Lounge',
        amz: 'ⵡⴰⵢ-ⴼⴰⵢ ⵉⵖⵓⴷⴰⵏ ⵉ ⵉⵎⵣⴷⴰⵖ',
      },
      desc: {
        fr: 'Connexion instantanée par simple scan du QR code ou via le mot de passe @SalonBoumlik pour naviguer en toute tranquillité pendant votre attente.',
        ar: 'اتصال فوري ومباشر بمسح رمز الباركود بالهاتف أو إدخال كلمة السر @SalonBoumlik لتصفح الإنترنت ومتابعة أعمالكم.',
        en: 'Instant connection by scanning our QR code or entering @SalonBoumlik password for seamless browsing while you wait.',
        amz: 'ⴰⵎⵢⴰⵡⴰⴹ ⵙ ⵡⴰⵢ-ⴼⴰⵢ ⵙ ⵓⵙⴽⴰⵏ ⵏ ⴱⴰⵔⴽⵓⴷ ⵏⵉⵖ ⵜⴰⴳⵓⵔⵉ @SalonBoumlik.',
      },
      badge: {
        fr: 'Fibre Optique',
        ar: 'ألياف بصرية',
        en: 'High-Speed',
        amz: 'ⵜⴰⵥⴹⵓⵕⵜ',
      },
      action: () => setWifiModalOpen(true),
      actionText: {
        fr: 'Afficher le QR Wi-Fi',
        ar: 'عرض باركود الويفي',
        en: 'Display Wi-Fi QR',
        amz: 'ⵙⴽⴰⵏ ⵡⴰⵢ-ⴼⴰⵢ',
      },
      isWifiCard: true,
    },
    {
      icon: Tv,
      title: {
        fr: 'Espace TV & Actualités',
        ar: 'شاشات تلفاز ومتابعة البرامج والرياضة',
        en: 'HD TV Entertainment & Sports Lounge',
        amz: 'ⴰⵎⵎⴰⵙ ⵏ ⵜⵉⵍⵉⴼⵉⵣⵢⵓⵏ ⴷ ⵉⵏⵖⵎⵉⵙⵏ',
      },
      desc: {
        fr: 'Grand écran haute définition diffusant les actualités, documentaires et événements sportifs pour rendre l’attente agréable.',
        ar: 'شاشات عرض عالية الجودة تتابع الأخبار والبرامج والمباريات الرياضية في أجواء مريحة تكسر ملل الانتظار.',
        en: 'Large HD display broadcasting news, documentaries, and live sports in a relaxing gentleman’s environment.',
        amz: 'ⵜⵉⵍⵉⴼⵉⵣⵢⵓⵏ ⵉⵎⵇⵇⵓⵔⵏ ⵉ ⵓⴹⴼⴰⵕ ⵏ ⵉⵏⵖⵎⵉⵙⵏ ⴷ ⵜⵓⵏⵏⵓⵏⵜ ⴳ ⵓⵔⴰⵊⴰ.',
      },
      badge: {
        fr: 'Confort Visuel',
        ar: 'متابعة مريحة',
        en: 'Relaxing Ambience',
        amz: 'ⴰⵙⵓⵏⴼⵓ',
      },
    },
    {
      icon: Coffee,
      title: {
        fr: 'Boissons Chaudes : Café & Thé',
        ar: 'ضيافة المشروبات الساخنة (أتاي أو قهوة)',
        en: 'Warm Drinks Service: Coffee & Tea',
        amz: 'ⵜⵉⵙⵉⵜ ⵉⵔⵖⴰⵏ : ⵜⴰⴽⴰⴼⵉⵜ ⴷ ⵡⴰⵜⴰⵢ',
      },
      desc: {
        fr: 'Précisez votre préférence lors de votre réservation : Café noir expresso, Thé à la menthe marocain, ou rien pour passer directement.',
        ar: 'حدد اختيارك ببساطة أثناء الحجز: قهوة مقطرة، أتاي مغربي، أو تحديد خيار والو لبدء الحلاقة مباشرة.',
        en: 'Specify your drink choice when reserving: Espresso coffee, authentic Moroccan tea, or None to jump straight to grooming.',
        amz: 'ⵙⵜⵢ ⵜⵉⵙⵉⵜ ⵏⵏⴽ ⴳ ⵓⵙⵔⵓⵙ: ⵜⴰⴽⴰⴼⵉⵜ, ⴰⵜⴰⵢ, ⵏⵖ ⵡⴰⵍⵓ.',
      },
      badge: {
        fr: 'Hospitalité',
        ar: 'كرم الضيافة',
        en: 'Hospitality',
        amz: 'ⴰⵙⵏⵓⴱⴳ',
      },
    },
    {
      icon: Wind,
      title: {
        fr: 'Espace Climatisé & Hygiène Médicale',
        ar: 'فضاء مكيف وتعقيم طبي مستمر',
        en: 'Air-Conditioned & Medical Hygiene',
        amz: 'ⴰⵙⵎⵎⴰⴹ ⴷ ⵓⵙⵉⵣⴷⴳ ⴰⵎⴰⵜⵜⴰⵢ',
      },
      desc: {
        fr: 'Climatisation continue été comme hiver, fauteuils grand confort et stérilisation systématique des outils entre chaque client.',
        ar: 'تكييف هوائي مريح صيفاً وشتاءً، كراسي مريحة وتعقيم صارم لجميع الأدوات والشفرات لضمان سلامتكم التامة.',
        en: 'Climate-controlled air conditioning, plush ergonomic barber chairs, and surgical-grade tool sterilization.',
        amz: 'ⴰⵙⵎⵎⴰⴹ ⴳ ⵓⵏⴱⴷⵓ ⴷ ⵜⴳⵔⵙⵜ, ⵉⵙⵖⵉⵎⵏ ⵉⴼⵓⵍⴽⵉⵏ ⴷ ⵓⵙⵉⵣⴷⴳ ⵏ ⵉⵎⴰⵙⵙⵏ.',
      },
      badge: {
        fr: 'Sécurité & Soin',
        ar: 'نظافة تامة',
        en: 'Clean & Safe',
        amz: 'ⵜⴰⵏⴼⵔⵓⵜ',
      },
    },
  ];

  return (
    <section id="amenities" className="py-16 md:py-24 bg-[#050608] relative border-t border-zinc-800/80">
      
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/2 left-1/3 w-[500px] h-[350px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.amenitiesTitle}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-display tracking-tight">
            {lang === 'ar' ? (
              <span>فضاء الراحة و <span className="text-gold-gradient">حسن الضيافة</span></span>
            ) : lang === 'amz' ? (
              <span>ⴰⵎⵎⴰⵙ ⵏ ⵓⵙⵓⵏⴼⵓ ⴷ <span className="text-gold-gradient">ⵜⵏⴼⵔⵓⵜ</span></span>
            ) : lang === 'en' ? (
              <span>COMFORT & <span className="text-gold-gradient">WAITING LOUNGE</span></span>
            ) : (
              <span>CONFORT & <span className="text-gold-gradient">EXPÉRIENCE D'ATTENTE</span></span>
            )}
          </h2>

          <p className="text-sm sm:text-base text-zinc-300 font-body">
            {t.amenitiesSubtitle}
          </p>
        </div>

        {/* 4 Amenities Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {amenities.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`rounded-3xl p-6 bg-zinc-900/90 border transition-all flex flex-col justify-between shadow-xl space-y-4 group ${
                  item.isWifiCard ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-zinc-800 hover:border-amber-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shadow-md">
                      <Icon className="w-6 h-6" />
                    </div>

                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      {(item.badge as any)[lang] || item.badge.fr}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                    {(item.title as any)[lang] || item.title.fr}
                  </h3>

                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                    {(item.desc as any)[lang] || item.desc.fr}
                  </p>

                  {/* Explicit Wi-Fi Credentials Pill */}
                  {item.isWifiCard && (
                    <div className="p-3 rounded-2xl bg-zinc-950 border border-amber-500/30 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">{t.wifiNetworkTitle} :</span>
                        <span className="font-mono font-bold text-amber-300">{SALON_INFO.media.wifiSsid}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] border-t border-zinc-800/80 pt-1.5">
                        <span className="text-zinc-400">{t.wifiPasswordTitle} :</span>
                        <span className="font-mono font-bold text-white">{SALON_INFO.media.wifiPassword}</span>
                      </div>
                      <button
                        onClick={handleCopyPassword}
                        className="w-full mt-1 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedWifi ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">{t.copied}</span>
                          </>
                        ) : (
                          <span>{t.copyPassword}</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {item.action && (
                  <div className="pt-3 border-t border-zinc-800/80">
                    <button
                      onClick={item.action}
                      className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-zinc-700"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>{item.actionText ? ((item.actionText as any)[lang] || item.actionText.fr) : 'QR Code'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drink Highlight Card (No "free" mentions, just clear hospitality) */}
        <div className="mt-12 rounded-3xl bg-gradient-to-r from-zinc-900 via-amber-950/20 to-zinc-900 border border-amber-500/30 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0 shadow-lg">
              <Coffee className="w-7 h-7" />
            </div>
            <div className="space-y-1 text-center md:text-left">
              <h4 className="text-base sm:text-lg font-bold text-white font-display">
                {t.drinkSelectionTitle}
              </h4>
              <p className="text-xs text-zinc-400 max-w-xl">
                {lang === 'ar'
                  ? 'اختر مشروبك المفضل ببساطة أثناء حجز موعدك: شاي (أتاي فقط)، قهوة، أو بدون مشروب (والو).'
                  : lang === 'amz'
                  ? 'ⵙⵜⵢ ⴳⵔ ⵡⴰⵜⴰⵢ, ⵜⴰⴽⴰⴼⵉⵜ ⵏⵖ ⵡⴰⵍⵓ ⴳ ⵓⴽⵓⴷ ⵏ ⵓⵙⵔⵓⵙ.'
                  : 'Lors de votre réservation en ligne, indiquez simplement votre choix : Thé, Café expresso, ou Rien.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <span className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-bold text-amber-300">
              ☕ {t.drinkCoffee}
            </span>
            <span className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-bold text-emerald-300">
              🍃 {t.drinkTea}
            </span>
            <span className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-400">
              🚫 {t.drinkNone}
            </span>
          </div>
        </div>

      </div>

      {/* Wi-Fi QR Lightbox with newly uploaded QR asset */}
      {wifiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl max-w-xs sm:max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setWifiModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <Wifi className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-bold text-white">
                {lang === 'ar' ? 'واي فاي صالون بومليك' : lang === 'amz' ? 'ⵡⴰⵢ-ⴼⴰⵢ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ' : 'Wi-Fi Salon Boumlik'}
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                {lang === 'ar' ? 'امسح الباركود بهاتفك للاتصال الفوري' : lang === 'amz' ? 'ⵙⴽⴰⵏ ⴱⴰⵔⴽⵓⴷ ⵙ ⵓⵜⵉⵍⵉⴼⵓⵏ' : 'Scannez avec votre téléphone pour vous connecter'}
              </p>
            </div>

            <div className="w-60 h-60 mx-auto rounded-2xl overflow-hidden p-3 bg-white shadow-2xl flex items-center justify-center">
              <img
                src={SALON_INFO.media.qrWifi}
                alt="Wi-Fi QR code Salon Boumlik"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-left text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-400">{t.wifiNetworkTitle} :</span>
                <span className="font-mono font-bold text-amber-300">{SALON_INFO.media.wifiSsid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">{t.wifiPasswordTitle} :</span>
                <span className="font-mono font-bold text-white">{SALON_INFO.media.wifiPassword}</span>
              </div>
            </div>

            <button
              onClick={handleCopyPassword}
              className="w-full py-2.5 rounded-xl bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              {copiedWifi ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.copied}</span>
                </>
              ) : (
                <span>{t.copyPassword}</span>
              )}
            </button>
          </div>
        </div>
      )}

    </section>
  );
};
