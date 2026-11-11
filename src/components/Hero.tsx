import React from 'react';
import { 
  Sparkles, 
  MapPin, 
  Star, 
  ArrowRight, 
  ShieldCheck, 
  Scissors, 
  Coffee,
  Clock,
  Ticket,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { QuickQrModals } from './QuickQrModals';
import heroLogoImage from '../assets/images/regenerated_image_1793760774705.png';

interface HeroProps {
  onOpenBooking: () => void;
  onOpenTrackBooking?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking, onOpenTrackBooking }) => {
  const { lang, t, isRtl } = useLanguage();

  const heroDescription = {
    fr: "Sanctuaire d'exception exclusivement réservé aux hommes à Taroudant : architecture du cheveu, taille de barbe au coupe-choux, soins du visage et confort absolu dans un salon climatisé.",
    ar: "فضاء متكامل ومميز للرجال في تارودانت يجمع بين الإتقان في تصفيف الشعر وقصات التدريج العصرية، تحديد اللحية بالموس، والعناية بالبشرة مع راحة تامة وضيافة مغربية أصيلة.",
    en: "An exclusive gentlemen’s grooming sanctuary in Taroudant blending precision scissor craft, straight razor beard sculpting, facial skincare, and tailored hospitality.",
    amz: "ⴰⴷⵖⴰⵔ ⵉⵥⵍⵉⵏ ⵙ ⵓⵔⴳⴰⵣ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ, ⵜⴰⴽⵔⴹⴰ ⵜⴰⵜⵔⴰⵔⵜ, ⵜⴰⵎⴰⵔⵜ ⴷ ⵓⵙⵉⵔⵉⴷ ⵏ ⵓⴷⵎ ⵙ ⵜⵏⴼⵔⵓⵜ ⴷ ⵓⵙⵓⵏⴼⵓ.",
    es: "Un santuario exclusivo de barbería para hombres en Taroudant: corte de precisión, arreglo de barba a navaja y cuidado facial.",
  };

  const addressLabel = {
    fr: 'Adresse du Salon à Taroudant :',
    ar: 'عنوان الصالون في تارودانت :',
    en: 'Salon Address in Taroudant:',
    amz: 'ⴰⴷⵖⴰⵔ ⵏ ⵙⴰⵍⵓⵏ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ :',
    es: 'Dirección del salón en Taroudant:',
  };

  const mapsBtnLabel = {
    fr: 'Google Maps',
    ar: 'خرائط Google',
    en: 'Google Maps',
    amz: 'Google Maps',
    es: 'Google Maps',
  };

  return (
    <section className="relative overflow-hidden pt-6 pb-10 sm:pt-10 sm:pb-14 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-black">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/3 w-[350px] sm:w-[500px] h-[300px] bg-red-600/5 dark:bg-red-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-1/3 w-[350px] sm:w-[500px] h-[300px] bg-blue-600/5 dark:bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-md sm:max-w-xl mx-auto px-4 relative z-10 text-center space-y-5">
        
        {/* Prestige Badges: Men's Services Only + 5.0 Rating */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/40 text-[11px] font-bold text-red-700 dark:text-red-300 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>{t.mensOnly}</span>
          </div>

          <a 
            href={SALON_INFO.social.googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-amber-500/50 transition-colors shadow-xs"
          >
            <div className="flex text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-500 text-amber-500" />
              ))}
            </div>
            <span className="font-bold text-zinc-900 dark:text-white">5.0</span>
            <span className="text-zinc-500">Google Reviews</span>
          </a>
        </div>

        {/* Brand Icon & Typography */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl p-2 bg-gradient-to-b from-zinc-100 to-white dark:from-zinc-800 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-700 shadow-xl flex items-center justify-center">
            <img 
              src={heroLogoImage || SALON_INFO.media.logoClean} 
              alt="Salon Boumlik Logo" 
              className="w-full h-full object-contain filter drop-shadow-md"
            />
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight font-display text-zinc-900 dark:text-white leading-tight">
              SALON <span className="text-red-600">BOU</span><span className="text-blue-600">MLIK</span>
            </h1>
            <p className="text-sm sm:text-base font-bold italic tracking-wide text-amber-600 dark:text-amber-400">
              "{SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}"
            </p>
          </div>

          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-sm sm:max-w-md mx-auto">
            {heroDescription[lang] || heroDescription.fr}
          </p>
        </div>

        {/* MASSIVE PRIMARY CTA: Book Now / احجز الآن (Direct Action) */}
        <div className="pt-1">
          <a
            href="#booking"
            onClick={(e) => {
              const el = document.getElementById('booking');
              if (el) {
                e.preventDefault();
                el.scrollIntoView({ behavior: 'smooth' });
              } else {
                onOpenBooking();
              }
            }}
            className="w-full py-4 sm:py-4.5 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-500 hover:to-red-400 text-white font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-xl shadow-red-600/30 active:scale-[0.98] transition-all cursor-pointer group"
          >
            <Scissors className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
            <span>{lang === 'ar' ? 'احجز الآن / Book Now' : 'Réserver Maintenant • Book Now'}</span>
            <ArrowRight className="w-5 h-5 text-white/90 rtl:rotate-180" />
          </a>
        </div>

        {/* Quick QR Modals (Instagram, Wi-Fi, WhatsApp, Google Reviews) */}
        <div className="pt-2">
          <QuickQrModals />
        </div>

        {/* Compact Address Badge */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 text-left rtl:text-right text-xs space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold text-[11px] sm:text-xs">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
              <span>{addressLabel[lang] || addressLabel.fr}</span>
            </div>
            <a
              href={SALON_INFO.googleMapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>{mapsBtnLabel[lang] || mapsBtnLabel.fr}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-zinc-700 dark:text-zinc-200 text-[11px] leading-relaxed">
            {SALON_INFO.address[lang] || SALON_INFO.address.fr}
          </p>
        </div>

      </div>
    </section>
  );
};

