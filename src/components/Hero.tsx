import React from 'react';
import { 
  Sparkles, 
  MapPin, 
  Star, 
  ArrowRight, 
  PhoneCall, 
  ShieldCheck, 
  Scissors, 
  Award,
  Coffee,
  Tv,
  Wifi,
  Clock,
  MessageCircle,
  CheckCircle2
} from 'lucide-react';
import { SALON_INFO, TEAM_MEMBERS } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import heroBrandedBanner from '../assets/images/regenerated_image_1793638372422.png';

interface HeroProps {
  onOpenBooking: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking }) => {
  const { lang, t, isRtl } = useLanguage();

  const heroDescription = {
    fr: "Sanctuaire d'exception exclusivement réservé aux hommes à Taroudant : architecture du cheveu, taille de barbe au coupe-choux, soins du visage et confort absolu dans un salon climatisé.",
    ar: "فضاء متكامل ومميز للرجال في تارودانت يجمع بين الإتقان في تصفيف الشعر وقصات التدريج العصرية، تحديد اللحية بالموس، والعناية بالبشرة مع راحة تامة وضيافة مغربية أصيلة.",
    en: "An exclusive gentlemen’s grooming sanctuary in Taroudant blending precision scissor craft, straight razor beard sculpting, facial skincare, and tailored hospitality.",
    amz: "ⴰⴷⵖⴰⵔ ⵉⵥⵍⵉⵏ ⵙ ⵓⵔⴳⴰⵣ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ, ⵜⴰⴽⵔⴹⴰ ⵜⴰⵜⵔⴰⵔⵜ, ⵜⴰⵎⴰⵔⵜ ⴷ ⵓⵙⵉⵔⵉⴷ ⵏ ⵓⴷⵎ ⵙ ⵜⵏⴼⵔⵓⵜ ⴷ ⵓⵙⵓⵏⴼⵓ.",
  };

  const addressLabel = {
    fr: 'Adresse du Salon à Taroudant :',
    ar: 'عنوان الصالون في تارودانت :',
    en: 'Salon Address in Taroudant:',
    amz: 'ⴰⴷⵖⴰⵔ ⵏ ⵙⴰⵍⵓⵏ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ :',
  };

  const amenitiesPreviewTitle = {
    fr: 'Espace Confort & Boisson Offerte',
    ar: 'فضاء الراحة والمشروب المجاني',
    en: 'Comfort Lounge & Complimentary Drink',
    amz: 'ⴰⵎⵎⴰⵙ ⵏ ⵓⵙⵓⵏⴼⵓ ⴷ ⵜⵉⵙⵉⵜ ⴼⴰⴱⵓⵕ',
  };

  const amenitiesPreviewDesc = {
    fr: 'Détendez-vous pendant votre attente : Wi-Fi Fibre haut débit, écran TV HD et choix de boisson offerte (Thé à la menthe ou Café expresso).',
    ar: 'استمتع بالراحة التامة أثناء انتظار دورك: إنترنت ويفي سريع، شاشة تلفاز حديثة، ومشروب ساخن مجاني (شاي بالنعناع أو قهوة).',
    en: 'Enjoy pure relaxation while you wait: High-speed fiber Wi-Fi, HD TV screen, and your choice of complimentary Moroccan tea or espresso.',
    amz: 'ⵙⵙⵓⴼⵖ ⴰⴽⵓⴷ ⵉⵖⵓⴷⴰⵏ ⴳ ⵓⵔⴰⵊⴰ: ⵡⴰⵢ-ⴼⴰⵢ ⴼⴰⴱⵓⵕ, ⵜⵉⵍⵉⴼⵉⵣⵢⵓⵏ ⴷ ⵡⴰⵜⴰⵢ ⵏⵖ ⵜⴰⴽⴰⴼⵉⵜ.',
  };

  const teamLabel = {
    fr: "L'Équipe :",
    ar: 'فريق العمل :',
    en: 'The Team:',
    amz: 'ⵜⴰⵔⴰⴱⴱⵓⵜ :',
  };

  return (
    <section className="relative overflow-hidden pt-6 pb-16 md:pt-14 md:pb-24 border-b border-zinc-800/80">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-12 right-10 w-[350px] h-[350px] bg-amber-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#08090C] to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Brand Identity, Slogan, Highlights & Action buttons */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            
            {/* Prestige Badges: Men's Services Only + Rating + Comfort */}
            <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
              
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-xs font-bold text-amber-300 shadow-sm shadow-amber-500/10 backdrop-blur-md">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.mensOnly}</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400" />
                  ))}
                </div>
                <span className="font-bold text-white">5.0</span>
                <span className="text-zinc-500">Google Reviews</span>
              </div>

              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-amber-300">
                <Coffee className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'ar' ? 'شاي وقهوة مجانية' : lang === 'amz' ? 'ⴰⵜⴰⵢ ⴼⴰⴱⵓⵕ' : 'Thé & Café Offerts'}</span>
              </div>

            </div>

            {/* Main Brand Title & Slogan */}
            <div className="space-y-3">
              <div className="flex items-center justify-center lg:justify-start gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-1.5 bg-white/5 border border-amber-500/40 shadow-xl shadow-amber-500/10 flex-shrink-0">
                  <img 
                    src={SALON_INFO.media.logo} 
                    alt="Salon Boumlik Logo" 
                    className="w-full h-full object-contain filter drop-shadow"
                  />
                </div>
                <div>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight font-display text-white leading-none">
                    {lang === 'amz' ? (
                      <span>ⵙⴰⵍⵓⵏ <span className="text-gold-gradient">ⴱⵓⵎⵍⵉⴽ</span></span>
                    ) : lang === 'ar' ? (
                      <span>صالون <span className="text-gold-gradient">بومليك</span></span>
                    ) : (
                      <span>SALON <span className="text-gold-gradient">BOUMLIK</span></span>
                    )}
                  </h1>
                  <p className="text-base sm:text-xl font-bold font-serif text-amber-400 italic tracking-wide mt-1">
                    "{SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}"
                  </p>
                </div>
              </div>

              <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto lg:mx-0 font-body leading-relaxed pt-1">
                {heroDescription[lang] || heroDescription.fr}
              </p>
            </div>

            {/* Exact Address Highlight (Above Dental Technician & ITRI Bakery) */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/25 max-w-xl mx-auto lg:mx-0 text-left text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>{addressLabel[lang] || addressLabel.fr}</span>
              </div>
              <p className="text-zinc-200 pl-6 leading-relaxed">
                {SALON_INFO.address[lang] || SALON_INFO.address.fr}
              </p>
              <div className="pl-6 text-[11px] text-zinc-400 flex flex-wrap gap-2 pt-0.5">
                <span className="text-amber-300 font-bold">📍 0635392503</span>
                <span>•</span>
                <span>Rue Bir Anzarane • Taroudant</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 sm:gap-4">
              
              {/* 1. Book on WhatsApp (Primary) */}
              <button
                onClick={onOpenBooking}
                className="group px-7 py-4 rounded-2xl font-black text-sm sm:text-base text-zinc-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 shadow-xl shadow-amber-500/25 active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <MessageCircle className="w-5 h-5 text-zinc-950 fill-zinc-950" />
                <span>{t.bookAppointment}</span>
                <ArrowRight className="w-4 h-4 text-zinc-950 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* 2. View Interactive Services Checklist */}
              <a
                href="#services"
                className="px-6 py-4 rounded-2xl font-bold text-sm sm:text-base text-zinc-100 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-amber-500/50 shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Scissors className="w-4 h-4 text-amber-400" />
                <span>{t.viewServices}</span>
              </a>

              {/* 3. Direct Phone Call (0635392503) */}
              <a
                href={`tel:${SALON_INFO.phone}`}
                className="px-5 py-4 rounded-2xl font-bold text-sm sm:text-base text-zinc-300 hover:text-white bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-800 transition-all flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4 text-amber-400" />
                <span>{SALON_INFO.displayPhone}</span>
              </a>

            </div>

            {/* Team Members Mention */}
            <div className="pt-4 border-t border-zinc-800/60 flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">{teamLabel[lang] || teamLabel.fr}</span>
              {TEAM_MEMBERS.map((barber, idx) => (
                <React.Fragment key={barber.id}>
                  {idx > 0 && <span>•</span>}
                  <span className={barber.isOwner ? 'text-amber-400 font-bold' : 'text-zinc-300'}>
                    {barber.name[lang] || barber.name.fr}
                  </span>
                </React.Fragment>
              ))}
            </div>

          </div>

          {/* Right Column: Authentic Poster & Amenities Visual Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Outer decorative glow frame */}
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-amber-500/30 via-amber-600/10 to-transparent blur-md pointer-events-none" />
              
              <div className="relative rounded-3xl overflow-hidden bg-zinc-900 border border-amber-500/40 shadow-2xl">
                
                {/* Embedded Authentic Salon Boumlik Poster */}
                <div className="relative w-full overflow-hidden bg-[#0A0D14]">
                  <img
                    src={heroBrandedBanner}
                    alt="Salon Boumlik - More Than Barber Shop"
                    className="w-full h-auto object-cover filter contrast-[1.03] hover:scale-102 transition-transform duration-500"
                  />
                  
                  {/* Floating Overlay Badge */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="bg-zinc-950/90 backdrop-blur-md text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/40 flex items-center gap-1.5 shadow-lg">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>{SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}</span>
                    </span>

                    <span className="bg-emerald-500 text-zinc-950 text-xs font-extrabold px-3 py-1 rounded-full shadow-lg font-mono">
                      06 35 39 25 03
                    </span>
                  </div>
                </div>

                {/* Bottom Interactive Feature Bar: Amenities & Comfort Experience */}
                <div className="p-4 sm:p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <Coffee className="w-4 h-4 text-amber-400" />
                      {amenitiesPreviewTitle[lang] || amenitiesPreviewTitle.fr}
                    </span>
                    <span className="text-amber-400 font-extrabold uppercase text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {lang === 'ar' ? 'مجاني للزبائن' : lang === 'amz' ? 'ⴼⴰⴱⵓⵕ' : 'Offert'}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {amenitiesPreviewDesc[lang] || amenitiesPreviewDesc.fr}
                  </p>

                  <div className="pt-2 flex items-center justify-between border-t border-zinc-800/80">
                    <div className="text-[11px] text-zinc-400">
                      {SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}
                    </div>
                    <button
                      onClick={onOpenBooking}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{lang === 'ar' ? 'طلب السعر والحجز' : lang === 'amz' ? 'ⴰⵙⵔⵓⵙ ⴳ ⵡⴰⵜⵙⴰⴱ' : 'Demander mon Devis'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
