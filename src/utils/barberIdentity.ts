import { BarberColorKey, CaisseBarberId } from '../types';

export interface BarberIdentityTokens {
  id: CaisseBarberId;
  colorKey: BarberColorKey;
  shortLabelAr: string;
  accentHex: string;
  tintHex: string;
  borderLeftClass: string;
  topAccentClass: string;
  dotClass: string;
  badgeClass: string;
  activeTabClass: string;
  softSurfaceClass: string;
  cardSurfaceClass: string;
  headerBandClass: string;
  iconBoxClass: string;
  softButtonClass: string;
  ringClass: string;
}

export interface CalmColorPreset {
  key: BarberColorKey;
  labelAr: string;
  labelFr: string;
  accentHex: string;
  tintHex: string;
  borderLeftClass: string;
  topAccentClass: string;
  dotClass: string;
  badgeClass: string;
  activeTabClass: string;
  softSurfaceClass: string;
  cardSurfaceClass: string;
  headerBandClass: string;
  iconBoxClass: string;
  softButtonClass: string;
  ringClass: string;
}

export const CALM_COLOR_PRESETS: Record<BarberColorKey, CalmColorPreset> = {
  amber: {
    key: 'amber',
    labelAr: 'ذهبي هادئ',
    labelFr: 'Ambre doux',
    accentHex: '#D97706',
    tintHex: '#FEF3C7',
    borderLeftClass: 'border-s-4 border-s-amber-500 dark:border-s-amber-400',
    topAccentClass: 'border-t-[3px] border-t-amber-500 dark:border-t-amber-400',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
    badgeClass:
      'bg-[#FEF3C7] text-amber-950 border-[#F59E0B] dark:bg-[#2D2212] dark:text-amber-200 dark:border-[#B45309]',
    activeTabClass:
      'bg-amber-600 text-white border-amber-600 dark:bg-amber-500 dark:text-zinc-950 dark:border-amber-400',
    softSurfaceClass:
      'bg-[#FEF3C7] border-[#F59E0B] dark:bg-[#241C10] dark:border-[#B45309]',
    cardSurfaceClass:
      'bg-[#FFFBEB] border-[#FCD34D] dark:bg-[#1E1910] dark:border-[#92400E]',
    headerBandClass:
      'bg-[#FEF3C7] border-b border-[#FCD34D] dark:bg-[#292012] dark:border-[#92400E]',
    iconBoxClass:
      'bg-[#FEF3C7] text-amber-800 border-[#F59E0B] dark:bg-[#2D2212] dark:text-amber-300 dark:border-[#B45309]',
    softButtonClass:
      'bg-[#FFFBEB] text-amber-900 border-[#FCD34D] hover:bg-[#FEF3C7] dark:bg-[#1E1910] dark:text-amber-200 dark:border-[#92400E] dark:hover:bg-[#292012]',
    ringClass: 'ring-amber-500',
  },
  blue: {
    key: 'blue',
    labelAr: 'أزرق هادئ',
    labelFr: 'Bleu calme',
    accentHex: '#2563EB',
    tintHex: '#DBEAFE',
    borderLeftClass: 'border-s-4 border-s-blue-600 dark:border-s-blue-400',
    topAccentClass: 'border-t-[3px] border-t-blue-600 dark:border-t-blue-400',
    dotClass: 'bg-blue-600 dark:bg-blue-400',
    badgeClass:
      'bg-[#DBEAFE] text-blue-950 border-[#60A5FA] dark:bg-[#172540] dark:text-blue-200 dark:border-[#2563EB]',
    activeTabClass:
      'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:text-white dark:border-blue-400',
    softSurfaceClass:
      'bg-[#DBEAFE] border-[#60A5FA] dark:bg-[#142038] dark:border-[#2563EB]',
    cardSurfaceClass:
      'bg-[#EFF6FF] border-[#93C5FD] dark:bg-[#111A2B] dark:border-[#1E40AF]',
    headerBandClass:
      'bg-[#DBEAFE] border-b border-[#93C5FD] dark:bg-[#16233B] dark:border-[#1E40AF]',
    iconBoxClass:
      'bg-[#DBEAFE] text-blue-800 border-[#60A5FA] dark:bg-[#172540] dark:text-blue-300 dark:border-[#2563EB]',
    softButtonClass:
      'bg-[#EFF6FF] text-blue-900 border-[#93C5FD] hover:bg-[#DBEAFE] dark:bg-[#111A2B] dark:text-blue-200 dark:border-[#1E40AF] dark:hover:bg-[#16233B]',
    ringClass: 'ring-blue-500',
  },
  emerald: {
    key: 'emerald',
    labelAr: 'زمردي هادئ',
    labelFr: 'Émeraude doux',
    accentHex: '#059669',
    tintHex: '#D1FAE5',
    borderLeftClass: 'border-s-4 border-s-emerald-600 dark:border-s-emerald-400',
    topAccentClass: 'border-t-[3px] border-t-emerald-600 dark:border-t-emerald-400',
    dotClass: 'bg-emerald-600 dark:bg-emerald-400',
    badgeClass:
      'bg-[#D1FAE5] text-emerald-950 border-[#34D399] dark:bg-[#143026] dark:text-emerald-200 dark:border-[#059669]',
    activeTabClass:
      'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:text-zinc-950 dark:border-emerald-400',
    softSurfaceClass:
      'bg-[#D1FAE5] border-[#34D399] dark:bg-[#122921] dark:border-[#059669]',
    cardSurfaceClass:
      'bg-[#ECFDF5] border-[#6EE7B7] dark:bg-[#0F211B] dark:border-[#047857]',
    headerBandClass:
      'bg-[#D1FAE5] border-b border-[#6EE7B7] dark:bg-[#132B23] dark:border-[#047857]',
    iconBoxClass:
      'bg-[#D1FAE5] text-emerald-800 border-[#34D399] dark:bg-[#143026] dark:text-emerald-300 dark:border-[#059669]',
    softButtonClass:
      'bg-[#ECFDF5] text-emerald-900 border-[#6EE7B7] hover:bg-[#D1FAE5] dark:bg-[#0F211B] dark:text-emerald-200 dark:border-[#047857] dark:hover:bg-[#132B23]',
    ringClass: 'ring-emerald-500',
  },
  violet: {
    key: 'violet',
    labelAr: 'بنفسجي هادئ',
    labelFr: 'Violet doux',
    accentHex: '#7C3AED',
    tintHex: '#EDE9FE',
    borderLeftClass: 'border-s-4 border-s-violet-600 dark:border-s-violet-400',
    topAccentClass: 'border-t-[3px] border-t-violet-600 dark:border-t-violet-400',
    dotClass: 'bg-violet-600 dark:bg-violet-400',
    badgeClass:
      'bg-[#EDE9FE] text-violet-950 border-[#A78BFA] dark:bg-[#251D3B] dark:text-violet-200 dark:border-[#7C3AED]',
    activeTabClass:
      'bg-violet-600 text-white border-violet-600 dark:bg-violet-500 dark:text-white dark:border-violet-400',
    softSurfaceClass:
      'bg-[#EDE9FE] border-[#A78BFA] dark:bg-[#211A33] dark:border-[#7C3AED]',
    cardSurfaceClass:
      'bg-[#F5F3FF] border-[#C4B5FD] dark:bg-[#1B1629] dark:border-[#5B21B6]',
    headerBandClass:
      'bg-[#EDE9FE] border-b border-[#C4B5FD] dark:bg-[#231C36] dark:border-[#5B21B6]',
    iconBoxClass:
      'bg-[#EDE9FE] text-violet-800 border-[#A78BFA] dark:bg-[#251D3B] dark:text-violet-300 dark:border-[#7C3AED]',
    softButtonClass:
      'bg-[#F5F3FF] text-violet-900 border-[#C4B5FD] hover:bg-[#EDE9FE] dark:bg-[#1B1629] dark:text-violet-200 dark:border-[#5B21B6] dark:hover:bg-[#231C36]',
    ringClass: 'ring-violet-500',
  },
  teal: {
    key: 'teal',
    labelAr: 'فيروزي هادئ',
    labelFr: 'Sarcelle calme',
    accentHex: '#0D9488',
    tintHex: '#CCFBF1',
    borderLeftClass: 'border-s-4 border-s-teal-600 dark:border-s-teal-400',
    topAccentClass: 'border-t-[3px] border-t-teal-600 dark:border-t-teal-400',
    dotClass: 'bg-teal-600 dark:bg-teal-400',
    badgeClass:
      'bg-[#CCFBF1] text-teal-950 border-[#2DD4BF] dark:bg-[#132E2C] dark:text-teal-200 dark:border-[#0D9488]',
    activeTabClass:
      'bg-teal-600 text-white border-teal-600 dark:bg-teal-500 dark:text-zinc-950 dark:border-teal-400',
    softSurfaceClass:
      'bg-[#CCFBF1] border-[#2DD4BF] dark:bg-[#122927] dark:border-[#0D9488]',
    cardSurfaceClass:
      'bg-[#F0FDFA] border-[#5EEAD4] dark:bg-[#0F2120] dark:border-[#0F766E]',
    headerBandClass:
      'bg-[#CCFBF1] border-b border-[#5EEAD4] dark:bg-[#132B29] dark:border-[#0F766E]',
    iconBoxClass:
      'bg-[#CCFBF1] text-teal-800 border-[#2DD4BF] dark:bg-[#132E2C] dark:text-teal-300 dark:border-[#0D9488]',
    softButtonClass:
      'bg-[#F0FDFA] text-teal-900 border-[#5EEAD4] hover:bg-[#CCFBF1] dark:bg-[#0F2120] dark:text-teal-200 dark:border-[#0F766E] dark:hover:bg-[#132B29]',
    ringClass: 'ring-teal-500',
  },
  indigo: {
    key: 'indigo',
    labelAr: 'نيلي هادئ',
    labelFr: 'Indigo doux',
    accentHex: '#4F46E5',
    tintHex: '#E0E7FF',
    borderLeftClass: 'border-s-4 border-s-indigo-600 dark:border-s-indigo-400',
    topAccentClass: 'border-t-[3px] border-t-indigo-600 dark:border-t-indigo-400',
    dotClass: 'bg-indigo-600 dark:bg-indigo-400',
    badgeClass:
      'bg-[#E0E7FF] text-indigo-950 border-[#818CF8] dark:bg-[#1C1F3E] dark:text-indigo-200 dark:border-[#4F46E5]',
    activeTabClass:
      'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:text-white dark:border-indigo-400',
    softSurfaceClass:
      'bg-[#E0E7FF] border-[#818CF8] dark:bg-[#181B36] dark:border-[#4F46E5]',
    cardSurfaceClass:
      'bg-[#EEF2FF] border-[#A5B4FC] dark:bg-[#14172B] dark:border-[#3730A3]',
    headerBandClass:
      'bg-[#E0E7FF] border-b border-[#A5B4FC] dark:bg-[#1B1F3B] dark:border-[#3730A3]',
    iconBoxClass:
      'bg-[#E0E7FF] text-indigo-800 border-[#818CF8] dark:bg-[#1C1F3E] dark:text-indigo-300 dark:border-[#4F46E5]',
    softButtonClass:
      'bg-[#EEF2FF] text-indigo-900 border-[#A5B4FC] hover:bg-[#E0E7FF] dark:bg-[#14172B] dark:text-indigo-200 dark:border-[#3730A3] dark:hover:bg-[#1B1F3B]',
    ringClass: 'ring-indigo-500',
  },
  slate: {
    key: 'slate',
    labelAr: 'رمادي مزرق',
    labelFr: 'Ardoise sobre',
    accentHex: '#475569',
    tintHex: '#E2E8F0',
    borderLeftClass: 'border-s-4 border-s-slate-600 dark:border-s-slate-400',
    topAccentClass: 'border-t-[3px] border-t-slate-600 dark:border-t-slate-400',
    dotClass: 'bg-slate-600 dark:bg-slate-400',
    badgeClass:
      'bg-[#E2E8F0] text-slate-900 border-[#94A3B8] dark:bg-[#1E2430] dark:text-slate-200 dark:border-[#475569]',
    activeTabClass:
      'bg-slate-700 text-white border-slate-700 dark:bg-slate-500 dark:text-white dark:border-slate-400',
    softSurfaceClass:
      'bg-[#E2E8F0] border-[#94A3B8] dark:bg-[#1A202B] dark:border-[#475569]',
    cardSurfaceClass:
      'bg-[#F1F5F9] border-[#CBD5E1] dark:bg-[#151A24] dark:border-[#334155]',
    headerBandClass:
      'bg-[#E2E8F0] border-b border-[#CBD5E1] dark:bg-[#1B222E] dark:border-[#334155]',
    iconBoxClass:
      'bg-[#E2E8F0] text-slate-800 border-[#94A3B8] dark:bg-[#1E2430] dark:text-slate-200 dark:border-[#475569]',
    softButtonClass:
      'bg-[#F1F5F9] text-slate-800 border-[#CBD5E1] hover:bg-[#E2E8F0] dark:bg-[#151A24] dark:text-slate-200 dark:border-[#334155] dark:hover:bg-[#1B222E]',
    ringClass: 'ring-slate-500',
  },
  stone: {
    key: 'stone',
    labelAr: 'ترابي دافئ',
    labelFr: 'Pierre chaude',
    accentHex: '#78716C',
    tintHex: '#E7E5E4',
    borderLeftClass: 'border-s-4 border-s-stone-600 dark:border-s-stone-400',
    topAccentClass: 'border-t-[3px] border-t-stone-600 dark:border-t-stone-400',
    dotClass: 'bg-stone-600 dark:bg-stone-400',
    badgeClass:
      'bg-[#E7E5E4] text-stone-900 border-[#A8A29E] dark:bg-[#262320] dark:text-stone-200 dark:border-[#57534E]',
    activeTabClass:
      'bg-stone-700 text-white border-stone-700 dark:bg-stone-500 dark:text-white dark:border-stone-400',
    softSurfaceClass:
      'bg-[#E7E5E4] border-[#A8A29E] dark:bg-[#221F1D] dark:border-[#57534E]',
    cardSurfaceClass:
      'bg-[#F5F5F4] border-[#D6D3D1] dark:bg-[#1B1917] dark:border-[#44403C]',
    headerBandClass:
      'bg-[#E7E5E4] border-b border-[#D6D3D1] dark:bg-[#24211E] dark:border-[#44403C]',
    iconBoxClass:
      'bg-[#E7E5E4] text-stone-800 border-[#A8A29E] dark:bg-[#262320] dark:text-stone-200 dark:border-[#57534E]',
    softButtonClass:
      'bg-[#F5F5F4] text-stone-800 border-[#D6D3D1] hover:bg-[#E7E5E4] dark:bg-[#1B1917] dark:text-stone-200 dark:border-[#44403C] dark:hover:bg-[#24211E]',
    ringClass: 'ring-stone-500',
  },
  rose: {
    key: 'rose',
    labelAr: 'عنابي هادئ',
    labelFr: 'Bordeaux doux',
    accentHex: '#BE123C',
    tintHex: '#FFE4E6',
    borderLeftClass: 'border-s-4 border-s-rose-600 dark:border-s-rose-400',
    topAccentClass: 'border-t-[3px] border-t-rose-600 dark:border-t-rose-400',
    dotClass: 'bg-rose-600 dark:bg-rose-400',
    badgeClass:
      'bg-[#FFE4E6] text-rose-950 border-[#FB7185] dark:bg-[#33161E] dark:text-rose-200 dark:border-[#BE123C]',
    activeTabClass:
      'bg-rose-600 text-white border-rose-600 dark:bg-rose-500 dark:text-white dark:border-rose-400',
    softSurfaceClass:
      'bg-[#FFE4E6] border-[#FB7185] dark:bg-[#2B141A] dark:border-[#BE123C]',
    cardSurfaceClass:
      'bg-[#FFF1F2] border-[#FDA4AF] dark:bg-[#241116] dark:border-[#9F1239]',
    headerBandClass:
      'bg-[#FFE4E6] border-b border-[#FDA4AF] dark:bg-[#2E151C] dark:border-[#9F1239]',
    iconBoxClass:
      'bg-[#FFE4E6] text-rose-800 border-[#FB7185] dark:bg-[#33161E] dark:text-rose-300 dark:border-[#BE123C]',
    softButtonClass:
      'bg-[#FFF1F2] text-rose-900 border-[#FDA4AF] hover:bg-[#FFE4E6] dark:bg-[#241116] dark:text-rose-200 dark:border-[#9F1239] dark:hover:bg-[#2E151C]',
    ringClass: 'ring-rose-500',
  },
};

export const COLOR_KEY_OPTIONS: CalmColorPreset[] = Object.values(CALM_COLOR_PRESETS);

const DYNAMIC_COLOR_CYCLE: BarberColorKey[] = ['teal', 'indigo', 'slate', 'stone', 'rose', 'blue', 'emerald', 'violet'];

const CANONICAL_DEFAULT_COLORS: Record<string, BarberColorKey> = {
  hassan: 'amber',
  'anouar-arif': 'blue',
  'lahcen-lhanz': 'emerald',
  'mounir-querdeny': 'violet',
};

const CANONICAL_SHORT_LABELS: Record<string, string> = {
  hassan: 'حسن',
  'anouar-arif': 'أنور',
  'lahcen-lhanz': 'لحسن',
  'mounir-querdeny': 'منير',
};

let runtimeColorKeyMap: Record<string, BarberColorKey> = { ...CANONICAL_DEFAULT_COLORS };
let runtimeShortLabelMap: Record<string, string> = { ...CANONICAL_SHORT_LABELS };

export function syncBarberIdentityRegistry(
  items: { id: string; colorKey?: BarberColorKey; nameAr?: string }[]
) {
  const nextColors: Record<string, BarberColorKey> = { ...CANONICAL_DEFAULT_COLORS };
  const nextLabels: Record<string, string> = { ...CANONICAL_SHORT_LABELS };
  items.forEach((item) => {
    if (item.id && item.colorKey && CALM_COLOR_PRESETS[item.colorKey]) {
      nextColors[item.id] = item.colorKey;
    }
    if (item.id && item.nameAr?.trim()) {
      nextLabels[item.id] = item.nameAr.trim().split(/\s+/)[0] || item.nameAr.trim();
    }
  });
  runtimeColorKeyMap = nextColors;
  runtimeShortLabelMap = nextLabels;
}

function hashSlugToColorKey(slug: string): BarberColorKey {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return DYNAMIC_COLOR_CYCLE[h % DYNAMIC_COLOR_CYCLE.length];
}

export function resolveCanonicalBarberId(rawId?: string, rawName?: string): CaisseBarberId {
  const idClean = (rawId || '').toLowerCase().trim();
  const nameClean = (rawName || '').toLowerCase().trim();

  if (idClean === 'hassan' || idClean === 'all') return 'hassan';
  if (idClean === 'anouar-arif' || idClean.includes('anouar') || nameClean.includes('anouar') || nameClean.includes('أنور')) {
    return 'anouar-arif';
  }
  if (idClean === 'lahcen-lhanz' || idClean.includes('lahcen') || nameClean.includes('lahcen') || nameClean.includes('لحسن')) {
    return 'lahcen-lhanz';
  }
  if (idClean === 'mounir-querdeny' || idClean.includes('mounir') || nameClean.includes('mounir') || nameClean.includes('منير')) {
    return 'mounir-querdeny';
  }
  if (idClean && /^[a-z0-9_-]{2,64}$/.test(idClean)) {
    return idClean;
  }
  return 'hassan';
}

export function getBarberIdentityTokens(
  rawId?: string,
  rawName?: string,
  colorKeyOverride?: BarberColorKey | string
): BarberIdentityTokens {
  const id = resolveCanonicalBarberId(rawId, rawName);
  const validOverride =
    colorKeyOverride && Object.prototype.hasOwnProperty.call(CALM_COLOR_PRESETS, colorKeyOverride)
      ? (colorKeyOverride as BarberColorKey)
      : undefined;
  const resolvedKey: BarberColorKey =
    validOverride ||
    runtimeColorKeyMap[id] ||
    hashSlugToColorKey(id);

  const preset = CALM_COLOR_PRESETS[resolvedKey] || CALM_COLOR_PRESETS.slate;
  const shortLabelAr =
    runtimeShortLabelMap[id] ||
    (rawName ? rawName.trim().split(/\s+/)[0] : '') ||
    id;

  return {
    id,
    colorKey: preset.key,
    shortLabelAr,
    accentHex: preset.accentHex,
    tintHex: preset.tintHex,
    borderLeftClass: preset.borderLeftClass,
    topAccentClass: preset.topAccentClass,
    dotClass: preset.dotClass,
    badgeClass: preset.badgeClass,
    activeTabClass: preset.activeTabClass,
    softSurfaceClass: preset.softSurfaceClass,
    cardSurfaceClass: preset.cardSurfaceClass,
    headerBandClass: preset.headerBandClass,
    iconBoxClass: preset.iconBoxClass,
    softButtonClass: preset.softButtonClass,
    ringClass: preset.ringClass,
  };
}

export const BARBER_IDENTITY_TOKENS: Record<string, BarberIdentityTokens> = {
  hassan: getBarberIdentityTokens('hassan', 'حسن ايت بومليك', 'amber'),
  'anouar-arif': getBarberIdentityTokens('anouar-arif', 'انور عريف', 'blue'),
  'lahcen-lhanz': getBarberIdentityTokens('lahcen-lhanz', 'لحسن الهنز', 'emerald'),
  'mounir-querdeny': getBarberIdentityTokens('mounir-querdeny', 'منير كرديني', 'violet'),
};
