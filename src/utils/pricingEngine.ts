import { BarberService, SelectedCartItem, PricingEngineResult, HairColorConfig } from '../types';

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
}

/**
 * Advanced Dynamic Pricing & Discount Engine
 * Evaluates combos, premium overrides, and yields an exact breakdown with savings.
 */
export function calculateCartPricing({
  selectedIds,
  colorConfig = { tone: 'grey_white', coverage: 'full' },
  proteinPrice = 200,
  lang = 'fr',
}: PricingInput): PricingEngineResult {
  const hasHaircut = selectedIds.includes('haircut');
  const hasBeard = selectedIds.includes('beard');
  const hasWash = selectedIds.includes('wash');
  const hasWaxing = selectedIds.includes('waxing');
  const hasBlowout = selectedIds.includes('blowout');
  const hasStraightening = selectedIds.includes('straightening');
  const hasProtein = selectedIds.includes('protein');
  const hasColor = selectedIds.includes('hair-color');
  const isGreyWhite = hasColor && colorConfig.tone === 'grey_white';

  const items: SelectedCartItem[] = [];
  const discountsBreakdown: { title: string; savedMAD: number }[] = [];
  const overridesApplied: string[] = [];
  let comboApplied: string | undefined = undefined;

  let originalSubtotal = 0;

  // 1. Determine Haircut Price & Overrides
  let haircutFinalPrice = 25;
  let haircutDiscountReason: string | undefined = undefined;

  if (hasHaircut) {
    if (hasProtein) {
      haircutFinalPrice = 0;
      haircutDiscountReason = lang === 'ar' ? 'مجاناً مع البروتين (0 DH)' : lang === 'es' ? 'GRATIS con Proteína (0 DH)' : 'GRATUIT avec Protéine (0 DH)';
      overridesApplied.push('Protein Override: Haircut FREE');
      discountsBreakdown.push({
        title: lang === 'ar' ? 'حسانة مجانية مع جلسة البروتين' : lang === 'es' ? 'Corte gratis con tratamiento de proteína' : 'Coupe offerte avec le Soin Protéine',
        savedMAD: 25,
      });
    } else if (hasStraightening) {
      haircutFinalPrice = 15;
      haircutDiscountReason = lang === 'ar' ? 'تخفيض مع الترطيبة (15 DH)' : lang === 'es' ? 'Descuento con Alisado (15 DH)' : 'Tarif réduit avec Défrisage (15 DH)';
      overridesApplied.push('Straightening Override: Haircut 15 DH');
      discountsBreakdown.push({
        title: lang === 'ar' ? 'تخفيض الحسانة مع الترطيبة (-10 DH)' : lang === 'es' ? 'Descuento en corte con alisado (-10 DH)' : 'Remise coupe avec Défrisage (-10 DH)',
        savedMAD: 10,
      });
    } else if (isGreyWhite) {
      haircutFinalPrice = 15;
      haircutDiscountReason = lang === 'ar' ? 'تخفيض مع الصباغة البيضاء/الرمادية (15 DH)' : lang === 'es' ? 'Descuento con Color Gris/Blanco (15 DH)' : 'Tarif réduit avec Coloration Grise (15 DH)';
      overridesApplied.push('Grey/White Color Override: Haircut 15 DH');
      discountsBreakdown.push({
        title: lang === 'ar' ? 'تخفيض الحسانة مع الصباغة الرمادية (-10 DH)' : lang === 'es' ? 'Descuento en corte con tinte blanco (-10 DH)' : 'Remise coupe avec Coloration Grise (-10 DH)',
        savedMAD: 10,
      });
    } else if (hasBeard) {
      // Standard Haircut + Beard Combo: 35 MAD instead of 25 + 15 = 40 MAD (5 MAD saving)
      haircutFinalPrice = 20; // 20 + 15 = 35 MAD
      haircutDiscountReason = lang === 'ar' ? 'عرض باقة حسانة + لحية (35 DH)' : lang === 'es' ? 'Pack Corte + Barba (35 DH)' : 'Combo Coupe + Barbe (35 DH)';
      comboApplied = 'Haircut + Beard (35 DH)';
      discountsBreakdown.push({
        title: lang === 'ar' ? 'باقة حسانة + لحية (-5 DH)' : lang === 'es' ? 'Combo Corte + Barba (-5 DH)' : 'Combo Coupe + Barbe (-5 DH)',
        savedMAD: 5,
      });
    }
  }

  // Build items array
  for (const id of selectedIds) {
    const serviceDef = BASE_SERVICES.find((s) => s.id === id);
    if (!serviceDef) continue;

    const localizedName = serviceDef.name[lang] || serviceDef.name.fr;
    let orig = serviceDef.basePrice;
    let final = serviceDef.basePrice;
    let discountStr: string | undefined = undefined;

    if (id === 'haircut') {
      orig = 25;
      final = haircutFinalPrice;
      discountStr = haircutDiscountReason;
    } else if (id === 'beard') {
      orig = 15;
      final = 15;
    } else if (id === 'wash') {
      orig = 10;
      if (hasHaircut) {
        final = 5;
        discountStr = lang === 'ar' ? '5 DH مع الحسانة (-5 DH)' : lang === 'es' ? '5 DH con corte (-5 DH)' : '5 DH avec coupe (-5 DH)';
        discountsBreakdown.push({
          title: lang === 'ar' ? 'تخفيض غسيل الشعر (-5 DH)' : lang === 'es' ? 'Descuento lavado con corte (-5 DH)' : 'Remise Lavage avec Coupe (-5 DH)',
          savedMAD: 5,
        });
      }
    } else if (id === 'waxing') {
      orig = 15;
      if (hasHaircut) {
        final = 10;
        discountStr = lang === 'ar' ? '10 DH مع الحسانة (-5 DH)' : lang === 'es' ? '10 DH con corte (-5 DH)' : '10 DH avec coupe (-5 DH)';
        discountsBreakdown.push({
          title: lang === 'ar' ? 'تخفيض الشمع (-5 DH)' : lang === 'es' ? 'Descuento cera con corte (-5 DH)' : 'Remise Cire avec Coupe (-5 DH)',
          savedMAD: 5,
        });
      }
    } else if (id === 'blowout') {
      orig = 15;
      if (hasHaircut) {
        final = 10;
        discountStr = lang === 'ar' ? '10 DH مع الحسانة (-5 DH)' : lang === 'es' ? '10 DH con corte (-5 DH)' : '10 DH avec coupe (-5 DH)';
        discountsBreakdown.push({
          title: lang === 'ar' ? 'تخفيض البروشينغ (-5 DH)' : lang === 'es' ? 'Descuento peinado con corte (-5 DH)' : 'Remise Brushing avec Coupe (-5 DH)',
          savedMAD: 5,
        });
      }
    } else if (id === 'protein') {
      orig = proteinPrice || 200;
      final = proteinPrice || 200;
    } else if (id === 'hair-color') {
      const tonePrice = COLOR_PRICES[colorConfig.tone] || 150;
      orig = tonePrice;
      final = tonePrice;
      const toneLabel = COLOR_LABELS[colorConfig.tone][lang] || COLOR_LABELS[colorConfig.tone].fr;
      const covLabel = COVERAGE_LABELS[colorConfig.coverage][lang] || COVERAGE_LABELS[colorConfig.coverage].fr;
      discountStr = `${toneLabel} (${covLabel})`;
    }

    originalSubtotal += orig;

    items.push({
      serviceId: id,
      name: localizedName,
      category: serviceDef.category,
      originalPrice: orig,
      finalPrice: final,
      discountApplied: discountStr,
      colorConfig: id === 'hair-color' ? colorConfig : undefined,
      proteinOption: id === 'protein' ? `${proteinPrice} MAD` : undefined,
    });
  }

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
