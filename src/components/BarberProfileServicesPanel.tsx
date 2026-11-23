import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  Clock,
  Eye,
  EyeOff,
  Instagram,
  KeyRound,
  Package,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  Sparkles,
  Trash2,
  Upload,
  User,
  Zap,
} from 'lucide-react';
import {
  BarberCustomService,
  BarberCustomServiceOverride,
  CaisseBarberId,
  ServiceBundleRule,
} from '../types';
import { BASE_SERVICES } from '../utils/pricingEngine';
import {
  compressAvatarImageFile,
  getMergedBarbers,
  normalizeInstagramHandle,
  saveBarberProfile,
  useBarberProfiles,
} from '../utils/barberProfileStore';
import {
  DEFAULT_SERVICE_BUNDLES,
  getEffectiveBundlesForBarber,
  getSuggestedPricesAround,
  getVisibleBaseServices,
  useShopPricingConfig,
} from '../utils/shopPricingStore';
import { changeOwnMemberPin, useBarberRoster } from '../utils/barberRosterStore';
import { getBarberIdentityTokens } from '../utils/barberIdentity';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { showToast } from '../utils/notifications';

interface BarberProfileServicesPanelProps {
  sessionRole: 'master' | 'barber';
  ownBarberId: 'all' | CaisseBarberId;
  staffName: string;
  sessionMemberId?: string;
}

function toMoroccanNationalDigits(raw: string | undefined): string {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('212') && digits.length > 3) {
    return digits.slice(3).replace(/^0+/, '').slice(0, 9);
  }
  if (digits.startsWith('0')) {
    return digits.slice(1).slice(0, 9);
  }
  return digits.slice(0, 9);
}

export const BarberProfileServicesPanel: React.FC<BarberProfileServicesPanelProps> = ({
  sessionRole,
  ownBarberId,
  staffName,
  sessionMemberId,
}) => {
  const { lang } = useLanguage();
  const profilesMap = useBarberProfiles();
  const shopPricingConfig = useShopPricingConfig();
  const roster = useBarberRoster();

  const mergedBarbers = useMemo(
    () => getMergedBarbers(profilesMap, roster),
    [profilesMap, roster]
  );

  const visibleBaseServices = useMemo(
    () => getVisibleBaseServices(shopPricingConfig),
    [shopPricingConfig]
  );

  const initialBarberId: CaisseBarberId =
    sessionRole === 'barber' && ownBarberId !== 'all' ? ownBarberId : 'hassan';

  const [selectedBarberId, setSelectedBarberId] = useState<CaisseBarberId>(initialBarberId);

  useEffect(() => {
    if (sessionRole === 'barber' && ownBarberId !== 'all') {
      setSelectedBarberId(ownBarberId);
    }
  }, [sessionRole, ownBarberId]);

  const activeBarberId: CaisseBarberId =
    sessionRole === 'barber' && ownBarberId !== 'all' ? ownBarberId : selectedBarberId;

  const staticMember = useMemo(
    () => mergedBarbers.find((m) => m.id === activeBarberId) || mergedBarbers[0],
    [activeBarberId, mergedBarbers]
  );

  const liveOverride = profilesMap[activeBarberId];
  const tone = getBarberIdentityTokens(activeBarberId, staticMember?.name.ar);

  const [avatar, setAvatar] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [whatsappDigits, setWhatsappDigits] = useState('');
  const [igHandleInput, setIgHandleInput] = useState('');
  const [bioAr, setBioAr] = useState('');
  const [bioFr, setBioFr] = useState('');
  const [bioEn, setBioEn] = useState('');

  // Selective per-service overrides for THIS barber only
  const [serviceOverridesDraft, setServiceOverridesDraft] = useState<
    Record<string, BarberCustomServiceOverride>
  >({});

  // Per-barber hidden base services (only hidden when THIS barber is selected)
  const [hiddenServiceIdsDraft, setHiddenServiceIdsDraft] = useState<string[]>([]);

  // Per-barber custom pack/bundle prices
  const [customBundlesDraft, setCustomBundlesDraft] = useState<ServiceBundleRule[]>([]);
  const [showNewBundleForm, setShowNewBundleForm] = useState(false);
  const [newBundleLabel, setNewBundleLabel] = useState('');
  const [newBundleServiceIds, setNewBundleServiceIds] = useState<string[]>(['haircut', 'beard']);
  const [newBundlePrice, setNewBundlePrice] = useState('35');

  // Optional extra personal custom services not in BASE_SERVICES
  const [extraCustomServices, setExtraCustomServices] = useState<BarberCustomService[]>([]);
  const [newNameAr, setNewNameAr] = useState('');
  const [newNameFr, setNewNameFr] = useState('');
  const [newPrice, setNewPrice] = useState('50');
  const [newDuration, setNewDuration] = useState('45');
  const [enableNoWaitDraft, setEnableNoWaitDraft] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);

  // Own password/PIN change card
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChanging, setPinChanging] = useState(false);

  useEffect(() => {
    setAvatar(liveOverride?.avatar ?? staticMember.avatar);
    setPhoneDigits(toMoroccanNationalDigits(liveOverride?.phone ?? staticMember.phone));
    setWhatsappDigits(
      toMoroccanNationalDigits(
        liveOverride?.whatsappNumber ?? staticMember.whatsappNumber ?? staticMember.phone
      )
    );
    const rawIg = normalizeInstagramHandle(
      liveOverride?.instagramHandle ?? staticMember.instagramHandle ?? ''
    );
    setIgHandleInput(rawIg.replace(/^@+/, ''));
    setBioAr(liveOverride?.bioAr ?? staticMember.bio?.ar ?? '');
    setBioFr(liveOverride?.bioFr ?? staticMember.bio?.fr ?? '');
    setBioEn(liveOverride?.bioEn ?? staticMember.bio?.en ?? '');

    setServiceOverridesDraft(liveOverride?.customServiceOverrides || {});
    setHiddenServiceIdsDraft(liveOverride?.customHiddenServiceIds || []);
    setCustomBundlesDraft(liveOverride?.customBundles || []);
    setExtraCustomServices(
      (liveOverride?.customServices || []).filter(
        (s) => !BASE_SERVICES.some((b) => b.id === s.id)
      )
    );
    setEnableNoWaitDraft(Boolean(liveOverride?.enableNoWaitOption));
    setSavedFlag(false);
  }, [activeBarberId, liveOverride, staticMember]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const dataUrl = await compressAvatarImageFile(file);
      setAvatar(dataUrl);
      showToast(
        pickLang(lang, {
          ar: 'تم تجهيز الصورة ✓',
          fr: 'Photo prête ✓',
          amz: 'ⵜⴰⵡⵍⴰⴼⵜ ⵜⴻⵎⵎⵓⵜⵜⵉ ✓',
          en: 'Photo ready ✓',
          es: 'Foto lista ✓',
        }),
        pickLang(lang, {
          ar: 'اضغط على "حفظ التغييرات" لتثبيتها في الموقع.',
          fr: 'Cliquez sur « Enregistrer » pour publier la photo.',
          amz: 'ⴰⴷⵔ ⵖⴼ "ⵃⴹⵓ" ⵉ ⵓⴼⵙⴰⵔ.',
          en: 'Click "Save Changes" to publish your updated photo.',
          es: 'Pulsa "Guardar cambios" para publicarla.',
        }),
        'success'
      );
    } catch (err) {
      console.error('Avatar upload compression error:', err);
      showToast(
        pickLang(lang, {
          ar: 'تعذر معالجة الصورة',
          fr: 'Impossible de traiter l’image',
          amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⵙⴽⵔ ⵜⴰⵡⵍⴰⴼⵜ',
          en: 'Could not process image',
          es: 'No se pudo procesar la imagen',
        }),
        '',
        'warning'
      );
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const toggleBarberServiceOverride = (
    srvId: string,
    shopCurrentPrice: number,
    defaultDur: number
  ) => {
    setServiceOverridesDraft((prev) => {
      const existing = prev[srvId];
      if (existing?.enabled) {
        const next = { ...prev };
        delete next[srvId];
        return next;
      }
      return {
        ...prev,
        [srvId]: {
          enabled: true,
          priceMAD: shopCurrentPrice,
          durationMinutes: defaultDur,
        },
      };
    });
  };

  const updateBarberServiceOverrideField = (
    srvId: string,
    patch: Partial<BarberCustomServiceOverride>
  ) => {
    setServiceOverridesDraft((prev) => {
      const curr = prev[srvId];
      if (!curr) return prev;
      return {
        ...prev,
        [srvId]: { ...curr, ...patch },
      };
    });
  };

  const handleAddExtraService = () => {
    const cleanAr = newNameAr.trim();
    if (!cleanAr) return;
    const rawPrice = newPrice.trim();
    const parsedPrice =
      rawPrice !== '' && Number.isFinite(Number(rawPrice))
        ? Math.max(0, Math.round(Number(rawPrice)))
        : 0;
    const newSrv: BarberCustomService = {
      id: `custom-${Date.now().toString(36)}`,
      nameAr: cleanAr,
      nameFr: newNameFr.trim() || cleanAr,
      nameEn: newNameFr.trim() || cleanAr,
      priceMAD: parsedPrice,
      durationMinutes: Math.max(10, Math.min(360, Math.round(Number(newDuration) || 30))),
      active: true,
    };
    setExtraCustomServices((prev) => [...prev, newSrv]);
    setNewNameAr('');
    setNewNameFr('');
    setNewPrice('50');
    setNewDuration('45');
  };

  const handleUpdateExtraService = (idx: number, patch: Partial<BarberCustomService>) => {
    setExtraCustomServices((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveExtraService = (idx: number) => {
    setExtraCustomServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleToggleBarberHiddenService = (srvId: string) => {
    setHiddenServiceIdsDraft((prev) =>
      prev.includes(srvId) ? prev.filter((id) => id !== srvId) : [...prev, srvId]
    );
  };

  const shopBundlesBaseline = useMemo(
    () =>
      shopPricingConfig.serviceBundles !== undefined
        ? shopPricingConfig.serviceBundles
        : DEFAULT_SERVICE_BUNDLES,
    [shopPricingConfig.serviceBundles]
  );

  const displayedBundles = useMemo(
    () =>
      getEffectiveBundlesForBarber(shopPricingConfig, {
        ...(liveOverride || {}),
        id: activeBarberId,
        barberId: activeBarberId,
        useCustomServices: true,
        customServices: extraCustomServices,
        updatedBy: staffName,
        updatedAt: liveOverride?.updatedAt || '',
        customBundles: customBundlesDraft,
      }),
    [shopPricingConfig, liveOverride, activeBarberId, extraCustomServices, staffName, customBundlesDraft]
  );

  const toggleBarberBundleOverride = (shopBundle: ServiceBundleRule) => {
    setCustomBundlesDraft((prev) => {
      const exists = prev.some((b) => b.id === shopBundle.id);
      if (exists) {
        return prev.filter((b) => b.id !== shopBundle.id);
      }
      return [
        ...prev,
        {
          ...shopBundle,
          serviceIds: [...shopBundle.serviceIds],
        },
      ];
    });
  };

  const handleUpdateBarberBundle = (
    bundle: ServiceBundleRule,
    patch: Partial<ServiceBundleRule>
  ) => {
    setCustomBundlesDraft((prev) => {
      const idx = prev.findIndex((b) => b.id === bundle.id);
      if (idx >= 0) {
        return prev.map((b, i) => (i === idx ? { ...b, ...patch } : b));
      }
      return [...prev, { ...bundle, serviceIds: [...bundle.serviceIds], ...patch }];
    });
  };

  const handleAddBarberBundle = () => {
    if (newBundleServiceIds.length < 2) {
      showToast('اختر خدمتين على الأقل لإنشاء باقة.', '', 'warning');
      return;
    }
    const cleanLabel =
      newBundleLabel.trim() ||
      newBundleServiceIds
        .map((id) => BASE_SERVICES.find((s) => s.id === id)?.name.ar || id)
        .join(' + ');
    const rawBPrice = newBundlePrice.trim();
    const parsedBPrice =
      rawBPrice !== '' && Number.isFinite(Number(rawBPrice))
        ? Math.max(0, Math.round(Number(rawBPrice)))
        : 0;
    const created: ServiceBundleRule = {
      id: `bpack_${activeBarberId}_${Date.now().toString(36)}`,
      labelAr: cleanLabel,
      serviceIds: [...newBundleServiceIds],
      bundlePriceMAD: parsedBPrice,
      active: true,
    };
    setCustomBundlesDraft((prev) => [...prev, created]);
    setShowNewBundleForm(false);
    setNewBundleLabel('');
  };

  const handleRemoveBarberBundle = (bundleId: string) => {
    setCustomBundlesDraft((prev) => prev.filter((b) => b.id !== bundleId));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanPhoneDigits = toMoroccanNationalDigits(phoneDigits);
      const cleanWaDigits = toMoroccanNationalDigits(whatsappDigits);
      const formattedPhone = cleanPhoneDigits ? `+212 ${cleanPhoneDigits}` : '';
      const formattedWa = cleanWaDigits ? `212${cleanWaDigits}` : '';
      const cleanIg = igHandleInput.trim().replace(/^@+/, '');

      await saveBarberProfile({
        barberId: activeBarberId,
        avatar: avatar.trim(),
        phone: formattedPhone,
        whatsappNumber: formattedWa,
        instagramHandle: cleanIg ? `@${cleanIg}` : '',
        ...(activeBarberId === 'hassan' && sessionRole === 'master'
          ? {
              bioAr: bioAr.trim(),
              bioFr: bioFr.trim(),
              bioEn: bioEn.trim(),
            }
          : {}),
        useCustomServices:
          Object.values(serviceOverridesDraft).some((v) => v.enabled) ||
          extraCustomServices.length > 0 ||
          hiddenServiceIdsDraft.length > 0 ||
          customBundlesDraft.length > 0,
        customServices: extraCustomServices,
        customServiceOverrides: serviceOverridesDraft,
        customHiddenServiceIds: hiddenServiceIdsDraft,
        customBundles: customBundlesDraft,
        enableNoWaitOption: enableNoWaitDraft,
        updatedBy: staffName,
      });

      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 3000);
      showToast(
        pickLang(lang, {
          ar: 'تم حفظ الملف والخدمات بنجاح ✓',
          fr: 'Profil et prestations enregistrés ✓',
          amz: 'ⵉⵜⵜⵓⵃⴹⴰ ⵓⴼⴰⵢⵍⵓ ⴷ ⵜⵡⵓⵔⵉⵡⵉⵏ ✓',
          en: 'Profile & services saved ✓',
          es: 'Perfil y servicios guardados ✓',
        }),
        pickLang(lang, {
          ar: 'تُطبَّق أثمنتك المخصصة فقط عندما يختارك الزبون.',
          fr: 'Vos tarifs personnalisés s’appliquent uniquement lorsque le client vous choisit.',
          amz: 'ⴰⵜⵉⴳⵏ ⵉⵥⵍⵉⵏ ⵜⵜⵓⵙⵎⵔⴰⵏ ⵎⴰⵔ ⵉⵙⵜⵉⴽ ⵓⵎⵙⵙⴰⵖ.',
          en: 'Custom prices apply only when clients select you.',
          es: 'Tus precios se aplican solo cuando el cliente te elija.',
        }),
        'success'
      );
    } catch (err) {
      console.error('Failed to save barber profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const effectiveOwnMemberId =
    sessionMemberId || (sessionRole === 'master' ? 'hassan' : activeBarberId);

  const handleChangeOwnPin = async () => {
    if (!newPinInput.trim() || newPinInput.trim() !== confirmPinInput.trim()) {
      showToast('كلمة المرور الجديدة وتأكيدها غير متطابقين.', '', 'warning');
      return;
    }
    setPinChanging(true);
    try {
      await changeOwnMemberPin({
        memberId: effectiveOwnMemberId,
        currentPin: currentPinInput,
        newPin: newPinInput,
        roster,
      });
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      showToast(
        pickLang(lang, {
          ar: 'تم تغيير كلمة المرور الخاصة بك بنجاح ✓',
          fr: 'Mot de passe mis à jour avec succès ✓',
          amz: 'ⵉⵜⵜⵓⵙⵏⴼⵍ ⵓⵣⵎⵣ ⵏⵏⴽ ✓',
          en: 'Your password/PIN was updated ✓',
          es: 'Contraseña actualizada con éxito ✓',
        }),
        '',
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور',
        '',
        'warning'
      );
    } finally {
      setPinChanging(false);
    }
  };

  const enabledCustomCount = Object.values(serviceOverridesDraft).filter((v) => v.enabled).length;

  return (
    <form onSubmit={handleSaveProfile} className="space-y-5 pb-28">
      {/* Top Header Card */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border shadow-sm bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 ${tone.borderLeftClass}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={avatar || staticMember.avatar}
              alt={staticMember.name.ar}
              className="w-14 h-14 rounded-2xl object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-zinc-900 dark:text-white">
                  {pickLang(lang, {
                    ar: 'ملفي وخدماتي',
                    fr: 'Mon Profil & Mes Prestations',
                    amz: 'ⴰⴼⴰⵢⵍⵓ ⵉⵏⵓ & ⵜⵉⵡⵓⵔⵉⵡⵉⵏ',
                    en: 'My Profile & Services',
                    es: 'Mi Perfil y Servicios',
                  })}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${tone.badgeClass}`}>
                  {staticMember.name[lang] || staticMember.name.ar}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {pickLang(lang, {
                  ar: 'الصورة، أرقام التواصل (+212)، إنستغرام (@)، وتخصيص أثمنة الخدمات التي تختارها لنفسك فقط.',
                  fr: 'Photo, téléphone (+212), Instagram (@) et tarifs personnalisés uniquement pour les services cochés.',
                  amz: 'ⵜⴰⵡⵍⴰⴼⵜ, +212, Instagram ⴷ ⵡⴰⵜⵉⴳⵏ ⵉⵥⵍⵉⵏ.',
                  en: 'Avatar, +212 phone/WhatsApp, @Instagram, and selective custom prices for your chosen services.',
                  es: 'Foto, +212, @Instagram y precios selectivos solo para los servicios marcados.',
                })}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : savedFlag ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {savedFlag
                ? pickLang(lang, {
                    ar: 'تم الحفظ ✓',
                    fr: 'Enregistré ✓',
                    amz: 'ⵉⵜⵜⵓⵃⴹⴰ ✓',
                    en: 'Saved ✓',
                    es: 'Guardado ✓',
                  })
                : pickLang(lang, {
                    ar: 'حفظ التغييرات',
                    fr: 'Enregistrer',
                    amz: 'ⵃⴹⵓ ⵉⵙⵏⴼⵍⵏ',
                    en: 'Save Changes',
                    es: 'Guardar Cambios',
                  })}
            </span>
          </button>
        </div>

        {sessionRole === 'master' && (
          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
              {pickLang(lang, {
                ar: 'اختر الحلاق لتعديل ملفه:',
                fr: 'Choisir le barbier :',
                amz: 'ⵙⵜⵉ ⴰⵎⴽⵕⴰⴹ :',
                en: 'Select barber profile:',
                es: 'Elegir barbero:',
              })}
            </span>
            {mergedBarbers.map((b) => {
              const bTone = getBarberIdentityTokens(b.id, b.name.ar);
              const isSelected = activeBarberId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBarberId(b.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? bTone.activeTabClass
                      : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-current' : bTone.dotClass}`} />
                  <span>{b.name[lang] || b.name.ar}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Avatar, +212 Phone/WhatsApp, @Instagram Handle (and Founder-Only Bio) */}
      <div
        className={`grid grid-cols-1 ${
          sessionRole === 'master' && staticMember.isOwner ? 'lg:grid-cols-2' : ''
        } gap-4`}
      >
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <Camera className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>
              {pickLang(lang, {
                ar: 'الصورة الشخصية، الهاتف (+212) وإنستغرام (@)',
                fr: 'Photo, Téléphone (+212) & Instagram (@)',
                amz: 'ⵜⴰⵡⵍⴰⴼⵜ, +212 & Instagram',
                en: 'Avatar, +212 Phone & @Instagram',
                es: 'Foto, Teléfono (+212) e Instagram (@)',
              })}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <img
              src={avatar || staticMember.avatar}
              alt={staticMember.name.ar}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-zinc-200 dark:border-zinc-700 shadow-sm shrink-0"
            />
            <div className="flex-1 min-w-[200px] space-y-2">
              <div className="flex flex-wrap gap-2">
                <label className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors">
                  {uploadingAvatar ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {pickLang(lang, {
                      ar: 'رفع صورة جديدة',
                      fr: 'Importer une photo',
                      amz: 'ⵙⴽⵛⵎ ⵜⴰⵡⵍⴰⴼⵜ',
                      en: 'Upload Photo',
                      es: 'Subir foto',
                    })}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setAvatar(staticMember.avatar)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    {pickLang(lang, {
                      ar: 'استعادة الصورة',
                      fr: 'Réinitialiser',
                      amz: 'ⴰⵔⴰⵔ',
                      en: 'Reset Photo',
                      es: 'Restablecer',
                    })}
                  </span>
                </button>
              </div>
              <input
                type="text"
                dir="ltr"
                value={avatar.startsWith('data:') ? '' : avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder={
                  avatar.startsWith('data:')
                    ? 'صورة مرفوعة جاهزة للحفظ ✓'
                    : 'https://...'
                }
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          {/* Pre-filled +212 Phone, +212 WhatsApp & @ Instagram Handle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                <Phone className="w-3.5 h-3.5 inline me-1 text-zinc-400" />
                {pickLang(lang, {
                  ar: 'رقم الهاتف',
                  fr: 'Téléphone',
                  amz: 'ⵜⵉⵍⵉⴼⵓⵏ',
                  en: 'Phone Number',
                  es: 'Teléfono',
                })}
              </label>
              <div
                dir="ltr"
                className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-hidden focus-within:border-amber-500"
              >
                <span className="px-2.5 py-2 bg-zinc-100 dark:bg-zinc-900 border-e border-zinc-200 dark:border-zinc-800 font-mono font-bold text-zinc-600 dark:text-zinc-300 select-none">
                  +212
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(toMoroccanNationalDigits(e.target.value))}
                  placeholder="612345678"
                  maxLength={9}
                  className="w-full bg-transparent px-2.5 py-2 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                البادئة +212 ثابتة — أدخل 9 أرقام فقط
              </span>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                {pickLang(lang, {
                  ar: 'رقم WhatsApp',
                  fr: 'WhatsApp',
                  amz: 'WhatsApp',
                  en: 'WhatsApp',
                  es: 'WhatsApp',
                })}
              </label>
              <div
                dir="ltr"
                className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-hidden focus-within:border-emerald-500"
              >
                <span className="px-2.5 py-2 bg-zinc-100 dark:bg-zinc-900 border-e border-zinc-200 dark:border-zinc-800 font-mono font-bold text-emerald-700 dark:text-emerald-400 select-none">
                  +212
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={whatsappDigits}
                  onChange={(e) => setWhatsappDigits(toMoroccanNationalDigits(e.target.value))}
                  placeholder="612345678"
                  maxLength={9}
                  className="w-full bg-transparent px-2.5 py-2 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                البادئة +212 ثابتة — أدخل 9 أرقام فقط
              </span>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                <Instagram className="w-3.5 h-3.5 inline me-1 text-zinc-400" />
                {pickLang(lang, {
                  ar: 'حساب إنستغرام',
                  fr: 'Instagram',
                  amz: 'Instagram',
                  en: 'Instagram Handle',
                  es: 'Instagram',
                })}
              </label>
              <div
                dir="ltr"
                className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-hidden focus-within:border-amber-500"
              >
                <span className="px-2.5 py-2 bg-zinc-100 dark:bg-zinc-900 border-e border-zinc-200 dark:border-zinc-800 font-mono font-black text-zinc-600 dark:text-zinc-300 select-none">
                  @
                </span>
                <input
                  type="text"
                  value={igHandleInput}
                  onChange={(e) =>
                    setIgHandleInput(
                      e.target.value
                        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
                        .replace(/^@+/, '')
                    )
                  }
                  placeholder="@username"
                  maxLength={60}
                  className="w-full bg-transparent px-2.5 py-2 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                أدخل اسم الحساب فقط (@username) دون رابط كامل
              </span>
            </div>
          </div>
        </div>

        {/* Founder-Only Dedicated Bio Editor (Completely Removed for Staff Barbers) */}
        {sessionRole === 'master' && staticMember.isOwner && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
                <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>نبذة المؤسس (حسن أيت بومليك فقط)</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  بالعربية
                </label>
                <textarea
                  rows={2}
                  value={bioAr}
                  onChange={(e) => setBioAr(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Français
                  </label>
                  <textarea
                    rows={2}
                    value={bioFr}
                    onChange={(e) => setBioFr(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white resize-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    English
                  </label>
                  <textarea
                    rows={2}
                    value={bioEn}
                    onChange={(e) => setBioEn(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Per-Barber "No-Wait (+10 MAD)" Option Toggle — Disabled by Default */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            enableNoWaitDraft
              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
          }`}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-black text-zinc-900 dark:text-white">
              خيار «دون الحاجة للانتظار (+10 درهم)» لزبائني
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              معطّل افتراضياً. عند تفعيله وحفظ التغييرات يظهر لزبائنك خيار «دون الحاجة للانتظار (+10 MAD)» أثناء الحجز معك.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnableNoWaitDraft((p) => !p)}
          className={`min-h-[40px] px-4 py-2 rounded-xl font-black text-xs border transition-colors shrink-0 cursor-pointer ${
            enableNoWaitDraft
              ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-600 text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          {enableNoWaitDraft ? 'مفعّل لزبائني ✓ (اضغط للتعطيل)' : 'معطّل افتراضياً (اضغط للتفعيل)'}
        </button>
      </div>

      {/* Selective Per-Barber Service Prices & Durations */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                {pickLang(lang, {
                  ar: 'خدماتي وأثمنتي الشخصية (للخدمات التي أختارها لنفسي فقط)',
                  fr: 'Mes tarifs personnalisés (uniquement pour les services que je coche)',
                  amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵉⵏⵓ ⴷ ⵡⴰⵜⵉⴳⵏ ⵉⵥⵍⵉⵏ',
                  en: 'My Selective Service Prices (only for services I enable for myself)',
                  es: 'Mis precios selectivos (solo para servicios que habilite para mí)',
                })}
              </span>
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {pickLang(lang, {
                ar: 'فعّل فقط الخدمات التي تريد تخصيص ثمنها عند اختيار الزبون لك. باقي الخدمات تبقى بثمن الصالون الرسمي تلقائياً.',
                fr: 'Cochez uniquement les services à personnaliser lorsque le client vous choisit. Les autres restent au tarif du salon.',
                amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⵉⴹⵏ ⵜⵜⵖⵉⵎⴰⵏⵜ ⵙ ⵡⴰⵜⵉⴳ ⵏ ⵓⵙⴰⵍⵓⵏ.',
                en: 'Check only the services you want to price differently when a client chooses you; others keep official salon rates.',
                es: 'Marca solo los servicios que quieras personalizar cuando te elijan.',
              })}
            </p>
          </div>

          {enabledCustomCount > 0 && (
            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 ${tone.badgeClass}`}>
              {enabledCustomCount} مخصصة
            </span>
          )}
        </div>

        <div className="space-y-2">
          {visibleBaseServices.map((srv) => {
            const officialShopPrice =
              shopPricingConfig.servicePriceOverrides?.[srv.id] ?? srv.basePrice;
            const customOv = serviceOverridesDraft[srv.id];
            const isEnabled = Boolean(customOv?.enabled);
            const isHiddenByMe = hiddenServiceIdsDraft.includes(srv.id);
            const label =
              lang === 'fr'
                ? srv.name.fr
                : lang === 'en'
                ? srv.name.en
                : lang === 'es'
                ? srv.name.es
                : srv.name.ar;

            return (
              <div
                key={srv.id}
                className={`p-3 rounded-xl border transition-all grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center text-xs ${
                  isHiddenByMe
                    ? 'bg-zinc-100/80 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 opacity-65'
                    : isEnabled
                    ? 'bg-amber-50/50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40'
                    : 'bg-zinc-50/70 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="sm:col-span-6 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleBarberHiddenService(srv.id)}
                    title={isHiddenByMe ? 'إظهار الخدمة في قائمتي' : 'إخفاء الخدمة من قائمتي'}
                    className={`p-1.5 rounded-lg border shrink-0 cursor-pointer transition-colors ${
                      isHiddenByMe
                        ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isHiddenByMe ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      disabled={isHiddenByMe}
                      onChange={() =>
                        toggleBarberServiceOverride(
                          srv.id,
                          officialShopPrice,
                          srv.durationMinutes
                        )
                      }
                      className="w-4 h-4 accent-amber-600 cursor-pointer shrink-0 disabled:opacity-40"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold block truncate ${
                            isHiddenByMe
                              ? 'line-through text-zinc-500 dark:text-zinc-500'
                              : 'text-zinc-900 dark:text-white'
                          }`}
                        >
                          {label}
                        </span>
                        {isHiddenByMe && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[9px] font-black text-zinc-700 dark:text-zinc-300 shrink-0">
                            مخفية عندي
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                        ثمن الصالون الحالي: {officialShopPrice} MAD · {srv.durationMinutes} min
                      </span>
                    </div>
                  </label>
                </div>

                {isHiddenByMe ? (
                  <div className="sm:col-span-6 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleToggleBarberHiddenService(srv.id)}
                      className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                    >
                      إعادة الإظهار عند اختياري
                    </button>
                  </div>
                ) : isEnabled ? (
                  <>
                    <div className="sm:col-span-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 shrink-0">
                          ثمني:
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={customOv?.priceMAD ?? officialShopPrice}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            const parsed =
                              raw !== '' && Number.isFinite(Number(raw))
                                ? Math.max(0, Math.round(Number(raw)))
                                : 0;
                            updateBarberServiceOverrideField(srv.id, {
                              priceMAD: parsed,
                            });
                          }}
                          className="w-full bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/50 rounded-lg px-2 py-1.5 text-xs font-mono font-black tabular-nums text-zinc-900 dark:text-white"
                        />
                        <span className="text-[10px] font-bold text-zinc-400">
                          {(customOv?.priceMAD ?? officialShopPrice) === 0 ? 'هدية' : 'MAD'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateBarberServiceOverrideField(srv.id, { priceMAD: 0 })
                          }
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                            (customOv?.priceMAD ?? officialShopPrice) === 0
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/35 hover:border-emerald-400'
                          }`}
                        >
                          0 (هدية)
                        </button>
                        {getSuggestedPricesAround(officialShopPrice).filter((c) => c > 0).map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() =>
                              updateBarberServiceOverrideField(srv.id, { priceMAD: chip })
                            }
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums border cursor-pointer ${
                              (customOv?.priceMAD ?? officialShopPrice) === chip
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                            }`}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sm:col-span-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <input
                        type="number"
                        min={10}
                        max={360}
                        step={5}
                        value={customOv?.durationMinutes ?? srv.durationMinutes}
                        onChange={(e) =>
                          updateBarberServiceOverrideField(srv.id, {
                            durationMinutes: Math.max(10, Number(e.target.value) || 30),
                          })
                        }
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums text-zinc-900 dark:text-white"
                      />
                      <span className="text-[10px] text-zinc-400">m</span>
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-6 flex items-center justify-end">
                    <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                      يستخدم ثمن الصالون ({officialShopPrice} MAD)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Per-Barber Packs / Bundles Selective Override Editor */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>باقاتي وعروضي المدمجة (تُطبّق عند اختياري فقط):</span>
                {customBundlesDraft.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${tone.badgeClass}`}>
                    {customBundlesDraft.length} مخصصة
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                {pickLang(lang, {
                  ar: 'فعّل فقط الباقة التي تريد تغيير ثمنها لك شخصياً (مثلاً: حسانة + لحية بـ 35 أو 40 MAD). الباقات غير المحددة تبقى بثمن المحل الرسمي وتُطبّق فقط عند اختيارك.',
                  fr: 'Cochez uniquement les packs à personnaliser pour vos clients. Les autres suivent automatiquement le tarif du salon.',
                  amz: 'ⵙⵉⵜ ⵖⴰⵙ ⵉ ⵜⴱⴰⵇⵉⵏ ⵏⵏⴰ ⵜⵔⵉⴷ ⴰⴷ ⵜⵙⵏⴼⵍⴷ ⴰⵜⵉⴳ ⵏⵏⵙⵏⵜ.',
                  en: 'Check only the packs you want to customize for yourself; unchecked packs keep official salon rates and overrides only apply when you are selected.',
                  es: 'Marca solo los packs que quieras personalizar para ti; los demás mantienen el precio oficial del salón.',
                })}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {customBundlesDraft.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCustomBundlesDraft([])}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>باقات المحل</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowNewBundleForm((p) => !p)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>باقة خاصة بي</span>
              </button>
            </div>
          </div>

          {showNewBundleForm && (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newBundleLabel}
                  onChange={(e) => setNewBundleLabel(e.target.value)}
                  placeholder="اسم الباقة (مثال: حسانة + لحية VIP)"
                  className="sm:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-white"
                />
                <div>
                  <input
                    type="number"
                    min={0}
                    value={newBundlePrice}
                    onChange={(e) => setNewBundlePrice(e.target.value)}
                    placeholder="الثمن (MAD)"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono font-black tabular-nums text-zinc-900 dark:text-white"
                  />
                  {(() => {
                    const standaloneSum = newBundleServiceIds.reduce((sum, sid) => {
                      const shopPrice =
                        shopPricingConfig.servicePriceOverrides?.[sid] ??
                        BASE_SERVICES.find((s) => s.id === sid)?.basePrice ??
                        0;
                      return sum + shopPrice;
                    }, 0);
                    return (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getSuggestedPricesAround(
                          Math.max(10, standaloneSum > 0 ? standaloneSum - 5 : 35)
                        ).map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setNewBundlePrice(String(chip))}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums border cursor-pointer ${
                              Number(newBundlePrice) === chip
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
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
              <div className="flex flex-wrap gap-1.5">
                {visibleBaseServices
                  .filter((s) => !hiddenServiceIdsDraft.includes(s.id))
                  .map((s) => {
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
                        className={`px-2 py-1 rounded-lg border font-bold text-[11px] cursor-pointer ${
                          selected
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {s.name.ar}
                      </button>
                    );
                  })}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewBundleForm(false)}
                  className="px-3 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleAddBarberBundle}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer"
                >
                  إضافة للقائمة (ثم احفظ التغييرات)
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {displayedBundles.map((bundle) => {
              const isOverridden = customBundlesDraft.some((b) => b.id === bundle.id);
              const shopMatch = shopBundlesBaseline.find((b) => b.id === bundle.id);
              const isShopDefault = Boolean(shopMatch);
              const svcNames = bundle.serviceIds
                .map((sid) => BASE_SERVICES.find((s) => s.id === sid)?.name[lang] || BASE_SERVICES.find((s) => s.id === sid)?.name.ar || sid)
                .join(' + ');

              return (
                <div
                  key={bundle.id}
                  className={`p-3 rounded-xl border space-y-2 transition-all ${
                    bundle.active === false
                      ? 'bg-zinc-100/70 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 opacity-70'
                      : isOverridden
                      ? 'bg-amber-50/50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40'
                      : 'bg-zinc-50/80 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2 cursor-pointer select-none min-w-0 flex-1">
                      {isShopDefault && shopMatch ? (
                        <input
                          type="checkbox"
                          checked={isOverridden}
                          onChange={() => toggleBarberBundleOverride(shopMatch)}
                          className="w-4 h-4 mt-0.5 accent-amber-600 cursor-pointer shrink-0"
                        />
                      ) : (
                        <span className="px-1.5 py-0.5 mt-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-black shrink-0">
                          خاصة بي
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-zinc-900 dark:text-white truncate">
                          {bundle.labelAr}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {svcNames}
                        </div>
                      </div>
                    </label>

                    {!isShopDefault && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBarberBundle(bundle.id)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer shrink-0"
                        title="حذف الباقة الخاصة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isShopDefault && !isOverridden ? (
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-200/70 dark:border-zinc-800 text-[11px]">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        تستعمل باقة الصالون الرسمية
                      </span>
                      <span className="font-mono font-black text-zinc-700 dark:text-zinc-200">
                        {shopMatch?.bundlePriceMAD ?? bundle.bundlePriceMAD} MAD
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1.5 border-t border-amber-200/70 dark:border-zinc-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                            ثمني الخاص:
                          </span>
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
                              handleUpdateBarberBundle(bundle, {
                                bundlePriceMAD: parsed,
                              });
                            }}
                            className="w-18 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/50 rounded-lg px-2 py-1 text-center font-mono font-black tabular-nums text-zinc-900 dark:text-white"
                          />
                          <span className="text-[10px] font-bold text-zinc-400">
                            {bundle.bundlePriceMAD === 0 ? 'هدية' : 'MAD'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] font-bold text-zinc-400 me-0.5">سريع:</span>
                        {getSuggestedPricesAround(shopMatch?.bundlePriceMAD ?? bundle.bundlePriceMAD).map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() =>
                              handleUpdateBarberBundle(bundle, { bundlePriceMAD: chip })
                            }
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums border cursor-pointer ${
                              bundle.bundlePriceMAD === chip
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                            }`}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateBarberBundle(bundle, { active: !(bundle.active !== false) })
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                            bundle.active !== false
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                              : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {bundle.active !== false ? 'مفعلة' : 'موقفة'}
                        </button>
                        {isShopDefault && shopMatch && (
                          <button
                            type="button"
                            onClick={() => toggleBarberBundleOverride(shopMatch)}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 cursor-pointer"
                            title="الرجوع لثمن المحل الرسمي"
                          >
                            إلغاء التخصيص
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Optional Extra Personal Services (Not overriding other barbers) */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>خدمات إضافية خاصة بك (اختيارية):</span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end text-xs">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                اسم الخدمة (بالعربية)
              </label>
              <input
                type="text"
                value={newNameAr}
                onChange={(e) => setNewNameAr(e.target.value)}
                placeholder="مثال: عناية خاصة VIP"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                FR / EN
              </label>
              <input
                type="text"
                value={newNameFr}
                onChange={(e) => setNewNameFr(e.target.value)}
                placeholder="Soin VIP"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                الثمن (MAD)
              </label>
              <input
                type="number"
                min={0}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-mono tabular-nums text-zinc-900 dark:text-white"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {getSuggestedPricesAround(Number(newPrice) || 50).slice(0, 4).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setNewPrice(String(chip))}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums border cursor-pointer ${
                      Number(newPrice) === chip
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                المدة (دقيقة)
              </label>
              <input
                type="number"
                min={10}
                max={360}
                step={5}
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-mono tabular-nums text-zinc-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-1">
              <button
                type="button"
                onClick={handleAddExtraService}
                className="w-full min-h-[36px] px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {extraCustomServices.length > 0 && (
            <div className="space-y-2">
              {extraCustomServices.map((srv, idx) => (
                <div
                  key={srv.id}
                  className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
                >
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={srv.nameAr}
                      onChange={(e) => handleUpdateExtraService(idx, { nameAr: e.target.value })}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      value={srv.nameFr || ''}
                      onChange={(e) =>
                        handleUpdateExtraService(idx, {
                          nameFr: e.target.value,
                          nameEn: e.target.value,
                        })
                      }
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={srv.priceMAD}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const parsed =
                          raw !== '' && Number.isFinite(Number(raw))
                            ? Math.max(0, Math.round(Number(raw)))
                            : 0;
                        handleUpdateExtraService(idx, {
                          priceMAD: parsed,
                        });
                      }}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums text-zinc-900 dark:text-white"
                    />
                    <span className="text-[10px] text-zinc-400">
                      {srv.priceMAD === 0 ? 'هدية' : 'MAD'}
                    </span>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <input
                      type="number"
                      min={10}
                      max={360}
                      step={5}
                      value={srv.durationMinutes}
                      onChange={(e) =>
                        handleUpdateExtraService(idx, {
                          durationMinutes: Math.max(10, Number(e.target.value) || 30),
                        })
                      }
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums text-zinc-900 dark:text-white"
                    />
                    <span className="text-[10px] text-zinc-400">m</span>
                  </div>
                  <div className="sm:col-span-1 flex items-center justify-end gap-1.5">
                    <input
                      type="checkbox"
                      checked={srv.active}
                      onChange={(e) => handleUpdateExtraService(idx, { active: e.target.checked })}
                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExtraService(idx)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Self-Service Password / PIN Change Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
        <div className="flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
          <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>تغيير كلمة المرور الخاصة بي (PIN)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
          <div>
            <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
              كلمة المرور الحالية
            </label>
            <input
              type="password"
              dir="ltr"
              value={currentPinInput}
              onChange={(e) => setCurrentPinInput(e.target.value)}
              placeholder="••••"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              dir="ltr"
              value={newPinInput}
              onChange={(e) => setNewPinInput(e.target.value)}
              placeholder="3+ أحرف أو أرقام"
              maxLength={24}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
              تأكيد كلمة المرور
            </label>
            <input
              type="password"
              dir="ltr"
              value={confirmPinInput}
              onChange={(e) => setConfirmPinInput(e.target.value)}
              placeholder="••••"
              maxLength={24}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            disabled={pinChanging}
            onClick={handleChangeOwnPin}
            className="min-h-[38px] px-4 py-2 rounded-xl bg-zinc-900 dark:bg-amber-500 hover:bg-zinc-800 dark:hover:bg-amber-400 text-white dark:text-zinc-950 font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {pinChanging ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound className="w-3.5 h-3.5" />
            )}
            <span>تحديث الرمز</span>
          </button>
        </div>
      </div>
    </form>
  );
};
