import React, { useState } from 'react';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Phone, 
  Copy, 
  Check, 
  ExternalLink, 
  Car, 
  Compass, 
  ShieldCheck,
  Building,
  CalendarCheck
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';

interface LocationSectionProps {
  onOpenBooking: () => void;
}

export const LocationSection: React.FC<LocationSectionProps> = ({ onOpenBooking }) => {
  const { lang, t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(SALON_INFO.address[lang] || SALON_INFO.address.fr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const currentDayIndex = new Date().getDay();
  const hourScheduleIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;

  const embedSrc = mapType === 'standard'
    ? 'https://maps.google.com/maps?q=Rue%20Bir%20Anzarane,%20Taroudant,%20Morocco&t=&z=16&ie=UTF8&iwloc=&output=embed'
    : 'https://maps.google.com/maps?q=Rue%20Bir%20Anzarane,%20Taroudant,%20Morocco&t=k&z=16&ie=UTF8&iwloc=&output=embed';

  return (
    <section id="location" className="py-16 md:py-24 bg-[#050609] relative border-t border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.navLocation}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-display tracking-tight">
            {lang === 'ar' ? (
              <span>الموقع و <span className="text-gold-gradient">خرائط جوجل</span></span>
            ) : lang === 'amz' ? (
              <span>ⴰⴷⵖⴰⵔ ⴷ <span className="text-gold-gradient">ⴳⵓⴳⵍ ⵎⴰⴱⵙ</span></span>
            ) : lang === 'en' ? (
              <span>LOCATION & <span className="text-gold-gradient">GOOGLE MAPS</span></span>
            ) : (
              <span>ACCÈS & <span className="text-gold-gradient">GOOGLE MAPS</span></span>
            )}
          </h2>

          <p className="text-sm sm:text-base text-zinc-300 font-body">
            {lang === 'ar'
              ? 'يرحب بكم صالون بومليك في الطابق الثاني بشارع بئر أنزران بتارودانت.'
              : lang === 'amz'
              ? 'ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⵉⵍⵍⴰ ⴳ ⵓⵙⵡⵉⵔ 2 ⴳ ⵓⵖⴰⵔⴰⵙ ⵏ ⴱⵉⵔ ⴰⵏⵣⴰⵔⴰⵏ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ.'
              : lang === 'en'
              ? 'Salon Boumlik welcomes you on the 2nd floor on Rue Bir Anzarane in Taroudant.'
              : 'Salon Boumlik vous accueille au 2ème étage sur la Rue Bir Anzarane à Taroudant.'}
          </p>
        </div>

        {/* Grid: Details card + Google Maps Embed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Exact Location, Landmarks, Phone, Hours */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Address Card */}
            <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 p-6 sm:p-7 space-y-5 shadow-2xl">
              
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {lang === 'ar' ? 'العنوان بالتفصيل' : lang === 'amz' ? 'ⴰⴷⵖⴰⵔ ⵉⵎⴷⴰⵏ' : lang === 'en' ? 'Exact Address' : 'Adresse Précise'}
                    </h3>
                    <p className="text-xs text-amber-400 font-serif italic">
                      {SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCopyAddress}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">
                        {lang === 'ar' ? 'تم النسخ !' : lang === 'amz' ? 'ⵉⵜⵜⵓⵏⵖⵍ !' : 'Copié !'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>
                        {lang === 'ar' ? 'نسخ' : lang === 'amz' ? 'ⵏⵖⵍ' : 'Copier'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Exact landmark tags */}
              <div className="p-4 rounded-2xl bg-zinc-950/90 border border-amber-500/30 space-y-2 text-xs">
                <div className="font-bold text-white text-sm">
                  {SALON_INFO.name[lang] || SALON_INFO.name.fr} — "{SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}"
                </div>
                <div className="text-amber-300 font-medium">
                  {SALON_INFO.address[lang] || SALON_INFO.address.fr}
                </div>
                
                <div className="pt-2 border-t border-zinc-800/80 space-y-1.5 text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="font-semibold text-white">
                      {lang === 'ar' ? 'العلامة 1 :' : lang === 'amz' ? 'ⵜⴰⵎⴰⵜⴰⵔⵜ 1 :' : 'Repère 1 :'}
                    </span>
                    <span>
                      {lang === 'ar' 
                        ? 'فوق صانع الأسنان' 
                        : lang === 'amz' 
                        ? 'ⵖⵉⴳⴼ ⵏ ⵓⵎⵙⴽⴰⵔ ⵏ ⵓⵅⵙⴰⵏ' 
                        : 'Au-dessus du Technicien Dentaire'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="font-semibold text-white">
                      {lang === 'ar' ? 'العلامة 2 :' : lang === 'amz' ? 'ⵜⴰⵎⴰⵜⴰⵔⵜ 2 :' : 'Repère 2 :'}
                    </span>
                    <span>
                      {lang === 'ar' 
                        ? 'فوق مخبزة إتري (ITRI)' 
                        : lang === 'amz' 
                        ? 'ⵖⵉⴳⴼ ⵏ ⵜⴼⵔⵏⵓⵜ ⵏ ⵉⵜⵔⵉ' 
                        : 'Au-dessus de la Boulangerie ITRI'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="font-semibold text-white">
                      {lang === 'ar' ? 'الطابق :' : lang === 'amz' ? 'ⴰⵙⵡⵉⵔ :' : 'Niveau :'}
                    </span>
                    <span>
                      {lang === 'ar' 
                        ? 'الطابق الثاني' 
                        : lang === 'amz' 
                        ? 'ⴰⵙⵡⵉⵔ ⵡⵉⵙⵙ 2' 
                        : '2ème Étage'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Directions & Call Phone 0635392503 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href={SALON_INFO.googleMapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 hover:brightness-105 active:scale-95 transition-all text-center"
                >
                  <Navigation className="w-4 h-4 text-zinc-950" />
                  <span>{t.getDirections}</span>
                </a>

                <a
                  href={`tel:${SALON_INFO.phone}`}
                  className="py-3.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition-colors text-center"
                >
                  <Phone className="w-4 h-4 text-amber-400" />
                  <span>06 35 39 25 03</span>
                </a>
              </div>

              {/* Practical tips */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-2 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Car className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>
                    {lang === 'ar' 
                      ? 'مواقف سيارات متوفرة بشارع بئر أنزران.' 
                      : lang === 'amz' 
                      ? 'ⴰⵙⵔⵓⵙ ⵏ ⵜⴽⵕⵕⵓⵙⵉⵏ ⵉⵍⵍⴰ ⴳ ⵓⵖⴰⵔⴰⵙ.' 
                      : lang === 'en' 
                      ? 'Easy parking available on Rue Bir Anzarane.' 
                      : 'Stationnement accessible sur la Rue Bir Anzarane.'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>
                    {lang === 'ar' 
                      ? 'فضاء مكيف وهادئ في الطابق الثاني.' 
                      : lang === 'amz' 
                      ? 'ⴰⴷⵖⴰⵔ ⵉⵙⵎⵎⴰⴹⵏ ⴳ ⵓⵙⵡⵉⵔ 2.' 
                      : lang === 'en' 
                      ? 'Air-conditioned and peaceful space on 2nd floor.' 
                      : 'Espace climatisé, insonorisé et calme au 2ème étage.'}
                  </span>
                </div>
              </div>

            </div>

            {/* Working Hours Card */}
            <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {lang === 'ar' ? 'أوقات العمل' : lang === 'amz' ? 'ⵉⵎⵉⵔⵏ ⵏ ⵓⵕⵥⵥⵓⵎ' : lang === 'en' ? 'Working Hours' : "Horaires d'Ouverture"}
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      {lang === 'ar' ? 'طيلة أيام الأسبوع' : lang === 'amz' ? '7 ⵏ ⵡⵓⵙⵙⴰⵏ' : '7/7'}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  {lang === 'ar' ? 'مفتوح 7/7' : lang === 'amz' ? 'ⵉⵕⵥⵎ 7/7' : lang === 'en' ? 'Open 7/7' : 'Ouvert 7j/7'}
                </span>
              </div>

              <div className="divide-y divide-zinc-800/80 text-xs">
                {SALON_INFO.hours.map((item, idx) => {
                  const isToday = idx === hourScheduleIndex;
                  return (
                    <div 
                      key={idx}
                      className={`py-2 flex items-center justify-between ${
                        isToday ? 'bg-amber-500/10 -mx-2 px-2 rounded-lg font-bold text-amber-300' : 'text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{lang === 'ar' ? item.dayAr : lang === 'amz' ? item.dayAmz : lang === 'en' ? item.dayEn : item.dayFr}</span>
                        {isToday && (
                          <span className="text-[10px] bg-amber-400 text-zinc-950 px-1.5 py-0.2 rounded font-extrabold uppercase">
                            {lang === 'ar' ? 'اليوم' : lang === 'amz' ? 'ⴰⵙⵙ-ⴰ' : lang === 'en' ? 'Today' : "Aujourd'hui"}
                          </span>
                        )}
                        {item.noteFr && (
                          <span className="text-[10px] text-zinc-400 italic">
                            ({lang === 'ar' ? item.noteAr : lang === 'amz' ? item.noteAmz : lang === 'en' ? item.noteEn : item.noteFr})
                          </span>
                        )}
                      </div>
                      <span className={isToday ? 'text-amber-300 font-bold' : 'text-zinc-400 font-mono'}>
                        {item.hours}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Google Maps Interactive Embed */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-3xl overflow-hidden bg-zinc-900 border border-amber-500/30 shadow-2xl relative">
              
              {/* Map Toolbar */}
              <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white">
                    {lang === 'ar' ? 'الخريطة: شارع بئر أنزران، تارودانت' : lang === 'amz' ? 'ⵜⴰⴽⴰⵕⴹⴰ: ⴱⵉⵔ ⴰⵏⵣⴰⵔⴰⵏ, ⵜⴰⵔⵓⴷⴰⵏⵜ' : 'Carte : Rue Bir Anzarane, Taroudant'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 text-xs">
                    <button
                      onClick={() => setMapType('standard')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        mapType === 'standard' ? 'bg-amber-400 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {lang === 'ar' ? 'عادي' : lang === 'amz' ? 'ⴰⵏⵎⴰⵍⴰⵢ' : 'Plan'}
                    </button>
                    <button
                      onClick={() => setMapType('satellite')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        mapType === 'satellite' ? 'bg-amber-400 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {lang === 'ar' ? 'أقمار صناعية' : lang === 'amz' ? 'ⴰⵙⴰⵜⵉⵍⵉⵜ' : 'Satellite'}
                    </button>
                  </div>

                  <a
                    href={SALON_INFO.googleMapsDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                    title="Google Maps"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'ar' ? 'فتح في خرائط جوجل' : lang === 'amz' ? 'ⴳⵓⴳⵍ ⵎⴰⴱⵙ' : 'Google Maps'}</span>
                  </a>
                </div>
              </div>

              {/* Map Iframe */}
              <div className="relative w-full h-[400px] sm:h-[480px] bg-zinc-950">
                <iframe
                  title="Google Maps Location - Salon Boumlik Taroudant"
                  src={embedSrc}
                  className="w-full h-full border-0 filter contrast-[1.05]"
                  loading="lazy"
                  allowFullScreen
                />

                {/* Floating GPS Launch Button */}
                <div className="absolute bottom-4 right-4 z-10">
                  <a
                    href={SALON_INFO.googleMapsDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-2xl hover:scale-105 active:scale-95 transition-all"
                  >
                    <Navigation className="w-4 h-4 text-zinc-950" />
                    <span>{t.getDirections}</span>
                  </a>
                </div>
              </div>

              {/* Bottom footer banner */}
              <div className="p-4 bg-zinc-950 text-xs text-zinc-400 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>{SALON_INFO.city[lang] || SALON_INFO.city.fr} • Rue Bir Anzarane</span>
                </span>
                <span className="text-zinc-500 font-mono">
                  GPS: 30.4705° N, 8.8770° W
                </span>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
