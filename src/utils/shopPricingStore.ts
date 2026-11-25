import { useEffect, useState } from 'react';
import { doc, getDoc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import {
  BarberProfileOverride,
  ServiceBundleRule,
  ShopPricingConfig,
  SpecialDayPricingRule,
} from '../types';
import { BASE_SERVICES, ServiceDefinition } from './pricingEngine';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  emitRealtimeSyncHint,
  registerRealtimeRefreshHandler,
  resetResilientRetry,
  scheduleResilientRetry,
} from './realtimeSync';

const SHOP_PRICING_COLLECTION = 'shop_pricing';
const SHOP_PRICING_DOC_ID = 'default';

export const DEFAULT_SERVICE_BUNDLES: ServiceBundleRule[] = [
  {
    id: 'bundle-haircut-beard',
    labelAr: 'باقة حسانة + طراساج اللحية',
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
    id: 'bundle-haircut-protein',
    labelAr: 'باقة حسانة + بروتين (حسانة مجانية)',
    labelFr: 'Pack Coupe + Protéine (Coupe offerte)',
    labelEn: 'Haircut + Protein (Free Cut)',
    serviceIds: ['haircut', 'protein'],
    bundlePriceMAD: 200,
    active: true,
  },
];

export const DEFAULT_SHOP_PRICING_CONFIG: ShopPricingConfig = {
  id: SHOP_PRICING_DOC_ID,
  servicePriceOverrides: {},
  hiddenServiceIds: [],
  serviceBundles: DEFAULT_SERVICE_BUNDLES,
  specialRules: [],
  enableNoWaitOption: false,
  giftWithHaircutBeardServiceId: '',
  updatedBy: 'System',
  updatedAt: '',
};

let cachedShopPricing: ShopPricingConfig = DEFAULT_SHOP_PRICING_CONFIG;
let hasHydratedShopPricing = false;
const listeners = new Set<(cfg: ShopPricingConfig) => void>();
let activeUnsub: (() => void) | null = null;
let shopPricingRefreshUnsub: (() => void) | null = null;

export function sanitizeHiddenServiceIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const validSet = new Set(BASE_SERVICES.map((s) => s.id));
  return Array.from(
    new Set(
      raw
        .map((id) => String(id || '').trim().slice(0, 64))
        .filter((id) => validSet.has(id))
    )
  ).slice(0, 40);
}

function sanitizeServiceBundle(rule: ServiceBundleRule, idx: number): ServiceBundleRule | null {
  const validIds = new Set(BASE_SERVICES.map((s) => s.id));
  const cleanIds = Array.from(
    new Set(
      (Array.isArray(rule.serviceIds) ? rule.serviceIds : [])
        .map((s) => String(s || '').trim().slice(0, 64))
        .filter((s) => validIds.has(s))
    )
  ).slice(0, 10);

  if (cleanIds.length < 2) return null;

  const priceNum = Number(rule.bundlePriceMAD);
  const cleanPrice = Number.isFinite(priceNum)
    ? Math.max(0, Math.min(20000, Math.round(priceNum)))
    : 0;

  const out: ServiceBundleRule = {
    id: String(rule.id || `bundle-${idx + 1}`)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 64),
    labelAr: String(rule.labelAr || 'باقة خدمات').trim().slice(0, 100),
    serviceIds: cleanIds,
    bundlePriceMAD: cleanPrice,
    active: rule.active !== false,
  };
  if (rule.labelFr?.trim()) out.labelFr = rule.labelFr.trim().slice(0, 100);
  if (rule.labelEn?.trim()) out.labelEn = rule.labelEn.trim().slice(0, 100);
  return out;
}

export function sanitizeServiceBundles(
  raw: unknown,
  fallbackToDefaults = true
): ServiceBundleRule[] {
  if (!Array.isArray(raw)) {
    return fallbackToDefaults
      ? DEFAULT_SERVICE_BUNDLES.map((b) => ({ ...b, serviceIds: [...b.serviceIds] }))
      : [];
  }
  return raw
    .slice(0, 40)
    .map((b, idx) => sanitizeServiceBundle(b as ServiceBundleRule, idx))
    .filter((b): b is ServiceBundleRule => b !== null);
}

function sanitizeSpecialRule(rule: SpecialDayPricingRule, idx: number): SpecialDayPricingRule {
  const cleanPrices: Record<string, number> = {};
  if (rule.servicePrices && typeof rule.servicePrices === 'object') {
    Object.entries(rule.servicePrices).forEach(([sid, val]) => {
      const n = Number(val);
      if (sid && Number.isFinite(n) && n >= 0 && n <= 20000) {
        cleanPrices[sid.slice(0, 64)] = Math.round(n);
      }
    });
  }

  const cleanBarberPrices: Record<string, Record<string, number>> = {};
  if (rule.barberServicePrices && typeof rule.barberServicePrices === 'object') {
    Object.entries(rule.barberServicePrices).forEach(([barberId, map]) => {
      if (!barberId || !map || typeof map !== 'object') return;
      const cleanBarberMap: Record<string, number> = {};
      Object.entries(map).forEach(([sid, val]) => {
        const n = Number(val);
        if (sid && Number.isFinite(n) && n >= 0 && n <= 20000) {
          cleanBarberMap[sid.slice(0, 64)] = Math.round(n);
        }
      });
      if (Object.keys(cleanBarberMap).length > 0) {
        cleanBarberPrices[barberId.slice(0, 64)] = cleanBarberMap;
      }
    });
  }

  const out: SpecialDayPricingRule = {
    id: String(rule.id || `rule-${idx + 1}`)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 64),
    label: String(rule.label || 'تسعيرة خاصة').trim().slice(0, 80),
    active: rule.active !== false,
    scope: rule.scope === 'date_range' ? 'date_range' : 'weekday',
    mode: rule.mode === 'delta_mad' ? 'delta_mad' : 'fixed_prices',
  };

  if (out.scope === 'weekday' && Array.isArray(rule.weekdays)) {
    out.weekdays = Array.from(
      new Set(
        rule.weekdays
          .map((d) => Number(d))
          .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      )
    );
  }
  if (out.scope === 'date_range') {
    if (rule.startDate) out.startDate = String(rule.startDate).slice(0, 20);
    if (rule.endDate) out.endDate = String(rule.endDate).slice(0, 20);
  }
  if (out.mode === 'fixed_prices') {
    out.servicePrices = cleanPrices;
  } else {
    const d = Number(rule.deltaMAD);
    out.deltaMAD = Number.isFinite(d) ? Math.max(-500, Math.min(2000, Math.round(d))) : 0;
  }
  if (Object.keys(cleanBarberPrices).length > 0) {
    out.barberServicePrices = cleanBarberPrices;
  }
  if (Array.isArray(rule.targetServiceIds) && rule.targetServiceIds.length > 0) {
    out.targetServiceIds = rule.targetServiceIds
      .slice(0, 20)
      .map((s) => String(s).slice(0, 64));
  }
  return out;
}

function sanitizeServiceOverrides(
  raw: Record<string, number> | undefined
): Record<string, number> {
  const next: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return next;
  BASE_SERVICES.forEach((srv) => {
    const val = raw[srv.id];
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 20000) {
      const rounded = Math.round(val);
      if (rounded !== srv.basePrice) {
        next[srv.id] = rounded;
      }
    }
  });
  return next;
}

function parseShopPricingSnap(
  exists: boolean,
  rawData?: Partial<ShopPricingConfig>
): ShopPricingConfig {
  if (!exists || !rawData) {
    return DEFAULT_SHOP_PRICING_CONFIG;
  }
  return {
    id: SHOP_PRICING_DOC_ID,
    servicePriceOverrides: sanitizeServiceOverrides(rawData.servicePriceOverrides),
    hiddenServiceIds: sanitizeHiddenServiceIds(rawData.hiddenServiceIds),
    serviceBundles: sanitizeServiceBundles(rawData.serviceBundles),
    specialRules: Array.isArray(rawData.specialRules)
      ? rawData.specialRules.slice(0, 30).map(sanitizeSpecialRule)
      : [],
    enableNoWaitOption: Boolean(rawData.enableNoWaitOption),
    giftWithHaircutBeardServiceId:
      typeof rawData.giftWithHaircutBeardServiceId === 'string'
        ? rawData.giftWithHaircutBeardServiceId.trim().slice(0, 64)
        : '',
    updatedBy: rawData.updatedBy || 'System',
    updatedAt: rawData.updatedAt || '',
  };
}

function commitShopPricingCache(next: ShopPricingConfig, broadcastHint = false): void {
  cachedShopPricing = next;
  hasHydratedShopPricing = true;
  listeners.forEach((cb) => {
    try {
      cb(cachedShopPricing);
    } catch (err) {
      console.warn('Shop pricing listener callback error:', err);
    }
  });
  if (broadcastHint) {
    emitRealtimeSyncHint('pricing');
  }
}

function ensureShopPricingListener() {
  const ref = doc(db, SHOP_PRICING_COLLECTION, SHOP_PRICING_DOC_ID);
  if (!shopPricingRefreshUnsub) {
    shopPricingRefreshUnsub = registerRealtimeRefreshHandler('shop_pricing', 'pricing', async () => {
      if (listeners.size === 0) return;
      ensureShopPricingListener();
      try {
        let snap;
        try {
          snap = await getDocFromServer(ref);
        } catch {
          snap = await getDoc(ref);
        }
        commitShopPricingCache(
          parseShopPricingSnap(snap.exists(), snap.data() as Partial<ShopPricingConfig>)
        );
      } catch (err) {
        console.warn('Shop pricing wake refresh warning:', err);
      }
    });
  }
  if (activeUnsub) return;

  activeUnsub = onSnapshot(
    ref,
    (snap) => {
      resetResilientRetry('shop_pricing');
      commitShopPricingCache(
        parseShopPricingSnap(snap.exists(), snap.data() as Partial<ShopPricingConfig>)
      );
    },
    (error) => {
      if (activeUnsub) {
        try {
          activeUnsub();
        } catch {
          // Ignore
        }
        activeUnsub = null;
      }
      scheduleResilientRetry(
        'shop_pricing',
        () => listeners.size > 0,
        () => ensureShopPricingListener(),
        error
      );
    }
  );
}

export function subscribeToShopPricingConfig(
  cb: (cfg: ShopPricingConfig) => void
): () => void {
  listeners.add(cb);
  ensureShopPricingListener();
  if (hasHydratedShopPricing) {
    cb(cachedShopPricing);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      resetResilientRetry('shop_pricing');
      if (activeUnsub) {
        activeUnsub();
        activeUnsub = null;
      }
      if (shopPricingRefreshUnsub) {
        shopPricingRefreshUnsub();
        shopPricingRefreshUnsub = null;
      }
      hasHydratedShopPricing = false;
    }
  };
}

export function useShopPricingConfig(): ShopPricingConfig {
  const [config, setConfig] = useState<ShopPricingConfig>(cachedShopPricing);
  useEffect(() => subscribeToShopPricingConfig(setConfig), []);
  return config;
}

export function getVisibleBaseServices(
  shopConfig: ShopPricingConfig = cachedShopPricing,
  barberProfile?: BarberProfileOverride | null
): ServiceDefinition[] {
  const hiddenSet = new Set([
    ...(shopConfig?.hiddenServiceIds || []),
    ...(barberProfile?.customHiddenServiceIds || []),
  ]);
  return BASE_SERVICES.filter((s) => !hiddenSet.has(s.id));
}

export function getEffectiveHiddenServiceIds(
  shopConfig: ShopPricingConfig = cachedShopPricing,
  barberProfile?: BarberProfileOverride | null
): string[] {
  return Array.from(
    new Set([
      ...(shopConfig?.hiddenServiceIds || []),
      ...(barberProfile?.customHiddenServiceIds || []),
    ])
  );
}

/**
 * Resolves active pack/bundle rules for a specific barber:
 * - Starts from official salon bundles (`shopConfig.serviceBundles`)
 * - Applies any per-barber custom bundle overrides (matched by ID) and appends new barber-specific bundles
 */
export function getEffectiveBundlesForBarber(
  shopConfig: ShopPricingConfig = cachedShopPricing,
  barberProfile?: BarberProfileOverride | null
): ServiceBundleRule[] {
  const baseBundles =
    shopConfig?.serviceBundles !== undefined
      ? shopConfig.serviceBundles
      : DEFAULT_SERVICE_BUNDLES;
  const barberBundles = barberProfile?.customBundles;
  if (!Array.isArray(barberBundles) || barberBundles.length === 0) {
    return baseBundles;
  }

  const byId = new Map<string, ServiceBundleRule>();
  baseBundles.forEach((b) => byId.set(b.id, b));
  barberBundles.forEach((b) => byId.set(b.id, b));
  return Array.from(byId.values());
}

export function getEffectiveNoWaitEnabled(
  shopConfig: ShopPricingConfig = cachedShopPricing,
  barberProfile?: BarberProfileOverride | null
): boolean {
  return Boolean(shopConfig?.enableNoWaitOption) || Boolean(barberProfile?.enableNoWaitOption);
}

/**
 * Resolves the free gift service ID ("هدية") to auto-include when haircut + beard ("حلاقة + طراساج") are selected.
 * Returns null when explicitly disabled (`__none__`) or when no matching gift service exists.
 */
export function resolveGiftWithHaircutBeardServiceId(
  shopConfig: ShopPricingConfig = cachedShopPricing,
  barberProfile?: BarberProfileOverride | null,
  priceMapOverride?: Record<string, number>
): string | null {
  const configured = String(shopConfig?.giftWithHaircutBeardServiceId || '').trim();
  if (configured === '__none__') return null;

  const visibleServices = getVisibleBaseServices(shopConfig, barberProfile);
  const visibleIds = new Set(visibleServices.map((s) => s.id));

  if (configured && visibleIds.has(configured) && configured !== 'haircut' && configured !== 'beard') {
    return configured;
  }

  for (const srv of visibleServices) {
    if (srv.id === 'haircut' || srv.id === 'beard') continue;
    const price =
      priceMapOverride?.[srv.id] !== undefined
        ? priceMapOverride[srv.id]
        : barberProfile?.customServiceOverrides?.[srv.id]?.enabled
        ? Math.round(Number(barberProfile.customServiceOverrides[srv.id].priceMAD) || 0)
        : shopConfig?.servicePriceOverrides?.[srv.id] !== undefined
        ? Math.round(Number(shopConfig.servicePriceOverrides[srv.id]) || 0)
        : srv.basePrice;
    if (price === 0) {
      return srv.id;
    }
  }

  return null;
}

/**
 * Generates clean, contextual MAD price suggestion chips around a reference price
 * (for service price editing, pack editing, and fast cash entry).
 */
export function getSuggestedPricesAround(basePrice: number): number[] {
  const clean = Math.max(0, Math.round(Number(basePrice) || 0));
  if (clean <= 0) {
    return [0, 10, 15, 20, 25, 30, 40];
  }
  if (clean >= 100) {
    const step = clean >= 200 ? 25 : 10;
    const raw = [
      Math.max(10, clean - step * 2),
      Math.max(10, clean - step),
      clean,
      clean + step,
      clean + step * 2,
    ];
    return Array.from(new Set(raw)).sort((a, b) => a - b);
  }
  const raw = [
    Math.max(5, clean - 10),
    Math.max(5, clean - 5),
    clean,
    clean + 5,
    clean + 10,
  ];
  return Array.from(new Set(raw)).sort((a, b) => a - b);
}

/**
 * Returns contextual MAD quick-pick suggestions for a selected set of services/packs.
 * Evaluates active bundles first (e.g. haircut + beard -> 35 MAD) plus nearby presets [30, 35, 40, 45].
 */
export function getQuickPriceSuggestionsForServices(
  selectedServiceIds: string[],
  shopConfig: ShopPricingConfig = cachedShopPricing,
  barberProfile?: BarberProfileOverride | null,
  dateStr: string = new Date().toISOString().split('T')[0]
): number[] {
  if (!selectedServiceIds || selectedServiceIds.length === 0) {
    return [15, 20, 25, 30, 35, 40, 50, 60];
  }

  const resolved = resolveEffectiveServicePrices({
    dateStr,
    shopConfig,
    barberProfile,
  });

  const extraCustomMap = new Map<string, number>();
  (barberProfile?.customServices || []).forEach((s) => {
    extraCustomMap.set(s.id, Number(s.priceMAD) || 0);
  });

  const getPrice = (id: string): number => {
    if (resolved.priceMap[id] !== undefined) return resolved.priceMap[id];
    if (extraCustomMap.has(id)) return extraCustomMap.get(id) || 0;
    return BASE_SERVICES.find((s) => s.id === id)?.basePrice ?? 0;
  };

  let rawSum = 0;
  selectedServiceIds.forEach((id) => {
    rawSum += getPrice(id);
  });

  // Match active bundles greedily (largest match first)
  const bundles = getEffectiveBundlesForBarber(shopConfig, barberProfile)
    .filter((b) => b.active !== false && b.serviceIds.length >= 2)
    .sort((a, b) => b.serviceIds.length - a.serviceIds.length);

  const remaining = new Set(selectedServiceIds);
  let bundleAdjustedTotal = 0;

  for (const bundle of bundles) {
    if (bundle.serviceIds.every((sid) => remaining.has(sid))) {
      const standalonePart = bundle.serviceIds.reduce((s, sid) => s + getPrice(sid), 0);
      if (bundle.bundlePriceMAD <= standalonePart) {
        bundleAdjustedTotal += bundle.bundlePriceMAD;
        bundle.serviceIds.forEach((sid) => remaining.delete(sid));
      }
    }
  }
  remaining.forEach((sid) => {
    bundleAdjustedTotal += getPrice(sid);
  });

  const candidates = new Set<number>();
  if (bundleAdjustedTotal > 0) {
    getSuggestedPricesAround(bundleAdjustedTotal).forEach((v) => candidates.add(v));
  }
  if (rawSum > 0 && rawSum !== bundleAdjustedTotal) {
    candidates.add(rawSum);
    candidates.add(rawSum + 5);
  }
  return Array.from(candidates)
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
    .slice(0, 6);
}

export async function saveShopPricingConfig(params: {
  servicePriceOverrides: Record<string, number>;
  hiddenServiceIds?: string[];
  serviceBundles?: ServiceBundleRule[];
  specialRules: SpecialDayPricingRule[];
  enableNoWaitOption?: boolean;
  giftWithHaircutBeardServiceId?: string;
  updatedBy: string;
}): Promise<ShopPricingConfig> {
  const nowIso = new Date().toISOString().slice(0, 64);
  const rawGiftId =
    params.giftWithHaircutBeardServiceId !== undefined
      ? params.giftWithHaircutBeardServiceId
      : cachedShopPricing.giftWithHaircutBeardServiceId || '';
  const cleanGiftId = String(rawGiftId || '').trim().slice(0, 64);

  const payload: ShopPricingConfig = {
    id: SHOP_PRICING_DOC_ID,
    servicePriceOverrides: sanitizeServiceOverrides(params.servicePriceOverrides),
    hiddenServiceIds: sanitizeHiddenServiceIds(
      params.hiddenServiceIds !== undefined
        ? params.hiddenServiceIds
        : cachedShopPricing.hiddenServiceIds
    ),
    serviceBundles: sanitizeServiceBundles(
      params.serviceBundles !== undefined
        ? params.serviceBundles
        : cachedShopPricing.serviceBundles
    ),
    specialRules: (params.specialRules || []).slice(0, 30).map(sanitizeSpecialRule),
    enableNoWaitOption:
      params.enableNoWaitOption !== undefined
        ? Boolean(params.enableNoWaitOption)
        : Boolean(cachedShopPricing.enableNoWaitOption),
    ...(cleanGiftId ? { giftWithHaircutBeardServiceId: cleanGiftId } : {}),
    updatedBy: String(params.updatedBy || 'Hassan ait boumlik').trim().slice(0, 100),
    updatedAt: nowIso,
  };

  const path = `${SHOP_PRICING_COLLECTION}/${SHOP_PRICING_DOC_ID}`;
  try {
    await setDoc(doc(db, SHOP_PRICING_COLLECTION, SHOP_PRICING_DOC_ID), payload);
    commitShopPricingCache(payload, true);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function restoreDefaultShopPrices(
  currentConfig: ShopPricingConfig,
  updatedBy: string
): Promise<ShopPricingConfig> {
  return saveShopPricingConfig({
    servicePriceOverrides: {},
    hiddenServiceIds: currentConfig.hiddenServiceIds || [],
    serviceBundles: DEFAULT_SERVICE_BUNDLES.map((b) => ({
      ...b,
      serviceIds: [...b.serviceIds],
    })),
    specialRules: currentConfig.specialRules || [],
    enableNoWaitOption: Boolean(currentConfig.enableNoWaitOption),
    giftWithHaircutBeardServiceId: currentConfig.giftWithHaircutBeardServiceId || '',
    updatedBy,
  });
}

export function getLocalWeekdayFromDateStr(dateStr: string): number {
  const parts = String(dateStr || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return new Date().getDay();
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  return d.getDay();
}

export function getMatchingSpecialRulesForDate(
  dateStr: string,
  shopConfig: ShopPricingConfig
): SpecialDayPricingRule[] {
  const activeRules = (shopConfig?.specialRules || []).filter((r) => r.active !== false);
  if (activeRules.length === 0) return [];
  const weekday = getLocalWeekdayFromDateStr(dateStr);

  return activeRules.filter((rule) => {
    if (rule.scope === 'weekday') {
      return Array.isArray(rule.weekdays) && rule.weekdays.includes(weekday);
    }
    if (rule.scope === 'date_range') {
      const start = rule.startDate || '';
      const end = rule.endDate || rule.startDate || '';
      if (!start) return false;
      return dateStr >= start && dateStr <= end;
    }
    return false;
  });
}

export interface EffectivePricingResolution {
  /** Final price map keyed by BASE_SERVICES id */
  priceMap: Record<string, number>;
  /** Official salon price map before barber-specific overrides or date rules */
  officialShopPriceMap: Record<string, number>;
  /** Duration overrides enabled by the selected barber */
  durationMap: Record<string, number>;
  /** IDs of services currently customized by the selected barber */
  barberCustomServiceIds: string[];
  /** Human-readable labels of Master Admin special weekday/Eid rules active for dateStr */
  activeSpecialRuleLabels: string[];
  /** Service IDs directly governed by a Master Admin special day/Eid rule on dateStr */
  specialRuleAffectedServiceIds: string[];
}

export function resolveEffectiveServicePrices(params: {
  dateStr: string;
  shopConfig: ShopPricingConfig;
  barberProfile?: BarberProfileOverride | null;
}): EffectivePricingResolution {
  const { dateStr, shopConfig, barberProfile } = params;
  const priceMap: Record<string, number> = {};
  const officialShopPriceMap: Record<string, number> = {};
  const durationMap: Record<string, number> = {};
  const barberCustomServiceIds: string[] = [];

  for (const srv of BASE_SERVICES) {
    const shopVal = shopConfig?.servicePriceOverrides?.[srv.id];
    const shopPrice =
      typeof shopVal === 'number' && Number.isFinite(shopVal) && shopVal >= 0
        ? Math.round(shopVal)
        : srv.basePrice;

    officialShopPriceMap[srv.id] = shopPrice;
    let resolvedPrice = shopPrice;
    let resolvedDuration = srv.durationMinutes;

    const selectiveOverride = barberProfile?.customServiceOverrides?.[srv.id];
    if (selectiveOverride?.enabled) {
      resolvedPrice = Math.max(0, Math.round(Number(selectiveOverride.priceMAD) || 0));
      if (
        typeof selectiveOverride.durationMinutes === 'number' &&
        selectiveOverride.durationMinutes >= 10
      ) {
        resolvedDuration = Math.min(360, Math.round(selectiveOverride.durationMinutes));
      }
      barberCustomServiceIds.push(srv.id);
    }

    priceMap[srv.id] = resolvedPrice;
    durationMap[srv.id] = resolvedDuration;
  }

  const matchingRules = getMatchingSpecialRulesForDate(dateStr, shopConfig);
  const activeSpecialRuleLabels: string[] = [];
  const specialAffectedSet = new Set<string>();

  for (const rule of matchingRules) {
    if (rule.label) activeSpecialRuleLabels.push(rule.label);
    const barberSpecificMap = barberProfile?.barberId
      ? rule.barberServicePrices?.[barberProfile.barberId]
      : undefined;

    for (const srv of BASE_SERVICES) {
      const targetsAll = !rule.targetServiceIds || rule.targetServiceIds.length === 0;
      const isTargeted = targetsAll || rule.targetServiceIds?.includes(srv.id);
      const barberFixedVal = barberSpecificMap?.[srv.id];

      if (typeof barberFixedVal === 'number' && Number.isFinite(barberFixedVal) && barberFixedVal >= 0) {
        priceMap[srv.id] = Math.round(barberFixedVal);
        specialAffectedSet.add(srv.id);
      } else if (rule.mode === 'fixed_prices') {
        const fixedVal = rule.servicePrices?.[srv.id];
        if (typeof fixedVal === 'number' && Number.isFinite(fixedVal) && fixedVal >= 0) {
          priceMap[srv.id] = Math.round(fixedVal);
          specialAffectedSet.add(srv.id);
        }
      } else if (rule.mode === 'delta_mad' && isTargeted) {
        const delta = Number(rule.deltaMAD) || 0;
        priceMap[srv.id] = Math.max(0, Math.round((priceMap[srv.id] ?? srv.basePrice) + delta));
        specialAffectedSet.add(srv.id);
      }
    }
  }

  return {
    priceMap,
    officialShopPriceMap,
    durationMap,
    barberCustomServiceIds,
    activeSpecialRuleLabels,
    specialRuleAffectedServiceIds: Array.from(specialAffectedSet),
  };
}
