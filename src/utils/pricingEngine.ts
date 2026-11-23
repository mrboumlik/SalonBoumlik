import {
  SelectedCartItem,
  PricingEngineResult,
  HairColorConfig,
  ServiceBundleRule,
} from '../types';
import { pickLang } from './i18n';

export interface ServiceDefinition {
  id: string;
  name: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es: string;
  };
  category: 'haircut' | 'beard' | 'wash' | 'protein' | 'relaxing' | 'facial' | 'color';
  basePrice: number;
  durationMinutes: number;
  description: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es: string;
  };
  popular?: boolean;
  staffFavorite?: boolean;
}

export const BASE_SERVICES: ServiceDefinition[] = [
  {
    id: 'haircut',
    name: {
      fr: 'Coupe de Cheveux',
      ar: 'حسانة',
      en: 'Precision Haircut',
      amz: 'ⵜⴰⴽⵔⴹⴰ',
      es: 'Corte de pelo',
    },
    category: 'haircut',
    basePrice: 25,
    durationMinutes: 30,
    popular: true,
    staffFavorite: true,
    description: {
      fr: 'Dégradé américain, ciseaux, fondu à blanc et finitions rasoir.',
      ar: 'تدريج عصري دقيق بالمقص والماكينة مع تحديد الحواف بالموس.',
      en: 'Master fade, scissor detailing, taper and crisp razor line-up.',
      amz: 'ⵜⴰⴽⵔⴹⴰ ⵜⴰⵎⴰⵜⵜⴰⵢⵜ ⵙ ⵓⵣⵣⴰⵔ ⴷ ⵜⵎⴰⴽⵉⵏⵜ.',
      es: 'Degradado profesional, tijeras, difuminado y acabado con navaja.',
    },
  },
  {
    id: 'beard',
    name: {
      fr: 'Taille & Traçage Barbe',
      ar: 'طراساج اللحية',
      en: 'Beard Line-up & Styling',
      amz: 'ⴰⵙⵖⵍⵉ ⵏ ⵜⵎⴰⵔⵜ',
      es: 'Arreglo de barba',
    },
    category: 'beard',
    basePrice: 15,
    durationMinutes: 20,
    popular: true,
    staffFavorite: true,
    description: {
      fr: 'Sculptage au coupe-choux, serviette chaude et huile de soin.',
      ar: 'تحديد دقيق للحية بالموس الكلاسيكي، فوطة ساخنة وزيت مرطب.',
      en: 'Razor precision geometry, hot towel ritual and conditioning beard oil.',
      amz: 'ⴰⵙⵎⵙⴰⵙ ⵏ ⵜⵎⴰⵔⵜ ⵙ ⵓⵣⵣⴰⵔ ⴷ ⵣⵣⵉⵜ.',
      es: 'Perfilado con navaja tradicional, toalla caliente y aceite nutritivo.',
    },
  },
  {
    id: 'wash',
    name: {
      fr: 'Lavage & Shampoing',
      ar: 'غسيل الشعر',
      en: 'Hair Wash & Scalp Care',
      amz: 'ⴰⵙⵉⵔⵉⴷ ⵏ ⵓⵣⵣⴰⵔ',
      es: 'Lavado de pelo',
    },
    category: 'wash',
    basePrice: 10,
    durationMinutes: 10,
    description: {
      fr: 'Shampoing purifiant avec massage revitalisant du cuir chevelu.',
      ar: 'غسيل منشط مع تدليك خفيف لفروة الرأس وإزالة الرواسب.',
      en: 'Invigorating scalp shampoo massage and refreshing hair wash.',
      amz: 'ⴰⵙⵉⵔⵉⴷ ⵏ ⵓⵣⵣⴰⵔ ⵙ ⵓⵎⴰⵙⴰⵊ.',
      es: 'Lavado purificante con masaje estimulante del cuero cabelludo.',
    },
  },
  {
    id: 'blowout',
    name: {
      fr: 'Brushing & Peinado',
      ar: 'تجفيف وتصفيف (Brushing)',
      en: 'Blowout & Styling',
      amz: 'ⴰⵙⴼⵍⵙ',
      es: 'Peinado',
    },
    category: 'haircut',
    basePrice: 15,
    durationMinutes: 15,
    description: {
      fr: 'Séchage professionnel, mise en forme et cire coiffante texturisante.',
      ar: 'تجفيف هوائي احترافي، تثبيت وتصفيف بالواكس غير اللامع.',
      en: 'Professional blow-dry finish, volume sculpt and premium matte paste.',
      amz: 'ⴰⵙⴼⵍⵙ ⵏ ⵓⵣⵣⴰⵔ ⵙ ⵜⵎⴰⴽⵉⵏⵜ.',
      es: 'Secado profesional con volumen y fijación con cera mate.',
    },
  },
  {
    id: 'waxing',
    name: {
      fr: 'Épilation à la Cire',
      ar: 'إزالة الشعر بالشمع',
      en: 'Nose & Ear Waxing',
      amz: 'ⵜⴰⴷⴷⴰⴳⵜ',
      es: 'Depilación con cera',
    },
    category: 'facial',
    basePrice: 15,
    durationMinutes: 10,
    description: {
      fr: 'Nettoyage des poils indésirables (nez, oreilles, pommettes) à la cire tiède.',
      ar: 'إزالة شعر الأنف والأذنين والوجنتين بالشمع الدافئ بدقة وأمان.',
      en: 'Precise warm wax hygiene for nose, ear and cheek hair removal.',
      amz: 'ⵜⴰⴷⴷⴰⴳⵜ ⵏ ⵡⴰⵏⵣⴰⵔ ⴷ ⵉⵎⵣⴳⴰⵏ.',
      es: 'Eliminación higiénica del vello de nariz, orejas y pómulos.',
    },
  },
  {
    id: 'straightening',
    name: {
      fr: 'Défrisage / Alisado',
      ar: 'ترطيبة',
      en: 'Hair Straightening',
      amz: 'ⴰⵙⵎⵙⴰⵙ',
      es: 'Alisado',
    },
    category: 'relaxing',
    basePrice: 50,
    durationMinutes: 45,
    description: {
      fr: 'Soin relaxant doux pour assouplir les cheveux rebelles et frisés.',
      ar: 'جلسة ترطيبة آمنة لتليين الشعر المجعد وتسهيل تصفيفه بنعومة.',
      en: 'Gentle relaxing treatment to soften unruly curl patterns.',
      amz: 'ⴰⵙⵎⵙⴰⵙ ⵏ ⵓⵣⵣⴰⵔ ⵉⵇⵇⵓⵔⵏ.',
      es: 'Tratamiento alisador suave para cabello rebelde y rizado.',
    },
  },
  {
    id: 'protein',
    name: {
      fr: 'Protéine ou Kératine',
      ar: 'بروتين أو كيراتين',
      en: 'Protein or Keratin Treatment',
      amz: 'ⴰⴱⵔⵓⵜⵉⵏ ⵏⵖ ⴽⵉⵔⴰⵜⵉⵏ',
      es: 'Proteína o Queratina',
    },
    category: 'protein',
    basePrice: 200,
    durationMinutes: 90,
    popular: true,
    staffFavorite: true,
    description: {
      fr: 'Infusion de kératine et protéines naturelles brésiliennes sans formol.',
      ar: 'جلسة بروتين وكيراتين برازيلي أصلي لترميم ألياف الشعر وإعطائه لمعاناً.',
      en: 'Formaldehyde-free premium Brazilian keratin protein rebuilding infusion.',
      amz: 'ⴰⴱⵔⵓⵜⵉⵏ ⵏ ⵓⵣⵣⴰⵔ ⵉ ⵓⵙⵓⵊⵊⵉ ⴷ ⵓⵙⵎⵙⴰⵙ.',
      es: 'Infusión reparadora de queratina y proteínas sin formol.',
    },
  },
  {
    id: 'black-dye',
    name: {
      fr: 'Teinture Noire',
      ar: 'صباغة سوداء',
      en: 'Black Beard / Hair Dye',
      amz: 'ⴰⵚⴱⴱⴰⵖ ⴰⴱⵔⴽⴰⵏ',
      es: 'Tinte negro',
    },
    category: 'color',
    basePrice: 25,
    durationMinutes: 20,
    description: {
      fr: 'Couverture immédiate et naturelle des cheveux ou poils blancs.',
      ar: 'تغطية طبيعية سريعة للشيب في شعر الرأس أو اللحية بمظهر جذاب.',
      en: 'Instant natural grey coverage for hair or beard with rich tone.',
      amz: 'ⴰⵚⴱⴱⴰⵖ ⵏ ⵛⵛⵉⴱ ⵙ ⵓⴱⵔⴽⴰⵏ.',
      es: 'Cobertura natural inmediata de canas para cabello o barba.',
    },
  },
  {
    id: 'face-mask',
    name: {
      fr: 'Masque Visage Classique',
      ar: 'ماسك الوجه (العادي)',
      en: 'Classic Facial Mask',
      amz: 'ⴰⵎⴰⵙⴽ ⵏ ⵓⴷⵎ',
      es: 'Mascarilla facial',
    },
    category: 'facial',
    basePrice: 15,
    durationMinutes: 15,
    description: {
      fr: 'Masque apaisant et hydratant aux extraits naturels pour réveiller la peau.',
      ar: 'ماسك مغذي ومرطب للبشرة بمستخلصات طبيعية يمنحك انتعاشاً فورياً.',
      en: 'Nourishing hydrating natural mask to revive and smooth facial skin.',
      amz: 'ⴰⵎⴰⵙⴽ ⴰⵎⵏⵖⵓⴷ ⵉ ⵓⴷⵎ.',
      es: 'Mascarilla hidratante y calmante con extractos naturales.',
    },
  },
  {
    id: 'black-mask',
    name: {
      fr: 'Masque Noir Purifiant',
      ar: 'الماسك الأسود (Black Mask)',
      en: 'Black Peel-off Mask',
      amz: 'ⴰⵎⴰⵙⴽ ⴰⴱⵔⴽⴰⵏ',
      es: 'Mascarilla negra',
    },
    category: 'facial',
    basePrice: 10,
    durationMinutes: 15,
    description: {
      fr: 'Masque charbon actif pour extraire les points noirs et toxines.',
      ar: 'ماسك الفحم النشط لإزالة الرؤوس السوداء وتنقية المسام بعمق.',
      en: 'Activated charcoal peel-off mask to extract blackheads and toxins.',
      amz: 'ⴰⵎⴰⵙⴽ ⴰⴱⵔⴽⴰⵏ ⵉ ⵜⵉⴽⴽⵙⵜ ⵏ ⵜⵎⴰⵜⴰⵔⵉⵏ.',
      es: 'Mascarilla peel-off de carbón activo para puntos negros e impurezas.',
    },
  },
  {
    id: 'face-scrub',
    name: {
      fr: 'Gommage & Peeling Visage',
      ar: 'تقشير الوجه',
      en: 'Face Scrub & Peeling',
      amz: 'ⴰⵙⵉⵔⵉⴷ ⵏ ⵓⴷⵎ',
      es: 'Exfoliación facial',
    },
    category: 'facial',
    basePrice: 40,
    durationMinutes: 25,
    popular: true,
    staffFavorite: true,
    description: {
      fr: 'Gommage exfoliant en profondeur à la vapeur chaude et serviette aromatique.',
      ar: 'جلسة تقشير عميق بالبخار الساخن مع إزالة الخلايا الميتة بالفوطة العطرية.',
      en: 'Deep steam exfoliation, scrub and warm aromatic towel refreshment.',
      amz: 'ⴰⵙⵉⵔⵉⴷ ⵏ ⵓⴷⵎ ⵙ ⵓⴱⵅⴰⵔ ⴷ ⵓⵙⵎⵙⴰⵙ.',
      es: 'Exfoliación profunda con vapor caliente y toalla aromática.',
    },
  },
  {
    id: 'hair-color',
    name: {
      fr: 'Coloration / Teinture aux Couleurs',
      ar: 'صباغة بالألوان',
      en: 'Color Dyeing',
      amz: 'ⴰⴽⵍⵓ ⵙ ⵉⴽⵯⵍⴰⵏ',
      es: 'Coloración y Tintes',
    },
    category: 'color',
    basePrice: 150, // default tone grey/white
    durationMinutes: 100,
    description: {
      fr: 'Gris/Blanc (150 DH), Bleu/Rouge (100 DH), Marron/Blond (50 DH) - Cheveux complets ou mèches.',
      ar: 'رمادي/أبيض (150 درهم)، أزرق/أحمر (100 درهم)، بني/أشقر (50 درهم) - شعر كامل أو ميش.',
      en: 'Grey/White (150 DH), Blue/Red (100 DH), Brown/Blonde (50 DH) - Full hair or highlights.',
      amz: 'ⴰⴽⵍⵓ ⵏ ⵓⵣⵣⴰⵔ: ⴰⵎⵍⵍⴰⵍ (150 DH), ⴰⵥⵕⵡⴰⵍ (100 DH), ⴰⵡⵔⴰⵖ (50 DH).',
      es: 'Gris/Blanco (150 DH), Azul/Rojo (100 DH), Castaño/Rubio (50 DH) - Cabello completo o mechas.',
    },
  },
];

export const COLOR_PRICES: Record<HairColorConfig['tone'], number> = {
  grey_white: 150,
  blue_red: 100,
  brown_blonde: 50,
};

export const COLOR_LABELS = {
  grey_white: {
    fr: 'Gris / Blanc',
    ar: 'رمادي / أبيض',
    en: 'Grey / White',
    amz: 'ⴰⵎⵍⵍⴰⵍ / ⴰⵎⵖⴷⴰⴷ',
    es: 'Gris / Blanco',
  },
  brown_blonde: {
    fr: 'Marron / Blond',
    ar: 'بني / أشقر',
    en: 'Brown / Blonde',
    amz: 'ⴰⵡⵔⴰⵖ',
    es: 'Castaño / Rubio',
  },
  blue_red: {
    fr: 'Bleu / Rouge',
    ar: 'أزرق / أحمر',
    en: 'Blue / Red',
    amz: 'ⴰⵥⵕⵡⴰⵍ / ⴰⵣⴳⴳⵯⴰⵖ',
    es: 'Azul / Rojo',
  },
};

export const COVERAGE_LABELS = {
  full: {
    fr: 'Cheveux complets',
    ar: 'شعر كامل',
    en: 'Full Hair',
    amz: 'ⵓⵣⵣⴰⵔ ⵉⵎⴷⴰⵏ',
    es: 'Cabello completo',
  },
  highlights: {
    fr: 'Mèches',
    ar: 'ميش خصلات',
    en: 'Highlights',
    amz: 'ⵜⵉⵎⵉⵛⵉⵏ',
    es: 'Mechas',
  },
};

export interface PricingInput {
  selectedIds: string[];
  colorConfig?: HairColorConfig;
  proteinPrice?: number;
  lang?: 'fr' | 'ar' | 'en' | 'amz' | 'es';
  effectiveServicePrices?: Record<string, number>;
  specialRuleLabel?: string;
  hiddenServiceIds?: string[];
  serviceBundles?: ServiceBundleRule[];
}

/**
 * Advanced Dynamic Pricing & Discount Engine
 * Evaluates hidden services, configurable service bundles, premium overrides, and yields exact savings.
 */
export function calculateCartPricing({
  selectedIds,
  colorConfig = { tone: 'grey_white', coverage: 'full' },
  proteinPrice = 200,
  lang = 'fr',
  effectiveServicePrices,
  specialRuleLabel,
  hiddenServiceIds = [],
  serviceBundles,
}: PricingInput): PricingEngineResult {
  const hiddenSet = new Set(hiddenServiceIds || []);
  const visibleSelectedIds = (selectedIds || []).filter((id) => !hiddenSet.has(id));

  const getPrice = (id: string, fallback: number) => {
    const val = effectiveServicePrices?.[id];
    return typeof val === 'number' && Number.isFinite(val) && val >= 0
      ? Math.round(val)
      : fallback;
  };

  const items: SelectedCartItem[] = [];
  const discountsBreakdown: { title: string; savedMAD: number }[] = [];
  const overridesApplied: string[] = [];
  let comboApplied: string | undefined = undefined;

  if (specialRuleLabel) {
    overridesApplied.push(specialRuleLabel);
  }

  // 1. Build base items with effective single-service prices
  for (const id of visibleSelectedIds) {
    const serviceDef = BASE_SERVICES.find((s) => s.id === id);
    if (!serviceDef) continue;

    const localizedName = serviceDef.name[lang] || serviceDef.name.fr;
    let orig = getPrice(id, serviceDef.basePrice);
    let discountStr: string | undefined = undefined;

    if (id === 'protein') {
      const effectiveProt = effectiveServicePrices?.protein;
      orig =
        typeof effectiveProt === 'number' && effectiveProt !== 200
          ? effectiveProt
          : proteinPrice || 200;
    } else if (id === 'hair-color') {
      const effectiveColor = effectiveServicePrices?.['hair-color'];
      orig =
        typeof effectiveColor === 'number' && effectiveColor !== 150
          ? effectiveColor
          : COLOR_PRICES[colorConfig.tone] || 150;
      const toneLabel = COLOR_LABELS[colorConfig.tone][lang] || COLOR_LABELS[colorConfig.tone].fr;
      const covLabel = COVERAGE_LABELS[colorConfig.coverage][lang] || COVERAGE_LABELS[colorConfig.coverage].fr;
      discountStr = `${toneLabel} (${covLabel})`;
    }

    items.push({
      serviceId: id,
      name: localizedName,
      category: serviceDef.category,
      originalPrice: orig,
      finalPrice: orig,
      discountApplied: discountStr,
      colorConfig: id === 'hair-color' ? colorConfig : undefined,
      proteinOption: id === 'protein' ? `${orig} MAD` : undefined,
    });
  }

  const findItem = (id: string) => items.find((it) => it.serviceId === id);

  // 2. Apply Bundles & Overrides (when no special Eid/day pricing rule locks rates)
  if (!specialRuleLabel && items.length >= 2) {
    const useBundlesList: ServiceBundleRule[] =
      serviceBundles !== undefined
        ? serviceBundles
        : [
            {
              id: 'bundle-haircut-protein',
              labelAr: 'باقة حسانة + بروتين (حسانة مجانية)',
              labelFr: 'Pack Coupe + Protéine',
              labelEn: 'Haircut + Protein Pack',
              serviceIds: ['haircut', 'protein'],
              bundlePriceMAD: 200,
              active: true,
            },
            {
              id: 'bundle-haircut-straightening',
              labelAr: 'باقة حسانة + ترطيبة',
              labelFr: 'Pack Coupe + Défrisage',
              labelEn: 'Haircut + Straightening Pack',
              serviceIds: ['haircut', 'straightening'],
              bundlePriceMAD: 65,
              active: true,
            },
            {
              id: 'bundle-haircut-beard',
              labelAr: 'باقة حسانة + لحية',
              labelFr: 'Pack Coupe + Barbe',
              labelEn: 'Haircut + Beard Pack',
              serviceIds: ['haircut', 'beard'],
              bundlePriceMAD: 35,
              active: true,
            },
            {
              id: 'bundle-haircut-wash',
              labelAr: 'باقة حسانة + غسيل الشعر',
              labelFr: 'Pack Coupe + Lavage',
              labelEn: 'Haircut + Wash Pack',
              serviceIds: ['haircut', 'wash'],
              bundlePriceMAD: 30,
              active: true,
            },
            {
              id: 'bundle-haircut-waxing',
              labelAr: 'باقة حسانة + الشمع',
              labelFr: 'Pack Coupe + Cire',
              labelEn: 'Haircut + Waxing Pack',
              serviceIds: ['haircut', 'waxing'],
              bundlePriceMAD: 35,
              active: true,
            },
            {
              id: 'bundle-haircut-blowout',
              labelAr: 'باقة حسانة + تجفيف وتصفيف',
              labelFr: 'Pack Coupe + Brushing',
              labelEn: 'Haircut + Blowout Pack',
              serviceIds: ['haircut', 'blowout'],
              bundlePriceMAD: 35,
              active: true,
            },
          ];

    const selectedSet = new Set(items.map((it) => it.serviceId));
    const consumedServiceIds = new Set<string>();
    const activeMatchingBundles = useBundlesList
      .filter(
        (b) =>
          b.active !== false &&
          Array.isArray(b.serviceIds) &&
          b.serviceIds.length >= 2 &&
          b.serviceIds.every((sid) => selectedSet.has(sid))
      )
      .map((b) => {
        const standaloneSum = b.serviceIds.reduce((sum, sid) => {
          return sum + (findItem(sid)?.originalPrice || 0);
        }, 0);
        const targetBundlePrice = Math.max(0, Math.round(Number(b.bundlePriceMAD) || 0));
        const potentialSaving = standaloneSum - targetBundlePrice;
        return {
          bundle: b,
          standaloneSum,
          targetBundlePrice,
          potentialSaving,
        };
      })
      .filter((x) => x.potentialSaving > 0)
      .sort((a, b) => {
        if (b.bundle.serviceIds.length !== a.bundle.serviceIds.length) {
          return b.bundle.serviceIds.length - a.bundle.serviceIds.length;
        }
        return b.potentialSaving - a.potentialSaving;
      });

    let haircutDiscountedByPrimaryBundle = false;

    for (const match of activeMatchingBundles) {
      const { bundle, potentialSaving, targetBundlePrice } = match;
      const nonHaircutIds = bundle.serviceIds.filter((sid) => sid !== 'haircut');
      const includesHaircut = bundle.serviceIds.includes('haircut');

      // Non-haircut item in this bundle must not already be consumed by an earlier bundle
      const nonHaircutConflict = nonHaircutIds.some((sid) => consumedServiceIds.has(sid));
      if (nonHaircutConflict) continue;
      if (!includesHaircut && bundle.serviceIds.some((sid) => consumedServiceIds.has(sid))) {
        continue;
      }

      // Compute currently remaining price capacity on non-consumed items in this bundle
      const haircutItem = includesHaircut ? findItem('haircut') : undefined;
      let savingLeft = potentialSaving;

      // Apply discount cleanly:
      // 1) If haircut hasn't already absorbed a primary bundle, take from haircut first unless secondary add-on
      if (
        includesHaircut &&
        haircutItem &&
        !haircutDiscountedByPrimaryBundle &&
        ['protein', 'straightening', 'beard'].some((p) => nonHaircutIds.includes(p))
      ) {
        const deduct = Math.min(haircutItem.finalPrice, savingLeft);
        if (deduct > 0) {
          haircutItem.finalPrice -= deduct;
          savingLeft -= deduct;
          haircutDiscountedByPrimaryBundle = true;
          const lbl =
            lang === 'ar'
              ? bundle.labelAr
              : lang === 'en'
              ? bundle.labelEn || bundle.labelFr || bundle.labelAr
              : bundle.labelFr || bundle.labelAr;
          haircutItem.discountApplied = `${lbl} (${targetBundlePrice} DH)`;
        }
      }

      // 2) Deduct any remaining saving from the non-haircut partner services in this bundle
      if (savingLeft > 0) {
        for (const sid of nonHaircutIds) {
          if (savingLeft <= 0) break;
          const targetItem = findItem(sid);
          if (!targetItem || targetItem.finalPrice <= 0) continue;
          const deduct = Math.min(targetItem.finalPrice, savingLeft);
          targetItem.finalPrice -= deduct;
          savingLeft -= deduct;
          const lbl =
            lang === 'ar'
              ? bundle.labelAr
              : lang === 'en'
              ? bundle.labelEn || bundle.labelFr || bundle.labelAr
              : bundle.labelFr || bundle.labelAr;
          if (!targetItem.discountApplied) {
            targetItem.discountApplied = `${lbl} (-${deduct} DH)`;
          }
        }
      }

      // 3) If haircut wasn't discounted yet and saving still remains (e.g. a single add-on bundle like haircut+wash with custom price)
      if (savingLeft > 0 && includesHaircut && haircutItem && haircutItem.finalPrice > 0) {
        const deduct = Math.min(haircutItem.finalPrice, savingLeft);
        haircutItem.finalPrice -= deduct;
        savingLeft -= deduct;
        haircutDiscountedByPrimaryBundle = true;
        const lbl =
          lang === 'ar'
            ? bundle.labelAr
            : lang === 'en'
            ? bundle.labelEn || bundle.labelFr || bundle.labelAr
            : bundle.labelFr || bundle.labelAr;
        if (!haircutItem.discountApplied) {
          haircutItem.discountApplied = `${lbl} (-${deduct} DH)`;
        }
      }

      const actualSaved = potentialSaving - savingLeft;
      if (actualSaved > 0) {
        nonHaircutIds.forEach((sid) => consumedServiceIds.add(sid));
        if (!includesHaircut) {
          bundle.serviceIds.forEach((sid) => consumedServiceIds.add(sid));
        }

        const bundleDisplay =
          lang === 'ar'
            ? bundle.labelAr
            : lang === 'en'
            ? bundle.labelEn || bundle.labelFr || bundle.labelAr
            : bundle.labelFr || bundle.labelAr;

        if (!comboApplied) {
          comboApplied = `${bundleDisplay} (${targetBundlePrice} DH)`;
        }
        overridesApplied.push(bundleDisplay);
        discountsBreakdown.push({
          title: `${bundleDisplay} (-${actualSaved} DH)`,
          savedMAD: actualSaved,
        });
      }
    }

    // Special grey/white hair-color haircut reduction when haircut isn't already reduced further
    const haircutItem = findItem('haircut');
    const hasColor = selectedSet.has('hair-color');
    if (
      haircutItem &&
      hasColor &&
      colorConfig.tone === 'grey_white' &&
      haircutItem.finalPrice > 15 &&
      !haircutDiscountedByPrimaryBundle
    ) {
      const saved = haircutItem.finalPrice - 15;
      haircutItem.finalPrice = 15;
      haircutItem.discountApplied = pickLang(lang, {
        ar: 'تخفيض مع الصباغة البيضاء/الرمادية (15 DH)',
        fr: 'Tarif réduit avec Coloration Grise (15 DH)',
        amz: 'ⴰⵙⵙⵏⵇⵙ ⵙ ⵓⴽⵍⵓ ⵓⵎⵍⵉⵍ (15 DH)',
        en: 'Discount with Grey/White Color (15 DH)',
        es: 'Descuento con Color Gris/Blanco (15 DH)',
      });
      overridesApplied.push('Grey/White Color Override: Haircut 15 DH');
      discountsBreakdown.push({
        title: pickLang(lang, {
          ar: 'تخفيض الحسانة مع الصباغة الرمادية (-10 DH)',
          fr: 'Remise coupe avec Coloration Grise (-10 DH)',
          amz: 'ⴰⵙⵙⵏⵇⵙ ⵏ ⵜⴽⵔⴹⴰ ⵙ ⵓⴽⵍⵓ (-10 DH)',
          en: 'Haircut discount with Grey Color (-10 DH)',
          es: 'Descuento en corte con tinte blanco (-10 DH)',
        }),
        savedMAD: saved,
      });
    }
  }

  const originalSubtotal = items.reduce((sum, item) => sum + item.originalPrice, 0);
  const finalTotal = items.reduce((sum, item) => sum + item.finalPrice, 0);
  const totalSavings = Math.max(0, originalSubtotal - finalTotal);

  return {
    items,
    originalSubtotal,
    finalTotal,
    totalSavings,
    comboApplied,
    overridesApplied,
    discountsBreakdown,
  };
}

export function getGiftLabel(
  lang: 'fr' | 'ar' | 'en' | 'amz' | 'es' = 'ar'
): string {
  return pickLang(lang, {
    ar: 'هدية',
    fr: 'Offert',
    en: 'Gift',
    amz: 'ⵜⵉⴽⴽⵉ',
    es: 'Regalo',
  });
}

export function formatServicePriceLabel(
  priceMAD: number,
  lang: 'fr' | 'ar' | 'en' | 'amz' | 'es' = 'ar',
  unit = 'DH'
): string {
  const clean = Math.round(Number(priceMAD) || 0);
  if (clean <= 0) {
    return getGiftLabel(lang);
  }
  return `${clean} ${unit}`;
}

