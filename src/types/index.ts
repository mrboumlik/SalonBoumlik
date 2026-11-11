export type Language = 'fr' | 'ar' | 'en' | 'amz' | 'es';

export type AppTheme = 'luxury_gold' | 'charcoal' | 'minimal_light';

export type DrinkPreference = 'coffee' | 'tea' | 'none';

export type BookingStatus = 'pending' | 'pending_quote' | 'confirmed' | 'rescheduled' | 'rejected';

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
  notes?: string;
  originalTotalMAD?: number;
  finalTotalMAD?: number;
  totalSavingsMAD?: number;
  bookingMethod?: 'site' | 'whatsapp';
  drinkPreference?: DrinkPreference;
  totalDurationMinutes?: number;
  status: BookingStatus;
  rescheduledTo?: { date: string; time: string };
  adminNotes?: string;
  createdAt: string;
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
