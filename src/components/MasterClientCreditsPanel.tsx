import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  CreditCard,
  Edit3,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { AppointmentBooking, CaisseEntry, ClientCreditRecord } from '../types';
import {
  addManualClientCredit,
  deleteCreditDispute,
  deleteManualClientCredit,
  recordManualCreditPayment,
  updateCreditDisputeStatus,
  updateManualClientCredit,
  useCreditDisputes,
  useManualClientCredits,
} from '../utils/creditRegistryStore';
import { normalizeMoroccanPhoneDigits, subscribeToBookings } from '../utils/bookingStore';
import { buildCrmClientSummaries, useCrmClients } from '../utils/crmStore';
import {
  getCaisseBarberMeta,
  getSalonBusinessDate,
  recordCaisseCreditRepayment,
  useCaisseEntries,
} from '../utils/caisseStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import { buildCreditWhatsAppReminderUrl } from '../utils/whatsappAutomation';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { showToast } from '../utils/notifications';
import { ModalPortal } from './ModalPortal';

interface MasterClientCreditsPanelProps {
  staffName: string;
}

export const MasterClientCreditsPanel: React.FC<MasterClientCreditsPanelProps> = ({
  staffName,
}) => {
  const { lang } = useLanguage();
  const manualCredits = useManualClientCredits();
  const creditDisputes = useCreditDisputes();
  const caisseEntries = useCaisseEntries();
  const roster = useBarberRoster();
  const crmMap = useCrmClients();
  const [bookings, setBookings] = useState<AppointmentBooking[]>([]);

  useEffect(() => subscribeToBookings(setBookings), []);

  // Dispute staff note drafts
  const [disputeNoteDrafts, setDisputeNoteDrafts] = useState<Record<string, string>>({});

  // Add new debtor form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCreditDate, setNewCreditDate] = useState('');
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);

  // Contact Picker Modal state
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open_all' | 'all' | 'paid'>('open_all');

  // Inline payment / edit state
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmountInput, setPayAmountInput] = useState('');
  const [editingRecord, setEditingRecord] = useState<ClientCreditRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCreditDate, setEditCreditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Deduplicated directory of existing salon clients & booking contacts
  const directoryContacts = useMemo(() => {
    const byPhone = new Map<string, { name: string; phone: string; visits: number }>();
    const crmSummaries = buildCrmClientSummaries(bookings, crmMap);
    crmSummaries.forEach((c) => {
      const norm = normalizeMoroccanPhoneDigits(c.phoneDisplay) || c.phoneDisplay.replace(/\D/g, '');
      if (norm.length >= 6 && !byPhone.has(norm)) {
        byPhone.set(norm, {
          name: c.clientName,
          phone: c.phoneDisplay,
          visits: c.verifiedVisits,
        });
      }
    });
    manualCredits.forEach((rec) => {
      const norm = normalizeMoroccanPhoneDigits(rec.clientPhone) || rec.normalizedPhone;
      if (norm.length >= 6 && !byPhone.has(norm)) {
        byPhone.set(norm, {
          name: rec.clientName,
          phone: rec.clientPhone,
          visits: 0,
        });
      }
    });
    const list = Array.from(byPhone.values());
    const q = contactSearch.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, '');
    if (!q) return list.slice(0, 60);
    return list
      .filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(q);
        const normItem = item.phone.replace(/\D/g, '');
        const phoneMatch =
          item.phone.toLowerCase().includes(q) || (qDigits.length >= 2 && normItem.includes(qDigits));
        return nameMatch || phoneMatch;
      })
      .slice(0, 60);
  }, [bookings, crmMap, manualCredits, contactSearch]);

  const supportsWebContactsApi =
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof (navigator as unknown as { contacts?: { select?: unknown } }).contacts?.select === 'function';

  const handlePickFromPhoneContacts = async () => {
    try {
      const navContacts = (
        navigator as unknown as {
          contacts?: {
            select?: (
              props: string[],
              opts?: { multiple?: boolean }
            ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
          };
        }
      ).contacts;
      if (!navContacts?.select) return;
      const picked = await navContacts.select(['name', 'tel'], { multiple: false });
      const first = picked?.[0];
      if (first) {
        const pickedName = first.name?.[0]?.trim() || '';
        const pickedTel = first.tel?.[0]?.trim() || '';
        if (pickedName) setNewName(pickedName);
        if (pickedTel) setNewPhone(pickedTel);
        setContactPickerOpen(false);
      }
    } catch (err) {
      console.warn('Web Contacts API pick cancelled or unsupported:', err);
    }
  };

  // Open Caisse-linked credits
  const openCaisseCredits = useMemo(
    () =>
      caisseEntries.filter(
        (e) => e.creditRemainingMAD > 0 && e.creditStatus !== 'paid'
      ),
    [caisseEntries]
  );

  const openManualCredits = useMemo(
    () => manualCredits.filter((r) => r.amountOwedMAD > 0 && r.status !== 'paid'),
    [manualCredits]
  );

  const totalManualOwedMAD = useMemo(
    () =>
      Math.round(
        openManualCredits.reduce((sum, r) => sum + (Number(r.amountOwedMAD) || 0), 0) * 100
      ) / 100,
    [openManualCredits]
  );

  const totalCaisseOwedMAD = useMemo(
    () =>
      Math.round(
        openCaisseCredits.reduce((sum, e) => sum + (Number(e.creditRemainingMAD) || 0), 0) * 100
      ) / 100,
    [openCaisseCredits]
  );

  const grandTotalOwedMAD = Math.round((totalManualOwedMAD + totalCaisseOwedMAD) * 100) / 100;

  const filteredManualCredits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, '');
    return manualCredits.filter((rec) => {
      if (statusFilter === 'open_all' && (rec.status === 'paid' || rec.amountOwedMAD <= 0)) {
        return false;
      }
      if (statusFilter === 'paid' && rec.status !== 'paid' && rec.amountOwedMAD > 0) {
        return false;
      }
      if (!q) return true;
      const matchName = rec.clientName.toLowerCase().includes(q);
      const matchPhone =
        rec.clientPhone.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && rec.normalizedPhone.includes(qDigits));
      const matchNote = (rec.note || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchNote;
    });
  }, [manualCredits, searchQuery, statusFilter]);

  const filteredCaisseCredits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, '');
    return openCaisseCredits.filter((e) => {
      if (!q) return true;
      const nameMatch = (e.clientName || '').toLowerCase().includes(q);
      const phoneMatch =
        (e.clientPhone || '').toLowerCase().includes(q) ||
        (qDigits.length >= 3 && (e.clientPhone || '').replace(/\D+/g, '').includes(qDigits));
      return nameMatch || phoneMatch;
    });
  }, [openCaisseCredits, searchQuery]);

  const handleAddDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    const cleanPhone = newPhone.trim();
    const cleanAmt = Math.max(0, Number(newAmount) || 0);

    if (!cleanName || cleanPhone.replace(/\D+/g, '').length < 6 || cleanAmt <= 0) {
      showToast(
        pickLang(lang, {
          ar: 'أدخل اسم الزبون، رقم الهاتف الصحيح، ومبلغ الكريدي أولاً.',
          fr: 'Veuillez saisir le nom, un numéro valide et le montant dû.',
          amz: 'ⵙⴽⵛⵎ ⵉⵙⵎ, ⵓⵟⵟⵓⵏ ⴷ ⵓⵜⵉⴳ ⵏ ⵓⴽⵔⵉⴷⵉ.',
          en: 'Please enter client name, valid phone, and credit amount.',
          es: 'Ingresa nombre, teléfono válido y monto adeudado.',
        }),
        '',
        'warning'
      );
      return;
    }

    setAdding(true);
    try {
      await addManualClientCredit({
        clientName: cleanName,
        clientPhone: cleanPhone,
        amountOwedMAD: cleanAmt,
        creditDate: newCreditDate.trim() || undefined,
        note: newNote.trim(),
        createdBy: staffName,
      });
      setNewName('');
      setNewPhone('');
      setNewAmount('');
      setNewCreditDate('');
      setNewNote('');
      showToast(
        pickLang(lang, {
          ar: `تمت إضافة ${cleanName} (${cleanAmt} MAD) إلى قائمة الناس لي كانتسالهم ✓`,
          fr: `${cleanName} (${cleanAmt} MAD) ajouté au registre des crédits ✓`,
          amz: `ⵉⵜⵜⵓⵔⵏⴰ ${cleanName} (${cleanAmt} MAD) ✓`,
          en: `Added ${cleanName} (${cleanAmt} MAD) to Credit Registry ✓`,
          es: `${cleanName} (${cleanAmt} MAD) añadido al registro ✓`,
        }),
        '',
        'success'
      );
    } catch (err) {
      console.error('Failed to add client credit record:', err);
    } finally {
      setAdding(false);
    }
  };

  const handlePayManualCredit = async (record: ClientCreditRecord, fullAmount?: number) => {
    const payVal =
      typeof fullAmount === 'number'
        ? fullAmount
        : Math.max(0, Number(payAmountInput) || 0);
    if (payVal <= 0) return;

    setBusyId(record.id);
    try {
      await recordManualCreditPayment(record, payVal);
      setPayingId(null);
      setPayAmountInput('');
      showToast(
        payVal >= record.amountOwedMAD
          ? `تمت تسوية كريدي ${record.clientName} بالكامل ✓`
          : `تم تسجيل دفعة ${payVal} MAD من كريدي ${record.clientName} ✓`,
        '',
        'success'
      );
    } catch (err) {
      console.error('Failed to record manual credit payment:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleStartEdit = (rec: ClientCreditRecord) => {
    setEditingRecord(rec);
    setEditName(rec.clientName);
    setEditPhone(rec.clientPhone);
    setEditAmount(String(rec.amountOwedMAD));
    setEditCreditDate(rec.creditDate || rec.createdAt.slice(0, 10));
    setEditNote(rec.note || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setBusyId(editingRecord.id);
    try {
      await updateManualClientCredit(editingRecord.id, editingRecord, {
        clientName: editName.trim(),
        clientPhone: editPhone.trim(),
        amountOwedMAD: Math.max(0, Number(editAmount) || 0),
        creditDate: editCreditDate.trim(),
        note: editNote,
      });
      setEditingRecord(null);
      showToast('تم تحديث بيانات الكريدي ✓', '', 'success');
    } catch (err) {
      console.error('Failed to update manual credit:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteRecord = async (record: ClientCreditRecord) => {
    setBusyId(record.id);
    try {
      await deleteManualClientCredit(record.id);
      showToast(`تم حذف سجل ${record.clientName}`, '', 'info');
    } catch (err) {
      console.error('Failed to delete manual credit:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handlePayCaisseCredit = async (entry: CaisseEntry) => {
    setBusyId(entry.id);
    try {
      await recordCaisseCreditRepayment({
        creditEntry: entry,
        amountRepaidMAD: entry.creditRemainingMAD,
        repaidDate: getSalonBusinessDate(),
        actorRole: 'master',
        actorName: staffName,
      });
      showToast(`تمت تسوية كريدي الموعد (${entry.clientName || 'زبون'}) ✓`, '', 'success');
    } catch (err) {
      console.error('Failed to settle caisse credit:', err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5 pb-28">
      {/* Header + Summary KPIs */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-orange-300/80 dark:border-orange-500/35 border-s-4 border-s-orange-500 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <span>
                {pickLang(lang, {
                  ar: 'الناس لي كانتسالهم (سجل الكريدي الشامل)',
                  fr: 'Registre des Crédits Clients (الناس لي كانتسالهم)',
                  amz: 'ⵜⴰⵍⴳⴰⵎⵜ ⵏ ⵓⴽⵔⵉⴷⵉ ⵏ ⵉⵎⵙⵙⴰⵖⵏ',
                  en: 'Client Credits Registry (الناس لي كانتسالهم)',
                  es: 'Registro de Créditos de Clientes',
                })}
              </span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              سجّل هنا كل زبون عليه باقي أو كريدي (الاسم، الهاتف، المبلغ). أي زبون يدخل رقم هاتفه أثناء الحجز سيظهر تنبيه تلقائي بالكريدي المستحق عليه.
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 text-[11px] font-black flex items-center gap-1.5 self-start">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>خاص بـ Hassan ait boumlik</span>
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30">
            <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 block">
              إجمالي الكريدي المستحق
            </span>
            <span className="text-xl font-black font-mono tabular-nums text-orange-800 dark:text-orange-200">
              {grandTotalOwedMAD.toLocaleString('en-US')} MAD
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block">
              سجل الناس لي كانتسالهم
            </span>
            <span className="text-xl font-black font-mono tabular-nums text-zinc-900 dark:text-white">
              {totalManualOwedMAD.toLocaleString('en-US')} MAD
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block">
              كريدي مواعيد لاكيس
            </span>
            <span className="text-xl font-black font-mono tabular-nums text-zinc-900 dark:text-white">
              {totalCaisseOwedMAD.toLocaleString('en-US')} MAD
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block">
              عدد الملفات المفتوحة
            </span>
            <span className="text-xl font-black font-mono tabular-nums text-zinc-900 dark:text-white">
              {openManualCredits.length + openCaisseCredits.length}
            </span>
          </div>
        </div>
      </div>

      {/* Incoming Client Credit Disputes / Inquiries */}
      {creditDisputes.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-amber-300 dark:border-amber-500/40 shadow-sm space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 dark:border-zinc-800 pb-2.5">
            <div className="font-black text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>اعتراضات واستفسارات الزبناء على الكريدي ({creditDisputes.length})</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
              {creditDisputes.filter((d) => d.status !== 'resolved').length} قيد الانتظار
            </span>
          </div>

          <div className="space-y-2.5">
            {creditDisputes.map((disp) => {
              const isResolved = disp.status === 'resolved';
              const noteVal =
                disputeNoteDrafts[disp.id] !== undefined
                  ? disputeNoteDrafts[disp.id]
                  : disp.staffNote || '';
              return (
                <div
                  key={disp.id}
                  className={`p-3 rounded-xl border space-y-2 ${
                    isResolved
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-500/30 opacity-85'
                      : 'bg-amber-50/50 dark:bg-zinc-950/80 border-amber-200 dark:border-amber-500/35'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-zinc-900 dark:text-white text-sm">
                        {disp.clientName}
                      </span>
                      <span dir="ltr" className="font-mono text-zinc-600 dark:text-zinc-300 font-bold">
                        {disp.clientPhone}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-200 font-mono font-bold text-[10px]">
                        {disp.totalOwedSnapshotMAD} MAD · {disp.creditorSummary}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isResolved
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                            : disp.status === 'reviewed'
                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                            : 'bg-amber-200 dark:bg-amber-500/25 text-amber-900 dark:text-amber-200'
                        }`}
                      >
                        {isResolved ? 'تمت المعالجة ✓' : disp.status === 'reviewed' ? 'قيد المراجعة' : 'جديد'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {disp.createdAt.slice(0, 10)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
                    “{disp.message}”
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={noteVal}
                      onChange={(e) =>
                        setDisputeNoteDrafts((prev) => ({
                          ...prev,
                          [disp.id]: e.target.value,
                        }))
                      }
                      placeholder="ملاحظة الإدارة أو نتيجة المراجعة (اختياري)..."
                      className="flex-1 min-w-[200px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-white"
                    />
                    {!isResolved && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void updateCreditDisputeStatus(disp.id, {
                              status: 'reviewed',
                              staffNote: noteVal,
                              resolvedBy: staffName,
                            }).then(() => showToast('تم تحديث الحالة إلى قيد المراجعة', '', 'info'))
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/35 text-blue-700 dark:text-blue-300 font-bold cursor-pointer"
                        >
                          قيد المراجعة
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void updateCreditDisputeStatus(disp.id, {
                              status: 'resolved',
                              staffNote: noteVal,
                              resolvedBy: staffName,
                            }).then(() => showToast('تمت معالجة الاعتراض ✓', '', 'success'))
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer"
                        >
                          تمت المعالجة ✓
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteCreditDispute(disp.id)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Debtor Form */}
      <form
        onSubmit={handleAddDebtor}
        className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3 text-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
          <div className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <span>إضافة زبون جديد عليه كريدي</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setContactPickerOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-500/25"
            >
              <Users className="w-3.5 h-3.5" />
              <span>اختيار من الزبناء / المواعيد</span>
            </button>
            {supportsWebContactsApi && (
              <button
                type="button"
                onClick={handlePickFromPhoneContacts}
                className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/35 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>من جهات اتصال الهاتف</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-3">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              اسم الزبون الكامل *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مثال: كريم بنعلي"
              required
              className="w-full min-h-[40px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              رقم الهاتف *
            </label>
            <input
              type="tel"
              dir="ltr"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="06 00 00 00 00"
              required
              className="w-full min-h-[40px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              مبلغ الكريدي (MAD) *
            </label>
            <input
              type="number"
              min={1}
              step="1"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="35"
              required
              className="w-full min-h-[40px] bg-zinc-50 dark:bg-zinc-950 border border-orange-300 dark:border-orange-500/40 rounded-xl px-3 py-2 font-mono font-black text-zinc-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-zinc-400" />
              <span>تاريخ الكريدي (اختياري)</span>
            </label>
            <input
              type="date"
              value={newCreditDate}
              onChange={(e) => setNewCreditDate(e.target.value)}
              className="w-full min-h-[40px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 font-mono text-zinc-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              ملاحظة (إدارية فقط)
            </label>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="حسانة + لحية..."
              className="w-full min-h-[40px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-1">
            <button
              type="submit"
              disabled={adding}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black flex items-center justify-center gap-1 shadow-sm cursor-pointer disabled:opacity-60"
            >
              {adding ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span className="sm:hidden lg:inline">تسجيل</span>
            </button>
          </div>
        </div>
      </form>

      {/* Contact Picker Modal */}
      {contactPickerOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => setContactPickerOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-xl w-full max-h-[84vh] flex flex-col gap-3.5 shadow-2xl text-xs"
            >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
              <div className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <span>اختيار زبون من السجل والمواعيد</span>
              </div>
              <button
                type="button"
                onClick={() => setContactPickerOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الهاتف..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl ps-9 pe-3 py-2 text-zinc-900 dark:text-white"
              />
            </div>

            <div className="overflow-y-auto space-y-1.5 flex-1">
              {directoryContacts.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  لا توجد نتائج مطابقة.
                </div>
              ) : (
                directoryContacts.map((c) => (
                  <button
                    key={`${c.phone}-${c.name}`}
                    type="button"
                    onClick={() => {
                      setNewName(c.name);
                      setNewPhone(c.phone);
                      setContactPickerOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 hover:bg-amber-50 dark:hover:bg-amber-500/15 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-start cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-black text-zinc-900 dark:text-white truncate">
                        {c.name}
                      </div>
                      <div dir="ltr" className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {c.phone}
                      </div>
                    </div>
                    {c.visits > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 shrink-0">
                        {c.visits} زيارات
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Search & Filter Toolbar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو رقم الهاتف..."
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl ps-9 pe-3 py-2 text-xs text-zinc-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          {(
            [
              { id: 'open_all', label: `مفتوح (${openManualCredits.length})` },
              { id: 'paid', label: 'خالص ✓' },
              { id: 'all', label: `الكل (${manualCredits.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer transition-colors ${
                statusFilter === tab.id
                  ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-zinc-900 dark:border-amber-500'
                  : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop">
            <form
              onSubmit={handleSaveEdit}
              className="bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-3.5 text-xs shadow-2xl"
            >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
              <span className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                <span>تعديل سجل الكريدي</span>
              </span>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">الاسم</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">رقم الهاتف</label>
              <input
                type="tel"
                dir="ltr"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  المبلغ المتبقي (MAD)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-orange-300 dark:border-orange-500/40 rounded-xl px-3 py-2 font-mono font-black text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  تاريخ الكريدي (اختياري)
                </label>
                <input
                  type="date"
                  value={editCreditDate}
                  onChange={(e) => setEditCreditDate(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">ملاحظة (إدارية)</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busyId === editingRecord.id}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer"
              >
                حفظ التعديل ✓
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Manual Credits List */}
      <div className="space-y-2.5">
        {filteredManualCredits.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            لا توجد سجلات كريدي مطابقة في هذه القائمة حالياً.
          </div>
        ) : (
          filteredManualCredits.map((rec) => {
            const isPaid = rec.status === 'paid' || rec.amountOwedMAD <= 0;
            const displayDate = rec.creditDate || rec.createdAt.slice(0, 10);
            const waUrl = buildCreditWhatsAppReminderUrl({
              clientPhone: rec.clientPhone,
              clientName: rec.clientName,
              amountOwedMAD: rec.amountOwedMAD,
              creditorName: 'إدارة صالون بومليك (Hassan ait boumlik)',
              creditDate: displayDate,
              note: rec.note,
              lang,
            });
            const isPayingThis = payingId === rec.id;

            return (
              <div
                key={rec.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all text-xs space-y-2.5 ${
                  isPaid
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-500/30 opacity-85'
                    : 'bg-white dark:bg-[#141720] border-stone-200 dark:border-zinc-800 border-s-4 border-s-orange-500 shadow-2xs'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isPaid
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300'
                      }`}
                    >
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-zinc-900 dark:text-white truncate">
                          {rec.clientName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                              : rec.status === 'partial'
                              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                              : 'bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300'
                          }`}
                        >
                          {isPaid ? 'خالص ✓' : rec.status === 'partial' ? 'دفعة جزئية' : 'كريدي مفتوح'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        <span dir="ltr" className="font-mono font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {rec.clientPhone}
                        </span>
                        <span>·</span>
                        <span className="font-mono">{displayDate}</span>
                        {rec.note && (
                          <>
                            <span>·</span>
                            <span className="text-zinc-600 dark:text-zinc-300">{rec.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/30 font-mono font-black text-sm text-orange-800 dark:text-orange-200 tabular-nums">
                      {isPaid ? '0 MAD' : `${rec.amountOwedMAD} MAD`}
                    </div>

                    {!isPaid && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === rec.id}
                          onClick={() => handlePayManualCredit(rec, rec.amountOwedMAD)}
                          className="min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>خلص الكل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPayingId(isPayingThis ? null : rec.id);
                            setPayAmountInput('');
                          }}
                          className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 font-bold cursor-pointer"
                        >
                          دفعة جزئية
                        </button>
                      </>
                    )}

                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
                        title="تذكير مباشر عبر واتساب"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">واتساب</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStartEdit(rec)}
                      className="min-h-[34px] p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                      title="تعديل"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={busyId === rec.id}
                      onClick={() => handleDeleteRecord(rec)}
                      className="min-h-[34px] p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isPayingThis && !isPaid && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                    <span className="font-bold text-zinc-600 dark:text-zinc-300">
                      شحال عطا دابا (MAD):
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={rec.amountOwedMAD}
                      value={payAmountInput}
                      onChange={(e) => setPayAmountInput(e.target.value)}
                      placeholder={`أقصى مبلغ: ${rec.amountOwedMAD}`}
                      className="w-32 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-zinc-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={busyId === rec.id}
                      onClick={() => handlePayManualCredit(rec)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer"
                    >
                      تأكيد الدفعة ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayingId(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Unified Caisse Appointment Credits Section */}
      {filteredCaisseCredits.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <div className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>كريدي مسجل من المواعيد ولاكيس ({filteredCaisseCredits.length})</span>
            </div>
            <span className="font-mono font-black text-orange-700 dark:text-orange-300">
              {totalCaisseOwedMAD} MAD
            </span>
          </div>

          <div className="space-y-2">
            {filteredCaisseCredits.map((entry) => {
              const barberMeta = getCaisseBarberMeta(entry.barberId, roster);
              const waUrl = buildCreditWhatsAppReminderUrl({
                clientPhone: entry.clientPhone,
                clientName: entry.clientName,
                amountOwedMAD: entry.creditRemainingMAD,
                creditorName: barberMeta.arName,
                creditDate: entry.date,
                note: entry.note,
                lang,
              });
              return (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <span>{entry.clientName || 'زبون'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {barberMeta.arName}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                      {entry.clientPhone && <span dir="ltr">{entry.clientPhone}</span>}
                      <span>· {entry.date}</span>
                      {entry.sourceTicketNumber && <span>· {entry.sourceTicketNumber}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-orange-700 dark:text-orange-300">
                      {entry.creditRemainingMAD} MAD
                    </span>
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
                        title="تذكير عبر واتساب"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>واتساب</span>
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={busyId === entry.id}
                      onClick={() => handlePayCaisseCredit(entry)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تسوية في لاكيس</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
