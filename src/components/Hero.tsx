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
    fr: 'Voir sur Google Maps',
    ar: 'فتح في خرائط Google',
    en: 'View on Google Maps',
    amz: 'ⵕⵥⵎ ⴳ Google Maps',
    es: 'Ver en Google Maps',
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-16 md:pb-24 border-b border-zinc-800/80 bg-black">
      
      {/* Background ambient lighting - Barber red and blue glows */}
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[350px] bg-red-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-1/3 w-[500px] h-[350px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        
        {/* Prestige Badges: Men's Services Only + Rating + Comfort */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2.5 mb-6">
          
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-950/40 border border-red-500/40 text-xs font-bold text-red-300 shadow-sm backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
            <span>{t.mensOnly}</span>
          </div>

          <a 
            href={SALON_INFO.social.googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 hover:border-amber-500/40 transition-colors"
          >
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400" />
              ))}
            </div>
            <span className="font-bold text-white">5.0</span>
            <span className="text-zinc-500">Google Reviews</span>
          </a>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-blue-300">
            <Coffee className="w-3.5 h-3.5 text-blue-400" />
            <span>{lang === 'ar' ? 'شاي وقهوة مجانية' : lang === 'amz' ? 'ⴰⵜⴰⵢ ⴼⴰⴱⵓⵕ' : 'Thé & Café Offerts'}</span>
          </div>

        </div>

        {/* Brand Icon & Typography */}
        <div className="flex flex-col items-center justify-center space-y-4 mb-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl p-2 bg-gradient-to-b from-zinc-800 to-zinc-950 border border-zinc-700/80 shadow-2xl flex items-center justify-center">
            <img 
              src={heroLogoImage || SALON_INFO.media.logoClean} 
              alt="Salon Boumlik Logo" 
              className="w-full h-full object-contain filter drop-shadow-md"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight font-display text-white leading-tight">
              SALON <span className="text-red-500">BOU</span><span className="text-blue-500">MLIK</span>
            </h1>
            <p className="text-lg sm:text-2xl font-bold italic tracking-wide text-amber-400/90">
              "{SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}"
            </p>
          </div>

          <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed pt-1">
            {heroDescription[lang] || heroDescription.fr}
          </p>
        </div>

        {/* Address Card (Linked directly to official Google Maps link) */}
        <div className="mb-8 max-w-xl mx-auto p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 shadow-lg text-left backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-red-400 font-bold text-xs sm:text-sm">
              <MapPin className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{addressLabel[lang] || addressLabel.fr}</span>
            </div>
            <a
              href={SALON_INFO.googleMapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              <span>{mapsBtnLabel[lang] || mapsBtnLabel.fr}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-zinc-200 text-xs sm:text-sm font-semibold leading-relaxed">
            {SALON_INFO.address[lang] || SALON_INFO.address.fr}
          </p>

          <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 text-blue-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              {lang === 'ar' ? 'الطابق 2 فوق مخبزة إتري وصانع الأسنان' : '2ème Étage au-dessus Boulangerie ITRI'}
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              10:00 - 22:00
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="#booking"
            className="py-3.5 px-7 sm:px-9 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-red-600/30 transition-all cursor-pointer"
          >
            <Scissors className="w-4 h-4" />
            <span>{lang === 'ar' ? 'احجز موعدك الآن' : 'Prendre Rendez-vous'}</span>
          </a>

          <a
            href="#services"
            className="py-3.5 px-6 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>{lang === 'ar' ? 'الخدمات والتسعيرة' : 'Services & Tarifs'}</span>
            <ArrowRight className="w-4 h-4 text-blue-400" />
          </a>

          {onOpenTrackBooking && (
            <button
              type="button"
              onClick={onOpenTrackBooking}
              className="py-3.5 px-5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Ticket className="w-4 h-4 text-amber-400" />
              <span>{lang === 'ar' ? 'تتبع تذكرتي' : 'Suivre mon ticket'}</span>
            </button>
          )}
        </div>

      </div>
    </section>
  );
};
