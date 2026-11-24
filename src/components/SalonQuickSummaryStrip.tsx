import React from 'react';
import { Clock, Crown, MapPin, ArrowUpRight } from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import type { HomepageSectionKey } from './DrawerMenu';

interface SalonQuickSummaryStripProps {
  googleMapsUrl: string;
  onOpenBooking: () => void;
  onOpenTrackBooking: () => void;
  onNavigateToSection: (sectionId: HomepageSectionKey) => void;
}

export const SalonQuickSummaryStrip: React.FC<SalonQuickSummaryStripProps> = ({
  googleMapsUrl,
  onOpenBooking,
  onOpenTrackBooking,
  onNavigateToSection,
}) => {
  const { lang } = useLanguage();

  const copy = {
    hoursTitle: pickLang(lang, {
      ar: 'ساعات العمل الأسبوعية',
      fr: "Horaires d'ouverture",
      amz: 'ⵉⵎⵉⵔⵏ ⵏ ⵜⵡⵓⵔⵉ',
      en: 'Weekly Opening Hours',
      es: 'Horario semanal',
    }),
    regularHours: pickLang(lang, {
      ar: 'الثلاثاء – الأحد: 11:00 – 13:00 · 16:00 – 22:00',
      fr: 'Mar – Dim : 11:00 – 13:00 · 16:00 – 22:00',
      amz: 'ⴰⵙⵉⵏⴰⵙ – ⴰⵙⴰⵎⴰⵙ : 11:00 – 13:00 · 16:00 – 22:00',
      en: 'Tue – Sun: 11:00 – 13:00 · 16:00 – 22:00',
      es: 'Mar – Dom: 11:00 – 13:00 · 16:00 – 22:00',
    }),
    fridayMondayHours: pickLang(lang, {
      ar: 'الجمعة: 15:00 – 22:00 · الإثنين: عطلة أسبوعية',
      fr: 'Vendredi : 15:00 – 22:00 · Lundi : Fermé',
      amz: 'ⵙⵉⵎⵡⴰⵙ : 15:00 – 22:00 · ⴰⵢⵏⴰⵙ : ⵉⵇⵇⵏ',
      en: 'Friday: 15:00 – 22:00 · Monday: Closed',
      es: 'Viernes: 15:00 – 22:00 · Lunes: Cerrado',
    }),
    bookAction: pickLang(lang, {
      ar: 'احجز موعدك الآن',
      fr: 'Réserver un créneau',
      amz: 'ⵃⵊⵣ ⴰⵙⵉⵀⵍ',
      en: 'Book a slot',
      es: 'Reservar cita',
    }),
    loyaltyTitle: pickLang(lang, {
      ar: 'الولاء والطابور الذكي',
      fr: 'Fidélité & File intelligente',
      amz: 'ⵜⴰⵖⵓⵏⵉ ⴷ ⵓⴹⴼⴰⵕ',
      en: 'Loyalty & Smart Queue',
      es: 'Fidelidad y Cola inteligente',
    }),
    loyaltyDesc: pickLang(lang, {
      ar: 'نقاط ولاء حسب الخدمة (+3 إلى +22 نقطة/زيارة) ومكافآت متدرجة تبدأ بعد 5 زيارات مؤكدة.',
      fr: 'Points calculés selon vos prestations (+3 à +22 pts/visite) et récompenses dès 5 visites confirmées.',
      amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵙ ⵜⵡⵓⵔⵉ (+3–22 pts/ⵜⵉⵔⵣⵉ) ⴷ ⵜⵙⵎⵖⵓⵔⵉⵏ ⵙⴳ 5 ⵏ ⵜⵉⵔⵣⴰ.',
      en: 'Service-based points (+3 to +22 pts/visit) with progressive rewards starting after 5 confirmed visits.',
      es: 'Puntos según servicio (+3 a +22 pts/visita) con premios desde las 5 visitas confirmadas.',
    }),
    viewLoyaltyAction: pickLang(lang, {
      ar: 'برنامج الولاء',
      fr: 'Voir les paliers',
      amz: 'ⵜⵉⵙⵎⵖⵓⵔⵉⵏ',
      en: 'View rewards',
      es: 'Ver premios',
    }),
    trackAction: pickLang(lang, {
      ar: 'تتبع التذكرة',
      fr: 'Suivi ticket',
      amz: 'ⴹⴼⵕ ⵜⴰⵡⵔⵉⵇⵜ',
      en: 'Track ticket',
      es: 'Seguir ticket',
    }),
    locationTitle: pickLang(lang, {
      ar: 'موقع الصالون بتارودانت',
      fr: 'Adresse à Taroudant',
      amz: 'ⴰⴷⵖⴰⵔ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ',
      en: 'Taroudant Location',
      es: 'Ubicación en Taroudant',
    }),
    mapsAction: pickLang(lang, {
      ar: 'فتح الاتجاهات على Maps',
      fr: 'Ouvrir dans Google Maps',
      amz: 'ⵕⵥⵎ ⴳ Google Maps',
      en: 'Open in Google Maps',
      es: 'Abrir en Google Maps',
    }),
  };

  return (
    <section
      aria-label={copy.hoursTitle}
      className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 shadow-2xs overflow-hidden"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x md:rtl:divide-x-reverse divide-stone-200 dark:divide-zinc-800">
        {/* 1. Weekly Opening Hours */}
        <div className="p-4 sm:p-5 flex flex-col justify-between gap-2.5">
          <div className="space-y-1.5">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0" />
              <span>{copy.hoursTitle}</span>
            </h3>
            <p className="text-xs text-stone-600 dark:text-zinc-300 font-mono tabular-nums leading-relaxed">
              {copy.regularHours}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-zinc-400 font-mono tabular-nums leading-relaxed">
              {copy.fridayMondayHours}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={onOpenBooking}
              className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline underline-offset-4 cursor-pointer inline-flex items-center gap-1"
            >
              <span>{copy.bookAction}</span>
            </button>
          </div>
        </div>

        {/* 2. Loyalty & Smart Queue Overview */}
        <div className="p-4 sm:p-5 flex flex-col justify-between gap-2.5">
          <div className="space-y-1.5">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0" />
              <span>{copy.loyaltyTitle}</span>
            </h3>
            <p className="text-xs text-stone-600 dark:text-zinc-300 leading-relaxed">
              {copy.loyaltyDesc}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => onNavigateToSection('loyalty')}
              className="font-bold text-amber-700 dark:text-amber-400 hover:underline underline-offset-4 cursor-pointer"
            >
              {copy.viewLoyaltyAction}
            </button>
            <span aria-hidden="true" className="text-stone-300 dark:text-zinc-700">
              ·
            </span>
            <button
              type="button"
              onClick={onOpenTrackBooking}
              className="font-bold text-slate-700 dark:text-zinc-200 hover:text-amber-700 dark:hover:text-amber-400 hover:underline underline-offset-4 cursor-pointer"
            >
              {copy.trackAction}
            </button>
          </div>
        </div>

        {/* 3. Taroudant Location & Quick Directions */}
        <div className="p-4 sm:p-5 flex flex-col justify-between gap-2.5">
          <div className="space-y-1.5">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0" />
              <span>{copy.locationTitle}</span>
            </h3>
            <p className="text-xs text-stone-600 dark:text-zinc-300 leading-relaxed">
              {SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}
            </p>
          </div>
          <div>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline underline-offset-4 inline-flex items-center gap-1"
            >
              <span>{copy.mapsAction}</span>
              <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
