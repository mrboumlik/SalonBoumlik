import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Coins,
  CreditCard,
  Edit3,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { BASE_SERVICES } from '../utils/pricingEngine';
import {
  addCaisseEntry,
  CAISSE_BARBERS,
  computeBarberCarryOverOwed,
  computeBarberDayStats,
  computeMonthlyCaisseRollup,
  deleteCaisseEntry,
  getCaisseBarberMeta,
  getEffectiveCommissionPercent,
  recordCaisseCreditRepayment,
  saveDailySettlement,
  updateBarberCommissionPercent,
  updateCaisseEntry,
  useCaisseEntries,
  useCaisseSettings,
  useCaisseSettlements,
} from '../utils/caisseStore';
import { CaisseBarberId, CaisseEntry } from '../types';
import { sendDualAlert } from '../utils/notifications';
import { TEAM_MEMBERS } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface AdminCaissePanelProps {
  sessionRole: 'master' | 'barber';
  ownBarberId: 'all' | 'hassan' | 'anouar-arif' | 'lahcen-lhanz' | 'mounir-querdeny';
  staffName: string;
  todayStr: string;
}

type MasterViewMode = CaisseBarberId | 'overview';

export const AdminCaissePanel: React.FC<AdminCaissePanelProps> = ({
  sessionRole,
  ownBarberId,
  staffName,
  todayStr,
}) => {
  const { lang, isRtl } = useLanguage();
  const isMaster = sessionRole === 'master';
  const defaultBarberId: CaisseBarberId =
    ownBarberId === 'all' ? 'hassan' : ownBarberId;

  const entries = useCaisseEntries();
  const settingsMap = useCaisseSettings();
  const settlementsMap = useCaisseSettlements();

  const [selectedView, setSelectedView] = useState<MasterViewMode>(
    isMaster ? 'hassan' : defaultBarberId
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7));

  // Add Income Form state (strictly PRICE-HIDDEN service selector)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [hasCreditToggle, setHasCreditToggle] = useState<boolean>(false);
  const [expectedAmountInput, setExpectedAmountInput] = useState<string>('');
  const [creditClientName, setCreditClientName] = useState<string>('');
  const [creditClientPhone, setCreditClientPhone] = useState<string>('');
  const [creditRepaymentDate, setCreditRepaymentDate] = useState<string>('');
  const [incomeNote, setIncomeNote] = useState<string>('');
  const [savingIncome, setSavingIncome] = useState<boolean>(false);

  // Add Expense / Float Form state
  const [outflowMode, setOutflowMode] = useState<'expense' | 'float_adjustment'>('expense');
  const [outflowAmount, setOutflowAmount] = useState<string>('');
  const [outflowNote, setOutflowNote] = useState<string>('');
  const [savingOutflow, setSavingOutflow] = useState<boolean>(false);

  // Master Admin Commission editor
  const [commissionDraft, setCommissionDraft] = useState<string>('');
  const [savingCommission, setSavingCommission] = useState<boolean>(false);

  // Master Admin Settlement / Reset controls
  const [collectedAmountDraft, setCollectedAmountDraft] = useState<string>('');
  const [settlementNoteDraft, setSettlementNoteDraft] = useState<string>('');
  const [savingSettlement, setSavingSettlement] = useState<boolean>(false);

  // Credit Repayment Modal state
  const [repayTarget, setRepayTarget] = useState<CaisseEntry | null>(null);
  const [repayAmountInput, setRepayAmountInput] = useState<string>('');
  const [repayDateInput, setRepayDateInput] = useState<string>(todayStr);
  const [repayNoteInput, setRepayNoteInput] = useState<string>('');
  const [savingRepay, setSavingRepay] = useState<boolean>(false);

  // Master Admin Edit Entry Modal state
  const [editTarget, setEditTarget] = useState<CaisseEntry | null>(null);
  const [editPaidInput, setEditPaidInput] = useState<string>('');
  const [editExpectedInput, setEditExpectedInput] = useState<string>('');
  const [editDateInput, setEditDateInput] = useState<string>('');
  const [editClientNameInput, setEditClientNameInput] = useState<string>('');
  const [editRepayDateInput, setEditRepayDateInput] = useState<string>('');
  const [editNoteInput, setEditNoteInput] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const effectiveBarberId: CaisseBarberId = isMaster
    ? selectedView === 'overview'
      ? 'hassan'
      : selectedView
    : defaultBarberId;

  const activeBarberMeta = getCaisseBarberMeta(effectiveBarberId);
  const activeCommission = getEffectiveCommissionPercent(effectiveBarberId, settingsMap);

  const getLocalizedBarberName = (id: CaisseBarberId | string, fallbackAr?: string, fallbackName?: string) => {
    const team = TEAM_MEMBERS.find((m) => m.id === id);
    if (team) return team.name[lang] || team.name.ar || team.name.fr;
    return lang === 'ar' ? (fallbackAr || id) : (fallbackName || fallbackAr || id);
  };
  const activeBarberLabel = getLocalizedBarberName(
    effectiveBarberId,
    activeBarberMeta.arName,
    activeBarberMeta.name
  );
  const adminShopBoxLabel = pickLang(lang, {
    ar: `صندوق الإدارة / المحل (${activeBarberLabel})`,
    fr: `Caisse Direction / Salon (${activeBarberLabel})`,
    amz: `ⴰⵙⴼⵏⵓ ⵏ ⵜⵎⵙⵙⵓⴳⵓⵔⵜ (${activeBarberLabel})`,
    en: `Admin / Shop Caisse (${activeBarberLabel})`,
    es: `Caja Admin / Salón (${activeBarberLabel})`,
  });

  const dayStats = useMemo(
    () => computeBarberDayStats(effectiveBarberId, selectedDate, entries, activeCommission),
    [effectiveBarberId, selectedDate, entries, activeCommission]
  );

  const carryOver = useMemo(
    () =>
      computeBarberCarryOverOwed(
        effectiveBarberId,
        selectedDate,
        entries,
        settingsMap,
        settlementsMap
      ),
    [effectiveBarberId, selectedDate, entries, settingsMap, settlementsMap]
  );

  const currentSettlement = settlementsMap[`${effectiveBarberId}_${selectedDate}`];

  const dayEntries = useMemo(
    () =>
      entries.filter(
        (e) => e.barberId === effectiveBarberId && e.date === selectedDate
      ),
    [entries, effectiveBarberId, selectedDate]
  );

  const openCredits = useMemo(
    () =>
      entries.filter(
        (e) =>
          e.barberId === effectiveBarberId &&
          (Number(e.creditRemainingMAD) || 0) > 0 &&
          e.creditStatus !== 'paid'
      ),
    [entries, effectiveBarberId]
  );

  const monthlyRollup = useMemo(
    () =>
      computeMonthlyCaisseRollup(
        selectedMonth,
        entries,
        settingsMap,
        settlementsMap
      ),
    [selectedMonth, entries, settingsMap, settlementsMap]
  );

  const allBarberTodayShopSummary = useMemo(() => {
    return CAISSE_BARBERS.map((barber) => {
      const pct = getEffectiveCommissionPercent(barber.id, settingsMap);
      const st = computeBarberDayStats(barber.id, selectedDate, entries, pct);
      const settlement = settlementsMap[`${barber.id}_${selectedDate}`];
      const co = computeBarberCarryOverOwed(
        barber.id,
        selectedDate,
        entries,
        settingsMap,
        settlementsMap
      );
      return {
        barber,
        stats: st,
        settlement,
        carryOver: co,
      };
    });
  }, [selectedDate, entries, settingsMap, settlementsMap]);

  const totalShopShareToday = useMemo(
    () => allBarberTodayShopSummary.reduce((acc, item) => acc + item.stats.shopShareMAD, 0),
    [allBarberTodayShopSummary]
  );

  const totalIncomeAllToday = useMemo(
    () => allBarberTodayShopSummary.reduce((acc, item) => acc + item.stats.incomeMAD, 0),
    [allBarberTodayShopSummary]
  );

  const handleToggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const paidNum = Math.max(0, Number(amountPaidInput) || 0);
  const expectedNum = hasCreditToggle
    ? Math.max(paidNum, Number(expectedAmountInput) || 0)
    : paidNum;
  const computedCreditNum = hasCreditToggle ? Math.max(0, expectedNum - paidNum) : 0;

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServiceIds.length === 0) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'اختر الخدمة أولاً',
          fr: 'Sélectionnez un service',
          amz: 'ⵙⵜⵉ ⵜⴰⵏⴰⴼⵓⵜ',
          en: 'Select a service first',
          es: 'Selecciona un servicio',
        }),
        {
          body: pickLang(lang, {
            ar: 'يرجى تحديد خدمة واحدة على الأقل من القائمة قبل تسجيل المدخول.',
            fr: 'Veuillez choisir au moins une prestation avant d’enregistrer.',
            amz: 'ⵙⵜⵉ ⵢⴰⵜ ⵜⵏⴰⴼⵓⵜ ⵖⴰⵙ ⵎⵇⵇⴰⵔ.',
            en: 'Please select at least one service before logging income.',
            es: 'Selecciona al menos un servicio antes de guardar.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }
    if (!hasCreditToggle && paidNum <= 0) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'أدخل المبلغ',
          fr: 'Entrez le montant',
          amz: 'ⵙⵙⴽⵛⵎ ⴰⵜⵉⴳ',
          en: 'Enter amount',
          es: 'Introduce el importe',
        }),
        {
          body: pickLang(lang, {
            ar: 'أدخل المبلغ الموضوع في لاكيس أو فعّل خيار الكريدي.',
            fr: 'Saisissez le montant mis en caisse ou activez le crédit.',
            amz: 'ⵙⵙⴽⵛⵎ ⵉⴷⵔⵉⵎⵏ ⵏ ⵓⵙⴼⵏⵓ ⵏⵖ ⴰⴽⵔⵉⴷⵉ.',
            en: 'Enter the amount placed in Caisse or enable Credit.',
            es: 'Introduce el importe en caja o activa Crédito.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }
    if (hasCreditToggle && computedCreditNum <= 0 && paidNum <= 0) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'تحقق من مبالغ الكريدي',
          fr: 'Vérifiez les montants du crédit',
          amz: 'ⵙⵙⴼⵇⴷ ⵉⵜⵉⴳⵏ ⵏ ⵓⴽⵔⵉⴷⵉ',
          en: 'Check credit amounts',
          es: 'Verifica los importes del crédito',
        }),
        {
          body: pickLang(lang, {
            ar: 'أدخل المبلغ الإجمالي المتوقع للخدمة والمبلغ المؤدى الآن.',
            fr: 'Saisissez le total convenu et le montant versé maintenant.',
            amz: 'ⵙⵙⴽⵛⵎ ⴰⵜⵉⴳ ⴰⵎⴰⵜⴰⵢ ⴷ ⵓⵜⵉⴳ ⵉⵜⵜⵓⴼⴽⴰⵏ.',
            en: 'Enter expected total and amount paid now.',
            es: 'Introduce el total esperado y lo pagado ahora.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }
    if (computedCreditNum > 0 && !creditClientName.trim()) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'اسم الزبون مطلوب للكريدي',
          fr: 'Nom du client requis pour le crédit',
          amz: 'ⵉⵙⵎ ⵏ ⵓⵎⵙⴰⵖ ⵉⵅⵚⵚⴰ ⵉ ⵓⴽⵔⵉⴷⵉ',
          en: 'Client name required for credit',
          es: 'Nombre requerido para el crédito',
        }),
        {
          body: pickLang(lang, {
            ar: 'عند تسجيل كريدي، يرجى إدخال اسم الزبون لمتابعة الأداء لاحقاً.',
            fr: 'Veuillez indiquer le nom du client pour suivre le remboursement.',
            amz: 'ⵙⵙⴽⵛⵎ ⵉⵙⵎ ⵏ ⵓⵎⵙⴰⵖ ⵉ ⵓⴹⴼⴰⵕ.',
            en: 'Please enter the client name to track credit repayment.',
            es: 'Indica el nombre del cliente para seguir el pago.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }

    const pickedNames = selectedServiceIds.map((id) => {
      const found = BASE_SERVICES.find((s) => s.id === id);
      return found ? found.name[lang] || found.name.ar : id;
    });

    setSavingIncome(true);
    try {
      await addCaisseEntry({
        barberId: effectiveBarberId,
        barberName: activeBarberMeta.name,
        type: 'income',
        date: selectedDate,
        serviceIds: selectedServiceIds,
        serviceNames: pickedNames,
        expectedAmountMAD: expectedNum,
        amountPaidMAD: paidNum,
        creditAmountMAD: computedCreditNum,
        creditRemainingMAD: computedCreditNum,
        creditStatus:
          computedCreditNum > 0 ? (paidNum > 0 ? 'partial' : 'open') : 'none',
        clientName: creditClientName.trim() || undefined,
        clientPhone: creditClientPhone.trim() || undefined,
        expectedRepaymentDate: creditRepaymentDate.trim() || undefined,
        note: incomeNote.trim() || undefined,
        createdByRole: sessionRole,
        createdByName: staffName,
      });

      setSelectedServiceIds([]);
      setAmountPaidInput('');
      setHasCreditToggle(false);
      setExpectedAmountInput('');
      setCreditClientName('');
      setCreditClientPhone('');
      setCreditRepaymentDate('');
      setIncomeNote('');

      sendDualAlert(
        pickLang(lang, {
          ar: 'تم تسجيل المدخول في لاكيس ✓',
          fr: 'Recette ajoutée à la Caisse ✓',
          amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⴽⵛⵓⵎ ✓',
          en: 'Income Logged to Caisse ✓',
          es: 'Ingreso guardado en Caja ✓',
        }),
        {
          body:
            computedCreditNum > 0
              ? `${paidNum} MAD + ${computedCreditNum} MAD (${creditClientName.trim()})`
              : `+${paidNum} MAD (${activeBarberLabel})`,
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to add Caisse income:', err);
      sendDualAlert(
        pickLang(lang, { ar: 'تعذر الحفظ', fr: 'Erreur de sauvegarde', amz: 'ⵓⵔ ⵉⵜⵜⵓⵃⴹⵉ', en: 'Save Failed', es: 'Error al guardar' }),
        {
          body: pickLang(lang, {
            ar: 'حدث خطأ أثناء تسجيل العملية في قاعدة البيانات.',
            fr: 'Une erreur est survenue lors de l’enregistrement.',
            amz: 'ⵉⵍⵍⴰ ⵓⵣⴳⴰⵍ ⴳ ⵓⵃⵟⵟⵓ.',
            en: 'Failed to save entry to database.',
            es: 'Error al guardar en la base de datos.',
          }),
          type: 'warning',
        }
      );
    } finally {
      setSavingIncome(false);
    }
  };

  const handleAddOutflow = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.max(0, Number(outflowAmount) || 0);
    if (amount <= 0) {
      sendDualAlert(
        pickLang(lang, { ar: 'أدخل المبلغ', fr: 'Entrez le montant', amz: 'ⵙⵙⴽⵛⵎ ⴰⵜⵉⴳ', en: 'Enter amount', es: 'Introduce el importe' }),
        {
          body: pickLang(lang, {
            ar: 'يرجى إدخال مبلغ صحيح أكبر من 0 درهم.',
            fr: 'Veuillez saisir un montant supérieur à 0 MAD.',
            amz: 'ⵙⵙⴽⵛⵎ ⴰⵜⵉⴳ ⵢⵓⴳⴰⵔⵏ 0.',
            en: 'Please enter a valid amount greater than 0 MAD.',
            es: 'Introduce un importe válido mayor a 0 MAD.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }

    const effectiveMode: 'expense' | 'float_adjustment' =
      isMaster && effectiveBarberId === 'hassan' ? outflowMode : 'expense';

    setSavingOutflow(true);
    try {
      await addCaisseEntry({
        barberId: effectiveBarberId,
        barberName: activeBarberMeta.name,
        type: effectiveMode,
        date: selectedDate,
        expectedAmountMAD: amount,
        amountPaidMAD: amount,
        creditAmountMAD: 0,
        creditRemainingMAD: 0,
        creditStatus: 'none',
        note:
          outflowNote.trim() ||
          (effectiveMode === 'float_adjustment'
            ? pickLang(lang, {
                ar: 'فلوس الصرف (Float)',
                fr: 'Fond de caisse (Monnaie)',
                amz: 'ⵉⴷⵔⵉⵎⵏ ⵏ ⵓⵙⵏⴼⵍ (Float)',
                en: 'Starting Change / Float',
                es: 'Fondo de caja (Cambio)',
              })
            : pickLang(lang, {
                ar: 'مصروف يومي',
                fr: 'Dépense quotidienne',
                amz: 'ⴰⵙⵙⵓⴼⵖ ⵏ ⵡⴰⵙⵙ',
                en: 'Daily Expense',
                es: 'Gasto diario',
              })),
        createdByRole: sessionRole,
        createdByName: staffName,
      });

      setOutflowAmount('');
      setOutflowNote('');
      sendDualAlert(
        effectiveMode === 'float_adjustment'
          ? pickLang(lang, {
              ar: 'تم تسجيل فلوس الصرف ✓',
              fr: 'Fond de caisse enregistré ✓',
              amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵙⵏⴼⵍ ✓',
              en: 'Float Logged ✓',
              es: 'Fondo guardado ✓',
            })
          : pickLang(lang, {
              ar: 'تم تسجيل المصروف ✓',
              fr: 'Dépense enregistrée ✓',
              amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵙⵙⵓⴼⵖ ✓',
              en: 'Expense Logged ✓',
              es: 'Gasto guardado ✓',
            }),
        {
          body: `${amount} MAD (${activeBarberLabel})`,
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to add outflow entry:', err);
      sendDualAlert(
        pickLang(lang, { ar: 'خطأ في التسجيل', fr: 'Erreur', amz: 'ⴰⵣⴳⴰⵍ', en: 'Save Error', es: 'Error' }),
        {
          body: pickLang(lang, {
            ar: 'تعذر حفظ العملية في لاكيس.',
            fr: 'Impossible d’enregistrer dans la Caisse.',
            amz: 'ⵓⵔ ⵉⵜⵜⵓⵃⴹⵉ ⴳ ⵓⵙⴼⵏⵓ.',
            en: 'Could not save to Caisse.',
            es: 'No se pudo guardar en Caja.',
          }),
          type: 'warning',
        }
      );
    } finally {
      setSavingOutflow(false);
    }
  };

  const handleSaveCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaster) return;
    const rawPct = Number(commissionDraft);
    if (!Number.isFinite(rawPct) || rawPct < 0 || rawPct > 100) {
      sendDualAlert(
        pickLang(lang, { ar: 'نسبة غير صالحة', fr: 'Pourcentage invalide', amz: 'ⵜⵉⴳⵎⵉⴹⵉ ⵓⵔ ⵜⵥⵉⵍ', en: 'Invalid %', es: 'Porcentaje inválido' }),
        {
          body: pickLang(lang, {
            ar: 'أدخل نسبة مئوية بين 0 و 100.',
            fr: 'Entrez un pourcentage entre 0 et 100.',
            amz: 'ⵙⵙⴽⵛⵎ ⴳⵔ 0 ⴷ 100.',
            en: 'Enter a percentage between 0 and 100.',
            es: 'Introduce un porcentaje entre 0 y 100.',
          }),
          type: 'warning',
          skipSound: true,
        }
      );
      return;
    }

    setSavingCommission(true);
    try {
      await updateBarberCommissionPercent(effectiveBarberId, rawPct, staffName);
      setCommissionDraft('');
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم تحديث نسبة الحلاق ✓',
          fr: 'Pourcentage mis à jour ✓',
          amz: 'ⵜⴻⵜⵜⵓⵙⵎⴰⵢⵏⵓ ⵜⴳⵎⵉⴹⵉ ✓',
          en: 'Commission Updated ✓',
          es: 'Comisión actualizada ✓',
        }),
        {
          body: `${activeBarberLabel}: ${Math.round(rawPct)}%`,
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to update commission %:', err);
    } finally {
      setSavingCommission(false);
    }
  };

  const handleSettlementAction = async (collected: boolean, isReset = false) => {
    if (!isMaster) return;
    const defaultAmt = dayStats.barberNetShareMAD;
    const amt =
      collectedAmountDraft.trim() !== ''
        ? Math.max(0, Number(collectedAmountDraft) || 0)
        : collected
        ? defaultAmt
        : 0;

    setSavingSettlement(true);
    try {
      await saveDailySettlement({
        barberId: effectiveBarberId,
        barberName: activeBarberMeta.name,
        date: selectedDate,
        collected,
        collectedAmountMAD: collected ? amt : 0,
        barberShareMAD: dayStats.barberNetShareMAD,
        shopShareMAD: dayStats.shopShareMAD,
        floatMAD: dayStats.floatMAD,
        expensesMAD: dayStats.expensesMAD,
        carryOverOwedMAD: carryOver.carryOverOwedMAD,
        resetCount: (currentSettlement?.resetCount || 0) + (isReset ? 1 : 0),
        note: settlementNoteDraft.trim() || currentSettlement?.note,
        confirmedBy: staffName,
      });
      setCollectedAmountDraft('');
      setSettlementNoteDraft('');
      sendDualAlert(
        isReset
          ? pickLang(lang, {
              ar: 'تمت إعادة الحساب وتصفير حالة اليوم ✓',
              fr: 'Recalcul et réinitialisation effectués ✓',
              amz: 'ⵉⵜⵜⵓⵙⵎⴰⵢⵏⵓ ⵓⵙⵉⴹⵏ ✓',
              en: 'Day Recalculated & Reset ✓',
              es: 'Día recalculado y reiniciado ✓',
            })
          : collected
          ? pickLang(lang, {
              ar: 'تم تأكيد جمع لاكيس اليوم ✓',
              fr: 'Caisse du jour marquée comme collectée ✓',
              amz: 'ⵉⵜⵜⵓⵙⴷⵓ ⵓⵙⵎⵓⵏ ⵏ ⵓⵙⴼⵏⵓ ✓',
              en: 'Day Caisse Marked Collected ✓',
              es: 'Caja del día cobrada ✓',
            })
          : pickLang(lang, {
              ar: 'تم تسجيل لاكيس كغير مجموع (ترحيل كايتسالو)',
              fr: 'Marqué non collecté (reporté en impayé)',
              amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵔ ⵉⵙⵎⵓⵏ',
              en: 'Marked Uncollected (Carried Over)',
              es: 'Marcado como pendiente (acumulado)',
            }),
        {
          body: `${activeBarberLabel} (${selectedDate})`,
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to save settlement:', err);
    } finally {
      setSavingSettlement(false);
    }
  };

  const openRepayModal = (entry: CaisseEntry) => {
    setRepayTarget(entry);
    setRepayAmountInput(String(entry.creditRemainingMAD || 0));
    setRepayDateInput(selectedDate);
    setRepayNoteInput('');
  };

  const handleConfirmRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayTarget) return;
    const amt = Number(repayAmountInput) || 0;
    if (amt <= 0) return;

    setSavingRepay(true);
    try {
      await recordCaisseCreditRepayment({
        creditEntry: repayTarget,
        amountRepaidMAD: amt,
        repaidDate: repayDateInput || selectedDate,
        actorRole: sessionRole,
        actorName: staffName,
        note: repayNoteInput.trim() || undefined,
      });
      setRepayTarget(null);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم تسجيل أداء الكريدي ✓',
          fr: 'Remboursement de crédit enregistré ✓',
          amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⴼⵔⵓ ⵏ ⵓⴽⵔⵉⴷⵉ ✓',
          en: 'Credit Repayment Recorded ✓',
          es: 'Pago de crédito registrado ✓',
        }),
        {
          body: `+${amt} MAD (${repayDateInput || selectedDate})`,
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err: any) {
      sendDualAlert(
        pickLang(lang, { ar: 'تعذر تسجيل الأداء', fr: 'Échec', amz: 'ⴰⵣⴳⴰⵍ', en: 'Failed', es: 'Error' }),
        {
          body: err?.message || 'Error',
          type: 'warning',
        }
      );
    } finally {
      setSavingRepay(false);
    }
  };

  const openEditModal = (entry: CaisseEntry) => {
    if (!isMaster) return;
    setEditTarget(entry);
    setEditPaidInput(String(entry.amountPaidMAD));
    setEditExpectedInput(String(entry.expectedAmountMAD));
    setEditDateInput(entry.date);
    setEditClientNameInput(entry.clientName || '');
    setEditRepayDateInput(entry.expectedRepaymentDate || '');
    setEditNoteInput(entry.note || '');
  };

  const handleSaveEntryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !isMaster) return;

    const paid = Math.max(0, Number(editPaidInput) || 0);
    const expected =
      editTarget.type === 'income'
        ? Math.max(paid, Number(editExpectedInput) || paid)
        : paid;
    const creditTotal = editTarget.type === 'income' ? Math.max(0, expected - paid) : 0;
    const alreadyRepaid = Number(editTarget.repaidAmountMAD) || 0;
    const nextRemaining = Math.max(0, creditTotal - alreadyRepaid);

    setSavingEdit(true);
    try {
      await updateCaisseEntry(editTarget.id, {
        date: editDateInput || editTarget.date,
        amountPaidMAD: paid,
        expectedAmountMAD: expected,
        creditAmountMAD: creditTotal,
        creditRemainingMAD: nextRemaining,
        creditStatus:
          creditTotal > 0
            ? nextRemaining <= 0
              ? 'paid'
              : alreadyRepaid > 0 || paid > 0
              ? 'partial'
              : 'open'
            : 'none',
        clientName: editClientNameInput,
        expectedRepaymentDate: editRepayDateInput,
        note: editNoteInput,
      });
      setEditTarget(null);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم تعديل العملية بنجاح ✓',
          fr: 'Opération modifiée ✓',
          amz: 'ⵜⴻⵜⵜⵓⵙⵏⴼⵍ ⵜⵎⵀⵍⵜ ✓',
          en: 'Entry Updated ✓',
          es: 'Operación actualizada ✓',
        }),
        {
          body: pickLang(lang, {
            ar: 'تم تحديث السجل وإعادة احتساب مجاميع لاكيس تلقائياً.',
            fr: 'Totaux de caisse recalculés automatiquement.',
            amz: 'ⵜⵜⵓⵙⵎⴰⵢⵏⵓⵏ ⵉⵙⵉⴹⴰⵏ ⵏ ⵓⵙⴼⵏⵓ.',
            en: 'Caisse totals recalculated automatically.',
            es: 'Totales de caja recalculados automáticamente.',
          }),
          type: 'success',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to update entry:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteEntry = async (entry: CaisseEntry) => {
    if (!isMaster) return;
    try {
      await deleteCaisseEntry(entry.id);
      sendDualAlert(
        pickLang(lang, {
          ar: 'تم حذف السجل',
          fr: 'Entrée supprimée',
          amz: 'ⵉⵜⵜⵓⴽⴽⵙ ⵓⵣⵎⵎⴻⵎ',
          en: 'Entry Deleted',
          es: 'Registro eliminado',
        }),
        {
          body: pickLang(lang, {
            ar: 'تم حذف العملية من لاكيس.',
            fr: 'Opération supprimée de la caisse.',
            amz: 'ⵜⴻⵜⵜⵓⴽⴽⵙ ⵙⴳ ⵓⵙⴼⵏⵓ.',
            en: 'Entry removed from Caisse.',
            es: 'Operación eliminada de la caja.',
          }),
          type: 'info',
          skipSound: true,
        }
      );
    } catch (err) {
      console.error('Failed to delete caisse entry:', err);
    }
  };

  const getPeriodLabel = (periodIndex: number, fallbackAr: string) => {
    if (lang === 'ar') return fallbackAr;
    if (periodIndex === 1) {
      return pickLang(lang, {
        ar: fallbackAr,
        fr: '1ère Décade (Jours 1–10)',
        amz: 'ⵜⴰⵙⵓⵜ 1 (1–10)',
        en: '1st 10-Day Period (Days 1–10)',
        es: '1ª Decena (Días 1–10)',
      });
    }
    if (periodIndex === 2) {
      return pickLang(lang, {
        ar: fallbackAr,
        fr: '2ème Décade (Jours 11–20)',
        amz: 'ⵜⴰⵙⵓⵜ 2 (11–20)',
        en: '2nd 10-Day Period (Days 11–20)',
        es: '2ª Decena (Días 11–20)',
      });
    }
    return pickLang(lang, {
      ar: fallbackAr,
      fr: '3ème Décade (Jours 21–Fin)',
      amz: 'ⵜⴰⵙⵓⵜ 3 (21–ⵜⵉⴳⵉⵔⴰ)',
      en: '3rd Period (Days 21–End)',
      es: '3ª Decena (Días 21–Fin)',
    });
  };

  const ui = {
    title: pickLang(lang, {
      ar: 'صندوق لاكيس والحسابات',
      fr: 'Caisse & Comptabilité',
      amz: 'ⴰⵙⴼⵏⵓ (Caisse) ⴷ ⵓⵙⵉⴹⵏ',
      en: 'Caisse & Accounting',
      es: 'Caja y Contabilidad',
    }),
    masterTag: pickLang(lang, { ar: 'المدير العام', fr: 'Direction', amz: 'ⴰⵏⵎⵀⴰⵍ', en: 'Master Admin', es: 'Admin General' }),
    bonusActive: (pct: number, extra: number) =>
      pickLang(lang, {
        ar: `نسبة مفعّلة: ${pct}% (+${extra}% إضافية)`,
        fr: `Taux actif : ${pct}% (+${extra}% bonus)`,
        amz: `ⵜⵉⴳⵎⵉⴹⵉ: ${pct}% (+${extra}%)`,
        en: `Active rate: ${pct}% (+${extra}% bonus)`,
        es: `Tasa activa: ${pct}% (+${extra}% extra)`,
      }),
    subtitle: pickLang(lang, {
      ar: 'قسم محاسبي مستقل ومعزول لتسجيل المداخيل، المصاريف، الكريدي وتصفية حسابات المحل والحلاقين.',
      fr: 'Module comptable isolé : recettes, dépenses, crédits clients et règlement des parts.',
      amz: 'ⴰⴳⵣⵣⵓⵎ ⵏ ⵓⵙⵉⴹⵏ: ⵉⴽⵛⵓⵎⵏ, ⵉⵙⵙⵓⴼⵖⵏ, ⴰⴽⵔⵉⴷⵉ ⴷ ⵓⴼⵔⵓ ⵏ ⵉⵎⴽⵔⴰⴹⵏ.',
      en: 'Isolated accounting system for logging income, expenses, credits, and daily barber/shop settlements.',
      es: 'Módulo contable aislado para ingresos, gastos, créditos y liquidación diaria.',
    }),
    dateLbl: pickLang(lang, { ar: 'تاريخ اليوم:', fr: 'Date :', amz: 'ⴰⵣⵎⵣ:', en: 'Date:', es: 'Fecha:' }),
    todayBtn: pickLang(lang, { ar: `اليوم (${todayStr})`, fr: `Aujourd’hui (${todayStr})`, amz: `ⴰⵙⵙ ⴰ (${todayStr})`, en: `Today (${todayStr})`, es: `Hoy (${todayStr})` }),
    overviewBtn: pickLang(lang, {
      ar: 'حصة المحل والملخص العشري والشهري',
      fr: 'Part Salon & Bilan Décadaire / Mensuel',
      amz: 'ⵜⴰⴼⵓⵍⵜ ⵏ ⵓⵙⴰⵍⵓⵏ ⴷ ⵓⵙⴳⵣⵍ',
      en: 'Shop Share, 10-Day & Monthly Rollup',
      es: 'Parte del Salón y Balance Mensual',
    }),
    dailyShopTitle: pickLang(lang, {
      ar: `حساب كل نهار لي ديال المحل (${selectedDate})`,
      fr: `Part quotidienne du Salon (${selectedDate})`,
      amz: `ⴰⵙⵉⴹⵏ ⵏ ⵓⵙⴰⵍⵓⵏ (${selectedDate})`,
      en: `Daily Shop Share Breakdown (${selectedDate})`,
      es: `Parte diaria del Salón (${selectedDate})`,
    }),
    dailyShopSub: pickLang(lang, {
      ar: 'ملخص المداخيل وحصة المحل الصافية لكل حلاق في التاريخ المحدد.',
      fr: 'Recettes et part nette du salon par barbier pour la date sélectionnée.',
      amz: 'ⵉⴽⵛⵓⵎⵏ ⴷ ⵜⴼⵓⵍⵜ ⵏ ⵓⵙⴰⵍⵓⵏ ⵉ ⴽⵓ ⴰⵎⴽⵔⴰⴹ.',
      en: 'Income and net shop share per barber for the selected date.',
      es: 'Ingresos y parte neta del salón por barbero en esta fecha.',
    }),
    totalBoxesToday: pickLang(lang, { ar: 'مجموع مداخيل الصناديق: ', fr: 'Total caisses : ', amz: 'ⴰⵎⵓⵜⵜⵉ ⵏ ⵉⵙⴼⵏⴰ: ', en: 'Total Caisses Income: ', es: 'Total cajas: ' }),
    totalShopToday: pickLang(lang, { ar: 'مجموع حصة المحل اليوم: ', fr: 'Total part salon : ', amz: 'ⵜⴰⴼⵓⵍⵜ ⵏ ⵓⵙⴰⵍⵓⵏ: ', en: 'Total Shop Share Today: ', es: 'Total parte salón: ' }),
    incomeLbl: pickLang(lang, { ar: 'المدخول', fr: 'Recette', amz: 'ⴰⴽⵛⵓⵎ', en: 'Income', es: 'Ingreso' }),
    shopShareLbl: pickLang(lang, { ar: 'حصة المحل', fr: 'Part Salon', amz: 'ⵜⴰⴼⵓⵍⵜ ⵏ ⵓⵙⴰⵍⵓⵏ', en: 'Shop Share', es: 'Parte Salón' }),
    barberNetLbl: pickLang(lang, { ar: 'صافي الحلاق', fr: 'Net Barbier', amz: 'ⴰⵏⵓⵎ ⵏ ⵓⵎⴽⵔⴰⴹ', en: 'Barber Net', es: 'Neto Barbero' }),
    collectStatusLbl: pickLang(lang, { ar: 'جمع لاكيس', fr: 'Collecte', amz: 'ⴰⵙⵎⵓⵏ', en: 'Collection', es: 'Cobro' }),
    collectedYes: pickLang(lang, { ar: 'تم الجمع ✓', fr: 'Collectée ✓', amz: 'ⵉⵙⵎⵓⵏ ✓', en: 'Collected ✓', es: 'Cobrada ✓' }),
    collectedNo: pickLang(lang, { ar: 'غير مجموع', fr: 'Non collectée', amz: 'ⵓⵔ ⵉⵙⵎⵓⵏ', en: 'Uncollected', es: 'Pendiente' }),
    carryOverTag: (amt: number) =>
      pickLang(lang, {
        ar: `كايتسالو متراكم: ${amt} MAD`,
        fr: `Solde reporté dû : ${amt} MAD`,
        amz: `ⴰⵎⴰⵔⵓⵙ ⵉⵜⵜⵓⵙⵎⵓⵏⵏ: ${amt} MAD`,
        en: `Carry-over owed: ${amt} MAD`,
        es: `Acumulado pendiente: ${amt} MAD`,
      }),
    rollupTitle: pickLang(lang, {
      ar: `التقسيم العشري والحصيلة الشهرية (${selectedMonth})`,
      fr: `Bilan Décadaire (10 jours) & Mensuel (${selectedMonth})`,
      amz: `ⴰⵙⵉⴹⵏ ⵏ 10 ⵓⵙⵙⴰⵏ ⴷ ⵡⴰⵢⵢⵓⵔ (${selectedMonth})`,
      en: `10-Day Period Breakdown & Monthly Summary (${selectedMonth})`,
      es: `Balance por Decenas y Mensual (${selectedMonth})`,
    }),
    rollupSub: pickLang(lang, {
      ar: 'مجموع كل 10 أيام (1–10، 11–20، 21–نهاية الشهر) والمجموع النهائي للشهر.',
      fr: 'Total par tranche de 10 jours (1–10, 11–20, 21–fin) et cumul mensuel.',
      amz: 'ⴰⵎⵓⵜⵜⵉ ⵏ ⴽⵓ 10 ⵓⵙⵙⴰⵏ (1–10, 11–20, 21–ⵜⵉⴳⵉⵔⴰ).',
      en: 'Totals per 10-day period (1–10, 11–20, 21–end) and final monthly grand total.',
      es: 'Totales cada 10 días (1–10, 11–20, 21–fin) y gran total mensual.',
    }),
    monthLbl: pickLang(lang, { ar: 'الشهر:', fr: 'Mois :', amz: 'ⴰⵢⵢⵓⵔ:', en: 'Month:', es: 'Mes:' }),
    periodTotalIncome: pickLang(lang, { ar: 'إجمالي المداخيل:', fr: 'Total recettes :', amz: 'ⵉⴽⵛⵓⵎⵏ:', en: 'Total Income:', es: 'Total ingresos:' }),
    periodBarbersShare: pickLang(lang, { ar: 'حصة الحلاقين:', fr: 'Part barbiers :', amz: 'ⵜⴰⴼⵓⵍⵜ ⵏ ⵉⵎⴽⵔⴰⴹⵏ:', en: 'Barbers Share:', es: 'Parte barberos:' }),
    periodShopShare: pickLang(lang, { ar: 'حصة المحل:', fr: 'Part salon :', amz: 'ⵜⴰⴼⵓⵍⵜ ⵏ ⵓⵙⴰⵍⵓⵏ:', en: 'Shop Share:', es: 'Parte salón:' }),
    periodExpCred: pickLang(lang, { ar: 'المصاريف / الكريدي:', fr: 'Dépenses / Crédits :', amz: 'ⵉⵙⵙⵓⴼⵖⵏ / ⴰⴽⵔⵉⴷⵉ:', en: 'Expenses / Credits:', es: 'Gastos / Créditos:' }),
    tblBarber: pickLang(lang, { ar: 'الحلاق', fr: 'Barbier', amz: 'ⴰⵎⴽⵔⴰⴹ', en: 'Barber', es: 'Barbero' }),
    tblPct: pickLang(lang, { ar: 'النسبة %', fr: 'Taux %', amz: 'ⵜⵉⴳⵎⵉⴹⵉ %', en: 'Rate %', es: 'Tasa %' }),
    tblMonthIncome: pickLang(lang, { ar: 'مدخول الشهر', fr: 'Recette mois', amz: 'ⴰⴽⵛⵓⵎ ⵏ ⵡⴰⵢⵢⵓⵔ', en: 'Month Income', es: 'Ingreso mes' }),
    tblExpense: pickLang(lang, { ar: 'المصروف', fr: 'Dépenses', amz: 'ⴰⵙⵙⵓⴼⵖ', en: 'Expenses', es: 'Gastos' }),
    tblBarberNet: pickLang(lang, { ar: 'صافي الحلاق', fr: 'Net Barbier', amz: 'ⴰⵏⵓⵎ ⵏ ⵓⵎⴽⵔⴰⴹ', en: 'Barber Net', es: 'Neto Barbero' }),
    tblShopShare: pickLang(lang, { ar: 'حصة المحل', fr: 'Part Salon', amz: 'ⵜⴰⴼⵓⵍⵜ ⵏ ⵓⵙⴰⵍⵓⵏ', en: 'Shop Share', es: 'Parte Salón' }),
    tblUncollected: pickLang(lang, { ar: 'غير مجموع (كايتسالو)', fr: 'Non collecté (Report)', amz: 'ⵓⵔ ⵉⵙⵎⵓⵏ', en: 'Uncollected (Carry-Over)', es: 'Pendiente' }),
    tblOpenCredits: pickLang(lang, { ar: 'كريدي مفتوح', fr: 'Crédits ouverts', amz: 'ⴰⴽⵔⵉⴷⵉ ⵉⵕⵥⵎⵏ', en: 'Open Credits', es: 'Créditos abiertos' }),
    tblGrandTotal: pickLang(lang, { ar: 'المجموع العام لنهاية الشهر', fr: 'Total Général Fin de Mois', amz: 'ⴰⵎⵓⵜⵜⵉ ⴰⵎⴰⵜⴰⵢ', en: 'Month-End Grand Total', es: 'Total General del Mes' }),
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="mt-2 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-zinc-950 to-amber-950/20 p-4 sm:p-5 space-y-5 shadow-xl"
    >
      {/* Distinct Caisse Header Sticker & Date Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-emerald-500/25">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-black flex items-center justify-center shadow-lg shadow-emerald-900/40 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white">
                {ui.title}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-black tracking-wide">
                CAISSE • {isMaster ? ui.masterTag : activeBarberLabel}
              </span>
              {activeCommission > 50 && selectedView !== 'overview' && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-black flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>
                    {ui.bonusActive(activeCommission, activeCommission - 50)}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">{ui.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-black/60 border border-zinc-800 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] text-zinc-400">{ui.dateLbl}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setSelectedMonth(e.target.value.slice(0, 7));
                }
              }}
              className="bg-transparent text-xs font-mono font-bold text-white outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedDate(todayStr);
              setSelectedMonth(todayStr.slice(0, 7));
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 cursor-pointer"
          >
            {ui.todayBtn}
          </button>
        </div>
      </div>

      {/* Master Admin Multi-Barber + Monthly Overview Switcher */}
      {isMaster && (
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-zinc-800/80">
          {CAISSE_BARBERS.map((barber) => {
            const pct = getEffectiveCommissionPercent(barber.id, settingsMap);
            const st = computeBarberDayStats(barber.id, selectedDate, entries, pct);
            const isSelected = selectedView === barber.id;
            const bLabel = getLocalizedBarberName(barber.id, barber.arName, barber.name);
            return (
              <button
                key={barber.id}
                type="button"
                onClick={() => setSelectedView(barber.id)}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-md'
                    : 'bg-zinc-900/90 text-zinc-200 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isSelected ? '#000000' : barber.color }}
                />
                <span>
                  {barber.id === 'hassan' ? adminShopBoxLabel : bLabel}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] tabular-nums ${
                    isSelected ? 'bg-black/20 text-black font-black' : 'bg-black/60 text-emerald-300'
                  }`}
                >
                  {st.incomeMAD} DH
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedView('overview')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ms-auto ${
              selectedView === 'overview'
                ? 'bg-amber-500 text-black border-amber-400 shadow-md'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500/20'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>{ui.overviewBtn}</span>
          </button>
        </div>
      )}

      {/* ==================== MASTER OVERVIEW TAB ==================== */}
      {isMaster && selectedView === 'overview' ? (
        <div className="space-y-5">
          {/* Today's Shop Share Across All Barbers */}
          <div className="p-4 rounded-2xl bg-black/50 border border-amber-500/30 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-2">
                  <Banknote className="w-5 h-5" />
                  <span>{ui.dailyShopTitle}</span>
                </h4>
                <p className="text-xs text-zinc-400">{ui.dailyShopSub}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
                  <span className="text-zinc-400">{ui.totalBoxesToday}</span>
                  <span className="font-mono font-black text-white tabular-nums">
                    {totalIncomeAllToday.toLocaleString('en-US')} MAD
                  </span>
                </div>
                <div className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs">
                  <span className="text-amber-300 font-bold">{ui.totalShopToday}</span>
                  <span className="font-mono font-black text-amber-200 text-sm tabular-nums">
                    {totalShopShareToday.toLocaleString('en-US')} MAD
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {allBarberTodayShopSummary.map(({ barber, stats, settlement, carryOver: co }) => (
                <div
                  key={barber.id}
                  onClick={() => setSelectedView(barber.id)}
                  className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-emerald-500/40 transition-colors cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: barber.color }}
                      />
                      <span>{getLocalizedBarberName(barber.id, barber.arName, barber.name)}</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                      {stats.commissionPercent}%
                      {stats.extraPercentAbove50 > 0 && (
                        <span className="text-amber-300 font-bold"> (+{stats.extraPercentAbove50}%)</span>
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-800">
                    <div>
                      <div className="text-zinc-500">{ui.incomeLbl}</div>
                      <div className="font-mono font-bold text-white tabular-nums">{stats.incomeMAD} DH</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">{ui.shopShareLbl}</div>
                      <div className="font-mono font-black text-amber-300 tabular-nums">{stats.shopShareMAD} DH</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">{ui.barberNetLbl}</div>
                      <div className="font-mono font-bold text-emerald-300 tabular-nums">{stats.barberNetShareMAD} DH</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">{ui.collectStatusLbl}</div>
                      <div className="font-bold text-[10px]">
                        {settlement?.collected ? (
                          <span className="text-emerald-400">{ui.collectedYes}</span>
                        ) : (
                          <span className="text-zinc-400">{ui.collectedNo}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {co.carryOverOwedMAD > 0 && (
                    <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1 font-bold">
                      {ui.carryOverTag(co.carryOverOwedMAD)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Month Picker + 10-Day Period Breakdown */}
          <div className="p-4 rounded-2xl bg-black/50 border border-zinc-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-emerald-400" />
                  <span>{ui.rollupTitle}</span>
                </h4>
                <p className="text-xs text-zinc-400">{ui.rollupSub}</p>
              </div>
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5">
                <span className="text-xs text-zinc-400">{ui.monthLbl}</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-mono font-bold text-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {monthlyRollup.periods.map((p) => (
                <div
                  key={p.periodIndex}
                  className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="font-black text-xs text-emerald-300">
                      {getPeriodLabel(p.periodIndex, p.labelAr)}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">{p.rangeLabel}</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{ui.periodTotalIncome}</span>
                      <span className="font-mono font-bold text-white tabular-nums">{p.incomeMAD.toLocaleString('en-US')} MAD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{ui.periodBarbersShare}</span>
                      <span className="font-mono font-bold text-emerald-300 tabular-nums">{p.barberSharesMAD.toLocaleString('en-US')} MAD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{ui.periodShopShare}</span>
                      <span className="font-mono font-black text-amber-300 tabular-nums">{p.shopShareMAD.toLocaleString('en-US')} MAD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{ui.periodExpCred}</span>
                      <span className="font-mono text-zinc-300 tabular-nums">
                        {p.expensesMAD} / {p.creditsIssuedMAD} MAD
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Per-Barber Monthly Breakdown */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2.5 px-3">{ui.tblBarber}</th>
                    <th className="py-2.5 px-3">{ui.tblPct}</th>
                    <th className="py-2.5 px-3">{ui.tblMonthIncome}</th>
                    <th className="py-2.5 px-3">{ui.tblExpense}</th>
                    <th className="py-2.5 px-3">{ui.tblBarberNet}</th>
                    <th className="py-2.5 px-3">{ui.tblShopShare}</th>
                    <th className="py-2.5 px-3">{ui.tblUncollected}</th>
                    <th className="py-2.5 px-3">{ui.tblOpenCredits}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {monthlyRollup.byBarber.map((row) => (
                    <tr key={row.barberId} className="hover:bg-zinc-900/60">
                      <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        <span>{getLocalizedBarberName(row.barberId, row.arName, row.barberName)}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-200 tabular-nums">
                        {row.commissionPercent}%
                        {row.extraPercentAbove50 > 0 && (
                          <span className="ms-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                            +{row.extraPercentAbove50}%
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-white tabular-nums">
                        {row.incomeMAD.toLocaleString('en-US')} DH
                      </td>
                      <td className="py-2.5 px-3 font-mono text-red-300 tabular-nums">
                        {row.expensesMAD.toLocaleString('en-US')} DH
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-300 tabular-nums">
                        {row.barberNetShareMAD.toLocaleString('en-US')} DH
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-amber-300 tabular-nums">
                        {row.shopShareMAD.toLocaleString('en-US')} DH
                      </td>
                      <td className="py-2.5 px-3 font-mono text-orange-300 tabular-nums">
                        {row.uncollectedOwedMAD.toLocaleString('en-US')} DH
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-300 tabular-nums">
                        {row.openCreditsMAD.toLocaleString('en-US')} DH
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-emerald-500/40 bg-emerald-950/20 font-black">
                    <td className="py-3 px-3 text-white">{ui.tblGrandTotal}</td>
                    <td className="py-3 px-3">—</td>
                    <td className="py-3 px-3 font-mono text-white tabular-nums">
                      {monthlyRollup.grandTotalIncomeMAD.toLocaleString('en-US')} DH
                    </td>
                    <td className="py-3 px-3 font-mono text-red-300 tabular-nums">
                      {monthlyRollup.grandTotalExpensesMAD.toLocaleString('en-US')} DH
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-300 tabular-nums">
                      {monthlyRollup.grandTotalBarberSharesMAD.toLocaleString('en-US')} DH
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-300 text-sm tabular-nums">
                      {monthlyRollup.grandTotalShopShareMAD.toLocaleString('en-US')} DH
                    </td>
                    <td className="py-3 px-3">—</td>
                    <td className="py-3 px-3 font-mono text-orange-300 tabular-nums">
                      {monthlyRollup.grandTotalOpenCreditsMAD.toLocaleString('en-US')} DH
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== INDIVIDUAL BARBER / HASSAN CAISSE VIEW ==================== */
        <div className="space-y-5">
          {/* Carry-Over Owed Banner */}
          {carryOver.carryOverOwedMAD > 0 && (
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                carryOver.isMonthEndWarning
                  ? 'bg-red-950/50 border-red-500/60 text-red-100'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-sm">
                    {pickLang(lang, {
                      ar: 'رصيد مرحّل غير مجموع (كايتسالو):',
                      fr: 'Solde reporté non collecté :',
                      amz: 'ⴰⵎⴰⵔⵓⵙ ⵓⵔ ⵉⵙⵎⵓⵏ:',
                      en: 'Uncollected Carry-Over Balance:',
                      es: 'Saldo acumulado pendiente:',
                    })}{' '}
                    <span className="font-mono text-amber-300 tabular-nums">
                      {carryOver.carryOverOwedMAD.toLocaleString('en-US')} MAD
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-300 mt-0.5">
                    {pickLang(lang, {
                      ar: 'أيام سابقة لم يتم تأكيد جمع لاكيس لها هذا الشهر:',
                      fr: 'Jours précédents non encore marqués comme collectés ce mois-ci :',
                      amz: 'ⵓⵙⵙⴰⵏ ⵉⵣⵔⵉⵏ ⵓⵔ ⵉⵜⵜⵓⵙⵎⵓⵏⵏ ⴰⵢⵢⵓⵔ ⴰ:',
                      en: 'Earlier days not yet marked collected this month:',
                      es: 'Días anteriores sin cobrar este mes:',
                    })}{' '}
                    {carryOver.unsettledDays
                      .map((u) => `${u.date} (${u.owedMAD} DH)`)
                      .join(' · ')}
                  </div>
                  {carryOver.isMonthEndWarning && (
                    <div className="text-[11px] font-black text-red-300 mt-1">
                      {pickLang(lang, {
                        ar: `⚠️ تنبيه نهاية الشهر: يُنصح بتصفية وجمع هذا المبلغ قبل إغلاق الشهر (${carryOver.daysUntilMonthEnd} أيام متبقية).`,
                        fr: `⚠️ Alerte fin de mois : il reste ${carryOver.daysUntilMonthEnd} jours pour régulariser ce solde.`,
                        amz: `⚠️ ⵜⴰⵏⵖⵎⵉⵙⵜ ⵏ ⵜⵉⴳⵉⵔⴰ ⵏ ⵡⴰⵢⵢⵓⵔ (${carryOver.daysUntilMonthEnd} ⵓⵙⵙⴰⵏ).`,
                        en: `⚠️ Month-end alert: clear this balance before closing (${carryOver.daysUntilMonthEnd} days left).`,
                        es: `⚠️ Aviso fin de mes: quedan ${carryOver.daysUntilMonthEnd} días para liquidar.`,
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-black/50 border border-emerald-500/30">
              <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                <span>
                  {pickLang(lang, {
                    ar: 'مدخول لاكيس اليوم',
                    fr: 'Recette caisse du jour',
                    amz: 'ⴰⴽⵛⵓⵎ ⵏ ⴰⵙⵙ ⴰ',
                    en: "Today's Caisse Income",
                    es: 'Ingreso en caja hoy',
                  })}
                </span>
                <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-white font-mono tabular-nums mt-1">
                {dayStats.incomeMAD.toLocaleString('en-US')}{' '}
                <span className="text-xs text-emerald-400">MAD</span>
              </div>
              {dayStats.repaymentIncomeMAD > 0 && (
                <div className="text-[10px] text-emerald-300 mt-0.5 font-mono tabular-nums">
                  {pickLang(lang, {
                    ar: `منها ${dayStats.repaymentIncomeMAD} MAD أداء كريدي`,
                    fr: `Dont ${dayStats.repaymentIncomeMAD} MAD remboursement crédit`,
                    amz: `ⵙⵉⵙ ${dayStats.repaymentIncomeMAD} MAD ⴰⴽⵔⵉⴷⵉ`,
                    en: `Incl. ${dayStats.repaymentIncomeMAD} MAD credit repaid`,
                    es: `Incl. ${dayStats.repaymentIncomeMAD} MAD cobro crédito`,
                  })}
                </div>
              )}
            </div>

            {effectiveBarberId === 'hassan' ? (
              <div className="p-3.5 rounded-xl bg-black/50 border border-blue-500/30">
                <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>
                    {pickLang(lang, {
                      ar: 'فلوس الصرف + المصروف',
                      fr: 'Fond de caisse + Dépenses',
                      amz: 'ⴰⵙⵏⴼⵍ + ⴰⵙⵙⵓⴼⵖ',
                      en: 'Starting Float + Expenses',
                      es: 'Fondo de caja + Gastos',
                    })}
                  </span>
                  <Coins className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-sm font-black text-blue-300 font-mono tabular-nums mt-1">
                  +{dayStats.floatMAD} DH <span className="text-zinc-500">/</span>{' '}
                  <span className="text-red-300">-{dayStats.expensesMAD} DH</span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {pickLang(lang, {
                    ar: 'صرف إضافي / مصاريف مسجلة',
                    fr: 'Monnaie ajoutée / dépenses enregistrées',
                    amz: 'ⴰⵙⵏⴼⵍ / ⵉⵙⵙⵓⴼⵖⵏ',
                    en: 'Float added / logged expenses',
                    es: 'Cambio añadido / gastos',
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-black/50 border border-red-500/30">
                <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>
                    {pickLang(lang, {
                      ar: 'المصروف اليوم',
                      fr: 'Dépenses du jour',
                      amz: 'ⴰⵙⵙⵓⴼⵖ ⵏ ⴰⵙⵙ',
                      en: "Today's Expenses",
                      es: 'Gastos de hoy',
                    })}
                  </span>
                  <ArrowDownCircle className="w-4 h-4 text-red-400" />
                </div>
                <div className="text-xl font-black text-red-300 font-mono tabular-nums mt-1">
                  {dayStats.expensesMAD.toLocaleString('en-US')}{' '}
                  <span className="text-xs">MAD</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {pickLang(lang, {
                    ar: 'مصاريف تخصم من النسبة',
                    fr: 'Déduit de votre part nette',
                    amz: 'ⵉⵜⵜⵓⴽⴽⵙ ⵙⴳ ⵜⴼⵓⵍⵜ ⵏⵏⴽ',
                    en: 'Deducted from barber share',
                    es: 'Deducido de tu parte',
                  })}
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-400/50">
              <div className="text-[11px] text-emerald-200 flex items-center justify-between font-bold">
                <span>
                  {effectiveBarberId === 'hassan'
                    ? pickLang(lang, {
                        ar: `صافي صندوق ${activeBarberLabel} (${dayStats.commissionPercent}%)`,
                        fr: `Net Caisse ${activeBarberLabel} (${dayStats.commissionPercent}%)`,
                        amz: `ⴰⵏⵓⵎ ${activeBarberLabel} (${dayStats.commissionPercent}%)`,
                        en: `${activeBarberLabel} Net (${dayStats.commissionPercent}%)`,
                        es: `Neto ${activeBarberLabel} (${dayStats.commissionPercent}%)`,
                      })
                    : pickLang(lang, {
                        ar: `نصيبك الصافي (${dayStats.commissionPercent}%)`,
                        fr: `Votre Part Nette (${dayStats.commissionPercent}%)`,
                        amz: `ⵜⴰⴼⵓⵍⵜ ⵏⵏⴽ (${dayStats.commissionPercent}%)`,
                        en: `Your Net Share (${dayStats.commissionPercent}%)`,
                        es: `Tu Parte Neta (${dayStats.commissionPercent}%)`,
                      })}
                </span>
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-emerald-300 font-mono tabular-nums mt-1">
                {dayStats.barberNetShareMAD.toLocaleString('en-US')}{' '}
                <span className="text-xs">MAD</span>
              </div>
              {effectiveBarberId === 'hassan' ? (
                <div className="text-[10px] text-zinc-300 mt-0.5 font-mono tabular-nums">
                  {dayStats.barberGrossShareMAD} + {dayStats.floatMAD} - {dayStats.expensesMAD}
                </div>
              ) : (
                <div className="text-[10px] text-zinc-300 mt-0.5 font-mono tabular-nums">
                  {dayStats.barberGrossShareMAD} DH − {dayStats.expensesMAD} DH
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40">
              <div className="text-[11px] text-amber-200 flex items-center justify-between font-bold">
                <span>
                  {pickLang(lang, {
                    ar: 'حصة المحل المنفصلة',
                    fr: 'Part Salon Séparée',
                    amz: 'ⵜⴰⴼⵓⵍⵜ ⵏ ⵓⵙⴰⵍⵓⵏ',
                    en: 'Separate Shop Share',
                    es: 'Parte del Salón',
                  })}
                </span>
                <Banknote className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-black text-amber-300 font-mono tabular-nums mt-1">
                {dayStats.shopShareMAD.toLocaleString('en-US')}{' '}
                <span className="text-xs">MAD</span>
              </div>
              <div className="text-[10px] text-zinc-300 mt-0.5 flex items-center justify-between">
                <span>
                  {pickLang(lang, {
                    ar: `مجموع الدرج: ${dayStats.drawerCashMAD} DH`,
                    fr: `En tiroir : ${dayStats.drawerCashMAD} DH`,
                    amz: `ⴳ ⵓⵙⴼⵏⵓ: ${dayStats.drawerCashMAD} DH`,
                    en: `Drawer: ${dayStats.drawerCashMAD} DH`,
                    es: `En cajón: ${dayStats.drawerCashMAD} DH`,
                  })}
                </span>
                <span className={currentSettlement?.collected ? 'text-emerald-400 font-bold' : 'text-orange-300'}>
                  {currentSettlement?.collected
                    ? pickLang(lang, { ar: 'مجموعة ✓', fr: 'Collectée ✓', amz: 'ⵉⵙⵎⵓⵏ ✓', en: 'Collected ✓', es: 'Cobrada ✓' })
                    : pickLang(lang, { ar: 'قيد الانتظار', fr: 'En attente', amz: 'ⵉⵜⵜⵓⴳⴰⵏⵉ', en: 'Pending', es: 'Pendiente' })}
                </span>
              </div>
            </div>
          </div>

          {/* Master Admin Commission % & Daily Collection / Reset Bar */}
          {isMaster && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <form
                onSubmit={handleSaveCommission}
                className="p-3.5 rounded-xl bg-black/45 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="font-bold text-white">
                      {pickLang(lang, {
                        ar: 'نسبة الحلاق (الافتراضي 50%)',
                        fr: 'Commission barbier (50% par défaut)',
                        amz: 'ⵜⵉⴳⵎⵉⴹⵉ ⵏ ⵓⵎⴽⵔⴰⴹ (50%)',
                        en: 'Barber Commission (Default 50%)',
                        es: 'Comisión del barbero (50% base)',
                      })}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {activeBarberLabel}:{' '}
                      <span className="text-amber-300 font-mono font-bold">{activeCommission}%</span>
                      {activeCommission > 50 && (
                        <span className="ms-1 text-emerald-300 font-bold">
                          (+{activeCommission - 50}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={String(activeCommission)}
                    value={commissionDraft}
                    onChange={(e) => setCommissionDraft(e.target.value)}
                    className="w-20 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-center"
                  />
                  <button
                    type="submit"
                    disabled={savingCommission || !commissionDraft}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {pickLang(lang, { ar: 'حفظ النسبة', fr: 'Enregistrer', amz: 'ⵃⴹⵓ', en: 'Save %', es: 'Guardar %' })}
                    </span>
                  </button>
                </div>
              </form>

              <div className="p-3.5 rounded-xl bg-black/45 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>
                      {pickLang(lang, {
                        ar: 'تأكيد جمع لاكيس اليوم',
                        fr: 'Statut de collecte du jour',
                        amz: 'ⴰⵙⴷⵓ ⵏ ⵓⵙⵎⵓⵏ ⵏ ⴰⵙⵙ ⴰ',
                        en: 'Daily Collection Settlement',
                        es: 'Confirmar cobro de caja hoy',
                      })}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {currentSettlement?.collected
                      ? `${currentSettlement.collectedAmountMAD} MAD · ${currentSettlement.confirmedBy}`
                      : pickLang(lang, {
                          ar: 'لم يُجمع بعد — يُحتسب ضمن كايتسالو للأيام القادمة',
                          fr: 'Non collectée — reportée en solde dû',
                          amz: 'ⵓⵔ ⵉⵙⵎⵓⵏ ⵜⴰ — ⵔⴰⴷ ⵉⵜⵜⵓⵙⵎⵓⵏ',
                          en: 'Not collected yet — carried over as owed',
                          es: 'Sin cobrar — acumulado al saldo pendiente',
                        })}
                    {currentSettlement?.resetCount ? ` · ↺ ${currentSettlement.resetCount}×` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    placeholder={String(dayStats.barberNetShareMAD)}
                    value={collectedAmountDraft}
                    onChange={(e) => setCollectedAmountDraft(e.target.value)}
                    className="w-20 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white text-center"
                  />
                  <button
                    type="button"
                    disabled={savingSettlement}
                    onClick={() => handleSettlementAction(!currentSettlement?.collected, false)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                      currentSettlement?.collected
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {currentSettlement?.collected
                        ? pickLang(lang, { ar: 'إلغاء الجمع', fr: 'Annuler collecte', amz: 'ⵙⵔ ⴰⵙⵎⵓⵏ', en: 'Uncollect', es: 'Anular cobro' })
                        : pickLang(lang, { ar: 'تأكيد الجمع ✓', fr: 'Marquer collecté ✓', amz: 'ⵙⵙⴷⵓ ⴰⵙⵎⵓⵏ ✓', en: 'Mark Collected ✓', es: 'Cobrar ✓' })}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={savingSettlement}
                    onClick={() => handleSettlementAction(false, true)}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {pickLang(lang, { ar: 'إعادة حساب / تصفير', fr: 'Réinitialiser', amz: 'ⵙⵎⴰⵢⵏⵓ', en: 'Reset', es: 'Reiniciar' })}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Forms Grid: 1) Add Income (STRICTLY PRICE-HIDDEN Services) & Credit | 2) Expense / Float */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <form
              onSubmit={handleAddIncome}
              className="lg:col-span-7 p-4 rounded-2xl bg-black/55 border border-emerald-500/30 space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <h4 className="text-sm font-black text-emerald-300 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>
                    {pickLang(lang, {
                      ar: `تسجيل مدخول جديد (${activeBarberLabel})`,
                      fr: `Ajouter une recette (${activeBarberLabel})`,
                      amz: `ⵣⵎⵎⴻⵎ ⴰⴽⵛⵓⵎ (${activeBarberLabel})`,
                      en: `Add Income (${activeBarberLabel})`,
                      es: `Registrar ingreso (${activeBarberLabel})`,
                    })}
                  </span>
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400">
                  {pickLang(lang, {
                    ar: 'قائمة الخدمات بدون أسعار',
                    fr: 'Services sans prix affichés',
                    amz: 'ⵜⵉⵏⴰⴼⵓⵜⵉⵏ ⵡⴰⵔ ⴰⵜⵉⴳ',
                    en: 'Price-hidden menu',
                    es: 'Servicios sin precios',
                  })}
                </span>
              </div>

              {/* Price-Hidden Services Selector (Strictly no prices shown) */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {pickLang(lang, {
                      ar: 'الخدمات المنجزة (اختر خدمة أو أكثر):',
                      fr: 'Prestations réalisées (choisir 1 ou plusieurs) :',
                      amz: 'ⵜⵉⵏⴰⴼⵓⵜⵉⵏ ⵉⵜⵜⵓⴳⴰⵏ:',
                      en: 'Performed Services (select one or more):',
                      es: 'Servicios realizados (elige uno o más):',
                    })}
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {BASE_SERVICES.map((svc) => {
                    const active = selectedServiceIds.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => handleToggleService(svc.id)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? 'bg-emerald-500 text-black border-emerald-400 shadow-sm'
                            : 'bg-zinc-900/90 text-zinc-200 border-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        {svc.name[lang] || svc.name.ar}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                    {pickLang(lang, {
                      ar: 'المبلغ الموضوع في لاكيس (MAD) *',
                      fr: 'Montant mis en caisse (MAD) *',
                      amz: 'ⵉⴷⵔⵉⵎⵏ ⴳ ⵓⵙⴼⵏⵓ (MAD) *',
                      en: 'Amount Placed in Caisse (MAD) *',
                      es: 'Importe puesto en caja (MAD) *',
                    })}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    placeholder="50"
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                    {pickLang(lang, {
                      ar: 'ملاحظة سريعة (اختياري)',
                      fr: 'Note rapide (optionnel)',
                      amz: 'ⵜⴰⵎⵏⵏⴰⵢⵜ (ⴰⴼⵔⴰⵏ)',
                      en: 'Quick Note (optional)',
                      es: 'Nota rápida (opcional)',
                    })}
                  </label>
                  <input
                    type="text"
                    placeholder="..."
                    value={incomeNote}
                    onChange={(e) => setIncomeNote(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setHasCreditToggle((prev) => !prev)}
                  className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 cursor-pointer transition-colors ${
                    hasCreditToggle
                      ? 'bg-orange-500/20 border-orange-400/60 text-orange-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-orange-500/40'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-orange-400" />
                  <span>
                    {pickLang(lang, {
                      ar: 'هل يوجد كريدي / باقي على الزبون؟ (دفع جزئي أو مؤجل)',
                      fr: 'Crédit / reste à payer ? (Paiement partiel ou différé)',
                      amz: 'ⵉⵍⵍⴰ ⵓⴽⵔⵉⴷⵉ ⵖⴼ ⵓⵎⵙⴰⵖ?',
                      en: 'Partial Credit / Client Owes Remainder?',
                      es: '¿Crédito / saldo pendiente del cliente?',
                    })}
                  </span>
                </button>
              </div>

              {hasCreditToggle && (
                <div className="p-3 rounded-xl bg-orange-950/25 border border-orange-500/35 space-y-2.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-orange-200 font-bold mb-1">
                        {pickLang(lang, {
                          ar: 'الثمن الإجمالي المتفق عليه (MAD) *',
                          fr: 'Total convenu (MAD) *',
                          amz: 'ⴰⵜⵉⴳ ⴰⵎⴰⵜⴰⵢ (MAD) *',
                          en: 'Expected Total (MAD) *',
                          es: 'Total acordado (MAD) *',
                        })}
                      </label>
                      <input
                        type="number"
                        min={paidNum}
                        placeholder="100"
                        value={expectedAmountInput}
                        onChange={(e) => setExpectedAmountInput(e.target.value)}
                        className="w-full bg-black/70 border border-orange-500/40 rounded-lg px-2.5 py-2 text-xs font-mono font-bold text-white"
                      />
                    </div>
                    <div className="flex flex-col justify-center p-2.5 rounded-lg bg-black/50 border border-orange-500/30">
                      <span className="text-[10px] text-zinc-400">
                        {pickLang(lang, {
                          ar: 'مبلغ الكريدي المتبقي:',
                          fr: 'Crédit restant :',
                          amz: 'ⴰⴽⵔⵉⴷⵉ ⵉⵖⴰⵎⴰⵏ:',
                          en: 'Remaining Credit:',
                          es: 'Crédito restante:',
                        })}
                      </span>
                      <span className="text-base font-black font-mono text-orange-300 tabular-nums">
                        {computedCreditNum.toLocaleString('en-US')} MAD
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-zinc-300 mb-1">
                        {pickLang(lang, { ar: 'اسم الزبون *', fr: 'Nom client *', amz: 'ⵉⵙⵎ *', en: 'Client Name *', es: 'Cliente *' })}
                      </label>
                      <input
                        type="text"
                        placeholder="..."
                        value={creditClientName}
                        onChange={(e) => setCreditClientName(e.target.value)}
                        className="w-full bg-black/70 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-300 mb-1">
                        {pickLang(lang, { ar: 'هاتف الزبون', fr: 'Téléphone', amz: 'ⵜⵉⵍⵉⴼⵓⵏ', en: 'Client Phone', es: 'Teléfono' })}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="06..."
                        value={creditClientPhone}
                        onChange={(e) => setCreditClientPhone(e.target.value)}
                        className="w-full bg-black/70 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-300 mb-1">
                        {pickLang(lang, { ar: 'تاريخ الأداء المتوقع', fr: 'Date paiement prévue', amz: 'ⴰⵣⵎⵣ ⵏ ⵓⴼⵔⵓ', en: 'Expected Repay Date', es: 'Fecha de pago' })}
                      </label>
                      <input
                        type="date"
                        value={creditRepaymentDate}
                        onChange={(e) => setCreditRepaymentDate(e.target.value)}
                        className="w-full bg-black/70 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={savingIncome}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50"
              >
                {savingIncome ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>
                  {pickLang(lang, {
                    ar: 'تسجيل المدخول في لاكيس الآن',
                    fr: 'Enregistrer la recette maintenant',
                    amz: 'ⵣⵎⵎⴻⵎ ⴰⴽⵛⵓⵎ ⴷⵖⵉ',
                    en: 'Log Income to Caisse Now',
                    es: 'Guardar ingreso ahora',
                  })}
                </span>
              </button>
            </form>

            {/* Add Expense / Float Adjustment Form */}
            <form
              onSubmit={handleAddOutflow}
              className="lg:col-span-5 p-4 rounded-2xl bg-black/55 border border-zinc-800 space-y-3.5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                  <h4 className="text-sm font-black text-red-300 flex items-center gap-2">
                    <ArrowDownCircle className="w-4 h-4" />
                    <span>
                      {isMaster && effectiveBarberId === 'hassan'
                        ? pickLang(lang, {
                            ar: 'تسجيل مصروف أو فلوس الصرف',
                            fr: 'Dépense ou Fond de Caisse',
                            amz: 'ⴰⵙⵙⵓⴼⵖ ⵏⵖ ⴰⵙⵏⴼⵍ',
                            en: 'Log Expense or Starting Float',
                            es: 'Gasto o Fondo de Caja',
                          })
                        : pickLang(lang, {
                            ar: 'تسجيل مصروف (المصروف)',
                            fr: 'Ajouter une dépense',
                            amz: 'ⵣⵎⵎⴻⵎ ⴰⵙⵙⵓⴼⵖ',
                            en: 'Add Expense',
                            es: 'Registrar gasto',
                          })}
                    </span>
                  </h4>
                </div>

                {isMaster && effectiveBarberId === 'hassan' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOutflowMode('expense')}
                      className={`min-h-[38px] rounded-xl text-xs font-bold border cursor-pointer ${
                        outflowMode === 'expense'
                          ? 'bg-red-500/20 border-red-400 text-red-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {pickLang(lang, { ar: 'مصروف (-)', fr: 'Dépense (-)', amz: 'ⴰⵙⵙⵓⴼⵖ (-)', en: 'Expense (-)', es: 'Gasto (-)' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutflowMode('float_adjustment')}
                      className={`min-h-[38px] rounded-xl text-xs font-bold border cursor-pointer ${
                        outflowMode === 'float_adjustment'
                          ? 'bg-blue-500/20 border-blue-400 text-blue-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {pickLang(lang, { ar: 'فلوس الصرف (+)', fr: 'Monnaie / Float (+)', amz: 'ⴰⵙⵏⴼⵍ (+)', en: 'Float (+)', es: 'Cambio (+)' })}
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                    {pickLang(lang, { ar: 'المبلغ (MAD) *', fr: 'Montant (MAD) *', amz: 'ⴰⵜⵉⴳ (MAD) *', en: 'Amount (MAD) *', es: 'Importe (MAD) *' })}
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="20"
                    value={outflowAmount}
                    onChange={(e) => setOutflowAmount(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                    {pickLang(lang, { ar: 'السبب / التوضيح', fr: 'Motif / Description', amz: 'ⵜⴰⵎⵏⵜⵉⵍⵜ', en: 'Reason / Note', es: 'Motivo' })}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      outflowMode === 'float_adjustment' && effectiveBarberId === 'hassan'
                        ? pickLang(lang, {
                            ar: 'مثلاً: صرف صباحي لبداية اليوم...',
                            fr: 'Ex : monnaie d’ouverture...',
                            amz: 'ⴰⵎⴷⵢⴰ: ⴰⵙⵏⴼⵍ ⵏ ⵜⵉⴼⴰⵡⵜ...',
                            en: 'Ex: morning change float...',
                            es: 'Ej: cambio de apertura...',
                          })
                        : pickLang(lang, {
                            ar: 'مثلاً: مستلزمات، ماء، قهوة، سلف...',
                            fr: 'Ex : fournitures, eau, café, avance...',
                            amz: 'ⴰⵎⴷⵢⴰ: ⴰⵎⴰⵏ, ⵍⵇⵀⵡⴰ...',
                            en: 'Ex: supplies, coffee, advance...',
                            es: 'Ej: suministros, café, adelanto...',
                          })
                    }
                    value={outflowNote}
                    onChange={(e) => setOutflowNote(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingOutflow}
                className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                  isMaster && effectiveBarberId === 'hassan' && outflowMode === 'float_adjustment'
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-red-600/90 hover:bg-red-500 text-white'
                }`}
              >
                {savingOutflow ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>
                  {isMaster && effectiveBarberId === 'hassan' && outflowMode === 'float_adjustment'
                    ? pickLang(lang, {
                        ar: 'إضافة فلوس الصرف للاكيس',
                        fr: 'Ajouter le fond de caisse',
                        amz: 'ⵔⵏⵓ ⴰⵙⵏⴼⵍ ⵖⵔ ⵓⵙⴼⵏⵓ',
                        en: 'Add Float to Caisse',
                        es: 'Añadir fondo a caja',
                      })
                    : pickLang(lang, {
                        ar: 'خصم المصروف من لاكيس',
                        fr: 'Déduire la dépense',
                        amz: 'ⴽⴽⵙ ⴰⵙⵙⵓⴼⵖ ⵙⴳ ⵓⵙⴼⵏⵓ',
                        en: 'Log Expense',
                        es: 'Descontar gasto',
                      })}
                </span>
              </button>
            </form>
          </div>

          {/* Open Credits Section */}
          {openCredits.length > 0 && (
            <div className="p-4 rounded-2xl bg-orange-950/20 border border-orange-500/35 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-orange-300 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {pickLang(lang, {
                      ar: `سجل الكريدي المفتوح (${openCredits.length})`,
                      fr: `Crédits ouverts (${openCredits.length})`,
                      amz: `ⴰⴽⵔⵉⴷⵉ ⵉⵕⵥⵎⵏ (${openCredits.length})`,
                      en: `Open Credits (${openCredits.length})`,
                      es: `Créditos abiertos (${openCredits.length})`,
                    })}
                  </span>
                </h4>
                <span className="text-xs font-mono font-bold text-orange-200 tabular-nums">
                  {pickLang(lang, { ar: 'المتبقي:', fr: 'Reste :', amz: 'ⵉⵖⴰⵎⴰ:', en: 'Remaining:', es: 'Pendiente:' })}{' '}
                  {openCredits
                    .reduce((s, e) => s + (Number(e.creditRemainingMAD) || 0), 0)
                    .toLocaleString('en-US')}{' '}
                  MAD
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {openCredits.map((ce) => (
                  <div
                    key={ce.id}
                    className="p-3 rounded-xl bg-black/50 border border-orange-500/30 flex flex-col justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black text-white text-sm">
                          {ce.clientName ||
                            pickLang(lang, { ar: 'زبون غير مسمى', fr: 'Client', amz: 'ⴰⵎⵙⴰⵖ', en: 'Client', es: 'Cliente' })}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {ce.serviceNames?.join(' + ') || '—'} ·{' '}
                          <span className="font-mono">{ce.date}</span>
                        </div>
                        {ce.expectedRepaymentDate && (
                          <div className="text-[11px] text-amber-300 mt-0.5">
                            {pickLang(lang, { ar: 'الأداء المتوقع:', fr: 'Échéance :', amz: 'ⴰⵣⵎⵣ:', en: 'Due:', es: 'Vencimiento:' })}{' '}
                            <span className="font-mono">{ce.expectedRepaymentDate}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-end">
                        <div className="text-[10px] text-zinc-400">
                          {pickLang(lang, { ar: 'المتبقي', fr: 'Reste', amz: 'ⵉⵖⴰⵎⴰ', en: 'Owed', es: 'Resta' })}
                        </div>
                        <div className="text-base font-black font-mono text-orange-300 tabular-nums">
                          {ce.creditRemainingMAD} MAD
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                      <span className="text-[11px] text-zinc-400 font-mono tabular-nums">
                        {ce.expectedAmountMAD} MAD · {pickLang(lang, { ar: 'مدفوع:', fr: 'Payé :', amz: 'ⵉⵜⵜⵓⴼⴽⴰ:', en: 'Paid:', es: 'Pagado:' })}{' '}
                        {ce.amountPaidMAD + (ce.repaidAmountMAD || 0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openRepayModal(ce)}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>
                          {pickLang(lang, { ar: 'أداء الكريدي', fr: 'Rembourser', amz: 'ⴼⵔⵓ ⴰⴽⵔⵉⴷⵉ', en: 'Repay Credit', es: 'Pagar crédito' })}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day's Transactions List */}
          <div className="p-4 rounded-2xl bg-black/45 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white">
                {pickLang(lang, {
                  ar: `حركات صندوق ${activeBarberLabel} ليوم ${selectedDate} (${dayEntries.length})`,
                  fr: `Mouvements Caisse ${activeBarberLabel} (${selectedDate}) (${dayEntries.length})`,
                  amz: `ⵜⵉⵎⵀⴰⵍ ⵏ ${activeBarberLabel} (${selectedDate}) (${dayEntries.length})`,
                  en: `${activeBarberLabel} Transactions — ${selectedDate} (${dayEntries.length})`,
                  es: `Movimientos ${activeBarberLabel} — ${selectedDate} (${dayEntries.length})`,
                })}
              </h4>
            </div>

            {dayEntries.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-500">
                {pickLang(lang, {
                  ar: 'لا توجد عمليات مسجلة في لاكيس لهذا اليوم حتى الآن.',
                  fr: 'Aucune opération enregistrée pour cette journée.',
                  amz: 'ⵓⵔ ⵍⵍⵉⵏⵜ ⵜⵎⵀⴰⵍ ⴰⵙⵙ ⴰ.',
                  en: 'No Caisse transactions logged for this day yet.',
                  es: 'No hay movimientos registrados hoy.',
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            entry.type === 'income'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : entry.type === 'credit_repayment'
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                              : entry.type === 'float_adjustment'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                              : 'bg-red-500/20 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {entry.type === 'income'
                            ? pickLang(lang, { ar: 'مدخول', fr: 'Recette', amz: 'ⴰⴽⵛⵓⵎ', en: 'Income', es: 'Ingreso' })
                            : entry.type === 'credit_repayment'
                            ? pickLang(lang, { ar: 'أداء كريدي', fr: 'Remboursement', amz: 'ⴰⴼⵔⵓ', en: 'Repayment', es: 'Pago crédito' })
                            : entry.type === 'float_adjustment'
                            ? pickLang(lang, { ar: 'فلوس الصرف', fr: 'Fond de caisse', amz: 'ⴰⵙⵏⴼⵍ', en: 'Float', es: 'Fondo' })
                            : pickLang(lang, { ar: 'مصروف', fr: 'Dépense', amz: 'ⴰⵙⵙⵓⴼⵖ', en: 'Expense', es: 'Gasto' })}
                        </span>
                        {entry.serviceNames && entry.serviceNames.length > 0 && (
                          <span className="font-bold text-white">
                            {entry.serviceNames.join(' + ')}
                          </span>
                        )}
                        {entry.sourceTicketNumber && (
                          <span className="font-mono text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                            {entry.sourceTicketNumber}
                          </span>
                        )}
                        {entry.clientName && (
                          <span className="text-zinc-300 font-semibold">• {entry.clientName}</span>
                        )}
                      </div>
                      {entry.note && (
                        <div className="text-[11px] text-zinc-400">{entry.note}</div>
                      )}
                      {entry.creditAmountMAD > 0 && (
                        <div className="text-[11px] text-orange-300 font-mono tabular-nums">
                          {pickLang(lang, { ar: 'كريدي:', fr: 'Crédit :', amz: 'ⴰⴽⵔⵉⴷⵉ:', en: 'Credit:', es: 'Crédito:' })}{' '}
                          {entry.creditAmountMAD} MAD ·{' '}
                          {pickLang(lang, { ar: 'المتبقي:', fr: 'Reste :', amz: 'ⵉⵖⴰⵎⴰ:', en: 'Rem:', es: 'Resta:' })}{' '}
                          {entry.creditRemainingMAD} MAD
                          {entry.creditStatus === 'paid' ? ' ✓' : ''}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-end">
                        <div
                          className={`text-sm font-black font-mono tabular-nums ${
                            entry.type === 'expense'
                              ? 'text-red-300'
                              : entry.type === 'float_adjustment'
                              ? 'text-blue-300'
                              : 'text-emerald-300'
                          }`}
                        >
                          {entry.type === 'expense' ? '-' : '+'}
                          {entry.amountPaidMAD.toLocaleString('en-US')} MAD
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {entry.createdByName}
                        </div>
                      </div>

                      {isMaster && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(entry)}
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                            title={pickLang(lang, { ar: 'تعديل العملية', fr: 'Modifier', amz: 'ⵙⵏⴼⵍ', en: 'Edit', es: 'Editar' })}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(entry)}
                            className="p-2 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 cursor-pointer"
                            title={pickLang(lang, { ar: 'حذف العملية', fr: 'Supprimer', amz: 'ⴽⴽⵙ', en: 'Delete', es: 'Eliminar' })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== CREDIT REPAYMENT MODAL ==================== */}
      {repayTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmRepayment}
            className="w-full max-w-md rounded-2xl bg-zinc-950 border border-emerald-500/40 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h4 className="text-sm font-black text-emerald-300 flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <span>
                  {pickLang(lang, {
                    ar: `أداء الكريدي — ${repayTarget.clientName || 'زبون'}`,
                    fr: `Remboursement — ${repayTarget.clientName || 'Client'}`,
                    amz: `ⴰⴼⵔⵓ ⵏ ⵓⴽⵔⵉⴷⵉ — ${repayTarget.clientName || 'ⴰⵎⵙⴰⵖ'}`,
                    en: `Credit Repayment — ${repayTarget.clientName || 'Client'}`,
                    es: `Pago de crédito — ${repayTarget.clientName || 'Cliente'}`,
                  })}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setRepayTarget(null)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1">
              <div>{repayTarget.serviceNames?.join(' + ') || '—'}</div>
              <div>
                {pickLang(lang, { ar: 'المتبقي للأداء:', fr: 'Reste à payer :', amz: 'ⵉⵖⴰⵎⴰ:', en: 'Remaining owed:', es: 'Resta por pagar:' })}{' '}
                <span className="font-mono font-black text-orange-300 tabular-nums">
                  {repayTarget.creditRemainingMAD} MAD
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  {pickLang(lang, { ar: 'المبلغ المؤدى الآن (MAD)', fr: 'Montant payé (MAD)', amz: 'ⴰⵜⵉⴳ (MAD)', en: 'Amount Paid (MAD)', es: 'Importe pagado (MAD)' })}
                </label>
                <input
                  type="number"
                  min={1}
                  max={repayTarget.creditRemainingMAD}
                  value={repayAmountInput}
                  onChange={(e) => setRepayAmountInput(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  {pickLang(lang, { ar: 'تاريخ الأداء', fr: 'Date encaissement', amz: 'ⴰⵣⵎⵣ ⵏ ⵓⴼⵔⵓ', en: 'Repayment Date', es: 'Fecha de cobro' })}
                </label>
                <input
                  type="date"
                  value={repayDateInput}
                  onChange={(e) => setRepayDateInput(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 font-bold mb-1">
                {pickLang(lang, { ar: 'ملاحظة', fr: 'Note', amz: 'ⵜⴰⵎⵏⵏⴰⵢⵜ', en: 'Note', es: 'Nota' })}
              </label>
              <input
                type="text"
                value={repayNoteInput}
                onChange={(e) => setRepayNoteInput(e.target.value)}
                placeholder="..."
                className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={savingRepay}
                className="flex-1 min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingRepay ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>
                  {pickLang(lang, {
                    ar: 'تأكيد الأداء وإدخال المبلغ للاكيس',
                    fr: 'Confirmer & encaisser',
                    amz: 'ⵙⵙⴷⵓ ⴰⴼⵔⵓ',
                    en: 'Confirm & Add to Caisse',
                    es: 'Confirmar y sumar a caja',
                  })}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRepayTarget(null)}
                className="px-4 min-h-[42px] rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                {pickLang(lang, { ar: 'إلغاء', fr: 'Annuler', amz: 'ⵙⵔ', en: 'Cancel', es: 'Cancelar' })}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MASTER ADMIN EDIT ENTRY MODAL ==================== */}
      {editTarget && isMaster && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEntryEdit}
            className="w-full max-w-md rounded-2xl bg-zinc-950 border border-amber-500/40 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h4 className="text-sm font-black text-amber-300 flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                <span>
                  {pickLang(lang, {
                    ar: 'تعديل السجل (المدير العام)',
                    fr: 'Modifier l’opération (Direction)',
                    amz: 'ⵙⵏⴼⵍ ⴰⵣⵎⵎⴻⵎ',
                    en: 'Edit Entry (Master Admin)',
                    es: 'Editar registro (Admin)',
                  })}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  {pickLang(lang, { ar: 'المبلغ المدفوع (MAD)', fr: 'Payé (MAD)', amz: 'ⵉⵜⵜⵓⴼⴽⴰ (MAD)', en: 'Paid (MAD)', es: 'Pagado (MAD)' })}
                </label>
                <input
                  type="number"
                  min={0}
                  value={editPaidInput}
                  onChange={(e) => setEditPaidInput(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  required
                />
              </div>
              {editTarget.type === 'income' && (
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    {pickLang(lang, { ar: 'الإجمالي المتوقع (MAD)', fr: 'Total prévu (MAD)', amz: 'ⴰⵜⵉⴳ ⴰⵎⴰⵜⴰⵢ', en: 'Expected Total (MAD)', es: 'Total previsto (MAD)' })}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editExpectedInput}
                    onChange={(e) => setEditExpectedInput(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
              )}
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  {pickLang(lang, { ar: 'التاريخ', fr: 'Date', amz: 'ⴰⵣⵎⵣ', en: 'Date', es: 'Fecha' })}
                </label>
                <input
                  type="date"
                  value={editDateInput}
                  onChange={(e) => setEditDateInput(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              {editTarget.type === 'income' && (
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    {pickLang(lang, { ar: 'اسم الزبون', fr: 'Client', amz: 'ⴰⵎⵙⴰⵖ', en: 'Client Name', es: 'Cliente' })}
                  </label>
                  <input
                    type="text"
                    value={editClientNameInput}
                    onChange={(e) => setEditClientNameInput(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {editTarget.type === 'income' && (
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    {pickLang(lang, { ar: 'تاريخ الأداء المتوقع للكريدي', fr: 'Échéance crédit', amz: 'ⴰⵣⵎⵣ ⵏ ⵓⴽⵔⵉⴷⵉ', en: 'Credit Due Date', es: 'Fecha crédito' })}
                  </label>
                  <input
                    type="date"
                    value={editRepayDateInput}
                    onChange={(e) => setEditRepayDateInput(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              )}
              <div className={editTarget.type === 'income' ? '' : 'sm:col-span-2'}>
                <label className="block text-zinc-300 font-bold mb-1">
                  {pickLang(lang, { ar: 'ملاحظة', fr: 'Note', amz: 'ⵜⴰⵎⵏⵏⴰⵢⵜ', en: 'Note', es: 'Nota' })}
                </label>
                <input
                  type="text"
                  value={editNoteInput}
                  onChange={(e) => setEditNoteInput(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={savingEdit}
                className="flex-1 min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingEdit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>
                  {pickLang(lang, { ar: 'حفظ التعديلات', fr: 'Enregistrer', amz: 'ⵃⴹⵓ', en: 'Save Changes', es: 'Guardar cambios' })}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 min-h-[42px] rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                {pickLang(lang, { ar: 'إلغاء', fr: 'Annuler', amz: 'ⵙⵔ', en: 'Cancel', es: 'Cancelar' })}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
