import { BarberColorKey, CaisseBarberId } from '../types';

export interface BarberIdentityTokens {
  id: CaisseBarberId;
  colorKey: BarberColorKey;
  shortLabelAr: string;
  accentHex: string;
  tintHex: string;
  borderLeftClass: string;
  dotClass: string;
  badgeClass: string;
  activeTabClass: string;
  softSurfaceClass: string;
  ringClass: string;
}

export interface CalmColorPreset {
  key: BarberColorKey;
  labelAr: string;
  labelFr: string;
  accentHex: string;
  tintHex: string;
  borderLeftClass: string;
  dotClass: string;
  badgeClass: string;
  activeTabClass: string;
  softSurfaceClass: string;
  ringClass: string;
}

export const CALM_COLOR_PRESETS: Record<BarberColorKey, CalmColorPreset> = {
  amber: {
    key: 'amber',
    labelAr: 'ذهبي هادئ',
    labelFr: 'Ambre doux',
    accentHex: '#D97706',
    tintHex: '#FEF3C7',
    borderLeftClass: 'border-s-4 border-s-amber-500/80 dark:border-s-amber-400/75',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
    badgeClass:
      'bg-amber-50 text-amber-900 border-amber-200/90 dark:bg-amber-500/12 dark:text-amber-200 dark:border-amber-500/30',
    activeTabClass:
      'bg-amber-600 text-white border-amber-600 dark:bg-amber-500 dark:text-zinc-950 dark:border-amber-400',
    softSurfaceClass:
      'bg-amber-50/60 border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-500/25',
    ringClass: 'ring-amber-500/30',
  },
  blue: {
    key: 'blue',
    labelAr: 'أزرق هادئ',
    labelFr: 'Bleu calme',
    accentHex: '#2563EB',
    tintHex: '#DBEAFE',
    borderLeftClass: 'border-s-4 border-s-blue-600/80 dark:border-s-blue-400/75',
    dotClass: 'bg-blue-600 dark:bg-blue-400',
    badgeClass:
      'bg-blue-50 text-blue-900 border-blue-200/90 dark:bg-blue-500/12 dark:text-blue-200 dark:border-blue-500/30',
    activeTabClass:
      'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:text-white dark:border-blue-400',
    softSurfaceClass:
      'bg-blue-50/60 border-blue-200/80 dark:bg-blue-950/20 dark:border-blue-500/25',
    ringClass: 'ring-blue-500/30',
  },
  emerald: {
    key: 'emerald',
    labelAr: 'زمردي هادئ',
    labelFr: 'Émeraude doux',
    accentHex: '#059669',
    tintHex: '#D1FAE5',
    borderLeftClass: 'border-s-4 border-s-emerald-600/80 dark:border-s-emerald-400/75',
    dotClass: 'bg-emerald-600 dark:bg-emerald-400',
    badgeClass:
      'bg-emerald-50 text-emerald-900 border-emerald-200/90 dark:bg-emerald-500/12 dark:text-emerald-200 dark:border-emerald-500/30',
    activeTabClass:
      'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:text-zinc-950 dark:border-emerald-400',
    softSurfaceClass:
      'bg-emerald-50/60 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-500/25',
    ringClass: 'ring-emerald-500/30',
  },
  violet: {
    key: 'violet',
    labelAr: 'بنفسجي هادئ',
    labelFr: 'Violet doux',
    accentHex: '#7C3AED',
    tintHex: '#EDE9FE',
    borderLeftClass: 'border-s-4 border-s-violet-600/80 dark:border-s-violet-400/75',
    dotClass: 'bg-violet-600 dark:bg-violet-400',
    badgeClass:
      'bg-violet-50 text-violet-900 border-violet-200/90 dark:bg-violet-500/12 dark:text-violet-200 dark:border-violet-500/30',
    activeTabClass:
      'bg-violet-600 text-white border-violet-600 dark:bg-violet-500 dark:text-white dark:border-violet-400',
    softSurfaceClass:
      'bg-violet-50/60 border-violet-200/80 dark:bg-violet-950/20 dark:border-violet-500/25',
    ringClass: 'ring-violet-500/30',
  },
  teal: {
    key: 'teal',
    labelAr: 'فيروزي هادئ',
    labelFr: 'Sarcelle calme',
    accentHex: '#0D9488',
    tintHex: '#CCFBF1',
    borderLeftClass: 'border-s-4 border-s-teal-600/80 dark:border-s-teal-400/75',
    dotClass: 'bg-teal-600 dark:bg-teal-400',
    badgeClass:
      'bg-teal-50 text-teal-900 border-teal-200/90 dark:bg-teal-500/12 dark:text-teal-200 dark:border-teal-500/30',
    activeTabClass:
      'bg-teal-600 text-white border-teal-600 dark:bg-teal-500 dark:text-zinc-950 dark:border-teal-400',
    softSurfaceClass:
      'bg-teal-50/60 border-teal-200/80 dark:bg-teal-950/20 dark:border-teal-500/25',
    ringClass: 'ring-teal-500/30',
  },
  indigo: {
    key: 'indigo',
    labelAr: 'نيلي هادئ',
    labelFr: 'Indigo doux',
    accentHex: '#4F46E5',
    tintHex: '#E0E7FF',
    borderLeftClass: 'border-s-4 border-s-indigo-600/80 dark:border-s-indigo-400/75',
    dotClass: 'bg-indigo-600 dark:bg-indigo-400',
    badgeClass:
      'bg-indigo-50 text-indigo-900 border-indigo-200/90 dark:bg-indigo-500/12 dark:text-indigo-200 dark:border-indigo-500/30',
    activeTabClass:
      'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:text-white dark:border-indigo-400',
    softSurfaceClass:
      'bg-indigo-50/60 border-indigo-200/80 dark:bg-indigo-950/20 dark:border-indigo-500/25',
    ringClass: 'ring-indigo-500/30',
  },
  slate: {
    key: 'slate',
    labelAr: 'رمادي مزرق',
    labelFr: 'Ardoise sobre',
    accentHex: '#475569',
    tintHex: '#E2E8F0',
    borderLeftClass: 'border-s-4 border-s-slate-500/80 dark:border-s-slate-400/75',
    dotClass: 'bg-slate-600 dark:bg-slate-400',
    badgeClass:
      'bg-slate-100 text-slate-800 border-slate-300/80 dark:bg-slate-500/15 dark:text-slate-200 dark:border-slate-500/30',
    activeTabClass:
      'bg-slate-700 text-white border-slate-700 dark:bg-slate-500 dark:text-white dark:border-slate-400',
    softSurfaceClass:
      'bg-slate-50/80 border-slate-200 dark:bg-slate-900/30 dark:border-slate-600/30',
    ringClass: 'ring-slate-500/30',
  },
  stone: {
    key: 'stone',
    labelAr: 'ترابي دافئ',
    labelFr: 'Pierre chaude',
    accentHex: '#78716C',
    tintHex: '#E7E5E4',
    borderLeftClass: 'border-s-4 border-s-stone-500/80 dark:border-s-stone-400/75',
    dotClass: 'bg-stone-600 dark:bg-stone-400',
    badgeClass:
      'bg-stone-100 text-stone-800 border-stone-300/80 dark:bg-stone-500/15 dark:text-stone-200 dark:border-stone-500/30',
    activeTabClass:
      'bg-stone-700 text-white border-stone-700 dark:bg-stone-500 dark:text-white dark:border-stone-400',
    softSurfaceClass:
      'bg-stone-50/80 border-stone-200 dark:bg-stone-900/30 dark:border-stone-600/30',
    ringClass: 'ring-stone-500/30',
  },
  rose: {
    key: 'rose',
    labelAr: 'عنابي هادئ',
    labelFr: 'Bordeaux doux',
    accentHex: '#BE123C',
    tintHex: '#FFE4E6',
    borderLeftClass: 'border-s-4 border-s-rose-600/75 dark:border-s-rose-400/70',
    dotClass: 'bg-rose-600 dark:bg-rose-400',
    badgeClass:
      'bg-rose-50 text-rose-900 border-rose-200/90 dark:bg-rose-500/12 dark:text-rose-200 dark:border-rose-500/30',
    activeTabClass:
      'bg-rose-600 text-white border-rose-600 dark:bg-rose-500 dark:text-white dark:border-rose-400',
    softSurfaceClass:
      'bg-rose-50/60 border-rose-200/80 dark:bg-rose-950/20 dark:border-rose-500/25',
    ringClass: 'ring-rose-500/30',
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
    dotClass: preset.dotClass,
    badgeClass: preset.badgeClass,
    activeTabClass: preset.activeTabClass,
    softSurfaceClass: preset.softSurfaceClass,
    ringClass: preset.ringClass,
  };
}

export const BARBER_IDENTITY_TOKENS: Record<string, BarberIdentityTokens> = {
  hassan: getBarberIdentityTokens('hassan', 'حسن ايت بومليك', 'amber'),
  'anouar-arif': getBarberIdentityTokens('anouar-arif', 'انور عريف', 'blue'),
  'lahcen-lhanz': getBarberIdentityTokens('lahcen-lhanz', 'لحسن الهنز', 'emerald'),
  'mounir-querdeny': getBarberIdentityTokens('mounir-querdeny', 'منير كرديني', 'violet'),
};
