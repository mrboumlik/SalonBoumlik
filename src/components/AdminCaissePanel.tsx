import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Calendar,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  History,
  Lock,
  MessageCircle,
  MessageSquare,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Scissors,
  Sliders,
  Timer,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import {
  AppointmentBooking,
  CaisseBarberId,
  CaisseEntry,
  CaisseEntryType,
  CommissionPeriodOverride,
  StaffRole,
} from '../types';
import {
  addCaisseEntry,
  closeBarberDayIntake,
  computeAnnualCaisseRollup,
  computeBarberCycleBalance,
  computeBarberDailyInOutHistory,
  computeBarberDayStats,
  computeBarberPeriodSettlementPreview,
  computeMonthlyCaisseRollup,
  computeShopDrawerTotals,
  confirmBarberCyclePayout,
  deleteCaisseEntry,
  ensureDailyArchivesForPriorDays,
  getCaisseBarberMeta,
  getCaisseBarbersFromRoster,
  getEffectiveCommissionPercent,
  getEffectiveCommissionPercentForDate,
  getSalonBusinessDate,
  recordCaisseCreditRepayment,
  saveBarberDailyNoteReply,
  saveMasterDailyBarberNote,
  updateBarberCommissionPercent,
  updateCaisseEntry,
  useBarberDailyNotes,
  useCaisseArchives,
  useCaisseCycles,
  useCaisseEntries,
  useCaisseSettlements,
  useCaisseSettings,
} from '../utils/caisseStore';
import {
  getBarberSelectableServices,
  useBarberProfiles,
} from '../utils/barberProfileStore';
import {
  getQuickPriceSuggestionsForServices,
  useShopPricingConfig,
} from '../utils/shopPricingStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import {
  updateCreditDisputeStatus,
  useCreditDisputes,
} from '../utils/creditRegistryStore';
import { getBarberIdentityTokens } from '../utils/barberIdentity';
import { buildCreditWhatsAppReminderUrl } from '../utils/whatsappAutomation';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { showToast } from '../utils/notifications';

interface AdminCaissePanelProps {
  sessionRole: StaffRole;
  ownBarberId: 'all' | CaisseBarberId;
  staffName: string;
  todayStr: string;
  bookings?: AppointmentBooking[];
  onAutoExitBarberSession?: () => void;
}

export const AdminCaissePanel: React.FC<AdminCaissePanelProps> = ({
  sessionRole,
  ownBarberId,
  staffName,
  bookings = [],
  onAutoExitBarberSession,
}) => {
  const { lang } = useLanguage();
  const entries = useCaisseEntries();
  const settingsMap = useCaisseSettings();
  const settlementsMap = useCaisseSettlements();
  const cycles = useCaisseCycles();
  const archivesMap = useCaisseArchives();
  const dailyNotesMap = useBarberDailyNotes();
  const profilesMap = useBarberProfiles();
  const shopPricingConfig = useShopPricingConfig();
  const roster = useBarberRoster();
  const creditDisputes = useCreditDisputes();

  const [businessTodayStr, setBusinessTodayStr] = useState<string>(() =>
    getSalonBusinessDate()
  );

  // Tick every 60s to detect 03:00 AM business-day rollover cleanly
  useEffect(() => {
    const interval = setInterval(() => {
      const nextBizDate = getSalonBusinessDate();
      setBusinessTodayStr((prev) => (prev !== nextBizDate ? nextBizDate : prev));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Idempotent 03:00 AM archival of completed prior days (never resets open barber balances)
  useEffect(() => {
    if (entries.length === 0) return;
    void ensureDailyArchivesForPriorDays(entries, archivesMap, businessTodayStr);
  }, [entries, archivesMap, businessTodayStr]);

  const activeCaisseBarbers = useMemo(
    () => getCaisseBarbersFromRoster(roster),
    [roster]
  );

  const allCaisseBarbers = useMemo(
    () => getCaisseBarbersFromRoster(roster, entries),
    [roster, entries]
  );

  const initialBarberId: CaisseBarberId =
    sessionRole === 'barber' && ownBarberId !== 'all'
      ? ownBarberId
      : sessionRole === 'caisse'
      ? ''
      : activeCaisseBarbers[0]?.id || 'hassan';

  const [selectedBarberId, setSelectedBarberId] = useState<CaisseBarberId>(initialBarberId);

  useEffect(() => {
    if (sessionRole === 'barber' && ownBarberId !== 'all') {
      setSelectedBarberId(ownBarberId);
    }
  }, [sessionRole, ownBarberId]);

  const activeBarberId: CaisseBarberId =
    sessionRole === 'barber' && ownBarberId !== 'all' ? ownBarberId : selectedBarberId;

  const fallbackMeta = getCaisseBarberMeta(
    activeBarberId || activeCaisseBarbers[0]?.id || 'hassan',
    roster
  );
  const activeBarberMeta = fallbackMeta;
  const activeTone = getBarberIdentityTokens(
    activeBarberMeta.id,
    activeBarberMeta.arName
  );

  const [selectedDate, setSelectedDate] = useState<string>(() => getSalonBusinessDate());
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    getSalonBusinessDate().slice(0, 7)
  );
  const [selectedYear, setSelectedYear] = useState<string>(() =>
    getSalonBusinessDate().slice(0, 4)
  );

  // Staff barbers see max 2 months of historical transactions (unpaid credits stay visible until settled)
  const twoMonthsCutoffDate = useMemo(() => {
    const [y, m, d] = businessTodayStr.split('-').map(Number);
    const dt = new Date(y || 2026, (m || 1) - 1, d || 1);
    dt.setMonth(dt.getMonth() - 2);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [businessTodayStr]);

  useEffect(() => {
    if (sessionRole === 'barber' && selectedDate < twoMonthsCutoffDate) {
      setSelectedDate(twoMonthsCutoffDate);
    }
  }, [sessionRole, selectedDate, twoMonthsCutoffDate]);

  const isViewingOwnAccount =
    sessionRole === 'barber' ||
    (sessionRole === 'master' && activeBarberId === 'hassan');

  // Interactive KPI Drill-Down Modal + Per-Entry Detail View
  type CaisseDrillKind =
    | 'income_day'
    | 'expenses'
    | 'net_balance'
    | 'credits_all'
    | 'shop_day'
    | 'shop_cycle'
    | 'float_cycle'
    | 'shop_barber_day';
  const [drillModal, setDrillModal] = useState<{
    kind: CaisseDrillKind;
    barberId?: CaisseBarberId;
  } | null>(null);
  const [selectedDrillEntry, setSelectedDrillEntry] = useState<CaisseEntry | null>(null);

  const openDrillModal = (kind: CaisseDrillKind, barberId?: CaisseBarberId) => {
    setSelectedDrillEntry(null);
    setDrillModal({ kind, barberId });
  };

  // Master Admin "المجر ككل" (Total Cash in Drawer) Breakdown Modal
  const [drawerModalOpen, setDrawerModalOpen] = useState<boolean>(false);
  const [drawerModalScope, setDrawerModalScope] = useState<'open_cycle' | 'day'>('open_cycle');

  // Privacy Masking: Strictly scoped to Caisse views ('caisse' & 'master');
  // Barbers viewing their own personal account see all numbers unmasked.
  // Inside Caisse, both global toggle ("إظهار"/"إخفاء") and per-card eye ("عوينة") toggles are supported.
  const canToggleCaissePrivacy = sessionRole === 'master' || sessionRole === 'caisse';
  const [showCaisseAmounts, setShowCaisseAmounts] = useState<boolean>(false);
  const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setShowCaisseAmounts(false);
    setRevealedCards({});
  }, [sessionRole]);
  const handleToggleGlobalCaisseAmounts = () => {
    setShowCaisseAmounts((prev) => !prev);
    setRevealedCards({});
  };
  const toggleBoxReveal = (boxKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRevealedCards((prev) => ({ ...prev, [boxKey]: !prev[boxKey] }));
  };
  const isBoxVisible = (boxKey?: string): boolean => {
    if (sessionRole === 'barber') return true;
    if (showCaisseAmounts) return true;
    if (boxKey && revealedCards[boxKey]) return true;
    return false;
  };
  const amountsVisible = isBoxVisible();
  const formatMAD = (
    val: number | string | undefined | null,
    boxKey?: string
  ): string =>
    isBoxVisible(boxKey)
      ? `${Math.round(Number(val) || 0).toLocaleString('en-US')} MAD`
      : '••• MAD';
  const maskNum = (
    val: number | string | undefined | null,
    boxKey?: string
  ): string =>
    isBoxVisible(boxKey)
      ? Math.round(Number(val) || 0).toLocaleString('en-US')
      : '•••';
  const renderBoxEyeButton = (boxKey: string, compact = false) => {
    if (!canToggleCaissePrivacy) return null;
    const revealed = isBoxVisible(boxKey);
    return (
      <button
        type="button"
        onClick={(e) => toggleBoxReveal(boxKey, e)}
        title={revealed ? 'عوينة: إخفاء الرقم' : 'عوينة: إظهار الرقم'}
        aria-label={revealed ? 'إخفاء الرقم' : 'إظهار الرقم'}
        className={`${
          compact ? 'p-1 rounded-md' : 'p-1.5 rounded-lg'
        } border transition-colors cursor-pointer shrink-0 ${
          revealed && !showCaisseAmounts
            ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
            : 'bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-300'
        }`}
      >
        {revealed ? (
          <EyeOff className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        ) : (
          <Eye className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        )}
      </button>
    );
  };

  // 1-Minute Auto-Return (Caisse/Master -> Barber list) & 1-Minute Auto-Exit (Barber -> Logout)
  const [autoTimerSecondsLeft, setAutoTimerSecondsLeft] = useState<number | null>(null);
  const startPostEntryTimer = () => {
    setAutoTimerSecondsLeft(60);
  };

  // Duplicate amount warning banner state (10-minute window check)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    kind: 'income' | 'expense';
    amount: number;
    matchedTimeLabel: string;
    matchedNote?: string;
  } | null>(null);

  // Action Modals ('none' | 'income' | 'expense' | 'float')
  const [openForm, setOpenForm] = useState<'none' | 'income' | 'expense' | 'float'>('none');

  useEffect(() => {
    if (autoTimerSecondsLeft === null) return;
    if (autoTimerSecondsLeft <= 0) {
      setAutoTimerSecondsLeft(null);
      setOpenForm('none');
      setDrillModal(null);
      setSelectedDrillEntry(null);
      setDrawerModalOpen(false);
      setEditingEntry(null);
      setPayoutConfirmOpen(false);
      setDuplicateWarning(null);
      if (sessionRole === 'barber') {
        onAutoExitBarberSession?.();
      } else {
        setSelectedBarberId('');
      }
      return;
    }
    const timerId = window.setTimeout(() => {
      setAutoTimerSecondsLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timerId);
  }, [autoTimerSecondsLeft, sessionRole, onAutoExitBarberSession]);

  // Income form state ("حطيت في المجر") — ZERO blocking validation on services or clientName
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [incomeNote, setIncomeNote] = useState<string>('');
  const [hasCreditToggle, setHasCreditToggle] = useState<boolean>(false);
  const [agreedTotalInput, setAgreedTotalInput] = useState<string>('');
  const [creditClientName, setCreditClientName] = useState<string>('');
  const [creditClientPhone, setCreditClientPhone] = useState<string>('');
  const [creditExpectedDate, setCreditExpectedDate] = useState<string>('');
  const [incomeSubmitting, setIncomeSubmitting] = useState<boolean>(false);

  // Expense form state ("هزيت الفلوس")
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [expenseSubmitting, setExpenseSubmitting] = useState<boolean>(false);

  // Float form state (Master Admin Hassan only — "فلوس الصرف")
  const [floatAmount, setFloatAmount] = useState<string>('');
  const [floatNote, setFloatNote] = useState<string>('');
  const [floatSubmitting, setFloatSubmitting] = useState<boolean>(false);

  // Expandable single-line transaction rows
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});
  const [txScopeFilter, setTxScopeFilter] = useState<'day' | 'cycle' | 'all'>('day');

  // Repayment inline state
  const [repayingEntryId, setRepayingEntryId] = useState<string | null>(null);
  const [repayAmountInput, setRepayAmountInput] = useState<string>('');
  const [repayBusy, setRepayBusy] = useState<boolean>(false);

  // Master Admin commission edit, period commission overrides & cycle payout confirmation
  const [commissionInput, setCommissionInput] = useState<string>('50');
  const [commissionBusy, setCommissionBusy] = useState<boolean>(false);
  const [commissionPeriodPanelOpen, setCommissionPeriodPanelOpen] = useState<boolean>(false);
  const [newPctScope, setNewPctScope] = useState<'month' | 'date_range'>('date_range');
  const [newPctMonth, setNewPctMonth] = useState<string>(() =>
    getSalonBusinessDate().slice(0, 7)
  );
  const [newPctStartDate, setNewPctStartDate] = useState<string>(() => getSalonBusinessDate());
  const [newPctEndDate, setNewPctEndDate] = useState<string>(() => getSalonBusinessDate());
  const [newPctValue, setNewPctValue] = useState<string>('50');
  const [newPctLabel, setNewPctLabel] = useState<string>('');

  // Master Daily Intake Close & Multi-Scope Cycle/Period Settlement
  const [dailyIntakeCloseBusy, setDailyIntakeCloseBusy] = useState<boolean>(false);
  const [payoutConfirmOpen, setPayoutConfirmOpen] = useState<boolean>(false);
  const [payoutScope, setPayoutScope] = useState<'full_open' | 'month' | 'custom_range'>('full_open');
  const [payoutMonth, setPayoutMonth] = useState<string>(() =>
    getSalonBusinessDate().slice(0, 7)
  );
  const [payoutStartDate, setPayoutStartDate] = useState<string>(() =>
    `${getSalonBusinessDate().slice(0, 7)}-01`
  );
  const [payoutEndDate, setPayoutEndDate] = useState<string>(() => getSalonBusinessDate());
  const [payoutNote, setPayoutNote] = useState<string>('');
  const [payoutBusy, setPayoutBusy] = useState<boolean>(false);

  // Daily Per-Barber Master Note & Barber Reply
  const [masterNoteInput, setMasterNoteInput] = useState<string>('');
  const [masterNoteBusy, setMasterNoteBusy] = useState<boolean>(false);
  const [barberReplyInput, setBarberReplyInput] = useState<string>('');
  const [barberReplyBusy, setBarberReplyBusy] = useState<boolean>(false);

  // Transaction / Credit Edit Modal state (Master Admin & owning Barber for their credits)
  const [editingEntry, setEditingEntry] = useState<CaisseEntry | null>(null);
  const [editPaid, setEditPaid] = useState<string>('');
  const [editCreditRem, setEditCreditRem] = useState<string>('');
  const [editClientName, setEditClientName] = useState<string>('');
  const [editClientPhone, setEditClientPhone] = useState<string>('');
  const [editRepayDate, setEditRepayDate] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editBusy, setEditBusy] = useState<boolean>(false);

  // Master Accountant Sub-tabs ('periods' | 'annual' | 'archives' | 'cycles')
  const [accountantTab, setAccountantTab] = useState<
    'periods' | 'annual' | 'archives' | 'cycles'
  >('periods');

  // Services available for the active barber (filters out hidden services, price-hidden inside Caisse)
  const barberServices = useMemo(
    () =>
      activeBarberId
        ? getBarberSelectableServices(
            activeBarberId,
            profilesMap,
            shopPricingConfig,
            businessTodayStr
          )
        : [],
    [activeBarberId, profilesMap, shopPricingConfig, businessTodayStr]
  );

  const caisseQuickSuggestions = useMemo(
    () =>
      activeBarberId
        ? getQuickPriceSuggestionsForServices(
            selectedServiceIds,
            shopPricingConfig,
            profilesMap[activeBarberId],
            selectedDate
          )
        : [15, 20, 25, 30, 35, 40, 50],
    [selectedServiceIds, shopPricingConfig, profilesMap, activeBarberId, selectedDate]
  );

  // Base Commission & Date-Effective Commission sync
  const baseCommissionPct = activeBarberId
    ? getEffectiveCommissionPercent(activeBarberId, settingsMap)
    : 50;
  const effectivePct = activeBarberId
    ? getEffectiveCommissionPercentForDate(activeBarberId, selectedDate, settingsMap)
    : 50;
  const activePeriodOverrides = useMemo(
    () => (activeBarberId ? settingsMap[activeBarberId]?.periodOverrides || [] : []),
    [activeBarberId, settingsMap]
  );

  useEffect(() => {
    setCommissionInput(String(baseCommissionPct));
    setNewPctValue(String(baseCommissionPct));
  }, [baseCommissionPct, activeBarberId]);

  // Daily Note sync for activeBarberId + selectedDate
  const currentDailyNoteKey = activeBarberId ? `${activeBarberId}_${selectedDate}` : '';
  const currentDailyNote = currentDailyNoteKey ? dailyNotesMap[currentDailyNoteKey] : undefined;

  useEffect(() => {
    setMasterNoteInput(currentDailyNote?.masterNote || '');
    setBarberReplyInput(currentDailyNote?.barberReply || '');
  }, [currentDailyNoteKey, currentDailyNote?.masterNote, currentDailyNote?.barberReply]);

  // Day Stats & Cumulative Open Cycle Balance (never auto-resets at 00:00 or 03:00!)
  const selectedDayStats = useMemo(
    () =>
      activeBarberId
        ? computeBarberDayStats(activeBarberId, selectedDate, entries, effectivePct)
        : {
            barberId: 'hassan',
            date: selectedDate,
            incomeMAD: 0,
            directIncomeMAD: 0,
            repaymentIncomeMAD: 0,
            creditsIssuedMAD: 0,
            expensesMAD: 0,
            floatMAD: 0,
            commissionPercent: 50,
            extraPercentAbove50: 0,
            barberGrossShareMAD: 0,
            barberNetShareMAD: 0,
            shopShareMAD: 0,
            drawerCashMAD: 0,
            entryCount: 0,
          },
    [activeBarberId, selectedDate, entries, effectivePct]
  );

  const selectedDaySettlement = activeBarberId
    ? settlementsMap[`${activeBarberId}_${selectedDate}`]
    : undefined;

  // Post-daily-close intake calculation (resets today's displayed intake after Hassan closes the day, while keeping cycleBalance intact!)
  const displayedDayIntakeStats = useMemo(() => {
    if (!selectedDaySettlement?.intakeClosed) {
      return {
        isIntakeClosed: false,
        displayedIncomeMAD: selectedDayStats.incomeMAD,
        displayedExpensesMAD: selectedDayStats.expensesMAD,
        closedAtAmountMAD: 0,
        postCloseEntryCount: selectedDayStats.entryCount,
      };
    }
    const closedIso = selectedDaySettlement.confirmedAt || selectedDaySettlement.updatedAt;
    const postCloseEntries = entries.filter(
      (e) =>
        e.barberId === activeBarberId &&
        e.date === selectedDate &&
        (!closedIso || e.createdAt > closedIso)
    );
    let postIncome = 0;
    let postExpenses = 0;
    postCloseEntries.forEach((e) => {
      if (e.type === 'income' || e.type === 'credit_repayment') {
        postIncome += Number(e.amountPaidMAD) || 0;
      } else if (e.type === 'expense') {
        postExpenses += Number(e.amountPaidMAD) || 0;
      }
    });
    return {
      isIntakeClosed: true,
      displayedIncomeMAD: Math.round(postIncome),
      displayedExpensesMAD: Math.round(postExpenses),
      closedAtAmountMAD: Number(selectedDaySettlement.grossIntakeClosedMAD) || selectedDayStats.incomeMAD,
      postCloseEntryCount: postCloseEntries.length,
    };
  }, [selectedDaySettlement, selectedDayStats, entries, activeBarberId, selectedDate]);

  const cycleBalance = useMemo(
    () =>
      activeBarberId
        ? computeBarberCycleBalance(activeBarberId, entries, settingsMap, cycles, selectedDate)
        : {
            barberId: 'hassan',
            lastSettledIso: null,
            lastSettledDate: null,
            commissionPercent: 50,
            incomeMAD: 0,
            repaymentIncomeMAD: 0,
            expensesMAD: 0,
            floatMAD: 0,
            creditsIssuedMAD: 0,
            barberGrossShareMAD: 0,
            shopShareMAD: 0,
            barberNetOwedMAD: 0,
            openCreditsAllTimeMAD: 0,
            openCycleEntries: [],
          },
    [activeBarberId, entries, settingsMap, cycles, selectedDate]
  );

  const payoutPreview = useMemo(
    () =>
      activeBarberId
        ? computeBarberPeriodSettlementPreview({
            barberId: activeBarberId,
            entries,
            settingsMap,
            cycles,
            scope: payoutScope,
            month: payoutMonth,
            startDate: payoutStartDate,
            endDate: payoutEndDate,
            referenceDate: businessTodayStr,
          })
        : { cycleBalance },
    [
      activeBarberId,
      entries,
      settingsMap,
      cycles,
      payoutScope,
      payoutMonth,
      payoutStartDate,
      payoutEndDate,
      businessTodayStr,
      cycleBalance,
    ]
  );

  const dailyInOutHistory = useMemo(() => {
    if (!activeBarberId) return [];
    const list = computeBarberDailyInOutHistory(activeBarberId, entries, settlementsMap, 12);
    if (sessionRole === 'barber') {
      return list.filter((row) => row.date >= twoMonthsCutoffDate);
    }
    return list;
  }, [activeBarberId, entries, settlementsMap, sessionRole, twoMonthsCutoffDate]);

  // Master All-Barbers Rollups
  const monthlyRollup = useMemo(
    () =>
      computeMonthlyCaisseRollup(selectedMonth, entries, settingsMap, settlementsMap, roster),
    [selectedMonth, entries, settingsMap, settlementsMap, roster]
  );

  const allTimeOpenCreditsByBarber = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      if ((Number(e.creditRemainingMAD) || 0) > 0 && e.creditStatus !== 'paid') {
        map[e.barberId] = (map[e.barberId] || 0) + (Number(e.creditRemainingMAD) || 0);
      }
    });
    return map;
  }, [entries]);

  const annualRollup = useMemo(
    () => computeAnnualCaisseRollup(selectedYear, entries, settingsMap, roster),
    [selectedYear, entries, settingsMap, roster]
  );

  const todayShopSummary = useMemo(() => {
    const perBarber = allCaisseBarbers.map((b) => {
      const pct = getEffectiveCommissionPercentForDate(b.id, selectedDate, settingsMap);
      const dayStats = computeBarberDayStats(b.id, selectedDate, entries, pct);
      return { barber: b, dayStats };
    });
    const totalIncome = perBarber.reduce((s, x) => s + x.dayStats.incomeMAD, 0);
    const totalShopShare = perBarber.reduce((s, x) => s + x.dayStats.shopShareMAD, 0);
    const totalExpenses = perBarber.reduce((s, x) => s + x.dayStats.expensesMAD, 0);
    return { perBarber, totalIncome, totalShopShare, totalExpenses };
  }, [allCaisseBarbers, selectedDate, entries, settingsMap]);

  // Live "المجر ككل" (Total Cash in Drawer = Float + Income - Expenses) + per-person breakdown
  const openCycleDrawerSummary = useMemo(
    () =>
      computeShopDrawerTotals({
        entries,
        settingsMap,
        cycles,
        rosterMembers: roster,
        scope: 'open_cycle',
        date: selectedDate,
      }),
    [entries, settingsMap, cycles, roster, selectedDate]
  );

  const selectedDayDrawerSummary = useMemo(
    () =>
      computeShopDrawerTotals({
        entries,
        settingsMap,
        cycles,
        rosterMembers: roster,
        scope: 'day',
        date: selectedDate,
      }),
    [entries, settingsMap, cycles, roster, selectedDate]
  );

  const activeDrawerSummary =
    drawerModalScope === 'day' ? selectedDayDrawerSummary : openCycleDrawerSummary;

  // Open Credits across ALL dates (NEVER subject to 2-month cap until paid)
  const openCreditsList = useMemo(() => {
    return entries.filter((e) => {
      const rem = Number(e.creditRemainingMAD) || 0;
      if (rem <= 0 || e.creditStatus === 'paid') return false;
      if (sessionRole === 'barber') return e.barberId === activeBarberId;
      return e.barberId === activeBarberId;
    });
  }, [entries, sessionRole, activeBarberId]);

  // Filtered Transaction Log (Barbers capped at last 2 months, except open unpaid credits)
  const visibleEntries = useMemo(() => {
    const passesBarberArchiveCap = (e: CaisseEntry) => {
      if (sessionRole !== 'barber') return true;
      const isOpenCredit = (Number(e.creditRemainingMAD) || 0) > 0 && e.creditStatus !== 'paid';
      return isOpenCredit || e.date >= twoMonthsCutoffDate;
    };

    if (txScopeFilter === 'day') {
      return entries.filter(
        (e) => e.barberId === activeBarberId && e.date === selectedDate && passesBarberArchiveCap(e)
      );
    }
    if (txScopeFilter === 'cycle') {
      return cycleBalance.openCycleEntries.filter(passesBarberArchiveCap);
    }
    return entries
      .filter((e) => e.barberId === activeBarberId && passesBarberArchiveCap(e))
      .slice(0, 80);
  }, [
    entries,
    activeBarberId,
    selectedDate,
    txScopeFilter,
    cycleBalance.openCycleEntries,
    sessionRole,
    twoMonthsCutoffDate,
  ]);

  // Daily Archives list sorted descending (Barbers capped at last 2 months)
  const sortedArchives = useMemo(() => {
    return Object.values(archivesMap)
      .filter((a) => {
        if (sessionRole === 'barber') {
          return a.barberId === activeBarberId && a.date >= twoMonthsCutoffDate;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60);
  }, [archivesMap, sessionRole, activeBarberId, twoMonthsCutoffDate]);

  // Drill-down modal dataset matching the clicked KPI / Summary box
  const drillViewData = useMemo(() => {
    if (!drillModal) return null;
    const fmt = (val: number | string | undefined | null) =>
      amountsVisible ? `${Math.round(Number(val) || 0).toLocaleString('en-US')} MAD` : '••• MAD';
    const closedIso =
      selectedDaySettlement?.intakeClosed
        ? selectedDaySettlement.confirmedAt || selectedDaySettlement.updatedAt
        : null;

    if (drillModal.kind === 'income_day') {
      const list = entries.filter(
        (e) =>
          e.barberId === activeBarberId &&
          e.date === selectedDate &&
          (e.type === 'income' || e.type === 'credit_repayment')
      );
      return {
        title: isViewingOwnAccount
          ? `تفاصيل شحال حطيت (${selectedDate === businessTodayStr ? 'اليوم' : selectedDate})`
          : `تفاصيل شحال حط ${activeBarberMeta.arName} (${selectedDate === businessTodayStr ? 'اليوم' : selectedDate})`,
        totalLabel: fmt(displayedDayIntakeStats.displayedIncomeMAD),
        subtitle: displayedDayIntakeStats.isIntakeClosed
          ? `تم إغلاق مداخيل سابقة بمبلغ ${fmt(displayedDayIntakeStats.closedAtAmountMAD)} · المعروض الحالي بعد الإغلاق`
          : `${list.length} عملية مسجلة في هذا اليوم`,
        accentCls: 'text-emerald-700 dark:text-emerald-400',
        list,
        closedIso,
      };
    }

    if (drillModal.kind === 'expenses') {
      const source =
        sessionRole === 'caisse'
          ? entries.filter((e) => e.barberId === activeBarberId && e.date === selectedDate)
          : cycleBalance.openCycleEntries;
      const list = source.filter((e) => e.type === 'expense');
      const totalAmt =
        sessionRole === 'caisse' ? selectedDayStats.expensesMAD : cycleBalance.expensesMAD;
      return {
        title:
          sessionRole === 'caisse' || !isViewingOwnAccount
            ? `تفاصيل السحوبات والمصاريف — ${activeBarberMeta.arName}`
            : 'تفاصيل شحال هزيت (السحوبات والمصاريف)',
        totalLabel: fmt(totalAmt),
        subtitle:
          sessionRole === 'caisse'
            ? `سحوبات يوم ${selectedDate}`
            : `مجموع السحوبات في الدورة المفتوحة (${list.length} عملية)`,
        accentCls: 'text-rose-700 dark:text-rose-400',
        list,
        closedIso: null,
      };
    }

    if (drillModal.kind === 'net_balance') {
      const list =
        sessionRole === 'caisse'
          ? entries.filter((e) => e.barberId === activeBarberId && e.date === selectedDate)
          : cycleBalance.openCycleEntries;
      const netVal =
        sessionRole === 'caisse'
          ? selectedDayStats.drawerCashMAD
          : cycleBalance.barberNetOwedMAD;
      return {
        title:
          sessionRole === 'caisse'
            ? `تفاصيل الفلوس فـ المجر (${activeBarberMeta.arName})`
            : isViewingOwnAccount
            ? 'تفاصيل شحال بقى ليا (الصافي التراكمي)'
            : `تفاصيل شحال كيتسال ${activeBarberMeta.arName}`,
        totalLabel: fmt(netVal),
        subtitle:
          sessionRole === 'caisse'
            ? `المداخيل (${fmt(selectedDayStats.incomeMAD)}) − السحوبات (${fmt(selectedDayStats.expensesMAD)})`
            : `المداخيل: ${fmt(cycleBalance.incomeMAD)} · حصة الحلاق (${cycleBalance.commissionPercent}%): ${fmt(cycleBalance.barberGrossShareMAD)}${
                activeBarberId === 'hassan' && cycleBalance.floatMAD > 0
                  ? ` + صرف: ${fmt(cycleBalance.floatMAD)}`
                  : ''
              } − السحوبات: ${fmt(cycleBalance.expensesMAD)}`,
        accentCls:
          netVal < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-300',
        list,
        closedIso: null,
      };
    }

    if (drillModal.kind === 'credits_all') {
      const totalCred = openCreditsList.reduce(
        (s, e) => s + (Number(e.creditRemainingMAD) || 0),
        0
      );
      return {
        title: `تفاصيل الكريدي المفتوح — ${activeBarberMeta.arName}`,
        totalLabel: fmt(totalCred),
        subtitle: `${openCreditsList.length} كريدي مفتوح عبر كل التواريخ حتى الأداء`,
        accentCls: 'text-orange-700 dark:text-orange-400',
        list: openCreditsList,
        closedIso: null,
      };
    }

    if (drillModal.kind === 'shop_day') {
      const list = entries.filter(
        (e) =>
          e.barberId === activeBarberId &&
          e.date === selectedDate &&
          (e.type === 'income' || e.type === 'credit_repayment')
      );
      return {
        title: `تفاصيل حصة المحل من ${activeBarberMeta.arName} (${selectedDate})`,
        totalLabel: fmt(selectedDayStats.shopShareMAD),
        subtitle: `من إجمالي دخل ${fmt(selectedDayStats.incomeMAD)} (نسبة المحل ${Math.max(0, 100 - selectedDayStats.commissionPercent)}%)`,
        accentCls: 'text-emerald-700 dark:text-emerald-400',
        list,
        closedIso: null,
      };
    }

    if (drillModal.kind === 'shop_cycle') {
      const list = cycleBalance.openCycleEntries.filter(
        (e) => e.type === 'income' || e.type === 'credit_repayment'
      );
      return {
        title: `تفاصيل حصة المحل في الدورة المفتوحة (${activeBarberMeta.arName})`,
        totalLabel: fmt(cycleBalance.shopShareMAD),
        subtitle: `من إجمالي ${fmt(cycleBalance.incomeMAD)} عبر ${list.length} عملية في الدورة`,
        accentCls: 'text-emerald-700 dark:text-emerald-400',
        list,
        closedIso: null,
      };
    }

    if (drillModal.kind === 'float_cycle') {
      const list = cycleBalance.openCycleEntries.filter(
        (e) => e.type === 'float_adjustment'
      );
      return {
        title: 'تفاصيل فلوس الصرف في الدورة المفتوحة',
        totalLabel: fmt(cycleBalance.floatMAD),
        subtitle: `${list.length} عملية إضافة صرف`,
        accentCls: 'text-amber-700 dark:text-amber-300',
        list,
        closedIso: null,
      };
    }

    // 'shop_barber_day'
    const targetId = drillModal.barberId || activeBarberId;
    const targetMeta = getCaisseBarberMeta(targetId, roster);
    const pct = getEffectiveCommissionPercentForDate(targetId, selectedDate, settingsMap);
    const targetDayStats = computeBarberDayStats(targetId, selectedDate, entries, pct);
    const list = entries.filter((e) => e.barberId === targetId && e.date === selectedDate);
    return {
      title: `حساب المحل والعمليات — ${targetMeta.arName} (${selectedDate})`,
      totalLabel: fmt(targetDayStats.shopShareMAD),
      subtitle: `إجمالي الدخل: ${fmt(targetDayStats.incomeMAD)} · حصة الحلاق (${pct}%): ${fmt(targetDayStats.barberGrossShareMAD)} · المصروف: ${fmt(targetDayStats.expensesMAD)}`,
      accentCls: 'text-emerald-700 dark:text-emerald-400',
      list,
      closedIso: null,
    };
  }, [
    drillModal,
    amountsVisible,
    entries,
    activeBarberId,
    activeBarberMeta.arName,
    selectedDate,
    businessTodayStr,
    isViewingOwnAccount,
    selectedDaySettlement,
    displayedDayIntakeStats,
    sessionRole,
    cycleBalance,
    selectedDayStats,
    openCreditsList,
    roster,
    settingsMap,
  ]);

  const toggleServiceSelection = (srvId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(srvId) ? prev.filter((id) => id !== srvId) : [...prev, srvId]
    );
  };

  const toggleEntryExpanded = (id: string) => {
    setExpandedEntryIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Open Credit Disputes relevant to this barber (or general)
  const openBarberDisputes = useMemo(() => {
    const openPhones = new Set(
      openCreditsList
        .map((ce) => (ce.clientPhone || '').replace(/\D+/g, '').slice(-9))
        .filter((d) => d.length >= 6)
    );
    return creditDisputes.filter((d) => {
      if (d.status === 'resolved') return false;
      if (d.targetBarberId && d.targetBarberId === activeBarberId) return true;
      const dDigits = (d.normalizedPhone || d.clientPhone || '').replace(/\D+/g, '').slice(-9);
      return dDigits.length >= 6 && openPhones.has(dDigits);
    });
  }, [creditDisputes, openCreditsList, activeBarberId]);

  const openEditModalForEntry = (entry: CaisseEntry) => {
    setEditingEntry(entry);
    setEditPaid(String(entry.amountPaidMAD));
    setEditCreditRem(String(entry.creditRemainingMAD));
    setEditClientName(entry.clientName || '');
    setEditClientPhone(entry.clientPhone || '');
    setEditRepayDate(entry.expectedRepaymentDate || '');
    setEditDate(entry.date);
    setEditNote(entry.note || '');
  };

  // Computed live remaining credit in income form
  const paidNum = Math.max(0, Number(amountPaidInput) || 0);
  const agreedNum = hasCreditToggle
    ? Math.max(paidNum, Number(agreedTotalInput) || paidNum)
    : paidNum;
  const computedCreditRemaining = hasCreditToggle ? Math.max(0, agreedNum - paidNum) : 0;

  const findRecentDuplicateEntry = (
    kind: 'income' | 'expense',
    amt: number
  ): CaisseEntry | undefined => {
    const roundedAmt = Math.round(amt);
    if (roundedAmt <= 0 || !activeBarberId) return undefined;
    const nowMs = Date.now();
    const tenMinutesMs = 10 * 60 * 1000;
    return entries.find((entry) => {
      if (entry.barberId !== activeBarberId) return false;
      if (entry.date !== selectedDate) return false;
      if (entry.type !== kind) return false;
      if (Math.round(Number(entry.amountPaidMAD) || 0) !== roundedAmt) return false;
      const createdMs = Date.parse(entry.createdAt || '');
      return (
        Number.isFinite(createdMs) &&
        nowMs - createdMs >= 0 &&
        nowMs - createdMs <= tenMinutesMs
      );
    });
  };

  // Submit Income ("حطيت في المجر") — ZERO blocking checks on services or clientName!
  const handleSubmitIncome = async (
    e?: React.FormEvent,
    bypassDuplicateCheck = false
  ) => {
    if (e) e.preventDefault();
    if (paidNum <= 0 && computedCreditRemaining <= 0) {
      showToast(
        pickLang(lang, {
          ar: 'أدخل المبلغ أولا',
          fr: 'Entrez un montant',
          amz: 'ⵙⴽⵛⵎ ⴰⵜⵉⴳ',
          en: 'Enter an amount first',
          es: 'Ingresa un monto primero',
        }),
        pickLang(lang, {
          ar: 'يجب أن يكون المبلغ الموضوع أو مبلغ الكريدي أكبر من 0.',
          fr: 'Le montant encaissé ou le crédit doit être supérieur à 0.',
          amz: 'ⴰⵜⵉⴳ ⵉⵅⵚⵚⴰ ⴰⴷ ⵉⴳ ⵓⴳⴳⴰⵔ ⵏ 0.',
          en: 'Collected cash or credit amount must be greater than 0.',
          es: 'El monto o crédito debe ser mayor que 0.',
        }),
        'warning'
      );
      return;
    }

    if (!bypassDuplicateCheck && paidNum > 0) {
      const dup = findRecentDuplicateEntry('income', paidNum);
      if (dup) {
        const matchedTimeLabel = dup.createdAt
          ? new Date(dup.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        setDuplicateWarning({
          kind: 'income',
          amount: Math.round(paidNum),
          matchedTimeLabel,
          matchedNote: dup.note || dup.serviceNames?.join(' + ') || undefined,
        });
        return;
      }
    }

    const pickedNames = selectedServiceIds
      .map((sid) => {
        const found = barberServices.find((s) => s.id === sid);
        if (!found) return sid;
        return lang === 'fr'
          ? found.nameFr
          : lang === 'en' || lang === 'es'
          ? found.nameEn
          : found.nameAr;
      })
      .filter(Boolean);

    setIncomeSubmitting(true);
    try {
      await addCaisseEntry({
        barberId: activeBarberId,
        barberName: activeBarberMeta.name,
        type: 'income',
        date: selectedDate,
        serviceIds: selectedServiceIds,
        serviceNames: pickedNames,
        expectedAmountMAD: agreedNum,
        amountPaidMAD: paidNum,
        creditAmountMAD: computedCreditRemaining,
        creditRemainingMAD: computedCreditRemaining,
        creditStatus:
          computedCreditRemaining > 0 ? (paidNum > 0 ? 'partial' : 'open') : 'none',
        clientName: creditClientName.trim() || undefined,
        clientPhone: creditClientPhone.trim() || undefined,
        expectedRepaymentDate: creditExpectedDate.trim() || undefined,
        note: incomeNote.trim() || undefined,
        createdByRole: sessionRole,
        createdByName: staffName,
      });

      setSelectedServiceIds([]);
      setAmountPaidInput('');
      setIncomeNote('');
      setHasCreditToggle(false);
      setAgreedTotalInput('');
      setCreditClientName('');
      setCreditClientPhone('');
      setCreditExpectedDate('');
      setDuplicateWarning(null);
      setOpenForm('none');
      startPostEntryTimer();

      showToast(
        pickLang(lang, {
          ar: 'تم التسجيل في لاكيس ✓',
          fr: 'Enregistré en Caisse ✓',
          amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⴳ ⵍⴰⴽⵉⵙ ✓',
          en: 'Recorded in Caisse ✓',
          es: 'Registrado en Caja ✓',
        }),
        formatMAD(paidNum),
        'success'
      );
    } catch (err) {
      console.error('Failed to add Caisse income:', err);
    } finally {
      setIncomeSubmitting(false);
    }
  };

  // Submit Expense ("هزيت الفلوس")
  const handleSubmitExpense = async (
    e?: React.FormEvent,
    bypassDuplicateCheck = false
  ) => {
    if (e) e.preventDefault();
    const amt = Math.max(0, Number(expenseAmount) || 0);
    if (amt <= 0) {
      showToast(
        pickLang(lang, {
          ar: 'أدخل مبلغ المصروف',
          fr: 'Entrez le montant',
          amz: 'ⵙⴽⵛⵎ ⴰⵜⵉⴳ',
          en: 'Enter expense amount',
          es: 'Ingresa el monto',
        }),
        '',
        'warning'
      );
      return;
    }

    if (!bypassDuplicateCheck) {
      const dup = findRecentDuplicateEntry('expense', amt);
      if (dup) {
        const matchedTimeLabel = dup.createdAt
          ? new Date(dup.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        setDuplicateWarning({
          kind: 'expense',
          amount: Math.round(amt),
          matchedTimeLabel,
          matchedNote: dup.note || undefined,
        });
        return;
      }
    }

    setExpenseSubmitting(true);
    try {
      await addCaisseEntry({
        barberId: activeBarberId,
        barberName: activeBarberMeta.name,
        type: 'expense',
        date: selectedDate,
        expectedAmountMAD: amt,
        amountPaidMAD: amt,
        creditAmountMAD: 0,
        creditRemainingMAD: 0,
        creditStatus: 'none',
        note: expenseNote.trim() || 'هزيت الفلوس من لاكيس',
        createdByRole: sessionRole,
        createdByName: staffName,
      });
      setExpenseAmount('');
      setExpenseNote('');
      setDuplicateWarning(null);
      setOpenForm('none');
      startPostEntryTimer();
      showToast(
        pickLang(lang, {
          ar: 'تم تسجيل السحب / المصروف ✓',
          fr: 'Retrait enregistré ✓',
          amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵙⵙⵓⴼⵖ ✓',
          en: 'Expense recorded ✓',
          es: 'Gasto registrado ✓',
        }),
        formatMAD(amt),
        'success'
      );
    } catch (err) {
      console.error('Failed to add expense:', err);
    } finally {
      setExpenseSubmitting(false);
    }
  };

  // Submit Float Adjustment (Master Admin Hassan — "فلوس الصرف")
  const handleSubmitFloat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionRole !== 'master') return;
    const amt = Math.max(0, Number(floatAmount) || 0);
    if (amt <= 0) return;
    setFloatSubmitting(true);
    try {
      await addCaisseEntry({
        barberId: activeBarberId,
        barberName: activeBarberMeta.name,
        type: 'float_adjustment',
        date: selectedDate,
        expectedAmountMAD: amt,
        amountPaidMAD: amt,
        creditAmountMAD: 0,
        creditRemainingMAD: 0,
        creditStatus: 'none',
        note: floatNote.trim() || 'فلوس الصرف',
        createdByRole: sessionRole,
        createdByName: staffName,
      });
      setFloatAmount('');
      setFloatNote('');
      setOpenForm('none');
      showToast(
        pickLang(lang, {
          ar: 'تمت إضافة فلوس الصرف ✓',
          fr: 'Fond de caisse ajouté ✓',
          amz: 'ⵜⵜⵓⵔⵏⴰⵏ ⵉⴷⵔⵉⵎⵏ ⵏ ⵓⵙⵏⴼⵍ ✓',
          en: 'Float added ✓',
          es: 'Fondo de cambio añadido ✓',
        }),
        `${amt} MAD`,
        'success'
      );
    } catch (err) {
      console.error('Failed to add float:', err);
    } finally {
      setFloatSubmitting(false);
    }
  };

  // Atomic Credit Repayment
  const handleConfirmRepay = async (creditEntry: CaisseEntry) => {
    const amt = Math.max(0, Number(repayAmountInput) || 0);
    if (amt <= 0) return;
    setRepayBusy(true);
    try {
      await recordCaisseCreditRepayment({
        creditEntry,
        amountRepaidMAD: amt,
        repaidDate: businessTodayStr,
        actorRole: sessionRole,
        actorName: staffName,
      });
      setRepayingEntryId(null);
      setRepayAmountInput('');
      showToast(
        pickLang(lang, {
          ar: 'تم تسجيل خلاص الكريدي ✓',
          fr: 'Remboursement enregistré ✓',
          amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⴼⵔⵓ ⵏ ⵓⴽⵔⵉⴷⵉ ✓',
          en: 'Credit repayment recorded ✓',
          es: 'Pago de crédito registrado ✓',
        }),
        `${amt} MAD`,
        'success'
      );
    } catch (err) {
      console.error('Credit repayment failed:', err);
    } finally {
      setRepayBusy(false);
    }
  };

  // Master: Commission Update
  const handleSaveCommission = async () => {
    if (sessionRole !== 'master') return;
    const pct = Math.max(0, Math.min(100, Number(commissionInput) || 50));
    setCommissionBusy(true);
    try {
      await updateBarberCommissionPercent(
        activeBarberId,
        pct,
        staffName,
        activePeriodOverrides
      );
      showToast(
        pickLang(lang, {
          ar: `تم تحديث نسبة ${activeBarberMeta.arName} إلى ${pct}%`,
          fr: `Commission mise à jour : ${pct}%`,
          amz: `ⵜⵜⵓⵙⴷⵖⵉ ⵜⴰⴼⵓⵍⵜ : ${pct}%`,
          en: `Commission updated to ${pct}%`,
          es: `Comisión actualizada a ${pct}%`,
        }),
        '',
        'success'
      );
    } catch (err) {
      console.error('Failed to save commission:', err);
    } finally {
      setCommissionBusy(false);
    }
  };

  const handleAddPeriodCommissionOverride = async () => {
    if (sessionRole !== 'master' || !activeBarberId) return;
    const pct = Math.max(0, Math.min(100, Math.round(Number(newPctValue) || 50)));
    const nextRule: CommissionPeriodOverride = {
      id: `cpo_${Date.now().toString(36)}`,
      label:
        newPctLabel.trim() ||
        (newPctScope === 'month'
          ? `نسبة شهر ${newPctMonth}`
          : `فترة ${newPctStartDate} → ${newPctEndDate || newPctStartDate}`),
      scope: newPctScope,
      ...(newPctScope === 'month'
        ? { month: newPctMonth }
        : {
            startDate: newPctStartDate,
            endDate: newPctEndDate || newPctStartDate,
          }),
      commissionPercent: pct,
    };
    const nextOverrides = [...activePeriodOverrides, nextRule];
    setCommissionBusy(true);
    try {
      await updateBarberCommissionPercent(
        activeBarberId,
        baseCommissionPct,
        staffName,
        nextOverrides
      );
      setNewPctLabel('');
      showToast(`تم تفعيل نسبة ${pct}% للفترة المحددة ✓`, '', 'success');
    } catch (err) {
      console.error('Failed to add commission period override:', err);
    } finally {
      setCommissionBusy(false);
    }
  };

  const handleDeletePeriodCommissionOverride = async (overrideId: string) => {
    if (sessionRole !== 'master' || !activeBarberId) return;
    const nextOverrides = activePeriodOverrides.filter((o) => o.id !== overrideId);
    setCommissionBusy(true);
    try {
      await updateBarberCommissionPercent(
        activeBarberId,
        baseCommissionPct,
        staffName,
        nextOverrides
      );
      showToast('تم حذف نسبة الفترة المحددة', '', 'info');
    } catch (err) {
      console.error('Failed to delete commission override:', err);
    } finally {
      setCommissionBusy(false);
    }
  };

  // Master: Close Day Based on Gross Barber Intake ("إغلاق مداخيل اليوم حسب اللي دخل كل حلاق")
  const handleCloseDayIntake = async () => {
    if (sessionRole !== 'master' || !activeBarberId) return;
    setDailyIntakeCloseBusy(true);
    try {
      await closeBarberDayIntake({
        barberId: activeBarberId,
        barberName: activeBarberMeta.name,
        date: selectedDate,
        dayStats: selectedDayStats,
        carryOverOwedMAD: Math.max(0, cycleBalance.barberNetOwedMAD),
        confirmedBy: staffName,
        existingSettlement: selectedDaySettlement,
      });
      showToast(
        `تم إغلاق مداخيل ${activeBarberMeta.arName} ليوم ${selectedDate} ✓`,
        `إجمالي اللي دخل: ${selectedDayStats.incomeMAD} MAD · الرصيد التراكمي محفوظ`,
        'success'
      );
    } catch (err) {
      console.error('Failed to close daily intake:', err);
    } finally {
      setDailyIntakeCloseBusy(false);
    }
  };

  // Master: Confirm Cumulative / Monthly / Custom-Period Payout Settlement
  const handleConfirmPayout = async () => {
    if (sessionRole !== 'master') return;
    const targetCycle = payoutPreview.cycleBalance;
    setPayoutBusy(true);
    try {
      await confirmBarberCyclePayout({
        cycleBalance: targetCycle,
        confirmedBy: staffName,
        businessDate: businessTodayStr,
        settlementPeriodScope: payoutScope,
        periodStartDate: payoutPreview.periodStartDate,
        periodEndDate: payoutPreview.periodEndDate,
        note: payoutNote.trim() || undefined,
      });
      setPayoutConfirmOpen(false);
      setPayoutNote('');
      showToast(
        pickLang(lang, {
          ar: `تمت تصفية حساب ${activeBarberMeta.arName} ✓`,
          fr: `Compte de ${activeBarberMeta.name} soldé ✓`,
          amz: `ⵉⵜⵜⵓⵙⴼⴹ ⵓⵙⵉⴹⵏ ⵏ ${activeBarberMeta.arName} ✓`,
          en: `Payout settled for ${activeBarberMeta.name} ✓`,
          es: `Cuenta liquidada para ${activeBarberMeta.name} ✓`,
        }),
        `${targetCycle.barberNetOwedMAD} MAD`,
        'success'
      );
    } catch (err) {
      console.error('Failed to confirm payout settlement:', err);
    } finally {
      setPayoutBusy(false);
    }
  };

  // Master: Save Daily Note for Active Barber
  const handleSaveMasterDailyNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionRole !== 'master' || !activeBarberId) return;
    setMasterNoteBusy(true);
    try {
      await saveMasterDailyBarberNote({
        barberId: activeBarberId,
        barberName: activeBarberMeta.name,
        date: selectedDate,
        masterNote: masterNoteInput,
        masterUpdatedBy: staffName,
        existingNote: currentDailyNote,
      });
      showToast(`تم حفظ الملاحظة اليومية لـ ${activeBarberMeta.arName} ✓`, selectedDate, 'success');
    } catch (err) {
      console.error('Failed to save master daily note:', err);
    } finally {
      setMasterNoteBusy(false);
    }
  };

  // Barber: Save Reply / Response Back to Master Admin
  const handleSaveBarberNoteReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBarberId) return;
    setBarberReplyBusy(true);
    try {
      await saveBarberDailyNoteReply({
        barberId: activeBarberId,
        barberName: activeBarberMeta.name,
        date: selectedDate,
        barberReply: barberReplyInput,
        barberRepliedBy: staffName,
        existingNote: currentDailyNote,
      });
      showToast('تم إرسال الرد للإدارة (Hassan) ✓', selectedDate, 'success');
    } catch (err) {
      console.error('Failed to save barber note reply:', err);
    } finally {
      setBarberReplyBusy(false);
    }
  };

  // Save Entry / Credit Edit (Master Admin or owning Barber for their drawer)
  const handleSaveEntryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    const canEdit =
      sessionRole === 'master' ||
      (sessionRole === 'barber' && editingEntry.barberId === activeBarberId);
    if (!canEdit) return;
    setEditBusy(true);
    try {
      const nextPaid = Math.max(0, Number(editPaid) || 0);
      const nextCreditRem = Math.max(0, Number(editCreditRem) || 0);
      const nextCreditOrig = Math.max(
        Number(editingEntry.creditAmountMAD) || 0,
        nextCreditRem
      );
      const nextExpected = Math.max(nextPaid + nextCreditRem, nextPaid);
      await updateCaisseEntry(editingEntry.id, {
        amountPaidMAD: nextPaid,
        expectedAmountMAD: nextExpected,
        creditAmountMAD: nextCreditOrig,
        creditRemainingMAD: nextCreditRem,
        creditStatus:
          nextCreditRem > 0
            ? nextPaid > 0
              ? 'partial'
              : 'open'
            : nextCreditOrig > 0
            ? 'paid'
            : 'none',
        clientName: editClientName.trim() || '',
        clientPhone: editClientPhone.trim() || '',
        expectedRepaymentDate: editRepayDate.trim() || '',
        date: sessionRole === 'master' ? editDate || editingEntry.date : editingEntry.date,
        note: editNote.trim(),
      });
      setEditingEntry(null);
      showToast(
        pickLang(lang, {
          ar: 'تم تعديل البيانات بنجاح ✓',
          fr: 'Opération modifiée ✓',
          amz: 'ⵜⵜⵓⵙⵏⴼⵍ ⵜⵎⵀⵍⴰ ✓',
          en: 'Credit / entry updated ✓',
          es: 'Operación actualizada ✓',
        }),
        '',
        'success'
      );
    } catch (err) {
      console.error('Failed to update entry:', err);
    } finally {
      setEditBusy(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (sessionRole !== 'master') return;
    try {
      await deleteCaisseEntry(entryId);
      showToast(
        pickLang(lang, {
          ar: 'تم حذف العملية',
          fr: 'Opération supprimée',
          amz: 'ⵜⵜⵓⴽⴽⵙ ⵜⵎⵀⵍⴰ',
          en: 'Entry deleted',
          es: 'Operación eliminada',
        }),
        '',
        'info'
      );
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const formatEntryTypeBadge = (type: CaisseEntryType) => {
    if (type === 'income') {
      return {
        label: pickLang(lang, {
          ar: 'مدخول',
          fr: 'Entrée',
          amz: 'ⴰⴽⵛⵓⵎ',
          en: 'Income',
          es: 'Ingreso',
        }),
        cls: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
        sign: '+',
      };
    }
    if (type === 'credit_repayment') {
      return {
        label: pickLang(lang, {
          ar: 'خلاص كريدي',
          fr: 'Remb. crédit',
          amz: 'ⴰⴼⵔⵓ ⵏ ⵓⴽⵔⵉⴷⵉ',
          en: 'Credit Paid',
          es: 'Pago crédito',
        }),
        cls: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
        sign: '+',
      };
    }
    if (type === 'float_adjustment') {
      return {
        label: pickLang(lang, {
          ar: 'فلوس الصرف',
          fr: 'Fond de caisse',
          amz: 'ⵉⴷⵔⵉⵎⵏ ⵏ ⵓⵙⵏⴼⵍ',
          en: 'Float',
          es: 'Fondo',
        }),
        cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
        sign: '+',
      };
    }
    return {
      label: pickLang(lang, {
        ar: 'سحب / مصروف',
        fr: 'Retrait',
        amz: 'ⴰⵙⵙⵓⴼⵖ',
        en: 'Expense',
        es: 'Gasto',
      }),
      cls: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
      sign: '-',
    };
  };

  if ((sessionRole === 'caisse' || sessionRole === 'master') && !activeBarberId) {
    const gridBarbers = sessionRole === 'master' ? allCaisseBarbers : activeCaisseBarbers;
    return (
      <div className="space-y-4 pb-28">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-white">
                لاكيس الصالون — اختر الحلاق
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                اضغط على اسم الحلاق لتسجيل المداخيل، السحوبات، أو خلاص الكريدي الخاص به ليوم{' '}
                <span className="font-mono font-bold">{businessTodayStr}</span>.
              </p>
            </div>
          </div>

          {canToggleCaissePrivacy && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {sessionRole === 'master' && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setDrawerModalScope('open_cycle');
                    setDrawerModalOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDrawerModalScope('open_cycle');
                      setDrawerModalOpen(true);
                    }
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/45 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 text-xs font-black flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
                  title="عرض المجموع والتفريق فـ المجر ككل"
                >
                  <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
                  <span>المجر ككل:</span>
                  <span dir="ltr" className="font-mono font-black tabular-nums">
                    {formatMAD(openCycleDrawerSummary.netTotalMAD, 'drawer_total_chip')}
                  </span>
                  {renderBoxEyeButton('drawer_total_chip', true)}
                </div>
              )}

              <button
                type="button"
                onClick={handleToggleGlobalCaisseAmounts}
                title={amountsVisible ? 'إخفاء الأرقام' : 'إظهار الأرقام'}
                aria-label={amountsVisible ? 'إخفاء الأرقام' : 'إظهار الأرقام'}
                className={`min-h-[38px] px-4 py-2 rounded-xl border text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors ${
                  amountsVisible
                    ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300'
                    : 'bg-zinc-900 dark:bg-amber-500 border-zinc-900 dark:border-amber-400 text-white dark:text-zinc-950 shadow-xs'
                }`}
              >
                {amountsVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{amountsVisible ? 'إخفاء' : 'إظهار'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {gridBarbers.map((b) => {
            const bTone = getBarberIdentityTokens(b.id, b.arName);
            const dayCount = entries.filter(
              (e) => e.barberId === b.id && e.date === businessTodayStr
            ).length;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setAutoTimerSecondsLeft(null);
                  setSelectedBarberId(b.id);
                }}
                className={`p-5 rounded-2xl border bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500/50 text-start transition-all shadow-sm hover:shadow-md cursor-pointer space-y-2 ${bTone.borderLeftClass}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`w-3 h-3 rounded-full ${bTone.dotClass}`} />
                  <span className="text-[11px] font-mono text-zinc-400">
                    {dayCount} عملية اليوم
                  </span>
                </div>
                <div className="text-base font-black text-zinc-900 dark:text-white">
                  {b.arName}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{b.name}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      {/* 1-Minute Post-Entry Auto-Return / Barber Auto-Exit Countdown Banner */}
      {autoTimerSecondsLeft !== null && (
        <div
          role="status"
          className="p-3 sm:p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/45 flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-xs"
        >
          <div className="flex items-center gap-2.5 text-amber-950 dark:text-amber-100">
            <span className="w-8 h-8 rounded-xl bg-amber-500 text-white font-mono font-black flex items-center justify-center shrink-0 tabular-nums">
              {autoTimerSecondsLeft}
            </span>
            <div className="space-y-0.5">
              <div className="font-black flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>
                  {sessionRole === 'barber'
                    ? `سيتم إغلاق جلستك والرجوع تلقائياً خلال ${autoTimerSecondsLeft} ثانية`
                    : `سيتم الرجوع إلى قائمة الحلاقين تلقائياً خلال ${autoTimerSecondsLeft} ثانية`}
                </span>
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                لحماية الخصوصية بعد تقييد العملية. اضغط "البقاء هنا" لإلغاء المؤقت.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAutoTimerSecondsLeft(null)}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 font-black text-xs cursor-pointer shrink-0"
          >
            البقاء هنا (إلغاء المؤقت)
          </button>
        </div>
      )}

      {/* Top Header + Barber Switcher (Master / Caisse) + Date Picker */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 ${activeTone.borderLeftClass}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-zinc-900 dark:text-white">
                  {sessionRole === 'barber'
                    ? 'لاكيس والحسابات ديالي'
                    : sessionRole === 'caisse'
                    ? 'لاكيس الصالون'
                    : pickLang(lang, {
                        ar: 'لاكيس والحسابات الشاملة',
                        fr: 'Caisse & Comptabilité Salon',
                        amz: 'ⵍⴰⴽⵉⵙ & ⵉⵙⵉⴹⴰⵏ',
                        en: 'Salon Caisse & Accounting',
                        es: 'Caja y Contabilidad',
                      })}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${activeTone.badgeClass}`}>
                  {activeBarberMeta.arName}
                </span>
                {(sessionRole === 'caisse' || sessionRole === 'master') && (
                  <button
                    type="button"
                    onClick={() => {
                      setAutoTimerSecondsLeft(null);
                      setSelectedBarberId('');
                    }}
                    className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                  >
                    قائمة الحلاقين
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono tabular-nums">
                {sessionRole === 'caisse'
                  ? `يوم العمل (يتجدد 03:00 صباحاً): ${businessTodayStr}`
                  : pickLang(lang, {
                      ar: `يوم العمل (يتجدد 03:00 صباحاً): ${businessTodayStr} · النسبة: ${effectivePct}%`,
                      fr: `Journée (clôture 03:00) : ${businessTodayStr} · Part : ${effectivePct}%`,
                      amz: `ⴰⵙⵙ ⵏ ⵜⵡⵓⵔⵉ (03:00): ${businessTodayStr} · ${effectivePct}%`,
                      en: `Business Day (03:00 AM cutoff): ${businessTodayStr} · Rate: ${effectivePct}%`,
                      es: `Día laboral (corte 03:00): ${businessTodayStr} · ${effectivePct}%`,
                    })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canToggleCaissePrivacy && (
              <>
                {sessionRole === 'master' && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setDrawerModalScope('open_cycle');
                      setDrawerModalOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDrawerModalScope('open_cycle');
                        setDrawerModalOpen(true);
                      }
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/45 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="عرض المجموع والتفريق فـ المجر ككل"
                  >
                    <Wallet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" />
                    <span>المجر ككل:</span>
                    <span dir="ltr" className="font-mono font-black tabular-nums">
                      {formatMAD(openCycleDrawerSummary.netTotalMAD, 'drawer_total_chip')}
                    </span>
                    {renderBoxEyeButton('drawer_total_chip', true)}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleToggleGlobalCaisseAmounts}
                  title={amountsVisible ? 'إخفاء الأرقام' : 'إظهار الأرقام'}
                  aria-label={amountsVisible ? 'إخفاء الأرقام' : 'إظهار الأرقام'}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors ${
                    amountsVisible
                      ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300'
                      : 'bg-zinc-900 dark:bg-amber-500 border-zinc-900 dark:border-amber-400 text-white dark:text-zinc-950 shadow-xs'
                  }`}
                >
                  {amountsVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{amountsVisible ? 'إخفاء' : 'إظهار'}</span>
                </button>
              </>
            )}

            <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <input
                type="date"
                value={selectedDate}
                min={sessionRole === 'barber' ? twoMonthsCutoffDate : undefined}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  const safeV =
                    sessionRole === 'barber' && v < twoMonthsCutoffDate
                      ? twoMonthsCutoffDate
                      : v;
                  setSelectedDate(safeV);
                  setSelectedMonth(safeV.slice(0, 7));
                  setSelectedYear(safeV.slice(0, 4));
                }}
                className="bg-transparent text-xs font-mono font-bold text-zinc-900 dark:text-white outline-none"
              />
            </div>

            {selectedDate !== businessTodayStr && (
              <button
                type="button"
                onClick={() => setSelectedDate(businessTodayStr)}
                className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold cursor-pointer"
              >
                {pickLang(lang, {
                  ar: 'الرجوع لليوم',
                  fr: 'Aujourd’hui',
                  amz: 'ⴰⵙⵙⴰ',
                  en: 'Back to Today',
                  es: 'Hoy',
                })}
              </button>
            )}
          </div>
        </div>

        {/* Master Admin & Caisse: Barber Selector (+ Master Commission Control) */}
        {(sessionRole === 'master' || sessionRole === 'caisse') && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(sessionRole === 'master' ? allCaisseBarbers : activeCaisseBarbers).map((b) => {
                const bTone = getBarberIdentityTokens(b.id, b.arName);
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
                    <span>{b.arName}</span>
                  </button>
                );
              })}
            </div>

            {sessionRole === 'master' && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1">
                  <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-600 dark:text-zinc-400 font-semibold">نسبة الحلاق %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={commissionInput}
                    onChange={(e) => setCommissionInput(e.target.value)}
                    className="w-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-1.5 py-0.5 text-center font-mono font-bold text-zinc-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={commissionBusy}
                    onClick={handleSaveCommission}
                    className="px-2.5 py-0.5 rounded-md bg-zinc-900 dark:bg-zinc-800 text-white font-bold text-[11px] cursor-pointer"
                  >
                    {commissionBusy ? '...' : 'حفظ'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setCommissionPeriodPanelOpen((p) => !p)}
                  className={`px-2.5 py-1 rounded-xl border font-bold text-[11px] flex items-center gap-1 cursor-pointer ${
                    commissionPeriodPanelOpen || activePeriodOverrides.length > 0
                      ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
                      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>نسبة لفترة / شهر ({activePeriodOverrides.length})</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Master Only: Period & Month % Commission Overrides Drawer */}
        {sessionRole === 'master' && commissionPeriodPanelOpen && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3 text-xs">
            <div className="font-black text-zinc-800 dark:text-zinc-200">
              تطبيق نسبة مئوية خاصة ({activeBarberMeta.arName}) لشهر أو فترة محددة (من - إلى):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 mb-1">النطاق:</label>
                <select
                  value={newPctScope}
                  onChange={(e) =>
                    setNewPctScope(e.target.value === 'month' ? 'month' : 'date_range')
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 font-bold text-zinc-900 dark:text-white"
                >
                  <option value="date_range">فترة تواريخ (من → إلى)</option>
                  <option value="month">شهر كامل (YYYY-MM)</option>
                </select>
              </div>
              {newPctScope === 'month' ? (
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold text-zinc-500 mb-1">الشهر:</label>
                  <input
                    type="month"
                    value={newPctMonth}
                    onChange={(e) => setNewPctMonth(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-900 dark:text-white"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">من تاريخ:</label>
                    <input
                      type="date"
                      value={newPctStartDate}
                      onChange={(e) => setNewPctStartDate(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">إلى تاريخ:</label>
                    <input
                      type="date"
                      value={newPctEndDate}
                      onChange={(e) => setNewPctEndDate(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-900 dark:text-white"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 mb-1">النسبة %:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newPctValue}
                  onChange={(e) => setNewPctValue(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono font-black text-zinc-900 dark:text-white"
                />
              </div>
              <button
                type="button"
                disabled={commissionBusy}
                onClick={handleAddPeriodCommissionOverride}
                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer"
              >
                إضافة النسبة ✓
              </button>
            </div>

            {activePeriodOverrides.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {activePeriodOverrides.map((ov) => (
                  <div
                    key={ov.id}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-900 dark:text-amber-200 flex items-center gap-2 font-mono text-[11px]"
                  >
                    <span className="font-bold">
                      {ov.scope === 'month' ? ov.month : `${ov.startDate} → ${ov.endDate || ov.startDate}`}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-zinc-900 font-black">
                      {ov.commissionPercent}%
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeletePeriodCommissionOverride(ov.id)}
                      className="text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Daily Per-Barber Master Note & Barber Reply Card */}
      {sessionRole !== 'caisse' && activeBarberId && (
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-amber-200 dark:border-amber-500/35 shadow-xs space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                {sessionRole === 'master'
                  ? `ملاحظة يومية للحلاق (${activeBarberMeta.arName} · ${selectedDate})`
                  : `ملاحظة الإدارة اليومية (${selectedDate})`}
              </span>
            </div>
            {currentDailyNote?.masterUpdatedAt && (
              <span className="text-[10px] font-mono text-zinc-400">
                آخر تحديث: {new Date(currentDailyNote.masterUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {sessionRole === 'master' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <form onSubmit={handleSaveMasterDailyNote} className="space-y-2">
                <textarea
                  rows={2}
                  value={masterNoteInput}
                  onChange={(e) => setMasterNoteInput(e.target.value)}
                  placeholder={`اكتب ملاحظة أو توجيه يومي لـ ${activeBarberMeta.arName}...`}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-amber-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={masterNoteBusy}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 font-black text-[11px] cursor-pointer disabled:opacity-60"
                  >
                    {masterNoteBusy ? 'جاري الحفظ...' : 'حفظ الملاحظة للحلاق ✓'}
                  </button>
                </div>
              </form>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <div className="text-[11px] font-black text-zinc-600 dark:text-zinc-400">
                  رد / إجابة الحلاق على الملاحظة:
                </div>
                {currentDailyNote?.barberReply ? (
                  <>
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      « {currentDailyNote.barberReply} »
                    </p>
                    <div className="text-[10px] font-mono text-zinc-400">
                      {currentDailyNote.barberRepliedBy || activeBarberMeta.arName} ·{' '}
                      {currentDailyNote.barberRepliedAt
                        ? new Date(currentDailyNote.barberRepliedAt).toLocaleString()
                        : ''}
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-zinc-400">لم يرد الحلاق على ملاحظة هذا اليوم بعد.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-500/35">
                {currentDailyNote?.masterNote ? (
                  <p className="text-xs font-bold text-amber-950 dark:text-amber-100 leading-relaxed">
                    {currentDailyNote.masterNote}
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    لا توجد ملاحظة مسجلة من الإدارة (Hassan) ليوم {selectedDate}.
                  </p>
                )}
              </div>

              <form onSubmit={handleSaveBarberNoteReply} className="space-y-2">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 text-[11px]">
                  الرد / الإجابة على الملاحظة:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={barberReplyInput}
                    onChange={(e) => setBarberReplyInput(e.target.value)}
                    placeholder="اكتب ردك أو تأكيدك للمشرف العام (Hassan)..."
                    className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={barberReplyBusy}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer disabled:opacity-60"
                  >
                    {barberReplyBusy ? '...' : 'إرسال الرد للإدارة ✓'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 4 Interactive Darija KPI Cards (Strictly NO Shop Share visible to Barbers; NO Commission/Profit math in Caisse role!) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. شحال حط اليوم (مع احترام إغلاق اليوم من طرف حسن) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => openDrillModal('income_day')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDrillModal('income_day');
            }
          }}
          className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-500/60 hover:shadow-md active:scale-[0.99] transition-all text-start shadow-xs space-y-1 cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block">
              {isViewingOwnAccount
                ? `شحال حطيت اليوم (${selectedDate === businessTodayStr ? 'اليوم' : selectedDate})`
                : `شحال حط ${activeBarberMeta.arName} (${selectedDate === businessTodayStr ? 'اليوم' : selectedDate})`}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {displayedDayIntakeStats.isIntakeClosed && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black">
                  مغلق ✓
                </span>
              )}
              {renderBoxEyeButton('kpi_income', true)}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {maskNum(displayedDayIntakeStats.displayedIncomeMAD, 'kpi_income')}{' '}
            <span className="text-xs font-bold">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-mono tabular-nums">
            {displayedDayIntakeStats.isIntakeClosed
              ? `المداخيل المغلقة لليوم: ${formatMAD(displayedDayIntakeStats.closedAtAmountMAD, 'kpi_income')} · اضغط للتفاصيل`
              : `${selectedDayStats.entryCount} عملية · اضغط للتفاصيل`}
          </span>
        </div>

        {/* 2. شحال هزيت / شحال هز [الاسم] */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => openDrillModal('expenses')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDrillModal('expenses');
            }
          }}
          className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-500/60 hover:shadow-md active:scale-[0.99] transition-all text-start shadow-xs space-y-1 cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block">
              {sessionRole === 'caisse'
                ? `شحال هز ${activeBarberMeta.arName} (${selectedDate === businessTodayStr ? 'اليوم' : selectedDate})`
                : isViewingOwnAccount
                ? 'شحال هزيت (السحوبات والمصاريف)'
                : `شحال هز ${activeBarberMeta.arName} (السحوبات والمصاريف)`}
            </span>
            {renderBoxEyeButton('kpi_expenses', true)}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-rose-700 dark:text-rose-400">
            {maskNum(
              sessionRole === 'caisse'
                ? selectedDayStats.expensesMAD
                : cycleBalance.expensesMAD,
              'kpi_expenses'
            )}{' '}
            <span className="text-xs font-bold">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-mono tabular-nums">
            {sessionRole === 'caisse'
              ? 'مجموع السحوبات والمصاريف · اضغط للتفاصيل'
              : selectedDate === businessTodayStr
              ? `اليوم: ${formatMAD(selectedDayStats.expensesMAD, 'kpi_expenses')} · اضغط للتفاصيل`
              : `${selectedDate}: ${formatMAD(selectedDayStats.expensesMAD, 'kpi_expenses')} · اضغط للتفاصيل`}
          </span>
        </div>

        {/* 3. الصافي التراكمي (Master/Barber) OR صافي المجر اليومي (Caisse Mode) */}
        {sessionRole === 'caisse' ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => openDrillModal('net_balance')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDrillModal('net_balance');
              }
            }}
            className={`p-4 rounded-2xl border shadow-xs hover:shadow-md hover:border-amber-400 active:scale-[0.99] transition-all text-start space-y-1 cursor-pointer group ${activeTone.softSurfaceClass}`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block">
                الفلوس فـ المجر — {activeBarberMeta.arName} ({selectedDate === businessTodayStr ? 'اليوم' : selectedDate})
              </span>
              {renderBoxEyeButton('kpi_net', true)}
            </div>
            <div
              dir="ltr"
              className="inline-flex items-baseline gap-1 text-xl sm:text-2xl font-black font-mono tabular-nums text-zinc-900 dark:text-white"
            >
              <span>{maskNum(selectedDayStats.drawerCashMAD, 'kpi_net')}</span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                MAD
              </span>
            </div>
            <span className="text-[10px] block text-zinc-500 dark:text-zinc-400">
              المداخيل − السحوبات فـ المجر · اضغط للتفاصيل
            </span>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => openDrillModal('net_balance')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDrillModal('net_balance');
              }
            }}
            className={`p-4 rounded-2xl border shadow-xs hover:shadow-md hover:border-amber-400 active:scale-[0.99] transition-all text-start space-y-1 cursor-pointer group ${
              cycleBalance.barberNetOwedMAD < 0
                ? 'bg-rose-50/90 dark:bg-rose-950/35 border-rose-300 dark:border-rose-500/50'
                : activeTone.softSurfaceClass
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block">
                {isViewingOwnAccount
                  ? 'شحال بقى ليا (الصافي التراكمي)'
                  : `شحال كيتسال ${activeBarberMeta.arName} (الصافي التراكمي)`}
              </span>
              {renderBoxEyeButton('kpi_net', true)}
            </div>
            <div
              dir="ltr"
              className={`inline-flex items-baseline gap-1 text-xl sm:text-2xl font-black font-mono tabular-nums ${
                cycleBalance.barberNetOwedMAD < 0
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-zinc-900 dark:text-white'
              }`}
            >
              <span>{maskNum(cycleBalance.barberNetOwedMAD, 'kpi_net')}</span>
              <span
                className={`text-xs font-bold ${
                  cycleBalance.barberNetOwedMAD < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                MAD
              </span>
            </div>
            <span
              className={`text-[10px] block ${
                cycleBalance.barberNetOwedMAD < 0
                  ? 'text-rose-700 dark:text-rose-300 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {cycleBalance.barberNetOwedMAD < 0
                ? 'رصيد سالب — السحوبات تجاوزت المستحقات · اضغط للتفاصيل'
                : cycleBalance.lastSettledDate
                ? `من بعد تصفية ${cycleBalance.lastSettledDate} · اضغط للتفاصيل`
                : 'تراكمي حتى تصفية الحساب · اضغط للتفاصيل'}
            </span>
          </div>
        )}

        {/* 4. مجموع الكريدي */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => openDrillModal('credits_all')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDrillModal('credits_all');
            }
          }}
          className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 hover:border-orange-400 dark:hover:border-orange-500/60 hover:shadow-md active:scale-[0.99] transition-all text-start shadow-xs space-y-1 cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block">
              مجموع الكريدي (كل التواريخ)
            </span>
            {renderBoxEyeButton('kpi_credits', true)}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-orange-700 dark:text-orange-400">
            {maskNum(cycleBalance.openCreditsAllTimeMAD, 'kpi_credits')}{' '}
            <span className="text-xs font-bold">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-mono tabular-nums">
            {openCreditsList.length} كريدي مفتوح · اضغط للتفاصيل
          </span>
        </div>
      </div>

      {/* Overdrawn / Negative Cumulative Balance Alert (Master / Barber only) */}
      {sessionRole !== 'caisse' && cycleBalance.barberNetOwedMAD < 0 && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/50 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5 shadow-2xs"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-black">
              تنبيه: السحوبات والمصاريف تجاوزت المستحقات المتاحة في الصندوق
            </div>
            <p className="text-[11px] leading-relaxed">
              الرصيد التراكمي الحالي هو{' '}
              <strong dir="ltr" className="font-mono inline-block">
                {formatMAD(cycleBalance.barberNetOwedMAD)}
              </strong>
              . سيبقى هذا الفارق السالب مسجلاً حتى تغطيته من المداخيل القادمة أو تصفية الدورة.
            </p>
          </div>
        </div>
      )}

      {/* Clear Top Darija Quick Action Buttons Directly Below KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => {
            setDuplicateWarning(null);
            setOpenForm('income');
          }}
          className={`min-h-[48px] px-4 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-xs ${
            openForm === 'income'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
              : 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/35 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
          }`}
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>غانحط في المجر</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDuplicateWarning(null);
            setOpenForm('expense');
          }}
          className={`min-h-[48px] px-4 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-xs ${
            openForm === 'expense'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md'
              : 'bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/35 hover:bg-rose-50 dark:hover:bg-rose-950/30'
          }`}
        >
          <MinusCircle className="w-4 h-4 shrink-0" />
          <span>غانهز من المجر</span>
        </button>

        {sessionRole === 'master' && (
          <button
            type="button"
            onClick={() => {
              setDuplicateWarning(null);
              setOpenForm('float');
            }}
            className={`col-span-2 sm:col-span-1 min-h-[48px] px-4 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-xs ${
              openForm === 'float'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                : 'bg-white dark:bg-zinc-900 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/35 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span>فلوس الصرف</span>
          </button>
        )}
      </div>

      {/* Master-Only Daily Intake Close + Cumulative/Period Payout Settlement Bar */}
      {sessionRole === 'master' && (
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div
              role="button"
              tabIndex={0}
              onClick={() => openDrillModal('income_day')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDrillModal('income_day');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-amber-400 text-start transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 block text-[11px]">
                  {isViewingOwnAccount
                    ? `اللي دخلت (${selectedDate})`
                    : `اللي دخل ${activeBarberMeta.arName} (${selectedDate})`}
                </span>
                {renderBoxEyeButton('sum_income_day', true)}
              </div>
              <span className="font-mono font-black text-base text-zinc-900 dark:text-white tabular-nums">
                {formatMAD(selectedDayStats.incomeMAD, 'sum_income_day')}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => openDrillModal('shop_day')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDrillModal('shop_day');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 text-start transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 block text-[11px]">
                  حصة المحل ({selectedDate})
                </span>
                {renderBoxEyeButton('sum_shop_day', true)}
              </div>
              <span className="font-mono font-black text-base text-zinc-900 dark:text-white tabular-nums">
                {formatMAD(selectedDayStats.shopShareMAD, 'sum_shop_day')}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => openDrillModal('shop_cycle')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDrillModal('shop_cycle');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-400 text-start transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500 dark:text-zinc-400 block text-[11px]">
                  حصة المحل في الدورة المفتوحة
                </span>
                {renderBoxEyeButton('sum_shop_cycle', true)}
              </div>
              <span className="font-mono font-black text-base text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatMAD(cycleBalance.shopShareMAD, 'sum_shop_cycle')}
              </span>
            </div>

            {activeBarberId === 'hassan' && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => openDrillModal('float_cycle')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDrillModal('float_cycle');
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 hover:border-amber-400 text-start transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[11px]">
                    فلوس الصرف (الدورة)
                  </span>
                  {renderBoxEyeButton('sum_float_cycle', true)}
                </div>
                <span className="font-mono font-black text-base text-amber-700 dark:text-amber-300 tabular-nums">
                  {formatMAD(cycleBalance.floatMAD, 'sum_float_cycle')}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={dailyIntakeCloseBusy}
              onClick={handleCloseDayIntake}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer border transition-colors ${
                selectedDaySettlement?.intakeClosed
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {dailyIntakeCloseBusy
                  ? 'جاري الإغلاق...'
                  : selectedDaySettlement?.intakeClosed
                  ? `إعادة إغلاق مداخيل اليوم (دخل: ${formatMAD(selectedDayStats.incomeMAD)})`
                  : `إغلاق مداخيل اليوم (حسب اللي دخل: ${formatMAD(selectedDayStats.incomeMAD)})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPayoutConfirmOpen((p) => !p)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-zinc-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                تصفية الحساب الشامل / الشهري (
                <span dir="ltr" className="font-mono inline-block">
                  {formatMAD(cycleBalance.barberNetOwedMAD)}
                </span>
                )
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Master Payout Settlement Confirmation Drawer (Full Open / Monthly / Custom Period) */}
      {sessionRole === 'master' && payoutConfirmOpen && (
        <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-300 dark:border-amber-500/40 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-black text-amber-900 dark:text-amber-200">
              تصفية حساب {activeBarberMeta.arName}:
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'full_open', label: 'كل الحساب المفتوح' },
                  { id: 'month', label: 'تصفية شهر كامل' },
                  { id: 'custom_range', label: 'فترة مخصصة (من → إلى)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPayoutScope(opt.id)}
                  className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${
                    payoutScope === opt.id
                      ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-zinc-900 dark:border-amber-400'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-amber-200 dark:border-zinc-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {payoutScope === 'month' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">اختر الشهر:</span>
              <input
                type="month"
                value={payoutMonth}
                onChange={(e) => e.target.value && setPayoutMonth(e.target.value)}
                className="bg-white dark:bg-zinc-950 border border-amber-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 font-mono font-bold text-zinc-900 dark:text-white"
              />
            </div>
          )}

          {payoutScope === 'custom_range' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">من:</span>
              <input
                type="date"
                value={payoutStartDate}
                onChange={(e) => setPayoutStartDate(e.target.value)}
                className="bg-white dark:bg-zinc-950 border border-amber-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 font-mono text-zinc-900 dark:text-white"
              />
              <span className="font-bold text-zinc-700 dark:text-zinc-300">إلى:</span>
              <input
                type="date"
                value={payoutEndDate}
                onChange={(e) => setPayoutEndDate(e.target.value)}
                className="bg-white dark:bg-zinc-950 border border-amber-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 font-mono text-zinc-900 dark:text-white"
              />
            </div>
          )}

          <p className="text-zinc-700 dark:text-zinc-300">
            الصافي المستحق للحلاق:{' '}
            <strong dir="ltr" className="font-mono inline-block">
              {formatMAD(payoutPreview.cycleBalance.barberNetOwedMAD)}
            </strong>{' '}
            · مجموع المداخيل:{' '}
            <strong className="font-mono">{formatMAD(payoutPreview.cycleBalance.incomeMAD)}</strong> · حصة المحل:{' '}
            <strong className="font-mono">{formatMAD(payoutPreview.cycleBalance.shopShareMAD)}</strong> ·{' '}
            <span className="font-mono">{payoutPreview.cycleBalance.openCycleEntries.length} عملية</span>.
            (السجل التاريخي والإحصائيات السنوية لن تُحذف أبداً).
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={payoutNote}
              onChange={(e) => setPayoutNote(e.target.value)}
              placeholder="ملاحظة التصفية (اختيارية)..."
              className="flex-1 bg-white dark:bg-zinc-950 border border-amber-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white"
            />
            <button
              type="button"
              disabled={payoutBusy}
              onClick={handleConfirmPayout}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer disabled:opacity-60"
            >
              {payoutBusy
                ? '...'
                : payoutScope === 'full_open'
                ? 'تأكيد وتصفير الرصيد إلى 0 ✓'
                : 'تأكيد تصفية الفترة المختارة ✓'}
            </button>
            <button
              type="button"
              onClick={() => setPayoutConfirmOpen(false)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Daily In / Out Per-Day Breakdown ("شحال حط كل نهار و شحال هز كل نهار") */}
      {sessionRole !== 'caisse' && dailyInOutHistory.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <span>
                {isViewingOwnAccount
                  ? 'ملخص الأيام الأخيرة: شحال حطيت كل نهار وشحال هزيت'
                  : `ملخص الأيام الأخيرة (${activeBarberMeta.arName}): شحال حط كل نهار وشحال هز`}
              </span>
            </h4>
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
              {isViewingOwnAccount
                ? `رصيدي المستحق (${formatMAD(cycleBalance.barberNetOwedMAD)}) يبقى محفوظاً حتى تصفية الحساب`
                : `الرصيد المستحق لـ ${activeBarberMeta.arName} (${formatMAD(cycleBalance.barberNetOwedMAD)}) يبقى محفوظاً حتى تصفية الحساب`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {dailyInOutHistory.slice(0, 6).map((row) => (
              <button
                key={row.date}
                type="button"
                onClick={() => setSelectedDate(row.date)}
                className={`p-2.5 rounded-xl border text-start transition-colors cursor-pointer space-y-1 ${
                  row.date === selectedDate
                    ? 'bg-amber-50/80 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40'
                    : 'bg-zinc-50 dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono font-bold text-[11px] text-zinc-900 dark:text-white">
                    {row.date.slice(5)}
                  </span>
                  {row.isIntakeClosed && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black">
                      مغلق
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">
                  حط: {formatMAD(row.incomeMAD)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-rose-600 dark:text-rose-400 font-bold">
                  هز: {formatMAD(row.expensesMAD)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Centered Modal 1: غانحط في المجر (Prices strictly hidden on services; quick suggestion chips on amount input) */}
      {openForm === 'income' && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => {
            setOpenForm('none');
            setDuplicateWarning(null);
          }}
        >
          <form
            onSubmit={(e) => handleSubmitIncome(e, false)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-950 border-2 border-emerald-500/45 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
              <span className="font-black text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                <span>غانحط في المجر — {activeBarberMeta.arName}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpenForm('none');
                  setDuplicateWarning(null);
                }}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {duplicateWarning?.kind === 'income' && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-400 dark:border-amber-500/60 space-y-2 text-amber-950 dark:text-amber-100"
              >
                <div className="font-black flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    تنبيه: راه يلاه قيد نفس الرقم ({duplicateWarning.amount} MAD)
                    {duplicateWarning.matchedTimeLabel ? ` مع ${duplicateWarning.matchedTimeLabel}` : ''}
                    {duplicateWarning.matchedNote ? ` (${duplicateWarning.matchedNote})` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={incomeSubmitting}
                    onClick={() => handleSubmitIncome(undefined, true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] cursor-pointer"
                  >
                    نعم، قيدها مرة أخرى ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-[11px] cursor-pointer"
                  >
                    تعديل المبلغ
                  </button>
                </div>
              </div>
            )}

            {/* Service Selection Grid — STRICTLY NO PRICES SHOWN */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                الخدمات المنجزة (اختيارية):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {barberServices.map((srv) => {
                  const isSelected = selectedServiceIds.includes(srv.id);
                  const label =
                    lang === 'fr'
                      ? srv.nameFr
                      : lang === 'en' || lang === 'es'
                      ? srv.nameEn
                      : srv.nameAr;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => toggleServiceSelection(srv.id)}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-start font-bold text-xs flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:border-emerald-400'
                      }`}
                    >
                      <span className="truncate">{label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block font-bold text-zinc-800 dark:text-zinc-200">
                  شحال حط في المجر (MAD) *
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={amountPaidInput}
                  onChange={(e) => {
                    setAmountPaidInput(e.target.value);
                    setDuplicateWarning(null);
                  }}
                  placeholder="0"
                  autoFocus
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-base font-mono font-black tabular-nums text-zinc-900 dark:text-white outline-none"
                />
                {caisseQuickSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold text-zinc-400">اقتراح سريع:</span>
                    {caisseQuickSuggestions.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setAmountPaidInput(String(chip));
                          setDuplicateWarning(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-black tabular-nums border cursor-pointer transition-colors ${
                          Number(amountPaidInput) === chip
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-emerald-400'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  ملاحظة (اختيارية)
                </label>
                <input
                  type="text"
                  value={incomeNote}
                  onChange={(e) => setIncomeNote(e.target.value)}
                  placeholder="مثال: زبون عابر / صباغة..."
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white outline-none"
                />
              </div>
            </div>

            {/* Optional Credit Toggle ("واش عندو كريدي؟") — easy dual input for barbers */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setHasCreditToggle((p) => !p)}
                className={`w-full min-h-[42px] px-3 py-2 rounded-xl border font-bold text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  hasCreditToggle
                    ? 'bg-orange-50 dark:bg-orange-950/35 border-orange-300 dark:border-orange-500/45 text-orange-800 dark:text-orange-200'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-orange-500" />
                  <span>واش عندو كريدي؟ (تسجيل باقي على الزبون)</span>
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/5 dark:bg-white/10">
                  {hasCreditToggle ? 'مفعل ✓' : 'اختياري'}
                </span>
              </button>

              {hasCreditToggle && (
                <div className="p-3.5 rounded-xl bg-orange-50/70 dark:bg-orange-950/25 border border-orange-200 dark:border-orange-500/35 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block font-bold text-orange-900 dark:text-orange-200 mb-1">
                        مبلغ الكريدي الباقي (MAD)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={computedCreditRemaining > 0 ? String(computedCreditRemaining) : ''}
                        onChange={(e) => {
                          const rem = Math.max(0, Number(e.target.value) || 0);
                          setAgreedTotalInput(String(paidNum + rem));
                        }}
                        placeholder="0"
                        className="w-full bg-white dark:bg-zinc-950 border border-orange-300 dark:border-orange-500/50 rounded-lg px-3 py-2 font-mono font-black text-orange-700 dark:text-orange-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        أو الإجمالي المتفق عليه (MAD)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={agreedTotalInput}
                        onChange={(e) => setAgreedTotalInput(e.target.value)}
                        placeholder={String(paidNum)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 font-mono font-bold text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div className="p-2 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-orange-200/80 dark:border-zinc-800 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        الكريدي المسجل:
                      </span>
                      <span className="text-base font-black font-mono tabular-nums text-orange-700 dark:text-orange-300">
                        {computedCreditRemaining} MAD
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        اسم الزبون
                      </label>
                      <input
                        type="text"
                        value={creditClientName}
                        onChange={(e) => setCreditClientName(e.target.value)}
                        placeholder="اسم الزبون..."
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        رقم الهاتف (لتنبيه الكريدي)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={creditClientPhone}
                        onChange={(e) => setCreditClientPhone(e.target.value)}
                        placeholder="06..."
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-mono text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        تاريخ الأداء المتوقع
                      </label>
                      <input
                        type="date"
                        value={creditExpectedDate}
                        onChange={(e) => setCreditExpectedDate(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-mono text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpenForm('none');
                  setDuplicateWarning(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={incomeSubmitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
              >
                {incomeSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>تأكيد وحط في المجر</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Centered Modal 2: غانهز من المجر (Expense / Withdrawal) */}
      {openForm === 'expense' && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => {
            setOpenForm('none');
            setDuplicateWarning(null);
          }}
        >
          <form
            onSubmit={(e) => handleSubmitExpense(e, false)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-950 border-2 border-rose-500/45 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
              <span className="font-black text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <MinusCircle className="w-4 h-4" />
                <span>غانهز من المجر — {activeBarberMeta.arName}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpenForm('none');
                  setDuplicateWarning(null);
                }}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {duplicateWarning?.kind === 'expense' && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-400 dark:border-amber-500/60 space-y-2 text-amber-950 dark:text-amber-100"
              >
                <div className="font-black flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    تنبيه: راه يلاه قيد نفس الرقم ({duplicateWarning.amount} MAD)
                    {duplicateWarning.matchedTimeLabel ? ` مع ${duplicateWarning.matchedTimeLabel}` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={expenseSubmitting}
                    onClick={() => handleSubmitExpense(undefined, true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] cursor-pointer"
                  >
                    نعم، قيدها مرة أخرى ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-[11px] cursor-pointer"
                  >
                    تعديل المبلغ
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {bookings.length > 0 && (
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    جلب مبلغ من موعد (اختياري)
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const picked = bookings.find((b) => b.id === e.target.value);
                      if (!picked) return;
                      const amt = Math.max(0, Math.round(Number(picked.finalTotalMAD) || 0));
                      setExpenseAmount(String(amt));
                      setExpenseNote(
                        `موعد ${picked.ticketNumber} · ${picked.clientName} (${picked.barberName})`
                      );
                      setDuplicateWarning(null);
                    }}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                  >
                    <option value="">— اختر موعداً لتعبئة المبلغ تلقائياً —</option>
                    {bookings
                      .filter(
                        (b) =>
                          b.status !== 'cancelled' &&
                          b.status !== 'rejected' &&
                          Number(b.finalTotalMAD) >= 0
                      )
                      .sort((a, b) => {
                        const aToday = a.date === businessTodayStr ? 1 : 0;
                        const bToday = b.date === businessTodayStr ? 1 : 0;
                        if (aToday !== bToday) return bToday - aToday;
                        const aBarber = a.barberId === activeBarberId ? 1 : 0;
                        const bBarber = b.barberId === activeBarberId ? 1 : 0;
                        if (aBarber !== bBarber) return bBarber - aBarber;
                        return `${b.date} ${b.timeSlot}`.localeCompare(`${a.date} ${a.timeSlot}`);
                      })
                      .slice(0, 25)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.date} {b.timeSlot} · {b.ticketNumber} · {b.clientName} ({b.barberName}) — {Math.round(Number(b.finalTotalMAD) || 0)} MAD
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  شحال هزيت (MAD) *
                </label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={expenseAmount}
                  onChange={(e) => {
                    setExpenseAmount(e.target.value);
                    setDuplicateWarning(null);
                  }}
                  placeholder="0"
                  required
                  autoFocus
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-base font-mono font-black tabular-nums text-zinc-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  السبب / ملاحظة (اختيارية)
                </label>
                <input
                  type="text"
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="مثال: تسبيق، قهوة، مستلزمات..."
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpenForm('none');
                  setDuplicateWarning(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={expenseSubmitting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تسجيل السحب</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Centered Modal 3: فلوس الصرف (Master Admin Float) */}
      {sessionRole === 'master' && openForm === 'float' && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setOpenForm('none')}
        >
          <form
            onSubmit={handleSubmitFloat}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-950 border-2 border-amber-500/45 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
              <span className="font-black text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <Coins className="w-4 h-4" />
                <span>إضافة فلوس الصرف</span>
              </span>
              <button
                type="button"
                onClick={() => setOpenForm('none')}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  المبلغ (MAD) *
                </label>
                <input
                  type="number"
                  min={1}
                  value={floatAmount}
                  onChange={(e) => setFloatAmount(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-base font-mono font-black text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  ملاحظة
                </label>
                <input
                  type="text"
                  value={floatNote}
                  onChange={(e) => setFloatNote(e.target.value)}
                  placeholder="فلوس الصرف لليوم"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenForm('none')}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={floatSubmitting}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer"
              >
                حفظ فلوس الصرف
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Open Credits Section (Persists Across ALL Dates Until Repaid; Editable by Barber & Master) */}
      {(openCreditsList.length > 0 || openBarberDisputes.length > 0) && (
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-orange-200 dark:border-orange-500/35 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-black text-orange-800 dark:text-orange-300 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-orange-500" />
              <span>الكريدي المفتوح (مستمر عبر كل الأيام حتى الأداء)</span>
            </h4>
            <span className="text-xs font-mono font-black text-orange-700 dark:text-orange-300 tabular-nums">
              {formatMAD(openCreditsList.reduce((s, e) => s + (Number(e.creditRemainingMAD) || 0), 0))}
            </span>
          </div>

          {openBarberDisputes.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/40 space-y-2 text-xs">
              <div className="font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>اعتراضات أو استفسارات زبناء حول الكريدي ({openBarberDisputes.length}):</span>
              </div>
              {openBarberDisputes.map((disp) => (
                <div
                  key={disp.id}
                  className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/90 border border-amber-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>{disp.clientName}</span>
                      <span dir="ltr" className="font-mono text-[11px] text-zinc-500">{disp.clientPhone}</span>
                      <span className="text-[10px] font-mono text-orange-700 dark:text-orange-300">
                        ({formatMAD(disp.totalOwedSnapshotMAD)})
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-700 dark:text-zinc-300">{disp.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void updateCreditDisputeStatus(disp.id, {
                        status: 'resolved',
                        resolvedBy: staffName,
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                  >
                    تمت المعالجة ✓
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {openCreditsList.map((ce) => {
              const isRepaying = repayingEntryId === ce.id;
              const canEditCredit =
                sessionRole === 'master' ||
                (sessionRole === 'barber' && ce.barberId === activeBarberId);
              const waUrl = buildCreditWhatsAppReminderUrl({
                clientPhone: ce.clientPhone,
                clientName: ce.clientName,
                amountOwedMAD: ce.creditRemainingMAD,
                creditorName: activeBarberMeta.arName,
                creditDate: ce.date,
                note: ce.note,
                lang,
              });
              return (
                <div
                  key={ce.id}
                  className="p-3 rounded-xl bg-orange-50/60 dark:bg-zinc-950/80 border border-orange-200/80 dark:border-zinc-800 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-zinc-900 dark:text-white">
                        {ce.clientName || 'زبون'}
                      </span>
                      {ce.clientPhone && (
                        <span dir="ltr" className="font-mono text-zinc-500 dark:text-zinc-400">
                          {ce.clientPhone}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        · {ce.date}
                      </span>
                      {ce.expectedRepaymentDate && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-orange-200 dark:border-zinc-700 text-orange-700 dark:text-orange-300 font-mono">
                          موعد الأداء: {ce.expectedRepaymentDate}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-orange-700 dark:text-orange-300 tabular-nums me-1">
                        الباقي: {formatMAD(ce.creditRemainingMAD)}
                      </span>
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] inline-flex items-center gap-1 hover:bg-emerald-100 dark:hover:bg-emerald-500/25"
                          title="إرسال تذكير مباشر عبر واتساب"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساب</span>
                        </a>
                      )}
                      {canEditCredit && (
                        <button
                          type="button"
                          onClick={() => openEditModalForEntry(ce)}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-[11px] flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                          title="تعديل بيانات ومبلغ الكريدي"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isRepaying) {
                            setRepayingEntryId(null);
                          } else {
                            setRepayingEntryId(ce.id);
                            setRepayAmountInput(String(ce.creditRemainingMAD));
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                      >
                        خلص الكريدي
                      </button>
                    </div>
                  </div>

                  {ce.note && (
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      ملاحظة: {ce.note}
                    </div>
                  )}

                  {isRepaying && (
                    <div className="pt-2 border-t border-orange-200/60 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={ce.creditRemainingMAD}
                        value={repayAmountInput}
                        onChange={(e) => setRepayAmountInput(e.target.value)}
                        className="w-28 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-zinc-900 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={repayBusy}
                        onClick={() => handleConfirmRepay(ce)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer"
                      >
                        {repayBusy ? '...' : `تأكيد الأداء ليوم ${businessTodayStr}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRepayingEntryId(null)}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Single-Line Expandable Transaction Log */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
          <div>
            <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>سجل العمليات</span>
              <span className="text-xs font-mono text-zinc-400 tabular-nums">
                ({visibleEntries.length})
              </span>
            </h4>
            {sessionRole === 'barber' && (
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                الأرشيف الشخصي يعرض آخر شهرين فقط (من {twoMonthsCutoffDate}) — الكريدي المفتوح يبقى ظاهراً دائماً حتى الأداء.
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl text-[11px] font-bold">
            {(
              [
                { id: 'day', label: selectedDate === businessTodayStr ? 'اليوم' : selectedDate },
                { id: 'cycle', label: 'الدورة المفتوحة' },
                { id: 'all', label: 'الأحدث' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTxScopeFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  txScopeFilter === tab.id
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {visibleEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
            لا توجد عمليات مسجلة في هذا العرض بعد.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {visibleEntries.map((entry) => {
              const badge = formatEntryTypeBadge(entry.type);
              const isExpanded = Boolean(expandedEntryIds[entry.id]);
              const primaryLabel =
                entry.serviceNames && entry.serviceNames.length > 0
                  ? entry.serviceNames.join(' + ')
                  : entry.note?.trim() || entry.clientName || badge.label;
              const timePart = entry.createdAt
                ? new Date(entry.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              return (
                <div key={entry.id} className="py-2 first:pt-0 last:pb-0">
                  {/* Single-Line Compact Row */}
                  <button
                    type="button"
                    onClick={() => toggleEntryExpanded(entry.id)}
                    className="w-full min-h-[42px] px-2.5 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center justify-between gap-2 text-start transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {primaryLabel}
                      </span>
                      {Number(entry.creditRemainingMAD) > 0 && entry.creditStatus !== 'paid' && (
                        <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 text-[10px] font-mono font-bold shrink-0">
                          كريدي {maskNum(entry.creditRemainingMAD)}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0 hidden sm:inline">
                        {entry.date} · {timePart}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        dir="ltr"
                        className={`text-xs sm:text-sm font-black font-mono tabular-nums ${
                          entry.type === 'expense'
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {badge.sign}
                        {formatMAD(entry.amountPaidMAD)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Row Details */}
                  {isExpanded && (
                    <div className="mt-1.5 mx-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/90 border border-zinc-200 dark:border-zinc-800 space-y-2 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-zinc-600 dark:text-zinc-400">
                        <span>
                          التاريخ: <strong className="font-mono text-zinc-900 dark:text-white">{entry.date}</strong> · {timePart}
                        </span>
                        <span>
                          سجله: <strong className="text-zinc-900 dark:text-white">{entry.createdByName}</strong>
                        </span>
                      </div>

                      {entry.serviceNames && entry.serviceNames.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Scissors className="w-3 h-3 text-zinc-400" />
                          {entry.serviceNames.map((sn, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold"
                            >
                              {sn}
                            </span>
                          ))}
                        </div>
                      )}

                      {(entry.clientName || entry.clientPhone) && (
                        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{entry.clientName || 'زبون'}</span>
                          {entry.clientPhone && (
                            <span dir="ltr" className="font-mono text-zinc-500">
                              {entry.clientPhone}
                            </span>
                          )}
                        </div>
                      )}

                      {Number(entry.creditAmountMAD) > 0 && (
                        <div className="text-orange-700 dark:text-orange-300 font-mono">
                          الإجمالي المتفق عليه: {formatMAD(entry.expectedAmountMAD)} · أصل الكريدي:{' '}
                          {formatMAD(entry.creditAmountMAD)} · الباقي: {formatMAD(entry.creditRemainingMAD)}
                        </div>
                      )}

                      {entry.note && (
                        <div className="text-zinc-600 dark:text-zinc-300">
                          ملاحظة: {entry.note}
                        </div>
                      )}

                      {/* Edit (Master Admin OR owning Barber for their income/credit entries) & Master-Only Delete */}
                      {(sessionRole === 'master' ||
                        (sessionRole === 'barber' &&
                          entry.barberId === activeBarberId &&
                          (entry.type === 'income' ||
                            Number(entry.creditAmountMAD) > 0 ||
                            Number(entry.creditRemainingMAD) > 0))) && (
                        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModalForEntry(entry)}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>
                          {sessionRole === 'master' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>حذف</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Entry & Credit Edit Modal (Master Admin & owning Barber for their credits) */}
      {editingEntry &&
        (sessionRole === 'master' ||
          (sessionRole === 'barber' && editingEntry.barberId === activeBarberId)) && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <form
            onSubmit={handleSaveEntryEdit}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 space-y-3.5 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
              <span className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                <span>تعديل بيانات العملية والكريدي</span>
              </span>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  المبلغ المؤدى (MAD)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editPaid}
                  onChange={(e) => setEditPaid(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono font-bold text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-orange-700 dark:text-orange-300 mb-1">
                  الكريدي المتبقي (MAD)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editCreditRem}
                  onChange={(e) => setEditCreditRem(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-orange-300 dark:border-orange-500/40 rounded-xl px-3 py-2 font-mono font-black text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  اسم الزبون
                </label>
                <input
                  type="text"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  placeholder="اسم الزبون..."
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={editClientPhone}
                  onChange={(e) => setEditClientPhone(e.target.value)}
                  placeholder="06..."
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div className={sessionRole === 'master' ? 'grid grid-cols-2 gap-3' : ''}>
              {sessionRole === 'master' && (
                <div>
                  <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    تاريخ العملية
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
                  />
                </div>
              )}
              <div>
                <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  موعد الأداء المتوقع
                </label>
                <input
                  type="date"
                  value={editRepayDate}
                  onChange={(e) => setEditRepayDate(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                ملاحظة / تفاصيل الكريدي
              </label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="ملاحظة الأداء أو التعديل..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={editBusy}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer"
              >
                {editBusy ? '...' : 'حفظ التعديلات ✓'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Master Admin Only: Comprehensive Accountant & Reporting Suite */}
      {sessionRole === 'master' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>تقرير المحاسب العام (الإدارة فقط)</span>
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                حساب كل نهار لي ديال المحل · الفترات العشرية · نهاية الشهر · التراكمي السنوي · أرشيف 03:00 صباحاً
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              {(
                [
                  { id: 'periods', label: 'النهار والشهر (10 أيام)', icon: CalendarRange },
                  { id: 'annual', label: 'التراكمي السنوي', icon: BarChart3 },
                  { id: 'cycles', label: 'تصفية الحسابات', icon: CheckCircle2 },
                  { id: 'archives', label: 'أرشيف 03:00 ص', icon: Archive },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAccountantTab(t.id)}
                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 border cursor-pointer transition-colors ${
                      accountantTab === t.id
                        ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-zinc-900 dark:border-amber-400'
                        : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {accountantTab === 'periods' && (
            <div className="space-y-4">
              {/* Today / Selected Date Shop Share Breakdown ("حساب كل نهار لي ديال المحل") */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black text-emerald-900 dark:text-emerald-200">
                    حساب كل نهار لي ديال المحل ({selectedDate}):
                  </span>
                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span className="text-zinc-600 dark:text-zinc-300">
                      إجمالي الصالون: <strong>{formatMAD(todayShopSummary.totalIncome)}</strong>
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-black text-sm">
                      حصة المحل: {formatMAD(todayShopSummary.totalShopShare)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {todayShopSummary.perBarber.map(({ barber, dayStats }) => {
                    const bTone = getBarberIdentityTokens(barber.id);
                    const boxKey = `shop_barber_day_${barber.id}`;
                    return (
                      <div
                        key={barber.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDrillModal('shop_barber_day', barber.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDrillModal('shop_barber_day', barber.id);
                          }
                        }}
                        className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 text-start transition-colors cursor-pointer space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${bTone.dotClass}`} />
                            <span className="truncate">{barber.arName}</span>
                          </span>
                          {renderBoxEyeButton(boxKey, true)}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">
                          المحل: {formatMAD(dayStats.shopShareMAD, boxKey)}
                        </div>
                        <div className="text-[10px] font-mono tabular-nums text-zinc-500">
                          الدخل: {maskNum(dayStats.incomeMAD, boxKey)} · المصروف: {maskNum(dayStats.expensesMAD, boxKey)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Month Picker + 10-Day Periods */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-black text-zinc-800 dark:text-zinc-200">
                  تقسيم الشهر (1–10 / 11–20 / 21–نهاية الشهر):
                </span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 font-mono font-bold text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {monthlyRollup.periods.map((p) => {
                  const boxKey = `period_box_${p.periodIndex}`;
                  return (
                    <div
                      key={p.periodIndex}
                      className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-black text-zinc-900 dark:text-white">{p.labelAr}</div>
                        {renderBoxEyeButton(boxKey, true)}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400">{p.rangeLabel}</div>
                      <div className="pt-1 flex justify-between font-mono tabular-nums">
                        <span className="text-zinc-500">المداخيل:</span>
                        <strong className="text-zinc-900 dark:text-white">
                          {formatMAD(p.incomeMAD, boxKey)}
                        </strong>
                      </div>
                      <div className="flex justify-between font-mono tabular-nums">
                        <span className="text-zinc-500">حصة المحل:</span>
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {formatMAD(p.shopShareMAD, boxKey)}
                        </strong>
                      </div>
                      <div className="flex justify-between font-mono tabular-nums">
                        <span className="text-zinc-500">المصاريف:</span>
                        <strong className="text-rose-600 dark:text-rose-400">
                          {formatMAD(p.expensesMAD, boxKey)}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* End-of-Month Totals Per Barber/Chair Highlighting "شحال دخل المحل" & "شحال كيتسال ديال الكريدي للناس" */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {monthlyRollup.byBarber.map((row) => {
                  const bTone = getBarberIdentityTokens(row.barberId);
                  const allTimeCredits = allTimeOpenCreditsByBarber[row.barberId] || 0;
                  const boxKey = `monthly_barber_${row.barberId}`;
                  return (
                    <div
                      key={row.barberId}
                      className={`p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5 ${bTone.borderLeftClass}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-zinc-900 dark:text-white">
                          {row.arName}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-[10px] font-mono text-zinc-500">
                            {row.commissionPercent}%
                          </span>
                          {renderBoxEyeButton(boxKey, true)}
                        </span>
                      </div>
                      <div className="flex justify-between font-mono tabular-nums">
                        <span className="text-zinc-500">شحال دخل المحل ({selectedMonth}):</span>
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {formatMAD(row.shopShareMAD, boxKey)}
                        </strong>
                      </div>
                      <div className="flex justify-between font-mono tabular-nums">
                        <span className="text-zinc-500">شحال كيتسال ديال الكريدي للناس:</span>
                        <strong className="text-orange-700 dark:text-orange-400">
                          {formatMAD(allTimeCredits, boxKey)}
                        </strong>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono tabular-nums pt-0.5 border-t border-zinc-200/70 dark:border-zinc-800 flex justify-between">
                        <span>المداخيل: {maskNum(row.incomeMAD, boxKey)}</span>
                        <span>صافي الحلاق: {maskNum(row.barberNetShareMAD, boxKey)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                      <th className="py-2 px-2 text-start">الحلاق / الكرسي</th>
                      <th className="py-2 px-2 text-start">المداخيل</th>
                      <th className="py-2 px-2 text-start">المصاريف</th>
                      <th className="py-2 px-2 text-start">صافي الحلاق</th>
                      <th className="py-2 px-2 text-start">شحال دخل المحل</th>
                      <th className="py-2 px-2 text-start">شحال كيتسال ديال الكريدي للناس</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono tabular-nums">
                    {monthlyRollup.byBarber.map((row) => {
                      const allTimeCredits = allTimeOpenCreditsByBarber[row.barberId] || 0;
                      return (
                        <tr key={row.barberId}>
                          <td className="py-2 px-2 font-sans font-bold text-zinc-900 dark:text-white">
                            {row.arName} ({row.commissionPercent}%)
                          </td>
                          <td className="py-2 px-2 text-zinc-800 dark:text-zinc-200">{formatMAD(row.incomeMAD)}</td>
                          <td className="py-2 px-2 text-rose-600 dark:text-rose-400">{formatMAD(row.expensesMAD)}</td>
                          <td className="py-2 px-2 text-zinc-900 dark:text-white font-bold">
                            {formatMAD(row.barberNetShareMAD)}
                          </td>
                          <td className="py-2 px-2 text-emerald-700 dark:text-emerald-400 font-black">
                            {formatMAD(row.shopShareMAD)}
                          </td>
                          <td className="py-2 px-2 text-orange-600 dark:text-orange-400 font-bold">
                            {formatMAD(allTimeCredits)}
                            {row.openCreditsMAD !== allTimeCredits && (
                              <span className="text-[10px] text-zinc-400 ms-1">
                                ({selectedMonth}: {maskNum(row.openCreditsMAD)})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 font-mono font-black tabular-nums">
                      <td className="py-2 px-2 font-sans text-zinc-900 dark:text-white">
                        المجموع الشهري ({selectedMonth})
                      </td>
                      <td className="py-2 px-2 text-zinc-900 dark:text-white">
                        {formatMAD(monthlyRollup.grandTotalIncomeMAD)}
                      </td>
                      <td className="py-2 px-2 text-rose-600 dark:text-rose-400">
                        {formatMAD(monthlyRollup.grandTotalExpensesMAD)}
                      </td>
                      <td className="py-2 px-2 text-zinc-900 dark:text-white">
                        {formatMAD(monthlyRollup.grandTotalBarberSharesMAD)}
                      </td>
                      <td className="py-2 px-2 text-emerald-700 dark:text-emerald-400">
                        {formatMAD(monthlyRollup.grandTotalShopShareMAD)}
                      </td>
                      <td className="py-2 px-2 text-orange-600 dark:text-orange-400">
                        {formatMAD(monthlyRollup.grandTotalOpenCreditsMAD)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {accountantTab === 'annual' && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-black text-zinc-900 dark:text-white">
                  الإجمالي السنوي التراكمي لكل حلاق وللمحل:
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 font-mono font-bold text-zinc-900 dark:text-white"
                >
                  {['2025', '2026', '2027'].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-zinc-500 block">مداخيل السنة ({selectedYear})</span>
                    {renderBoxEyeButton('annual_income', true)}
                  </div>
                  <strong className="text-lg font-mono font-black text-zinc-900 dark:text-white tabular-nums">
                    {formatMAD(annualRollup.grandTotalIncomeMAD, 'annual_income')}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-emerald-800 dark:text-emerald-300 block">
                      صافي حصة المحل السنوية
                    </span>
                    {renderBoxEyeButton('annual_shop', true)}
                  </div>
                  <strong className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatMAD(annualRollup.grandTotalShopShareMAD, 'annual_shop')}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-zinc-500 block">مجموع حصص الحلاقين</span>
                    {renderBoxEyeButton('annual_barbers', true)}
                  </div>
                  <strong className="text-lg font-mono font-black text-zinc-900 dark:text-white tabular-nums">
                    {formatMAD(annualRollup.grandTotalBarberSharesMAD, 'annual_barbers')}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-zinc-500 block">مجموع المصاريف</span>
                    {renderBoxEyeButton('annual_expenses', true)}
                  </div>
                  <strong className="text-lg font-mono font-black text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatMAD(annualRollup.grandTotalExpensesMAD, 'annual_expenses')}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {annualRollup.byBarber.map((row) => {
                  const bTone = getBarberIdentityTokens(row.barberId);
                  const boxKey = `annual_barber_${row.barberId}`;
                  return (
                    <div
                      key={row.barberId}
                      className={`p-3 rounded-xl border bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 space-y-1 ${bTone.borderLeftClass}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-black text-zinc-900 dark:text-white">{row.arName}</div>
                        {renderBoxEyeButton(boxKey, true)}
                      </div>
                      <div className="flex justify-between font-mono tabular-nums">
                        <span className="text-zinc-500">الدخل السنوي:</span>
                        <strong>{formatMAD(row.incomeMAD, boxKey)}</strong>
                      </div>
                      <div className="flex justify-between font-mono tabular-nums">
                        <span className="text-zinc-500">حصة الحلاق:</span>
                        <strong>{formatMAD(row.barberNetShareMAD, boxKey)}</strong>
                      </div>
                      <div className="flex justify-between font-mono tabular-nums">
                        <span className="text-zinc-500">حصة المحل:</span>
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {formatMAD(row.shopShareMAD, boxKey)}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {accountantTab === 'cycles' && (
            <div className="space-y-2 text-xs">
              {cycles.length === 0 ? (
                <div className="py-6 text-center text-zinc-500">
                  لا توجد عمليات تصفية حساب مسجلة بعد.
                </div>
              ) : (
                cycles.slice(0, 30).map((cyc) => (
                  <div
                    key={cyc.id}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-black text-zinc-900 dark:text-white">
                        {getCaisseBarberMeta(cyc.barberId, roster).arName}
                      </span>{' '}
                      <span className="text-zinc-500 font-mono">· {cyc.settledThroughDate}</span>
                      {cyc.periodStartDate && cyc.periodEndDate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-mono ms-1">
                          {cyc.periodStartDate} → {cyc.periodEndDate}
                        </span>
                      )}
                      {cyc.note && <span className="text-zinc-400"> · {cyc.note}</span>}
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span>مدفوع للحلاق: <strong>{formatMAD(cyc.barberSharePaidMAD)}</strong></span>
                      <span className="text-emerald-700 dark:text-emerald-400">
                        المحل: <strong>{formatMAD(cyc.shopShareMAD)}</strong>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {accountantTab === 'archives' && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  يتم أرشفة سجل كل يوم تلقائياً عند الساعة 03:00 صباحاً دون المساس بالأرصدة التراكمية غير المدفوعة.
                </span>
              </div>
              {sortedArchives.length === 0 ? (
                <div className="py-6 text-center text-zinc-500">
                  لا توجد سجلات مؤرشفة للأيام السابقة بعد.
                </div>
              ) : (
                sortedArchives.map((arc) => (
                  <div
                    key={arc.id}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono font-black text-zinc-900 dark:text-white">
                        {arc.date}
                      </span>{' '}
                      · <span className="font-bold">{getCaisseBarberMeta(arc.barberId, roster).arName}</span> ·{' '}
                      <span className="text-zinc-500 font-mono">{arc.entryCount} عمليات</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        +{formatMAD(arc.incomeMAD + arc.repaymentIncomeMAD)}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400">-{formatMAD(arc.expensesMAD)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Interactive Drill-Down Modal for Caisse KPI & Summary Boxes (List -> Detailed Entry Breakdown) */}
      {drillModal && drillViewData && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => {
            setSelectedDrillEntry(null);
            setDrillModal(null);
          }}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                  {drillViewData.title}
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {drillViewData.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  dir="ltr"
                  className={`font-mono font-black text-base tabular-nums ${drillViewData.accentCls}`}
                >
                  {drillViewData.totalLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDrillEntry(null);
                    setDrillModal(null);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Either Clickable List OR Single Entry Detail Card */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {selectedDrillEntry ? (
                (() => {
                  const badge = formatEntryTypeBadge(selectedDrillEntry.type);
                  const entryMeta = getCaisseBarberMeta(selectedDrillEntry.barberId, roster);
                  const isOpenCred =
                    (Number(selectedDrillEntry.creditRemainingMAD) || 0) > 0 &&
                    selectedDrillEntry.creditStatus !== 'paid';
                  const waUrl = isOpenCred
                    ? buildCreditWhatsAppReminderUrl({
                        clientPhone: selectedDrillEntry.clientPhone,
                        clientName: selectedDrillEntry.clientName,
                        amountOwedMAD: selectedDrillEntry.creditRemainingMAD,
                        creditorName: entryMeta.arName,
                        creditDate: selectedDrillEntry.date,
                        note: selectedDrillEntry.note,
                        lang,
                      })
                    : null;
                  const canEditItem =
                    sessionRole === 'master' ||
                    (sessionRole === 'barber' &&
                      selectedDrillEntry.barberId === activeBarberId &&
                      (selectedDrillEntry.type === 'income' ||
                        Number(selectedDrillEntry.creditAmountMAD) > 0 ||
                        Number(selectedDrillEntry.creditRemainingMAD) > 0));
                  const exactTime = selectedDrillEntry.createdAt
                    ? new Date(selectedDrillEntry.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';

                  return (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setSelectedDrillEntry(null)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <span>← رجوع لقائمة المبالغ</span>
                      </button>

                      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 dark:border-zinc-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${badge.cls}`}>
                              {badge.label}
                            </span>
                            <span className="font-bold text-zinc-900 dark:text-white">
                              {entryMeta.arName}
                            </span>
                          </div>
                          <span
                            dir="ltr"
                            className={`text-lg font-black font-mono tabular-nums ${
                              selectedDrillEntry.type === 'expense'
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {badge.sign}
                            {formatMAD(selectedDrillEntry.amountPaidMAD)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800">
                            <span className="text-zinc-400 block">التاريخ والساعة</span>
                            <strong dir="ltr" className="font-mono text-zinc-900 dark:text-white">
                              {selectedDrillEntry.date} · {exactTime}
                            </strong>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800">
                            <span className="text-zinc-400 block">سجله</span>
                            <strong className="text-zinc-900 dark:text-white">
                              {selectedDrillEntry.createdByName}
                            </strong>
                          </div>
                        </div>

                        {selectedDrillEntry.serviceNames && selectedDrillEntry.serviceNames.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-zinc-500">الخدمات:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedDrillEntry.serviceNames.map((sn, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-800 dark:text-zinc-200"
                                >
                                  {sn}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {(selectedDrillEntry.clientName || selectedDrillEntry.clientPhone) && (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
                              <User className="w-4 h-4 text-zinc-400" />
                              <span>{selectedDrillEntry.clientName || 'زبون'}</span>
                            </div>
                            {selectedDrillEntry.clientPhone && (
                              <span dir="ltr" className="font-mono text-zinc-500 dark:text-zinc-300">
                                {selectedDrillEntry.clientPhone}
                              </span>
                            )}
                          </div>
                        )}

                        {Number(selectedDrillEntry.creditAmountMAD) > 0 && (
                          <div className="p-2.5 rounded-xl bg-orange-50/80 dark:bg-orange-950/25 border border-orange-200 dark:border-orange-500/30 font-mono text-[11px] text-orange-800 dark:text-orange-200 space-y-0.5">
                            <div>الإجمالي المتفق عليه: {formatMAD(selectedDrillEntry.expectedAmountMAD)}</div>
                            <div>أصل الكريدي: {formatMAD(selectedDrillEntry.creditAmountMAD)}</div>
                            <div className="font-black">
                              الباقي المستحق حالياً: {formatMAD(selectedDrillEntry.creditRemainingMAD)}
                            </div>
                            {selectedDrillEntry.expectedRepaymentDate && (
                              <div>موعد الأداء: {selectedDrillEntry.expectedRepaymentDate}</div>
                            )}
                          </div>
                        )}

                        {selectedDrillEntry.note && (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                            <span className="font-bold text-zinc-500">ملاحظة: </span>
                            {selectedDrillEntry.note}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300 font-bold inline-flex items-center gap-1.5"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>تذكير واتساب للزبون</span>
                            </a>
                          )}
                          {canEditItem && (
                            <button
                              type="button"
                              onClick={() => {
                                openEditModalForEntry(selectedDrillEntry);
                                setSelectedDrillEntry(null);
                                setDrillModal(null);
                              }}
                              className="px-3 py-2 rounded-xl bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 font-black inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>تعديل العملية</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : drillViewData.list.length === 0 ? (
                <div className="py-10 text-center text-zinc-500 dark:text-zinc-400">
                  لا توجد عمليات مسجلة في هذا البند بعد.
                </div>
              ) : (
                drillViewData.list.map((item) => {
                  const badge = formatEntryTypeBadge(item.type);
                  const itemTime = item.createdAt
                    ? new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';
                  const label =
                    item.serviceNames && item.serviceNames.length > 0
                      ? item.serviceNames.join(' + ')
                      : item.clientName || item.note?.trim() || badge.label;
                  const waUrl =
                    (Number(item.creditRemainingMAD) || 0) > 0 && item.creditStatus !== 'paid'
                      ? buildCreditWhatsAppReminderUrl({
                          clientPhone: item.clientPhone,
                          clientName: item.clientName,
                          amountOwedMAD: item.creditRemainingMAD,
                          creditorName: getCaisseBarberMeta(item.barberId, roster).arName,
                          creditDate: item.date,
                          note: item.note,
                          lang,
                        })
                      : null;
                  const isBeforeDayClose =
                    drillViewData.closedIso && item.createdAt <= drillViewData.closedIso;

                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                        isBeforeDayClose
                          ? 'bg-zinc-100/70 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-70'
                          : 'bg-zinc-50 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedDrillEntry(item)}
                        className="flex-1 min-w-0 flex items-center justify-between gap-2 text-start cursor-pointer"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>
                              {badge.label}
                            </span>
                            <span className="font-bold text-zinc-900 dark:text-white truncate">
                              {label}
                            </span>
                            {isBeforeDayClose && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold">
                                ضمن إغلاق اليوم
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-2 flex-wrap">
                            <span>{item.date} · {itemTime}</span>
                            {item.clientName && <span>· {item.clientName}</span>}
                            {(Number(item.creditRemainingMAD) || 0) > 0 && item.creditStatus !== 'paid' && (
                              <span className="text-orange-700 dark:text-orange-300 font-bold">
                                كريدي: {formatMAD(item.creditRemainingMAD)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            dir="ltr"
                            className={`font-mono font-black text-sm tabular-nums ${
                              item.type === 'expense'
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {badge.sign}
                            {drillModal.kind === 'credits_all'
                              ? formatMAD(item.creditRemainingMAD)
                              : formatMAD(item.amountPaidMAD)}
                          </span>
                          <Eye className="w-3.5 h-3.5 text-zinc-400" />
                        </div>
                      </button>

                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300 shrink-0"
                          title="تذكير مباشر عبر واتساب"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Master Admin "المجر ككل — المجموع والتفريق" Modal */}
      {sessionRole === 'master' && drawerModalOpen && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setDrawerModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                    المجر ككل — المجموع والتفريق
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    فلوس الصرف + مجموع المداخيل − المصاريف والسحوبات لكل حلاق
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleGlobalCaisseAmounts}
                  className={`min-h-[34px] px-3 py-1 rounded-xl border text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors ${
                    amountsVisible
                      ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300'
                      : 'bg-zinc-900 dark:bg-amber-500 border-zinc-900 dark:border-amber-400 text-white dark:text-zinc-950'
                  }`}
                >
                  {amountsVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{amountsVisible ? 'إخفاء' : 'إظهار'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerModalOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Scope Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setDrawerModalScope('open_cycle')}
                    className={`px-3 py-1.5 rounded-lg font-black text-xs cursor-pointer transition-colors ${
                      drawerModalScope === 'open_cycle'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    فـ المجر حالياً (الدورة المفتوحة)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerModalScope('day')}
                    className={`px-3 py-1.5 rounded-lg font-black text-xs cursor-pointer transition-colors ${
                      drawerModalScope === 'day'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    اليوم المحدد ({selectedDate})
                  </button>
                </div>

                <span className="text-[11px] font-mono text-zinc-500">
                  {activeDrawerSummary.entryCount} عملية مسجلة
                </span>
              </div>

              {/* Grand Formula Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-500/35">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold block">
                      فلوس الصرف (+)
                    </span>
                    {renderBoxEyeButton('drawer_float', true)}
                  </div>
                  <strong dir="ltr" className="text-base font-mono font-black text-amber-900 dark:text-amber-200 tabular-nums">
                    {formatMAD(activeDrawerSummary.totalFloatMAD, 'drawer_float')}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/35">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold block">
                      مجموع المداخيل (+)
                    </span>
                    {renderBoxEyeButton('drawer_income', true)}
                  </div>
                  <strong dir="ltr" className="text-base font-mono font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatMAD(activeDrawerSummary.totalIncomeMAD, 'drawer_income')}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-500/35">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-rose-800 dark:text-rose-300 font-bold block">
                      السحوبات والمصاريف (−)
                    </span>
                    {renderBoxEyeButton('drawer_expenses', true)}
                  </div>
                  <strong dir="ltr" className="text-base font-mono font-black text-rose-700 dark:text-rose-400 tabular-nums">
                    {formatMAD(activeDrawerSummary.totalExpensesMAD, 'drawer_expenses')}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900 dark:bg-emerald-600 text-white border border-zinc-900 dark:border-emerald-500">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-zinc-300 dark:text-emerald-100 font-bold block">
                      المجموع فـ المجر ككل
                    </span>
                    {renderBoxEyeButton('drawer_net_total', true)}
                  </div>
                  <strong dir="ltr" className="text-lg font-mono font-black text-white tabular-nums">
                    {formatMAD(activeDrawerSummary.netTotalMAD, 'drawer_net_total')}
                  </strong>
                </div>
              </div>

              {/* Per-Person / Source Breakdown ("التفريق") */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-zinc-900 dark:text-white">
                  <span>التفريق حسب كل حلاق ومصدر فـ المجر:</span>
                  <span className="text-[11px] font-normal text-zinc-500">
                    اضغط على أي حلاق لفتح حسابه
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                        <th className="py-2.5 px-3 text-start">الحلاق / المصدر</th>
                        <th className="py-2.5 px-2 text-start">الصرف</th>
                        <th className="py-2.5 px-2 text-start">المداخيل</th>
                        <th className="py-2.5 px-2 text-start">السحوبات</th>
                        <th className="py-2.5 px-2 text-start">حصة المحل</th>
                        <th className="py-2.5 px-3 text-start">صافي فـ المجر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono tabular-nums">
                      {activeDrawerSummary.byBarber.map((row) => {
                        const bTone = getBarberIdentityTokens(row.barberId, row.arName);
                        return (
                          <tr
                            key={row.barberId}
                            onClick={() => {
                              setSelectedBarberId(row.barberId);
                              setDrawerModalOpen(false);
                            }}
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-900/70 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 px-3 font-sans">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${bTone.dotClass}`} />
                                <div>
                                  <div className="font-black text-zinc-900 dark:text-white">
                                    {row.arName}
                                  </div>
                                  <div className="text-[10px] font-mono text-zinc-400">
                                    {row.entryCount} عمليات
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-amber-700 dark:text-amber-300 font-bold">
                              {formatMAD(row.floatMAD)}
                            </td>
                            <td className="py-2.5 px-2 text-emerald-700 dark:text-emerald-400 font-bold">
                              {formatMAD(row.incomeMAD)}
                            </td>
                            <td className="py-2.5 px-2 text-rose-600 dark:text-rose-400 font-bold">
                              {formatMAD(row.expensesMAD)}
                            </td>
                            <td className="py-2.5 px-2 text-zinc-700 dark:text-zinc-300">
                              {formatMAD(row.shopShareMAD)}
                            </td>
                            <td
                              dir="ltr"
                              className={`py-2.5 px-3 font-black ${
                                row.netDrawerContributionMAD < 0
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : 'text-zinc-900 dark:text-white'
                              }`}
                            >
                              {formatMAD(row.netDrawerContributionMAD)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-zinc-50 dark:bg-zinc-900 border-t-2 border-zinc-200 dark:border-zinc-700 font-mono font-black tabular-nums">
                        <td className="py-2.5 px-3 font-sans text-zinc-900 dark:text-white">
                          المجموع الكلي
                        </td>
                        <td className="py-2.5 px-2 text-amber-700 dark:text-amber-300">
                          {formatMAD(activeDrawerSummary.totalFloatMAD)}
                        </td>
                        <td className="py-2.5 px-2 text-emerald-700 dark:text-emerald-400">
                          {formatMAD(activeDrawerSummary.totalIncomeMAD)}
                        </td>
                        <td className="py-2.5 px-2 text-rose-600 dark:text-rose-400">
                          {formatMAD(activeDrawerSummary.totalExpensesMAD)}
                        </td>
                        <td className="py-2.5 px-2 text-emerald-700 dark:text-emerald-400">
                          {formatMAD(activeDrawerSummary.totalShopShareMAD)}
                        </td>
                        <td dir="ltr" className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 text-sm">
                          {formatMAD(activeDrawerSummary.netTotalMAD)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
