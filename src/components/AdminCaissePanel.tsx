import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Calculator,
  Calendar,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudOff,
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
  Monitor,
  Plus,
  PlusCircle,
  RefreshCw,
  Scissors,
  Sliders,
  Smartphone,
  Timer,
  Trash2,
  User,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import {
  AppointmentBooking,
  CaisseBarberId,
  CaisseEntry,
  CaisseEntryType,
  ClientCreditRecord,
  CommissionPeriodOverride,
  StaffRole,
} from '../types';
import {
  BarberCycleBalance,
  closeAllBarbersDailyIntakeThrough,
  closeBarberDayIntake,
  computeAnnualCaisseRollup,
  computeBarberCycleBalance,
  computeBarberDailyInOutHistory,
  computeBarberDayStats,
  computeBarberOpenDailyStats,
  computeBarberPeriodSettlementPreview,
  computeClosedDayCreatedAtOverride,
  computeMonthlyCaisseRollup,
  computeShopDrawerTotals,
  confirmBarberCyclePayout,
  deleteCaisseCycleSettlement,
  deleteCaisseEntry,
  ensureDailyArchivesForPriorDays,
  findBarberDaySettlement,
  getCaisseBarberMeta,
  getCaisseBarbersFromRoster,
  getEffectiveCaisseCreditRemaining,
  getEffectiveCommissionPercent,
  getEffectiveCommissionPercentForDate,
  getSalonBusinessDate,
  isFloatEntryType,
  matchesCaisseBarber,
  matchesCaisseFinancialBarber,
  queueCaisseCreditRepaymentInstant,
  queueCaisseEntryInstant,
  resolveCaisseBarberId,
  resyncBarberDayArchiveAndSettlement,
  saveBarberDailyNoteReply,
  saveMasterDailyBarberNote,
  updateBarberCommissionPercent,
  updateCaisseEntry,
  useBarberDailyNotes,
  useCaisseArchives,
  useCaisseCycles,
  useCaisseEntries,
  useCaisseOfflineStatus,
  useCaisseSettlements,
  useCaisseSettings,
} from '../utils/caisseStore';
import {
  formatClockOffsetHumanAr,
  formatMoroccoClockTime,
  getTrustedNowMs,
  useTrustedTimeStatus,
} from '../utils/trustedTime';
import {
  getBarberSelectableServices,
  useBarberProfiles,
} from '../utils/barberProfileStore';
import {
  useShopPricingConfig,
} from '../utils/shopPricingStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import {
  computeOutstandingCreditsForPhone,
  getEffectiveManualCreditRemaining,
  recordManualCreditPayment,
  submitCreditSettlementRequest,
  updateCreditDisputeStatus,
  useCreditDisputes,
  useCreditSettlementRequests,
  useManualClientCredits,
} from '../utils/creditRegistryStore';
import { getBarberIdentityTokens } from '../utils/barberIdentity';
import { buildCreditWhatsAppReminderUrl } from '../utils/whatsappAutomation';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { asDateString, asIsoString, asStr, safeCompareDesc, safeFormatTime } from '../utils/safeCoerce';
import { showToast } from '../utils/notifications';
import { ModalPortal } from './ModalPortal';
import {
  CAISSE_QUICK_AMOUNTS,
  CaisseAmountField,
  evaluateAmountExpression,
} from './CaisseAmountField';
import { CaisseCalculatorModal } from './CaisseCalculatorModal';

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
  const manualCredits = useManualClientCredits();
  const creditSettlementRequests = useCreditSettlementRequests();
  const caisseOffline = useCaisseOfflineStatus();
  const trustedTime = useTrustedTimeStatus();

  const [businessTodayStr, setBusinessTodayStr] = useState<string>(() =>
    getSalonBusinessDate()
  );

  // Keep today's server-calibrated Morocco calendar date in sync (never resets daily/monthly balances)
  useEffect(() => {
    const syncDate = () => {
      const nextBizDate = getSalonBusinessDate();
      setBusinessTodayStr((prev) => (prev !== nextBizDate ? nextBizDate : prev));
    };
    syncDate();
    const interval = setInterval(syncDate, 60000);
    return () => clearInterval(interval);
  }, [trustedTime.serverOffsetMs, trustedTime.isCalibrated]);

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
  const prevBusinessTodayRef = useRef<string>(businessTodayStr);

  // Keep live view aligned with server-calibrated calendar date (daily drawer & balances stay open until manual settlement)
  useEffect(() => {
    const prevToday = prevBusinessTodayRef.current;
    if (prevToday !== businessTodayStr) {
      if (selectedDate === prevToday) {
        setSelectedDate(businessTodayStr);
        setSelectedMonth(businessTodayStr.slice(0, 7));
        setSelectedYear(businessTodayStr.slice(0, 4));
      }
      prevBusinessTodayRef.current = businessTodayStr;
    }
  }, [businessTodayStr, selectedDate]);

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
    | 'float_day'
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

  // Drawer Breakdown Modal Scope ('open_daily' = live open shift since last تصفية الحساب اليومي)
  const [drawerModalOpen, setDrawerModalOpen] = useState<boolean>(false);
  const [drawerModalScope, setDrawerModalScope] = useState<'open_daily' | 'day'>('open_daily');
  const [calculatorOpen, setCalculatorOpen] = useState<boolean>(false);

  // Privacy Masking & Hassan PIN Reveal Gate:
  // - Strictly active ONLY inside the dedicated Caisse account (`sessionRole === 'caisse'`).
  // - Never hide Hassan's numbers or prompt for Hassan's PIN when logged in as Master or Barber.
  const canToggleCaissePrivacy = sessionRole === 'caisse';
  const [showCaisseAmounts, setShowCaisseAmounts] = useState<boolean>(false);
  const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({});
  const [hassanPinVerifiedInCaisse, setHassanPinVerifiedInCaisse] = useState<boolean>(false);
  const [hassanPinModalOpen, setHassanPinModalOpen] = useState<
    'global' | { boxKey: string } | null
  >(null);
  const [hassanPinInput, setHassanPinInput] = useState<string>('');
  const [hassanPinError, setHassanPinError] = useState<string>('');

  useEffect(() => {
    setShowCaisseAmounts(false);
    setRevealedCards({});
    setHassanPinVerifiedInCaisse(false);
    setHassanPinModalOpen(null);
    setHassanPinInput('');
    setHassanPinError('');
    setTxScopeFilter('open_daily');
    setDrawerModalScope('open_daily');
    setBalanceAdjustModalOpen(false);
    setNegativePayoutPrompt(null);
    setCalculatorOpen(false);
  }, [sessionRole]);

  useEffect(() => {
    if (activeBarberId !== 'hassan') {
      setHassanPinVerifiedInCaisse(false);
    }
  }, [activeBarberId]);

  const isHassanBox = (boxKey?: string): boolean => {
    if (sessionRole !== 'caisse') return false;
    if (boxKey) {
      if (
        boxKey === 'shop_barber_day_hassan' ||
        boxKey === 'monthly_barber_hassan' ||
        boxKey === 'annual_barber_hassan' ||
        boxKey === 'sum_float_cycle' ||
        boxKey === 'drawer_barber_hassan' ||
        boxKey === 'caisse_cum_hassan'
      ) {
        return true;
      }
      if (
        boxKey === 'drawer_total_chip' ||
        boxKey === 'drawer_float' ||
        boxKey === 'drawer_income' ||
        boxKey === 'drawer_expenses' ||
        boxKey === 'drawer_net_total' ||
        boxKey.startsWith('caisse_cum_') ||
        boxKey.startsWith('shop_barber_day_') ||
        boxKey.startsWith('monthly_barber_') ||
        boxKey.startsWith('annual_barber_') ||
        boxKey.startsWith('drawer_barber_')
      ) {
        return false;
      }
    }
    return activeBarberId === 'hassan';
  };

  const isBoxVisible = (boxKey?: string): boolean => {
    if (sessionRole !== 'caisse') return true;
    if (isHassanBox(boxKey) && !hassanPinVerifiedInCaisse) return false;
    if (showCaisseAmounts) return true;
    if (boxKey && revealedCards[boxKey]) return true;
    return false;
  };
  const amountsVisible = isBoxVisible();

  const handleToggleGlobalCaisseAmounts = () => {
    const currentlyShowing =
      activeBarberId === 'hassan'
        ? hassanPinVerifiedInCaisse && showCaisseAmounts
        : showCaisseAmounts;
    if (currentlyShowing) {
      setShowCaisseAmounts(false);
      setRevealedCards({});
      setHassanPinVerifiedInCaisse(false);
      return;
    }
    if (activeBarberId === 'hassan' && !hassanPinVerifiedInCaisse) {
      setHassanPinInput('');
      setHassanPinError('');
      setHassanPinModalOpen('global');
      return;
    }
    setShowCaisseAmounts(true);
    setRevealedCards({});
  };

  const toggleBoxReveal = (boxKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isBoxVisible(boxKey)) {
      if (showCaisseAmounts) {
        setShowCaisseAmounts(false);
      }
      setRevealedCards((prev) => ({ ...prev, [boxKey]: false }));
      if (isHassanBox(boxKey)) {
        setHassanPinVerifiedInCaisse(false);
      }
      return;
    }
    if (isHassanBox(boxKey) && !hassanPinVerifiedInCaisse) {
      setHassanPinInput('');
      setHassanPinError('');
      setHassanPinModalOpen({ boxKey });
      return;
    }
    setRevealedCards((prev) => ({ ...prev, [boxKey]: true }));
  };

  const handleVerifyHassanRevealPin = (e: React.FormEvent) => {
    e.preventDefault();
    const masterAcc = roster.find((m) => m.id === 'hassan' || m.role === 'master');
    const expectedPin = masterAcc?.pin || '';
    if (!expectedPin || hassanPinInput.trim() !== expectedPin) {
      setHassanPinError('رمز حسن غير صحيح، يرجى المحاولة مرة أخرى.');
      return;
    }
    setHassanPinVerifiedInCaisse(true);
    if (hassanPinModalOpen === 'global') {
      setShowCaisseAmounts(true);
      setRevealedCards({});
    } else if (hassanPinModalOpen && typeof hassanPinModalOpen === 'object') {
      setRevealedCards((prev) => ({ ...prev, [hassanPinModalOpen.boxKey]: true }));
    }
    setHassanPinModalOpen(null);
    setHassanPinInput('');
    setHassanPinError('');
  };

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

  // Duplicate amount confirmation modal state (10-minute window check)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    kind: 'income' | 'expense';
    amount: number;
    matchedTimeLabel: string;
    matchedNote?: string;
  } | null>(null);

  // Action Modals ('none' | 'income' | 'expense' | 'float')
  const [openForm, setOpenForm] = useState<'none' | 'income' | 'expense' | 'float'>('none');

  const openQuickIncomeForm = (withCredit = false) => {
    setDuplicateWarning(null);
    setHasCreditToggle(withCredit);
    setOpenForm('income');
  };

  const openFloatModal = (mode: 'add' | 'return' = 'add') => {
    setDuplicateWarning(null);
    setFloatMode(mode);
    setOpenForm('float');
  };

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
      setHassanPinModalOpen(null);
      setHassanPinVerifiedInCaisse(false);
      setShowCaisseAmounts(false);
      setRevealedCards({});
      setBalanceAdjustModalOpen(false);
      setNegativePayoutPrompt(null);
      setCalculatorOpen(false);
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

  // Float form state ("الصرف — فلوس الفكة في المجر")
  const [floatMode, setFloatMode] = useState<'add' | 'return'>('add');
  const [floatAmount, setFloatAmount] = useState<string>('');
  const [floatNote, setFloatNote] = useState<string>('');
  const [floatSubmitting, setFloatSubmitting] = useState<boolean>(false);

  // Expandable single-line transaction rows
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});
  const [txScopeFilter, setTxScopeFilter] = useState<'open_daily' | 'day' | 'cycle' | 'all'>('open_daily');

  // Repayment inline state + Pay/Clear settlement request state
  const [repayingEntryId, setRepayingEntryId] = useState<string | null>(null);
  const [repayAmountInput, setRepayAmountInput] = useState<string>('');
  const [repayBusy, setRepayBusy] = useState<boolean>(false);
  const [settleReqEntryId, setSettleReqEntryId] = useState<string | null>(null);
  const [settleReqAction, setSettleReqAction] = useState<'pay' | 'clear'>('pay');
  const [settleReqAmountInput, setSettleReqAmountInput] = useState<string>('');
  const [settleReqNoteInput, setSettleReqNoteInput] = useState<string>('');
  const [settleReqBusy, setSettleReqBusy] = useState<boolean>(false);
  // Manual credit record inline repayment & request states
  const [repayingManualId, setRepayingManualId] = useState<string | null>(null);
  const [repayManualAmountInput, setRepayManualAmountInput] = useState<string>('');
  const [repayManualBusy, setRepayManualBusy] = useState<boolean>(false);
  const [settleReqManualId, setSettleReqManualId] = useState<string | null>(null);
  const [settleReqManualAction, setSettleReqManualAction] = useState<'pay' | 'clear'>('pay');
  const [settleReqManualAmountInput, setSettleReqManualAmountInput] = useState<string>('');
  const [settleReqManualNoteInput, setSettleReqManualNoteInput] = useState<string>('');
  const [settleReqManualBusy, setSettleReqManualBusy] = useState<boolean>(false);

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
  const [payoutTargetMode, setPayoutTargetMode] = useState<'single' | 'all_barbers'>('single');
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

  // Transaction / Credit Edit Modal & Delete Confirmation states
  const [editingEntry, setEditingEntry] = useState<CaisseEntry | null>(null);
  const [editBarberId, setEditBarberId] = useState<CaisseBarberId>('hassan');
  const [editType, setEditType] = useState<CaisseEntryType>('income');
  const [editAdjustmentDirection, setEditAdjustmentDirection] = useState<'credit' | 'debit'>('credit');
  const [editPaid, setEditPaid] = useState<string>('');
  const [editCreditRem, setEditCreditRem] = useState<string>('');
  const [editClientName, setEditClientName] = useState<string>('');
  const [editClientPhone, setEditClientPhone] = useState<string>('');
  const [editRepayDate, setEditRepayDate] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editBusy, setEditBusy] = useState<boolean>(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<CaisseEntry | null>(null);
  const [deleteEntryBusy, setDeleteEntryBusy] = useState<boolean>(false);
  const [confirmDeleteCycle, setConfirmDeleteCycle] =
    useState<import('../types').CaisseCycleSettlement | null>(null);
  const [deleteCycleBusy, setDeleteCycleBusy] = useState<boolean>(false);

  // Interactive Day Card Detail Modal (lists all "حط" & "هز" for a barber+date; Master Admin full CRUD even on "مغلق" days)
  const [dayDetailTarget, setDayDetailTarget] = useState<{
    barberId: CaisseBarberId;
    date: string;
  } | null>(null);
  const [dayModalAddType, setDayModalAddType] = useState<'income' | 'expense' | 'credit_repayment'>('income');
  const [dayModalAddAmount, setDayModalAddAmount] = useState<string>('');
  const [dayModalAddNote, setDayModalAddNote] = useState<string>('');
  const [dayModalAddClientName, setDayModalAddClientName] = useState<string>('');
  const [dayModalAddBusy, setDayModalAddBusy] = useState<boolean>(false);

  // Transaction Device / Account Origin Inspector Modal
  const [inspectOriginEntry, setInspectOriginEntry] = useState<CaisseEntry | null>(null);

  // Master-Only Isolated Barber Balance Adjust / Clear Negative Modal
  const [balanceAdjustModalOpen, setBalanceAdjustModalOpen] = useState<boolean>(false);
  const [balanceAdjustMode, setBalanceAdjustMode] = useState<'zero_negative' | 'set_target' | 'delta'>('zero_negative');
  const [balanceAdjustDirection, setBalanceAdjustDirection] = useState<'credit' | 'debit'>('credit');
  const [balanceAdjustAmount, setBalanceAdjustAmount] = useState<string>('');
  const [balanceAdjustNote, setBalanceAdjustNote] = useState<string>('');
  const [balanceAdjustDate, setBalanceAdjustDate] = useState<string>(() => getSalonBusinessDate());
  const [balanceAdjustBusy, setBalanceAdjustBusy] = useState<boolean>(false);

  // Monthly Settlement Negative-Balance Confirmation Prompt Modal
  const [negativePayoutPrompt, setNegativePayoutPrompt] = useState<{
    mode: 'single' | 'all_barbers';
    barbers: Array<{
      barberId: CaisseBarberId;
      arName: string;
      negativeAmountMAD: number;
      cycleBalance: BarberCycleBalance;
      periodStartDate?: string;
      periodEndDate?: string;
    }>;
    resolutions: Record<string, 'cleared' | 'carried_forward'>;
  } | null>(null);

  // Master Accountant Sub-tabs ('periods' | 'annual' | 'archives' | 'cycles')
  const [accountantTab, setAccountantTab] = useState<
    'periods' | 'annual' | 'archives' | 'cycles'
  >('periods');

  // Populate read-only historical daily summaries on demand when Master opens the archives tab
  useEffect(() => {
    if (sessionRole !== 'master' || accountantTab !== 'archives' || entries.length === 0) return;
    void ensureDailyArchivesForPriorDays(entries, archivesMap, businessTodayStr);
  }, [sessionRole, accountantTab, entries, archivesMap, businessTodayStr]);

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
        ? computeBarberDayStats(activeBarberId, selectedDate, entries, effectivePct, roster)
        : {
            barberId: 'hassan',
            date: selectedDate,
            incomeMAD: 0,
            directIncomeMAD: 0,
            repaymentIncomeMAD: 0,
            creditsIssuedMAD: 0,
            expensesMAD: 0,
            floatInMAD: 0,
            floatOutMAD: 0,
            floatMAD: 0,
            barberAdjustmentMAD: 0,
            commissionPercent: 50,
            extraPercentAbove50: 0,
            barberGrossShareMAD: 0,
            barberNetShareMAD: 0,
            shopShareMAD: 0,
            drawerCashMAD: 0,
            entryCount: 0,
          },
    [activeBarberId, selectedDate, entries, effectivePct, roster]
  );

  const selectedDaySettlement = activeBarberId
    ? findBarberDaySettlement(activeBarberId, selectedDate, settlementsMap, roster)
    : undefined;

  const isLiveOpenDailyView = selectedDate === businessTodayStr;

  const activeBarberOpenDailyStats = useMemo(
    () =>
      activeBarberId
        ? computeBarberOpenDailyStats({
            barberId: activeBarberId,
            entries,
            settingsMap,
            settlementsMap,
            cycles,
            rosterMembers: roster,
            referenceDate: businessTodayStr,
          })
        : {
            barberId: 'hassan',
            date: businessTodayStr,
            incomeMAD: 0,
            directIncomeMAD: 0,
            repaymentIncomeMAD: 0,
            creditsIssuedMAD: 0,
            expensesMAD: 0,
            floatInMAD: 0,
            floatOutMAD: 0,
            floatMAD: 0,
            barberAdjustmentMAD: 0,
            commissionPercent: 50,
            extraPercentAbove50: 0,
            barberGrossShareMAD: 0,
            barberNetShareMAD: 0,
            shopShareMAD: 0,
            drawerCashMAD: 0,
            entryCount: 0,
            lastDailyCloseIso: null,
            lastDailyCloseDate: null,
            lastClosedIncomeMAD: 0,
            lastClosedExpensesMAD: 0,
            lastClosedShopShareMAD: 0,
            isDailySettledClean: false,
            openEntries: [] as CaisseEntry[],
          },
    [activeBarberId, entries, settingsMap, settlementsMap, cycles, roster, businessTodayStr]
  );

  // Authoritative daily stats:
  // - On live view (`selectedDate === businessTodayStr`), read directly from `activeBarberOpenDailyStats` (anchored to last "تصفية الحساب اليومي", resets cleanly to 0 on daily settlement).
  // - When inspecting a historical past date, read that date's stats cleanly.
  const displayedDayIntakeStats = useMemo(() => {
    if (isLiveOpenDailyView) {
      return {
        isIntakeClosed: activeBarberOpenDailyStats.isDailySettledClean,
        hasAnyDailyClose: Boolean(activeBarberOpenDailyStats.lastDailyCloseIso),
        lastDailyCloseDate: activeBarberOpenDailyStats.lastDailyCloseDate,
        displayedIncomeMAD: activeBarberOpenDailyStats.incomeMAD,
        displayedExpensesMAD: activeBarberOpenDailyStats.expensesMAD,
        displayedFloatInMAD: activeBarberOpenDailyStats.floatInMAD,
        displayedFloatOutMAD: activeBarberOpenDailyStats.floatOutMAD,
        displayedFloatMAD: activeBarberOpenDailyStats.floatMAD,
        displayedShopShareMAD: activeBarberOpenDailyStats.shopShareMAD,
        displayedDrawerCashMAD: activeBarberOpenDailyStats.drawerCashMAD,
        closedAtAmountMAD: activeBarberOpenDailyStats.lastClosedIncomeMAD,
        closedExpensesMAD: activeBarberOpenDailyStats.lastClosedExpensesMAD,
        closedShopShareMAD: activeBarberOpenDailyStats.lastClosedShopShareMAD,
        postCloseEntryCount: activeBarberOpenDailyStats.entryCount,
      };
    }

    if (!selectedDaySettlement?.intakeClosed) {
      return {
        isIntakeClosed: false,
        hasAnyDailyClose: false,
        lastDailyCloseDate: null as string | null,
        displayedIncomeMAD: selectedDayStats.incomeMAD,
        displayedExpensesMAD: selectedDayStats.expensesMAD,
        displayedFloatInMAD: selectedDayStats.floatInMAD,
        displayedFloatOutMAD: selectedDayStats.floatOutMAD,
        displayedFloatMAD: selectedDayStats.floatMAD,
        displayedShopShareMAD: selectedDayStats.shopShareMAD,
        displayedDrawerCashMAD: selectedDayStats.drawerCashMAD,
        closedAtAmountMAD: 0,
        closedExpensesMAD: 0,
        closedShopShareMAD: 0,
        postCloseEntryCount: selectedDayStats.entryCount,
      };
    }

    const closedIso = selectedDaySettlement.confirmedAt || selectedDaySettlement.updatedAt;
    const postCloseEntries = entries.filter(
      (e) =>
        matchesCaisseFinancialBarber(e, activeBarberId, roster) &&
        e.date === selectedDate &&
        (!closedIso || e.createdAt > closedIso)
    );
    let postIncome = 0;
    let postExpenses = 0;
    let postFloatIn = 0;
    let postFloatOut = 0;
    postCloseEntries.forEach((e) => {
      if (e.type === 'income' || e.type === 'credit_repayment') {
        postIncome += Number(e.amountPaidMAD) || 0;
      } else if (e.type === 'expense') {
        postExpenses += Number(e.amountPaidMAD) || 0;
      } else if (e.type === 'float_adjustment') {
        postFloatIn += Number(e.amountPaidMAD) || 0;
      } else if (e.type === 'float_return') {
        postFloatOut += Number(e.amountPaidMAD) || 0;
      }
    });
    const postFloat = Math.round(postFloatIn - postFloatOut);
    const pct = Math.max(0, Math.min(100, effectivePct));
    const postBarberGross = Math.round(postIncome * (pct / 100));
    const postShopShare = Math.max(0, Math.round(postIncome - postBarberGross));
    return {
      isIntakeClosed: postCloseEntries.length === 0,
      hasAnyDailyClose: true,
      lastDailyCloseDate: selectedDaySettlement.date || selectedDate,
      displayedIncomeMAD: Math.round(postIncome),
      displayedExpensesMAD: Math.round(postExpenses),
      displayedFloatInMAD: Math.round(postFloatIn),
      displayedFloatOutMAD: Math.round(postFloatOut),
      displayedFloatMAD: postFloat,
      displayedShopShareMAD: postShopShare,
      displayedDrawerCashMAD: Math.round(postIncome + postFloat - postExpenses),
      closedAtAmountMAD:
        Number(selectedDaySettlement.grossIntakeClosedMAD) || selectedDayStats.incomeMAD,
      closedExpensesMAD:
        selectedDayStats.expensesMAD || Number(selectedDaySettlement.expensesMAD) || 0,
      closedShopShareMAD:
        selectedDayStats.shopShareMAD || Number(selectedDaySettlement.shopShareMAD) || 0,
      postCloseEntryCount: postCloseEntries.length,
    };
  }, [
    isLiveOpenDailyView,
    activeBarberOpenDailyStats,
    selectedDaySettlement,
    selectedDayStats,
    entries,
    activeBarberId,
    selectedDate,
    roster,
    effectivePct,
  ]);

  const cycleBalance = useMemo(
    () =>
      activeBarberId
        ? computeBarberCycleBalance(
            activeBarberId,
            entries,
            settingsMap,
            cycles,
            selectedDate,
            manualCredits,
            roster
          )
        : {
            barberId: 'hassan',
            lastSettledIso: null,
            lastSettledDate: null,
            commissionPercent: 50,
            incomeMAD: 0,
            repaymentIncomeMAD: 0,
            expensesMAD: 0,
            floatInMAD: 0,
            floatOutMAD: 0,
            floatMAD: 0,
            barberAdjustmentMAD: 0,
            carryForwardMAD: 0,
            drawerCashMAD: 0,
            creditsIssuedMAD: 0,
            barberGrossShareMAD: 0,
            shopShareMAD: 0,
            barberNetOwedMAD: 0,
            openCreditsAllTimeMAD: 0,
            openCycleEntries: [],
          },
    [activeBarberId, entries, settingsMap, cycles, selectedDate, manualCredits, roster]
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
            rosterMembers: roster,
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
      roster,
    ]
  );

  const allBarbersPayoutPreview = useMemo(() => {
    const items = allCaisseBarbers.map((b) => {
      const preview = computeBarberPeriodSettlementPreview({
        barberId: b.id,
        entries,
        settingsMap,
        cycles,
        scope: payoutScope,
        month: payoutMonth,
        startDate: payoutStartDate,
        endDate: payoutEndDate,
        referenceDate: businessTodayStr,
        rosterMembers: roster,
      });
      return { barber: b, preview };
    });
    const barbersWithOpenEntries = items.filter(
      (item) =>
        item.preview.cycleBalance.openCycleEntries.length > 0 ||
        item.preview.cycleBalance.carryForwardMAD !== 0 ||
        item.preview.cycleBalance.barberNetOwedMAD !== 0
    );
    const totalIncomeMAD = barbersWithOpenEntries.reduce(
      (s, x) => s + x.preview.cycleBalance.incomeMAD,
      0
    );
    const totalShopShareMAD = barbersWithOpenEntries.reduce(
      (s, x) => s + x.preview.cycleBalance.shopShareMAD,
      0
    );
    const totalBarberNetOwedMAD = barbersWithOpenEntries.reduce(
      (s, x) => s + x.preview.cycleBalance.barberNetOwedMAD,
      0
    );
    const totalEntryCount = barbersWithOpenEntries.reduce(
      (s, x) => s + x.preview.cycleBalance.openCycleEntries.length,
      0
    );
    return {
      items,
      barbersWithOpenEntries,
      totalIncomeMAD: Math.round(totalIncomeMAD * 100) / 100,
      totalShopShareMAD: Math.round(totalShopShareMAD * 100) / 100,
      totalBarberNetOwedMAD: Math.round(totalBarberNetOwedMAD * 100) / 100,
      totalEntryCount,
    };
  }, [
    allCaisseBarbers,
    entries,
    settingsMap,
    cycles,
    payoutScope,
    payoutMonth,
    payoutStartDate,
    payoutEndDate,
    businessTodayStr,
    roster,
  ]);

  const dailyInOutHistory = useMemo(() => {
    if (!activeBarberId) return [];
    const list = computeBarberDailyInOutHistory(
      activeBarberId,
      entries,
      settlementsMap,
      12,
      roster
    );
    if (sessionRole === 'barber') {
      return list.filter((row) => row.date >= twoMonthsCutoffDate);
    }
    return list;
  }, [activeBarberId, entries, settlementsMap, roster, sessionRole, twoMonthsCutoffDate]);

  // Master All-Barbers Rollups
  const monthlyRollup = useMemo(
    () =>
      computeMonthlyCaisseRollup(
        selectedMonth,
        entries,
        settingsMap,
        settlementsMap,
        roster,
        manualCredits
      ),
    [selectedMonth, entries, settingsMap, settlementsMap, roster, manualCredits]
  );

  const allTimeOpenCreditsByBarber = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      const rem = getEffectiveCaisseCreditRemaining(e);
      if (rem > 0) {
        const resolvedId = resolveCaisseBarberId(e.barberId, e.barberName, roster);
        map[resolvedId] = (map[resolvedId] || 0) + rem;
      }
    });
    manualCredits.forEach((r) => {
      const rem = getEffectiveManualCreditRemaining(r);
      if (rem > 0) {
        const resolvedId = resolveCaisseBarberId(r.barberId || 'hassan', r.barberName, roster);
        map[resolvedId] = (map[resolvedId] || 0) + rem;
      }
    });
    return map;
  }, [entries, manualCredits, roster]);

  const annualRollup = useMemo(
    () => computeAnnualCaisseRollup(selectedYear, entries, settingsMap, roster),
    [selectedYear, entries, settingsMap, roster]
  );

  const todayShopSummary = useMemo(() => {
    const perBarber = allCaisseBarbers.map((b) => {
      const pct = getEffectiveCommissionPercentForDate(b.id, selectedDate, settingsMap);
      const dayStats = computeBarberDayStats(b.id, selectedDate, entries, pct, roster);
      return { barber: b, dayStats };
    });
    const totalIncome = perBarber.reduce((s, x) => s + x.dayStats.incomeMAD, 0);
    const totalShopShare = perBarber.reduce((s, x) => s + x.dayStats.shopShareMAD, 0);
    const totalExpenses = perBarber.reduce((s, x) => s + x.dayStats.expensesMAD, 0);
    return { perBarber, totalIncome, totalShopShare, totalExpenses };
  }, [allCaisseBarbers, selectedDate, entries, settingsMap, roster]);

  // Single Authoritative "الحساب في المجر" / "المجر اليوم" (Total Physical Cash in Drawer across ALL open shifts since each barber's last "تصفية الحساب اليومي")
  const liveOpenDailyDrawerSummary = useMemo(
    () =>
      computeShopDrawerTotals({
        entries,
        settingsMap,
        cycles,
        rosterMembers: roster,
        scope: 'open_daily',
        date: businessTodayStr,
        settlementsMap,
        respectDailyIntakeClose: true,
      }),
    [entries, settingsMap, cycles, roster, businessTodayStr, settlementsMap]
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
        settlementsMap,
        respectDailyIntakeClose: true,
      }),
    [entries, settingsMap, cycles, roster, selectedDate, settlementsMap]
  );

  const activeDrawerSummary =
    sessionRole !== 'caisse' && drawerModalScope === 'day'
      ? selectedDayDrawerSummary
      : liveOpenDailyDrawerSummary;

  // Open Credits across ALL dates (NEVER subject to 2-month cap until paid)
  const openCreditsList = useMemo(() => {
    return entries.filter((e) => {
      if (getEffectiveCaisseCreditRemaining(e) <= 0) return false;
      return matchesCaisseBarber(e.barberId, e.barberName, activeBarberId, roster);
    });
  }, [entries, activeBarberId, roster]);

  const openManualCreditsForBarber = useMemo(() => {
    return manualCredits.filter((r) => {
      if (getEffectiveManualCreditRemaining(r) <= 0) return false;
      return matchesCaisseBarber(r.barberId || 'hassan', r.barberName, activeBarberId, roster);
    });
  }, [manualCredits, activeBarberId, roster]);

  const combinedOpenCreditsCount = openCreditsList.length + openManualCreditsForBarber.length;

  // Filtered Transaction Log (Barbers capped at last 2 months, except open unpaid credits)
  const visibleEntries = useMemo(() => {
    const passesBarberArchiveCap = (e: CaisseEntry) => {
      if (sessionRole !== 'barber') return true;
      const isOpenCredit = getEffectiveCaisseCreditRemaining(e) > 0;
      return isOpenCredit || e.date >= twoMonthsCutoffDate;
    };

    const effectiveFilter =
      sessionRole === 'caisse' && txScopeFilter === 'cycle' ? 'open_daily' : txScopeFilter;

    if (effectiveFilter === 'open_daily') {
      return activeBarberOpenDailyStats.openEntries.filter(passesBarberArchiveCap);
    }
    if (effectiveFilter === 'day') {
      return entries.filter(
        (e) =>
          matchesCaisseFinancialBarber(e, activeBarberId, roster) &&
          e.date === selectedDate &&
          passesBarberArchiveCap(e)
      );
    }
    if (effectiveFilter === 'cycle') {
      return cycleBalance.openCycleEntries.filter(passesBarberArchiveCap);
    }
    return entries
      .filter(
        (e) =>
          matchesCaisseFinancialBarber(e, activeBarberId, roster) &&
          passesBarberArchiveCap(e)
      )
      .slice(0, 80);
  }, [
    entries,
    activeBarberId,
    roster,
    selectedDate,
    txScopeFilter,
    activeBarberOpenDailyStats.openEntries,
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
      .sort((a, b) => safeCompareDesc(a.date, b.date))
      .slice(0, 60);
  }, [archivesMap, sessionRole, activeBarberId, twoMonthsCutoffDate]);

  // Drill-down modal dataset matching the clicked KPI / Summary box
  const drillViewData = useMemo(() => {
    if (!drillModal) return null;
    const boxKeyForDrill =
      drillModal.kind === 'income_day'
        ? 'kpi_income'
        : drillModal.kind === 'expenses'
        ? 'kpi_expenses'
        : drillModal.kind === 'net_balance'
        ? 'kpi_net'
        : drillModal.kind === 'credits_all'
        ? 'kpi_credits'
        : drillModal.kind === 'shop_day'
        ? 'sum_shop_day'
        : drillModal.kind === 'shop_cycle'
        ? 'sum_shop_cycle'
        : drillModal.kind === 'float_day' || drillModal.kind === 'float_cycle'
        ? 'float_cycle_card'
        : `shop_barber_day_${drillModal.barberId || activeBarberId}`;
    const fmt = (val: number | string | undefined | null) =>
      isBoxVisible(boxKeyForDrill)
        ? `${Math.round(Number(val) || 0).toLocaleString('en-US')} MAD`
        : '••• MAD';
    const closedIso =
      !isLiveOpenDailyView && selectedDaySettlement?.intakeClosed
        ? selectedDaySettlement.confirmedAt || selectedDaySettlement.updatedAt
        : null;

    if (drillModal.kind === 'income_day') {
      const list = isLiveOpenDailyView
        ? activeBarberOpenDailyStats.openEntries.filter(
            (e) => e.type === 'income' || e.type === 'credit_repayment'
          )
        : entries.filter(
            (e) =>
              matchesCaisseFinancialBarber(e, activeBarberId, roster) &&
              e.date === selectedDate &&
              (e.type === 'income' || e.type === 'credit_repayment') &&
              (!closedIso || e.createdAt > closedIso)
          );
      return {
        title: isViewingOwnAccount
          ? `تفاصيل شحال حطيت (${isLiveOpenDailyView ? 'الدورة اليومية المفتوحة' : selectedDate})`
          : `تفاصيل شحال حط ${activeBarberMeta.arName} (${isLiveOpenDailyView ? 'الدورة اليومية المفتوحة' : selectedDate})`,
        totalLabel: fmt(displayedDayIntakeStats.displayedIncomeMAD),
        subtitle: displayedDayIntakeStats.hasAnyDailyClose
          ? `آخر تصفية يومية (${fmt(displayedDayIntakeStats.closedAtAmountMAD)}) · العمليات المفتوحة حالياً (${list.length})`
          : `${list.length} عملية مفتوحة منذ آخر تصفية يومية`,
        accentCls: 'text-emerald-700 dark:text-emerald-400',
        list,
        closedIso,
        canShowAmounts: isBoxVisible(boxKeyForDrill),
      };
    }

    if (drillModal.kind === 'expenses') {
      const list = isLiveOpenDailyView
        ? activeBarberOpenDailyStats.openEntries.filter((e) => e.type === 'expense')
        : entries.filter(
            (e) =>
              matchesCaisseFinancialBarber(e, activeBarberId, roster) &&
              e.date === selectedDate &&
              e.type === 'expense' &&
              (!closedIso || e.createdAt > closedIso)
          );
      const totalAmt = displayedDayIntakeStats.displayedExpensesMAD;
      return {
        title:
          sessionRole === 'caisse' || !isViewingOwnAccount
            ? `تفاصيل شحال هز ${activeBarberMeta.arName} (${isLiveOpenDailyView ? 'الدورة اليومية المفتوحة' : selectedDate})`
            : `تفاصيل شحال هزيت (${isLiveOpenDailyView ? 'الدورة اليومية المفتوحة' : selectedDate})`,
        totalLabel: fmt(totalAmt),
        subtitle:
          sessionRole === 'caisse'
            ? `${list.length} عملية سحب في الدورة اليومية المفتوحة`
            : displayedDayIntakeStats.hasAnyDailyClose
            ? `عمليات مفتوحة (${list.length}) · التراكمي الشهري المفتوح: ${fmt(cycleBalance.expensesMAD)}`
            : `سحوبات مفتوحة (${list.length} عملية) · التراكمي بالدورة: ${fmt(cycleBalance.expensesMAD)}`,
        accentCls: 'text-rose-700 dark:text-rose-400',
        list,
        closedIso,
        canShowAmounts: isBoxVisible(boxKeyForDrill),
      };
    }

    if (drillModal.kind === 'net_balance') {
      const isHassanCaisseDrawer =
        sessionRole === 'caisse' &&
        (activeBarberId === 'hassan' || Boolean(activeBarberMeta?.isOwner));
      if (isHassanCaisseDrawer) {
        const list = isLiveOpenDailyView
          ? activeBarberOpenDailyStats.openEntries
          : entries.filter(
              (e) =>
                matchesCaisseFinancialBarber(e, activeBarberId, roster) &&
                e.date === selectedDate &&
                (!closedIso || e.createdAt > closedIso)
            );
        const drawerVal = displayedDayIntakeStats.displayedDrawerCashMAD;
        return {
          title: `تفاصيل المجر كامل — ${activeBarberMeta.arName}`,
          totalLabel: fmt(drawerVal),
          subtitle: `المداخيل (${fmt(displayedDayIntakeStats.displayedIncomeMAD)}) + فلوس الصرف (${fmt(
            displayedDayIntakeStats.displayedFloatMAD
          )}) − مصاريف حسن فقط (${fmt(displayedDayIntakeStats.displayedExpensesMAD)})`,
          accentCls:
            drawerVal < 0
              ? 'text-rose-700 dark:text-rose-400'
              : 'text-emerald-700 dark:text-emerald-400',
          list,
          closedIso,
          canShowAmounts: isBoxVisible(boxKeyForDrill),
        };
      }

      const list = cycleBalance.openCycleEntries;
      const netVal = cycleBalance.barberNetOwedMAD;
      return {
        title:
          sessionRole === 'caisse'
            ? `تفاصيل شحال بقى ليه في الحساب كامل — ${activeBarberMeta.arName}`
            : isViewingOwnAccount
            ? 'تفاصيل شحال بقى ليا (الحساب الشهري/التراكمي)'
            : `تفاصيل شحال كيتسال ${activeBarberMeta.arName} (الحساب الشهري/التراكمي)`,
        totalLabel: fmt(netVal),
        subtitle: `المداخيل بالدورة: ${fmt(cycleBalance.incomeMAD)} · حصة الحلاق (${cycleBalance.commissionPercent}%): ${fmt(cycleBalance.barberGrossShareMAD)}${
          activeBarberId === 'hassan' && cycleBalance.floatMAD !== 0
            ? ` + الصرف الشخصي: ${fmt(cycleBalance.floatMAD)}`
            : ''
        } − السحوبات: ${fmt(cycleBalance.expensesMAD)}${
          cycleBalance.carryForwardMAD !== 0 ? ` · مرحل: ${fmt(cycleBalance.carryForwardMAD)}` : ''
        }${
          cycleBalance.barberAdjustmentMAD !== 0 ? ` · تسوية: ${fmt(cycleBalance.barberAdjustmentMAD)}` : ''
        }`,
        accentCls:
          netVal < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-300',
        list,
        closedIso: null,
        canShowAmounts: isBoxVisible(boxKeyForDrill),
      };
    }

    if (drillModal.kind === 'credits_all') {
      const totalCred =
        openCreditsList.reduce((s, e) => s + getEffectiveCaisseCreditRemaining(e), 0) +
        openManualCreditsForBarber.reduce((s, r) => s + getEffectiveManualCreditRemaining(r), 0);
      return {
        title: `تفاصيل الكريدي المفتوح — ${activeBarberMeta.arName}`,
        totalLabel: fmt(totalCred),
        subtitle: `${combinedOpenCreditsCount} كريدي مفتوح عبر كل التواريخ حتى الأداء`,
        accentCls: 'text-orange-700 dark:text-orange-400',
        list: openCreditsList,
        manualList: openManualCreditsForBarber,
        closedIso: null,
        canShowAmounts: isBoxVisible(boxKeyForDrill),
      };
    }

    if (drillModal.kind === 'shop_day') {
      const list = isLiveOpenDailyView
        ? activeBarberOpenDailyStats.openEntries.filter(
            (e) => e.type === 'income' || e.type === 'credit_repayment'
          )
        : entries.filter(
            (e) =>
              matchesCaisseFinancialBarber(e, activeBarberId, roster) &&
              e.date === selectedDate &&
              (e.type === 'income' || e.type === 'credit_repayment') &&
              (!closedIso || e.createdAt > closedIso)
          );
      return {
        title: `تفاصيل حصة المحل من ${activeBarberMeta.arName} (${isLiveOpenDailyView ? 'الدورة اليومية المفتوحة' : selectedDate})`,
        totalLabel: fmt(displayedDayIntakeStats.displayedShopShareMAD),
        subtitle: displayedDayIntakeStats.isIntakeClosed
          ? `تمت التصفية اليومية (${fmt(displayedDayIntakeStats.closedShopShareMAD)}) · 0 عملية مفتوحة`
          : `من إجمالي دخل ${fmt(displayedDayIntakeStats.displayedIncomeMAD)} (نسبة المحل ${Math.max(0, 100 - selectedDayStats.commissionPercent)}%)`,
        accentCls: 'text-emerald-700 dark:text-emerald-400',
        list,
        closedIso,
        canShowAmounts: isBoxVisible(boxKeyForDrill),
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
        canShowAmounts: isBoxVisible(boxKeyForDrill),
      };
    }

    if (drillModal.kind === 'float_day') {
      const list = isLiveOpenDailyView
        ? activeBarberOpenDailyStats.openEntries.filter(
            (e) => e.type === 'float_adjustment' || e.type === 'float_return'
          )
        : entries.filter(
            (e) =>
              matchesCaisseFinancialBarber(e, activeBarberId, roster) &&
              e.date === selectedDate &&
              (e.type === 'float_adjustment' || e.type === 'float_return') &&
              (!closedIso || e.createdAt > closedIso)
          );
      return {
        title: `تفاصيل الصرف (${isLiveOpenDailyView ? 'الدورة اليومية المفتوحة' : selectedDate}) — حساب حسن الشخصي`,
        totalLabel: fmt(displayedDayIntakeStats.displayedFloatMAD),
        subtitle: `${list.length} عملية (مضاف: ${fmt(displayedDayIntakeStats.displayedFloatInMAD)} · مرجوع: ${fmt(displayedDayIntakeStats.displayedFloatOutMAD)} · غير محسوب في المداخيل)`,
        accentCls: 'text-amber-700 dark:text-amber-300',
        list,
        closedIso,
        canShowAmounts: isBoxVisible(boxKeyForDrill),
      };
    }

    if (drillModal.kind === 'float_cycle') {
      const list = cycleBalance.openCycleEntries.filter(
        (e) => e.type === 'float_adjustment' || e.type === 'float_return'
      );
      return {
        title: `تفاصيل فلوس الصرف (الدورة المفتوحة) — حساب حسن الشخصي`,
        totalLabel: fmt(cycleBalance.floatMAD),
        subtitle: `${list.length} عملية (مضاف: ${fmt(cycleBalance.floatInMAD)} · مرجوع: ${fmt(cycleBalance.floatOutMAD)} · غير محسوب في المداخيل)`,
        accentCls: 'text-amber-700 dark:text-amber-300',
        list,
        closedIso: null,
        canShowAmounts: isBoxVisible(boxKeyForDrill),
      };
    }

    // 'shop_barber_day'
    const targetId = drillModal.barberId || activeBarberId;
    const targetMeta = getCaisseBarberMeta(targetId, roster);
    const pct = getEffectiveCommissionPercentForDate(targetId, selectedDate, settingsMap);
    const targetDayStats = computeBarberDayStats(targetId, selectedDate, entries, pct, roster);
    const list = entries.filter(
      (e) => matchesCaisseFinancialBarber(e, targetId, roster) && e.date === selectedDate
    );
    return {
      title: `حساب المحل والعمليات — ${targetMeta.arName} (${selectedDate})`,
      totalLabel: fmt(targetDayStats.shopShareMAD),
      subtitle: `إجمالي الدخل: ${fmt(targetDayStats.incomeMAD)} · حصة الحلاق (${pct}%): ${fmt(targetDayStats.barberGrossShareMAD)} · المصروف: ${fmt(targetDayStats.expensesMAD)}`,
      accentCls: 'text-emerald-700 dark:text-emerald-400',
      list,
      closedIso: null,
      canShowAmounts: isBoxVisible(boxKeyForDrill),
    };
  }, [
    drillModal,
    showCaisseAmounts,
    revealedCards,
    hassanPinVerifiedInCaisse,
    entries,
    activeBarberId,
    activeBarberMeta.arName,
    selectedDate,
    isLiveOpenDailyView,
    activeBarberOpenDailyStats,
    isViewingOwnAccount,
    selectedDaySettlement,
    displayedDayIntakeStats,
    sessionRole,
    cycleBalance,
    selectedDayStats,
    openCreditsList,
    openManualCreditsForBarber,
    combinedOpenCreditsCount,
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
    const openPhones = new Set<string>();
    openCreditsList.forEach((ce) => {
      const digits = (ce.clientPhone || '').replace(/\D+/g, '').slice(-9);
      if (digits.length >= 6) openPhones.add(digits);
    });
    openManualCreditsForBarber.forEach((rec) => {
      [rec.clientPhone, ...(rec.additionalPhones || [])].forEach((ph) => {
        const digits = String(ph || '').replace(/\D+/g, '').slice(-9);
        if (digits.length >= 6) openPhones.add(digits);
      });
    });
    return creditDisputes.filter((d) => {
      if (d.status === 'resolved') return false;
      if (
        d.targetBarberId &&
        matchesCaisseBarber(d.targetBarberId, undefined, activeBarberId, roster)
      ) {
        return true;
      }
      const dDigits = (d.normalizedPhone || d.clientPhone || '').replace(/\D+/g, '').slice(-9);
      return dDigits.length >= 6 && openPhones.has(dDigits);
    });
  }, [creditDisputes, openCreditsList, openManualCreditsForBarber, activeBarberId, roster]);

  const dayDetailView = useMemo(() => {
    if (!dayDetailTarget) return null;
    const { barberId, date } = dayDetailTarget;
    const meta = getCaisseBarberMeta(barberId, roster);
    const pct = getEffectiveCommissionPercentForDate(barberId, date, settingsMap);
    const dayStats = computeBarberDayStats(barberId, date, entries, pct, roster);
    const daySettlement = findBarberDaySettlement(barberId, date, settlementsMap, roster);
    const isClosed = Boolean(daySettlement?.intakeClosed);

    const dayEntries = entries
      .filter((e) => matchesCaisseFinancialBarber(e, barberId, roster) && e.date === date)
      .slice()
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    const depositEntries = dayEntries.filter(
      (e) =>
        e.type === 'income' ||
        e.type === 'credit_repayment' ||
        e.type === 'float_adjustment' ||
        (e.type === 'barber_adjustment' && e.adjustmentDirection !== 'debit')
    );

    const withdrawalEntries = dayEntries.filter(
      (e) =>
        e.type === 'expense' ||
        e.type === 'float_return' ||
        (e.type === 'barber_adjustment' && e.adjustmentDirection === 'debit')
    );

    return {
      barberId,
      date,
      meta,
      pct,
      dayStats,
      daySettlement,
      isClosed,
      dayEntries,
      depositEntries,
      withdrawalEntries,
    };
  }, [dayDetailTarget, entries, settingsMap, settlementsMap, roster]);

  const openDayDetailModal = (barberId: CaisseBarberId, date: string) => {
    setDayDetailTarget({ barberId, date });
    setDayModalAddType('income');
    setDayModalAddAmount('');
    setDayModalAddNote('');
    setDayModalAddClientName('');
  };

  const handleAddEntryInDayModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionRole !== 'master' || !dayDetailTarget || dayModalAddBusy) return;
    const amt = Math.round(evaluateAmountExpression(dayModalAddAmount));
    if (amt <= 0) {
      showToast(
        'أدخل مبلغاً أكبر من 0',
        'يرجى تحديد مبلغ العملية بالدرهم قبل الحفظ.',
        'warning'
      );
      return;
    }

    setDayModalAddBusy(true);
    try {
      const { barberId, date } = dayDetailTarget;
      const meta = getCaisseBarberMeta(barberId, roster);
      const createdAtOverride = computeClosedDayCreatedAtOverride({
        barberId,
        date,
        entries,
        settlementsMap,
        rosterMembers: roster,
        businessTodayStr,
      });

      const createdEntry = queueCaisseEntryInstant({
        barberId,
        barberName: meta.name,
        type: dayModalAddType,
        date,
        expectedAmountMAD: amt,
        amountPaidMAD: amt,
        creditAmountMAD: 0,
        creditRemainingMAD: 0,
        creditStatus: 'none',
        clientName: dayModalAddClientName.trim() || undefined,
        note: dayModalAddNote.trim() || undefined,
        createdByRole: 'master',
        createdByName: staffName,
        createdAtOverride,
      });

      void resyncBarberDayArchiveAndSettlement({
        barberId,
        date,
        settingsMap,
        settlementsMap,
        rosterMembers: roster,
        currentBusinessDate: businessTodayStr,
      });

      setDayModalAddAmount('');
      setDayModalAddNote('');
      setDayModalAddClientName('');
      showToast(
        createdEntry.offlineCreated
          ? 'تم الحفظ في الكاش المحلي (بدون إنترنت) ✓'
          : `تمت إضافة العملية ليوم ${date} ✓`,
        createdEntry.offlineCreated
          ? `${amt} MAD · ستتم المزامنة تلقائياً فور عودة الإنترنت`
          : `${dayModalAddType === 'expense' ? 'سحب (هز)' : 'إيداع (حط)'}: ${amt} MAD`,
        createdEntry.offlineCreated ? 'info' : 'success'
      );
    } catch (err) {
      console.error('Failed to add entry in day modal:', err);
      showToast('تعذر حفظ العملية', 'يرجى المحاولة مرة أخرى.', 'warning');
    } finally {
      setDayModalAddBusy(false);
    }
  };

  const openEditModalForEntry = (entry: CaisseEntry) => {
    setEditingEntry(entry);
    setEditBarberId(entry.barberId);
    setEditType(entry.type);
    setEditAdjustmentDirection(entry.adjustmentDirection === 'debit' ? 'debit' : 'credit');
    setEditPaid(String(entry.amountPaidMAD));
    setEditCreditRem(String(entry.creditRemainingMAD));
    setEditClientName(entry.clientName || '');
    setEditClientPhone(entry.clientPhone || '');
    setEditRepayDate(entry.expectedRepaymentDate || '');
    setEditDate(entry.date);
    setEditNote(entry.note || '');
  };

  // Computed live remaining credit in income form
  const paidNum = Math.max(0, evaluateAmountExpression(amountPaidInput));
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
    const nowMs = getTrustedNowMs();
    const tenMinutesMs = 10 * 60 * 1000;
    return entries.find((entry) => {
      if (!matchesCaisseBarber(entry.barberId, entry.barberName, activeBarberId, roster)) return false;
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

  // Submit Income ("حطيت في المجر") — Synchronous instant local commit + immediate modal close
  const handleSubmitIncome = (
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
        const matchedTimeLabel = safeFormatTime(dup.createdAt, [], { hour: '2-digit', minute: '2-digit' }, '');
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

    try {
      const createdEntry = queueCaisseEntryInstant({
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

      // Close modal & clear form immediately in the exact same turn
      setOpenForm('none');
      setDuplicateWarning(null);
      setSelectedServiceIds([]);
      setAmountPaidInput('');
      setIncomeNote('');
      setHasCreditToggle(false);
      setAgreedTotalInput('');
      setCreditClientName('');
      setCreditClientPhone('');
      setCreditExpectedDate('');
      setIncomeSubmitting(false);
      startPostEntryTimer();

      showToast(
        createdEntry.offlineCreated
          ? 'تم الحفظ في الكاش المحلي (بدون إنترنت) ✓'
          : pickLang(lang, {
              ar: 'تم التسجيل في لاكيس ✓',
              fr: 'Enregistré en Caisse ✓',
              amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⴳ ⵍⴰⴽⵉⵙ ✓',
              en: 'Recorded in Caisse ✓',
              es: 'Registrado en Caja ✓',
            }),
        createdEntry.offlineCreated
          ? `${formatMAD(paidNum)} · ستتم المزامنة تلقائياً فور عودة الإنترنت`
          : formatMAD(paidNum),
        createdEntry.offlineCreated ? 'info' : 'success'
      );
    } catch (err) {
      console.error('Failed to add Caisse income:', err);
      setIncomeSubmitting(false);
    }
  };

  // Submit Expense ("هزيت الفلوس") — Synchronous instant local commit + immediate modal close
  const handleSubmitExpense = (
    e?: React.FormEvent,
    bypassDuplicateCheck = false
  ) => {
    if (e) e.preventDefault();
    const amt = Math.max(0, evaluateAmountExpression(expenseAmount));
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
        const matchedTimeLabel = safeFormatTime(dup.createdAt, [], { hour: '2-digit', minute: '2-digit' }, '');
        setDuplicateWarning({
          kind: 'expense',
          amount: Math.round(amt),
          matchedTimeLabel,
          matchedNote: dup.note || undefined,
        });
        return;
      }
    }

    try {
      const createdEntry = queueCaisseEntryInstant({
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
      // Close modal & reset state immediately
      setOpenForm('none');
      setDuplicateWarning(null);
      setExpenseAmount('');
      setExpenseNote('');
      setExpenseSubmitting(false);
      startPostEntryTimer();
      showToast(
        createdEntry.offlineCreated
          ? 'تم حفظ السحب في الكاش المحلي (بدون إنترنت) ✓'
          : pickLang(lang, {
              ar: 'تم تسجيل السحب / المصروف ✓',
              fr: 'Retrait enregistré ✓',
              amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⵙⵙⵓⴼⵖ ✓',
              en: 'Expense recorded ✓',
              es: 'Gasto registrado ✓',
            }),
        createdEntry.offlineCreated
          ? `${formatMAD(amt)} · ستتم المزامنة تلقائياً فور عودة الإنترنت`
          : formatMAD(amt),
        createdEntry.offlineCreated ? 'info' : 'success'
      );
    } catch (err) {
      console.error('Failed to add expense:', err);
      setExpenseSubmitting(false);
    }
  };

  // Submit Float Adjustment / Return ("الصرف — إضافة أو إرجاع فلوس الفكة في المجر" -> دائماً لحساب حسن الشخصي)
  const handleSubmitFloat = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(0, evaluateAmountExpression(floatAmount));
    if (amt <= 0) {
      showToast('أدخل مبلغ الصرف أولاً', '', 'warning');
      return;
    }
    const hassanMeta = getCaisseBarberMeta('hassan', roster);
    const targetType: CaisseEntryType =
      floatMode === 'return' ? 'float_return' : 'float_adjustment';
    const defaultNote =
      floatMode === 'return'
        ? 'إرجاع فلوس الصرف من المجر (حسن)'
        : 'إضافة فلوس الصرف للمجر (حسن)';
    try {
      const createdEntry = queueCaisseEntryInstant({
        barberId: 'hassan',
        barberName: hassanMeta.name,
        type: targetType,
        date: isLiveOpenDailyView ? businessTodayStr : selectedDate,
        expectedAmountMAD: amt,
        amountPaidMAD: amt,
        creditAmountMAD: 0,
        creditRemainingMAD: 0,
        creditStatus: 'none',
        note: floatNote.trim() || defaultNote,
        createdByRole: sessionRole,
        createdByName: staffName,
      });
      setOpenForm('none');
      setFloatAmount('');
      setFloatNote('');
      setFloatSubmitting(false);
      if (activeBarberId) startPostEntryTimer();
      showToast(
        createdEntry.offlineCreated
          ? 'تم حفظ الصرف في الكاش المحلي (بدون إنترنت) ✓'
          : floatMode === 'return'
          ? 'تم تسجيل إرجاع الصرف (حساب حسن) ✓'
          : pickLang(lang, {
              ar: 'تمت إضافة فلوس الصرف (حساب حسن) ✓',
              fr: 'Fond de caisse ajouté (Hassan) ✓',
              amz: 'ⵜⵜⵓⵔⵏⴰⵏ ⵉⴷⵔⵉⵎⵏ ⵏ ⵓⵙⵏⴼⵍ ✓',
              en: 'Float added (Hassan) ✓',
              es: 'Fondo de cambio añadido (Hassan) ✓',
            }),
        createdEntry.offlineCreated
          ? `${floatMode === 'return' ? '-' : '+'}${amt} MAD · ستتم المزامنة تلقائياً فور عودة الإنترنت`
          : `${floatMode === 'return' ? '-' : '+'}${amt} MAD`,
        createdEntry.offlineCreated ? 'info' : 'success'
      );
    } catch (err) {
      console.error('Failed to add float:', err);
      setFloatSubmitting(false);
    }
  };

  // Atomic Credit Repayment (Synchronous instant local commit)
  const handleConfirmRepay = (creditEntry: CaisseEntry) => {
    const amt = Math.max(0, Number(repayAmountInput) || 0);
    if (amt <= 0) return;
    try {
      const repayment = queueCaisseCreditRepaymentInstant({
        creditEntry,
        amountRepaidMAD: amt,
        repaidDate: businessTodayStr,
        actorRole: sessionRole,
        actorName: staffName,
      });
      setRepayingEntryId(null);
      setRepayAmountInput('');
      setRepayBusy(false);
      showToast(
        repayment.offlineCreated
          ? 'تم حفظ خلاص الكريدي في الكاش المحلي (بدون إنترنت) ✓'
          : pickLang(lang, {
              ar: 'تم تسجيل خلاص الكريدي ✓',
              fr: 'Remboursement enregistré ✓',
              amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⴼⵔⵓ ⵏ ⵓⴽⵔⵉⴷⵉ ✓',
              en: 'Credit repayment recorded ✓',
              es: 'Pago de crédito registrado ✓',
            }),
        repayment.offlineCreated
          ? `${amt} MAD · ستتم المزامنة تلقائياً فور عودة الإنترنت`
          : `${amt} MAD`,
        repayment.offlineCreated ? 'info' : 'success'
      );
    } catch (err) {
      console.error('Credit repayment failed:', err);
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

  // Master: Close Daily Cycle ("تصفية الحساب اليومي / جمع حساب اليوم" — resets open daily drawer to 0 across all accounts)
  const handleCloseDayIntake = async () => {
    if (sessionRole !== 'master' || !activeBarberId) return;
    setDailyIntakeCloseBusy(true);
    try {
      const targetCloseDate = isLiveOpenDailyView ? businessTodayStr : selectedDate;
      const targetDayStats = isLiveOpenDailyView ? activeBarberOpenDailyStats : selectedDayStats;
      const targetExistingSettlement = findBarberDaySettlement(
        activeBarberId,
        targetCloseDate,
        settlementsMap,
        roster
      );
      let maxEntryCreatedAt = new Date(getTrustedNowMs()).toISOString().slice(0, 64);
      if (
        isLiveOpenDailyView &&
        activeBarberOpenDailyStats.lastDailyCloseIso &&
        activeBarberOpenDailyStats.lastDailyCloseIso >= maxEntryCreatedAt
      ) {
        const prevMs = Date.parse(activeBarberOpenDailyStats.lastDailyCloseIso);
        if (Number.isFinite(prevMs)) {
          maxEntryCreatedAt = new Date(prevMs + 1).toISOString().slice(0, 64);
        }
      }
      const sourceList = isLiveOpenDailyView ? activeBarberOpenDailyStats.openEntries : entries;
      for (const e of sourceList) {
        if (
          (isLiveOpenDailyView || e.date === targetCloseDate) &&
          matchesCaisseFinancialBarber(e, activeBarberId, roster) &&
          e.createdAt &&
          e.createdAt > maxEntryCreatedAt
        ) {
          maxEntryCreatedAt = e.createdAt.slice(0, 64);
        }
      }
      await closeBarberDayIntake({
        barberId: activeBarberId,
        barberName: activeBarberMeta.name,
        date: targetCloseDate,
        dayStats: targetDayStats,
        carryOverOwedMAD: Math.max(0, cycleBalance.barberNetOwedMAD),
        confirmedBy: staffName,
        existingSettlement: targetExistingSettlement,
        maxEntryCreatedAt,
      });
      showToast(
        `تمت تصفية الحساب اليومي (${activeBarberMeta.arName} · ${targetCloseDate}) ✓`,
        'تم تصفير رصيد المجر اليومي إلى 0 MAD · الرصيد الشهري/التراكمي محفوظ',
        'success'
      );
    } catch (err) {
      console.error('Failed to close daily intake:', err);
    } finally {
      setDailyIntakeCloseBusy(false);
    }
  };

  // Master: Close ALL Barbers' Daily Cycles ("تصفية الحساب اليومي للجميع" — resets entire drawer to 0 MAD while preserving monthly/cycle balances)
  const handleCloseAllBarbersDayIntake = async () => {
    if (sessionRole !== 'master') return;
    setDailyIntakeCloseBusy(true);
    try {
      const targetCloseDate = isLiveOpenDailyView ? businessTodayStr : selectedDate;
      const closedCount = await closeAllBarbersDailyIntakeThrough({
        barbers: allCaisseBarbers,
        throughDate: targetCloseDate,
        entries,
        settingsMap,
        settlementsMap,
        cycles,
        rosterMembers: roster,
        manualCredits,
        confirmedBy: staffName,
      });
      showToast(
        closedCount > 0
          ? `تمت تصفية الحساب اليومي للجميع (${closedCount}) ✓`
          : `حساب المجر مصفّر ومغلق بالفعل (${targetCloseDate}) ✓`,
        'تم تصفير المجر اليومي إلى 0 MAD مع حفظ الرصيد الشهري والتراكمي',
        'success'
      );
    } catch (err) {
      console.error('Failed to close all barbers daily intake:', err);
    } finally {
      setDailyIntakeCloseBusy(false);
    }
  };

  // Execute Monthly / Cycle Payout Settlement After Negative-Balance Prompt (If Applicable)
  const executePayoutWithResolutions = async (
    targetMode: 'single' | 'all_barbers',
    resolutionsByBarber: Record<string, 'cleared' | 'carried_forward'>
  ) => {
    if (sessionRole !== 'master') return;
    setPayoutBusy(true);
    try {
      if (targetMode === 'all_barbers') {
        const targets = allBarbersPayoutPreview.barbersWithOpenEntries;
        if (targets.length === 0) {
          showToast('لا توجد عمليات مفتوحة للتصفية حالياً', '', 'info');
          return;
        }
        for (const item of targets) {
          const cb = item.preview.cycleBalance;
          const isNeg = cb.barberNetOwedMAD < 0;
          const negRes = isNeg
            ? resolutionsByBarber[cb.barberId] || 'carried_forward'
            : undefined;
          await confirmBarberCyclePayout({
            cycleBalance: cb,
            confirmedBy: staffName,
            businessDate: businessTodayStr,
            settlementPeriodScope: payoutScope,
            periodStartDate: item.preview.periodStartDate,
            periodEndDate: item.preview.periodEndDate,
            negativeResolution: negRes,
            carryForwardBalanceMAD:
              isNeg && negRes === 'carried_forward' ? cb.barberNetOwedMAD : undefined,
            note: payoutNote.trim() || undefined,
          });
        }
        setNegativePayoutPrompt(null);
        setPayoutConfirmOpen(false);
        setPayoutNote('');
        showToast(
          `تمت تصفية حسابات جميع الحلاقين معاً (${targets.length}) ✓`,
          `${allBarbersPayoutPreview.totalBarberNetOwedMAD} MAD`,
          'success'
        );
      } else {
        const targetCycle = payoutPreview.cycleBalance;
        const isNeg = targetCycle.barberNetOwedMAD < 0;
        const negRes = isNeg
          ? resolutionsByBarber[targetCycle.barberId] || 'carried_forward'
          : undefined;
        await confirmBarberCyclePayout({
          cycleBalance: targetCycle,
          confirmedBy: staffName,
          businessDate: businessTodayStr,
          settlementPeriodScope: payoutScope,
          periodStartDate: payoutPreview.periodStartDate,
          periodEndDate: payoutPreview.periodEndDate,
          negativeResolution: negRes,
          carryForwardBalanceMAD:
            isNeg && negRes === 'carried_forward' ? targetCycle.barberNetOwedMAD : undefined,
          note: payoutNote.trim() || undefined,
        });
        setNegativePayoutPrompt(null);
        setPayoutConfirmOpen(false);
        setPayoutNote('');
        const settledDisplayMAD =
          isNeg && negRes === 'cleared' ? 0 : targetCycle.barberNetOwedMAD;
        showToast(
          pickLang(lang, {
            ar: `تمت تصفية حساب ${activeBarberMeta.arName} ✓`,
            fr: `Compte de ${activeBarberMeta.name} soldé ✓`,
            amz: `ⵉⵜⵜⵓⵙⴼⴹ ⵓⵙⵉⴹⵏ ⵏ ${activeBarberMeta.arName} ✓`,
            en: `Payout settled for ${activeBarberMeta.name} ✓`,
            es: `Cuenta liquidada para ${activeBarberMeta.name} ✓`,
          }),
          isNeg && negRes === 'carried_forward'
            ? `ترحيل للشهر الجاي: ${targetCycle.barberNetOwedMAD} MAD`
            : `${settledDisplayMAD} MAD`,
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to confirm payout settlement:', err);
    } finally {
      setPayoutBusy(false);
    }
  };

  // Master: Confirm Cumulative / Monthly / Custom-Period Payout Settlement (Single Barber OR All Barbers Together)
  const handleConfirmPayout = async () => {
    if (sessionRole !== 'master') return;
    if (payoutTargetMode === 'all_barbers') {
      const targets = allBarbersPayoutPreview.barbersWithOpenEntries;
      if (targets.length === 0) {
        showToast('لا توجد عمليات مفتوحة للتصفية حالياً', '', 'info');
        return;
      }
      const negativeItems = targets.filter(
        (item) => item.preview.cycleBalance.barberNetOwedMAD < 0
      );
      if (negativeItems.length > 0) {
        const initResolutions: Record<string, 'cleared' | 'carried_forward'> = {};
        negativeItems.forEach((item) => {
          initResolutions[item.barber.id] = 'carried_forward';
        });
        setNegativePayoutPrompt({
          mode: 'all_barbers',
          barbers: negativeItems.map((item) => ({
            barberId: item.barber.id,
            arName: item.barber.arName,
            negativeAmountMAD: item.preview.cycleBalance.barberNetOwedMAD,
            cycleBalance: item.preview.cycleBalance,
            periodStartDate: item.preview.periodStartDate,
            periodEndDate: item.preview.periodEndDate,
          })),
          resolutions: initResolutions,
        });
        return;
      }
      await executePayoutWithResolutions('all_barbers', {});
    } else {
      const targetCycle = payoutPreview.cycleBalance;
      if (targetCycle.barberNetOwedMAD < 0) {
        setNegativePayoutPrompt({
          mode: 'single',
          barbers: [
            {
              barberId: targetCycle.barberId,
              arName: activeBarberMeta.arName,
              negativeAmountMAD: targetCycle.barberNetOwedMAD,
              cycleBalance: targetCycle,
              periodStartDate: payoutPreview.periodStartDate,
              periodEndDate: payoutPreview.periodEndDate,
            },
          ],
          resolutions: {
            [targetCycle.barberId]: 'carried_forward',
          },
        });
        return;
      }
      await executePayoutWithResolutions('single', {});
    }
  };

  // Master: Isolated Edit / Clear of Barber Balance (Zeroes negative balance or sets/adjusts isolated barber balance without altering shop totals or other barbers)
  const openBalanceAdjustModal = (preferredMode?: 'zero_negative' | 'set_target' | 'delta') => {
    if (sessionRole !== 'master' || !activeBarberId) return;
    const isNeg = cycleBalance.barberNetOwedMAD < 0;
    const mode = preferredMode || (isNeg ? 'zero_negative' : 'set_target');
    setBalanceAdjustMode(mode);
    setBalanceAdjustDirection('credit');
    setBalanceAdjustAmount(
      mode === 'zero_negative' && isNeg
        ? String(Math.abs(Math.round(cycleBalance.barberNetOwedMAD)))
        : mode === 'set_target'
        ? '0'
        : ''
    );
    setBalanceAdjustNote(
      mode === 'zero_negative' && isNeg
        ? `تصفية الرصيد السالب (${cycleBalance.barberNetOwedMAD} MAD) — دفع المبلغ معزولاً`
        : ''
    );
    setBalanceAdjustDate(businessTodayStr);
    setBalanceAdjustModalOpen(true);
  };

  const handleSubmitBalanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionRole !== 'master' || !activeBarberId) return;
    const currentBal = Math.round(cycleBalance.barberNetOwedMAD);
    let direction: 'credit' | 'debit' = 'credit';
    let amt = 0;
    let autoNote = '';

    if (balanceAdjustMode === 'zero_negative') {
      if (currentBal >= 0) {
        showToast('رصيد الحلاق ليس سالباً حالياً', '', 'info');
        return;
      }
      direction = 'credit';
      amt = Math.abs(currentBal);
      autoNote = `تصفير الرصيد السالب (${currentBal} MAD) — أداء الحلاق معزول`;
    } else if (balanceAdjustMode === 'set_target') {
      const targetVal = Math.round(Number(balanceAdjustAmount) || 0);
      const diff = targetVal - currentBal;
      if (diff === 0) {
        showToast('الرصيد يطابق هذا المبلغ بالفعل', '', 'info');
        return;
      }
      direction = diff > 0 ? 'credit' : 'debit';
      amt = Math.abs(diff);
      autoNote = `تعديل رصيد ${activeBarberMeta.arName} من ${currentBal} إلى ${targetVal} MAD (معزول)`;
    } else {
      amt = Math.max(0, Math.round(Number(balanceAdjustAmount) || 0));
      direction = balanceAdjustDirection;
      autoNote =
        direction === 'credit'
          ? `تسوية رصيد معزولة (+${amt} MAD لـ ${activeBarberMeta.arName})`
          : `تسوية رصيد معزولة (−${amt} MAD على ${activeBarberMeta.arName})`;
    }

    if (amt <= 0) {
      showToast('أدخل مبلغاً أكبر من 0', '', 'warning');
      return;
    }

    try {
      const createdEntry = queueCaisseEntryInstant({
        barberId: activeBarberId,
        barberName: activeBarberMeta.name,
        type: 'barber_adjustment',
        adjustmentDirection: direction,
        date: balanceAdjustDate || businessTodayStr,
        expectedAmountMAD: amt,
        amountPaidMAD: amt,
        creditAmountMAD: 0,
        creditRemainingMAD: 0,
        creditStatus: 'none',
        note: balanceAdjustNote.trim() || autoNote,
        createdByRole: 'master',
        createdByName: staffName,
      });
      setBalanceAdjustModalOpen(false);
      setBalanceAdjustAmount('');
      setBalanceAdjustNote('');
      setBalanceAdjustBusy(false);
      showToast(
        createdEntry.offlineCreated
          ? 'تم حفظ التسوية في الكاش المحلي (بدون إنترنت) ✓'
          : `تم تعديل رصيد ${activeBarberMeta.arName} بشكل معزول ✓`,
        createdEntry.offlineCreated
          ? `${direction === 'credit' ? '+' : '-'}${amt} MAD · ستتم المزامنة تلقائياً فور عودة الإنترنت`
          : `${direction === 'credit' ? '+' : '-'}${amt} MAD (دون المساس بباقي الحلاقين أو المحل)`,
        createdEntry.offlineCreated ? 'info' : 'success'
      );
    } catch (err) {
      console.error('Failed to adjust barber balance:', err);
      setBalanceAdjustBusy(false);
    }
  };

  const handleSubmitCaisseCreditSettlementRequest = async (entry: CaisseEntry) => {
    const rawNum = Math.max(0, Number(settleReqAmountInput) || 0);
    const maxRem = getEffectiveCaisseCreditRemaining(entry);
    const cleanAmt = Math.min(maxRem, rawNum > 0 ? rawNum : maxRem);
    if (cleanAmt <= 0) {
      showToast('أدخل مبلغاً أكبر من 0', '', 'warning');
      return;
    }
    setSettleReqBusy(true);
    try {
      await submitCreditSettlementRequest({
        sourceType: 'caisse',
        sourceId: entry.id,
        barberId: entry.barberId,
        barberName: activeBarberMeta.arName || entry.barberName,
        clientName: entry.clientName || 'زبون',
        clientPhone: entry.clientPhone || '',
        actionType: settleReqAction,
        originalRemainingMAD: maxRem,
        requestedAmountMAD: cleanAmt,
        note: settleReqNoteInput.trim() || undefined,
        submittedBy: staffName,
        submittedRole: sessionRole === 'master' ? 'master' : sessionRole === 'caisse' ? 'caisse' : 'barber',
      });
      setSettleReqEntryId(null);
      setSettleReqNoteInput('');
      showToast(
        settleReqAction === 'pay'
          ? 'تم إرسال طلب خلاص الكريدي للمشرف حسن ✓'
          : 'تم إرسال طلب فك الكريدي للمشرف حسن ✓',
        `${cleanAmt} MAD`,
        'success'
      );
    } catch (err) {
      console.error('Failed to submit credit settlement request:', err);
    } finally {
      setSettleReqBusy(false);
    }
  };

  const handleConfirmManualCreditRepay = async (rec: ClientCreditRecord) => {
    if (sessionRole !== 'master') return;
    const maxRem = getEffectiveManualCreditRemaining(rec);
    const amt = Math.min(maxRem, Math.max(0, Number(repayManualAmountInput) || 0));
    if (amt <= 0) return;
    setRepayManualBusy(true);
    try {
      await recordManualCreditPayment(rec, amt);
      setRepayingManualId(null);
      setRepayManualAmountInput('');
      showToast(
        pickLang(lang, {
          ar: 'تم تسجيل خلاص الكريدي ✓',
          fr: 'Remboursement enregistré ✓',
          amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ⵓⴼⵔⵓ ⵏ ⵓⴽⵔⵉⴷⵉ ✓',
          en: 'Credit payment recorded ✓',
          es: 'Pago de crédito registrado ✓',
        }),
        `${amt} MAD`,
        'success'
      );
    } catch (err) {
      console.error('Manual credit repayment failed:', err);
    } finally {
      setRepayManualBusy(false);
    }
  };

  const handleSubmitManualCreditSettlementRequest = async (rec: ClientCreditRecord) => {
    const rawNum = Math.max(0, Number(settleReqManualAmountInput) || 0);
    const maxRem = getEffectiveManualCreditRemaining(rec);
    const cleanAmt = Math.min(maxRem, rawNum > 0 ? rawNum : maxRem);
    if (cleanAmt <= 0) {
      showToast('أدخل مبلغاً أكبر من 0', '', 'warning');
      return;
    }
    setSettleReqManualBusy(true);
    try {
      await submitCreditSettlementRequest({
        sourceType: 'manual',
        sourceId: rec.id,
        barberId: rec.barberId || activeBarberId || 'hassan',
        barberName: rec.barberName || activeBarberMeta.arName,
        clientName: rec.clientName || 'زبون',
        clientPhone: rec.clientPhone || '',
        actionType: settleReqManualAction,
        originalRemainingMAD: maxRem,
        requestedAmountMAD: cleanAmt,
        note: settleReqManualNoteInput.trim() || undefined,
        submittedBy: staffName,
        submittedRole:
          sessionRole === 'master' ? 'master' : sessionRole === 'caisse' ? 'caisse' : 'barber',
      });
      setSettleReqManualId(null);
      setSettleReqManualNoteInput('');
      showToast(
        settleReqManualAction === 'pay'
          ? 'تم إرسال طلب خلاص الكريدي للمشرف حسن ✓'
          : 'تم إرسال طلب فك الكريدي للمشرف حسن ✓',
        `${cleanAmt} MAD`,
        'success'
      );
    } catch (err) {
      console.error('Failed to submit manual credit settlement request:', err);
    } finally {
      setSettleReqManualBusy(false);
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

  // Save Entry / Credit Edit (Master Admin full edit, or owning Barber for their drawer)
  const handleSaveEntryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    const canEdit =
      sessionRole === 'master' ||
      (sessionRole === 'barber' && editingEntry.barberId === activeBarberId);
    if (!canEdit) return;
    setEditBusy(true);
    try {
      const effectiveType = sessionRole === 'master' ? editType : editingEntry.type;
      const effectiveBarberId = isFloatEntryType(effectiveType)
        ? 'hassan'
        : sessionRole === 'master'
        ? editBarberId
        : editingEntry.barberId;
      const effectiveBarberMeta = getCaisseBarberMeta(effectiveBarberId, roster);
      const nextPaid = Math.max(0, Number(editPaid) || 0);
      const isCreditCapable = effectiveType === 'income' || effectiveType === 'credit_repayment';
      const nextCreditRem = isCreditCapable ? Math.max(0, Number(editCreditRem) || 0) : 0;
      const nextCreditOrig = isCreditCapable
        ? Math.max(Number(editingEntry.creditAmountMAD) || 0, nextCreditRem)
        : 0;
      const nextExpected = isCreditCapable
        ? Math.max(nextPaid + nextCreditRem, nextPaid)
        : nextPaid;
      const targetNewDate = sessionRole === 'master' ? editDate || editingEntry.date : editingEntry.date;
      await updateCaisseEntry(editingEntry.id, {
        barberId: effectiveBarberId,
        barberName: effectiveBarberMeta.name,
        type: effectiveType,
        adjustmentDirection:
          effectiveType === 'barber_adjustment' ? editAdjustmentDirection : undefined,
        amountPaidMAD: nextPaid,
        expectedAmountMAD: nextExpected,
        creditAmountMAD: nextCreditOrig,
        creditRemainingMAD: nextCreditRem,
        creditStatus: !isCreditCapable
          ? 'none'
          : nextCreditRem > 0
          ? nextPaid > 0
            ? 'partial'
            : 'open'
          : nextCreditOrig > 0
          ? 'paid'
          : 'none',
        clientName: editClientName.trim() || '',
        clientPhone: editClientPhone.trim() || '',
        expectedRepaymentDate: editRepayDate.trim() || '',
        date: targetNewDate,
        note: editNote.trim(),
      });
      if (sessionRole === 'master') {
        await resyncBarberDayArchiveAndSettlement({
          barberId: editingEntry.barberId,
          date: editingEntry.date,
          settingsMap,
          settlementsMap,
          rosterMembers: roster,
          currentBusinessDate: businessTodayStr,
        });
        if (effectiveBarberId !== editingEntry.barberId || targetNewDate !== editingEntry.date) {
          await resyncBarberDayArchiveAndSettlement({
            barberId: effectiveBarberId,
            date: targetNewDate,
            settingsMap,
            settlementsMap,
            rosterMembers: roster,
            currentBusinessDate: businessTodayStr,
          });
        }
      }
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

  const handleConfirmDeleteEntry = async () => {
    if (sessionRole !== 'master' || !confirmDeleteEntry) return;
    const deletedEntry = confirmDeleteEntry;
    const targetId = deletedEntry.id;
    setDeleteEntryBusy(true);
    try {
      await deleteCaisseEntry(targetId);
      await resyncBarberDayArchiveAndSettlement({
        barberId: deletedEntry.barberId,
        date: deletedEntry.date,
        settingsMap,
        settlementsMap,
        rosterMembers: roster,
        currentBusinessDate: businessTodayStr,
      });
      setConfirmDeleteEntry(null);
      if (editingEntry?.id === targetId) setEditingEntry(null);
      if (selectedDrillEntry?.id === targetId) setSelectedDrillEntry(null);
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
    } finally {
      setDeleteEntryBusy(false);
    }
  };

  const handleConfirmDeleteCycle = async () => {
    if (sessionRole !== 'master' || !confirmDeleteCycle) return;
    setDeleteCycleBusy(true);
    try {
      await deleteCaisseCycleSettlement(confirmDeleteCycle.id);
      setConfirmDeleteCycle(null);
      showToast('تم حذف سجل تصفية الحساب', '', 'info');
    } catch (err) {
      console.error('Failed to delete cycle settlement:', err);
    } finally {
      setDeleteCycleBusy(false);
    }
  };

  const formatEntryTypeBadge = (
    type: CaisseEntryType,
    adjustmentDirection?: 'credit' | 'debit'
  ) => {
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
          ar: 'إضافة صرف',
          fr: 'Fond de caisse +',
          amz: 'ⵉⴷⵔⵉⵎⵏ ⵏ ⵓⵙⵏⴼⵍ +',
          en: 'Float +',
          es: 'Fondo +',
        }),
        cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
        sign: '+',
      };
    }
    if (type === 'float_return') {
      return {
        label: pickLang(lang, {
          ar: 'إرجاع صرف',
          fr: 'Retour fond -',
          amz: 'ⴰⵙⵓⵔⵉ ⵏ ⵓⵙⵏⴼⵍ -',
          en: 'Float Return -',
          es: 'Devolución -',
        }),
        cls: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40',
        sign: '-',
      };
    }
    if (type === 'barber_adjustment') {
      const isDebit = adjustmentDirection === 'debit';
      return {
        label: isDebit ? 'تسوية رصيد معزولة (−)' : 'تعديل / تصفية رصيد معزول (+)',
        cls: isDebit
          ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
          : 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
        sign: isDebit ? '-' : '+',
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

  const floatModalNode = openForm === 'float' ? (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 sb-modal-backdrop"
        onClick={() => setOpenForm('none')}
      >
        <form
          onSubmit={handleSubmitFloat}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#141720] border-2 border-amber-400 dark:border-amber-500/50 shadow-2xl space-y-4 text-xs"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <span className="font-black text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <Coins className="w-4 h-4" />
              <span>الصرف (فلوس الفكة في المجر) — حساب حسن ايت بومليك الشخصي</span>
            </span>
            <button
              type="button"
              onClick={() => setOpenForm('none')}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 py-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-500/35 text-[11px] font-bold text-amber-900 dark:text-amber-200 leading-relaxed">
            يُضاف/يُرجع من المجر ويُحتسب ضمن الرصيد الشخصي لحسن ايت بومليك دون دخوله في المداخيل أو نسبة الحلاقة.
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFloatMode('add')}
              className={`py-2 px-3 rounded-xl border font-black text-xs cursor-pointer transition-colors ${
                floatMode === 'add'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              + إضافة صرف للمجر
            </button>
            <button
              type="button"
              onClick={() => setFloatMode('return')}
              className={`py-2 px-3 rounded-xl border font-black text-xs cursor-pointer transition-colors ${
                floatMode === 'return'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              − إرجاع / سحب صرف
            </button>
          </div>

          <div className="space-y-3">
            <CaisseAmountField
              label="المبلغ (MAD) *"
              value={floatAmount}
              onChange={setFloatAmount}
              quickAmounts={[50, 100, 200, 500]}
              accent="amber"
              placeholder="0"
              required
              autoFocus
              unitOnChips
            />
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                ملاحظة (اختيارية)
              </label>
              <input
                type="text"
                value={floatNote}
                onChange={(e) => setFloatNote(e.target.value)}
                placeholder={
                  floatMode === 'return' ? 'إرجاع الصرف بعد انتهاء العمل' : 'فلوس الفكة / الصرف لليوم'
                }
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
              className={`px-5 py-2 rounded-xl text-white font-black text-xs cursor-pointer ${
                floatMode === 'return'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              {floatSubmitting
                ? 'جاري الحفظ...'
                : floatMode === 'return'
                ? 'تأكيد إرجاع الصرف ✓'
                : 'حفظ إضافة الصرف ✓'}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  ) : null;

  const drawerBreakdownModalNode =
    (sessionRole === 'master' || sessionRole === 'caisse') && drawerModalOpen ? (
      <ModalPortal>
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop"
          onClick={() => setDrawerModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden text-xs"
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
                    {sessionRole === 'caisse'
                      ? 'المجر اليوم (الدورة اليومية المفتوحة)'
                      : 'الحساب في المجر — المجموع والتفريق'}
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {sessionRole === 'caisse'
                      ? 'صرف حسن + المداخيل − السحوبات في الدورة اليومية المفتوحة (يتصفر عند تصفية الحساب اليومي)'
                      : 'الرصيد الفعلي في المجر (يتصفر تلقائياً بعد تصفية الحساب اليومي مع حفظ الرصيد الشهري)'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canToggleCaissePrivacy && (
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
                )}
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
              {/* Scope Switcher (Master Only; Caisse shows open daily cycle strictly) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {sessionRole === 'master' ? (
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setDrawerModalScope('open_daily')}
                      className={`px-3 py-1.5 rounded-lg font-black text-xs cursor-pointer transition-colors ${
                        drawerModalScope === 'open_daily'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      الدورة اليومية المفتوحة (فـ المجر حالياً)
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
                      تاريخ محدد ({selectedDate})
                    </button>
                  </div>
                ) : (
                  <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-800 dark:text-emerald-200 font-black text-xs">
                    الدورة اليومية المفتوحة (في المجر حالياً)
                  </span>
                )}

                <span className="text-[11px] font-mono text-zinc-500">
                  {activeDrawerSummary.entryCount} عملية مفتوحة
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
                      {sessionRole === 'caisse' ? 'المجموع فـ المجر حالياً' : 'المجموع فـ المجر ككل'}
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
                        {sessionRole === 'master' && (
                          <th className="py-2.5 px-2 text-start">حصة المحل</th>
                        )}
                        <th className="py-2.5 px-3 text-start">صافي فـ المجر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono tabular-nums">
                      {activeDrawerSummary.byBarber.map((row) => {
                        const bTone = getBarberIdentityTokens(row.barberId, row.arName);
                        const rowBoxKey = `drawer_barber_${row.barberId}`;
                        return (
                          <tr
                            key={row.barberId}
                            onClick={() => {
                              setSelectedBarberId(row.barberId);
                              setDrawerModalOpen(false);
                            }}
                            className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/70 cursor-pointer transition-colors ${bTone.borderLeftClass}`}
                          >
                            <td className="py-2.5 px-3 font-sans">
                              <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full shrink-0 ${bTone.dotClass}`} />
                                <div>
                                  <div className="font-black text-zinc-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                    <span>{row.arName}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${bTone.badgeClass}`}>
                                      {bTone.shortLabelAr}
                                    </span>
                                    {renderBoxEyeButton(rowBoxKey, true)}
                                  </div>
                                  <div className="text-[10px] font-mono text-zinc-400">
                                    {row.entryCount} عمليات
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-amber-700 dark:text-amber-300 font-bold">
                              {row.barberId === 'hassan' ? formatMAD(row.floatMAD, rowBoxKey) : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-emerald-700 dark:text-emerald-400 font-bold">
                              {formatMAD(row.incomeMAD, rowBoxKey)}
                            </td>
                            <td className="py-2.5 px-2 text-rose-600 dark:text-rose-400 font-bold">
                              {formatMAD(row.expensesMAD, rowBoxKey)}
                            </td>
                            {sessionRole === 'master' && (
                              <td className="py-2.5 px-2 text-zinc-700 dark:text-zinc-300">
                                {formatMAD(row.shopShareMAD, rowBoxKey)}
                              </td>
                            )}
                            <td
                              dir="ltr"
                              className={`py-2.5 px-3 font-black ${
                                row.netDrawerContributionMAD < 0
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : 'text-zinc-900 dark:text-white'
                              }`}
                            >
                              {formatMAD(row.netDrawerContributionMAD, rowBoxKey)}
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
                          {formatMAD(activeDrawerSummary.totalFloatMAD, 'drawer_float')}
                        </td>
                        <td className="py-2.5 px-2 text-emerald-700 dark:text-emerald-400">
                          {formatMAD(activeDrawerSummary.totalIncomeMAD, 'drawer_income')}
                        </td>
                        <td className="py-2.5 px-2 text-rose-600 dark:text-rose-400">
                          {formatMAD(activeDrawerSummary.totalExpensesMAD, 'drawer_expenses')}
                        </td>
                        {sessionRole === 'master' && (
                          <td className="py-2.5 px-2 text-emerald-700 dark:text-emerald-400">
                            {formatMAD(activeDrawerSummary.totalShopShareMAD, 'drawer_net_total')}
                          </td>
                        )}
                        <td dir="ltr" className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 text-sm">
                          {formatMAD(activeDrawerSummary.netTotalMAD, 'drawer_net_total')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
    ) : null;

  const hassanPinModalNode = hassanPinModalOpen ? (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 sb-modal-backdrop"
        onClick={() => {
          setHassanPinModalOpen(null);
          setHassanPinInput('');
          setHassanPinError('');
        }}
      >
        <form
          onSubmit={handleVerifyHassanRevealPin}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#141720] border-2 border-amber-400 dark:border-amber-500/50 p-5 space-y-4 shadow-2xl text-xs"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <span className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>إظهار أرقام حسن ايت بومليك</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setHassanPinModalOpen(null);
                setHassanPinInput('');
                setHassanPinError('');
              }}
              className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
            أدخل رمز الدخول الخاص بحسن للكشف عن الأرقام السرية الخاصة بحسابه:
          </p>
          <input
            type="password"
            inputMode="numeric"
            value={hassanPinInput}
            onChange={(e) => {
              setHassanPinInput(e.target.value);
              setHassanPinError('');
            }}
            placeholder="أدخل الرمز..."
            autoFocus
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-center font-mono text-base font-black tracking-widest text-zinc-900 dark:text-white outline-none"
          />
          {hassanPinError && (
            <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
              {hassanPinError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setHassanPinModalOpen(null);
                setHassanPinInput('');
                setHassanPinError('');
              }}
              className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer"
            >
              كشف الأرقام ✓
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  ) : null;

  const caisseCalculatorModalNode =
    sessionRole === 'caisse' ? (
      <CaisseCalculatorModal
        isOpen={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        barberLabel={activeBarberId ? activeBarberMeta.arName : 'لاكيس الصالون'}
        onApplyToIncome={
          activeBarberId
            ? (amountStr) => {
                setCalculatorOpen(false);
                setAmountPaidInput(amountStr);
                openQuickIncomeForm(false);
              }
            : undefined
        }
        onApplyToExpense={
          activeBarberId
            ? (amountStr) => {
                setCalculatorOpen(false);
                setExpenseAmount(amountStr);
                setDuplicateWarning(null);
                setOpenForm('expense');
              }
            : undefined
        }
      />
    ) : null;

  const renderEntryOriginBadge = (entry: CaisseEntry) => {
    const isPc = entry.deviceKind === 'pc';
    const isPhone = entry.deviceKind === 'phone';
    const badgeCls = isPc
      ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-200 dark:border-indigo-500/35'
      : isPhone
      ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-200 dark:border-teal-500/35'
      : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
    return (
      <span className="inline-flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setInspectOriginEntry(entry);
          }}
          title="اضغط لعرض تفاصيل الجهاز والحساب المسجّل للعملية"
          className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 cursor-pointer transition-colors ${badgeCls}`}
        >
          {isPc ? (
            <>
              <Monitor className="w-3 h-3 shrink-0" />
              <span>بيسي (PC)</span>
            </>
          ) : isPhone ? (
            <>
              <Smartphone className="w-3 h-3 shrink-0" />
              <span>تيليفون</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 shrink-0" />
              <span>قديم</span>
            </>
          )}
        </button>
        {entry.offlinePending && (
          <span
            title="محفوظ محلياً — في انتظار المزامنة مع السحابة"
            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200 inline-flex items-center gap-1"
          >
            <CloudOff className="w-3 h-3 shrink-0" />
            <span>
              {caisseOffline.isOnline && caisseOffline.isSyncing && !caisseOffline.lastSyncError
                ? 'قيد المزامنة'
                : 'معلق'}
            </span>
          </span>
        )}
      </span>
    );
  };

  const inspectOriginModalNode = inspectOriginEntry ? (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[125] flex items-center justify-center p-4 sb-modal-backdrop"
        onClick={() => setInspectOriginEntry(null)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden text-xs"
        >
          <div className="p-4 border-b border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                  inspectOriginEntry.deviceKind === 'pc'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/15 dark:border-indigo-500/35 dark:text-indigo-300'
                    : inspectOriginEntry.deviceKind === 'phone'
                    ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-500/15 dark:border-teal-500/35 dark:text-teal-300'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'
                }`}
              >
                {inspectOriginEntry.deviceKind === 'pc' ? (
                  <Monitor className="w-4 h-4" />
                ) : inspectOriginEntry.deviceKind === 'phone' ? (
                  <Smartphone className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate">
                  تفاصيل الجهاز ومصدر العملية
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {inspectOriginEntry.deviceKind === 'pc'
                    ? 'تم التسجيل من حاسوب (PC)'
                    : inspectOriginEntry.deviceKind === 'phone'
                    ? 'تم التسجيل من هاتف محمول (Phone)'
                    : 'عملية مسجلة قبل تحديث تتبع الأجهزة'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInspectOriginEntry(null)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-900/90 border border-stone-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 block mb-0.5">نوع الجهاز</span>
                <strong className="text-zinc-900 dark:text-white inline-flex items-center gap-1">
                  {inspectOriginEntry.deviceKind === 'pc'
                    ? 'بيسي (PC)'
                    : inspectOriginEntry.deviceKind === 'phone'
                    ? 'تيليفون (Phone)'
                    : 'غير محدد'}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-900/90 border border-stone-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 block mb-0.5">معرّف الجهاز</span>
                <strong dir="ltr" className="font-mono text-zinc-900 dark:text-white">
                  {inspectOriginEntry.deviceId || '—'}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-900/90 border border-stone-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 block mb-0.5">النظام والمتصفح</span>
                <strong dir="ltr" className="text-zinc-900 dark:text-white">
                  {inspectOriginEntry.devicePlatform || inspectOriginEntry.deviceBrowser
                    ? `${inspectOriginEntry.devicePlatform || ''} ${
                        inspectOriginEntry.deviceBrowser
                          ? `· ${inspectOriginEntry.deviceBrowser}`
                          : ''
                      }`.trim()
                    : 'غير مسجل'}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-900/90 border border-stone-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 block mb-0.5">حالة المزامنة</span>
                {inspectOriginEntry.offlinePending ? (
                  <strong className="text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                    <CloudOff className="w-3.5 h-3.5" />
                    <span>محفوظ محلياً (معلق)</span>
                  </strong>
                ) : (
                  <strong className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {inspectOriginEntry.offlineCreated
                        ? 'مزامن (سُجّل بدون إنترنت)'
                        : 'مزامن مع السحابة ✓'}
                    </span>
                  </strong>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900/90 border border-stone-200 dark:border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">الحساب المسجِّل:</span>
                <strong className="text-zinc-900 dark:text-white">
                  {inspectOriginEntry.createdByRole === 'caisse'
                    ? 'لاكيس الصالون'
                    : inspectOriginEntry.createdByRole === 'master'
                    ? 'المشرف العام'
                    : 'حساب الحلاق'}{' '}
                  ({inspectOriginEntry.createdByName})
                </strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">الحلاق المعني:</span>
                <strong className="text-zinc-900 dark:text-white">
                  {getCaisseBarberMeta(inspectOriginEntry.barberId, roster).arName}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">يوم العمل المسجّل:</span>
                <strong dir="ltr" className="font-mono text-zinc-900 dark:text-white">
                  {inspectOriginEntry.date}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">توقيت الخادم المعتمد:</span>
                <strong dir="ltr" className="font-mono text-zinc-900 dark:text-white">
                  {formatMoroccoClockTime(
                    inspectOriginEntry.firestoreServerCreatedAt || inspectOriginEntry.createdAt
                  )}
                </strong>
              </div>
              {inspectOriginEntry.deviceClockISO && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-500">ساعة الجهاز لحظتها:</span>
                  <span dir="ltr" className="font-mono text-zinc-600 dark:text-zinc-300">
                    {inspectOriginEntry.deviceClockISO.slice(0, 19).replace('T', ' ')}
                  </span>
                </div>
              )}
              {typeof inspectOriginEntry.serverClockOffsetMs === 'number' &&
                Math.abs(inspectOriginEntry.serverClockOffsetMs) > 120000 && (
                  <div className="mt-1 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/35 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                    ساعة الجهاز كانت متقدمة/متأخرة بحوالي{' '}
                    {formatClockOffsetHumanAr(inspectOriginEntry.serverClockOffsetMs)} — تم تصحيح التاريخ
                    والساعة تلقائياً بتوقيت الخادم الموثوق.
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  ) : null;

  const showSyncBanner =
    !caisseOffline.isOnline ||
    caisseOffline.delayedPendingCount > 0 ||
    Boolean(caisseOffline.lastSyncError);

  const offlineAndClockStatusBannerNode =
    showSyncBanner || trustedTime.isDrifted ? (
      <div className="space-y-2">
        {showSyncBanner && (
          <div
            className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
              !caisseOffline.isOnline || Boolean(caisseOffline.lastSyncError)
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/45 text-amber-900 dark:text-amber-200'
                : 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-500/45 text-sky-900 dark:text-sky-200'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {!caisseOffline.isOnline ? (
                <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300" />
              ) : (
                <CloudOff className="w-4 h-4 shrink-0 mt-0.5 text-sky-700 dark:text-sky-300" />
              )}
              <div className="space-y-0.5">
                <div className="font-black">
                  {!caisseOffline.isOnline
                    ? 'العمل بدون إنترنت مفعّل — جميع عمليات لاكيس تُحفظ بأمان على الجهاز'
                    : caisseOffline.isSyncing
                    ? `جاري مزامنة ${caisseOffline.pendingCount} عمليات معلقة مع السحابة...`
                    : caisseOffline.lastSyncError
                    ? `الشبكة ضعيفة أو متقطعة — ${caisseOffline.pendingCount} عمليات محفوظة محلياً وستُرفع تلقائياً`
                    : `توجد ${caisseOffline.pendingCount} عمليات معلقة بانتظار المزامنة`}
                </div>
                {caisseOffline.pendingCount > 0 && (
                  <p className="text-[11px] opacity-90">
                    عدد العمليات المعلقة حالياً:{' '}
                    <strong className="font-mono">{caisseOffline.pendingCount}</strong> (ستتم
                    مزامنتها تلقائياً بتوقيت الخادم فور توفر الاتصال)
                  </p>
                )}
              </div>
            </div>
            {caisseOffline.pendingCount > 0 && (
              <button
                type="button"
                disabled={caisseOffline.isSyncing}
                onClick={() => void caisseOffline.flushNow()}
                className={`px-3.5 py-2 rounded-xl text-white font-black text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0 ${
                  caisseOffline.isOnline
                    ? 'bg-sky-700 hover:bg-sky-600'
                    : 'bg-amber-700 hover:bg-amber-600'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${caisseOffline.isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {caisseOffline.isSyncing
                    ? 'جاري المزامنة...'
                    : caisseOffline.isOnline
                    ? 'مزامنة الآن'
                    : 'فحص الاتصال والمزامنة'}
                </span>
              </button>
            )}
          </div>
        )}

        {trustedTime.isDrifted && (
          <div className="px-3.5 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/35 text-indigo-900 dark:text-indigo-200 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>
                <strong>حماية التوقيت التلقائية:</strong> ساعة هذا الجهاز مختلفة بحوالي{' '}
                <strong>{formatClockOffsetHumanAr(trustedTime.serverOffsetMs)}</strong> — يعتمد
                التطبيق الآن توقيت الخادم الموثوق ({businessTodayStr}) لجميع العمليات.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void trustedTime.refreshServerTime()}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-700 font-bold text-[11px] cursor-pointer"
            >
              تحديث التوقيت
            </button>
          </div>
        )}
      </div>
    ) : null;

  if ((sessionRole === 'caisse' || sessionRole === 'master') && !activeBarberId) {
    const gridBarbers = sessionRole === 'master' ? allCaisseBarbers : activeCaisseBarbers;
    const selectorDrawerSummary = liveOpenDailyDrawerSummary;
    const overdrawnMainRows = selectorDrawerSummary.byBarber.filter(
      (r) =>
        r.netDrawerContributionMAD < 0 ||
        (sessionRole === 'master' && r.barberNetShareMAD < 0)
    );
    const hasMainCaisseOverdrawn =
      selectorDrawerSummary.netTotalMAD < 0 || overdrawnMainRows.length > 0;
    return (
      <div className="space-y-4 pb-28">
        {offlineAndClockStatusBannerNode}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

          {(sessionRole === 'master' || sessionRole === 'caisse') && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setDrawerModalScope('open_daily');
                  setDrawerModalOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDrawerModalScope('open_daily');
                    setDrawerModalOpen(true);
                  }
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/45 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 text-xs font-black flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
                title={
                  sessionRole === 'caisse'
                    ? 'عرض تفاصيل المجر للدورة اليومية المفتوحة'
                    : 'عرض تفاصيل الحساب في المجر حالياً'
                }
              >
                <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
                <span>
                  {sessionRole === 'caisse'
                    ? 'المجر اليوم (الحساب المفتوح):'
                    : 'الحساب في المجر:'}
                </span>
                <span dir="ltr" className="font-mono font-black tabular-nums">
                  {formatMAD(liveOpenDailyDrawerSummary.netTotalMAD, 'drawer_total_chip')}
                </span>
                {renderBoxEyeButton('drawer_total_chip', true)}
              </div>

              {sessionRole === 'caisse' && (
                <button
                  type="button"
                  onClick={() => openFloatModal('add')}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>الصرف (حسن)</span>
                </button>
              )}

              {sessionRole === 'caisse' && (
                <button
                  type="button"
                  onClick={() => setCalculatorOpen(true)}
                  title="فتح الحاسبة السريعة"
                  aria-label="فتح الحاسبة"
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white border border-slate-700 dark:border-zinc-600 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <Calculator className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>الحاسبة</span>
                </button>
              )}

              {canToggleCaissePrivacy && (
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
              )}
            </div>
          )}
        </div>

        {/* Main Caisse Overdrawn / Exceeded Funds Alert */}
        {hasMainCaisseOverdrawn && (
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
                {overdrawnMainRows.length > 0 && (
                  <>
                    الحسابات المتأثرة:{' '}
                    <strong>{overdrawnMainRows.map((r) => r.arName).join('، ')}</strong> ·{' '}
                  </>
                )}
                صافي المجر في الدورة المفتوحة:{' '}
                <strong dir="ltr" className="font-mono inline-block">
                  {formatMAD(selectorDrawerSummary.netTotalMAD, 'drawer_total_chip')}
                </strong>
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {gridBarbers.map((b) => {
            const bTone = getBarberIdentityTokens(b.id, b.arName);
            const barberDrawerRow = selectorDrawerSummary.byBarber.find(
              (r) => r.barberId === b.id
            );
            const openCount = barberDrawerRow?.entryCount ?? 0;
            const isOverdrawn = Boolean(
              barberDrawerRow &&
                (barberDrawerRow.netDrawerContributionMAD < 0 ||
                  (sessionRole === 'master' && barberDrawerRow.barberNetShareMAD < 0))
            );
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setAutoTimerSecondsLeft(null);
                  setSelectedBarberId(b.id);
                }}
                className={`p-5 rounded-2xl border text-start transition-all shadow-sm hover:shadow-md cursor-pointer space-y-2.5 ${
                  isOverdrawn
                    ? `bg-rose-50 dark:bg-[#2B141A] border-rose-400 dark:border-rose-500/60 ${bTone.topAccentClass} ${bTone.borderLeftClass}`
                    : `${bTone.cardSurfaceClass} ${bTone.topAccentClass} ${bTone.borderLeftClass} hover:brightness-98`
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black border inline-flex items-center gap-1.5 ${bTone.badgeClass}`}>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${bTone.dotClass}`} />
                    <span>{bTone.shortLabelAr}</span>
                  </span>
                  <span className="text-[11px] font-mono font-bold text-zinc-600 dark:text-zinc-300">
                    {openCount} عملية مفتوحة
                  </span>
                </div>
                <div className="text-base font-black text-zinc-900 dark:text-white flex items-center justify-between gap-1.5">
                  <span>{b.arName}</span>
                  {isOverdrawn && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-black shrink-0">
                      تجاوز الصندوق
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{b.name}</div>
              </button>
            );
          })}
        </div>

        {drawerBreakdownModalNode}
        {hassanPinModalNode}
        {floatModalNode}
        {caisseCalculatorModalNode}
        {inspectOriginModalNode}
      </div>
    );
  }

  const isAccountOverdrawn =
    sessionRole === 'caisse'
      ? displayedDayIntakeStats.displayedDrawerCashMAD < 0
      : cycleBalance.barberNetOwedMAD < 0 ||
        displayedDayIntakeStats.displayedDrawerCashMAD < 0 ||
        cycleBalance.drawerCashMAD < 0;

  return (
    <div className="space-y-5 pb-28">
      {offlineAndClockStatusBannerNode}
      {/* Top Header + Barber Switcher (Master / Caisse) + Date Picker */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border shadow-sm space-y-4 ${activeTone.cardSurfaceClass} ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${activeTone.iconBoxClass}`}>
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
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black border inline-flex items-center gap-1.5 ${activeTone.badgeClass}`}>
                  <span className={`w-2 h-2 rounded-full ${activeTone.dotClass}`} />
                  <span>{activeBarberMeta.arName}</span>
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
                  ? `تاريخ اليوم: ${businessTodayStr} · التصفية يدوياً فقط`
                  : pickLang(lang, {
                      ar: `تاريخ اليوم: ${businessTodayStr} · النسبة: ${effectivePct}% · التصفية يدوياً فقط`,
                      fr: `Date du jour : ${businessTodayStr} · Part : ${effectivePct}% · Clôture manuelle`,
                      amz: `ⴰⵙⵙ ⴰⴷ : ${businessTodayStr} · ${effectivePct}%`,
                      en: `Today: ${businessTodayStr} · Rate: ${effectivePct}% · Manual settlement only`,
                      es: `Hoy: ${businessTodayStr} · ${effectivePct}% · Cierre manual`,
                    })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(sessionRole === 'master' || sessionRole === 'caisse') && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setDrawerModalScope('open_daily');
                  setDrawerModalOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDrawerModalScope('open_daily');
                    setDrawerModalOpen(true);
                  }
                }}
                className="min-h-[36px] px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/45 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors"
                title={
                  sessionRole === 'caisse'
                    ? 'عرض المجموع والتفريق فـ المجر للدورة اليومية المفتوحة'
                    : 'عرض المجموع والتفريق فـ الحساب في المجر حالياً'
                }
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" />
                <span>
                  {sessionRole === 'caisse'
                    ? 'المجر اليوم (المفتوح):'
                    : 'الحساب في المجر:'}
                </span>
                <span dir="ltr" className="font-mono font-black tabular-nums">
                  {formatMAD(liveOpenDailyDrawerSummary.netTotalMAD, 'drawer_total_chip')}
                </span>
                {renderBoxEyeButton('drawer_total_chip', true)}
              </div>
            )}

            {sessionRole === 'caisse' && (
              <button
                type="button"
                onClick={() => setCalculatorOpen(true)}
                title="فتح الحاسبة السريعة"
                aria-label="فتح الحاسبة"
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white border border-slate-700 dark:border-zinc-600 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <Calculator className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>الحاسبة</span>
              </button>
            )}

            {canToggleCaissePrivacy && (
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
                {amountsVisible ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : activeBarberId === 'hassan' && !hassanPinVerifiedInCaisse ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>{amountsVisible ? 'إخفاء' : 'إظهار'}</span>
              </button>
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? `${bTone.activeTabClass} shadow-xs`
                        : bTone.softButtonClass
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-current' : bTone.dotClass}`} />
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

      {/* Req #1 & #2: "تصفية الحساب اليومي (جمع حساب اليوم)" + "تصفية الحساب الشهري" Side by Side ABOVE "غانحط في المجر" & "غانهز من المجر" */}
      {sessionRole === 'master' && (
        <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-black text-zinc-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>تصفية الحساب اليومي (جمع حساب اليوم) — {activeBarberMeta.arName}</span>
                {displayedDayIntakeStats.isIntakeClosed && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                    تمت التصفية ✓
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                في المجر ({isLiveOpenDailyView ? 'المفتوح' : selectedDate}): {formatMAD(displayedDayIntakeStats.displayedDrawerCashMAD)} · حط: {formatMAD(displayedDayIntakeStats.displayedIncomeMAD)} · هز: {formatMAD(displayedDayIntakeStats.displayedExpensesMAD)} | الشهري المفتوح: {formatMAD(cycleBalance.barberNetOwedMAD)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={dailyIntakeCloseBusy}
              onClick={handleCloseDayIntake}
              className={`min-h-[42px] px-4 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer border transition-colors ${
                displayedDayIntakeStats.isIntakeClosed
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-600 text-white'
                  : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-zinc-900 dark:border-zinc-700 text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {dailyIntakeCloseBusy
                  ? 'جاري التصفية...'
                  : displayedDayIntakeStats.isIntakeClosed
                  ? 'إعادة تصفية الحساب اليومي ✓'
                  : 'تصفية الحساب اليومي'}
              </span>
            </button>

            <button
              type="button"
              disabled={dailyIntakeCloseBusy}
              onClick={handleCloseAllBarbersDayIntake}
              title="تصفية وتصفير الحساب اليومي لجميع الحلاقين معاً"
              className="min-h-[42px] px-3 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/35 dark:hover:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>تصفية اليوم للجميع</span>
            </button>

            <button
              type="button"
              onClick={() => setPayoutConfirmOpen((p) => !p)}
              className={`min-h-[42px] px-4 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer border transition-colors ${
                payoutConfirmOpen
                  ? 'bg-amber-600 hover:bg-amber-500 border-amber-600 text-white shadow-sm'
                  : 'bg-amber-500 hover:bg-amber-400 border-amber-500 text-zinc-950 shadow-xs'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                تصفية الحساب الشهري (
                <span dir="ltr" className="font-mono inline-block">
                  {formatMAD(cycleBalance.barberNetOwedMAD)}
                </span>
                )
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Master Payout Settlement Confirmation Drawer (Opens Directly Below Top Bar) */}
      {sessionRole === 'master' && payoutConfirmOpen && (
        <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-300 dark:border-amber-500/40 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black text-amber-900 dark:text-amber-200">
                تصفية الحساب الشهري / الدورة:
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setPayoutTargetMode('single')}
                  className={`px-2.5 py-1 rounded-md font-black cursor-pointer ${
                    payoutTargetMode === 'single'
                      ? 'bg-emerald-600 text-white'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  حلاق واحد ({activeBarberMeta.arName})
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutTargetMode('all_barbers')}
                  className={`px-2.5 py-1 rounded-md font-black cursor-pointer ${
                    payoutTargetMode === 'all_barbers'
                      ? 'bg-emerald-600 text-white'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  جميع الحلاقين معاً ({allBarbersPayoutPreview.barbersWithOpenEntries.length})
                </button>
              </div>
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

          {payoutTargetMode === 'all_barbers' ? (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200 dark:border-zinc-800 space-y-2">
                <div className="font-black text-zinc-900 dark:text-white flex flex-wrap items-center justify-between gap-2">
                  <span>ملخص تصفية جميع الحلاقين معاً ({allBarbersPayoutPreview.barbersWithOpenEntries.length} حساب نشط):</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    صافي المستحقات: {formatMAD(allBarbersPayoutPreview.totalBarberNetOwedMAD)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {allBarbersPayoutPreview.items.map(({ barber, preview }) => {
                    const bTone = getBarberIdentityTokens(barber.id, barber.arName);
                    const count = preview.cycleBalance.openCycleEntries.length;
                    const isIncluded =
                      count > 0 ||
                      preview.cycleBalance.carryForwardMAD !== 0 ||
                      preview.cycleBalance.barberNetOwedMAD !== 0;
                    return (
                      <div
                        key={barber.id}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                          isIncluded
                            ? `${bTone.cardSurfaceClass} ${bTone.borderLeftClass}`
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-60'
                        }`}
                      >
                        <span className="font-bold text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${bTone.dotClass}`} />
                          <span className="truncate">{barber.arName} ({count})</span>
                        </span>
                        <span
                          dir="ltr"
                          className={`font-mono font-black shrink-0 ${
                            preview.cycleBalance.barberNetOwedMAD < 0
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          {formatMAD(preview.cycleBalance.barberNetOwedMAD)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  مجموع المداخيل: <strong className="font-mono">{formatMAD(allBarbersPayoutPreview.totalIncomeMAD)}</strong> ·
                  حصة المحل: <strong className="font-mono">{formatMAD(allBarbersPayoutPreview.totalShopShareMAD)}</strong> ·
                  <span className="font-mono"> {allBarbersPayoutPreview.totalEntryCount} عملية</span>. (السجل التاريخي والإحصائيات السنوية لن تُحذف أبداً).
                </p>
              </div>
            </div>
          ) : (
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
          )}
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
              disabled={payoutBusy || (payoutTargetMode === 'all_barbers' && allBarbersPayoutPreview.barbersWithOpenEntries.length === 0)}
              onClick={handleConfirmPayout}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer disabled:opacity-60"
            >
              {payoutBusy
                ? '...'
                : payoutTargetMode === 'all_barbers'
                ? 'تأكيد تصفية جميع الحلاقين معاً ✓'
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

      {/* Quick Darija Action Buttons Directly Above Countdown Banner & Account Cards */}
      <div className={`grid gap-2.5 sm:gap-3 ${activeBarberId === 'hassan' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <button
          type="button"
          onClick={() => openQuickIncomeForm(false)}
          className={`min-h-[48px] px-3 sm:px-4 py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 border transition-all cursor-pointer shadow-xs ${
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
          className={`min-h-[48px] px-3 sm:px-4 py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 border transition-all cursor-pointer shadow-xs ${
            openForm === 'expense'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md'
              : 'bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/35 hover:bg-rose-50 dark:hover:bg-rose-950/30'
          }`}
        >
          <MinusCircle className="w-4 h-4 shrink-0" />
          <span>غانهز من المجر</span>
        </button>

        {activeBarberId === 'hassan' && (
          <button
            type="button"
            onClick={() => openFloatModal('add')}
            className={`min-h-[48px] px-3 sm:px-4 py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 border transition-all cursor-pointer shadow-xs ${
              openForm === 'float'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                : 'bg-white dark:bg-zinc-900 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/35 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span>الصرف</span>
          </button>
        )}
      </div>

      {/* 1-Minute Post-Entry Auto-Return / Barber Auto-Exit Countdown Banner (Positioned below action buttons, above cards) */}
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

      {/* Overdrawn / Negative Drawer or Balance Alert (All Barber Accounts, Hassan, & Caisse) */}
      {isAccountOverdrawn && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/50 text-rose-800 dark:text-rose-200 text-xs flex flex-wrap items-center justify-between gap-2.5 shadow-2xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-black">
                تنبيه: السحوبات والمصاريف تجاوزت المستحقات المتاحة في الصندوق
              </div>
              <p className="text-[11px] leading-relaxed">
                {sessionRole === 'caisse' ? (
                  <>
                    صافي الحساب اليومي المفتوح:{' '}
                    <strong dir="ltr" className="font-mono inline-block">
                      {formatMAD(displayedDayIntakeStats.displayedDrawerCashMAD, 'kpi_net')}
                    </strong>
                  </>
                ) : (
                  <>
                    الرصيد الحالي:{' '}
                    <strong dir="ltr" className="font-mono inline-block">
                      {formatMAD(
                        cycleBalance.barberNetOwedMAD < 0
                          ? cycleBalance.barberNetOwedMAD
                          : cycleBalance.drawerCashMAD < 0
                          ? cycleBalance.drawerCashMAD
                          : displayedDayIntakeStats.displayedDrawerCashMAD,
                        'kpi_net'
                      )}
                    </strong>
                  </>
                )}
                . سيبقى هذا الفارق السالب مسجلاً حتى تغطيته أو تصفيته من الإدارة.
              </p>
            </div>
          </div>

          {sessionRole === 'master' && cycleBalance.barberNetOwedMAD < 0 && (
            <button
              type="button"
              onClick={() => openBalanceAdjustModal('zero_negative')}
              className="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-black text-[11px] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تصفية / تعديل الرصيد السالب (معزول)</span>
            </button>
          )}
        </div>
      )}

      {/* Req #3 (Swapped Up): Monthly/Cumulative Balance & Recent Days Summary Block */}
      {sessionRole !== 'caisse' && activeBarberId && (
        <div className={`p-4 rounded-2xl border space-y-3 text-xs shadow-xs ${activeTone.cardSurfaceClass} ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-black text-zinc-900 dark:text-white flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>
                {isViewingOwnAccount
                  ? 'الحساب الشهري وملخص الأيام الأخيرة'
                  : `الحساب الشهري وملخص الأيام الأخيرة (${activeBarberMeta.arName})`}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${activeTone.badgeClass}`}>
                {activeBarberMeta.arName}
              </span>
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-lg border font-mono font-black text-[11px] tabular-nums ${
                  cycleBalance.barberNetOwedMAD === 0 &&
                  cycleBalance.openCycleEntries.length === 0 &&
                  cycleBalance.carryForwardMAD === 0
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                    : cycleBalance.barberNetOwedMAD < 0
                    ? 'bg-rose-50 dark:bg-rose-950/35 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300'
                    : 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/35 text-amber-900 dark:text-amber-200'
                }`}
              >
                {cycleBalance.barberNetOwedMAD === 0 &&
                cycleBalance.openCycleEntries.length === 0 &&
                cycleBalance.carryForwardMAD === 0
                  ? `الرصيد المفتوح: ${formatMAD(0, 'kpi_net')} (تمت التصفية ✓)`
                  : isViewingOwnAccount
                  ? `رصيدي المفتوح المستحق: ${formatMAD(cycleBalance.barberNetOwedMAD, 'kpi_net')}`
                  : `المستحق المفتوح لـ ${activeBarberMeta.arName}: ${formatMAD(cycleBalance.barberNetOwedMAD, 'kpi_net')}`}
              </span>
              {cycleBalance.lastSettledDate && (
                <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                  آخر تصفية شهرية: {cycleBalance.lastSettledDate}
                </span>
              )}
              {sessionRole === 'master' && (
                <button
                  type="button"
                  onClick={() => openBalanceAdjustModal()}
                  className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-500 hover:text-white border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  title="تعديل أو مسح الرصيد السالب لهذا الحلاق فقط دون المساس بباقي الحسابات"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>تعديل الرصيد (معزول)</span>
                </button>
              )}
            </div>
          </div>

          {(cycleBalance.carryForwardMAD !== 0 || cycleBalance.barberAdjustmentMAD !== 0) && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {cycleBalance.carryForwardMAD !== 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 font-mono font-bold">
                  رصيد مرحل من الشهر السابق: {formatMAD(cycleBalance.carryForwardMAD, 'kpi_net')}
                </span>
              )}
              {cycleBalance.barberAdjustmentMAD !== 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/35 border border-indigo-200 dark:border-indigo-500/40 text-indigo-800 dark:text-indigo-200 font-mono font-bold">
                  تسوية رصيد معزولة: {formatMAD(cycleBalance.barberAdjustmentMAD, 'kpi_net')}
                </span>
              )}
            </div>
          )}

          {/* Open Monthly/Cycle Breakdown Strip (Remains intact across daily closes; resets only on "تصفية الحساب الشهري") */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">مداخيل الدورة المفتوحة</span>
              <span dir="ltr" className="font-mono font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatMAD(cycleBalance.incomeMAD, 'kpi_net')}
              </span>
            </div>
            <div className="px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">سحوبات الدورة المفتوحة</span>
              <span dir="ltr" className="font-mono font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {formatMAD(cycleBalance.expensesMAD, 'kpi_net')}
              </span>
            </div>
            <div className="px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                حصة الحلاق ({cycleBalance.commissionPercent}%)
              </span>
              <span dir="ltr" className="font-mono font-black text-amber-700 dark:text-amber-300 tabular-nums">
                {formatMAD(cycleBalance.barberGrossShareMAD, 'kpi_net')}
              </span>
            </div>
            <div className="px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                {sessionRole === 'master' ? 'حصة المحل بالدورة' : 'صافي الرصيد التراكمي'}
              </span>
              <span dir="ltr" className="font-mono font-black text-zinc-900 dark:text-white tabular-nums">
                {formatMAD(
                  sessionRole === 'master' ? cycleBalance.shopShareMAD : cycleBalance.barberNetOwedMAD,
                  'kpi_net'
                )}
              </span>
            </div>
          </div>

          {dailyInOutHistory.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                <span className="font-bold">سجل الأيام (اضغط على أي يوم لعرض تفاصيل حط وهز)</span>
                {sessionRole === 'master' && (
                  <span className="font-bold text-amber-700 dark:text-amber-300">
                    صلاحية المشرف: تعديل / إضافة / حذف حتى في الأيام المغلقة
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {dailyInOutHistory.slice(0, 12).map((row) => (
                  <button
                    key={row.date}
                    type="button"
                    onClick={() => openDayDetailModal(activeBarberId, row.date)}
                    className={`p-2.5 rounded-xl border text-start transition-all cursor-pointer space-y-1 hover:shadow-sm ${
                      dayDetailTarget?.date === row.date && dayDetailTarget?.barberId === activeBarberId
                        ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-400 dark:border-amber-400'
                        : row.date === selectedDate
                        ? 'bg-amber-50/80 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40'
                        : 'bg-zinc-50 dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-[11px] text-zinc-900 dark:text-white">
                        {row.date.slice(5)}
                      </span>
                      {row.isIntakeClosed ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black">
                          مغلق
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-black">
                          مفتوح
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">
                      حط: {formatMAD(row.incomeMAD, 'kpi_income')}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-rose-600 dark:text-rose-400 font-bold">
                      هز: {formatMAD(row.expensesMAD, 'kpi_expenses')}
                    </div>
                    <div className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center justify-between pt-0.5">
                      <span>{row.entryCount} عملية</span>
                      <span className="text-amber-700 dark:text-amber-300">تفاصيل ←</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Darija KPI Cards + Quick '+' Actions Inside Each Card */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* 1. شحال حط (الدورة اليومية المفتوحة / التاريخ المحدد) */}
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
          className={`p-4 rounded-2xl border hover:border-emerald-500 hover:shadow-md active:scale-[0.99] transition-all text-start shadow-xs space-y-1 cursor-pointer group ${activeTone.cardSurfaceClass} ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block">
              {isLiveOpenDailyView
                ? isViewingOwnAccount
                  ? 'شحال حطيت (الدورة اليومية)'
                  : `شحال حط ${activeBarberMeta.arName} (الدورة اليومية)`
                : isViewingOwnAccount
                ? `شحال حطيت (${selectedDate})`
                : `شحال حط ${activeBarberMeta.arName} (${selectedDate})`}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {displayedDayIntakeStats.isIntakeClosed && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black">
                  مصفّى ✓
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openQuickIncomeForm(false);
                }}
                title="إضافة سريعة (غانحط في المجر)"
                aria-label="إضافة سريعة في المجر"
                className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {renderBoxEyeButton('kpi_income', true)}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {maskNum(displayedDayIntakeStats.displayedIncomeMAD, 'kpi_income')}{' '}
            <span className="text-xs font-bold">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-600 dark:text-zinc-400 block font-mono tabular-nums">
            {displayedDayIntakeStats.hasAnyDailyClose
              ? `بعد آخر تصفية (${displayedDayIntakeStats.lastDailyCloseDate}) · ${displayedDayIntakeStats.postCloseEntryCount} عملية مفتوحة`
              : `${displayedDayIntakeStats.postCloseEntryCount} عملية مفتوحة · اضغط للتفاصيل`}
          </span>
        </div>

        {/* 2. شحال هز (الدورة اليومية المفتوحة -> يتصفر إلى 0 بعد التصفية اليومية، مع بقاء التراكمي الشهري محفوظاً) */}
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
          className={`p-4 rounded-2xl border hover:border-rose-500 hover:shadow-md active:scale-[0.99] transition-all text-start shadow-xs space-y-1 cursor-pointer group ${activeTone.cardSurfaceClass} ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block">
              {isLiveOpenDailyView
                ? sessionRole === 'caisse'
                  ? `شحال هز ${activeBarberMeta.arName} (الدورة اليومية)`
                  : isViewingOwnAccount
                  ? 'شحال هزيت (الدورة اليومية)'
                  : `شحال هز ${activeBarberMeta.arName} (الدورة اليومية)`
                : sessionRole === 'caisse'
                ? `شحال هز ${activeBarberMeta.arName} (${selectedDate})`
                : isViewingOwnAccount
                ? `شحال هزيت (${selectedDate})`
                : `شحال هز ${activeBarberMeta.arName} (${selectedDate})`}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {displayedDayIntakeStats.isIntakeClosed && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black">
                  مصفّى ✓
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDuplicateWarning(null);
                  setOpenForm('expense');
                }}
                title="تسجيل سحب / مصروف سريع"
                aria-label="تسجيل سحب سريع"
                className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {renderBoxEyeButton('kpi_expenses', true)}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-rose-700 dark:text-rose-400">
            {maskNum(displayedDayIntakeStats.displayedExpensesMAD, 'kpi_expenses')}{' '}
            <span className="text-xs font-bold">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-mono tabular-nums">
            {sessionRole === 'caisse'
              ? 'سحوبات الدورة اليومية المفتوحة · اضغط للتفاصيل'
              : displayedDayIntakeStats.hasAnyDailyClose
              ? `تمت التصفية (${displayedDayIntakeStats.lastDailyCloseDate}) · الشهري: ${formatMAD(cycleBalance.expensesMAD, 'kpi_expenses')}`
              : `التراكمي الشهري المفتوح: ${formatMAD(cycleBalance.expensesMAD, 'kpi_expenses')}`}
          </span>
        </div>

        {/* 3. في لاكيس الصالون: "المجر كامل" لحسن فقط ((المداخيل + الصرف) - مصاريف حسن فقط)، و"شحال بقى ليه في الحساب كامل" لباقي الحلاقين | للمشرف والحلاق: الصافي التراكمي */}
        {sessionRole === 'caisse' ? (
          activeBarberId === 'hassan' || activeBarberMeta.isOwner ? (
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
              className={`p-4 rounded-2xl border shadow-xs hover:shadow-md hover:border-emerald-500 active:scale-[0.99] transition-all text-start space-y-1 cursor-pointer group ${
                displayedDayIntakeStats.displayedDrawerCashMAD < 0
                  ? `bg-rose-50 dark:bg-[#2B141A] border-rose-400 dark:border-rose-500/60 ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`
                  : `${activeTone.softSurfaceClass} ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                  {`المجر كامل (${activeBarberMeta.arName})`}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {renderBoxEyeButton('kpi_net', true)}
                </span>
              </div>
              <div
                dir="ltr"
                className={`inline-flex items-baseline gap-1 text-xl sm:text-2xl font-black font-mono tabular-nums ${
                  displayedDayIntakeStats.displayedDrawerCashMAD < 0
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-emerald-800 dark:text-emerald-300'
                }`}
              >
                <span>{maskNum(displayedDayIntakeStats.displayedDrawerCashMAD, 'kpi_net')}</span>
                <span
                  className={`text-xs font-bold ${
                    displayedDayIntakeStats.displayedDrawerCashMAD < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  MAD
                </span>
              </div>
              <span
                className={`text-[10px] block font-mono tabular-nums ${
                  displayedDayIntakeStats.displayedDrawerCashMAD < 0
                    ? 'text-rose-700 dark:text-rose-300 font-bold'
                    : 'text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {displayedDayIntakeStats.displayedDrawerCashMAD < 0
                  ? 'رصيد المجر سالب — اضغط للتفاصيل'
                  : `المداخيل (${formatMAD(displayedDayIntakeStats.displayedIncomeMAD, 'kpi_net')}) + الصرف (${formatMAD(displayedDayIntakeStats.displayedFloatMAD, 'kpi_net')}) − مصاريف حسن (${formatMAD(displayedDayIntakeStats.displayedExpensesMAD, 'kpi_net')})`}
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
              className={`p-4 rounded-2xl border shadow-xs hover:shadow-md hover:border-amber-500 active:scale-[0.99] transition-all text-start space-y-1 cursor-pointer group ${
                cycleBalance.barberNetOwedMAD < 0
                  ? `bg-rose-50 dark:bg-[#2B141A] border-rose-400 dark:border-rose-500/60 ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`
                  : `${activeTone.softSurfaceClass} ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                  {`شحال بقى ليه في الحساب كامل (${activeBarberMeta.arName})`}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {renderBoxEyeButton('kpi_net', true)}
                </span>
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
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  MAD
                </span>
              </div>
              <span
                className={`text-[10px] block font-mono tabular-nums ${
                  cycleBalance.barberNetOwedMAD < 0
                    ? 'text-rose-700 dark:text-rose-300 font-bold'
                    : 'text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {cycleBalance.barberNetOwedMAD < 0
                  ? 'رصيد سالب — اضغط لتفاصيل الحساب الكامل'
                  : `حصة ${cycleBalance.commissionPercent}% (${formatMAD(cycleBalance.barberGrossShareMAD, 'kpi_net')}) − سحوبات (${formatMAD(cycleBalance.expensesMAD, 'kpi_net')})${
                      cycleBalance.carryForwardMAD !== 0
                        ? ` · مرحل: ${formatMAD(cycleBalance.carryForwardMAD, 'kpi_net')}`
                        : ''
                    } · اضغط للتفاصيل`}
              </span>
            </div>
          )
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
            className={`p-4 rounded-2xl border shadow-xs hover:shadow-md hover:border-amber-500 active:scale-[0.99] transition-all text-start space-y-1 cursor-pointer group ${
              cycleBalance.barberNetOwedMAD < 0
                ? `bg-rose-50 dark:bg-[#2B141A] border-rose-400 dark:border-rose-500/60 ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`
                : `${activeTone.softSurfaceClass} ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block">
                {isViewingOwnAccount
                  ? 'شحال بقى ليا (الصافي التراكمي)'
                  : `شحال كيتسال ${activeBarberMeta.arName} (الصافي التراكمي)`}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openQuickIncomeForm(false);
                  }}
                  title="إضافة سريعة (غانحط في المجر)"
                  aria-label="إضافة سريعة"
                  className="w-6 h-6 rounded-lg bg-white/80 dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-600 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {renderBoxEyeButton('kpi_net', true)}
              </span>
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
              className={`text-[10px] block font-mono tabular-nums ${
                cycleBalance.barberNetOwedMAD < 0
                  ? 'text-rose-700 dark:text-rose-300 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {cycleBalance.barberNetOwedMAD < 0
                ? 'رصيد سالب — السحوبات تجاوزت المستحقات · اضغط للتفاصيل'
                : `في المجر حالياً: ${formatMAD(displayedDayIntakeStats.displayedDrawerCashMAD, 'kpi_net')}${
                    activeBarberId === 'hassan' && cycleBalance.floatMAD !== 0
                      ? ` · يتضمن الصرف الشخصي: ${formatMAD(cycleBalance.floatMAD, 'kpi_net')} (غير محسوب في المداخيل)`
                      : ''
                  }${cycleBalance.lastSettledDate ? ` · من بعد ${cycleBalance.lastSettledDate}` : ''}`}
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
          className={`p-4 rounded-2xl border hover:border-orange-500 hover:shadow-md active:scale-[0.99] transition-all text-start shadow-xs space-y-1 cursor-pointer group ${activeTone.cardSurfaceClass} ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block">
              مجموع الكريدي (كل التواريخ)
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openQuickIncomeForm(true);
                }}
                title="تسجيل كريدي جديد سريع"
                aria-label="تسجيل كريدي جديد"
                className="w-6 h-6 rounded-lg bg-orange-50 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/35 text-orange-700 dark:text-orange-300 hover:bg-orange-600 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {renderBoxEyeButton('kpi_credits', true)}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-orange-700 dark:text-orange-400">
            {maskNum(cycleBalance.openCreditsAllTimeMAD, 'kpi_credits')}{' '}
            <span className="text-xs font-bold">MAD</span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-mono tabular-nums">
            {combinedOpenCreditsCount} كريدي مفتوح · اضغط للتفاصيل
          </span>
        </div>
      </div>

      {/* Dedicated "الصرف (فلوس الفكة في المجر)" Tracking Section — Exclusively for Hassan Ait Boumlik (Daily resets cleanly to 0 on daily close) */}
      {activeBarberId === 'hassan' && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div
            role="button"
            tabIndex={0}
            onClick={() => openDrillModal('float_day')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDrillModal('float_day');
              }
            }}
            className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-amber-950 dark:text-amber-200">
                  {`الصرف — حساب حسن الشخصي (${isLiveOpenDailyView ? 'الدورة اليومية المفتوحة' : selectedDate})`}
                </span>
                <span dir="ltr" className="font-mono font-black text-sm text-amber-800 dark:text-amber-300 tabular-nums">
                  {formatMAD(displayedDayIntakeStats.displayedFloatMAD, 'float_cycle_card')}
                </span>
                {renderBoxEyeButton('float_cycle_card', true)}
              </div>
              <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center gap-2">
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  مضاف +{formatMAD(displayedDayIntakeStats.displayedFloatInMAD, 'float_cycle_card')}
                </span>
                <span>·</span>
                <span className="text-rose-700 dark:text-rose-400 font-bold">
                  مرجوع −{formatMAD(displayedDayIntakeStats.displayedFloatOutMAD, 'float_cycle_card')}
                </span>
                {sessionRole !== 'caisse' && (
                  <>
                    <span>·</span>
                    <span className="text-amber-700 dark:text-amber-300 font-bold">
                      التراكمي الشهري: {formatMAD(cycleBalance.floatMAD, 'float_cycle_card')}
                    </span>
                  </>
                )}
                <span>·</span>
                <span className="font-sans text-zinc-500 dark:text-zinc-400">
                  خاص برصيد حسن · غير محسوب في المداخيل
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openFloatModal('add')}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة صرف</span>
            </button>
            <button
              type="button"
              onClick={() => openFloatModal('return')}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/40 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <MinusCircle className="w-3.5 h-3.5" />
              <span>إرجاع صرف</span>
            </button>
          </div>
        </div>
      )}

      {/* Master-Only Daily (resets to 0 after daily close) + Cumulative Open Cycle Strip */}
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
                  {isLiveOpenDailyView
                    ? isViewingOwnAccount
                      ? 'اللي دخلت (المفتوح)'
                      : `اللي دخل ${activeBarberMeta.arName} (المفتوح)`
                    : isViewingOwnAccount
                    ? `اللي دخلت (${selectedDate})`
                    : `اللي دخل ${activeBarberMeta.arName} (${selectedDate})`}
                </span>
                {renderBoxEyeButton('sum_income_day', true)}
              </div>
              <span className="font-mono font-black text-base text-zinc-900 dark:text-white tabular-nums">
                {formatMAD(displayedDayIntakeStats.displayedIncomeMAD, 'sum_income_day')}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setDrawerModalScope(isLiveOpenDailyView ? 'open_daily' : 'day');
                setDrawerModalOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDrawerModalScope(isLiveOpenDailyView ? 'open_daily' : 'day');
                  setDrawerModalOpen(true);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/35 hover:border-emerald-400 text-start transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-emerald-800 dark:text-emerald-300 block text-[11px] font-bold">
                  الحساب في المجر ({isLiveOpenDailyView ? 'المفتوح' : selectedDate})
                </span>
                {renderBoxEyeButton('kpi_net', true)}
              </div>
              <span className="font-mono font-black text-base text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatMAD(displayedDayIntakeStats.displayedDrawerCashMAD, 'kpi_net')}
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
                  حصة المحل ({isLiveOpenDailyView ? 'المفتوح' : selectedDate})
                </span>
                {renderBoxEyeButton('sum_shop_day', true)}
              </div>
              <span className="font-mono font-black text-base text-zinc-900 dark:text-white tabular-nums">
                {formatMAD(displayedDayIntakeStats.displayedShopShareMAD, 'sum_shop_day')}
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
        </div>
      )}

      {/* Req #3 (Swapped Down): Daily Per-Barber Master Note & Barber Reply Card */}
      {sessionRole !== 'caisse' && activeBarberId && (
        <div className={`p-4 rounded-2xl border shadow-xs space-y-3 text-xs ${activeTone.cardSurfaceClass} ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-black text-zinc-900 dark:text-white flex items-center gap-2 flex-wrap">
              <MessageSquare className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>
                {sessionRole === 'master'
                  ? `ملاحظة يومية للحلاق (${activeBarberMeta.arName} · ${selectedDate})`
                  : `ملاحظة الإدارة اليومية (${selectedDate})`}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${activeTone.badgeClass}`}>
                {activeBarberMeta.arName}
              </span>
            </div>
            {currentDailyNote?.masterUpdatedAt && (
              <span className="text-[10px] font-mono text-zinc-400">
                آخر تحديث: {safeFormatTime(currentDailyNote.masterUpdatedAt, [], { hour: '2-digit', minute: '2-digit' }, '')}
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

      {/* Centered Modal 1: غانحط في المجر (Prices strictly hidden on services; quick suggestion chips on amount input) */}
      {openForm === 'income' && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 sb-modal-backdrop"
            onClick={() => {
              setOpenForm('none');
              setDuplicateWarning(null);
            }}
          >
            <form
              onSubmit={(e) => handleSubmitIncome(e, false)}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#141720] border-2 border-emerald-400 dark:border-emerald-500/50 shadow-2xl space-y-4 text-xs ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`}
            >
            <div className={`-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 px-5 sm:px-6 py-3.5 rounded-t-2xl flex items-center justify-between gap-2 ${activeTone.headerBandClass}`}>
              <span className="font-black text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2 flex-wrap">
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>غانحط في المجر</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black border inline-flex items-center gap-1.5 ${activeTone.badgeClass}`}>
                  <span className={`w-2 h-2 rounded-full ${activeTone.dotClass}`} />
                  <span>{activeBarberMeta.arName}</span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpenForm('none');
                  setDuplicateWarning(null);
                }}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
              <CaisseAmountField
                label="شحال حط في المجر (MAD) *"
                value={amountPaidInput}
                onChange={(next) => {
                  setAmountPaidInput(next);
                  setDuplicateWarning(null);
                }}
                quickAmounts={CAISSE_QUICK_AMOUNTS}
                accent="emerald"
                placeholder="0"
                autoFocus
              />

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

                  {(() => {
                    const crossSummary = computeOutstandingCreditsForPhone(
                      creditClientPhone,
                      entries,
                      manualCredits,
                      roster
                    );
                    if (!crossSummary.hasCredit) return null;
                    return (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-500/40 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                        <div className="font-black flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            معلومة فقط: هاد الرقم ديجا عليه كريدي مفتوح ({crossSummary.totalOwedMAD} MAD):
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {crossSummary.creditorBreakdowns.map((b) => (
                            <span
                              key={b.creditorKey}
                              className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-500/35 font-bold"
                            >
                              {b.creditorLabel}: {b.amountMAD} MAD
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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
        </ModalPortal>
      )}

      {/* Centered Modal 2: غانهز من المجر (Expense / Withdrawal) */}
      {openForm === 'expense' && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 sb-modal-backdrop"
            onClick={() => {
              setOpenForm('none');
              setDuplicateWarning(null);
            }}
          >
            <form
              onSubmit={(e) => handleSubmitExpense(e, false)}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#141720] border-2 border-rose-400 dark:border-rose-500/50 shadow-2xl space-y-4 text-xs ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`}
            >
            <div className={`-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 px-5 sm:px-6 py-3.5 rounded-t-2xl flex items-center justify-between gap-2 ${activeTone.headerBandClass}`}>
              <span className="font-black text-sm text-rose-800 dark:text-rose-200 flex items-center gap-2 flex-wrap">
                <MinusCircle className="w-4 h-4 shrink-0" />
                <span>غانهز من المجر</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black border inline-flex items-center gap-1.5 ${activeTone.badgeClass}`}>
                  <span className={`w-2 h-2 rounded-full ${activeTone.dotClass}`} />
                  <span>{activeBarberMeta.arName}</span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpenForm('none');
                  setDuplicateWarning(null);
                }}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
                        return safeCompareDesc(`${a.date} ${a.timeSlot}`, `${b.date} ${b.timeSlot}`);
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

              <CaisseAmountField
                label="شحال هزيت (MAD) *"
                value={expenseAmount}
                onChange={(next) => {
                  setExpenseAmount(next);
                  setDuplicateWarning(null);
                }}
                quickAmounts={CAISSE_QUICK_AMOUNTS}
                accent="rose"
                placeholder="0"
                required
                autoFocus
              />
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
        </ModalPortal>
      )}

      {floatModalNode}

      {/* Open Credits Section (Persists Across ALL Dates Until Repaid; Combines Caisse + Manual Client Credits) */}
      {(openCreditsList.length > 0 ||
        openManualCreditsForBarber.length > 0 ||
        openBarberDisputes.length > 0) && (
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-orange-200 dark:border-orange-500/35 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-black text-orange-800 dark:text-orange-300 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-orange-500" />
              <span>الكريدي المفتوح (مستمر عبر كل الأيام حتى الأداء)</span>
            </h4>
            <span className="text-xs font-mono font-black text-orange-700 dark:text-orange-300 tabular-nums">
              {formatMAD(cycleBalance.openCreditsAllTimeMAD, 'kpi_credits')}
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
                        ({formatMAD(disp.totalOwedSnapshotMAD, 'kpi_credits')})
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
              const effRem = getEffectiveCaisseCreditRemaining(ce);
              const isRepaying = repayingEntryId === ce.id;
              const isReqOpen = settleReqEntryId === ce.id;
              const entryReqs = creditSettlementRequests.filter(
                (r) => r.sourceType === 'caisse' && r.sourceId === ce.id
              );
              const latestReq = entryReqs[0];
              const canEditCredit =
                sessionRole === 'master' ||
                (sessionRole === 'barber' &&
                  matchesCaisseBarber(ce.barberId, ce.barberName, activeBarberId, roster));
              const waUrl = buildCreditWhatsAppReminderUrl({
                clientPhone: ce.clientPhone,
                clientName: ce.clientName,
                amountOwedMAD: effRem,
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
                      {latestReq && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-black border ${
                            latestReq.status === 'pending'
                              ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
                              : latestReq.status === 'confirmed'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {latestReq.status === 'pending'
                            ? `طلب (${latestReq.actionType === 'pay' ? 'خلاص' : 'فك'}: ${latestReq.requestedAmountMAD} MAD) بانتظار المشرف`
                            : latestReq.status === 'confirmed'
                            ? `مؤكد من المشرف: ${latestReq.approvedAmountMAD ?? latestReq.requestedAmountMAD} MAD ✓`
                            : 'تم النفي من المشرف ✕'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-orange-700 dark:text-orange-300 tabular-nums me-1">
                        الباقي: {formatMAD(effRem, 'kpi_credits')}
                      </span>
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-xs transition-colors"
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
                          setSettleReqEntryId(null);
                          if (isRepaying) {
                            setRepayingEntryId(null);
                          } else {
                            setRepayingEntryId(ce.id);
                            setRepayAmountInput(String(effRem));
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                      >
                        خلص الكريدي
                      </button>
                      {sessionRole !== 'master' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRepayingEntryId(null);
                            if (isReqOpen) {
                              setSettleReqEntryId(null);
                            } else {
                              setSettleReqEntryId(ce.id);
                              setSettleReqAction('clear');
                              setSettleReqAmountInput(String(effRem));
                              setSettleReqNoteInput('');
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 font-bold text-[11px] cursor-pointer hover:bg-amber-100"
                        >
                          يخلص ولا يفك من الكريدي
                        </button>
                      )}
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
                        max={effRem}
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

                  {isReqOpen && (
                    <div className="pt-2 border-t border-orange-200/60 dark:border-zinc-800 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSettleReqAction('pay')}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-black cursor-pointer ${
                            settleReqAction === 'pay'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          يخلص الكريدي (طلب تأكيد الأداء)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettleReqAction('clear')}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-black cursor-pointer ${
                            settleReqAction === 'clear'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          يفك من الكريدي (إسقاط / تسوية للمشرف)
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={effRem}
                          value={settleReqAmountInput}
                          onChange={(e) => setSettleReqAmountInput(e.target.value)}
                          className="w-28 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-zinc-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={settleReqNoteInput}
                          onChange={(e) => setSettleReqNoteInput(e.target.value)}
                          placeholder="ملاحظة للمشرف حسن (اختيارية)..."
                          className="flex-1 min-w-[160px] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={settleReqBusy}
                          onClick={() => void handleSubmitCaisseCreditSettlementRequest(ce)}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer disabled:opacity-60"
                        >
                          {settleReqBusy ? '...' : 'إرسال للمشرف حسن ✓'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {openManualCreditsForBarber.map((rec) => {
              const effRem = getEffectiveManualCreditRemaining(rec);
              const allPhones = [rec.clientPhone, ...(rec.additionalPhones || [])]
                .map((p) => String(p || '').trim())
                .filter(Boolean);
              const dateLabel = asDateString(rec.creditDate, '') || asIsoString(rec.createdAt, '').slice(0, 10);
              const isManualRepaying = repayingManualId === rec.id;
              const isManualReqOpen = settleReqManualId === rec.id;
              const manualReqs = creditSettlementRequests.filter(
                (r) => r.sourceType === 'manual' && r.sourceId === rec.id
              );
              const latestManualReq = manualReqs[0];
              const waUrl = buildCreditWhatsAppReminderUrl({
                clientPhone: allPhones[0] || '',
                clientName: rec.clientName,
                amountOwedMAD: effRem,
                creditorName: rec.barberName || activeBarberMeta.arName,
                creditDate: dateLabel,
                note: rec.note,
                lang,
              });
              return (
                <div
                  key={`manual_${rec.id}`}
                  className="p-3 rounded-xl bg-amber-50/60 dark:bg-zinc-950/80 border border-amber-200/90 dark:border-zinc-800 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-zinc-900 dark:text-white">
                        {rec.clientName || 'زبون'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">
                        سجل الكريدي
                      </span>
                      {allPhones.map((ph, idx) => (
                        <span
                          key={`${ph}-${idx}`}
                          dir="ltr"
                          className="font-mono text-zinc-500 dark:text-zinc-400"
                        >
                          {ph}
                        </span>
                      ))}
                      <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        · {dateLabel}
                      </span>
                      {latestManualReq && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-black border ${
                            latestManualReq.status === 'pending'
                              ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
                              : latestManualReq.status === 'confirmed'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {latestManualReq.status === 'pending'
                            ? `طلب (${latestManualReq.actionType === 'pay' ? 'خلاص' : 'فك'}: ${latestManualReq.requestedAmountMAD} MAD) بانتظار المشرف`
                            : latestManualReq.status === 'confirmed'
                            ? `مؤكد من المشرف: ${latestManualReq.approvedAmountMAD ?? latestManualReq.requestedAmountMAD} MAD ✓`
                            : 'تم النفي من المشرف ✕'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-orange-700 dark:text-orange-300 tabular-nums me-1">
                        الباقي: {formatMAD(effRem, 'kpi_credits')}
                      </span>
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-xs transition-colors"
                          title="إرسال تذكير مباشر عبر واتساب"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساب</span>
                        </a>
                      )}
                      {sessionRole === 'master' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (isManualRepaying) {
                              setRepayingManualId(null);
                            } else {
                              setRepayingManualId(rec.id);
                              setRepayManualAmountInput(String(effRem));
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                        >
                          خلص الكريدي
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (isManualReqOpen) {
                              setSettleReqManualId(null);
                            } else {
                              setSettleReqManualId(rec.id);
                              setSettleReqManualAction('pay');
                              setSettleReqManualAmountInput(String(effRem));
                              setSettleReqManualNoteInput('');
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 font-bold text-[11px] cursor-pointer hover:bg-amber-100"
                        >
                          يخلص ولا يفك من الكريدي
                        </button>
                      )}
                    </div>
                  </div>

                  {rec.note && (
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      ملاحظة: {rec.note}
                    </div>
                  )}

                  {isManualRepaying && sessionRole === 'master' && (
                    <div className="pt-2 border-t border-amber-200/60 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={effRem}
                        value={repayManualAmountInput}
                        onChange={(e) => setRepayManualAmountInput(e.target.value)}
                        className="w-28 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-zinc-900 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={repayManualBusy}
                        onClick={() => void handleConfirmManualCreditRepay(rec)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer"
                      >
                        {repayManualBusy ? '...' : 'تأكيد الأداء ✓'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRepayingManualId(null)}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}

                  {isManualReqOpen && sessionRole !== 'master' && (
                    <div className="pt-2 border-t border-amber-200/60 dark:border-zinc-800 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSettleReqManualAction('pay')}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-black cursor-pointer ${
                            settleReqManualAction === 'pay'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          يخلص الكريدي (طلب تأكيد الأداء)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettleReqManualAction('clear')}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-black cursor-pointer ${
                            settleReqManualAction === 'clear'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          يفك من الكريدي (إسقاط / تسوية للمشرف)
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={effRem}
                          value={settleReqManualAmountInput}
                          onChange={(e) => setSettleReqManualAmountInput(e.target.value)}
                          className="w-28 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-zinc-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={settleReqManualNoteInput}
                          onChange={(e) => setSettleReqManualNoteInput(e.target.value)}
                          placeholder="ملاحظة للمشرف حسن (اختيارية)..."
                          className="flex-1 min-w-[160px] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={settleReqManualBusy}
                          onClick={() => void handleSubmitManualCreditSettlementRequest(rec)}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer disabled:opacity-60"
                        >
                          {settleReqManualBusy ? '...' : 'إرسال للمشرف حسن ✓'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Single-Line Expandable Transaction Log */}
      <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${activeTone.cardSurfaceClass} ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 dark:border-zinc-800 pb-2.5">
          <div>
            <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2 flex-wrap">
              <History className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>سجل العمليات</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${activeTone.badgeClass}`}>
                {activeBarberMeta.arName}
              </span>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                ({visibleEntries.length})
              </span>
            </h4>
            {sessionRole === 'barber' && (
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                الأرشيف الشخصي يعرض آخر شهرين فقط (من {twoMonthsCutoffDate}) — الكريدي المفتوح يبقى ظاهراً دائماً حتى الأداء.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl text-[11px] font-bold">
            {(
              (sessionRole === 'caisse'
                ? [
                    { id: 'open_daily', label: `الدورة اليومية (${activeBarberOpenDailyStats.entryCount})` },
                    { id: 'day', label: selectedDate === businessTodayStr ? `تاريخ اليوم (${selectedDate})` : selectedDate },
                    { id: 'all', label: 'الأحدث' },
                  ]
                : [
                    { id: 'open_daily', label: `الدورة اليومية (${activeBarberOpenDailyStats.entryCount})` },
                    { id: 'day', label: selectedDate === businessTodayStr ? `تاريخ اليوم (${selectedDate})` : selectedDate },
                    { id: 'cycle', label: 'الشهرية المفتوحة' },
                    { id: 'all', label: 'الأحدث' },
                  ]) as ReadonlyArray<{ id: 'open_daily' | 'day' | 'cycle' | 'all'; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTxScopeFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  (sessionRole === 'caisse' && txScopeFilter === 'cycle' ? 'open_daily' : txScopeFilter) ===
                  tab.id
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
              const badge = formatEntryTypeBadge(entry.type, entry.adjustmentDirection);
              const isExpanded = Boolean(expandedEntryIds[entry.id]);
              const primaryLabel =
                entry.serviceNames && entry.serviceNames.length > 0
                  ? entry.serviceNames.join(' + ')
                  : entry.note?.trim() || entry.clientName || badge.label;
              const timePart = safeFormatTime(entry.createdAt, [], { hour: '2-digit', minute: '2-digit' }, '');
              const isNegativeAmount =
                entry.type === 'expense' ||
                entry.type === 'float_return' ||
                (entry.type === 'barber_adjustment' && entry.adjustmentDirection === 'debit');

              return (
                <div key={entry.id} className="py-2 first:pt-0 last:pb-0">
                  {/* Single-Line Compact Row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleEntryExpanded(entry.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleEntryExpanded(entry.id);
                      }
                    }}
                    className="w-full min-h-[42px] px-2.5 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center justify-between gap-2 text-start transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      {renderEntryOriginBadge(entry)}
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
                          isNegativeAmount
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
                  </div>

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
                              onClick={() => setConfirmDeleteEntry(entry)}
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

      {/* Entry & Credit Edit Modal (Master Admin full edit & delete + owning Barber credit edit) */}
      {editingEntry &&
        (sessionRole === 'master' ||
          (sessionRole === 'barber' && editingEntry.barberId === activeBarberId)) && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sb-modal-backdrop">
            <form
              onSubmit={handleSaveEntryEdit}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-2xl text-xs"
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

            {sessionRole === 'master' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    الحلاق / الحساب
                  </label>
                  <select
                    value={isFloatEntryType(editType) ? 'hassan' : editBarberId}
                    disabled={isFloatEntryType(editType)}
                    onChange={(e) => setEditBarberId(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-bold text-zinc-900 dark:text-white disabled:opacity-65"
                  >
                    {allCaisseBarbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.arName}
                      </option>
                    ))}
                  </select>
                  {isFloatEntryType(editType) && (
                    <span className="block mt-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      الصرف مسجل دائماً لحساب حسن ايت بومليك
                    </span>
                  )}
                </div>
                <div>
                  <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    نوع العملية
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => {
                      const nextType = e.target.value as CaisseEntryType;
                      setEditType(nextType);
                      if (isFloatEntryType(nextType)) {
                        setEditBarberId('hassan');
                      }
                    }}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-bold text-zinc-900 dark:text-white"
                  >
                    <option value="income">مدخول (+)</option>
                    <option value="expense">سحب / مصروف (−)</option>
                    <option value="credit_repayment">خلاص كريدي (+)</option>
                    <option value="float_adjustment">إضافة صرف (+)</option>
                    <option value="float_return">إرجاع صرف (−)</option>
                    <option value="barber_adjustment">تسوية رصيد حلاق معزولة (±)</option>
                  </select>
                </div>
              </div>
            )}

            {sessionRole === 'master' && editType === 'barber_adjustment' && (
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-500/35 space-y-2">
                <div className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                  تسوية معزولة للحلاق المختار فقط (لا تغير حصة المحل أو المجر العام أو باقي الحلاقين):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditAdjustmentDirection('credit')}
                    className={`px-3 py-2 rounded-xl border font-black text-xs cursor-pointer ${
                      editAdjustmentDirection === 'credit'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    + إضافة / مسح دين عن الحلاق
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAdjustmentDirection('debit')}
                    className={`px-3 py-2 rounded-xl border font-black text-xs cursor-pointer ${
                      editAdjustmentDirection === 'debit'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    − خصم / دين على الحلاق
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  المبلغ المؤدى (MAD)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
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
                  step="any"
                  value={editCreditRem}
                  onChange={(e) => setEditCreditRem(e.target.value)}
                  disabled={editType !== 'income' && editType !== 'credit_repayment'}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-orange-300 dark:border-orange-500/40 rounded-xl px-3 py-2 font-mono font-black text-zinc-900 dark:text-white disabled:opacity-50"
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
                ملاحظة / تفاصيل العملية
              </label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="ملاحظة الأداء أو التعديل..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div>
                {sessionRole === 'master' && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteEntry(editingEntry)}
                    className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف العملية</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
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
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Master Admin Only: Comprehensive Accountant & Reporting Suite */}
      {sessionRole === 'master' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>تقرير المحاسب العام (الإدارة فقط)</span>
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                حساب كل نهار لي ديال المحل · الفترات العشرية · نهاية الشهر · التراكمي السنوي · الأرشيف اليومي
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              {(
                [
                  { id: 'periods', label: 'النهار والشهر (10 أيام)', icon: CalendarRange },
                  { id: 'annual', label: 'التراكمي السنوي', icon: BarChart3 },
                  { id: 'cycles', label: 'تصفية الحسابات', icon: CheckCircle2 },
                  { id: 'archives', label: 'الأرشيف اليومي', icon: Archive },
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
                        className={`p-2.5 rounded-xl border hover:border-amber-500 text-start transition-colors cursor-pointer space-y-1 ${bTone.cardSurfaceClass} ${bTone.topAccentClass} ${bTone.borderLeftClass}`}
                      >
                        <div className="flex items-center justify-between gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${bTone.dotClass}`} />
                            <span className="truncate font-black">{barber.arName}</span>
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
                      className={`p-3 rounded-xl border space-y-1.5 ${bTone.cardSurfaceClass} ${bTone.topAccentClass} ${bTone.borderLeftClass}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${bTone.dotClass}`} />
                          <span>{row.arName}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black border ${bTone.badgeClass}`}>
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
                      className={`p-3 rounded-xl border space-y-1 ${bTone.cardSurfaceClass} ${bTone.topAccentClass} ${bTone.borderLeftClass}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${bTone.dotClass}`} />
                          <span>{row.arName}</span>
                        </div>
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
                    <div className="flex items-center gap-2.5 font-mono tabular-nums">
                      <span>مدفوع للحلاق: <strong>{formatMAD(cyc.barberSharePaidMAD)}</strong></span>
                      <span className="text-emerald-700 dark:text-emerald-400">
                        المحل: <strong>{formatMAD(cyc.shopShareMAD)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCycle(cyc)}
                        className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
                        title="حذف سجل تصفية الحساب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                  يتم حفظ سجل الأيام للمراجعة فقط دون أي تصفير تلقائي في أي ساعة — التصفير يتم حصراً عند الضغط على تصفية الحساب اليومي أو الشهري.
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
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => {
              setSelectedDrillEntry(null);
              setDrillModal(null);
            }}
          >
            <div
              className={`w-full max-w-2xl max-h-[86vh] flex flex-col rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden text-xs ${activeTone.topAccentClass} ${activeTone.borderLeftClass}`}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Modal Header */}
            <div className={`p-4 flex items-start justify-between gap-3 ${activeTone.headerBandClass}`}>
              <div className="min-w-0 space-y-0.5">
                <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                  {drillViewData.title}
                </h4>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
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
                  const badge = formatEntryTypeBadge(
                    selectedDrillEntry.type,
                    selectedDrillEntry.adjustmentDirection
                  );
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
                  const exactTime = safeFormatTime(selectedDrillEntry.createdAt, [], { hour: '2-digit', minute: '2-digit' }, '');

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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${badge.cls}`}>
                              {badge.label}
                            </span>
                            {renderEntryOriginBadge(selectedDrillEntry)}
                            <span className="font-bold text-zinc-900 dark:text-white">
                              {entryMeta.arName}
                            </span>
                          </div>
                          <span
                            dir="ltr"
                            className={`text-lg font-black font-mono tabular-nums ${
                              selectedDrillEntry.type === 'expense' ||
                              selectedDrillEntry.type === 'float_return' ||
                              (selectedDrillEntry.type === 'barber_adjustment' &&
                                selectedDrillEntry.adjustmentDirection === 'debit')
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {badge.sign}
                            {drillViewData.canShowAmounts
                              ? `${Math.round(Number(selectedDrillEntry.amountPaidMAD) || 0).toLocaleString('en-US')} MAD`
                              : '••• MAD'}
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
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
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
                          {sessionRole === 'master' && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteEntry(selectedDrillEntry)}
                              className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 font-black inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف العملية</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <>
                  {drillModal.kind === 'net_balance' &&
                    sessionRole === 'caisse' &&
                    (activeBarberId === 'hassan' || activeBarberMeta.isOwner ? (
                      <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/35 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono tabular-nums">
                        <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800">
                          <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">
                            مداخيل حسن
                          </span>
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            {drillViewData.canShowAmounts
                              ? `${Math.round(displayedDayIntakeStats.displayedIncomeMAD).toLocaleString('en-US')} MAD`
                              : '••• MAD'}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800">
                          <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">
                            فلوس الصرف (حسن)
                          </span>
                          <strong className="text-amber-700 dark:text-amber-300">
                            {drillViewData.canShowAmounts
                              ? `${Math.round(displayedDayIntakeStats.displayedFloatMAD).toLocaleString('en-US')} MAD`
                              : '••• MAD'}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800">
                          <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">
                            مصاريف حسن فقط
                          </span>
                          <strong className="text-rose-700 dark:text-rose-400">
                            {drillViewData.canShowAmounts
                              ? `${Math.round(displayedDayIntakeStats.displayedExpensesMAD).toLocaleString('en-US')} MAD`
                              : '••• MAD'}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-500/40">
                          <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">
                            المجر كامل (حسن)
                          </span>
                          <strong
                            dir="ltr"
                            className={
                              displayedDayIntakeStats.displayedDrawerCashMAD < 0
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }
                          >
                            {drillViewData.canShowAmounts
                              ? `${Math.round(displayedDayIntakeStats.displayedDrawerCashMAD).toLocaleString('en-US')} MAD`
                              : '••• MAD'}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/35 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono tabular-nums">
                        <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800">
                          <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">
                            إجمالي المداخيل (الدورة)
                          </span>
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            {drillViewData.canShowAmounts
                              ? `${Math.round(cycleBalance.incomeMAD).toLocaleString('en-US')} MAD`
                              : '••• MAD'}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800">
                          <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">
                            حصة الحلاق ({cycleBalance.commissionPercent}%)
                          </span>
                          <strong className="text-zinc-900 dark:text-white">
                            {drillViewData.canShowAmounts
                              ? `${Math.round(cycleBalance.barberGrossShareMAD).toLocaleString('en-US')} MAD`
                              : '••• MAD'}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800">
                          <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">
                            مجموع السحوبات (الدورة)
                          </span>
                          <strong className="text-rose-700 dark:text-rose-400">
                            {drillViewData.canShowAmounts
                              ? `${Math.round(cycleBalance.expensesMAD).toLocaleString('en-US')} MAD`
                              : '••• MAD'}
                          </strong>
                        </div>
                        {cycleBalance.carryForwardMAD !== 0 && (
                          <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800">
                            <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">
                              مرحل من الدورة السابقة
                            </span>
                            <strong className="text-rose-700 dark:text-rose-300">
                              {drillViewData.canShowAmounts
                                ? `${Math.round(cycleBalance.carryForwardMAD).toLocaleString('en-US')} MAD`
                                : '••• MAD'}
                            </strong>
                          </div>
                        )}
                        {cycleBalance.barberAdjustmentMAD !== 0 && (
                          <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800">
                            <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">
                              تسوية إدارية
                            </span>
                            <strong className="text-indigo-700 dark:text-indigo-300">
                              {drillViewData.canShowAmounts
                                ? `${Math.round(cycleBalance.barberAdjustmentMAD).toLocaleString('en-US')} MAD`
                                : '••• MAD'}
                            </strong>
                          </div>
                        )}
                        <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/40">
                          <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">
                            شحال بقى ليه في الحساب كامل
                          </span>
                          <strong
                            dir="ltr"
                            className={
                              cycleBalance.barberNetOwedMAD < 0
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-amber-700 dark:text-amber-300'
                            }
                          >
                            {drillViewData.canShowAmounts
                              ? `${Math.round(cycleBalance.barberNetOwedMAD).toLocaleString('en-US')} MAD`
                              : '••• MAD'}
                          </strong>
                        </div>
                      </div>
                    ))}
                  {drillViewData.list.length === 0 &&
                    (!drillViewData.manualList || drillViewData.manualList.length === 0) && (
                      <div className="py-10 text-center text-zinc-500 dark:text-zinc-400">
                        لا توجد عمليات مسجلة في هذا البند بعد.
                      </div>
                    )}
                  {drillViewData.list.map((item) => {
                    const badge = formatEntryTypeBadge(item.type, item.adjustmentDirection);
                    const effCredRem = getEffectiveCaisseCreditRemaining(item);
                    const itemTime = safeFormatTime(item.createdAt, [], { hour: '2-digit', minute: '2-digit' }, '');
                    const label =
                      item.serviceNames && item.serviceNames.length > 0
                        ? item.serviceNames.join(' + ')
                        : item.clientName || item.note?.trim() || badge.label;
                    const waUrl =
                      effCredRem > 0
                        ? buildCreditWhatsAppReminderUrl({
                            clientPhone: item.clientPhone,
                            clientName: item.clientName,
                            amountOwedMAD: effCredRem,
                            creditorName: getCaisseBarberMeta(item.barberId, roster).arName,
                            creditDate: item.date,
                            note: item.note,
                            lang,
                          })
                        : null;
                    const isBeforeDayClose =
                      drillViewData.closedIso && item.createdAt <= drillViewData.closedIso;
                    const displayVal =
                      drillModal.kind === 'credits_all'
                        ? effCredRem
                        : item.amountPaidMAD;

                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                          isBeforeDayClose
                            ? 'bg-zinc-100/70 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-70'
                            : 'bg-zinc-50 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
                        }`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedDrillEntry(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedDrillEntry(item);
                            }
                          }}
                          className="flex-1 min-w-0 flex items-center justify-between gap-2 text-start cursor-pointer"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>
                                {badge.label}
                              </span>
                              {renderEntryOriginBadge(item)}
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
                              {effCredRem > 0 && (
                                <span className="text-orange-700 dark:text-orange-300 font-bold">
                                  كريدي:{' '}
                                  {drillViewData.canShowAmounts
                                    ? `${Math.round(effCredRem).toLocaleString('en-US')} MAD`
                                    : '••• MAD'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              dir="ltr"
                              className={`font-mono font-black text-sm tabular-nums ${
                                item.type === 'expense' ||
                                item.type === 'float_return' ||
                                (item.type === 'barber_adjustment' &&
                                  item.adjustmentDirection === 'debit')
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {badge.sign}
                              {drillViewData.canShowAmounts
                                ? `${Math.round(Number(displayVal) || 0).toLocaleString('en-US')} MAD`
                                : '••• MAD'}
                            </span>
                            <Eye className="w-3.5 h-3.5 text-zinc-400" />
                          </div>
                        </div>

                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-xs transition-colors"
                            title="تذكير مباشر عبر واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {sessionRole === 'master' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                openEditModalForEntry(item);
                                setDrillModal(null);
                              }}
                              className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-amber-400 shrink-0 cursor-pointer"
                              title="تعديل العملية"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteEntry(item)}
                              className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 hover:bg-rose-100 shrink-0 cursor-pointer"
                              title="حذف العملية"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {(drillViewData.manualList || []).map((rec) => {
                    const effRem = getEffectiveManualCreditRemaining(rec);
                    const allPhones = [rec.clientPhone, ...(rec.additionalPhones || [])]
                      .map((p) => String(p || '').trim())
                      .filter(Boolean);
                    const dateLabel = asDateString(rec.creditDate, '') || asIsoString(rec.createdAt, '').slice(0, 10);
                    const waUrl = buildCreditWhatsAppReminderUrl({
                      clientPhone: allPhones[0] || '',
                      clientName: rec.clientName,
                      amountOwedMAD: effRem,
                      creditorName: rec.barberName || activeBarberMeta.arName,
                      creditDate: dateLabel,
                      note: rec.note,
                      lang,
                    });
                    return (
                      <div
                        key={`drill_manual_${rec.id}`}
                        className="p-2.5 rounded-xl border bg-amber-50/60 dark:bg-zinc-900/80 border-amber-200 dark:border-zinc-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 space-y-0.5 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300">
                              سجل الكريدي
                            </span>
                            <span className="font-bold text-zinc-900 dark:text-white truncate">
                              {rec.clientName}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-2 flex-wrap">
                            <span>{dateLabel}</span>
                            {allPhones.map((ph, idx) => (
                              <span key={`${ph}-${idx}`} dir="ltr">
                                · {ph}
                              </span>
                            ))}
                            {rec.note && <span className="font-sans">· {rec.note}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            dir="ltr"
                            className="font-mono font-black text-sm tabular-nums text-orange-700 dark:text-orange-300"
                          >
                            {drillViewData.canShowAmounts
                              ? `${Math.round(effRem).toLocaleString('en-US')} MAD`
                              : '••• MAD'}
                          </span>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-xs transition-colors"
                              title="تذكير مباشر عبر واتساب"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {drawerBreakdownModalNode}
      {hassanPinModalNode}

      {/* Master Admin: Isolated Barber Balance Adjust / Clear Negative Modal */}
      {sessionRole === 'master' && balanceAdjustModalOpen && activeBarberId && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => !balanceAdjustBusy && setBalanceAdjustModalOpen(false)}
          >
            <form
              onSubmit={handleSubmitBalanceAdjustment}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#141720] border-2 border-indigo-400 dark:border-indigo-500/50 p-5 space-y-4 shadow-2xl text-xs"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                <span className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>تعديل / تصفية الرصيد (معزول) — {activeBarberMeta.arName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => !balanceAdjustBusy && setBalanceAdjustModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/35 text-[11px] text-indigo-950 dark:text-indigo-200 space-y-1">
                <div className="font-bold">
                  الرصيد المفتوح الحالي لـ {activeBarberMeta.arName}:{' '}
                  <strong
                    dir="ltr"
                    className={`font-mono ${
                      cycleBalance.barberNetOwedMAD < 0
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {Math.round(cycleBalance.barberNetOwedMAD)} MAD
                  </strong>
                </div>
                <p className="text-[10px] leading-relaxed">
                  هذا التعديل معزول 100% لحساب {activeBarberMeta.arName} فقط — لن يغير رصيد باقي الحلاقين أو المجر اليومي أو حصة المحل.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {cycleBalance.barberNetOwedMAD < 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBalanceAdjustMode('zero_negative');
                      setBalanceAdjustAmount(String(Math.abs(Math.round(cycleBalance.barberNetOwedMAD))));
                      setBalanceAdjustNote(
                        `تصفية الرصيد السالب (${cycleBalance.barberNetOwedMAD} MAD) — دفع المبلغ معزولاً`
                      );
                    }}
                    className={`px-2 py-2 rounded-xl border font-black text-[11px] cursor-pointer ${
                      balanceAdjustMode === 'zero_negative'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    تصفير السالب إلى 0
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setBalanceAdjustMode('set_target');
                    setBalanceAdjustAmount('0');
                  }}
                  className={`px-2 py-2 rounded-xl border font-black text-[11px] cursor-pointer ${
                    balanceAdjustMode === 'set_target'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  } ${cycleBalance.barberNetOwedMAD >= 0 ? 'col-span-1' : ''}`}
                >
                  تحديد الرصيد الجديد
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBalanceAdjustMode('delta');
                    setBalanceAdjustAmount('');
                  }}
                  className={`px-2 py-2 rounded-xl border font-black text-[11px] cursor-pointer ${
                    balanceAdjustMode === 'delta'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  إضافة أو خصم (+ / −)
                </button>
              </div>

              {balanceAdjustMode === 'zero_negative' && cycleBalance.barberNetOwedMAD < 0 ? (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/35 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  سيتم تسجيل مسح دين معزول بقيمة{' '}
                  <span dir="ltr" className="font-mono font-black">
                    +{Math.abs(Math.round(cycleBalance.barberNetOwedMAD))} MAD
                  </span>{' '}
                  ليصبح رصيد {activeBarberMeta.arName} المفتوح <span className="font-mono">0 MAD</span>.
                </div>
              ) : balanceAdjustMode === 'set_target' ? (
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    الرصيد المستهدف الجديد لـ {activeBarberMeta.arName} (MAD)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={balanceAdjustAmount}
                    onChange={(e) => setBalanceAdjustAmount(e.target.value)}
                    placeholder="0"
                    required
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono font-black text-base text-zinc-900 dark:text-white"
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBalanceAdjustDirection('credit')}
                      className={`px-3 py-2 rounded-xl border font-black text-xs cursor-pointer ${
                        balanceAdjustDirection === 'credit'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      + إضافة لرصيده (تخفيف السالب)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBalanceAdjustDirection('debit')}
                      className={`px-3 py-2 rounded-xl border font-black text-xs cursor-pointer ${
                        balanceAdjustDirection === 'debit'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      − خصم من رصيده
                    </button>
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      المبلغ (MAD)
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={balanceAdjustAmount}
                      onChange={(e) => setBalanceAdjustAmount(e.target.value)}
                      placeholder="0"
                      required
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono font-black text-base text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    التاريخ
                  </label>
                  <input
                    type="date"
                    value={balanceAdjustDate}
                    onChange={(e) => setBalanceAdjustDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    ملاحظة / سبب التعديل
                  </label>
                  <input
                    type="text"
                    value={balanceAdjustNote}
                    onChange={(e) => setBalanceAdjustNote(e.target.value)}
                    placeholder="مثال: خلص اللي كان عليه..."
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={balanceAdjustBusy}
                  onClick={() => setBalanceAdjustModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={balanceAdjustBusy}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black cursor-pointer disabled:opacity-60"
                >
                  {balanceAdjustBusy ? 'جاري الحفظ...' : 'حفظ التعديل المعزول ✓'}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Master Admin: Prompt on Monthly Settlement When Barber(s) Have Negative Balance */}
      {sessionRole === 'master' && negativePayoutPrompt && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => !payoutBusy && setNegativePayoutPrompt(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#141720] border-2 border-amber-400 dark:border-amber-500/60 p-5 space-y-4 shadow-2xl text-xs"
            >
              <div className="flex items-start justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-zinc-900 dark:text-white">
                      تنبيه تصفية الحساب الشهري — يوجد رصيد سالب
                    </h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                      {negativePayoutPrompt.barbers.length === 1
                        ? `الحلاق ${negativePayoutPrompt.barbers[0].arName} عندو رصيد سالب بقيمة ${negativePayoutPrompt.barbers[0].negativeAmountMAD} MAD. واش عطاك المبلغ باش نحيدوه، ولا غادي يدوز للشهر الجاي؟`
                        : 'كاينين حلاقين عندهم رصيد سالب. اختار لكل حلاق واش عطاك باش نحيدها ولا تدوز للشهر الجاي:'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={payoutBusy}
                  onClick={() => setNegativePayoutPrompt(null)}
                  className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {negativePayoutPrompt.barbers.length === 1 ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/40 flex items-center justify-between gap-2">
                    <span className="font-black text-zinc-900 dark:text-white">
                      {negativePayoutPrompt.barbers[0].arName}
                    </span>
                    <span dir="ltr" className="font-mono font-black text-base text-rose-700 dark:text-rose-400">
                      {negativePayoutPrompt.barbers[0].negativeAmountMAD} MAD
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <button
                      type="button"
                      disabled={payoutBusy}
                      onClick={() =>
                        void executePayoutWithResolutions(negativePayoutPrompt.mode, {
                          [negativePayoutPrompt.barbers[0].barberId]: 'cleared',
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs text-start flex items-center justify-between gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <span>واش عطاني باش نحيدها (عطاني الفلوس وتصفّى لـ 0 MAD ✓)</span>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    </button>
                    <button
                      type="button"
                      disabled={payoutBusy}
                      onClick={() =>
                        void executePayoutWithResolutions(negativePayoutPrompt.mode, {
                          [negativePayoutPrompt.barbers[0].barberId]: 'carried_forward',
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs text-start flex items-center justify-between gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <span>
                        لا، باقي عليه باش دوز للشهر الجاي (يتسجل{' '}
                        <span dir="ltr" className="font-mono">
                          {negativePayoutPrompt.barbers[0].negativeAmountMAD} MAD
                        </span>{' '}
                        في الشهر الجاي)
                      </span>
                      <Calendar className="w-4 h-4 shrink-0" />
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={payoutBusy}
                      onClick={() => setNegativePayoutPrompt(null)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                    >
                      رجوع / إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next: Record<string, 'cleared' | 'carried_forward'> = {};
                        negativePayoutPrompt.barbers.forEach((b) => {
                          next[b.barberId] = 'cleared';
                        });
                        setNegativePayoutPrompt((prev) =>
                          prev ? { ...prev, resolutions: next } : null
                        );
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-800 dark:text-emerald-200 font-black text-[11px] cursor-pointer"
                    >
                      الكل: عطاني باش نحيدها (0 MAD)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next: Record<string, 'cleared' | 'carried_forward'> = {};
                        negativePayoutPrompt.barbers.forEach((b) => {
                          next[b.barberId] = 'carried_forward';
                        });
                        setNegativePayoutPrompt((prev) =>
                          prev ? { ...prev, resolutions: next } : null
                        );
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-900 dark:text-amber-200 font-black text-[11px] cursor-pointer"
                    >
                      الكل: دوز للشهر الجاي
                    </button>
                  </div>

                  <div className="space-y-2">
                    {negativePayoutPrompt.barbers.map((nb) => {
                      const choice =
                        negativePayoutPrompt.resolutions[nb.barberId] || 'carried_forward';
                      return (
                        <div
                          key={nb.barberId}
                          className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-zinc-900 dark:text-white">
                              {nb.arName}
                            </span>
                            <span dir="ltr" className="font-mono font-black text-rose-700 dark:text-rose-400">
                              {nb.negativeAmountMAD} MAD
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setNegativePayoutPrompt((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        resolutions: {
                                          ...prev.resolutions,
                                          [nb.barberId]: 'cleared',
                                        },
                                      }
                                    : null
                                )
                              }
                              className={`px-2.5 py-1.5 rounded-lg border font-black text-[11px] cursor-pointer ${
                                choice === 'cleared'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                              }`}
                            >
                              عطاني باش نحيدها (0 MAD)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setNegativePayoutPrompt((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        resolutions: {
                                          ...prev.resolutions,
                                          [nb.barberId]: 'carried_forward',
                                        },
                                      }
                                    : null
                                )
                              }
                              className={`px-2.5 py-1.5 rounded-lg border font-black text-[11px] cursor-pointer ${
                                choice === 'carried_forward'
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                              }`}
                            >
                              دوز للشهر الجاي ({nb.negativeAmountMAD})
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={payoutBusy}
                      onClick={() => setNegativePayoutPrompt(null)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={payoutBusy}
                      onClick={() =>
                        void executePayoutWithResolutions(
                          negativePayoutPrompt.mode,
                          negativePayoutPrompt.resolutions
                        )
                      }
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer disabled:opacity-60"
                    >
                      {payoutBusy ? 'جاري التصفية...' : 'تأكيد وتصفية الحساب الشهري ✓'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Small Solid Confirmation Modal ("موافقة") for Duplicate Deposit / Withdrawal Warning */}
      {duplicateWarning && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => setDuplicateWarning(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#141720] border-2 border-amber-400 dark:border-amber-500/60 p-5 space-y-4 shadow-2xl text-xs"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-zinc-900 dark:text-white">
                    تنبيه: نفس المبلغ مسجل من قبل
                  </h4>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    لقد قمت بتسجيل مبلغ{' '}
                    <strong dir="ltr" className="font-mono text-amber-700 dark:text-amber-300">
                      {duplicateWarning.amount} MAD
                    </strong>{' '}
                    من قبل
                    {duplicateWarning.matchedTimeLabel
                      ? ` عند الساعة ${duplicateWarning.matchedTimeLabel}`
                      : ''}
                    {duplicateWarning.matchedNote ? ` (${duplicateWarning.matchedNote})` : ''}.
                    هل تريد تأكيد التسجيل مرة أخرى؟
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  إلغاء / تعديل
                </button>
                <button
                  type="button"
                  disabled={incomeSubmitting || expenseSubmitting}
                  onClick={() => {
                    if (duplicateWarning.kind === 'income') {
                      void handleSubmitIncome(undefined, true);
                    } else {
                      void handleSubmitExpense(undefined, true);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer disabled:opacity-60"
                >
                  موافقة ✓
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Interactive Day Detail Modal (All "حط" deposits & "هز" withdrawals for barber+date; Master-only CRUD even when "مغلق") */}
      {dayDetailTarget && dayDetailView && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => setDayDetailTarget(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 ${getBarberIdentityTokens(dayDetailTarget.barberId, dayDetailView.meta.arName).topAccentClass} ${getBarberIdentityTokens(dayDetailTarget.barberId, dayDetailView.meta.arName).borderLeftClass} shadow-2xl overflow-hidden text-xs`}
            >
              {/* Modal Header */}
              <div className={`p-4 flex items-start justify-between gap-3 ${getBarberIdentityTokens(dayDetailTarget.barberId, dayDetailView.meta.arName).headerBandClass}`}>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${getBarberIdentityTokens(dayDetailTarget.barberId, dayDetailView.meta.arName).iconBoxClass}`}>
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                    </span>
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                      تفاصيل يوم <span dir="ltr" className="font-mono">{dayDetailView.date}</span>
                    </h4>
                    <span className={`px-2 py-0.5 rounded-md border text-[11px] font-black inline-flex items-center gap-1 ${getBarberIdentityTokens(dayDetailTarget.barberId, dayDetailView.meta.arName).badgeClass}`}>
                      <span className={`w-2 h-2 rounded-full ${getBarberIdentityTokens(dayDetailTarget.barberId, dayDetailView.meta.arName).dotClass}`} />
                      {dayDetailView.meta.arName}
                    </span>
                    {dayDetailView.isClosed ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                        مغلق ✓
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                        مفتوح
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                    {sessionRole === 'master'
                      ? 'صلاحية المشرف العام: يمكنك إضافة أو تعديل أو حذف أي عملية في هذا اليوم حتى لو كان مغلقاً.'
                      : 'عرض تفصيلي لعمليات الإيداع (حط) والسحب (هز) المسجلة في هذا اليوم.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDayDetailTarget(null)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Day Summary Strip */}
              <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950/70 border-b border-zinc-100 dark:border-zinc-800 grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200/80 dark:border-emerald-500/30">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block">
                    مجموع الإيداع (حط)
                  </span>
                  <span dir="ltr" className="text-sm font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    +{formatMAD(dayDetailView.dayStats.incomeMAD, 'kpi_income')}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-rose-200/80 dark:border-rose-500/30">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block">
                    مجموع السحب (هز)
                  </span>
                  <span dir="ltr" className="text-sm font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
                    -{formatMAD(dayDetailView.dayStats.expensesMAD, 'kpi_expenses')}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block">
                    صافي اليوم ({dayDetailView.dayEntries.length} عملية)
                  </span>
                  <span
                    dir="ltr"
                    className={`text-sm font-black font-mono tabular-nums ${
                      dayDetailView.dayStats.incomeMAD - dayDetailView.dayStats.expensesMAD < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {formatMAD(
                      dayDetailView.dayStats.incomeMAD - dayDetailView.dayStats.expensesMAD,
                      'kpi_net'
                    )}
                  </span>
                </div>
              </div>

              {/* Scrollable Modal Body */}
              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {/* Master-Admin-Only Inline Add Form for this Specific Day (Even if "مغلق") */}
                {sessionRole === 'master' && (
                  <form
                    onSubmit={handleAddEntryInDayModal}
                    className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/35 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <PlusCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>إضافة عملية جديدة ليوم {dayDetailView.date}</span>
                      </span>
                      <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                        المشرف العام فقط
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDayModalAddType('income')}
                        className={`px-2.5 py-2 rounded-xl border font-black text-[11px] cursor-pointer transition-colors ${
                          dayModalAddType === 'income'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        + حط (مدخول)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDayModalAddType('expense')}
                        className={`px-2.5 py-2 rounded-xl border font-black text-[11px] cursor-pointer transition-colors ${
                          dayModalAddType === 'expense'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        − هز (سحب / مصروف)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDayModalAddType('credit_repayment')}
                        className={`px-2.5 py-2 rounded-xl border font-black text-[11px] cursor-pointer transition-colors ${
                          dayModalAddType === 'credit_repayment'
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        + خلاص كريدي
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <CaisseAmountField
                        value={dayModalAddAmount}
                        onChange={setDayModalAddAmount}
                        quickAmounts={CAISSE_QUICK_AMOUNTS}
                        accent={dayModalAddType === 'expense' ? 'rose' : 'emerald'}
                        placeholder="المبلغ (MAD) *"
                        required
                        compact
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={dayModalAddClientName}
                          onChange={(e) => setDayModalAddClientName(e.target.value)}
                          placeholder="اسم الزبون (اختياري)"
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={dayModalAddNote}
                          onChange={(e) => setDayModalAddNote(e.target.value)}
                          placeholder="تفاصيل / ملاحظة (اختياري)"
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={dayModalAddBusy}
                        className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-zinc-950 font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {dayModalAddBusy
                            ? 'جاري الحفظ...'
                            : `حفظ العملية في ${dayDetailView.date}`}
                        </span>
                      </button>
                    </div>
                  </form>
                )}

                {dayDetailView.dayEntries.length === 0 ? (
                  <div className="py-10 text-center text-zinc-500 dark:text-zinc-400">
                    لا توجد عمليات مسجلة لهذا الحلاق في يوم {dayDetailView.date}.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Deposits ("حط") Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                          <PlusCircle className="w-4 h-4" />
                          <span>الإيداعات في المجر — حط ({dayDetailView.depositEntries.length})</span>
                        </h5>
                        <span dir="ltr" className="font-mono font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                          +{formatMAD(dayDetailView.dayStats.incomeMAD, 'kpi_income')}
                        </span>
                      </div>
                      {dayDetailView.depositEntries.length === 0 ? (
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-zinc-500 text-center">
                          لا توجد إيداعات (حط) في هذا اليوم.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {dayDetailView.depositEntries.map((item) => {
                            const badge = formatEntryTypeBadge(item.type, item.adjustmentDirection);
                            const timePart = safeFormatTime(
                              item.createdAt,
                              [],
                              { hour: '2-digit', minute: '2-digit' },
                              ''
                            );
                            const label =
                              item.serviceNames && item.serviceNames.length > 0
                                ? item.serviceNames.join(' + ')
                                : item.clientName || item.note?.trim() || badge.label;
                            const effCred = getEffectiveCaisseCreditRemaining(item);
                            return (
                              <div
                                key={item.id}
                                className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>
                                      {badge.label}
                                    </span>
                                    {renderEntryOriginBadge(item)}
                                    <span className="font-bold text-zinc-900 dark:text-white truncate">
                                      {label}
                                    </span>
                                    {effCred > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 text-[10px] font-mono font-bold">
                                        كريدي {maskNum(effCred)} MAD
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 flex items-center gap-2 flex-wrap">
                                    {timePart && <span className="font-mono">{timePart}</span>}
                                    {item.clientName && <span>· {item.clientName}</span>}
                                    {item.note && <span>· {item.note}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    dir="ltr"
                                    className="font-mono font-black text-sm tabular-nums text-emerald-700 dark:text-emerald-400"
                                  >
                                    {badge.sign}
                                    {formatMAD(item.amountPaidMAD, 'kpi_income')}
                                  </span>
                                  {sessionRole === 'master' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openEditModalForEntry(item)}
                                        className="p-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-amber-400 cursor-pointer"
                                        title="تعديل العملية"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteEntry(item)}
                                        className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
                                        title="حذف العملية"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Withdrawals / Expenses ("هز") Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                          <MinusCircle className="w-4 h-4" />
                          <span>السحوبات والمصاريف — هز ({dayDetailView.withdrawalEntries.length})</span>
                        </h5>
                        <span dir="ltr" className="font-mono font-black text-rose-600 dark:text-rose-400 tabular-nums">
                          -{formatMAD(dayDetailView.dayStats.expensesMAD, 'kpi_expenses')}
                        </span>
                      </div>
                      {dayDetailView.withdrawalEntries.length === 0 ? (
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-zinc-500 text-center">
                          لا توجد سحوبات (هز) في هذا اليوم.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {dayDetailView.withdrawalEntries.map((item) => {
                            const badge = formatEntryTypeBadge(item.type, item.adjustmentDirection);
                            const timePart = safeFormatTime(
                              item.createdAt,
                              [],
                              { hour: '2-digit', minute: '2-digit' },
                              ''
                            );
                            const label =
                              item.note?.trim() || item.clientName || badge.label;
                            return (
                              <div
                                key={item.id}
                                className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>
                                      {badge.label}
                                    </span>
                                    {renderEntryOriginBadge(item)}
                                    <span className="font-bold text-zinc-900 dark:text-white truncate">
                                      {label}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-zinc-500 flex items-center gap-2 flex-wrap">
                                    {timePart && <span className="font-mono">{timePart}</span>}
                                    <span>· سجله: {item.createdByName}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    dir="ltr"
                                    className="font-mono font-black text-sm tabular-nums text-rose-600 dark:text-rose-400"
                                  >
                                    {badge.sign}
                                    {formatMAD(item.amountPaidMAD, 'kpi_expenses')}
                                  </span>
                                  {sessionRole === 'master' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openEditModalForEntry(item)}
                                        className="p-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-amber-400 cursor-pointer"
                                        title="تعديل العملية"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteEntry(item)}
                                        className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
                                        title="حذف العملية"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Solid Confirmation Modal: Delete Caisse Entry (Master Admin) */}
      {sessionRole === 'master' && confirmDeleteEntry && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => !deleteEntryBusy && setConfirmDeleteEntry(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#141720] border-2 border-rose-400 dark:border-rose-500/50 p-5 space-y-4 shadow-2xl text-xs"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-zinc-900 dark:text-white">
                    تأكيد حذف العملية
                  </h4>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    هل أنت متأكد من حذف هذه العملية (
                    <strong dir="ltr" className="font-mono">
                      {confirmDeleteEntry.amountPaidMAD} MAD
                    </strong>{' '}
                    · {getCaisseBarberMeta(confirmDeleteEntry.barberId, roster).arName} ·{' '}
                    <span className="font-mono">{confirmDeleteEntry.date}</span>)؟ سيتم تحديث
                    جميع الحسابات تلقائياً.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deleteEntryBusy}
                  onClick={() => setConfirmDeleteEntry(null)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={deleteEntryBusy}
                  onClick={() => void handleConfirmDeleteEntry()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer disabled:opacity-60"
                >
                  {deleteEntryBusy ? 'جاري الحذف...' : 'تأكيد الحذف ✓'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Solid Confirmation Modal: Delete Cycle Settlement (Master Admin) */}
      {sessionRole === 'master' && confirmDeleteCycle && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => !deleteCycleBusy && setConfirmDeleteCycle(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#141720] border-2 border-rose-400 dark:border-rose-500/50 p-5 space-y-4 shadow-2xl text-xs"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-zinc-900 dark:text-white">
                    حذف سجل تصفية الحساب
                  </h4>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    هل تريد حذف تصفية حساب{' '}
                    <strong>{getCaisseBarberMeta(confirmDeleteCycle.barberId, roster).arName}</strong>{' '}
                    بتاريخ <span className="font-mono">{confirmDeleteCycle.settledThroughDate}</span>{' '}
                    (مدفوع: <span dir="ltr" className="font-mono">{confirmDeleteCycle.barberSharePaidMAD} MAD</span>)؟
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deleteCycleBusy}
                  onClick={() => setConfirmDeleteCycle(null)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={deleteCycleBusy}
                  onClick={() => void handleConfirmDeleteCycle()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer disabled:opacity-60"
                >
                  {deleteCycleBusy ? 'جاري الحذف...' : 'حذف التصفية ✓'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
      {caisseCalculatorModalNode}
      {inspectOriginModalNode}
    </div>
  );
};
