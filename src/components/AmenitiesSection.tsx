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

  const amenities = [
    {
      icon: Wifi,
      title: {
        fr: 'Wi-Fi Fibre Haut Débit Gratuit',
        ar: 'إنترنت ويفي فائق السرعة مجاناً',
        en: 'Free High-Speed Fiber Wi-Fi',
        amz: 'ⵡⴰⵢ-ⴼⴰⵢ ⴼⴰⴱⵓⵕ ⵙ ⵜⵎⵙⴽⵉⵔⵜ',
      },
      desc: {
        fr: 'Connexion instantanée par simple scan du QR code sans mot de passe compliqué pour naviguer en toute tranquillité.',
        ar: 'اتصال فوري ومجاني بمجرد مسح رمز الاستجابة السريعة بالهاتف دون الحاجة لكلمات سر معقدة.',
        en: 'Instant and effortless connection by scanning our QR code, allowing smooth browsing while you wait.',
        amz: 'ⴰⵎⵢⴰⵡⴰⴹ ⵙ ⵡⴰⵢ-ⴼⴰⵢ ⴼⴰⴱⵓⵕ ⵙ ⵓⵙⴽⴰⵏ ⵏ ⴱⴰⵔⴽⵓⴷ ⴱⵍⴰ ⵜⴰⴳⵓⵔⵉ ⵏ ⵓⵣⵔⴰⵢ.',
      },
      badge: {
        fr: '100% Gratuit',
        ar: 'مجاناً للزبائن',
        en: 'Free for Guests',
        amz: 'ⴼⴰⴱⵓⵕ',
      },
      action: () => setWifiModalOpen(true),
      actionText: {
        fr: 'Scanner le QR Wi-Fi',
        ar: 'مسح باركود الويفي',
        en: 'Scan Wi-Fi QR',
        amz: 'ⵙⴽⴰⵏ ⵡⴰⵢ-ⴼⴰⵢ',
      },
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
        fr: 'Boissons Chaudes Offertes',
        ar: 'مشروبات ساخنة مجانية حسب اختيارك',
        en: 'Complimentary Warm Drinks',
        amz: 'ⵜⵉⵙⵉⵜ ⵉⵔⵖⴰⵏ ⴼⴰⴱⵓⵕ',
      },
      desc: {
        fr: 'Choisissez votre boisson lors de votre réservation : Café Expresso italien, Thé à la menthe marocain fraîchement infusé, ou rien.',
        ar: 'اختر مشروبك المفضل أثناء الحجز: قهوة مقطرة، شاي مغربي بالنعناع الأصيل، أو متابعة الخدمة دون مشروب.',
        en: 'Select your complimentary beverage when booking: Italian Espresso Coffee, authentic Moroccan Mint Tea, or None.',
        amz: 'ⵙⵜⵢ ⵜⵉⵙⵉⵜ ⵏⵏⴽ ⴳ ⵓⵙⵔⵓⵙ: ⵜⴰⴽⴰⴼⵉⵜ, ⴰⵜⴰⵢ ⵏ ⵍⵎⵖⵔⵉⴱ ⵙ ⵏⵏⵄⵏⴰⵄ, ⵏⵖ ⵡⴰⵍⵓ.',
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
                className="rounded-3xl p-6 bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-xl space-y-4 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shadow-md">
                      <Icon className="w-6 h-6" />
                    </div>

                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      {item.badge[lang] || item.badge.fr}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                    {item.title[lang] || item.title.fr}
                  </h3>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {item.desc[lang] || item.desc.fr}
                  </p>
                </div>

                {item.action && (
                  <div className="pt-3 border-t border-zinc-800/80">
                    <button
                      onClick={item.action}
                      className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-zinc-700"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>{item.actionText ? (item.actionText[lang] || item.actionText.fr) : 'QR Code'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Complimentary Drink Highlight Card */}
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
                  ? 'اختر بين الشاي المغربي بالنعناع، القهوة، أو إعلامنا بعدم الرغبة في مشروب أثناء حجز موعدك.'
                  : lang === 'amz'
                  ? 'ⵙⵜⵢ ⴳⵔ ⵡⴰⵜⴰⵢ, ⵜⴰⴽⴰⴼⵉⵜ ⵏⵖ ⵡⴰⵍⵓ ⴳ ⵓⴽⵓⴷ ⵏ ⵓⵙⵔⵓⵙ.'
                  : 'Lors de votre prise de rendez-vous en ligne, indiquez simplement votre préférence : Thé à la menthe, Café expresso, ou rien.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-bold text-amber-300">
              ☕ {t.drinkCoffee}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-bold text-emerald-300">
              🍃 {t.drinkTea}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-400">
              🚫 {t.drinkNone}
            </span>
          </div>
        </div>

      </div>

      {/* Wi-Fi QR Lightbox */}
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
                {lang === 'ar' ? 'واي فاي صالون بومليك' : lang === 'amz' ? 'ⵡⴰⵢ-ⴼⴰⵢ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ' : 'Wi-Fi Gratuit Salon Boumlik'}
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                {lang === 'ar' ? 'امسح الباركود بهاتفك للاتصال الفوري' : lang === 'amz' ? 'ⵙⴽⴰⵏ ⴱⴰⵔⴽⵓⴷ ⵙ ⵓⵜⵉⵍⵉⴼⵓⵏ' : 'Scannez avec votre téléphone pour vous connecter'}
              </p>
            </div>

            <div className="w-56 h-56 mx-auto rounded-2xl overflow-hidden p-3 bg-white shadow-2xl">
              <img
                src={SALON_INFO.media.qrWifi}
                alt="Free Wi-Fi QR code Salon Boumlik"
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[11px] text-zinc-500">
              {lang === 'ar' ? 'إنترنت عالي السرعة متاح لجميع الزبائن' : lang === 'amz' ? 'ⵡⴰⵢ-ⴼⴰⵢ ⵉⵖⵓⴷⴰⵏ ⵉ ⵉⵎⵣⴷⴰⵖ' : 'Haut débit fibre disponible au 2ème étage.'}
            </p>
          </div>
        </div>
      )}

    </section>
  );
};
