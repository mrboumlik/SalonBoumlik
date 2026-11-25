import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  BarberColorKey,
  RosterMemberAccount,
  StaffRole,
} from '../types';
import { TEAM_MEMBERS } from '../data/barbershopData';
import { CALM_COLOR_PRESETS, syncBarberIdentityRegistry } from './barberIdentity';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  emitRealtimeSyncHint,
  registerRealtimeRefreshHandler,
  resetResilientRetry,
  scheduleResilientRetry,
} from './realtimeSync';
import { asIsoString, safeCompareAsc } from './safeCoerce';

const BARBER_ROSTER_COLLECTION = 'barber_roster';
export const CAISSE_ACCOUNT_ID = 'caisse_register';

export const DEFAULT_ROSTER_ACCOUNTS: RosterMemberAccount[] = [
  {
    id: 'hassan',
    nameAr: 'حسن ايت بومليك',
    nameFr: 'Hassan ait boumlik',
    nameEn: 'Hassan ait boumlik',
    role: 'master',
    status: 'active',
    pin: '1994',
    colorKey: 'amber',
    sortOrder: 1,
    isOwner: true,
    defaultAvatar: TEAM_MEMBERS[0]?.avatar,
    defaultPhone: '+212635392503',
    defaultWhatsapp: '212635392503',
    defaultInstagram: '@boumlik.barbershop',
    updatedBy: 'System',
    updatedAt: '',
  },
  {
    id: 'anouar-arif',
    nameAr: 'انور عريف',
    nameFr: 'Anouar arif',
    nameEn: 'Anouar arif',
    role: 'barber',
    status: 'active',
    pin: '1234',
    colorKey: 'blue',
    sortOrder: 2,
    isOwner: false,
    defaultAvatar: TEAM_MEMBERS[1]?.avatar,
    defaultPhone: '+212600000001',
    defaultWhatsapp: '212600000001',
    defaultInstagram: '@anouar.barber',
    updatedBy: 'System',
    updatedAt: '',
  },
  {
    id: 'lahcen-lhanz',
    nameAr: 'لحسن الهنز',
    nameFr: 'Lahcen lhanz',
    nameEn: 'Lahcen lhanz',
    role: 'barber',
    status: 'active',
    pin: '5678',
    colorKey: 'emerald',
    sortOrder: 3,
    isOwner: false,
    defaultAvatar: TEAM_MEMBERS[2]?.avatar,
    defaultPhone: '+212600000002',
    defaultWhatsapp: '212600000002',
    defaultInstagram: '@lahcen.cuts',
    updatedBy: 'System',
    updatedAt: '',
  },
  {
    id: 'mounir-querdeny',
    nameAr: 'منير كرديني',
    nameFr: 'Mounir querdeny',
    nameEn: 'Mounir querdeny',
    role: 'barber',
    status: 'active',
    pin: '1111',
    colorKey: 'violet',
    sortOrder: 4,
    isOwner: false,
    defaultAvatar: TEAM_MEMBERS[3]?.avatar,
    defaultPhone: '+212600000003',
    defaultWhatsapp: '212600000003',
    defaultInstagram: '@mounir.style',
    updatedBy: 'System',
    updatedAt: '',
  },
  {
    id: CAISSE_ACCOUNT_ID,
    nameAr: 'لاكيس (Caisse)',
    nameFr: 'Caisse Salon',
    nameEn: 'Salon Caisse',
    role: 'caisse',
    status: 'active',
    pin: '0000',
    colorKey: 'slate',
    sortOrder: 99,
    isOwner: false,
    updatedBy: 'System',
    updatedAt: '',
  },
];

let cachedRoster: RosterMemberAccount[] = [...DEFAULT_ROSTER_ACCOUNTS];
let hasHydratedRoster = false;
const rosterListeners = new Set<(members: RosterMemberAccount[]) => void>();
let rosterUnsubscribe: (() => void) | null = null;
let rosterRefreshUnsub: (() => void) | null = null;

function sanitizeColorKey(raw?: string): BarberColorKey {
  if (raw && raw in CALM_COLOR_PRESETS) {
    return raw as BarberColorKey;
  }
  return 'slate';
}

function mergeWithDefaults(remoteDocs: RosterMemberAccount[]): RosterMemberAccount[] {
  const byId = new Map<string, RosterMemberAccount>();
  DEFAULT_ROSTER_ACCOUNTS.forEach((def) => {
    byId.set(def.id, { ...def });
  });

  remoteDocs.forEach((docItem) => {
    const existing = byId.get(docItem.id);
    const merged: RosterMemberAccount = {
      ...(existing || {}),
      ...docItem,
      colorKey: sanitizeColorKey(docItem.colorKey || existing?.colorKey),
      status: docItem.status === 'archived' ? 'archived' : 'active',
      role: (['master', 'barber', 'caisse'].includes(docItem.role)
        ? docItem.role
        : existing?.role || 'barber') as StaffRole,
      sortOrder:
        typeof docItem.sortOrder === 'number' && Number.isFinite(docItem.sortOrder)
          ? docItem.sortOrder
          : existing?.sortOrder ?? 50,
    };
    byId.set(docItem.id, merged);
  });

  const sorted = Array.from(byId.values()).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return safeCompareAsc(a.nameFr, b.nameFr);
  });

  syncBarberIdentityRegistry(sorted);
  return sorted;
}

function commitRosterCache(members: RosterMemberAccount[], broadcastHint = false): void {
  cachedRoster = members;
  hasHydratedRoster = true;
  rosterListeners.forEach((cb) => {
    try {
      cb(cachedRoster);
    } catch (err) {
      console.warn('Roster listener callback error:', err);
    }
  });
  if (broadcastHint) {
    emitRealtimeSyncHint('roster');
  }
}

function mapSnapshotDocsToRoster(
  docs: { id: string; data: () => unknown }[]
): RosterMemberAccount[] {
  const remotes: RosterMemberAccount[] = docs.map((docSnap) => {
    const d = docSnap.data() as Partial<RosterMemberAccount>;
    return {
      id: String(d.id || docSnap.id),
      nameAr: String(d.nameAr || d.nameFr || docSnap.id),
      nameFr: String(d.nameFr || d.nameAr || docSnap.id),
      nameEn: d.nameEn ? String(d.nameEn) : undefined,
      role: (d.role || 'barber') as StaffRole,
      status: d.status === 'archived' ? 'archived' : 'active',
      pin: String(d.pin || '1234'),
      colorKey: sanitizeColorKey(d.colorKey),
      sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 50,
      isOwner: Boolean(d.isOwner),
      defaultAvatar: d.defaultAvatar,
      defaultPhone: d.defaultPhone,
      defaultWhatsapp: d.defaultWhatsapp,
      defaultInstagram: d.defaultInstagram,
      replacesBarberId: d.replacesBarberId,
      replacedById: d.replacedById,
      updatedBy: String(d.updatedBy || 'System'),
      updatedAt: asIsoString(d.updatedAt, ''),
    };
  });
  return mergeWithDefaults(remotes);
}

function ensureRosterListener() {
  if (!rosterRefreshUnsub) {
    rosterRefreshUnsub = registerRealtimeRefreshHandler('barber_roster', 'roster', async () => {
      if (rosterListeners.size === 0) return;
      ensureRosterListener();
      try {
        let snap;
        try {
          snap = await getDocsFromServer(collection(db, BARBER_ROSTER_COLLECTION));
        } catch {
          snap = await getDocs(collection(db, BARBER_ROSTER_COLLECTION));
        }
        commitRosterCache(mapSnapshotDocsToRoster(snap.docs));
      } catch (err) {
        console.warn('Barber roster wake refresh warning:', err);
      }
    });
  }
  if (rosterUnsubscribe) return;

  rosterUnsubscribe = onSnapshot(
    collection(db, BARBER_ROSTER_COLLECTION),
    (snapshot) => {
      resetResilientRetry('barber_roster');
      commitRosterCache(mapSnapshotDocsToRoster(snapshot.docs));
    },
    (error) => {
      if (rosterUnsubscribe) {
        try {
          rosterUnsubscribe();
        } catch {
          // Ignore
        }
        rosterUnsubscribe = null;
      }
      scheduleResilientRetry(
        'barber_roster',
        () => rosterListeners.size > 0,
        () => ensureRosterListener(),
        error
      );
    }
  );
}

export function subscribeToBarberRoster(
  cb: (members: RosterMemberAccount[]) => void
): () => void {
  rosterListeners.add(cb);
  ensureRosterListener();
  if (hasHydratedRoster) {
    cb(cachedRoster);
  }
  return () => {
    rosterListeners.delete(cb);
    if (rosterListeners.size === 0) {
      resetResilientRetry('barber_roster');
      if (rosterUnsubscribe) {
        rosterUnsubscribe();
        rosterUnsubscribe = null;
      }
      if (rosterRefreshUnsub) {
        rosterRefreshUnsub();
        rosterRefreshUnsub = null;
      }
      hasHydratedRoster = false;
    }
  };
}

export function useBarberRoster(): RosterMemberAccount[] {
  const [roster, setRoster] = useState<RosterMemberAccount[]>(cachedRoster);
  useEffect(() => subscribeToBarberRoster(setRoster), []);
  return roster;
}

export function getActiveRosterBarbers(
  roster: RosterMemberAccount[] = cachedRoster
): RosterMemberAccount[] {
  return roster.filter((m) => m.status !== 'archived' && m.role !== 'caisse');
}

export function getArchivedRosterBarbers(
  roster: RosterMemberAccount[] = cachedRoster
): RosterMemberAccount[] {
  return roster.filter((m) => m.status === 'archived' && m.role !== 'caisse');
}

export function getCaisseRosterAccount(
  roster: RosterMemberAccount[] = cachedRoster
): RosterMemberAccount {
  return (
    roster.find((m) => m.role === 'caisse' || m.id === CAISSE_ACCOUNT_ID) ||
    DEFAULT_ROSTER_ACCOUNTS.find((m) => m.id === CAISSE_ACCOUNT_ID)!
  );
}

export interface StaffSession {
  role: StaffRole;
  name: string;
  barberId?: string;
  barberName?: string;
  memberId: string;
}

export function authenticateStaffPin(
  rawInput: string,
  roster: RosterMemberAccount[] = cachedRoster
): StaffSession | null {
  const clean = (rawInput || '').trim();
  const digitsOnly = clean.replace(/[\s+\-()]/g, '');

  // Emergency Master recovery phone access (Hassan)
  const masterMember =
    roster.find((m) => m.role === 'master') || DEFAULT_ROSTER_ACCOUNTS[0];
  if (
    digitsOnly === '0635392503' ||
    digitsOnly === '212635392503' ||
    clean === '+212635392503' ||
    clean === 'Hassan2026!'
  ) {
    return {
      role: 'master',
      name: `${masterMember.nameFr} (Master Admin)`,
      barberId: masterMember.id,
      barberName: masterMember.nameFr,
      memberId: masterMember.id,
    };
  }

  // Exact PIN check against active roster members (master first, then barbers, then caisse)
  const activeMembers = roster.filter((m) => m.status !== 'archived');
  const match = activeMembers.find((m) => m.pin === clean);
  if (!match) return null;

  if (match.role === 'master') {
    return {
      role: 'master',
      name: `${match.nameFr} (Master Admin)`,
      barberId: match.id,
      barberName: match.nameFr,
      memberId: match.id,
    };
  }

  if (match.role === 'caisse') {
    return {
      role: 'caisse',
      name: match.nameAr || 'لاكيس (Caisse)',
      memberId: match.id,
    };
  }

  return {
    role: 'barber',
    name: `${match.nameFr} (${match.nameAr})`,
    barberId: match.id,
    barberName: match.nameFr,
    memberId: match.id,
  };
}

function buildWritableRosterPayload(member: RosterMemberAccount): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: member.id,
    nameAr: String(member.nameAr).trim().slice(0, 80),
    nameFr: String(member.nameFr).trim().slice(0, 80),
    role: member.role,
    status: member.status,
    pin: String(member.pin).trim().slice(0, 32),
    colorKey: member.colorKey,
    sortOrder: Math.max(0, Math.min(1000, Math.round(member.sortOrder))),
    updatedBy: String(member.updatedBy || 'Master Admin').trim().slice(0, 100),
    updatedAt: member.updatedAt,
  };
  if (member.nameEn?.trim()) payload.nameEn = member.nameEn.trim().slice(0, 80);
  if (typeof member.isOwner === 'boolean') payload.isOwner = member.isOwner;
  if (member.defaultAvatar?.trim()) payload.defaultAvatar = member.defaultAvatar.trim().slice(0, 240000);
  if (member.defaultPhone?.trim()) payload.defaultPhone = member.defaultPhone.trim().slice(0, 40);
  if (member.defaultWhatsapp?.trim()) payload.defaultWhatsapp = member.defaultWhatsapp.trim().slice(0, 40);
  if (member.defaultInstagram?.trim()) payload.defaultInstagram = member.defaultInstagram.trim().slice(0, 100);
  if (member.replacesBarberId?.trim()) payload.replacesBarberId = member.replacesBarberId.trim().slice(0, 64);
  if (member.replacedById?.trim()) payload.replacedById = member.replacedById.trim().slice(0, 64);
  return payload;
}

export function validatePinFormat(
  pin: string,
  memberId: string,
  roster: RosterMemberAccount[]
): string | null {
  const clean = (pin || '').trim();
  if (clean.length < 3 || clean.length > 24) {
    return 'كلمة المرور يجب أن تحتوي على 3 أحرف/أرقام على الأقل.';
  }
  const conflict = roster.find(
    (m) => m.id !== memberId && m.status !== 'archived' && m.pin === clean
  );
  if (conflict) {
    return `كلمة المرور مستعملة بالفعل من طرف "${conflict.nameAr}". اختر رمزاً مختلفاً.`;
  }
  return null;
}

export async function adminSetMemberPin(params: {
  memberId: string;
  newPin: string;
  updatedBy: string;
  roster: RosterMemberAccount[];
}): Promise<void> {
  const { memberId, newPin, updatedBy, roster } = params;
  const err = validatePinFormat(newPin, memberId, roster);
  if (err) throw new Error(err);

  const target =
    roster.find((m) => m.id === memberId) ||
    DEFAULT_ROSTER_ACCOUNTS.find((m) => m.id === memberId);
  if (!target) throw new Error('الحساب غير موجود.');

  const nowIso = new Date().toISOString().slice(0, 64);
  const nextMember: RosterMemberAccount = {
    ...target,
    pin: newPin.trim(),
    updatedBy: updatedBy || 'Hassan ait boumlik',
    updatedAt: nowIso,
  };

  try {
    await setDoc(
      doc(db, BARBER_ROSTER_COLLECTION, target.id),
      buildWritableRosterPayload(nextMember)
    );
    commitRosterCache(
      mergeWithDefaults(
        cachedRoster.map((m) => (m.id === target.id ? nextMember : m))
      ),
      true
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${BARBER_ROSTER_COLLECTION}/${target.id}`);
  }
}

export async function changeOwnMemberPin(params: {
  memberId: string;
  currentPin: string;
  newPin: string;
  roster: RosterMemberAccount[];
}): Promise<void> {
  const { memberId, currentPin, newPin, roster } = params;
  const target =
    roster.find((m) => m.id === memberId) ||
    DEFAULT_ROSTER_ACCOUNTS.find((m) => m.id === memberId);
  if (!target) throw new Error('الحساب غير موجود.');

  if (target.pin !== currentPin.trim()) {
    throw new Error('كلمة المرور الحالية غير صحيحة.');
  }
  await adminSetMemberPin({
    memberId,
    newPin,
    updatedBy: target.nameFr || target.nameAr,
    roster,
  });
}

function generateUniqueBarberSlug(nameFr: string, existingIds: Set<string>): string {
  const base = (nameFr || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  const prefix = base && base.length >= 2 ? base : `barber-${Date.now().toString(36).slice(-4)}`;
  if (!existingIds.has(prefix)) return prefix;
  let counter = 2;
  while (existingIds.has(`${prefix}-${counter}`)) {
    counter += 1;
  }
  return `${prefix}-${counter}`;
}

export async function addRosterBarber(params: {
  nameAr: string;
  nameFr: string;
  nameEn?: string;
  pin: string;
  colorKey: BarberColorKey;
  phone?: string;
  updatedBy: string;
  roster: RosterMemberAccount[];
}): Promise<RosterMemberAccount> {
  const { nameAr, nameFr, nameEn, pin, colorKey, phone, updatedBy, roster } = params;
  if (!nameAr.trim() || !nameFr.trim()) {
    throw new Error('يرجى إدخال اسم الحلاق بالعربية والفرنسية.');
  }

  const existingIds = new Set(roster.map((m) => m.id));
  const newId = generateUniqueBarberSlug(nameFr, existingIds);

  const err = validatePinFormat(pin, newId, roster);
  if (err) throw new Error(err);

  const maxSort = roster
    .filter((m) => m.role !== 'caisse')
    .reduce((max, m) => Math.max(max, m.sortOrder || 0), 0);

  const nowIso = new Date().toISOString().slice(0, 64);
  const newMember: RosterMemberAccount = {
    id: newId,
    nameAr: nameAr.trim(),
    nameFr: nameFr.trim(),
    nameEn: (nameEn || nameFr).trim(),
    role: 'barber',
    status: 'active',
    pin: pin.trim(),
    colorKey: sanitizeColorKey(colorKey),
    sortOrder: maxSort + 1,
    isOwner: false,
    defaultAvatar:
      TEAM_MEMBERS[1]?.avatar ||
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    defaultPhone: phone?.trim() || undefined,
    defaultWhatsapp: phone?.trim() ? phone.replace(/\D/g, '') : undefined,
    updatedBy: updatedBy || 'Hassan ait boumlik',
    updatedAt: nowIso,
  };

  try {
    await setDoc(
      doc(db, BARBER_ROSTER_COLLECTION, newId),
      buildWritableRosterPayload(newMember)
    );
    commitRosterCache(mergeWithDefaults([...cachedRoster, newMember]), true);
    return newMember;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${BARBER_ROSTER_COLLECTION}/${newId}`);
  }
}

export async function replaceRosterBarber(params: {
  oldBarberId: string;
  nameAr: string;
  nameFr: string;
  nameEn?: string;
  pin: string;
  colorKey: BarberColorKey;
  phone?: string;
  updatedBy: string;
  roster: RosterMemberAccount[];
}): Promise<{ archived: RosterMemberAccount; created: RosterMemberAccount }> {
  const { oldBarberId, nameAr, nameFr, nameEn, pin, colorKey, phone, updatedBy, roster } = params;
  const oldMember = roster.find((m) => m.id === oldBarberId);
  if (!oldMember || oldMember.role === 'master' || oldMember.role === 'caisse') {
    throw new Error('لا يمكن استبدال هذا الحساب.');
  }
  if (!nameAr.trim() || !nameFr.trim()) {
    throw new Error('يرجى إدخال اسم الحلاق الجديد بالعربية والفرنسية.');
  }

  const existingIds = new Set(roster.map((m) => m.id));
  const newId = generateUniqueBarberSlug(nameFr, existingIds);

  // Exclude the departing barber from PIN uniqueness conflict check since they are being archived
  const rosterWithoutOld = roster.filter((m) => m.id !== oldBarberId);
  const err = validatePinFormat(pin, newId, rosterWithoutOld);
  if (err) throw new Error(err);

  const nowIso = new Date().toISOString().slice(0, 64);

  const archivedMember: RosterMemberAccount = {
    ...oldMember,
    status: 'archived',
    replacedById: newId,
    updatedBy: updatedBy || 'Hassan ait boumlik',
    updatedAt: nowIso,
  };

  const createdMember: RosterMemberAccount = {
    id: newId,
    nameAr: nameAr.trim(),
    nameFr: nameFr.trim(),
    nameEn: (nameEn || nameFr).trim(),
    role: 'barber',
    status: 'active',
    pin: pin.trim(),
    colorKey: sanitizeColorKey(colorKey || oldMember.colorKey),
    sortOrder: oldMember.sortOrder,
    isOwner: false,
    defaultAvatar:
      oldMember.defaultAvatar ||
      TEAM_MEMBERS[1]?.avatar ||
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    defaultPhone: phone?.trim() || undefined,
    defaultWhatsapp: phone?.trim() ? phone.replace(/\D/g, '') : undefined,
    replacesBarberId: oldBarberId,
    updatedBy: updatedBy || 'Hassan ait boumlik',
    updatedAt: nowIso,
  };

  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, BARBER_ROSTER_COLLECTION, archivedMember.id),
      buildWritableRosterPayload(archivedMember)
    );
    batch.set(
      doc(db, BARBER_ROSTER_COLLECTION, createdMember.id),
      buildWritableRosterPayload(createdMember)
    );
    await batch.commit();
    commitRosterCache(
      mergeWithDefaults([
        ...cachedRoster.map((m) => (m.id === archivedMember.id ? archivedMember : m)),
        createdMember,
      ]),
      true
    );
    return { archived: archivedMember, created: createdMember };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${BARBER_ROSTER_COLLECTION}/${newId}`);
  }
}

export async function updateRosterMember(params: {
  memberId: string;
  nameAr?: string;
  nameFr?: string;
  nameEn?: string;
  pin?: string;
  colorKey?: BarberColorKey;
  phone?: string;
  status?: 'active' | 'archived';
  updatedBy: string;
  roster: RosterMemberAccount[];
}): Promise<RosterMemberAccount> {
  const { memberId, nameAr, nameFr, nameEn, pin, colorKey, phone, status, updatedBy, roster } = params;
  const target =
    roster.find((m) => m.id === memberId) ||
    DEFAULT_ROSTER_ACCOUNTS.find((m) => m.id === memberId);
  if (!target) throw new Error('الحساب غير موجود.');

  if (pin !== undefined && pin.trim() !== target.pin) {
    const err = validatePinFormat(pin, memberId, roster);
    if (err) throw new Error(err);
  }

  const nextStatus: 'active' | 'archived' =
    target.role === 'master' || target.role === 'caisse' || target.id === 'hassan' || target.id === 'caisse_register'
      ? 'active'
      : status ?? target.status;

  const nextAr = nameAr !== undefined ? nameAr.trim() || target.nameAr : target.nameAr;
  const nextFr = nameFr !== undefined ? nameFr.trim() || target.nameFr : target.nameFr;
  const nextEn = nameEn !== undefined ? nameEn.trim() || nextFr : target.nameEn;
  const nextPhone = phone !== undefined ? phone.trim() || undefined : target.defaultPhone;

  const updatedMember: RosterMemberAccount = {
    ...target,
    nameAr: nextAr,
    nameFr: nextFr,
    nameEn: nextEn,
    pin: pin !== undefined ? pin.trim() : target.pin,
    colorKey: colorKey !== undefined ? sanitizeColorKey(colorKey) : target.colorKey,
    status: nextStatus,
    defaultPhone: nextPhone,
    defaultWhatsapp: nextPhone ? nextPhone.replace(/\D/g, '') : target.defaultWhatsapp,
    updatedBy: updatedBy || 'Hassan ait boumlik',
    updatedAt: new Date().toISOString().slice(0, 64),
  };

  try {
    await setDoc(
      doc(db, BARBER_ROSTER_COLLECTION, target.id),
      buildWritableRosterPayload(updatedMember)
    );
    commitRosterCache(
      mergeWithDefaults(
        cachedRoster.map((m) => (m.id === target.id ? updatedMember : m))
      ),
      true
    );
    return updatedMember;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${BARBER_ROSTER_COLLECTION}/${target.id}`);
  }
}

export async function deleteRosterMember(
  memberId: string,
  roster: RosterMemberAccount[]
): Promise<void> {
  const target = roster.find((m) => m.id === memberId);
  if (
    memberId === 'hassan' ||
    memberId === 'caisse_register' ||
    target?.role === 'master' ||
    target?.role === 'caisse' ||
    target?.isOwner
  ) {
    throw new Error('لا يمكن حذف حساب المشرف العام أو حساب لاكيس.');
  }
  try {
    await deleteDoc(doc(db, BARBER_ROSTER_COLLECTION, memberId));
    commitRosterCache(
      mergeWithDefaults(cachedRoster.filter((m) => m.id !== memberId)),
      true
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${BARBER_ROSTER_COLLECTION}/${memberId}`);
  }
}

