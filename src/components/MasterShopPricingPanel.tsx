import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  Gift,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import {
  BarberProfileOverride,
  CaisseBarberId,
  ServiceBundleRule,
  SpecialDayPricingRule,
} from '../types';
import { BASE_SERVICES, getGiftLabel } from '../utils/pricingEngine';
import {
  DEFAULT_SERVICE_BUNDLES,
  getSuggestedPricesAround,
  restoreDefaultShopPrices,
  saveShopPricingConfig,
  useShopPricingConfig,
} from '../utils/shopPricingStore';
import { saveBarberProfile, useBarberProfiles } from '../utils/barberProfileStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import { getBarberIdentityTokens } from '../utils/barberIdentity';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { showToast } from '../utils/notifications';

interface MasterShopPricingPanelProps {
  staffName: string;
}

const WEEKDAY_OPTIONS: { day: number; ar: string; fr: string; en: string }[] = [
  { day: 2, ar: 'الثلاثاء', fr: 'Mardi', en: 'Tue' },
  { day: 3, ar: 'الأربعاء', fr: 'Mercredi', en: 'Wed' },
  { day: 4, ar: 'الخميس', fr: 'Jeudi', en: 'Thu' },
  { day: 5, ar: 'الجمعة', fr: 'Vendredi', en: 'Fri' },
  { day: 6, ar: 'السبت', fr: 'Samedi', en: 'Sat' },
  { day: 0, ar: 'الأحد', fr: 'Dimanche', en: 'Sun' },
  { day: 1, ar: 'الإثنين', fr: 'Lundi', en: 'Mon' },
];

export const MasterShopPricingPanel: React.FC<MasterShopPricingPanelProps> = ({
  staffName,
}) => {
  const { lang } = useLanguage();
  const shopPricingConfig = useShopPricingConfig();
  const profilesMap = useBarberProfiles();
  const roster = useBarberRoster();

  const [shopPricesDraft, setShopPricesDraft] = useState<Record<string, number>>({});
  const [hiddenServiceIdsDraft, setHiddenServiceIdsDraft] = useState<string[]>([]);
  const [serviceBundlesDraft, setServiceBundlesDraft] = useState<ServiceBundleRule[]>([]);
  const [specialRulesDraft, setSpecialRulesDraft] = useState<SpecialDayPricingRule[]>([]);
  const [enableNoWaitDraft, setEnableNoWaitDraft] = useState<boolean>(false);
  const [giftServiceIdDraft, setGiftServiceIdDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Per-barber custom override inline edit state (Master Admin Edit / Revert)
  const [barberPriceDrafts, setBarberPriceDrafts] = useState<Record<string, string>>({});
  const [barberBundleDrafts, setBarberBundleDrafts] = useState<Record<string, string>>({});
  const [barberExtraDrafts, setBarberExtraDrafts] = useState<Record<string, string>>({});
  const [barberSavingKey, setBarberSavingKey] = useState<string | null>(null);

  // Add New Pack / Bundle builder state
  const [showNewBundleForm, setShowNewBundleForm] = useState(false);
  const [newBundleLabel, setNewBundleLabel] = useState('');
  const [newBundleServiceIds, setNewBundleServiceIds] = useState<string[]>(['haircut', 'beard']);
  const [newBundlePrice, setNewBundlePrice] = useState('35');

  // Special weekday / Eid rule builder state
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [ruleLabel, setRuleLabel] = useState('');
  const [ruleScope, setRuleScope] = useState<'weekday' | 'date_range'>('weekday');
  const [ruleWeekdays, setRuleWeekdays] = useState<number[]>([4]);
  const [ruleStartDate, setRuleStartDate] = useState('');
  const [ruleEndDate, setRuleEndDate] = useState('');
  const [ruleMode, setRuleMode] = useState<'fixed_prices' | 'delta_mad'>('fixed_prices');
  const [ruleTargetServiceId, setRuleTargetServiceId] = useState<string>('haircut');
  const [ruleFixedPrice, setRuleFixedPrice] = useState<string>('50');
  const [ruleDeltaMAD, setRuleDeltaMAD] = useState<string>('10');
  const [newRuleBarberPrices, setNewRuleBarberPrices] = useState<Record<string, string>>({});
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  useEffect(() => {
    const initialMap: Record<string, number> = {};
    BASE_SERVICES.forEach((srv) => {
      const ov = shopPricingConfig.servicePriceOverrides?.[srv.id];
      initialMap[srv.id] =
        typeof ov === 'number' && Number.isFinite(ov) ? Math.round(ov) : srv.basePrice;
    });
    setShopPricesDraft(initialMap);
    setHiddenServiceIdsDraft(shopPricingConfig.hiddenServiceIds || []);
    setServiceBundlesDraft(
      shopPricingConfig.serviceBundles && shopPricingConfig.serviceBundles.length > 0
        ? shopPricingConfig.serviceBundles
        : DEFAULT_SERVICE_BUNDLES
    );
    setSpecialRulesDraft(shopPricingConfig.specialRules || []);
    setEnableNoWaitDraft(Boolean(shopPricingConfig.enableNoWaitOption));
    setGiftServiceIdDraft(shopPricingConfig.giftWithHaircutBeardServiceId || '');
  }, [shopPricingConfig]);

  const persistShopPricing = async (
    nextPrices: Record<string, number>,
    nextRules: SpecialDayPricingRule[],
    toastMsg: string,
    nextHidden: string[] = hiddenServiceIdsDraft,
    nextBundles: ServiceBundleRule[] = serviceBundlesDraft,
    nextEnableNoWait: boolean = enableNoWaitDraft,
    nextGiftServiceId: string = giftServiceIdDraft
  ) => {
    setSaving(true);
    try {
      await saveShopPricingConfig({
        servicePriceOverrides: nextPrices,
        hiddenServiceIds: nextHidden,
        serviceBundles: nextBundles,
        specialRules: nextRules,
        enableNoWaitOption: nextEnableNoWait,
        giftWithHaircutBeardServiceId: nextGiftServiceId,
        updatedBy: staffName,
      });
      showToast(toastMsg, '', 'success');
    } catch (err) {
      console.error('Failed to save Master shop pricing:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleServiceVisibility = async (srvId: string) => {
    const isCurrentlyHidden = hiddenServiceIdsDraft.includes(srvId);
    const nextHidden = isCurrentlyHidden
      ? hiddenServiceIdsDraft.filter((id) => id !== srvId)
      : [...hiddenServiceIdsDraft, srvId];
    setHiddenServiceIdsDraft(nextHidden);
    await persistShopPricing(
      shopPricesDraft,
      specialRulesDraft,
      isCurrentlyHidden
        ? 'تم إظهار الخدمة للزبناء وفي لاكيس ✓'
        : 'تم إخفاء الخدمة من الموقع ولاكيس ✓',
      nextHidden,
      serviceBundlesDraft
    );
  };

  const handleAddBundle = async () => {
    if (newBundleServiceIds.length < 2) {
      showToast('اختر خدمتين على الأقل لإنشاء باقة.', '', 'warning');
      return;
    }
    const cleanLabel =
      newBundleLabel.trim() ||
      newBundleServiceIds
        .map((id) => BASE_SERVICES.find((s) => s.id === id)?.name.ar || id)
        .join(' + ');
    const parsedBundlePrice =
      newBundlePrice.trim() !== '' && Number.isFinite(Number(newBundlePrice))
        ? Math.max(0, Math.round(Number(newBundlePrice)))
        : 0;
    const created: ServiceBundleRule = {
      id: `bundle_${Date.now().toString(36)}`,
      labelAr: cleanLabel,
      serviceIds: [...newBundleServiceIds],
      bundlePriceMAD: parsedBundlePrice,
      active: true,
    };
    const nextBundles = [...serviceBundlesDraft, created];
    setServiceBundlesDraft(nextBundles);
    setShowNewBundleForm(false);
    setNewBundleLabel('');
    await persistShopPricing(
      shopPricesDraft,
      specialRulesDraft,
      'تمت إضافة الباقة الجديدة بنجاح ✓',
      hiddenServiceIdsDraft,
      nextBundles
    );
  };

  const handleRestoreDefaults = async () => {
    setSaving(true);
    try {
      await restoreDefaultShopPrices(shopPricingConfig, staffName);
      const resetMap: Record<string, number> = {};
      BASE_SERVICES.forEach((srv) => {
        resetMap[srv.id] = srv.basePrice;
      });
      setShopPricesDraft(resetMap);
      setServiceBundlesDraft(DEFAULT_SERVICE_BUNDLES);
      showToast(
        pickLang(lang, {
          ar: 'تم استرجاع الأثمنة الافتراضية لجميع خدمات المحل ✓',
          fr: 'Tarifs par défaut restaurés ✓',
          amz: 'ⵜⵜⵓⵔⴰⵔⵏ ⵡⴰⵜⵉⴳⵏ ⵉⵎⵣⵡⵓⵔⴰ ✓',
          en: 'Default salon service prices restored ✓',
          es: 'Precios predeterminados restaurados ✓',
        }),
        '',
        'success'
      );
    } catch (err) {
      console.error('Failed to restore default shop prices:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSpecialRule = async () => {
    const cleanLabel =
      ruleLabel.trim() ||
      (ruleScope === 'date_range' ? 'تسعيرة فترة خاصة / العيد' : 'تسعيرة يوم محدد');
    const parsedFixedPrice =
      ruleFixedPrice.trim() !== '' && Number.isFinite(Number(ruleFixedPrice))
        ? Math.max(0, Math.round(Number(ruleFixedPrice)))
        : 0;

    const targetIdForBarberMap = ruleTargetServiceId !== 'ALL' ? ruleTargetServiceId : 'haircut';
    const customBarberPrices: Record<string, Record<string, number>> = {};
    Object.entries(newRuleBarberPrices).forEach(([barberId, rawVal]) => {
      if (rawVal.trim() !== '' && Number.isFinite(Number(rawVal))) {
        customBarberPrices[barberId] = {
          [targetIdForBarberMap]: Math.max(0, Math.round(Number(rawVal))),
        };
      }
    });

    const newRule: SpecialDayPricingRule = {
      id: `rule_${Date.now().toString(36)}`,
      label: cleanLabel,
      active: true,
      scope: ruleScope,
      weekdays: ruleScope === 'weekday' ? ruleWeekdays : undefined,
      startDate: ruleScope === 'date_range' ? ruleStartDate : undefined,
      endDate: ruleScope === 'date_range' ? ruleEndDate || ruleStartDate : undefined,
      mode: ruleMode,
      targetServiceIds:
        ruleTargetServiceId && ruleTargetServiceId !== 'ALL'
          ? [ruleTargetServiceId]
          : undefined,
      servicePrices:
        ruleMode === 'fixed_prices' && ruleTargetServiceId !== 'ALL'
          ? { [ruleTargetServiceId]: parsedFixedPrice }
          : ruleMode === 'fixed_prices'
          ? Object.fromEntries(
              BASE_SERVICES.map((s) => [
                s.id,
                ruleFixedPrice.trim() !== '' && Number.isFinite(Number(ruleFixedPrice))
                  ? parsedFixedPrice
                  : s.basePrice,
              ])
            )
          : undefined,
      deltaMAD:
        ruleMode === 'delta_mad' ? Math.round(Number(ruleDeltaMAD) || 0) : undefined,
      ...(Object.keys(customBarberPrices).length > 0
        ? { barberServicePrices: customBarberPrices }
        : {}),
    };

    const nextRules = [...specialRulesDraft, newRule];
    setSpecialRulesDraft(nextRules);
    setShowNewRuleForm(false);
    setRuleLabel('');
    setNewRuleBarberPrices({});
    await persistShopPricing(shopPricesDraft, nextRules, 'تمت إضافة قاعدة التسعيرة الخاصة ✓');
  };

  const handleApplyThuFriSatPreset = async () => {
    const presetRules: SpecialDayPricingRule[] = [
      {
        id: 'preset_thu_30',
        label: 'تسعيرة الخميس: حسانة 30 MAD',
        active: true,
        scope: 'weekday',
        weekdays: [4],
        mode: 'fixed_prices',
        targetServiceIds: ['haircut'],
        servicePrices: { haircut: 30 },
      },
      {
        id: 'preset_fri_40',
        label: 'تسعيرة الجمعة: حسانة 40 MAD',
        active: true,
        scope: 'weekday',
        weekdays: [5],
        mode: 'fixed_prices',
        targetServiceIds: ['haircut'],
        servicePrices: { haircut: 40 },
      },
      {
        id: 'preset_sat_50',
        label: 'تسعيرة السبت: حسانة فقط 50 MAD',
        active: true,
        scope: 'weekday',
        weekdays: [6],
        mode: 'fixed_prices',
        targetServiceIds: ['haircut'],
        servicePrices: { haircut: 50 },
      },
    ];
    const filteredExisting = specialRulesDraft.filter(
      (r) => !['preset_thu_30', 'preset_fri_40', 'preset_sat_50'].includes(r.id)
    );
    const nextRules = [...filteredExisting, ...presetRules];
    setSpecialRulesDraft(nextRules);
    await persistShopPricing(
      shopPricesDraft,
      nextRules,
      'تم تفعيل تسعيرة الخميس (30) · الجمعة (40) · السبت حسانة (50) ✓'
    );
  };

  const handleApplyEidWeekendPreset = async () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const startStr = `${y}-${m}-${d}`;
    const endDate = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);
    const ey = endDate.getFullYear();
    const em = String(endDate.getMonth() + 1).padStart(2, '0');
    const ed = String(endDate.getDate()).padStart(2, '0');
    const endStr = `${ey}-${em}-${ed}`;

    const eidRule: SpecialDayPricingRule = {
      id: `eid_${Date.now().toString(36)}`,
      label: 'تسعيرة العيد (+10 MAD لجميع الخدمات)',
      active: true,
      scope: 'date_range',
      startDate: startStr,
      endDate: endStr,
      mode: 'delta_mad',
      deltaMAD: 10,
    };
    const nextRules = [...specialRulesDraft, eidRule];
    setSpecialRulesDraft(nextRules);
    await persistShopPricing(
      shopPricesDraft,
      nextRules,
      'تمت إضافة تسعيرة فترة العيد (+10 MAD) ✓'
    );
  };

  const handleToggleRuleActive = async (ruleId: string) => {
    const nextRules = specialRulesDraft.map((r) =>
      r.id === ruleId ? { ...r, active: !r.active } : r
    );
    setSpecialRulesDraft(nextRules);
    await persistShopPricing(shopPricesDraft, nextRules, 'تم تحديث حالة القاعدة ✓');
  };

  const handleDeleteRule = async (ruleId: string) => {
    const nextRules = specialRulesDraft.filter((r) => r.id !== ruleId);
    setSpecialRulesDraft(nextRules);
    await persistShopPricing(shopPricesDraft, nextRules, 'تم حذف قاعدة التسعيرة');
  };

  // Master Admin: Edit or Cancel/Revert a barber's custom service override / pack / extra service
  const buildProfileSavePayload = (
    barberId: CaisseBarberId,
    existing: BarberProfileOverride | undefined
  ) => ({
    barberId,
    avatar: existing?.avatar,
    phone: existing?.phone,
    whatsappNumber: existing?.whatsappNumber,
    instagramHandle: existing?.instagramHandle,
    bioAr: existing?.bioAr,
    bioFr: existing?.bioFr,
    bioEn: existing?.bioEn,
    useCustomServices: Boolean(existing?.useCustomServices),
    customServices: existing?.customServices || [],
    customServiceOverrides: existing?.customServiceOverrides || {},
    customHiddenServiceIds: existing?.customHiddenServiceIds || [],
    customBundles: existing?.customBundles || [],
    updatedBy: staffName,
  });

  const handleMasterSaveBarberServiceOverride = async (
    barberId: CaisseBarberId,
    srvId: string,
    newPrice: number
  ) => {
    const existing = profilesMap[barberId];
    if (!existing) return;
    const key = `${barberId}::srv::${srvId}`;
    setBarberSavingKey(key);
    try {
      const basePayload = buildProfileSavePayload(barberId, existing);
      const currentOv = basePayload.customServiceOverrides[srvId];
      const nextOverrides = {
        ...basePayload.customServiceOverrides,
        [srvId]: {
          enabled: true,
          priceMAD: Math.max(0, Math.round(newPrice)),
          ...(currentOv?.durationMinutes ? { durationMinutes: currentOv.durationMinutes } : {}),
        },
      };
      await saveBarberProfile({
        ...basePayload,
        customServiceOverrides: nextOverrides,
      });
      showToast('تم تعديل ثمن الخدمة الخاص بالحلاق ✓', `${Math.round(newPrice)} MAD`, 'success');
    } catch (err) {
      console.error('Failed to update barber service override:', err);
    } finally {
      setBarberSavingKey(null);
    }
  };

  const handleMasterRevertBarberServiceOverride = async (
    barberId: CaisseBarberId,
    srvId: string
  ) => {
    const existing = profilesMap[barberId];
    if (!existing) return;
    const key = `${barberId}::srv::${srvId}`;
    setBarberSavingKey(key);
    try {
      const basePayload = buildProfileSavePayload(barberId, existing);
      const nextOverrides = { ...basePayload.customServiceOverrides };
      delete nextOverrides[srvId];
      await saveBarberProfile({
        ...basePayload,
        customServiceOverrides: nextOverrides,
      });
      showToast('تم إلغاء التعديل وإرجاع الثمن الرسمي للمحل ✓', '', 'info');
    } catch (err) {
      console.error('Failed to revert barber service override:', err);
    } finally {
      setBarberSavingKey(null);
    }
  };

  const handleMasterSaveBarberBundle = async (
    barberId: CaisseBarberId,
    bundleId: string,
    newPrice: number
  ) => {
    const existing = profilesMap[barberId];
    if (!existing) return;
    const key = `${barberId}::bnd::${bundleId}`;
    setBarberSavingKey(key);
    try {
      const basePayload = buildProfileSavePayload(barberId, existing);
      const nextBundles = (basePayload.customBundles || []).map((b) =>
        b.id === bundleId
          ? { ...b, bundlePriceMAD: Math.max(0, Math.round(newPrice)) }
          : b
      );
      await saveBarberProfile({
        ...basePayload,
        customBundles: nextBundles,
      });
      showToast('تم تعديل ثمن باقة الحلاق ✓', `${Math.round(newPrice)} MAD`, 'success');
    } catch (err) {
      console.error('Failed to update barber bundle price:', err);
    } finally {
      setBarberSavingKey(null);
    }
  };

  const handleMasterRevertBarberBundle = async (
    barberId: CaisseBarberId,
    bundleId: string
  ) => {
    const existing = profilesMap[barberId];
    if (!existing) return;
    const key = `${barberId}::bnd::${bundleId}`;
    setBarberSavingKey(key);
    try {
      const basePayload = buildProfileSavePayload(barberId, existing);
      const nextBundles = (basePayload.customBundles || []).filter((b) => b.id !== bundleId);
      await saveBarberProfile({
        ...basePayload,
        customBundles: nextBundles,
      });
      showToast('تم إلغاء باقة الحلاق المخصصة ✓', '', 'info');
    } catch (err) {
      console.error('Failed to remove barber bundle override:', err);
    } finally {
      setBarberSavingKey(null);
    }
  };

  const handleMasterSaveBarberExtraService = async (
    barberId: CaisseBarberId,
    extraId: string,
    newPrice: number
  ) => {
    const existing = profilesMap[barberId];
    if (!existing) return;
    const key = `${barberId}::ext::${extraId}`;
    setBarberSavingKey(key);
    try {
      const basePayload = buildProfileSavePayload(barberId, existing);
      const nextExtras = (basePayload.customServices || []).map((s) =>
        s.id === extraId ? { ...s, priceMAD: Math.max(0, Math.round(newPrice)) } : s
      );
      await saveBarberProfile({
        ...basePayload,
        customServices: nextExtras,
      });
      showToast('تم تعديل الخدمة الإضافية للحلاق ✓', `${Math.round(newPrice)} MAD`, 'success');
    } catch (err) {
      console.error('Failed to update barber extra service:', err);
    } finally {
      setBarberSavingKey(null);
    }
  };

  const handleMasterRevertBarberExtraService = async (
    barberId: CaisseBarberId,
    extraId: string
  ) => {
    const existing = profilesMap[barberId];
    if (!existing) return;
    const key = `${barberId}::ext::${extraId}`;
    setBarberSavingKey(key);
    try {
      const basePayload = buildProfileSavePayload(barberId, existing);
      const nextExtras = (basePayload.customServices || []).filter((s) => s.id !== extraId);
      await saveBarberProfile({
        ...basePayload,
        customServices: nextExtras,
      });
      showToast('تم إلغاء الخدمة الإضافية للحلاق ✓', '', 'info');
    } catch (err) {
      console.error('Failed to remove barber extra service:', err);
    } finally {
      setBarberSavingKey(null);
    }
  };

  const modifiedCount = BASE_SERVICES.filter(
    (s) => (shopPricesDraft[s.id] ?? s.basePrice) !== s.basePrice
  ).length;

  return (
    <div className="space-y-5 pb-28">
      {/* Header + Actions */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-amber-300/80 dark:border-amber-500/35 border-s-4 border-s-amber-600 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <span>
                  {pickLang(lang, {
                    ar: 'أثمنة المحل الرسمية وقواعد الأيام الخاصة / العيد',
                    fr: 'Tarifs Officiels du Salon & Règles Jours Spéciaux / Aïd',
                    amz: 'ⴰⵜⵉⴳⵏ ⵏ ⵓⵙⴰⵍⵓⵏ & ⵓⵙⵙⴰⵏ ⵉⵥⵍⵉⵏ',
                    en: 'Master Shop Pricing & Special Day / Eid Overrides',
                    es: 'Precios Oficiales del Salón y Reglas de Días / Eid',
                  })}
                </span>
              </h3>
              {modifiedCount > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                  {modifiedCount} تعديل عن الافتراضي
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {pickLang(lang, {
                ar: 'تحكم حصري للمشرف العام في الأثمنة العامة للمحل ومضاعفات/أثمنة نهاية الأسبوع والأعياد (منفصلة عن التعديلات الفردية للحلاقين).',
                fr: 'Contrôle exclusif Master Admin des tarifs globaux et périodes spéciales (séparé des ajustements individuels des barbiers).',
                amz: 'ⴰⵙⵡⵓⴷⴷⵓ ⵏ ⵓⵏⵎⵀⴰⵍ ⵉ ⵡⴰⵜⵉⴳⵏ ⵏ ⵓⵙⴰⵍⵓⵏ ⴷ ⵉⵙⵙⴰⵏ ⵏ ⵍⵄⵉⴷ.',
                en: 'Master-Admin-only global service prices and weekday/Eid rules (stored separately from per-barber custom prices).',
                es: 'Control exclusivo del Admin Maestro para precios globales y reglas de días/Eid.',
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleRestoreDefaults}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span>استرجاع الأثمنة الافتراضية</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                persistShopPricing(
                  shopPricesDraft,
                  specialRulesDraft,
                  'تم حفظ أثمنة المحل الرسمية بنجاح ✓'
                )
              }
              className="min-h-[40px] px-4 py-2 rounded-xl bg-zinc-900 dark:bg-amber-500 hover:bg-zinc-800 dark:hover:bg-amber-400 text-white dark:text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>حفظ أثمنة المحل</span>
            </button>
          </div>
        </div>

        {/* Booking "No-Wait (+10 MAD)" Option Toggle & Free Gift Combo Setting */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                enableNoWaitDraft
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}>
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black text-zinc-900 dark:text-white">
                  خيار «دون الحاجة للانتظار (+10 درهم)» في الحجز العام
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  معطّل افتراضياً. عند تفعيله يظهر للزبون خيار حجز موعد مضمون دون انتظار (+10 MAD) لجميع الحلاقين.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const nextVal = !enableNoWaitDraft;
                setEnableNoWaitDraft(nextVal);
                void persistShopPricing(
                  shopPricesDraft,
                  specialRulesDraft,
                  nextVal
                    ? 'تم تفعيل خيار «دون الحاجة للانتظار (+10 درهم)» في الحجز ✓'
                    : 'تم إخفاء خيار «دون الحاجة للانتظار (+10 درهم)» (الوضع الافتراضي) ✓',
                  hiddenServiceIdsDraft,
                  serviceBundlesDraft,
                  nextVal,
                  giftServiceIdDraft
                );
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-black text-xs border transition-colors shrink-0 cursor-pointer disabled:opacity-60 ${
                enableNoWaitDraft
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-600 text-white'
                  : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {enableNoWaitDraft ? 'مفعّل حالياً ✓ (اضغط للتعطيل)' : 'معطّل افتراضياً (اضغط للتفعيل)'}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black text-zinc-900 dark:text-white">
                  خدمة «هدية» مجانية تلقائياً مع (حلاقة + طراساج)
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  أي خدمة ثمنها 0 MAD تظهر في الموقع بوسم «{getGiftLabel(lang)}»، وعند اختيار الزبون لـ (حلاقة + طراساج) تُضاف تلقائياً.
                </p>
              </div>
            </div>

            <select
              disabled={saving}
              value={giftServiceIdDraft}
              onChange={(e) => {
                const nextGiftId = e.target.value;
                setGiftServiceIdDraft(nextGiftId);
                void persistShopPricing(
                  shopPricesDraft,
                  specialRulesDraft,
                  'تم حفظ إعداد الهدية التلقائية مع (حلاقة + طراساج) ✓',
                  hiddenServiceIdsDraft,
                  serviceBundlesDraft,
                  enableNoWaitDraft,
                  nextGiftId
                );
              }}
              className="min-h-[38px] bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-900 dark:text-white shrink-0"
            >
              <option value="">تلقائي: أول خدمة ثمنها 0 (هدية)</option>
              <option value="__none__">تعطيل الإضافة التلقائية</option>
              {BASE_SERVICES.filter((s) => !hiddenServiceIdsDraft.includes(s.id)).map((s) => {
                const p = shopPricesDraft[s.id] ?? s.basePrice;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name.ar} ({p === 0 ? 'هدية' : `${p} MAD`})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* All Salon Global Service Prices Grid */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
          <div className="text-xs font-black text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>قائمة خدمات الصالون (الأثمنة العامة للمحل):</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {BASE_SERVICES.map((srv) => {
              const currentDraft = shopPricesDraft[srv.id] ?? srv.basePrice;
              const isModified = currentDraft !== srv.basePrice;
              const isHidden = hiddenServiceIdsDraft.includes(srv.id);
              const priceChips = getSuggestedPricesAround(srv.basePrice);
              return (
                <div
                  key={srv.id}
                  className={`p-3 rounded-xl border flex flex-col gap-2 transition-colors ${
                    isHidden
                      ? 'bg-zinc-100/80 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 opacity-65'
                      : isModified
                      ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40'
                      : 'bg-zinc-50 dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold block truncate ${
                            isHidden
                              ? 'line-through text-zinc-500 dark:text-zinc-500'
                              : 'text-zinc-900 dark:text-white'
                          }`}
                        >
                          {srv.name[lang] || srv.name.ar}
                        </span>
                        {isHidden ? (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[9px] font-black text-zinc-700 dark:text-zinc-300 shrink-0">
                            مخفية
                          </span>
                        ) : currentDraft === 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-[9px] font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                            هدية 🎁
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        الافتراضي: {srv.basePrice} MAD · {srv.durationMinutes} min
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleToggleServiceVisibility(srv.id)}
                        title={isHidden ? 'إظهار الخدمة' : 'إخفاء الخدمة'}
                        className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                          isHidden
                            ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }`}
                      >
                        {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={currentDraft}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          const parsed =
                            raw !== '' && Number.isFinite(Number(raw))
                              ? Math.max(0, Math.round(Number(raw)))
                              : 0;
                          setShopPricesDraft((prev) => ({
                            ...prev,
                            [srv.id]: parsed,
                          }));
                        }}
                        className="w-16 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-center font-mono font-black tabular-nums text-zinc-900 dark:text-white"
                      />
                      <span className="text-[10px] font-bold text-zinc-400">
                        {currentDraft === 0 ? 'هدية' : 'MAD'}
                      </span>
                    </div>
                  </div>
                  {!isHidden && (
                    <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/70">
                      <span className="text-[10px] font-bold text-zinc-400 me-0.5">اقتراح:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setShopPricesDraft((prev) => ({ ...prev, [srv.id]: 0 }))
                        }
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer transition-colors ${
                          currentDraft === 0
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/35 hover:border-emerald-400'
                        }`}
                      >
                        0 (هدية)
                      </button>
                      {priceChips.filter((c) => c > 0).map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() =>
                            setShopPricesDraft((prev) => ({ ...prev, [srv.id]: chip }))
                          }
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tabular-nums border cursor-pointer transition-colors ${
                            currentDraft === chip
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                          }`}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pack / Bundle Pricing Editor */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>أثمنة الباقات والعروض المدمجة (Packs / Bundles)</span>
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              حدد ثمن الباقة عند جمع خدمتين أو أكثر (مثال: حسانة + لحية = 35 MAD بدل 40 MAD).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewBundleForm((p) => !p)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة باقة جديدة</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                persistShopPricing(
                  shopPricesDraft,
                  specialRulesDraft,
                  'تم حفظ أثمنة الباقات بنجاح ✓',
                  hiddenServiceIdsDraft,
                  serviceBundlesDraft
                )
              }
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 font-black text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ الباقات</span>
            </button>
          </div>
        </div>

        {showNewBundleForm && (
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  اسم الباقة (اختياري):
                </label>
                <input
                  type="text"
                  value={newBundleLabel}
                  onChange={(e) => setNewBundleLabel(e.target.value)}
                  placeholder="مثال: باقة حسانة + لحية + غسيل"
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  ثمن الباقة الإجمالي (MAD):
                </label>
                <input
                  type="number"
                  min={0}
                  value={newBundlePrice}
                  onChange={(e) => setNewBundlePrice(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 font-mono font-black tabular-nums text-zinc-900 dark:text-white"
                />
                {(() => {
                  const standaloneSum = newBundleServiceIds.reduce(
                    (sum, sid) =>
                      sum +
                      (shopPricesDraft[sid] ??
                        BASE_SERVICES.find((s) => s.id === sid)?.basePrice ??
                        0),
                    0
                  );
                  const bundleChips = getSuggestedPricesAround(
                    Math.max(10, standaloneSum > 0 ? standaloneSum - 5 : 35)
                  );
                  return (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {bundleChips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setNewBundlePrice(String(chip))}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tabular-nums border cursor-pointer ${
                            Number(newBundlePrice) === chip
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                          }`}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div>
              <span className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
                اختر الخدمات المشمولة في الباقة (2 أو أكثر):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {BASE_SERVICES.filter((s) => !hiddenServiceIdsDraft.includes(s.id)).map((s) => {
                  const selected = newBundleServiceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setNewBundleServiceIds((prev) =>
                          prev.includes(s.id)
                            ? prev.filter((id) => id !== s.id)
                            : [...prev, s.id]
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${
                        selected
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {s.name.ar} ({shopPricesDraft[s.id] ?? s.basePrice} MAD)
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewBundleForm(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleAddBundle}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer"
              >
                إضافة الباقة ✓
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          {serviceBundlesDraft.map((bundle) => {
            const standaloneSum = bundle.serviceIds.reduce(
              (sum, sid) =>
                sum +
                (shopPricesDraft[sid] ??
                  BASE_SERVICES.find((s) => s.id === sid)?.basePrice ??
                  0),
              0
            );
            const svcNames = bundle.serviceIds
              .map((sid) => BASE_SERVICES.find((s) => s.id === sid)?.name[lang] || BASE_SERVICES.find((s) => s.id === sid)?.name.ar || sid)
              .join(' + ');

            return (
              <div
                key={bundle.id}
                className={`p-3 rounded-xl border space-y-2 transition-opacity ${
                  bundle.active !== false
                    ? 'bg-zinc-50 dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800'
                    : 'bg-zinc-100/60 dark:bg-zinc-950/30 border-zinc-200 dark:border-zinc-800 opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-zinc-900 dark:text-white truncate">
                      {bundle.labelAr}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      {svcNames} · <span className="font-mono">مجموع الفردي: {standaloneSum} MAD</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={0}
                      value={bundle.bundlePriceMAD}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const parsed =
                          raw !== '' && Number.isFinite(Number(raw))
                            ? Math.max(0, Math.round(Number(raw)))
                            : 0;
                        setServiceBundlesDraft((prev) =>
                          prev.map((b) =>
                            b.id === bundle.id ? { ...b, bundlePriceMAD: parsed } : b
                          )
                        );
                      }}
                      className="w-16 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/40 rounded-lg px-2 py-1 text-center font-mono font-black tabular-nums text-zinc-900 dark:text-white"
                    />
                    <span className="text-[10px] font-bold text-zinc-400">
                      {bundle.bundlePriceMAD === 0 ? 'هدية' : 'MAD'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setServiceBundlesDraft((prev) =>
                          prev.map((b) =>
                            b.id === bundle.id ? { ...b, active: !(b.active !== false) } : b
                          )
                        )
                      }
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                        bundle.active !== false
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {bundle.active !== false ? 'مفعلة' : 'موقفة'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setServiceBundlesDraft((prev) => prev.filter((b) => b.id !== bundle.id))
                      }
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/70">
                  <span className="text-[10px] font-bold text-zinc-400 me-0.5">سريع:</span>
                  {getSuggestedPricesAround(Math.max(10, standaloneSum > 0 ? standaloneSum - 5 : bundle.bundlePriceMAD)).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() =>
                        setServiceBundlesDraft((prev) =>
                          prev.map((b) => (b.id === bundle.id ? { ...b, bundlePriceMAD: chip } : b))
                        )
                      }
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tabular-nums border cursor-pointer ${
                        bundle.bundlePriceMAD === chip
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Special Day / Weekend / Eid Period Overrides */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>قواعد تسعيرة الأيام الخاصة، نهاية الأسبوع والعيد (للمشرف العام فقط)</span>
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              تُطبق تلقائياً حسب تاريخ الحجز (أيام الأسبوع أو فترة تواريخ العيد) ولا يمكن للحلاقين تعديلها.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleApplyThuFriSatPreset}
              className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 font-bold text-[11px] cursor-pointer"
            >
              نموذج: خميس 30 · جمعة 40 · سبت حسانة 50
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleApplyEidWeekendPreset}
              className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/35 text-purple-800 dark:text-purple-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>نموذج العيد (+10 MAD)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNewRuleForm((p) => !p)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة قاعدة مخصصة</span>
            </button>
          </div>
        </div>

        {showNewRuleForm && (
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  اسم القاعدة (مثلاً: عيد الأضحى)
                </label>
                <input
                  type="text"
                  value={ruleLabel}
                  onChange={(e) => setRuleLabel(e.target.value)}
                  placeholder="عيد الفطر / تسعيرة السبت..."
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  التطبيق حسب:
                </label>
                <select
                  value={ruleScope}
                  onChange={(e) =>
                    setRuleScope(e.target.value === 'date_range' ? 'date_range' : 'weekday')
                  }
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-zinc-900 dark:text-white font-bold"
                >
                  <option value="weekday">أيام الأسبوع (الخميس / الجمعة / السبت...)</option>
                  <option value="date_range">فترة تواريخ محددة (أيام العيد / موسم)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  الخدمات المعنية:
                </label>
                <select
                  value={ruleTargetServiceId}
                  onChange={(e) => setRuleTargetServiceId(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-zinc-900 dark:text-white font-bold"
                >
                  <option value="ALL">جميع الخدمات</option>
                  {BASE_SERVICES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name.ar} فقط
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {ruleScope === 'weekday' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-zinc-600 dark:text-zinc-400 me-1">الأيام:</span>
                {WEEKDAY_OPTIONS.map((w) => {
                  const active = ruleWeekdays.includes(w.day);
                  return (
                    <button
                      key={w.day}
                      type="button"
                      onClick={() =>
                        setRuleWeekdays((prev) =>
                          prev.includes(w.day)
                            ? prev.filter((d) => d !== w.day)
                            : [...prev, w.day]
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${
                        active
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {w.ar}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    من تاريخ:
                  </label>
                  <input
                    type="date"
                    value={ruleStartDate}
                    onChange={(e) => setRuleStartDate(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 font-mono text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    إلى تاريخ:
                  </label>
                  <input
                    type="date"
                    value={ruleEndDate}
                    onChange={(e) => setRuleEndDate(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 font-mono text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  نوع التعديل:
                </label>
                <select
                  value={ruleMode}
                  onChange={(e) =>
                    setRuleMode(
                      e.target.value === 'delta_mad' ? 'delta_mad' : 'fixed_prices'
                    )
                  }
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 font-bold text-zinc-900 dark:text-white"
                >
                  <option value="fixed_prices">ثمن محدد ثابت (MAD)</option>
                  <option value="delta_mad">زيادة أو خصم (+/- MAD)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {ruleMode === 'fixed_prices'
                    ? 'الثمن الجديد (MAD):'
                    : 'مقدار الزيادة (+) أو الخصم (-) بالدرهم:'}
                </label>
                <input
                  type="number"
                  value={ruleMode === 'fixed_prices' ? ruleFixedPrice : ruleDeltaMAD}
                  onChange={(e) =>
                    ruleMode === 'fixed_prices'
                      ? setRuleFixedPrice(e.target.value)
                      : setRuleDeltaMAD(e.target.value)
                  }
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 font-mono font-black text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            {/* Optional Per-Barber Price Override During Rule Creation */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  تخصيص ثمن محدد لكل حلاق في هذا اليوم / العيد لخدمة{' '}
                  <strong>
                    {ruleTargetServiceId !== 'ALL'
                      ? BASE_SERVICES.find((s) => s.id === ruleTargetServiceId)?.name.ar || ruleTargetServiceId
                      : 'الحلاقة (haircut)'}
                  </strong>{' '}
                  (اختياري):
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {roster
                  .filter((m) => m.role !== 'caisse' && m.status !== 'archived')
                  .map((m) => {
                    const tone = getBarberIdentityTokens(m.id, m.nameAr);
                    return (
                      <div key={m.id} className="space-y-1">
                        <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                          <span className={`w-2 h-2 rounded-full ${tone.dotClass}`} />
                          <span>{m.nameAr}</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          placeholder="افتراضي القاعدة"
                          value={newRuleBarberPrices[m.id] ?? ''}
                          onChange={(e) =>
                            setNewRuleBarberPrices((prev) => ({
                              ...prev,
                              [m.id]: e.target.value,
                            }))
                          }
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 font-mono text-zinc-900 dark:text-white"
                        />
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewRuleForm(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleAddSpecialRule}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer"
              >
                حفظ القاعدة ✓
              </button>
            </div>
          </div>
        )}

        {specialRulesDraft.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            لا توجد قواعد أيام خاصة أو عيد مضافة حالياً.
          </p>
        ) : (
          <div className="space-y-2">
            {specialRulesDraft.map((rule) => {
              const isRuleExpanded = expandedRuleId === rule.id;
              const activeBarbers = roster.filter(
                (m) => m.role !== 'caisse' && m.status !== 'archived'
              );
              const editableServiceIds =
                rule.targetServiceIds && rule.targetServiceIds.length > 0
                  ? rule.targetServiceIds
                  : ['haircut', 'beard'];
              const barberOverrideCount = Object.keys(rule.barberServicePrices || {}).length;

              return (
                <div
                  key={rule.id}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-black text-zinc-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>{rule.label}</span>
                        {barberOverrideCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                            {barberOverrideCount} حلاقين مخصصين
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        {rule.scope === 'weekday'
                          ? `أيام: ${(rule.weekdays || [])
                              .map((d) => WEEKDAY_OPTIONS.find((w) => w.day === d)?.ar || d)
                              .join('، ')}`
                          : `الفترة: ${rule.startDate} → ${rule.endDate || rule.startDate}`}
                        {' · '}
                        {rule.mode === 'delta_mad'
                          ? `${(rule.deltaMAD || 0) >= 0 ? '+' : ''}${rule.deltaMAD} MAD`
                          : Object.entries(rule.servicePrices || {})
                              .map(([sid, val]) => `${sid}: ${val} MAD`)
                              .join(', ')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setExpandedRuleId(isRuleExpanded ? null : rule.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Users className="w-3 h-3 text-amber-600" />
                        <span>أثمنة الحلاقين</span>
                        {isRuleExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleRuleActive(rule.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          rule.active
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                            : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {rule.active ? 'مفعلة ✓' : 'متوقفة'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isRuleExpanded && (
                    <div className="pt-2.5 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
                      <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                        تحديد ثمن خاص بكل حلاق أثناء «{rule.label}» (اتركه فارغاً ليأخذ السعر العام للقاعدة):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {activeBarbers.map((member) => {
                          const tone = getBarberIdentityTokens(member.id, member.nameAr);
                          const currentBarberMap = rule.barberServicePrices?.[member.id] || {};
                          return (
                            <div
                              key={member.id}
                              className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5"
                            >
                              <div className="flex items-center gap-1.5 font-black text-zinc-900 dark:text-white">
                                <span className={`w-2 h-2 rounded-full ${tone.dotClass}`} />
                                <span>{member.nameAr}</span>
                              </div>
                              {editableServiceIds.map((sid) => {
                                const srvLabel =
                                  BASE_SERVICES.find((s) => s.id === sid)?.name.ar || sid;
                                const curVal = currentBarberMap[sid];
                                return (
                                  <div key={sid} className="flex items-center justify-between gap-1.5">
                                    <span className="text-[10px] text-zinc-500 truncate">{srvLabel}</span>
                                    <input
                                      type="number"
                                      min={0}
                                      placeholder="عام"
                                      value={curVal !== undefined ? String(curVal) : ''}
                                      onChange={(e) => {
                                        const raw = e.target.value.trim();
                                        setSpecialRulesDraft((prev) =>
                                          prev.map((r) => {
                                            if (r.id !== rule.id) return r;
                                            const nextBarberMap = { ...(r.barberServicePrices || {}) };
                                            const nextSrvMap = { ...(nextBarberMap[member.id] || {}) };
                                            if (raw === '') {
                                              delete nextSrvMap[sid];
                                            } else if (Number.isFinite(Number(raw))) {
                                              nextSrvMap[sid] = Math.max(0, Math.round(Number(raw)));
                                            }
                                            if (Object.keys(nextSrvMap).length > 0) {
                                              nextBarberMap[member.id] = nextSrvMap;
                                            } else {
                                              delete nextBarberMap[member.id];
                                            }
                                            return {
                                              ...r,
                                              barberServicePrices:
                                                Object.keys(nextBarberMap).length > 0
                                                  ? nextBarberMap
                                                  : undefined,
                                            };
                                          })
                                        );
                                      }}
                                      className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-1.5 py-1 text-center font-mono font-bold text-zinc-900 dark:text-white"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            persistShopPricing(
                              shopPricesDraft,
                              specialRulesDraft,
                              `تم حفظ أثمنة الحلاقين لقاعدة «${rule.label}» ✓`
                            )
                          }
                          className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] flex items-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>حفظ أثمنة الحلاقين في هذه القاعدة</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Master Admin Per-Barber Custom Services & Packs Oversight (Direct Edit / Cancel-Revert) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>تعديلات الأثمنة والباقات الخاصة بكل حلاق (تعديل أو إلغاء للمشرف العام)</span>
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            راجع الأثمنة أو الباقات التي خصصها كل حلاق لنفسه، مع إمكانية تعديل الثمن مباشرة أو إلغائه لإرجاع الثمن الرسمي للمحل.
          </p>
        </div>

        <div className="space-y-3">
          {roster
            .filter((m) => m.role !== 'caisse' && m.status !== 'archived')
            .map((member) => {
              const profile = profilesMap[member.id];
              const tone = getBarberIdentityTokens(member.id, member.nameAr);
              const customServiceOverrides = Object.entries(
                profile?.customServiceOverrides || {}
              ).filter(([, ov]) => ov?.enabled);
              const customBundles = profile?.customBundles || [];
              const extraServices = (profile?.customServices || []).filter(
                (s) => !BASE_SERVICES.some((b) => b.id === s.id)
              );
              const totalCustomCount =
                customServiceOverrides.length + customBundles.length + extraServices.length;

              return (
                <div
                  key={member.id}
                  className={`p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs ${tone.borderLeftClass}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${tone.dotClass}`} />
                      <span className="font-black text-zinc-900 dark:text-white">
                        {member.nameAr}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        ({member.nameFr})
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        totalCustomCount > 0
                          ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300'
                          : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                      }`}
                    >
                      {totalCustomCount > 0
                        ? `${totalCustomCount} تعديل مخصص`
                        : 'يستعمل أثمنة المحل الرسمية'}
                    </span>
                  </div>

                  {totalCustomCount > 0 && (
                    <div className="space-y-2">
                      {/* Service Overrides */}
                      {customServiceOverrides.map(([srvId, ov]) => {
                        const baseSrv = BASE_SERVICES.find((b) => b.id === srvId);
                        const shopPrice =
                          shopPricesDraft[srvId] ?? baseSrv?.basePrice ?? ov.priceMAD;
                        const draftKey = `${member.id}::srv::${srvId}`;
                        const inputVal =
                          barberPriceDrafts[draftKey] !== undefined
                            ? barberPriceDrafts[draftKey]
                            : String(ov.priceMAD);
                        const isBusy = barberSavingKey === draftKey;

                        return (
                          <div
                            key={draftKey}
                            className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-zinc-900 dark:text-white">
                                {baseSrv?.name[lang] || baseSrv?.name.ar || srvId}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-400">
                                الرسمي للمحل: {shopPrice} MAD · ثمن الحلاق: {ov.priceMAD} MAD
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <input
                                  type="number"
                                  min={0}
                                  value={inputVal}
                                  onChange={(e) =>
                                    setBarberPriceDrafts((prev) => ({
                                      ...prev,
                                      [draftKey]: e.target.value,
                                    }))
                                  }
                                  className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-center font-mono font-black tabular-nums text-zinc-900 dark:text-white"
                                />
                                <span className="text-[10px] text-zinc-400">MAD</span>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleMasterSaveBarberServiceOverride(
                                      member.id,
                                      srvId,
                                      Number(inputVal) || 0
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-60"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>تعديل</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleMasterRevertBarberServiceOverride(member.id, srvId)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-60"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>إلغاء</span>
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {getSuggestedPricesAround(shopPrice).map((chip) => (
                                  <button
                                    key={chip}
                                    type="button"
                                    onClick={() =>
                                      setBarberPriceDrafts((prev) => ({
                                        ...prev,
                                        [draftKey]: String(chip),
                                      }))
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums border cursor-pointer ${
                                      Number(inputVal) === chip
                                        ? 'bg-amber-600 text-white border-amber-600'
                                        : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                                    }`}
                                  >
                                    {chip}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Custom Barber Packs / Bundles */}
                      {customBundles.map((bundle) => {
                        const draftKey = `${member.id}::bnd::${bundle.id}`;
                        const inputVal =
                          barberBundleDrafts[draftKey] !== undefined
                            ? barberBundleDrafts[draftKey]
                            : String(bundle.bundlePriceMAD);
                        const isBusy = barberSavingKey === draftKey;
                        const officialBundle = serviceBundlesDraft.find(
                          (sb) => sb.id === bundle.id
                        );

                        return (
                          <div
                            key={draftKey}
                            className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-500/25 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>{bundle.labelAr}</span>
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500">
                                باقة مخصصة ·{' '}
                                {officialBundle
                                  ? `الرسمي: ${officialBundle.bundlePriceMAD} MAD`
                                  : 'باقة خاصة بالحلاق'}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <input
                                  type="number"
                                  min={0}
                                  value={inputVal}
                                  onChange={(e) =>
                                    setBarberBundleDrafts((prev) => ({
                                      ...prev,
                                      [draftKey]: e.target.value,
                                    }))
                                  }
                                  className="w-16 bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-500/40 rounded-lg px-2 py-1 text-center font-mono font-black tabular-nums text-zinc-900 dark:text-white"
                                />
                                <span className="text-[10px] text-zinc-400">MAD</span>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleMasterSaveBarberBundle(
                                      member.id,
                                      bundle.id,
                                      Number(inputVal) || 0
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-60"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>تعديل</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleMasterRevertBarberBundle(member.id, bundle.id)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-60"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>إلغاء</span>
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {getSuggestedPricesAround(officialBundle?.bundlePriceMAD ?? bundle.bundlePriceMAD).map((chip) => (
                                  <button
                                    key={chip}
                                    type="button"
                                    onClick={() =>
                                      setBarberBundleDrafts((prev) => ({
                                        ...prev,
                                        [draftKey]: String(chip),
                                      }))
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums border cursor-pointer ${
                                      Number(inputVal) === chip
                                        ? 'bg-amber-600 text-white border-amber-600'
                                        : 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                                    }`}
                                  >
                                    {chip}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Extra Personal Custom Services */}
                      {extraServices.map((extra) => {
                        const draftKey = `${member.id}::ext::${extra.id}`;
                        const inputVal =
                          barberExtraDrafts[draftKey] !== undefined
                            ? barberExtraDrafts[draftKey]
                            : String(extra.priceMAD);
                        const isBusy = barberSavingKey === draftKey;

                        return (
                          <div
                            key={draftKey}
                            className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-zinc-900 dark:text-white">
                                {extra.nameAr} (خدمة إضافية خاصة)
                              </div>
                              <div className="text-[10px] font-mono text-zinc-400">
                                {extra.durationMinutes} min · الثمن الحالي: {extra.priceMAD} MAD
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <input
                                type="number"
                                min={0}
                                value={inputVal}
                                onChange={(e) =>
                                  setBarberExtraDrafts((prev) => ({
                                    ...prev,
                                    [draftKey]: e.target.value,
                                  }))
                                }
                                className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-center font-mono font-black text-zinc-900 dark:text-white"
                              />
                              <span className="text-[10px] text-zinc-400">MAD</span>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleMasterSaveBarberExtraService(
                                    member.id,
                                    extra.id,
                                    Number(inputVal) || 0
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-60"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleMasterRevertBarberExtraService(member.id, extra.id)
                                }
                                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-60"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>إلغاء</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
