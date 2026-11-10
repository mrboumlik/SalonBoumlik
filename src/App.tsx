import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ServicesSection } from './components/ServicesSection';
import { BookingSection } from './components/BookingSection';
import { ReviewsSection } from './components/ReviewsSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { DrawerMenu } from './components/DrawerMenu';
import { TrackBookingModal } from './components/TrackBookingModal';
import { AdminDashboard } from './components/AdminDashboard';
import { calculateCartPricing } from './utils/pricingEngine';
import { HairColorConfig, AppointmentBooking } from './types';
import { Phone, MessageCircle, Ticket } from 'lucide-react';
import { SALON_INFO } from './data/barbershopData';

function SalonBoumlikApp() {
  const { lang, t, isRtl } = useLanguage();

  // Modals & Panels
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTrackBookingOpen, setIsTrackBookingOpen] = useState(false);
  const [trackSearchInitial, setTrackSearchInitial] = useState('');
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Live Cart State for Services
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(['haircut', 'beard']);
  const [colorConfig, setColorConfig] = useState<HairColorConfig>({
    tone: 'grey_white',
    coverage: 'full',
  });
  const [proteinPrice, setProteinPrice] = useState<number>(200);

  // Barber state for Booking
  const [selectedBarberId, setSelectedBarberId] = useState<string>('hassan');

  // Dynamic Pricing Calculation
  const pricingResult = calculateCartPricing({
    selectedIds: selectedServiceIds,
    colorConfig,
    proteinPrice,
    lang,
  });

  // Check URL hash for admin route (/admin or #admin)
  useEffect(() => {
    const handleHash = () => {
      const path = window.location.hash.toLowerCase() || window.location.pathname.toLowerCase();
      if (path.includes('admin')) {
        setIsAdminOpen(true);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleToggleServiceId = (id: string) => {
    setSelectedServiceIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleScrollToBooking = () => {
    const el = document.getElementById('booking');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenTrackWithTicket = (ticket: string) => {
    setTrackSearchInitial(ticket);
    setIsTrackBookingOpen(true);
  };

  return (
    <div
      className={`min-h-screen bg-black text-zinc-100 flex flex-col font-body selection:bg-red-600/30 selection:text-white overflow-x-hidden relative ${
        isRtl ? 'font-arabic' : ''
      }`}
    >
      {/* Global Brand Watermark (Fixed, Non-intrusive, Pointer-events-none) */}
      <div 
        aria-hidden="true" 
        className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden select-none"
      >
        <img
          src={SALON_INFO.media.logoClean}
          alt=""
          className="w-[500px] sm:w-[700px] lg:w-[880px] max-w-none opacity-[0.03] filter grayscale contrast-125 dark:invert pointer-events-none"
        />
      </div>

      {/* 1. Sticky Navigation Header */}
      <Navbar
        onOpenBooking={handleScrollToBooking}
        onOpenTrackBooking={() => {
          setTrackSearchInitial('');
          setIsTrackBookingOpen(true);
        }}
        onOpenDrawerMenu={() => setIsDrawerOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* 2. Main Content: ONLY Hero, Services & Live Cart, Booking Form, Google Reviews, Contact */}
      <main className="flex-1">
        {/* 1. Hero Section */}
        <Hero
          onOpenBooking={handleScrollToBooking}
          onOpenTrackBooking={() => {
            setTrackSearchInitial('');
            setIsTrackBookingOpen(true);
          }}
        />

        {/* 2. Priority Above-The-Fold: Direct Booking Form */}
        <BookingSection
          pricingResult={pricingResult}
          selectedBarberId={selectedBarberId}
          onSelectBarberId={setSelectedBarberId}
          selectedServiceIds={selectedServiceIds}
          onToggleServiceId={handleToggleServiceId}
          onOpenTrackBooking={handleOpenTrackWithTicket}
        />

        {/* 3. Detailed Services & Live Cart Explorer */}
        <ServicesSection
          selectedIds={selectedServiceIds}
          onToggleServiceId={handleToggleServiceId}
          colorConfig={colorConfig}
          onChangeColorConfig={setColorConfig}
          proteinPrice={proteinPrice}
          onChangeProteinPrice={setProteinPrice}
          pricingResult={pricingResult}
          onProceedToBooking={handleScrollToBooking}
        />

        {/* Google Reviews 5.0 Widget Section */}
        <ReviewsSection />

        {/* Contact & Socials Section */}
        <ContactSection />
      </main>

      {/* 3. Footer */}
      <Footer
        onOpenBooking={handleScrollToBooking}
        onOpenTrackBooking={() => {
          setTrackSearchInitial('');
          setIsTrackBookingOpen(true);
        }}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* 4. Slide-Out Hamburger Drawer Menu (Team Bios, Gallery, Wi-Fi, Location) */}
      <DrawerMenu
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenAdmin={() => {
          setIsDrawerOpen(false);
          setIsAdminOpen(true);
        }}
        onSelectBarberForBooking={(barberId) => {
          setSelectedBarberId(barberId);
          handleScrollToBooking();
        }}
      />

      {/* 5. Real-Time Track Booking Modal */}
      <TrackBookingModal
        isOpen={isTrackBookingOpen}
        onClose={() => setIsTrackBookingOpen(false)}
        initialSearch={trackSearchInitial}
      />

      {/* 6. Hidden Admin Dashboard (Protected by PIN) */}
      <AdminDashboard
        isOpen={isAdminOpen}
        onClose={() => {
          setIsAdminOpen(false);
          if (window.location.hash.includes('admin')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
      />

      {/* 7. Floating Mobile Quick Action Bar */}
      <aside 
        aria-label="Actions rapides" 
        className="sm:hidden fixed bottom-3 left-3 right-3 z-40 bg-black/95 backdrop-blur-md p-2 rounded-2xl border border-zinc-800 shadow-2xl flex items-center justify-between gap-2"
      >
        <a
          href={`tel:${SALON_INFO.phone}`}
          className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-white flex items-center justify-center gap-1.5"
        >
          <Phone className="w-3.5 h-3.5 text-red-500" />
          <span dir="ltr" className="inline-block font-mono">06 35 39 25 03</span>
        </a>

        <button
          onClick={() => {
            setTrackSearchInitial('');
            setIsTrackBookingOpen(true);
          }}
          className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-blue-400 hover:text-white"
          title="Suivre ma réservation"
        >
          <Ticket className="w-4 h-4" />
        </button>

        <button
          onClick={handleScrollToBooking}
          className="flex-[1.5] py-2.5 px-3 rounded-xl bg-red-600 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30 transition-transform"
        >
          <MessageCircle className="w-4 h-4 fill-white" />
          <span>{lang === 'ar' ? 'حجز موعد' : 'Réserver'}</span>
        </button>
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SalonBoumlikApp />
      </LanguageProvider>
    </ThemeProvider>
  );
}
