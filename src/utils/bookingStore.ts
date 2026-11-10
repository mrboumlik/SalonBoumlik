import { AppointmentBooking, BookingStatus, SelectedCartItem, BarberService } from '../types';

const STORAGE_KEY = 'salon_boumlik_all_bookings_v3';

// Initial realistic demo bookings for Taroudant Salon Boumlik
const SEED_BOOKINGS: AppointmentBooking[] = [
  {
    id: 'booking-seed-1',
    ticketNumber: '#SB-1021',
    services: [],
    cartItemsSummary: [
      {
        serviceId: 'haircut',
        name: 'Coupe de Cheveux',
        category: 'haircut',
        originalPrice: 25,
        finalPrice: 20,
        discountApplied: 'Combo Coupe + Barbe',
      },
      {
        serviceId: 'beard',
        name: 'Taille & Traçage Barbe',
        category: 'beard',
        originalPrice: 15,
        finalPrice: 15,
      },
      {
        serviceId: 'wash',
        name: 'Lavage & Shampoing',
        category: 'wash',
        originalPrice: 10,
        finalPrice: 5,
        discountApplied: '5 DH avec coupe',
      },
    ],
    barberId: 'hassan',
    barberName: 'Hassan ait boumlik',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '16:00',
    clientName: 'Yassine El Amrani',
    clientPhone: '0661234567',
    notes: 'Dégradé américain à blanc avec serviette chaude.',
    originalTotalMAD: 50,
    finalTotalMAD: 40,
    totalSavingsMAD: 10,
    bookingMethod: 'site',
    status: 'confirmed',
    adminNotes: 'Confirmé par Hassan. Chaise #1 prête à 16:00.',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'booking-seed-2',
    ticketNumber: '#SB-1022',
    services: [],
    cartItemsSummary: [
      {
        serviceId: 'haircut',
        name: 'Coupe de Cheveux',
        category: 'haircut',
        originalPrice: 25,
        finalPrice: 0,
        discountApplied: 'GRATUIT avec Protéine (0 DH)',
      },
      {
        serviceId: 'protein',
        name: 'Soin Protéine / Kératine',
        category: 'protein',
        originalPrice: 200,
        finalPrice: 200,
        proteinOption: '200 MAD',
      },
    ],
    barberId: 'mounir-querdeny',
    barberName: 'Mounir querdeny',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    timeSlot: '17:30',
    clientName: 'Karim Bennani',
    clientPhone: '0678901234',
    notes: 'Soin kératine brésilien et coupe moderne.',
    originalTotalMAD: 225,
    finalTotalMAD: 200,
    totalSavingsMAD: 25,
    bookingMethod: 'site',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 'booking-seed-3',
    ticketNumber: '#SB-1023',
    services: [],
    cartItemsSummary: [
      {
        serviceId: 'haircut',
        name: 'Coupe de Cheveux',
        category: 'haircut',
        originalPrice: 25,
        finalPrice: 25,
      },
      {
        serviceId: 'face-scrub',
        name: 'Gommage & Peeling Visage',
        category: 'facial',
        originalPrice: 40,
        finalPrice: 40,
      },
    ],
    barberId: 'anouar-arif',
    barberName: 'Anouar arif',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '18:15',
    clientName: 'Amine Tazi',
    clientPhone: '0654321098',
    notes: 'Nettoyage vapeur visage + dégradé taper.',
    originalTotalMAD: 65,
    finalTotalMAD: 65,
    totalSavingsMAD: 0,
    bookingMethod: 'site',
    status: 'rescheduled',
    rescheduledTo: {
      date: new Date().toISOString().split('T')[0],
      time: '19:00',
    },
    adminNotes: 'Créneau décalé de 45 min pour éviter l’attente.',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

export function getAllBookings(): AppointmentBooking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_BOOKINGS));
      return SEED_BOOKINGS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading bookings:', err);
    return SEED_BOOKINGS;
  }
}

export function saveAllBookings(bookings: AppointmentBooking[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    window.dispatchEvent(new CustomEvent('salon_bookings_updated', { detail: { count: bookings.length } }));
  } catch (err) {
    console.error('Error saving bookings:', err);
  }
}

export function getBookingByTicket(ticket: string): AppointmentBooking | undefined {
  const clean = ticket.trim().toUpperCase();
  const formatted = clean.startsWith('#') ? clean : `#${clean}`;
  const all = getAllBookings();
  return all.find((b) => b.ticketNumber.toUpperCase() === formatted || b.ticketNumber.replace('#', '').toUpperCase() === clean);
}

export function getBookingsByPhone(rawPhone: string): AppointmentBooking[] {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return [];
  const all = getAllBookings();
  return all.filter((b) => {
    const bDigits = b.clientPhone.replace(/\D/g, '');
    return bDigits.includes(digits) || digits.includes(bDigits);
  });
}

export function createNewBooking(
  bookingData: Omit<AppointmentBooking, 'id' | 'ticketNumber' | 'createdAt' | 'status'> & {
    id?: string;
    ticketNumber?: string;
    status?: BookingStatus;
  }
): AppointmentBooking {
  const all = getAllBookings();
  const nextNum = Math.floor(1000 + Math.random() * 9000);
  const ticketNumber = bookingData.ticketNumber || `#SB-${nextNum}`;

  const newBooking: AppointmentBooking = {
    ...bookingData,
    id: bookingData.id || `booking-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ticketNumber,
    status: bookingData.status || 'pending',
    createdAt: new Date().toISOString(),
  };

  const updated = [newBooking, ...all];
  saveAllBookings(updated);
  return newBooking;
}

export function updateBookingStatus(
  id: string,
  newStatus: BookingStatus,
  adminNotes?: string,
  rescheduledTo?: { date: string; time: string }
): AppointmentBooking | null {
  const all = getAllBookings();
  let found: AppointmentBooking | null = null;

  const updated = all.map((b) => {
    if (b.id === id) {
      found = {
        ...b,
        status: newStatus,
        adminNotes: adminNotes !== undefined ? adminNotes : b.adminNotes,
        rescheduledTo: rescheduledTo !== undefined ? rescheduledTo : b.rescheduledTo,
      };
      return found;
    }
    return b;
  });

  if (found) {
    saveAllBookings(updated);
  }
  return found;
}

export function updateBookingAdminNote(id: string, note: string): AppointmentBooking | null {
  const all = getAllBookings();
  let found: AppointmentBooking | null = null;
  const updated = all.map((b) => {
    if (b.id === id) {
      found = { ...b, adminNotes: note };
      return found;
    }
    return b;
  });
  if (found) {
    saveAllBookings(updated);
  }
  return found;
}

export function deleteBooking(id: string): boolean {
  const all = getAllBookings();
  const filtered = all.filter((b) => b.id !== id);
  if (filtered.length !== all.length) {
    saveAllBookings(filtered);
    return true;
  }
  return false;
}
