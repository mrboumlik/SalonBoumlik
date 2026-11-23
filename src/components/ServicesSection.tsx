import React, { useState } from 'react';
import {
  Scissors,
  Sparkles,
  Check,
  Plus,
  Trash2,
  ShoppingCart,
  Tag,
  Clock,
  ArrowRight,
  Award,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  BASE_SERVICES,
  COLOR_PRICES,
  COLOR_LABELS,
  COVERAGE_LABELS,
  ServiceDefinition,
  formatServicePriceLabel,
  getGiftLabel,
} from '../utils/pricingEngine';
import {
  getVisibleBaseServices,
  resolveEffectiveServicePrices,
  useShopPricingConfig,
} from '../utils/shopPricingStore';
import { HairColorConfig, PricingEngineResult } from '../types';
import { pickLang } from '../utils/i18n';

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
  const { lang } = useLanguage();
  const shopPricingConfig = useShopPricingConfig();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [onlyStaffFavorites, setOnlyStaffFavorites] = useState<boolean>(false);

  const nowLocal = new Date();
  const todayLocalStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
  const resolvedTodayPricing = resolveEffectiveServicePrices({
    dateStr: todayLocalStr,
    shopConfig: shopPricingConfig,
  });

  const visibleBaseServices = getVisibleBaseServices(shopPricingConfig);
  const staffFavoritesCount = visibleBaseServices.filter((s) => Boolean(s.staffFavorite)).length;

  const categories = [
    {
      id: 'all',
      label: {
        fr: 'Tous les Services',
        ar: 'جميع الخدمات',
        en: 'All Services',
        amz: 'ⵎⴰⵕⵕⴰ ⵉⵎⵓⵙⵙⵓⵜⵏ',
        es: 'Todos los servicios',
      },
    },
    {
      id: 'haircut',
      label: {
        fr: 'Cheveux & Coiffage',
        ar: 'الشعر والتصفيف',
        en: 'Hair & Styling',
        amz: 'ⵓⵣⵣⴰⵔ',
        es: 'Cabello y peinado',
      },
    },
    {
      id: 'beard',
      label: {
        fr: 'Barbe & Rasage',
        ar: 'اللحية والشارب',
        en: 'Beard & Shave',
        amz: 'ⵜⴰⵎⴰⵔⵜ',
        es: 'Barba y afeitado',
      },
    },
    {
      id: 'facial',
      label: {
        fr: 'Soins Visage',
        ar: 'العناية بالوجه',
        en: 'Facial Care',
        amz: 'ⵓⴷⵎ',
        es: 'Cuidado facial',
      },
    },
    {
      id: 'treatments',
      label: {
        fr: 'Kératine & Soins',
        ar: 'البروتين والعلاجات',
        en: 'Keratin & Treatments',
        amz: 'ⴰⵙⵓⵊⵊⵉ',
        es: 'Tratamientos',
      },
    },
    {
      id: 'color',
      label: {
        fr: 'Colorations',
        ar: 'الصباغة والألوان',
        en: 'Hair Coloring',
        amz: 'ⴰⴽⵍⵓ',
        es: 'Coloración',
      },
    },
  ];

  const filteredServices = visibleBaseServices.filter((s) => {
    if (onlyStaffFavorites && !s.staffFavorite) return false;
    if (activeCategory === 'all') return true;
    if (activeCategory === 'haircut') return s.category === 'haircut' || s.category === 'wash';
    if (activeCategory === 'beard') return s.category === 'beard';
    if (activeCategory === 'facial') return s.category === 'facial';
    if (activeCategory === 'treatments') return s.category === 'protein' || s.category === 'relaxing';
    if (activeCategory === 'color') return s.category === 'color';
    return true;
  });

  const staffFavoriteToggleLabel =
    {
      ar: 'توصيات الحلاقين',
      fr: 'Favoris de l’équipe',
      en: 'Staff Favorites',
      amz: 'ⵉⵙⵜⴰⵢⵏ ⵏ ⵉⵎⴽⵔⴰⴹⵏ',
      es: 'Favoritos del equipo',
    }[lang] || 'Staff Favorites';

  const staffFavoriteBadgeLabel =
    {
      ar: 'توصية الحلاقين',
      fr: 'Favori équipe',
      en: 'Staff Favorite',
      amz: 'ⴰⵙⵜⴰⵢ ⵏ ⵓⵙⴰⵍⵓⵏ',
      es: 'Recomendado',
    }[lang] || 'Staff Favorite';

  const ui = {
    badge:
      {
        fr: 'Tarifs Clairs & Remises Automatiques',
        ar: 'أسعار واضحة وتخفيضات الباقات التلقائية',
        en: 'Transparent Pricing & Live Bundle Savings',
        amz: 'ⴰⵜⵉⴳⵏ ⵉⴼⴰⵡⵏ ⴷ ⵉⵙⵙⵏⴼⵍⵏ',
        es: 'Precios claros y descuentos automáticos',
      }[lang] || 'Tarifs Clairs',
    title:
      {
        fr: 'Prestations & Panier Dynamique',
        ar: 'قائمة الخدمات والأثمنة',
        en: 'Barbershop Services & Live Cart',
        amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⴷ ⵓⵇⵔⴰⴱ',
        es: 'Servicios y carrito interactivo',
      }[lang] || 'Prestations',
    subtitle:
      {
        fr: 'Sélectionnez vos soins ou filtrez par « Favoris de l’équipe ». Remises combos calculées automatiquement.',
        ar: 'اختر الخدمات المناسبة لك أو فعّل زر «توصيات الحلاقين». تُحسب تخفيضات الباقات تلقائياً.',
        en: 'Select your grooming services or toggle Staff Favorites. Bundle savings calculate automatically.',
        amz: 'ⴼⵔⵏ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⴽ ⵏⵖ ⵥⵕ ⵉⵙⵜⴰⵢⵏ ⵏ ⵉⵎⴽⵔⴰⴹⵏ. ⵜⵉⵙⵏⴼⴰⵍ ⵜⵜⵓⵃⵙⴰⴱⵏⵜ ⵙ ⵜⵉⵣⵣⵍⴰ.',
        es: 'Selecciona tus servicios o activa Favoritos del equipo. Descuentos automáticos.',
      }[lang] || 'Sélectionnez vos soins.',
    cartTitle:
      {
        fr: 'Votre Panier & Total Estimé',
        ar: 'سلة الخدمات المختارة',
        en: 'Your Grooming Cart',
        amz: 'ⴰⵇⵔⴰⴱ ⵏⵏⴽ',
        es: 'Tu cesta de servicios',
      }[lang] || 'Votre Panier',
    emptyCart:
      {
        fr: 'Aucun service sélectionné. Cliquez sur un soin pour l’ajouter.',
        ar: 'السلة فارغة. اضغط على أي خدمة لإضافتها.',
        en: 'No service added yet. Click any service to add.',
        amz: 'ⵓⵔⵜⴰ ⵜⴼⵔⵉⵏⴷ ⴰⵎⵢⴰ.',
        es: 'Ningún servicio seleccionado.',
      }[lang] || 'Panier vide',
    proceedBtn:
      {
        fr: 'Valider et Choisir l’Heure',
        ar: 'تأكيد وحجز الموعد الآن',
        en: 'Proceed to Book Appointment',
        amz: 'ⵙⵙⴷⵓ ⴰⵙⵔⵓⵙ',
        es: 'Continuar con la reserva',
      }[lang] || 'Valider',
    savingsLabel:
      {
        fr: 'Économie Réalisée :',
        ar: 'إجمالي التوفير لك:',
        en: 'Total Savings:',
        amz: 'ⵜⵉⵙⵏⴼⴰⵍ:',
        es: 'Ahorro total:',
      }[lang] || 'Économie :',
    totalLabel:
      {
        fr: 'Total à Payer :',
        ar: 'المجموع الإجمالي:',
        en: 'Total Amount:',
        amz: 'ⵜⵉⵖⵔⴰⴷ ⵎⴰⵕⵕⴰ:',
        es: 'Total a pagar:',
      }[lang] || 'Total :',
  };

  const formatDuration = (mins: number) =>
    pickLang(lang, {
      ar: `${mins} د`,
      fr: `${mins} min`,
      amz: `${mins} ⵜⵓⵙⴷⵉⴷⵜ`,
      en: `${mins} min`,
      es: `${mins} min`,
    });

  const totalEstimatedDuration = visibleBaseServices.filter((s) => selectedIds.includes(s.id)).reduce(
    (sum, s) => sum + (resolvedTodayPricing.durationMap[s.id] ?? s.durationMinutes),
    0
  );

  const haircutLivePrice = resolvedTodayPricing.priceMap['haircut'] ?? 25;
  const beardLivePrice = resolvedTodayPricing.priceMap['beard'] ?? 15;
  const hiddenSet = new Set(shopPricingConfig.hiddenServiceIds || []);
  const haircutBeardBundle = (shopPricingConfig.serviceBundles || []).find(
    (b) =>
      b.active &&
      b.serviceIds.length === 2 &&
      b.serviceIds.includes('haircut') &&
      b.serviceIds.includes('beard')
  );
  const comboRegularSum = haircutLivePrice + beardLivePrice;
  const comboBundlePrice = haircutBeardBundle ? haircutBeardBundle.bundlePriceMAD : 35;
  const comboSavings = Math.max(0, comboRegularSum - comboBundlePrice);
  const isDefaultComboActive =
    !hiddenSet.has('haircut') &&
    !hiddenSet.has('beard') &&
    resolvedTodayPricing.activeSpecialRuleLabels.length === 0 &&
    Boolean(haircutBeardBundle) &&
    comboSavings > 0;

  return (
    <section
      id="services"
      className="py-10 sm:py-14 bg-[#FAF9F6] dark:bg-[#0B0C10] text-slate-900 dark:text-white relative transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-xs font-bold text-amber-700 dark:text-amber-400 mb-3 shadow-2xs">
            <Tag className="w-3.5 h-3.5" />
            <span>{ui.badge}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-display">
            {ui.title}
          </h2>

          <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
            {ui.subtitle}
          </p>

          {/* Compact Combo Highlight or Active Special Day Pricing Notice */}
          {resolvedTodayPricing.activeSpecialRuleLabels.length > 0 ? (
            <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300/80 dark:border-amber-500/35 text-xs shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="font-black text-amber-900 dark:text-amber-200">
                {pickLang(lang, {
                  ar: 'تسعيرة خاصة مفعلة لليوم:',
                  fr: 'Tarif spécial du jour actif :',
                  amz: 'ⴰⵜⵉⴳ ⵓⵣⵍⵉⴳ ⵏ ⵡⴰⵙⵙ :',
                  en: 'Today’s special pricing active:',
                  es: 'Tarifa especial de hoy:',
                })}
              </span>
              <span className="font-bold text-amber-700 dark:text-amber-300">
                {resolvedTodayPricing.activeSpecialRuleLabels.join(' • ')}
              </span>
            </div>
          ) : isDefaultComboActive ? (
            <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 py-2 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 text-xs shadow-2xs">
              <span className="font-bold text-slate-800 dark:text-zinc-200">
                {
                  {
                    ar: 'باقة الحسانة + اللحية:',
                    fr: 'Combo Coupe + Barbe :',
                    en: 'Haircut + Beard Combo:',
                    amz: 'ⵜⴰⴽⵔⴹⴰ + ⵜⴰⵎⴰⵔⵜ:',
                    es: 'Combo Corte + Barba:',
                  }[lang]
                }
              </span>
              <span className="font-mono font-bold line-through text-stone-400 dark:text-zinc-500">
                {comboRegularSum} MAD
              </span>
              <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-sm">
                {comboBundlePrice} MAD
              </span>
              <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold text-[10px] border border-emerald-200 dark:border-emerald-500/30">
                {pickLang(lang, {
                  ar: `وفر ${comboSavings} دراهم`,
                  fr: `-${comboSavings} MAD`,
                  amz: `-${comboSavings} MAD`,
                  en: `Save ${comboSavings} MAD`,
                  es: `Ahorra ${comboSavings} MAD`,
                })}
              </span>
            </div>
          ) : null}
        </div>

        {/* Dedicated Toggleable Staff Favorites Button + Category Filter Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 pb-4 mb-6">
          <button
            type="button"
            aria-pressed={onlyStaffFavorites}
            onClick={() => setOnlyStaffFavorites((prev) => !prev)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              onlyStaffFavorites
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 border-amber-300 dark:border-amber-500/35'
            }`}
          >
            <Award
              className={`w-3.5 h-3.5 ${
                onlyStaffFavorites ? 'text-white' : 'text-amber-600 dark:text-amber-400'
              }`}
            />
            <span>{staffFavoriteToggleLabel}</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                onlyStaffFavorites
                  ? 'bg-black/20 text-white'
                  : 'bg-amber-200/60 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200'
              }`}
            >
              {staffFavoritesCount}
            </span>
          </button>

          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-slate-950 border border-slate-900 dark:border-zinc-100 shadow-xs'
                    : 'bg-white dark:bg-[#13151B] text-stone-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border border-stone-200 dark:border-zinc-800'
                }`}
              >
                <span>{cat.label[lang] || cat.label.fr}</span>
              </button>
            );
          })}
        </div>

        {/* 2-Column Layout: Services Catalog + Sticky Live Cart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* Services Grid */}
          <div className="lg:col-span-7 xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredServices.map((service: ServiceDefinition) => {
              const isSelected = selectedIds.includes(service.id);
              const name = service.name[lang] || service.name.fr;
              const desc = service.description[lang] || service.description.fr;
              const resolvedDuration =
                resolvedTodayPricing.durationMap[service.id] ?? service.durationMinutes;
              const resolvedBasePrice =
                resolvedTodayPricing.priceMap[service.id] ?? service.basePrice;
              const isSpecialToday = resolvedTodayPricing.specialRuleAffectedServiceIds.includes(
                service.id
              );

              return (
                <div
                  key={service.id}
                  onClick={() => onToggleServiceId(service.id)}
                  className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white dark:bg-[#161922] border-2 border-amber-600 dark:border-amber-500 shadow-sm'
                      : 'bg-white dark:bg-[#13151B] hover:border-amber-500/50 border border-stone-200 dark:border-zinc-800 shadow-2xs'
                  }`}
                >
                  <div>
                    {/* Header: Name, Staff Favorite Tag, Duration & Check */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-black text-slate-900 dark:text-white text-base group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                            {name}
                          </h3>
                          {service.staffFavorite && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-500/30 whitespace-nowrap">
                              <Award className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                              <span>{staffFavoriteBadgeLabel}</span>
                            </span>
                          )}
                          {isSpecialToday && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/80 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-500/40 whitespace-nowrap">
                              <span>
                                {pickLang(lang, {
                                  ar: 'تسعيرة اليوم',
                                  fr: 'Tarif du jour',
                                  amz: 'ⴰⵜⵉⴳ ⵏ ⵡⴰⵙⵙ',
                                  en: 'Today rate',
                                  es: 'Tarifa hoy',
                                })}
                              </span>
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800/90 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 text-[11px] font-mono font-semibold whitespace-nowrap">
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <span>{formatDuration(resolvedDuration)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Select Toggle Box */}
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-slate-950'
                            : 'bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-500 dark:text-zinc-400'
                        }`}
                      >
                        {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed mb-4">
                      {desc}
                    </p>
                  </div>

                  {/* Service Specific Customizers */}
                  {service.id === 'hair-color' && isSelected && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="p-3 bg-stone-50 dark:bg-zinc-900/90 rounded-xl border border-stone-200 dark:border-zinc-700 space-y-3 mb-3 text-xs"
                    >
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                          {pickLang(lang, {
                            ar: 'اختر لون الصباغة:',
                            fr: 'Nuance de couleur :',
                            amz: 'ⴰⴽⵍⵓ ⵏ ⵓⵣⵣⴰⵔ :',
                            en: 'Color shade:',
                            es: 'Tono de color:',
                          })}
                        </label>
                        <select
                          value={colorConfig.tone}
                          onChange={(e) =>
                            onChangeColorConfig({
                              ...colorConfig,
                              tone: e.target.value as HairColorConfig['tone'],
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-950 border border-stone-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
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
                          {pickLang(lang, {
                            ar: 'نوع التغطية:',
                            fr: 'Application :',
                            amz: 'ⴰⵏⴰⵡ ⵏ ⵓⴽⵍⵓ :',
                            en: 'Coverage:',
                            es: 'Aplicación:',
                          })}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 cursor-pointer text-xs">
                            <input
                              type="radio"
                              name="color-coverage"
                              checked={colorConfig.coverage === 'full'}
                              onChange={() => onChangeColorConfig({ ...colorConfig, coverage: 'full' })}
                              className="accent-amber-600"
                            />
                            <span className="text-slate-800 dark:text-zinc-200">
                              {COVERAGE_LABELS.full[lang] || COVERAGE_LABELS.full.fr}
                            </span>
                          </label>

                          <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 cursor-pointer text-xs">
                            <input
                              type="radio"
                              name="color-coverage"
                              checked={colorConfig.coverage === 'highlights'}
                              onChange={() => onChangeColorConfig({ ...colorConfig, coverage: 'highlights' })}
                              className="accent-amber-600"
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
                      className="p-3 bg-stone-50 dark:bg-zinc-900/90 rounded-xl border border-stone-200 dark:border-zinc-700 space-y-2 mb-3 text-xs"
                    >
                      <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
                        {pickLang(lang, {
                          ar: 'طول وكثافة الشعر:',
                          fr: 'Longueur de cheveux :',
                          amz: 'ⵜⵉⵖⵣⵉ ⵏ ⵓⵣⵣⴰⵔ :',
                          en: 'Hair length & density:',
                          es: 'Largo del cabello:',
                        })}
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[200, 250, 300].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => onChangeProteinPrice(p)}
                            className={`p-1.5 rounded-lg text-center font-mono font-bold transition-colors cursor-pointer ${
                              proteinPrice === p
                                ? 'bg-amber-600 text-white'
                                : 'bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-400 border border-stone-200 dark:border-zinc-800'
                            }`}
                          >
                            {p} MAD
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Price Tag */}
                  <div className="pt-3 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-xs text-stone-500 dark:text-zinc-400">
                      {service.id === 'protein'
                        ? pickLang(lang, {
                            ar: 'يبدأ من',
                            fr: 'À partir de',
                            amz: 'ⵙⴳ',
                            en: 'Starting at',
                            es: 'Desde',
                          })
                        : pickLang(lang, {
                            ar: 'الثمن',
                            fr: 'Tarif',
                            amz: 'ⴰⵜⵉⴳ',
                            en: 'Price',
                            es: 'Precio',
                          })}
                    </span>
                    {(() => {
                      const effectiveCardPrice =
                        service.id === 'hair-color'
                          ? resolvedBasePrice !== 150
                            ? resolvedBasePrice
                            : COLOR_PRICES[colorConfig.tone]
                          : service.id === 'protein'
                          ? resolvedBasePrice !== 200
                            ? resolvedBasePrice
                            : proteinPrice
                          : resolvedBasePrice;

                      if (effectiveCardPrice === 0) {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 font-black text-sm text-emerald-700 dark:text-emerald-300">
                            <span>🎁</span>
                            <span>{getGiftLabel(lang)}</span>
                          </span>
                        );
                      }

                      return (
                        <span className="font-mono text-lg font-black text-slate-900 dark:text-white">
                          {formatServicePriceLabel(effectiveCardPrice, lang, 'MAD')}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Live Cart */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-20">
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-5">
              {/* Cart Header */}
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">{ui.cartTitle}</h3>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-zinc-400">
                      <span>
                        {pricingResult.items.length}{' '}
                        {pickLang(lang, {
                          ar: 'خدمة مختارة',
                          fr: 'soins',
                          amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ',
                          en: 'selected',
                          es: 'seleccionados',
                        })}
                      </span>
                      {totalEstimatedDuration > 0 && (
                        <>
                          <span>•</span>
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
                    type="button"
                    onClick={() => {
                      selectedIds.forEach((id) => onToggleServiceId(id));
                    }}
                    className="text-xs text-stone-500 dark:text-zinc-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {pickLang(lang, {
                        ar: 'تفريغ',
                        fr: 'Vider',
                        amz: 'ⵙⴼⴰⴹ',
                        en: 'Clear',
                        es: 'Vaciar',
                      })}
                    </span>
                  </button>
                )}
              </div>

              {/* Items List */}
              {pricingResult.items.length === 0 ? (
                <div className="py-8 text-center text-stone-500 dark:text-zinc-400 text-xs">
                  <Scissors className="w-7 h-7 text-stone-300 dark:text-zinc-700 mx-auto mb-2" />
                  <p>{ui.emptyCart}</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {pricingResult.items.map((item) => (
                    <div
                      key={item.serviceId}
                      className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900/70 border border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white truncate">{item.name}</span>
                          {(() => {
                            const matched = BASE_SERVICES.find((s) => s.id === item.serviceId);
                            return matched ? (
                              <span className="text-[10px] font-mono text-stone-500 dark:text-zinc-400 flex-shrink-0">
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
                          <span className="font-mono text-stone-400 dark:text-zinc-500 line-through text-[11px]">
                            {item.originalPrice}
                          </span>
                        )}
                        <span
                          className={`font-mono font-black text-sm ${
                            item.finalPrice === 0
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {item.finalPrice === 0 ? `🎁 ${getGiftLabel(lang)}` : `${item.finalPrice} MAD`}
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleServiceId(item.serviceId)}
                          className="p-1 text-stone-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors cursor-pointer"
                          aria-label="Remove"
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
                    {pickLang(lang, {
                      ar: 'التخفيضات المطبقة تلقائياً:',
                      fr: 'Remises Automatiques :',
                      amz: 'ⵉⵙⵙⵏⴼⵍⵏ ⵉⵜⵜⵓⵙⴽⴰⵔⵏ :',
                      en: 'Automatic Discounts:',
                      es: 'Descuentos automáticos:',
                    })}
                  </span>
                  {pricingResult.discountsBreakdown.map((disc, idx) => (
                    <div key={idx} className="flex justify-between items-center text-emerald-700 dark:text-emerald-300 text-[11px]">
                      <span>• {disc.title}</span>
                      <span className="font-mono font-bold">-{disc.savedMAD} MAD</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Total & Savings Banner */}
              {pricingResult.items.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-stone-200 dark:border-zinc-800">
                  {pricingResult.totalSavings > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/30 flex items-center justify-between text-xs font-bold">
                      <span className="text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>{ui.savingsLabel}</span>
                      </span>
                      <span className="font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
                        {pricingResult.totalSavings} MAD
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-stone-600 dark:text-zinc-400 block">{ui.totalLabel}</span>
                      {pricingResult.totalSavings > 0 && (
                        <span className="text-[11px] text-stone-400 line-through font-mono">
                          {pricingResult.originalSubtotal} MAD
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                      {pricingResult.finalTotal}{' '}
                      <span className="text-amber-700 dark:text-amber-400 text-lg">MAD</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onProceedToBooking}
                    className="w-full py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
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
