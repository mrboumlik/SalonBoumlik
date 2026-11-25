import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardPaste,
  CreditCard,
  Edit3,
  FileUp,
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
import { AppointmentBooking, CaisseEntry, ClientCreditRecord, CreditSettlementRequest } from '../types';
import {
  addManualClientCredit,
  confirmCreditSettlementRequest,
  deleteCreditDispute,
  deleteCreditSettlementRequest,
  deleteManualClientCredit,
  getEffectiveManualCreditRemaining,
  recordManualCreditPayment,
  rejectCreditSettlementRequest,
  updateCreditDisputeStatus,
  updateManualClientCredit,
  useCreditDisputes,
  useCreditSettlementRequests,
  useManualClientCredits,
} from '../utils/creditRegistryStore';
import { normalizeMoroccanPhoneDigits, subscribeToBookings } from '../utils/bookingStore';
import { buildCrmClientSummaries, useCrmClients } from '../utils/crmStore';
import {
  deleteCaisseEntry,
  getCaisseBarberMeta,
  getCaisseBarbersFromRoster,
  getEffectiveCaisseCreditRemaining,
  getSalonBusinessDate,
  matchesCaisseBarber,
  recordCaisseCreditRepayment,
  updateCaisseEntry,
  useCaisseEntries,
} from '../utils/caisseStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import { buildCreditWhatsAppReminderUrl } from '../utils/whatsappAutomation';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { showToast } from '../utils/notifications';
import { ModalPortal } from './ModalPortal';
import { asDateString, asIsoString, asStr } from '../utils/safeCoerce';

function parseImportedContactText(rawText: string): {
  name: string;
  primaryPhone: string;
  extraPhones: string[];
} {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let vcardName = '';
  const foundPhones: string[] = [];
  const seenDigits = new Set<string>();

  const pushPhone = (candidate: string) => {
    const cleaned = candidate.replace(/[^\d+\s()-]/g, '').trim();
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length >= 6 && !seenDigits.has(digits)) {
      seenDigits.add(digits);
      foundPhones.push(cleaned);
    }
  };

  const isVcard = lines.some((l) => /^BEGIN:VCARD/i.test(l) || /^TEL[;:]/i.test(l));
  if (isVcard) {
    lines.forEach((line) => {
      if (/^FN:/i.test(line)) {
        vcardName = line.replace(/^FN:/i, '').trim();
      } else if (!vcardName && /^N[;:]/i.test(line)) {
        const parts = line
          .replace(/^N[^:]*:/i, '')
          .split(';')
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length > 0) vcardName = parts.reverse().join(' ').trim();
      } else if (/^TEL/i.test(line)) {
        const val = line.split(':').slice(1).join(':').trim();
        pushPhone(val);
      }
    });
  } else {
    const phoneMatches = rawText.match(/(?:\+|00)?[\d][\d\s().-]{5,18}\d/g) || [];
    phoneMatches.forEach((m) => pushPhone(m));
    const nonPhoneLines = lines
      .map((l) => l.replace(/(?:\+|00)?[\d][\d\s().-]{5,18}\d/g, '').replace(/[:\-–—|,]+$/g, '').trim())
      .filter((l) => l.length >= 2 && !/^(tel|phone|mobile|cell|هاتف|رقم)$/i.test(l));
    if (nonPhoneLines.length > 0) {
      vcardName = nonPhoneLines[0];
    }
  }

  return {
    name: vcardName.slice(0, 120),
    primaryPhone: foundPhones[0] || '',
    extraPhones: foundPhones.slice(1, 5),
  };
}

interface MasterClientCreditsPanelProps {
  staffName: string;
}

export const MasterClientCreditsPanel: React.FC<MasterClientCreditsPanelProps> = ({
  staffName,
}) => {
  const { lang } = useLanguage();
  const manualCredits = useManualClientCredits();
  const creditDisputes = useCreditDisputes();
  const settlementRequests = useCreditSettlementRequests();
  const caisseEntries = useCaisseEntries();
  const roster = useBarberRoster();
  const crmMap = useCrmClients();
  const [bookings, setBookings] = useState<AppointmentBooking[]>([]);

  const barberOptions = useMemo(
    () => getCaisseBarbersFromRoster(roster, caisseEntries),
    [roster, caisseEntries]
  );

  useEffect(() => subscribeToBookings(setBookings), []);

  // Dispute & settlement request drafts
  const [disputeNoteDrafts, setDisputeNoteDrafts] = useState<Record<string, string>>({});
  const [reqAmountDrafts, setReqAmountDrafts] = useState<Record<string, string>>({});
  const [reqNoteDrafts, setReqNoteDrafts] = useState<Record<string, string>>({});

  // Add new debtor form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAdditionalPhones, setNewAdditionalPhones] = useState<string[]>([]);
  const [newBarberId, setNewBarberId] = useState<string>('hassan');
  const [newAmount, setNewAmount] = useState('');
  const [newCreditDate, setNewCreditDate] = useState('');
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);

  // Contact Picker Modal state
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactPickerTab, setContactPickerTab] = useState<'directory' | 'import'>('directory');
  const [contactSearch, setContactSearch] = useState('');
  const [contactImportText, setContactImportText] = useState('');

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open_all' | 'all' | 'paid'>('open_all');
  const [barberFilter, setBarberFilter] = useState<string>('all');

  // Inline payment / edit / delete confirmation state
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmountInput, setPayAmountInput] = useState('');
  const [editingRecord, setEditingRecord] = useState<ClientCreditRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAdditionalPhones, setEditAdditionalPhones] = useState<string[]>([]);
  const [editBarberId, setEditBarberId] = useState<string>('hassan');
  const [editAmount, setEditAmount] = useState('');
  const [editCreditDate, setEditCreditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [confirmDeleteCredit, setConfirmDeleteCredit] = useState<ClientCreditRecord | null>(null);

  // Caisse-linked credit edit/delete confirmation state
  const [editingCaisseCredit, setEditingCaisseCredit] = useState<CaisseEntry | null>(null);
  const [editCaisseName, setEditCaisseName] = useState('');
  const [editCaissePhone, setEditCaissePhone] = useState('');
  const [editCaisseRemaining, setEditCaisseRemaining] = useState('');
  const [editCaisseDate, setEditCaisseDate] = useState('');
  const [editCaisseNote, setEditCaisseNote] = useState('');
  const [confirmDeleteCaisseCredit, setConfirmDeleteCaisseCredit] = useState<CaisseEntry | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  // Deduplicated directory of existing salon clients & booking contacts
  const directoryContacts = useMemo(() => {
    const byPhone = new Map<
      string,
      { name: string; phone: string; extraPhones: string[]; visits: number }
    >();
    const crmSummaries = buildCrmClientSummaries(bookings, crmMap);
    crmSummaries.forEach((c) => {
      const norm = normalizeMoroccanPhoneDigits(c.phoneDisplay) || c.phoneDisplay.replace(/\D/g, '');
      if (norm.length >= 6 && !byPhone.has(norm)) {
        byPhone.set(norm, {
          name: c.clientName,
          phone: c.phoneDisplay,
          extraPhones: [],
          visits: c.verifiedVisits,
        });
      }
    });
    manualCredits.forEach((rec) => {
      const norm =
        normalizeMoroccanPhoneDigits(rec.clientPhone) || rec.normalizedPhone || '';
      if (norm.length >= 6 && !byPhone.has(norm)) {
        byPhone.set(norm, {
          name: rec.clientName,
          phone: rec.clientPhone,
          extraPhones: rec.additionalPhones || [],
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
        const allPhones = [item.phone, ...item.extraPhones];
        const phoneMatch = allPhones.some((p) => {
          const normItem = p.replace(/\D/g, '');
          return p.toLowerCase().includes(q) || (qDigits.length >= 2 && normItem.includes(qDigits));
        });
        return nameMatch || phoneMatch;
      })
      .slice(0, 60);
  }, [bookings, crmMap, manualCredits, contactSearch]);

  const supportsWebContactsApi =
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof (navigator as unknown as { contacts?: { select?: unknown } }).contacts?.select === 'function';

  const handlePickFromPhoneContacts = async () => {
    if (!supportsWebContactsApi) {
      setContactPickerTab('import');
      setContactPickerOpen(true);
      return;
    }
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
      if (!navContacts?.select) {
        setContactPickerTab('import');
        setContactPickerOpen(true);
        return;
      }
      const picked = await navContacts.select(['name', 'tel'], { multiple: false });
      const first = picked?.[0];
      if (first) {
        const pickedName = first.name?.[0]?.trim() || '';
        const tels = (first.tel || []).map((t) => String(t || '').trim()).filter(Boolean);
        if (pickedName) setNewName(pickedName);
        if (tels[0]) setNewPhone(tels[0]);
        if (tels.length > 1) setNewAdditionalPhones(tels.slice(1, 5));
        setContactPickerOpen(false);
        showToast('تم استيراد بيانات جهة الاتصال ✓', '', 'success');
      }
    } catch (err) {
      console.warn('Web Contacts API pick cancelled or unsupported:', err);
      setContactPickerTab('import');
      setContactPickerOpen(true);
      showToast(
        'التقاط جهات الاتصال المباشر غير مدعوم هنا — استعمل اللصق أو ملف vCard (.vcf).',
        '',
        'info'
      );
    }
  };

  const applyImportedTextToForm = (rawText: string) => {
    const parsed = parseImportedContactText(rawText);
    if (!parsed.name && !parsed.primaryPhone) {
      showToast('لم يتم العثور على اسم أو رقم هاتف واضح في النص.', '', 'warning');
      return;
    }
    if (parsed.name) setNewName(parsed.name);
    if (parsed.primaryPhone) setNewPhone(parsed.primaryPhone);
    if (parsed.extraPhones.length > 0) setNewAdditionalPhones(parsed.extraPhones);
    setContactImportText('');
    setContactPickerOpen(false);
    showToast('تمت تعبئة الاسم والأرقام بنجاح ✓', '', 'success');
  };

  const handleVcfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      applyImportedTextToForm(text);
    } catch (err) {
      console.error('Failed to read vCard file:', err);
      showToast('تعذر قراءة ملف جهات الاتصال (.vcf).', '', 'warning');
    }
  };

  // Open Caisse-linked credits
  const openCaisseCredits = useMemo(
    () =>
      caisseEntries.filter(
        (e) => getEffectiveCaisseCreditRemaining(e) > 0
      ),
    [caisseEntries]
  );

  const openManualCredits = useMemo(
    () => manualCredits.filter((r) => getEffectiveManualCreditRemaining(r) > 0),
    [manualCredits]
  );

  const totalManualOwedMAD = useMemo(
    () =>
      Math.round(
        openManualCredits.reduce((sum, r) => sum + getEffectiveManualCreditRemaining(r), 0) * 100
      ) / 100,
    [openManualCredits]
  );

  const totalCaisseOwedMAD = useMemo(
    () =>
      Math.round(
        openCaisseCredits.reduce((sum, e) => sum + getEffectiveCaisseCreditRemaining(e), 0) * 100
      ) / 100,
    [openCaisseCredits]
  );

  const grandTotalOwedMAD = Math.round((totalManualOwedMAD + totalCaisseOwedMAD) * 100) / 100;

  const filteredManualCredits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, '');
    return manualCredits.filter((rec) => {
      if (
        barberFilter !== 'all' &&
        !matchesCaisseBarber(rec.barberId || 'hassan', rec.barberName, barberFilter, roster)
      ) {
        return false;
      }
      const effRem = getEffectiveManualCreditRemaining(rec);
      if (statusFilter === 'open_all' && effRem <= 0) {
        return false;
      }
      if (statusFilter === 'paid' && effRem > 0) {
        return false;
      }
      if (!q) return true;
      const matchName = asStr(rec.clientName, '').toLowerCase().includes(q);
      const allPhones = [rec.clientPhone, ...(Array.isArray(rec.additionalPhones) ? rec.additionalPhones : [])]
        .map((p) => asStr(p, ''))
        .filter(Boolean);
      const allNorms = [rec.normalizedPhone, ...(Array.isArray(rec.normalizedAdditionalPhones) ? rec.normalizedAdditionalPhones : [])]
        .map((p) => asStr(p, ''))
        .filter(Boolean);
      const matchPhone =
        allPhones.some((p) => p.toLowerCase().includes(q)) ||
        (qDigits.length >= 3 && allNorms.some((np) => np.includes(qDigits)));
      const matchNote = asStr(rec.note, '').toLowerCase().includes(q);
      const matchBarber = asStr(rec.barberName, '').toLowerCase().includes(q);
      return matchName || matchPhone || matchNote || matchBarber;
    });
  }, [manualCredits, searchQuery, statusFilter, barberFilter, roster]);

  const filteredCaisseCredits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, '');
    return openCaisseCredits.filter((e) => {
      if (
        barberFilter !== 'all' &&
        !matchesCaisseBarber(e.barberId, e.barberName, barberFilter, roster)
      ) {
        return false;
      }
      if (!q) return true;
      const nameMatch = (e.clientName || '').toLowerCase().includes(q);
      const barberMatch = (e.barberName || '').toLowerCase().includes(q);
      const phoneMatch =
        (e.clientPhone || '').toLowerCase().includes(q) ||
        (qDigits.length >= 3 && (e.clientPhone || '').replace(/\D+/g, '').includes(qDigits));
      return nameMatch || phoneMatch || barberMatch;
    });
  }, [openCaisseCredits, searchQuery, barberFilter, roster]);

  const handleAddDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    const cleanPhone = newPhone.trim();
    const extraPhonesClean = newAdditionalPhones.map((p) => p.trim()).filter(Boolean);
    const cleanAmt = Math.max(0, Number(newAmount) || 0);

    if (!cleanName || cleanAmt <= 0) {
      showToast(
        pickLang(lang, {
          ar: 'أدخل اسم الزبون ومبلغ الكريدي أولاً (رقم الهاتف اختياري).',
          fr: 'Veuillez saisir le nom et le montant dû (téléphone optionnel).',
          amz: 'ⵙⴽⵛⵎ ⵉⵙⵎ ⴷ ⵓⵜⵉⴳ ⵏ ⵓⴽⵔⵉⴷⵉ.',
          en: 'Please enter client name and credit amount (phone is optional).',
          es: 'Ingresa nombre y monto adeudado (teléfono opcional).',
        }),
        '',
        'warning'
      );
      return;
    }

    setAdding(true);
    try {
      const targetBarberId = newBarberId || 'hassan';
      const targetMeta = getCaisseBarberMeta(targetBarberId, roster);
      await addManualClientCredit({
        clientName: cleanName,
        clientPhone: cleanPhone,
        additionalPhones: extraPhonesClean,
        barberId: targetBarberId,
        barberName: targetMeta.arName,
        amountOwedMAD: cleanAmt,
        creditDate: newCreditDate.trim() || undefined,
        note: newNote.trim(),
        createdBy: staffName,
      });
      setNewName('');
      setNewPhone('');
      setNewAdditionalPhones([]);
      setNewAmount('');
      setNewCreditDate('');
      setNewNote('');
      showToast(
        pickLang(lang, {
          ar: `تمت إضافة ${cleanName} (${cleanAmt} MAD — ${targetMeta.arName}) إلى سجل الكريدي ✓`,
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
    setEditAdditionalPhones(rec.additionalPhones || []);
    setEditBarberId(rec.barberId || 'hassan');
    setEditAmount(String(rec.amountOwedMAD ?? 0));
    setEditCreditDate(asDateString(rec.creditDate, '') || asIsoString(rec.createdAt, '').slice(0, 10));
    setEditNote(rec.note || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setBusyId(editingRecord.id);
    try {
      const targetBarberId = editBarberId || 'hassan';
      const targetMeta = getCaisseBarberMeta(targetBarberId, roster);
      await updateManualClientCredit(editingRecord.id, editingRecord, {
        clientName: editName.trim(),
        clientPhone: editPhone.trim(),
        additionalPhones: editAdditionalPhones.map((p) => p.trim()).filter(Boolean),
        barberId: targetBarberId,
        barberName: targetMeta.arName,
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

  const handleConfirmDeleteRecord = async () => {
    if (!confirmDeleteCredit) return;
    const target = confirmDeleteCredit;
    setBusyId(target.id);
    try {
      await deleteManualClientCredit(target.id);
      setConfirmDeleteCredit(null);
      showToast(`تم حذف سجل ${target.clientName} ✓`, '', 'info');
    } catch (err) {
      console.error('Failed to delete manual credit:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenEditCaisseCredit = (entry: CaisseEntry) => {
    setEditingCaisseCredit(entry);
    setEditCaisseName(entry.clientName || '');
    setEditCaissePhone(entry.clientPhone || '');
    setEditCaisseRemaining(String(entry.creditRemainingMAD || 0));
    setEditCaisseDate(entry.date);
    setEditCaisseNote(entry.note || '');
  };

  const handleSaveEditCaisseCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCaisseCredit) return;
    const rem = Math.max(0, Number(editCaisseRemaining) || 0);
    setBusyId(editingCaisseCredit.id);
    try {
      await updateCaisseEntry(editingCaisseCredit.id, {
        clientName: editCaisseName.trim(),
        clientPhone: editCaissePhone.trim(),
        creditRemainingMAD: rem,
        creditStatus: rem <= 0 ? 'paid' : rem < editingCaisseCredit.creditAmountMAD ? 'partial' : 'open',
        date: editCaisseDate.trim() || editingCaisseCredit.date,
        note: editCaisseNote.trim(),
      });
      setEditingCaisseCredit(null);
      showToast('تم تعديل كريدي لاكيس ✓', '', 'success');
    } catch (err) {
      console.error('Failed to edit caisse credit:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDeleteCaisseCredit = async () => {
    if (!confirmDeleteCaisseCredit) return;
    const target = confirmDeleteCaisseCredit;
    setBusyId(target.id);
    try {
      await deleteCaisseEntry(target.id);
      setConfirmDeleteCaisseCredit(null);
      showToast(`تم حذف العملية من لاكيس (${target.clientName || 'زبون'}) ✓`, '', 'info');
    } catch (err) {
      console.error('Failed to delete caisse credit:', err);
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

      {/* Supervisor Incoming Credit Settlement Requests ("يخلص ولا يفك من الكريدي") */}
      {settlementRequests.length > 0 && (() => {
        const pendingReqs = settlementRequests.filter((r) => r.status === 'pending');
        const processedReqs = settlementRequests.filter((r) => r.status !== 'pending');
        const handleConfirmRequest = async (req: CreditSettlementRequest) => {
          const draftStr =
            reqAmountDrafts[req.id] !== undefined
              ? reqAmountDrafts[req.id]
              : String(req.requestedAmountMAD);
          const approvedAmt = Math.max(0, Number(draftStr) || 0);
          if (approvedAmt <= 0) {
            showToast('أدخل مبلغاً أكبر من 0 درهم للتأكيد.', '', 'warning');
            return;
          }
          setBusyId(req.id);
          try {
            const applied = await confirmCreditSettlementRequest({
              request: req,
              approvedAmountMAD: approvedAmt,
              reviewedBy: staffName,
              reviewerNote: reqNoteDrafts[req.id],
              caisseEntries,
              manualCredits,
            });
            showToast(
              req.actionType === 'pay'
                ? `تم تأكيد خلاص ${applied} MAD للزبون ${req.clientName} ✓`
                : `تم تأكيد فك ${applied} MAD من كريدي ${req.clientName} ✓`,
              '',
              'success'
            );
          } catch (err) {
            console.error('Failed to confirm settlement request:', err);
          } finally {
            setBusyId(null);
          }
        };

        const handleRejectRequest = async (req: CreditSettlementRequest) => {
          setBusyId(req.id);
          try {
            await rejectCreditSettlementRequest({
              requestId: req.id,
              reviewedBy: staffName,
              reviewerNote: reqNoteDrafts[req.id],
            });
            showToast(`تم نفي طلب ${req.clientName} ✓`, '', 'info');
          } catch (err) {
            console.error('Failed to reject settlement request:', err);
          } finally {
            setBusyId(null);
          }
        };

        return (
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-emerald-300 dark:border-emerald-500/40 shadow-sm space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 dark:border-zinc-800 pb-2.5">
              <div className="font-black text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>طلبات خلاص أو فك الكريدي (موافقة المشرف العام)</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                {pendingReqs.length} بانتظار القرار
              </span>
            </div>

            <div className="space-y-2.5">
              {[...pendingReqs, ...processedReqs.slice(0, 10)].map((req) => {
                const isPending = req.status === 'pending';
                const isPay = req.actionType === 'pay';
                const barberLabel =
                  req.barberName ||
                  (req.barberId
                    ? getCaisseBarberMeta(req.barberId, roster).arName
                    : 'كل الحلاقين / الصالون');
                const amountVal =
                  reqAmountDrafts[req.id] !== undefined
                    ? reqAmountDrafts[req.id]
                    : String(req.requestedAmountMAD);
                const noteVal =
                  reqNoteDrafts[req.id] !== undefined
                    ? reqNoteDrafts[req.id]
                    : req.reviewerNote || '';
                const roleLabel =
                  req.submittedRole === 'client'
                    ? 'طلب من الزبون'
                    : req.submittedRole === 'caisse'
                    ? 'من لاكيس'
                    : req.submittedRole === 'barber'
                    ? 'من الحلاق'
                    : 'من الإدارة';

                return (
                  <div
                    key={req.id}
                    className={`p-3 rounded-xl border space-y-2 ${
                      isPending
                        ? 'bg-emerald-50/50 dark:bg-zinc-950/80 border-emerald-200 dark:border-emerald-500/35'
                        : req.status === 'confirmed'
                        ? 'bg-emerald-50/25 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-500/25 opacity-85'
                        : 'bg-rose-50/35 dark:bg-rose-950/15 border-rose-200 dark:border-rose-500/25 opacity-85'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-black text-zinc-900 dark:text-white text-sm">
                          {req.clientName}
                        </span>
                        {req.clientPhone && (
                          <span dir="ltr" className="font-mono text-zinc-600 dark:text-zinc-300 font-bold">
                            {req.clientPhone}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            isPay
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {isPay ? 'يخلص الكريدي (أداء)' : 'يفك من الكريدي (إسقاط/تسوية)'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold">
                          الحلاق: {barberLabel}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                          {roleLabel} ({req.submittedBy})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-orange-700 dark:text-orange-300">
                          المطلوب: {req.requestedAmountMAD} MAD
                        </span>
                        {!isPending && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              req.status === 'confirmed'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {req.status === 'confirmed'
                              ? `تم التأكيد ✓ (${req.approvedAmountMAD ?? req.requestedAmountMAD} MAD)`
                              : 'تم النفي ✕'}
                          </span>
                        )}
                      </div>
                    </div>

                    {req.note && (
                      <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {req.note}
                      </div>
                    )}

                    {isPending ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            تعديل المبلغ (MAD):
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={Math.max(req.originalRemainingMAD || 10000, req.requestedAmountMAD || 10000)}
                            value={amountVal}
                            onChange={(e) =>
                              setReqAmountDrafts((prev) => ({
                                ...prev,
                                [req.id]: e.target.value,
                              }))
                            }
                            className="w-24 bg-white dark:bg-zinc-950 border border-emerald-300 dark:border-emerald-500/40 rounded-lg px-2 py-1.5 font-mono font-black text-zinc-900 dark:text-white"
                          />
                        </div>

                        <input
                          type="text"
                          value={noteVal}
                          onChange={(e) =>
                            setReqNoteDrafts((prev) => ({
                              ...prev,
                              [req.id]: e.target.value,
                            }))
                          }
                          placeholder="ملاحظة المشرف (اختياري)..."
                          className="flex-1 min-w-[160px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-white"
                        />

                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => handleConfirmRequest(req)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>تأكيد ({amountVal || 0} MAD)</span>
                        </button>

                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => handleRejectRequest(req)}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>نفي</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span>
                          بواسطة: {req.reviewedBy || staffName} · {(asIsoString(req.reviewedAt, '') || asIsoString(req.updatedAt, '')).slice(0, 10)}
                          {req.reviewerNote ? ` · ${req.reviewerNote}` : ''}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => void deleteCreditSettlementRequest(req.id)}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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
                      {asIsoString(disp.createdAt, '').slice(0, 10)}
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
              onClick={() => {
                setContactPickerTab('directory');
                setContactPickerOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-500/25"
            >
              <Users className="w-3.5 h-3.5" />
              <span>اختيار من الزبناء / المواعيد</span>
            </button>
            <button
              type="button"
              onClick={handlePickFromPhoneContacts}
              className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/35 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/25"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{supportsWebContactsApi ? 'من جهات اتصال الهاتف' : 'استيراد جهة اتصال / vCard'}</span>
            </button>
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
              رقم الهاتف (اختياري)
            </label>
            <input
              type="tel"
              dir="ltr"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="بدون هاتف أو 06..."
              className="w-full min-h-[40px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              تابع لـ (الحلاق / الإدارة)
            </label>
            <select
              value={newBarberId}
              onChange={(e) => setNewBarberId(e.target.value)}
              className="w-full min-h-[40px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 font-bold text-zinc-900 dark:text-white"
            >
              {barberOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.isOwner ? `${b.arName} (الإدارة)` : b.arName}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              المبلغ (MAD) *
            </label>
            <input
              type="number"
              min={1}
              step="1"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="35"
              required
              className="w-full min-h-[40px] bg-zinc-50 dark:bg-zinc-950 border border-orange-300 dark:border-orange-500/40 rounded-xl px-2.5 py-2 font-mono font-black text-zinc-900 dark:text-white"
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

          <div className="sm:col-span-1">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              ملاحظة
            </label>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="حسانة..."
              className="w-full min-h-[40px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 text-zinc-900 dark:text-white"
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

        {/* Multi-phone quick add row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {newAdditionalPhones.map((extraVal, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2 py-1"
            >
              <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
              <input
                type="tel"
                dir="ltr"
                value={extraVal}
                onChange={(e) =>
                  setNewAdditionalPhones((prev) =>
                    prev.map((item, i) => (i === idx ? e.target.value : item))
                  )
                }
                placeholder={`رقم إضافي ${idx + 2}`}
                className="w-32 bg-transparent font-mono text-zinc-900 dark:text-white outline-none text-[11px]"
              />
              <button
                type="button"
                onClick={() =>
                  setNewAdditionalPhones((prev) => prev.filter((_, i) => i !== idx))
                }
                className="p-0.5 text-zinc-400 hover:text-rose-500 cursor-pointer"
                title="إزالة الرقم"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {newAdditionalPhones.length < 4 && (
            <button
              type="button"
              onClick={() => setNewAdditionalPhones((prev) => [...prev, ''])}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>إضافة رقم هاتف آخر للزبون</span>
            </button>
          )}
        </div>
      </form>

      {/* Contact Picker & Import Fallback Modal */}
      {contactPickerOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop"
            onClick={() => setContactPickerOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-xl w-full max-h-[86vh] flex flex-col gap-3.5 shadow-2xl text-xs"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                <div className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  <span>اختيار أو استيراد بيانات الزبون</span>
                </div>
                <button
                  type="button"
                  onClick={() => setContactPickerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Tabs: CRM Directory vs Contact Import Fallback */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContactPickerTab('directory')}
                  className={`py-2 px-3 rounded-xl font-black border flex items-center justify-center gap-1.5 cursor-pointer ${
                    contactPickerTab === 'directory'
                      ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-zinc-900 dark:border-amber-500'
                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>سجل الصالون ({directoryContacts.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContactPickerTab('import')}
                  className={`py-2 px-3 rounded-xl font-black border flex items-center justify-center gap-1.5 cursor-pointer ${
                    contactPickerTab === 'import'
                      ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-zinc-900 dark:border-amber-500'
                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>لصق نص / ملف vCard</span>
                </button>
              </div>

              {contactPickerTab === 'directory' ? (
                <>
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
                            setNewAdditionalPhones(c.extraPhones || []);
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
                              {c.extraPhones.length > 0 ? ` · +${c.extraPhones.length}` : ''}
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
                </>
              ) : (
                <div className="space-y-3 overflow-y-auto">
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    يمكنك مشاركة أو نسخ جهة الاتصال من هاتفك (الاسم مع رقم أو عدة أرقام) ولصقها هنا، أو رفع ملف <span dir="ltr" className="font-mono font-bold">.vcf</span> ليتم استخراج الاسم والأرقام تلقائياً.
                  </p>

                  {supportsWebContactsApi && (
                    <button
                      type="button"
                      onClick={handlePickFromPhoneContacts}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/35 text-blue-700 dark:text-blue-300 font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>فتح جهات اتصال الهاتف مباشرة</span>
                    </button>
                  )}

                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      لصق نص جهة الاتصال (اسم + أرقام الهاتف):
                    </label>
                    <textarea
                      rows={4}
                      value={contactImportText}
                      onChange={(e) => setContactImportText(e.target.value)}
                      placeholder={'مثال:\nكريم التارودانتي\n0612345678\n0699887766'}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold inline-flex items-center gap-1.5 cursor-pointer">
                      <FileUp className="w-3.5 h-3.5 text-amber-500" />
                      <span>استيراد ملف vCard (.vcf)</span>
                      <input
                        type="file"
                        accept=".vcf,text/vcard,text/x-vcard"
                        onChange={handleVcfFileUpload}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={!contactImportText.trim()}
                      onClick={() => applyImportedTextToForm(contactImportText)}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer disabled:opacity-50"
                    >
                      استخراج وتعبئة الحقول ✓
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Search & Filter Toolbar (includes per-barber filter for Supervisor Hassan) */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 space-y-2.5 text-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف أو الحلاق..."
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

        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <span className="font-bold text-zinc-500 dark:text-zinc-400 text-[11px] me-1">
            تصفية حسب الحلاق:
          </span>
          <button
            type="button"
            onClick={() => setBarberFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer text-[11px] ${
              barberFilter === 'all'
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            جميع الحلاقين ({openManualCredits.length + openCaisseCredits.length})
          </button>
          {barberOptions.map((b) => {
            const countForB =
              openManualCredits.filter((r) => (r.barberId || 'hassan') === b.id).length +
              openCaisseCredits.filter((e) => e.barberId === b.id).length;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setBarberFilter(b.id)}
                className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer text-[11px] ${
                  barberFilter === b.id
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {b.arName} ({countForB})
              </button>
            );
          })}
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
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                رقم الهاتف الأساسي (اختياري)
              </label>
              <input
                type="tel"
                dir="ltr"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="اختياري..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  أرقام هاتف إضافية (اختياري)
                </label>
                {editAdditionalPhones.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setEditAdditionalPhones((prev) => [...prev, ''])}
                    className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>إضافة رقم</span>
                  </button>
                )}
              </div>
              {editAdditionalPhones.map((extraVal, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="tel"
                    dir="ltr"
                    value={extraVal}
                    onChange={(e) =>
                      setEditAdditionalPhones((prev) =>
                        prev.map((item, i) => (i === idx ? e.target.value : item))
                      )
                    }
                    placeholder={`رقم إضافي ${idx + 2}`}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 font-mono text-zinc-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditAdditionalPhones((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
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
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                تابع لـ (الحلاق / الإدارة)
              </label>
              <select
                value={editBarberId}
                onChange={(e) => setEditBarberId(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-bold text-zinc-900 dark:text-white"
              >
                {barberOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.isOwner ? `${b.arName} (الإدارة)` : b.arName}
                  </option>
                ))}
              </select>
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

      {/* Delete Manual Credit Confirmation Modal */}
      {confirmDeleteCredit && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sb-modal-backdrop">
            <div className="bg-white dark:bg-[#141720] border border-rose-300 dark:border-rose-500/40 rounded-2xl p-5 max-w-sm w-full space-y-3.5 text-xs shadow-2xl">
              <div className="font-black text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>تأكيد حذف سجل الكريدي</span>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                هل أنت متأكد من حذف سجل الكريدي الخاص بالزبون{' '}
                <strong>{confirmDeleteCredit.clientName}</strong> بمبلغ{' '}
                <strong dir="ltr">{confirmDeleteCredit.amountOwedMAD} MAD</strong>؟
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCredit(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={busyId === confirmDeleteCredit.id}
                  onClick={handleConfirmDeleteRecord}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer"
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Edit Caisse Credit Modal */}
      {editingCaisseCredit && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop">
            <form
              onSubmit={handleSaveEditCaisseCredit}
              className="bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-3.5 text-xs shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
                <span className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-500" />
                  <span>تعديل كريدي لاكيس</span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingCaisseCredit(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">اسم الزبون</label>
                <input
                  type="text"
                  value={editCaisseName}
                  onChange={(e) => setEditCaisseName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={editCaissePhone}
                  onChange={(e) => setEditCaissePhone(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    الكريدي المتبقي (MAD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editCaisseRemaining}
                    onChange={(e) => setEditCaisseRemaining(e.target.value)}
                    required
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-orange-300 dark:border-orange-500/40 rounded-xl px-3 py-2 font-mono font-black text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">التاريخ</label>
                  <input
                    type="date"
                    value={editCaisseDate}
                    onChange={(e) => setEditCaisseDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">ملاحظة</label>
                <input
                  type="text"
                  value={editCaisseNote}
                  onChange={(e) => setEditCaisseNote(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCaisseCredit(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busyId === editingCaisseCredit.id}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer"
                >
                  حفظ التعديل ✓
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Delete Caisse Credit Confirmation Modal */}
      {confirmDeleteCaisseCredit && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sb-modal-backdrop">
            <div className="bg-white dark:bg-[#141720] border border-rose-300 dark:border-rose-500/40 rounded-2xl p-5 max-w-sm w-full space-y-3.5 text-xs shadow-2xl">
              <div className="font-black text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>تأكيد حذف عملية الكريدي من لاكيس</span>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                سيتم حذف هذه العملية نهائياً للزبون{' '}
                <strong>{confirmDeleteCaisseCredit.clientName || 'زبون'}</strong> ({confirmDeleteCaisseCredit.creditRemainingMAD} MAD). هل تود المتابعة؟
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCaisseCredit(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={busyId === confirmDeleteCaisseCredit.id}
                  onClick={handleConfirmDeleteCaisseCredit}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer"
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
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
            const displayDate = asDateString(rec.creditDate, '') || asIsoString(rec.createdAt, '').slice(0, 10);
            const assignedBarberId = rec.barberId || 'hassan';
            const assignedBarberMeta = getCaisseBarberMeta(assignedBarberId, roster);
            const allPhones = [rec.clientPhone, ...(Array.isArray(rec.additionalPhones) ? rec.additionalPhones : [])]
              .map((p) => String(p || '').trim())
              .filter(Boolean);
            const primaryWaPhone = allPhones[0] || '';
            const waUrl = buildCreditWhatsAppReminderUrl({
              clientPhone: primaryWaPhone,
              clientName: rec.clientName,
              amountOwedMAD: rec.amountOwedMAD,
              creditorName:
                assignedBarberId === 'hassan'
                  ? 'إدارة صالون بومليك (Hassan ait boumlik)'
                  : assignedBarberMeta.arName,
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
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-[10px] font-black">
                          الحلاق: {rec.barberName || assignedBarberMeta.arName}
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
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {allPhones.length > 0 ? (
                          allPhones.map((ph, idx) => (
                            <span
                              key={`${ph}-${idx}`}
                              dir="ltr"
                              className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 font-mono font-bold text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              {ph}
                            </span>
                          ))
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-[10px] text-zinc-500">
                            بدون رقم هاتف
                          </span>
                        )}
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
                      onClick={() => setConfirmDeleteCredit(rec)}
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
                  <div className="flex items-center gap-1.5 flex-wrap">
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
                    <button
                      type="button"
                      onClick={() => handleOpenEditCaisseCredit(entry)}
                      className="p-1.5 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 cursor-pointer"
                      title="تعديل"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busyId === entry.id}
                      onClick={() => setConfirmDeleteCaisseCredit(entry)}
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
    </div>
  );
};
