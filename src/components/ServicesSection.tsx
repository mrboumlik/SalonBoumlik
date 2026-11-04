import React, { useState } from 'react';
import { 
  Scissors, 
  Sparkles, 
  Clock, 
  Check, 
  Flame, 
  HeartHandshake, 
  ShieldCheck, 
  MessageCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { SERVICES, SALON_INFO } from '../data/barbershopData';
import { BarberService } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface ServicesSectionProps {
  selectedServices: BarberService[];
  onToggleService: (service: BarberService) => void;
  onProceedToBooking: () => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  selectedServices,
  onToggleService,
  onProceedToBooking,
}) => {
  const { lang, t, isRtl } = useLanguage();
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const totalDuration = selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0);

  const categories = [
    { id: 'all', label: lang === 'ar' ? 'الكل' : lang === 'amz' ? 'ⵎⴰⵕⵕⴰ' : lang === 'en' ? 'All Services' : 'Toutes les Prestations' },
    { id: 'haircut', label: lang === 'ar' ? 'حسانة' : lang === 'amz' ? 'ⵜⴰⴽⵔⴹⴰ' : lang === 'en' ? 'Haircuts' : 'Coupes' },
    { id: 'beard', label: lang === 'ar' ? 'اللحية' : lang === 'amz' ? 'ⵜⴰⵎⴰⵔⵜ' : lang === 'en' ? 'Beard Styling' : 'Barbe' },
    { id: 'protein', label: lang === 'ar' ? 'البروتين والترطيبة' : lang === 'amz' ? 'ⴰⴱⵔⵓⵜⵉⵏ ⴷ ⵜⴰⵔⵟⵉⴱⴰ' : lang === 'en' ? 'Protein & Straightening' : 'Protéine & Soins' },
    { id: 'facial', label: lang === 'ar' ? 'العناية بالوجه والماسك' : lang === 'amz' ? 'ⴰⵙⵉⵔⵉⴷ ⴷ ⵓⵎⴰⵙⴽ' : lang === 'en' ? 'Facial & Masks' : 'Soins Visage & Masques' },
  ];

  const filteredServices = SERVICES.filter((s) => {
    if (filterCategory === 'all') return true;
    if (filterCategory === 'protein') return s.category === 'protein' || s.category === 'relaxing';
    return s.category === filterCategory;
  });

  return (
    <section id="services" className="py-16 md:py-24 bg-[#08090C] relative">
      {/* Background radial grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e2430_1px,transparent_1px)] [background-size:28px_28px] opacity-25 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.selectServicesTitle}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-display tracking-tight">
            {lang === 'ar' ? (
              <span>دليل <span className="text-gold-gradient">الخدمات والباقات الرجالية</span></span>
            ) : lang === 'amz' ? (
              <span>ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⴷ <span className="text-gold-gradient">ⵓⵙⵎⵙⴰⵙ ⵏ ⵓⵔⴳⴰⵣ</span></span>
            ) : lang === 'en' ? (
              <span>MENU & <span className="text-gold-gradient">GROOMING PACKAGES</span></span>
            ) : (
              <span>CATALOGUE & <span className="text-gold-gradient">FORMULES HOMME</span></span>
            )}
          </h2>

          <p className="text-sm sm:text-base text-zinc-300 font-body">
            {t.selectServicesSubtitle}
          </p>

          {/* Prompt constraint banner: NO FIXED PRICES */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm font-medium max-w-2xl mx-auto flex items-start sm:items-center gap-3 text-left">
            <HelpCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
            <span>{t.noFixedPricesNotice}</span>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-3 mb-8 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
                filterCategory === cat.id
                  ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-lg shadow-amber-400/20'
                  : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Interactive Checklist Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => {
            const isChecked = selectedServices.some((s) => s.id === service.id);

            return (
              <div
                key={service.id}
                onClick={() => onToggleService(service)}
                className={`rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between cursor-pointer border relative group ${
                  isChecked
                    ? 'bg-zinc-900/95 border-amber-400 shadow-xl shadow-amber-500/10 ring-2 ring-amber-400/30'
                    : 'bg-zinc-900/60 hover:bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Badge if available */}
                {service.badge && (
                  <div className="mb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      {service.badge[lang] || service.badge.fr}
                    </span>
                  </div>
                )}

                <div>
                  {/* Service Header with Checkbox */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                        {service.name[lang] || service.name.fr}
                      </h3>
                    </div>

                    {/* Custom Checkbox */}
                    <div 
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all ${
                        isChecked 
                          ? 'bg-amber-400 border-amber-400 text-zinc-950 shadow-md' 
                          : 'border-zinc-700 bg-zinc-950 group-hover:border-zinc-500'
                      }`}
                    >
                      {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </div>

                  {/* Estimated Duration pill & Pricing notice */}
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>~{service.durationMinutes} min</span>
                    </span>

                    <span className="text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 text-[11px]">
                      {lang === 'ar' ? 'السعر يحدد حسب الطلب' : lang === 'amz' ? 'ⴰⵜⵉⴳ ⵖⴼ ⵓⵙⵜⴰⵢ' : lang === 'en' ? 'Quote on WhatsApp' : 'Tarif sur devis WhatsApp'}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                    {service.description[lang] || service.description.fr}
                  </p>

                  {/* Checklist of what's included */}
                  {service.includes && (
                    <div className="space-y-1.5 mb-4 pt-2 border-t border-zinc-800/80">
                      {(service.includes[lang] || service.includes.fr).map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                          <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Toggle Status */}
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs mt-auto">
                  <span className={`font-semibold ${isChecked ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {isChecked 
                      ? (lang === 'ar' ? '✓ محدد في باقتي' : lang === 'amz' ? '✓ ⵉⵜⵜⵓⵙⵜⴰⵢ' : lang === 'en' ? '✓ Added to my bundle' : '✓ Sélectionné dans ma formule')
                      : (lang === 'ar' ? '+ اضغط للإضافة' : lang === 'amz' ? '+ ⵙⵜⵢ ⴰⴷ ⵜⵔⵏⵓⴷ' : lang === 'en' ? '+ Click to add' : '+ Cliquer pour ajouter')}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {SALON_INFO.city[lang] || SALON_INFO.city.fr}
                  </span>
                </div>

              </div>
            );
          })}
        </div>

        {/* Live Package Builder Sticky / Floating Card */}
        <div className="mt-12 rounded-3xl bg-gradient-to-r from-zinc-900 via-amber-950/30 to-zinc-900 border-2 border-amber-500/40 p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            
            <div className="space-y-2 text-center lg:text-left w-full lg:w-auto">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  {lang === 'ar' 
                    ? 'باقتك المخصصة • صالون بومليك' 
                    : lang === 'amz' 
                    ? 'ⵜⴰⵡⵓⵔⵉ ⵏⵏⴽ • ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ' 
                    : lang === 'en' 
                    ? 'Your Custom Package • Salon Boumlik' 
                    : 'Votre Formule Personnalisée • Salon Boumlik'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1">
                <span className="text-lg sm:text-2xl font-black text-white font-display">
                  {selectedServices.length} {t.selectedServicesCount}
                </span>
                <span className="text-zinc-500">•</span>
                <span className="text-xs sm:text-sm font-semibold text-amber-300 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{t.estimatedDuration} : ~{totalDuration} min</span>
                </span>
              </div>

              {/* Badges of selected items */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 pt-2">
                {selectedServices.map((s) => (
                  <span 
                    key={s.id} 
                    className="inline-flex items-center gap-1 text-xs bg-amber-400/15 border border-amber-400/40 text-amber-200 px-2.5 py-1 rounded-lg"
                  >
                    <span>{s.name[lang] || s.name.fr}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Action CTA */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-shrink-0">
              <button
                onClick={onProceedToBooking}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-zinc-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-400/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <MessageCircle className="w-5 h-5 fill-zinc-950" />
                <span>{t.requestQuoteViaWhatsApp}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
