import React, { useState } from 'react';
import {
  Archive,
  Check,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { BarberColorKey, RosterMemberAccount } from '../types';
import { COLOR_KEY_OPTIONS, getBarberIdentityTokens } from '../utils/barberIdentity';
import {
  addRosterBarber,
  adminSetMemberPin,
  deleteRosterMember,
  getActiveRosterBarbers,
  getArchivedRosterBarbers,
  getCaisseRosterAccount,
  replaceRosterBarber,
  updateRosterMember,
  useBarberRoster,
} from '../utils/barberRosterStore';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { showToast } from '../utils/notifications';
import { ModalPortal } from './ModalPortal';

interface MasterTeamAccessPanelProps {
  staffName: string;
}

function toMoroccanDigits9(raw: string): string {
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

export const MasterTeamAccessPanel: React.FC<MasterTeamAccessPanelProps> = ({
  staffName,
}) => {
  const { lang } = useLanguage();
  const roster = useBarberRoster();

  const activeBarbers = getActiveRosterBarbers(roster);
  const archivedBarbers = getArchivedRosterBarbers(roster);
  const caisseAccount = getCaisseRosterAccount(roster);
  const allActiveAccounts: RosterMemberAccount[] = [...activeBarbers, caisseAccount];

  // Inline PIN editor states
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [pinDraft, setPinDraft] = useState<string>('');
  const [pinSavingId, setPinSavingId] = useState<string | null>(null);

  // Add Barber form state
  const [addNameAr, setAddNameAr] = useState('');
  const [addNameFr, setAddNameFr] = useState('');
  const [addNameEn, setAddNameEn] = useState('');
  const [addPin, setAddPin] = useState('');
  const [addPhoneDigits, setAddPhoneDigits] = useState('');
  const [addColorKey, setAddColorKey] = useState<BarberColorKey>('teal');
  const [addingBusy, setAddingBusy] = useState(false);

  // Replace Barber form state
  const replaceableBarbers = activeBarbers.filter((m) => m.role === 'barber');
  const [replaceTargetId, setReplaceTargetId] = useState<string>(
    replaceableBarbers[0]?.id || ''
  );
  const [repNameAr, setRepNameAr] = useState('');
  const [repNameFr, setRepNameFr] = useState('');
  const [repNameEn, setRepNameEn] = useState('');
  const [repPin, setRepPin] = useState('');
  const [repPhoneDigits, setRepPhoneDigits] = useState('');
  const [repColorKey, setRepColorKey] = useState<BarberColorKey>('indigo');
  const [replacingBusy, setReplacingBusy] = useState(false);

  const [showArchived, setShowArchived] = useState(false);

  // Full Edit & Delete Member Modal State
  const [editingMember, setEditingMember] = useState<RosterMemberAccount | null>(null);
  const [editMemberNameAr, setEditMemberNameAr] = useState('');
  const [editMemberNameFr, setEditMemberNameFr] = useState('');
  const [editMemberNameEn, setEditMemberNameEn] = useState('');
  const [editMemberPin, setEditMemberPin] = useState('');
  const [editMemberPhone, setEditMemberPhone] = useState('');
  const [editMemberColor, setEditMemberColor] = useState<BarberColorKey>('amber');
  const [editMemberStatus, setEditMemberStatus] = useState<'active' | 'archived'>('active');
  const [editMemberBusy, setEditMemberBusy] = useState(false);

  const [confirmDeleteMember, setConfirmDeleteMember] = useState<RosterMemberAccount | null>(null);
  const [deleteMemberBusy, setDeleteMemberBusy] = useState(false);

  const openEditMemberModal = (member: RosterMemberAccount) => {
    setEditingMember(member);
    setEditMemberNameAr(member.nameAr || '');
    setEditMemberNameFr(member.nameFr || '');
    setEditMemberNameEn(member.nameEn || member.nameFr || '');
    setEditMemberPin(member.pin || '');
    setEditMemberPhone(member.defaultPhone || '');
    setEditMemberColor(member.colorKey);
    setEditMemberStatus(member.status);
  };

  const handleSaveEditedMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setEditMemberBusy(true);
    try {
      const updated = await updateRosterMember({
        memberId: editingMember.id,
        nameAr: editMemberNameAr,
        nameFr: editMemberNameFr,
        nameEn: editMemberNameEn,
        pin: editMemberPin,
        colorKey: editMemberColor,
        phone: editMemberPhone,
        status: editMemberStatus,
        updatedBy: staffName,
        roster,
      });
      setEditingMember(null);
      showToast(`تم تحديث بيانات حساب "${updated.nameAr}" ✓`, '', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تعديل الحساب', '', 'warning');
    } finally {
      setEditMemberBusy(false);
    }
  };

  const handleConfirmDeleteMember = async () => {
    if (!confirmDeleteMember) return;
    const target = confirmDeleteMember;
    setDeleteMemberBusy(true);
    try {
      await deleteRosterMember(target.id, roster);
      setConfirmDeleteMember(null);
      showToast(`تم حذف حساب "${target.nameAr}" ✓`, '', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر حذف الحساب', '', 'warning');
    } finally {
      setDeleteMemberBusy(false);
    }
  };

  const handleRestoreArchivedMember = async (member: RosterMemberAccount) => {
    try {
      await updateRosterMember({
        memberId: member.id,
        status: 'active',
        updatedBy: staffName,
        roster,
      });
      showToast(`تمت استعادة حساب "${member.nameAr}" ✓`, '', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر استعادة الحساب', '', 'warning');
    }
  };

  const handleSavePin = async (member: RosterMemberAccount) => {
    setPinSavingId(member.id);
    try {
      await adminSetMemberPin({
        memberId: member.id,
        newPin: pinDraft,
        updatedBy: staffName,
        roster,
      });
      setEditingPinId(null);
      setPinDraft('');
      showToast(
        pickLang(lang, {
          ar: `تم تحديث كلمة مرور ${member.nameAr} ✓`,
          fr: `Code PIN mis à jour pour ${member.nameFr} ✓`,
          amz: `ⵉⵜⵜⵓⵙⵎⴰⵢⵏⵓ ⵓⵣⵎⵣ ⵏ ${member.nameAr} ✓`,
          en: `Updated PIN for ${member.nameFr} ✓`,
          es: `PIN actualizado para ${member.nameFr} ✓`,
        }),
        '',
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر تحديث كلمة المرور',
        '',
        'warning'
      );
    } finally {
      setPinSavingId(null);
    }
  };

  const handleAddBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingBusy(true);
    try {
      const created = await addRosterBarber({
        nameAr: addNameAr,
        nameFr: addNameFr,
        nameEn: addNameEn || addNameFr,
        pin: addPin,
        colorKey: addColorKey,
        phone: addPhoneDigits ? `+212 ${addPhoneDigits}` : undefined,
        updatedBy: staffName,
        roster,
      });
      setAddNameAr('');
      setAddNameFr('');
      setAddNameEn('');
      setAddPin('');
      setAddPhoneDigits('');
      showToast(
        pickLang(lang, {
          ar: `تمت إضافة الحلاق "${created.nameAr}" وتفعيله فوراً ✓`,
          fr: `Barbier "${created.nameFr}" ajouté et activé ✓`,
          amz: `ⵉⵜⵜⵓⵔⵏⴰ "${created.nameAr}" ✓`,
          en: `Barber "${created.nameFr}" added and activated ✓`,
          es: `Barbero "${created.nameFr}" añadido y activado ✓`,
        }),
        '',
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إضافة الحلاق',
        '',
        'warning'
      );
    } finally {
      setAddingBusy(false);
    }
  };

  const handleReplaceBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = replaceTargetId || replaceableBarbers[0]?.id;
    if (!targetId) {
      showToast('لا يوجد حلاق نشط متاح للاستبدال.', '', 'warning');
      return;
    }
    setReplacingBusy(true);
    try {
      const { archived, created } = await replaceRosterBarber({
        oldBarberId: targetId,
        nameAr: repNameAr,
        nameFr: repNameFr,
        nameEn: repNameEn || repNameFr,
        pin: repPin,
        colorKey: repColorKey,
        phone: repPhoneDigits ? `+212 ${repPhoneDigits}` : undefined,
        updatedBy: staffName,
        roster,
      });
      setRepNameAr('');
      setRepNameFr('');
      setRepNameEn('');
      setRepPin('');
      setRepPhoneDigits('');
      setReplaceTargetId(created.id);
      showToast(
        pickLang(lang, {
          ar: `تم استبدال "${archived.nameAr}" بالحلاق "${created.nameAr}" ✓`,
          fr: `"${archived.nameFr}" remplacé par "${created.nameFr}" ✓`,
          amz: `ⵉⵜⵜⵓⵙⵏⴼⵍ "${archived.nameAr}" ⵙ "${created.nameAr}" ✓`,
          en: `Replaced "${archived.nameFr}" with "${created.nameFr}" ✓`,
          es: `Reemplazado "${archived.nameFr}" por "${created.nameFr}" ✓`,
        }),
        'تم حفظ الأرشيف التاريخي والسجلات القديمة بالكامل.',
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر استبدال الحلاق',
        '',
        'warning'
      );
    } finally {
      setReplacingBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-28">
      {/* Section A: Staff Passwords & PINs (Including Shared Caisse Account) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-amber-300/80 dark:border-amber-500/35 border-s-4 border-s-amber-600 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>كلمات المرور وحسابات الفريق ولاكيس</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              إدارة رموز الدخول (PIN) لجميع الحلاقين، المشرف العام، وحساب لاكيس المشترك.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold">
            {activeBarbers.length} حلاقين نشطين + لاكيس
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {allActiveAccounts.map((member) => {
            const isCaisse = member.role === 'caisse';
            const tone = getBarberIdentityTokens(
              member.id,
              member.nameAr,
              member.colorKey
            );
            const isRevealed = Boolean(revealedIds[member.id]);
            const isEditing = editingPinId === member.id;

            return (
              <div
                key={member.id}
                className={`p-3.5 rounded-xl border bg-zinc-50/70 dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800 space-y-2.5 ${
                  isCaisse ? 'border-s-4 border-s-slate-500' : tone.borderLeftClass
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isCaisse ? (
                        <Wallet className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
                      ) : (
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tone.dotClass}`} />
                      )}
                      <span className="font-black text-zinc-900 dark:text-white truncate">
                        {member.nameAr}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          member.role === 'master'
                            ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                            : isCaisse
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                            : tone.badgeClass
                        }`}
                      >
                        {member.role === 'master'
                          ? 'المشرف العام'
                          : isCaisse
                          ? 'حساب لاكيس المشترك'
                          : 'حلاق'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {member.nameFr}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      dir="ltr"
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-mono font-black text-zinc-900 dark:text-white"
                    >
                      {isRevealed ? member.pin : '••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedIds((p) => ({ ...p, [member.id]: !p[member.id] }))
                      }
                      className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                      title={isRevealed ? 'إخفاء' : 'إظهار'}
                    >
                      {isRevealed ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/80 dark:border-zinc-800">
                    <input
                      type="text"
                      dir="ltr"
                      value={pinDraft}
                      onChange={(e) => setPinDraft(e.target.value)}
                      placeholder="كلمة المرور الجديدة"
                      maxLength={24}
                      className="flex-1 bg-white dark:bg-zinc-900 border border-amber-400 rounded-lg px-2.5 py-1.5 font-mono font-bold text-zinc-900 dark:text-white outline-none"
                    />
                    <button
                      type="button"
                      disabled={pinSavingId === member.id}
                      onClick={() => handleSavePin(member)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1 cursor-pointer"
                    >
                      {pinSavingId === member.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>حفظ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPinId(null);
                        setPinDraft('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditMemberModal(member)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>تعديل الحساب</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPinId(member.id);
                        setPinDraft(member.pin);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3 text-amber-400" />
                      <span>تغيير كلمة المرور</span>
                    </button>
                    {member.role === 'barber' && member.id !== 'hassan' && member.id !== 'caisse_register' && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMember(member)}
                        className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 cursor-pointer"
                        title="حذف الحساب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section B & C: Add New Barber & Replace Departing Barber */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Add New Barber */}
        <form
          onSubmit={handleAddBarber}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3.5 text-xs"
        >
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>إضافة حلاق جديد (Add Barber)</span>
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              يظهر الحلاق الجديد فوراً في صفحة الحجز، لاكيس، جدول العمل، وإدارة الملفات.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                الاسم بالعربية *
              </label>
              <input
                type="text"
                required
                value={addNameAr}
                onChange={(e) => setAddNameAr(e.target.value)}
                placeholder="مثال: يوسف بنعلي"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                الاسم بالفرنسية / اللاتينية *
              </label>
              <input
                type="text"
                dir="ltr"
                required
                value={addNameFr}
                onChange={(e) => setAddNameFr(e.target.value)}
                placeholder="Youssef Benali"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                كلمة المرور الأولية (PIN) *
              </label>
              <input
                type="text"
                dir="ltr"
                required
                minLength={3}
                maxLength={24}
                value={addPin}
                onChange={(e) => setAddPin(e.target.value)}
                placeholder="مثال: 4545"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono font-bold text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                الهاتف (اختياري)
              </label>
              <div
                dir="ltr"
                className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-hidden"
              >
                <span className="px-2.5 py-2 bg-zinc-100 dark:bg-zinc-900 border-e border-zinc-200 dark:border-zinc-800 font-mono font-bold text-zinc-600 dark:text-zinc-300 select-none">
                  +212
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  value={addPhoneDigits}
                  onChange={(e) => setAddPhoneDigits(toMoroccanDigits9(e.target.value))}
                  placeholder="612345678"
                  className="w-full bg-transparent px-2.5 py-2 font-mono text-zinc-900 dark:text-white outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              لون التمييز الهادئ:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_KEY_OPTIONS.map((preset) => {
                const selected = addColorKey === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setAddColorKey(preset.key)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      selected
                        ? preset.activeTabClass
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selected ? 'bg-current' : preset.dotClass
                      }`}
                    />
                    <span>{preset.labelAr}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={addingBusy}
            className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {addingBusy ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span>إضافة وتفعيل الحلاق فوراً</span>
          </button>
        </form>

        {/* Replace Departing Barber */}
        <form
          onSubmit={handleReplaceBarber}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3.5 text-xs"
        >
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>استبدال حلاق (Replace Barber)</span>
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              يؤرشف الحلاق المغادر دون مسح سجلاته أو أرشيفه التاريخي، ويفعّل الحلاق البديل مكانه.
            </p>
          </div>

          <div>
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              الحلاق الذي سيغادر:
            </label>
            <select
              value={replaceTargetId || replaceableBarbers[0]?.id || ''}
              onChange={(e) => setReplaceTargetId(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 font-bold text-zinc-900 dark:text-white"
            >
              {replaceableBarbers.length === 0 ? (
                <option value="">لا يوجد حلاق متاح</option>
              ) : (
                replaceableBarbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nameAr} ({b.nameFr})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                اسم البديل بالعربية *
              </label>
              <input
                type="text"
                required
                value={repNameAr}
                onChange={(e) => setRepNameAr(e.target.value)}
                placeholder="مثال: كريم العلمي"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                الاسم بالفرنسية / اللاتينية *
              </label>
              <input
                type="text"
                dir="ltr"
                required
                value={repNameFr}
                onChange={(e) => setRepNameFr(e.target.value)}
                placeholder="Karim Alami"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                كلمة مرور البديل (PIN) *
              </label>
              <input
                type="text"
                dir="ltr"
                required
                minLength={3}
                maxLength={24}
                value={repPin}
                onChange={(e) => setRepPin(e.target.value)}
                placeholder="مثال: 6767"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono font-bold text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                الهاتف (اختياري)
              </label>
              <div
                dir="ltr"
                className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-hidden"
              >
                <span className="px-2.5 py-2 bg-zinc-100 dark:bg-zinc-900 border-e border-zinc-200 dark:border-zinc-800 font-mono font-bold text-zinc-600 dark:text-zinc-300 select-none">
                  +212
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  value={repPhoneDigits}
                  onChange={(e) => setRepPhoneDigits(toMoroccanDigits9(e.target.value))}
                  placeholder="612345678"
                  className="w-full bg-transparent px-2.5 py-2 font-mono text-zinc-900 dark:text-white outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              لون التمييز:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_KEY_OPTIONS.map((preset) => {
                const selected = repColorKey === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setRepColorKey(preset.key)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      selected
                        ? preset.activeTabClass
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selected ? 'bg-current' : preset.dotClass
                      }`}
                    />
                    <span>{preset.labelAr}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={replacingBusy || replaceableBarbers.length === 0}
            className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-amber-500 hover:bg-zinc-800 dark:hover:bg-amber-400 text-white dark:text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {replacingBusy ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            <span>تأكيد الاستبدال وحفظ الأرشيف</span>
          </button>
        </form>
      </div>

      {/* Archived Former Barbers (Collapsible) */}
      {archivedBarbers.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
          <button
            type="button"
            onClick={() => setShowArchived((p) => !p)}
            className="w-full flex items-center justify-between font-black text-zinc-800 dark:text-zinc-200 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-zinc-500" />
              <span>الحلاقون المؤرشفون (السجلات محفوظة: {archivedBarbers.length})</span>
            </span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              {showArchived ? 'إخفاء' : 'عرض'}
            </span>
          </button>

          {showArchived && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              {archivedBarbers.map((arch) => {
                const rep = roster.find((m) => m.id === arch.replacedById);
                return (
                  <div
                    key={arch.id}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2"
                  >
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white">
                        {arch.nameAr} ({arch.nameFr})
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        تم استبداله بـ: <strong>{rep?.nameAr || arch.replacedById || '—'}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRestoreArchivedMember(arch)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>إعادة تفعيل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditMemberModal(arch)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMember(arch)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                        title="حذف الحساب نهائياً"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Full Edit Account Modal */}
      {editingMember && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sb-modal-backdrop">
            <form
              onSubmit={handleSaveEditedMember}
              className="bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-3.5 text-xs shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
                <div className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-500" />
                  <span>تعديل حساب: {editingMember.nameAr}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    الاسم بالعربية *
                  </label>
                  <input
                    type="text"
                    required
                    value={editMemberNameAr}
                    onChange={(e) => setEditMemberNameAr(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    الاسم بالفرنسية *
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={editMemberNameFr}
                    onChange={(e) => setEditMemberNameFr(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    الاسم بالإنجليزية
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editMemberNameEn}
                    onChange={(e) => setEditMemberNameEn(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    رمز الدخول (PIN) *
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    minLength={3}
                    maxLength={24}
                    value={editMemberPin}
                    onChange={(e) => setEditMemberPin(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/40 rounded-xl px-3 py-2 font-mono font-bold text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={editMemberPhone}
                    onChange={(e) => setEditMemberPhone(e.target.value)}
                    placeholder="+212..."
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  لون التمييز الهادئ:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_KEY_OPTIONS.map((preset) => {
                    const selected = editMemberColor === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => setEditMemberColor(preset.key)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                          selected
                            ? preset.activeTabClass
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${selected ? 'bg-current' : preset.dotClass}`} />
                        <span>{preset.labelAr}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {editingMember.role === 'barber' && (
                <div className="flex items-center gap-2 pt-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">حالة الحساب:</label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditMemberStatus((p) => (p === 'active' ? 'archived' : 'active'))
                    }
                    className={`px-3 py-1 rounded-lg border font-bold cursor-pointer ${
                      editMemberStatus === 'active'
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 text-emerald-700 dark:text-emerald-300'
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {editMemberStatus === 'active' ? 'نشط ✓' : 'مؤرشف (غير نشط)'}
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editMemberBusy}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer"
                >
                  حفظ التعديلات ✓
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Delete Barber Account Confirmation Modal */}
      {confirmDeleteMember && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sb-modal-backdrop">
            <div className="bg-white dark:bg-[#141720] border border-rose-300 dark:border-rose-500/40 rounded-2xl p-5 max-w-sm w-full space-y-3.5 text-xs shadow-2xl">
              <div className="font-black text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>تأكيد حذف حساب الحلاق</span>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                هل أنت متأكد من حذف حساب <strong>{confirmDeleteMember.nameAr}</strong> (
                {confirmDeleteMember.nameFr}) من قائمة الفريق؟ لن يتم مسح قيود لاكيس أو المواعيد السابقة المرتبطة بالاسم.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteMember(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={deleteMemberBusy}
                  onClick={handleConfirmDeleteMember}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer"
                >
                  {deleteMemberBusy ? 'جاري الحذف...' : 'تأكيد الحذف'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
