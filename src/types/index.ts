export type Language = 'fr' | 'ar' | 'en' | 'amz';

export type DrinkPreference = 'coffee' | 'tea' | 'none';

export interface BarberService {
  id: string;
  name: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  category: 'haircut' | 'beard' | 'wash' | 'protein' | 'relaxing' | 'facial';
  description: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  durationMinutes: number;
  popular?: boolean;
  includes?: {
    fr: string[];
    ar: string[];
    en: string[];
    amz: string[];
  };
  badge?: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
}

export interface BarberStaff {
  id: string;
  name: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  role: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  experience: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  specialty: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  bio: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
  };
  phone?: string;
  whatsappNumber?: string;
  avatar: string;
  rating: number;
  isOwner?: boolean;
}

export interface GalleryItem {
  id: string;
  title: {
    fr: string;
    ar: string;
    en: string;
    amz: string;
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

export interface AppointmentBooking {
  id: string;
  ticketNumber: string;
  services: BarberService[];
  barberId: string;
  barberName: string;
  drinkPreference: DrinkPreference;
  date: string; // YYYY-MM-DD
  timeSlot: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  notes?: string;
  totalDurationMinutes: number;
  createdAt: string;
  status: 'pending_quote' | 'confirmed' | 'cancelled';
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
