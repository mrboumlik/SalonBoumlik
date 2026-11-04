import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ServicesSection } from './components/ServicesSection';
import { AmenitiesSection } from './components/AmenitiesSection';
import { TeamSection } from './components/TeamSection';
import { LocationSection } from './components/LocationSection';
import { ReviewsSection } from './components/ReviewsSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { BookingModal } from './components/BookingModal';
import { MyAppointmentsModal } from './components/MyAppointmentsModal';
import { BarberService, AppointmentBooking } from './types';
import { SERVICES, SALON_INFO } from './data/barbershopData';
import { Phone, MessageCircle } from 'lucide-react';

function SalonApp() {
  const { lang, t, isRtl } = useLanguage();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isMyAppointmentsOpen, setIsMyAppointmentsOpen] = useState(false);
  
  // Selected services state for interactive checklist
  const [selectedServices, setSelectedServices] = useState<BarberService[]>([
    SERVICES[0], // Haircut
    SERVICES[1], // Beard Trim & Styling
  ]);

  const [selectedBarberId, setSelectedBarberId] = useState<string>('hassan');

  // Stored appointments
  const [appointments, setAppointments] = useState<AppointmentBooking[]>(() => {
    try {
      const stored = localStorage.getItem('salon_boumlik_appointments_v2');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('salon_boumlik_appointments_v2', JSON.stringify(appointments));
    } catch (e) {
      console.error(e);
    }
  }, [appointments]);

  const handleToggleService = (service: BarberService) => {
    const exists = selectedServices.some((s) => s.id === service.id);
    if (exists) {
      if (selectedServices.length > 1) {
        setSelectedServices(selectedServices.filter((s) => s.id !== service.id));
      }
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const handleSelectBarberToBook = (barberId: string) => {
    setSelectedBarberId(barberId);
    setIsBookingOpen(true);
  };

  const handleAppointmentBooked = (newBooking: AppointmentBooking) => {
    setAppointments((prev) => [newBooking, ...prev]);
  };

  const handleCancelAppointment = (id: string) => {
    const confirmText = lang === 'ar' 
      ? 'هل ترغب في حذف هذا الموعد؟' 
      : lang === 'amz' 
      ? 'ⵉⵙ ⵜⵔⵉⴷ ⴰⴷ ⵜⴽⴽⵙⴷ ⴰⵙⵔⵓⵙ ⴰⴷ?' 
      : lang === 'en' 
      ? 'Do you want to delete this appointment request?' 
      : 'Voulez-vous supprimer cette demande ?';
    if (window.confirm(confirmText)) {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  return (
    <div className={`min-h-screen bg-[#08090C] text-zinc-100 flex flex-col font-body selection:bg-amber-500/30 selection:text-amber-200 ${
      isRtl ? 'font-arabic' : ''
    }`}>
      
      {/* Sticky Luxury Header */}
      <Navbar
        onOpenBooking={() => setIsBookingOpen(true)}
        onOpenMyAppointments={() => setIsMyAppointmentsOpen(true)}
        savedAppointmentsCount={appointments.length}
      />

      {/* Main Content */}
      <main className="flex-1">
        {/* 1. Hero & Branding with Slogan, Poster, Men's Services Only */}
        <Hero onOpenBooking={() => setIsBookingOpen(true)} />

        {/* 2. Dynamic Interactive Menu & Services (NO Fixed Prices, Multi-Selection) */}
        <ServicesSection
          selectedServices={selectedServices}
          onToggleService={handleToggleService}
          onProceedToBooking={() => setIsBookingOpen(true)}
        />

        {/* 3. Amenities, Comfort, Wi-Fi & Waiting Lounge */}
        <AmenitiesSection />

        {/* 4. Team Members: Hassan (Owner), Anouar Arif, Lahcen Lhanz, Mounir Qurdeny */}
        <TeamSection onSelectBarberToBook={handleSelectBarberToBook} />

        {/* 5. Exact Location & Google Maps (2nd Floor, above Dental Tech & ITRI Bakery) */}
        <LocationSection onOpenBooking={() => setIsBookingOpen(true)} />

        {/* 6. Customer Reviews, Ratings & Google Reviews QR Card */}
        <ReviewsSection />

        {/* 7. Contact, Social Media & Official QR Codes (WhatsApp, Instagram, Facebook, Wi-Fi) */}
        <ContactSection />
      </main>

      {/* Footer */}
      <Footer onOpenBooking={() => setIsBookingOpen(true)} />

      {/* Floating Mobile Action Bar */}
      <aside 
        aria-label="Actions rapides" 
        className="sm:hidden fixed bottom-3 left-3 right-3 z-40 bg-zinc-950/95 backdrop-blur-md p-2 rounded-2xl border border-amber-500/30 shadow-2xl flex items-center justify-between gap-2"
      >
        <a
          href={`tel:${SALON_INFO.phone}`}
          className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5"
        >
          <Phone className="w-3.5 h-3.5 text-amber-400" />
          <span>0635392503</span>
        </a>

        <button
          onClick={() => setIsBookingOpen(true)}
          className="flex-[1.8] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-400/20 active:scale-95 transition-transform"
        >
          <MessageCircle className="w-4 h-4 fill-zinc-950" />
          <span>
            {lang === 'ar' 
              ? 'طلب السعر والحجز' 
              : lang === 'amz' 
              ? 'ⴰⵙⵔⵓⵙ ⴳ ⵡⴰⵜⵙⴰⴱ' 
              : lang === 'en' 
              ? 'WhatsApp Quote' 
              : 'Devis sur WhatsApp'}
          </span>
        </button>
      </aside>

      {/* Booking & WhatsApp Quote Modal */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        selectedServices={selectedServices}
        onToggleService={handleToggleService}
        selectedBarberId={selectedBarberId}
        onAppointmentBooked={handleAppointmentBooked}
      />

      {/* My Appointments / Saved Quotes Modal */}
      <MyAppointmentsModal
        isOpen={isMyAppointmentsOpen}
        onClose={() => setIsMyAppointmentsOpen(false)}
        appointments={appointments}
        onCancelAppointment={handleCancelAppointment}
        onOpenBooking={() => setIsBookingOpen(true)}
      />

    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <SalonApp />
    </LanguageProvider>
  );
}
