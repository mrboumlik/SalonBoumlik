import React, { useState } from 'react';
import { 
  Scissors, 
  Sparkles, 
  Check, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  ShieldCheck, 
  Tag, 
  Clock, 
  Flame, 
  ChevronDown, 
  ArrowRight,
  Info
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { 
  BASE_SERVICES, 
  calculateCartPricing, 
  COLOR_PRICES, 
  COLOR_LABELS, 
  COVERAGE_LABELS,
  ServiceDefinition 
} from '../utils/pricingEngine';
import { HairColorConfig, PricingEngineResult } from '../types';

interface ServicesSectionProps {
  selectedIds: string[];
  onToggleServiceId: (id: string) => void;
  colorConfig: HairColorConfig;
  onChangeColorConfig: (cfg: HairColorConfig) => void;
  proteinPrice: number;
  onChangeProteinPrice: (price: number) => void;
  pricingResult: PricingEngineResult;
  onProceedToBooking: () => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  selectedIds,
  onToggleServiceId,
  colorConfig,
  onChangeColorConfig,
  proteinPrice,
  onChangeProteinPrice,
  pricingResult,
  onProceedToBooking,
}) => {
  const { lang, t, isRtl } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: { fr: 'Tous les Services', ar: 'جميع الخدمات', en: 'All Services', amz: 'ⵎⴰⵕⵕⴰ ⵉⵎⵓⵙⵙⵓⵜⵏ', es: 'Todos los servicios' } },
    { id: 'haircut', label: { fr: 'Cheveux & Coiffage', ar: 'الشعر والتصفيف', en: 'Hair & Styling', amz: 'ⵓⵣⵣⴰⵔ', es: 'Cabello y peinado' } },
    { id: 'beard', label: { fr: 'Barbe & Rasage', ar: 'اللحية والشارب', en: 'Beard & Shave', amz: 'ⵜⴰⵎⴰⵔⵜ', es: 'Barba y afeitado' } },
    { id: 'facial', label: { fr: 'Soins Visage', ar: 'العناية بالوجه', en: 'Facial Care', amz: 'ⵓⴷⵎ', es: 'Cuidado facial' } },
    { id: 'treatments', label: { fr: 'Kératine & Soins', ar: 'البروتين والعلاجات', en: 'Keratin & Treatments', amz: 'ⴰⵙⵓⵊⵊⵉ', es: 'Tratamientos' } },
    { id: 'color', label: { fr: 'Colorations', ar: 'الصباغة والألوان', en: 'Hair Coloring', amz: 'ⴰⴽⵍⵓ', es: 'Coloración' } },
  ];

  const filteredServices = BASE_SERVICES.filter((s) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'haircut') return s.category === 'haircut' || s.category === 'wash';
    if (activeCategory === 'beard') return s.category === 'beard';
    if (activeCategory === 'facial') return s.category === 'facial';
    if (activeCategory === 'treatments') return s.category === 'protein' || s.category === 'relaxing';
    if (activeCategory === 'color') return s.category === 'color';
    return true;
  });

  const ui = {
    badge: {
      fr: 'Tarifs Clairs & Remises Automatiques',
      ar: 'أسعار واضحة وتخفيضات الباقات التلقائية',
      en: 'Transparent Pricing & Live Bundle Savings',
      amz: 'ⴰⵜⵉⴳⵏ ⵉⴼⴰⵡⵏ ⴷ ⵉⵙⵙⵏⴼⵍⵏ',
      es: 'Precios claros y descuentos automáticos',
    }[lang] || 'Tarifs Clairs',
    title: {
      fr: 'Prestations & Panier Dynamique',
      ar: 'قائمة الخدمات ومحرك الأسعار الذكي',
      en: 'Barbershop Services & Live Cart',
      amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⴷ ⵓⵇⵔⴰⴱ ⴰⵍⵉⴽⵜⵕⵓⵏⵉ',
      es: 'Servicios y carrito interactivo',
    }[lang] || 'Prestations',
    subtitle: {
      fr: 'Sélectionnez vos soins. Notre moteur calcule instantanément vos réductions combos et remises fidélité.',
      ar: 'اختر ما يناسبك. يتم احتساب خصومات باقة الحسانة واللحية، وتخفيضات العناية تلقائياً وبأعلى توفير.',
      en: 'Select your grooming services. Our engine dynamically calculates bundle combos and override savings.',
      amz: 'ⴼⵔⵏ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⴽ. ⴰⵙⵖⵍⵉ ⴰⵔ ⵉⵜⵜⵃⵙⴰⴱ ⵜⵉⵙⵏⴼⴰⵍ ⵙ ⵜⵉⵣⵣⵍⴰ.',
      es: 'Selecciona tus servicios. Nuestro motor calcula al instante tus descuentos por combos y promociones.',
    }[lang] || 'Sélectionnez vos soins.',
    cartTitle: {
      fr: 'Votre Panier & Total Estimé',
      ar: 'سلة الخدمات وحساب التوفير',
      en: 'Your Grooming Cart',
      amz: 'ⴰⵇⵔⴰⴱ ⵏⵏⴽ',
      es: 'Tu cesta de servicios',
    }[lang] || 'Votre Panier',
    emptyCart: {
      fr: 'Aucun service sélectionné. Cliquez sur un soin pour l’ajouter.',
      ar: 'السلة فارغة. اضغط على أي خدمة لإضافتها واكتشاف التخفيض.',
      en: 'No service added yet. Click any service to add.',
      amz: 'ⵓⵔⵜⴰ ⵜⴼⵔⵉⵏⴷ ⴰⵎⵢⴰ. ⴷⴳⴳⵉ ⵖⴼ ⴽⵔⴰ ⵏ ⵜⵡⵓⵔⵉ.',
      es: 'Ningún servicio seleccionado. Pulsa en uno para añadirlo.',
    }[lang] || 'Panier vide',
    proceedBtn: {
      fr: 'Valider et Choisir l’Heure',
      ar: 'تأكيد وحجز الموعد الآن',
      en: 'Proceed to Book Appointment',
      amz: 'ⵙⵙⴷⵓ ⴰⵙⵔⵓⵙ',
      es: 'Continuar con la reserva',
    }[lang] || 'Valider',
    savingsLabel: {
      fr: 'Économie Réalisée :',
      ar: 'إجمالي التوفير لك:',
      en: 'Total Savings:',
      amz: 'ⵜⵉⵙⵏⴼⴰⵍ:',
      es: 'Ahorro total:',
    }[lang] || 'Économie :',
    totalLabel: {
      fr: 'Total à Payer :',
      ar: 'المجموع الإجمالي:',
      en: 'Total Amount:',
      amz: 'ⵜⵉⵖⵔⴰⴷ ⵎⴰⵕⵕⴰ:',
      es: 'Total a pagar:',
    }[lang] || 'Total :',
  };

  const formatDuration = (mins: number) => {
    if (lang === 'ar') return `${mins} دقيقة`;
    if (lang === 'amz') return `${mins} ⵜⵓⵙⴷⵉⴷⵜ`;
    if (lang === 'en') return `${mins} mins`;
    return `${mins} min`;
  };

  const totalEstimatedDuration = BASE_SERVICES.filter((s) => selectedIds.includes(s.id)).reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );

  return (
    <section id="services" className="py-16 sm:py-24 bg-slate-50 dark:bg-black text-slate-900 dark:text-white relative border-t border-slate-200 dark:border-zinc-900 transition-colors">
      {/* Barber Pole subtle border on top */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 via-white to-blue-600 opacity-80" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-red-600 dark:text-red-400 mb-3 shadow-2xs">
            <Tag className="w-3.5 h-3.5" />
            <span>{ui.badge}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            {ui.title}
          </h2>

          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
            {ui.subtitle}
          </p>

          {/* Quick Combo Banner */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 sm:gap-4 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/90 text-xs shadow-xs">
            <span className="font-bold text-slate-800 dark:text-zinc-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-500 animate-pulse" />
              {lang === 'ar' ? 'باقة الحسانة + اللحية:' : 'Combo Coupe + Barbe :'}
            </span>
            <span className="font-mono font-bold line-through text-slate-400 dark:text-zinc-500">40 MAD</span>
            <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">35 MAD</span>
            <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold text-[10px] border border-emerald-300 dark:border-emerald-500/30">
              {lang === 'ar' ? 'وفر 5 دراهم' : 'Économisez 5 MAD'}
            </span>
            <span className="text-slate-400 dark:text-zinc-500 hidden md:inline">•</span>
            <span className="text-slate-600 dark:text-zinc-400 text-[11px] hidden md:inline">
              {lang === 'ar' ? '+ تخفيض الغسيل والشمع والبروشينغ' : '+ Lavage à 5 MAD, Cire à 10 MAD, Peinado à 10 MAD'}
            </span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-slate-900 dark:bg-zinc-800 text-white border border-slate-900 dark:border-zinc-700 shadow-lg'
                  : 'bg-white dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-zinc-200 border border-slate-200 dark:border-zinc-900 hover:border-slate-300 dark:hover:border-zinc-800'
              }`}
            >
              {cat.label[lang] || cat.label.fr}
            </button>
          ))}
        </div>

        {/* 2-Column Layout: Services Catalog (Left) + Sticky Live Cart (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Services Grid (8 Cols) */}
          <div className="lg:col-span-7 xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredServices.map((service: ServiceDefinition) => {
              const isSelected = selectedIds.includes(service.id);
              const name = service.name[lang] || service.name.fr;
              const desc = service.description[lang] || service.description.fr;

              return (
                <div
                  key={service.id}
                  onClick={() => onToggleServiceId(service.id)}
                  className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white dark:bg-zinc-900 border-2 border-red-600 dark:border-red-500 shadow-xl shadow-red-500/10'
                      : 'bg-white dark:bg-zinc-950/80 hover:bg-slate-50 dark:hover:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 shadow-2xs'
                  }`}
                >
                  <div>
                    {/* Header: Name, Estimated Duration & Check */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-slate-900 dark:text-white text-base group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                            {name}
                          </h3>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700/80 text-slate-700 dark:text-zinc-200 text-[11px] font-mono font-bold whitespace-nowrap">
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <span>{formatDuration(service.durationMinutes)}</span>
                          </span>
                          {service.popular && (
                            <span className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-600/20 text-red-700 dark:text-red-400 text-[10px] font-bold border border-red-200 dark:border-red-500/30">
                              HOT
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Select Toggle Box */}
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 group-hover:border-slate-400 dark:group-hover:border-zinc-600'
                      }`}>
                        {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
                      {desc}
                    </p>
                  </div>

                  {/* Service Specific Customizers (Hair Color & Protein) */}
                  {service.id === 'hair-color' && isSelected && (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="p-3 bg-slate-50 dark:bg-zinc-900/90 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-3 mb-3 text-xs"
                    >
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                          {lang === 'ar' ? 'اختر لون الصباغة:' : 'Nuance de couleur :'}
                        </label>
                        <select
                          value={colorConfig.tone}
                          onChange={(e) =>
                            onChangeColorConfig({
                              ...colorConfig,
                              tone: e.target.value as HairColorConfig['tone'],
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-white text-xs font-semibold focus:border-red-500 focus:outline-none"
                        >
                          <option value="grey_white">
                            {COLOR_LABELS.grey_white[lang] || COLOR_LABELS.grey_white.fr} — 150 MAD
                          </option>
                          <option value="blue_red">
                            {COLOR_LABELS.blue_red[lang] || COLOR_LABELS.blue_red.fr} — 100 MAD
                          </option>
                          <option value="brown_blonde">
                            {COLOR_LABELS.brown_blonde[lang] || COLOR_LABELS.brown_blonde.fr} — 50 MAD
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1.5">
                          {lang === 'ar' ? 'نوع التغطية:' : 'Application :'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 cursor-pointer text-xs">
                            <input
                              type="radio"
                              name="color-coverage"
                              checked={colorConfig.coverage === 'full'}
                              onChange={() => onChangeColorConfig({ ...colorConfig, coverage: 'full' })}
                              className="accent-red-500"
                            />
                            <span className="text-slate-800 dark:text-zinc-200">
                              {COVERAGE_LABELS.full[lang] || COVERAGE_LABELS.full.fr}
                            </span>
                          </label>

                          <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 cursor-pointer text-xs">
                            <input
                              type="radio"
                              name="color-coverage"
                              checked={colorConfig.coverage === 'highlights'}
                              onChange={() => onChangeColorConfig({ ...colorConfig, coverage: 'highlights' })}
                              className="accent-red-500"
                            />
                            <span className="text-slate-800 dark:text-zinc-200">
                              {COVERAGE_LABELS.highlights[lang] || COVERAGE_LABELS.highlights.fr}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {service.id === 'protein' && isSelected && (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="p-3 bg-slate-50 dark:bg-zinc-900/90 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2 mb-3 text-xs"
                    >
                      <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
                        {lang === 'ar' ? 'طول وكثافة الشعر:' : 'Longueur de cheveux :'}
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[200, 250, 300].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => onChangeProteinPrice(p)}
                            className={`p-1.5 rounded-lg text-center font-mono font-bold transition-colors cursor-pointer ${
                              proteinPrice === p
                                ? 'bg-red-600 text-white'
                                : 'bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-zinc-800'
                            }`}
                          >
                            {p} MAD
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Price Tag */}
                  <div className="pt-3 border-t border-slate-200 dark:border-zinc-900 flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      {service.id === 'protein'
                        ? lang === 'ar' ? 'يبدأ من' : 'À partir de'
                        : lang === 'ar' ? 'السعر الأساسي' : 'Tarif'}
                    </span>
                    <span className="font-mono text-lg font-black text-slate-900 dark:text-white">
                      {service.id === 'hair-color'
                        ? `${COLOR_PRICES[colorConfig.tone]} MAD`
                        : service.id === 'protein'
                        ? `${proteinPrice} MAD`
                        : `${service.basePrice} MAD`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Live Cart (4-5 Cols) */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-20">
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-xl dark:shadow-2xl space-y-5">
              
              {/* Cart Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-600/10 border border-red-200 dark:border-red-500/30 flex items-center justify-center text-red-600 dark:text-red-500">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">{ui.cartTitle}</h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                      <span>
                        {pricingResult.items.length} {lang === 'ar' ? 'خدمة مختارة' : lang === 'en' ? 'selected' : 'soins'}
                      </span>
                      {totalEstimatedDuration > 0 && (
                        <>
                          <span className="text-slate-300 dark:text-zinc-600">•</span>
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-mono font-semibold">
                            <Clock className="w-3 h-3" />
                            <span>{formatDuration(totalEstimatedDuration)}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {pricingResult.items.length > 0 && (
                  <button
                    onClick={() => {
                      selectedIds.forEach((id) => onToggleServiceId(id));
                    }}
                    className="text-xs text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تفريغ' : 'Vider'}</span>
                  </button>
                )}
              </div>

              {/* Items List */}
              {pricingResult.items.length === 0 ? (
                <div className="py-8 text-center text-slate-500 dark:text-zinc-400 text-xs">
                  <Scissors className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto mb-2 animate-bounce" />
                  <p>{ui.emptyCart}</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {pricingResult.items.map((item) => (
                    <div 
                      key={item.serviceId}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white truncate">{item.name}</span>
                          {(() => {
                            const matched = BASE_SERVICES.find((s) => s.id === item.serviceId);
                            return matched ? (
                              <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 flex-shrink-0">
                                ({formatDuration(matched.durationMinutes)})
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {item.discountApplied && (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium block truncate">
                            ✓ {item.discountApplied}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {item.originalPrice !== item.finalPrice && (
                          <span className="font-mono text-slate-400 dark:text-zinc-400 line-through text-[11px]">
                            {item.originalPrice}
                          </span>
                        )}
                        <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                          {item.finalPrice} MAD
                        </span>
                        <button
                          onClick={() => onToggleServiceId(item.serviceId)}
                          className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Discounts & Overrides Breakdown */}
              {pricingResult.discountsBreakdown.length > 0 && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 space-y-1.5 text-xs">
                  <span className="font-bold text-emerald-800 dark:text-emerald-400 block text-[11px] uppercase tracking-wider">
                    {lang === 'ar' ? 'التخفيضات المطبقة تلقائياً:' : 'Remises Automatiques :'}
                  </span>
                  {pricingResult.discountsBreakdown.map((disc, idx) => (
                    <div key={idx} className="flex justify-between items-center text-emerald-700 dark:text-emerald-300/90 text-[11px]">
                      <span>• {disc.title}</span>
                      <span className="font-mono font-bold">-{disc.savedMAD} MAD</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Total & Savings Banner */}
              {pricingResult.items.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
                  {/* Dynamic Total Savings Badge */}
                  {pricingResult.totalSavings > 0 && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-red-50 via-slate-50 to-blue-50 dark:from-red-950/60 dark:via-zinc-900 dark:to-blue-950/60 border border-red-200 dark:border-red-500/40 flex items-center justify-between text-xs font-bold shadow-sm">
                      <span className="text-red-700 dark:text-red-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>{ui.savingsLabel}</span>
                      </span>
                      <span className="font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
                        {pricingResult.totalSavings} MAD
                      </span>
                    </div>
                  )}

                  {/* Final Price Line */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-600 dark:text-zinc-400 block">{ui.totalLabel}</span>
                      {pricingResult.totalSavings > 0 && (
                        <span className="text-[11px] text-slate-400 line-through font-mono">
                          {pricingResult.originalSubtotal} MAD
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                      {pricingResult.finalTotal} <span className="text-red-600 dark:text-red-500 text-lg">MAD</span>
                    </span>
                  </div>

                  {/* Proceed to Booking Button */}
                  <button
                    onClick={onProceedToBooking}
                    className="w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-red-600/20 transition-all cursor-pointer"
                  >
                    <span>{ui.proceedBtn}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
