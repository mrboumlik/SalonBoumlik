export type Language = 'fr' | 'ar' | 'en' | 'amz' | 'es';

export type AppTheme = 'luxury_gold' | 'charcoal' | 'minimal_light';

export type DrinkPreference = 'coffee' | 'tea' | 'none';

export type BookingStatus =
  | 'pending'
  | 'pending_quote'
  | 'flexible_pending'
  | 'confirmed'
  | 'rescheduled'
  | 'completed'
  | 'no_show'
  | 'rejected'
  | 'cancelled';

export interface BarberService {
  id: string;
  name: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es?: string;
  };
  category: 'haircut' | 'beard' | 'wash' | 'protein' | 'relaxing' | 'facial' | 'color';
  basePrice?: number;
  description: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es?: string;
  };
  durationMinutes: number;
  popular?: boolean;
  includes?: {
    fr: string[];
    ar: string[];
    en: string[];
    amz: string[];
    es?: string[];
  };
  badge?: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es?: string;
  };
}

export interface BarberStaff {
  id: string;
  name: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es?: string;
  };
  role?: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es?: string;
  };
  experience?: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es?: string;
  };
  specialty?: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es?: string;
  };
  bio?: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es?: string;
  };
  phone?: string;
  whatsappNumber?: string;
  instagram?: string;
  instagramHandle?: string;
  avatar: string;
  rating: number;
  isOwner?: boolean;
  themeColor?: string; // e.g. '#D97706' (Hassan Gold), '#2563EB' (Anouar Blue), '#059669' (Lahcen Emerald), '#7C3AED' (Mounir Purple)
  colorName?: string;
}

export interface GalleryItem {
  id: string;
  title: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
    es?: string;
  };
  category: 'fades' | 'beards' | 'skincare' | 'vip';
  barberName: string;
  imageUrl: string;
  date?: string;
  likes?: number;
}

export interface CustomerReview {
  id: string;
  author: string;
  city: string | {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  serviceName: string | {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  rating: number; // 1 to 5
  date: string | {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  comment: string | {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  tags?: string[] | {
    fr: string[];
    ar: string[];
    en: string[];
    amz: string[];
  };
  barberId?: string;
  barberName?: string;
  bookingId?: string;
  createdAt?: string;
  verified?: boolean;
}

export interface HairColorConfig {
  tone: 'grey_white' | 'brown_blonde' | 'blue_red';
  coverage: 'full' | 'highlights';
}

export interface SelectedCartItem {
  serviceId: string;
  name: string;
  category: string;
  originalPrice: number;
  finalPrice: number;
  discountApplied?: string;
  colorConfig?: HairColorConfig;
  proteinOption?: string;
}

export interface PricingEngineResult {
  items: SelectedCartItem[];
  originalSubtotal: number;
  finalTotal: number;
  totalSavings: number;
  comboApplied?: string;
  overridesApplied: string[];
  discountsBreakdown: { title: string; savedMAD: number }[];
}

export interface AppointmentBooking {
  id: string;
  ticketNumber: string; // e.g. #SB-1024
  services: BarberService[];
  cartItemsSummary?: SelectedCartItem[];
  barberId: string;
  barberName: string;
  barberColor?: string; // hex color e.g. #D97706, #2563EB, #059669, #7C3AED
  date: string; // YYYY-MM-DD
  timeSlot: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientNotes?: string;
  notes?: string;
  originalTotalMAD?: number;
  finalTotalMAD?: number;
  totalSavingsMAD?: number;
  bookingMethod?: 'site' | 'whatsapp';
  drinkPreference?: DrinkPreference;
  totalDurationMinutes?: number;
  status: BookingStatus;
  isFlexibleTime?: boolean;
  preferredTimeHint?: string;
  rescheduledTo?: { date: string; time: string };
  clientLanguage?: Language;
  adminNotes?: string;
  cihReceiptName?: string;
  cihReceiptPreview?: string;
  cihReceiptUploadedAt?: string;
  loyaltyRewardApplied?: string;
  attendanceConfirmedAt?: string;
  checkInToken?: string;
  checkedInAt?: string;
  caisseLoggedAt?: string;
  caisseEntryId?: string;
  deviceFingerprint?: string;
  clientIpHash?: string;
  isAdminWalkIn?: boolean;
  createdAt: string;
}

export type CaisseBarberId = string;

export type StaffRole = 'master' | 'barber' | 'caisse';

export type BarberColorKey =
  | 'amber'
  | 'blue'
  | 'emerald'
  | 'violet'
  | 'teal'
  | 'indigo'
  | 'slate'
  | 'stone'
  | 'rose';

export type CaisseEntryType =
  | 'income'
  | 'expense'
  | 'float_adjustment'
  | 'float_return'
  | 'credit_repayment';

export type CaisseCreditStatus = 'none' | 'open' | 'partial' | 'paid';

export interface CaisseEntry {
  id: string;
  barberId: CaisseBarberId;
  barberName: string;
  type: CaisseEntryType;
  date: string; // YYYY-MM-DD
  serviceIds?: string[];
  serviceNames?: string[];
  expectedAmountMAD: number;
  amountPaidMAD: number;
  creditAmountMAD: number;
  creditRemainingMAD: number;
  creditStatus?: CaisseCreditStatus;
  clientName?: string;
  clientPhone?: string;
  expectedRepaymentDate?: string; // YYYY-MM-DD
  repaidDate?: string; // YYYY-MM-DD
  repaidAmountMAD?: number;
  parentCreditEntryId?: string;
  sourceBookingId?: string;
  sourceTicketNumber?: string;
  note?: string;
  createdByRole: StaffRole;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionPeriodOverride {
  id: string;
  label?: string;
  scope: 'month' | 'date_range';
  month?: string; // YYYY-MM
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  commissionPercent: number; // 0..100
}

export interface CaisseBarberSetting {
  id: string;
  barberId: CaisseBarberId;
  commissionPercent: number; // default 50
  periodOverrides?: CommissionPeriodOverride[];
  updatedBy: string;
  updatedAt: string;
}

export interface CaisseDailySettlement {
  id: string; // `${barberId}_${date}`
  barberId: CaisseBarberId;
  barberName: string;
  date: string; // YYYY-MM-DD
  collected: boolean;
  collectedAmountMAD: number;
  barberShareMAD: number;
  shopShareMAD: number;
  floatMAD: number;
  expensesMAD: number;
  carryOverOwedMAD: number;
  resetCount: number;
  intakeClosed?: boolean;
  grossIntakeClosedMAD?: number;
  settlementMode?: 'daily_intake' | 'daily_share';
  note?: string;
  confirmedBy: string;
  confirmedAt: string;
  updatedAt: string;
}

export interface BarberBreakRange {
  id: string;
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface BarberScheduleConfig {
  id: string; // equals barberId
  barberId: string;
  offWeekdays: number[]; // 0=Sunday, 1=Monday (default off), ..., 6=Saturday
  offDates: string[]; // 'YYYY-MM-DD'
  breakSlots: string[]; // recurring daily break slots e.g. ['12:00']
  breakRanges?: BarberBreakRange[]; // start-to-end daily break windows e.g. 12:00 -> 13:30
  dateSlotBlocks: string[]; // specific 'YYYY-MM-DD@HH:MM' overrides
  updatedAt: string;
}

export interface CrmClientProfile {
  id: string; // 'c_<normalizedPhoneDigits>'
  normalizedPhone: string;
  phoneDisplay: string;
  clientName: string;
  isVip: boolean;
  noShowCount: number;
  isBanned: boolean;
  banReason?: string;
  freeWashesRedeemed: number;
  customDiscountMAD: number;
  verifiedVisits?: number;
  loyaltyPoints?: number;
  pointsEarnedTotal?: number;
  pointsRedeemedTotal?: number;
  rewardNote?: string;
  updatedAt: string;
}

export type WaitlistStatus = 'waiting' | 'notified' | 'converted' | 'cancelled';

export interface WaitlistEntry {
  id: string;
  barberId: string;
  barberName: string;
  date: string;
  preferredTime: string;
  clientName: string;
  clientPhone: string;
  servicesSummary: string;
  status: WaitlistStatus;
  createdAt: string;
}

export interface SalonProfileSettings {
  googleMapsUrl: string;
  googleReviewUrl: string;
  salonPhone?: string;
  salonWhatsapp?: string;
  additionalPhones?: string[];
  updatedAt: string;
}

export interface ContactMessage {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
}

export type ShiftRequestType =
  | 'day_off'
  | 'day_open'
  | 'slot_block'
  | 'slot_open'
  | 'shift_swap';

export type ShiftRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ShiftRequest {
  id: string;
  barberId: string;
  barberName: string;
  requestType: ShiftRequestType;
  targetDate: string; // YYYY-MM-DD
  targetSlots?: string[]; // specific HH:MM slots for slot_block / partial swap
  swapWithBarberId?: string;
  swapWithBarberName?: string;
  swapDate?: string; // optional return/exchange date YYYY-MM-DD
  reason?: string;
  status: ShiftRequestStatus;
  reviewerNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BarberCustomService {
  id: string;
  nameAr: string;
  nameFr?: string;
  nameEn?: string;
  priceMAD: number;
  durationMinutes: number;
  active: boolean;
}

export interface BarberCustomServiceOverride {
  enabled: boolean;
  priceMAD: number;
  durationMinutes?: number;
}

export interface BarberProfileOverride {
  id: CaisseBarberId;
  barberId: CaisseBarberId;
  avatar?: string;
  phone?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
  bioAr?: string;
  bioFr?: string;
  bioEn?: string;
  useCustomServices: boolean;
  customServices: BarberCustomService[];
  customServiceOverrides?: Record<string, BarberCustomServiceOverride>;
  customHiddenServiceIds?: string[];
  customBundles?: ServiceBundleRule[];
  enableNoWaitOption?: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface SpecialDayPricingRule {
  id: string;
  label: string;
  active: boolean;
  scope: 'weekday' | 'date_range';
  weekdays?: number[]; // 0=Sun..6=Sat
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  mode: 'fixed_prices' | 'delta_mad';
  servicePrices?: Record<string, number>;
  barberServicePrices?: Record<string, Record<string, number>>;
  deltaMAD?: number;
  targetServiceIds?: string[];
}

export interface ServiceBundleRule {
  id: string;
  labelAr: string;
  labelFr?: string;
  labelEn?: string;
  serviceIds: string[];
  bundlePriceMAD: number;
  active: boolean;
}

export interface ShopPricingConfig {
  id: string; // 'default'
  servicePriceOverrides: Record<string, number>;
  hiddenServiceIds?: string[];
  serviceBundles?: ServiceBundleRule[];
  specialRules: SpecialDayPricingRule[];
  enableNoWaitOption?: boolean;
  giftWithHaircutBeardServiceId?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface RosterMemberAccount {
  id: string;
  nameAr: string;
  nameFr: string;
  nameEn?: string;
  role: StaffRole;
  status: 'active' | 'archived';
  pin: string;
  colorKey: BarberColorKey;
  sortOrder: number;
  isOwner?: boolean;
  defaultAvatar?: string;
  defaultPhone?: string;
  defaultWhatsapp?: string;
  defaultInstagram?: string;
  replacesBarberId?: string;
  replacedById?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface CaisseCycleSettlement {
  id: string; // `${barberId}_${timestamp}`
  barberId: CaisseBarberId;
  barberName: string;
  settledThroughIso: string;
  settledThroughDate: string;
  settlementPeriodScope?: 'full_open' | 'month' | 'custom_range';
  periodStartDate?: string;
  periodEndDate?: string;
  totalCollectedMAD: number;
  barberSharePaidMAD: number;
  shopShareMAD: number;
  expensesMAD: number;
  floatMAD: number;
  creditsIssuedMAD: number;
  entryCount: number;
  note?: string;
  confirmedBy: string;
  confirmedAt: string;
}

export interface CaisseDailyArchive {
  id: string; // `${barberId}_${YYYY-MM-DD}`
  barberId: CaisseBarberId;
  barberName: string;
  date: string; // YYYY-MM-DD
  incomeMAD: number;
  repaymentIncomeMAD: number;
  expensesMAD: number;
  floatMAD: number;
  creditsIssuedMAD: number;
  entryCount: number;
  entriesSummary: {
    id: string;
    type: CaisseEntryType;
    amountPaidMAD: number;
    creditAmountMAD: number;
    label: string;
    createdAt: string;
  }[];
  archivedAt: string;
}

export type ManualCreditStatus = 'open' | 'partial' | 'paid';

export interface ClientCreditRecord {
  id: string;
  clientName: string;
  clientPhone: string;
  normalizedPhone: string;
  additionalPhones?: string[];
  normalizedAdditionalPhones?: string[];
  barberId?: CaisseBarberId;
  barberName?: string;
  amountOwedMAD: number;
  originalAmountMAD: number;
  status: ManualCreditStatus;
  creditDate?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CreditSettlementActionType = 'pay' | 'clear';
export type CreditSettlementRequestStatus = 'pending' | 'confirmed' | 'rejected';
export type CreditSettlementSourceType = 'caisse' | 'manual' | 'aggregate';

export interface CreditSettlementRequest {
  id: string;
  sourceType: CreditSettlementSourceType;
  sourceId?: string;
  barberId?: string;
  barberName?: string;
  clientName: string;
  clientPhone: string;
  normalizedPhone: string;
  actionType: CreditSettlementActionType;
  originalRemainingMAD: number;
  requestedAmountMAD: number;
  approvedAmountMAD?: number;
  status: CreditSettlementRequestStatus;
  note?: string;
  submittedBy: string;
  submittedRole: 'client' | 'barber' | 'caisse' | 'master';
  reviewerNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreditDisputeStatus = 'open' | 'reviewed' | 'resolved';

export interface CreditDisputeRecord {
  id: string;
  clientName: string;
  clientPhone: string;
  normalizedPhone: string;
  totalOwedSnapshotMAD: number;
  creditorSummary: string;
  message: string;
  targetBarberId?: string;
  status: CreditDisputeStatus;
  staffNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BarberDailyNote {
  id: string; // `${barberId}_${YYYY-MM-DD}`
  barberId: CaisseBarberId;
  barberName: string;
  date: string; // YYYY-MM-DD
  masterNote: string;
  masterUpdatedBy: string;
  masterUpdatedAt: string;
  barberReply?: string;
  barberRepliedBy?: string;
  barberRepliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

