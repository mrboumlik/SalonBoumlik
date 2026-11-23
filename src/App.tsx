import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ServicesSection } from './components/ServicesSection';
import { LoyaltyProgramSection } from './components/LoyaltyProgramSection';
import { BookingSection } from './components/BookingSection';
import { TeamSection } from './components/TeamSection';
import { ReviewsSection } from './components/ReviewsSection';
import { FAQSection } from './components/FAQSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { PublicInfoModal, PublicInfoSection } from './components/PublicInfoModal';
import { DrawerMenu, HomepageSectionKey } from './components/DrawerMenu';
import { TrackBookingModal } from './components/TrackBookingModal';
import { AdminDashboard } from './components/AdminDashboard';
import { ToastContainer } from './components/ToastContainer';
import { ModalPortal } from './components/ModalPortal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { FloatingWhatsAppButton } from './components/FloatingWhatsAppButton';
import {
  getRememberedPhones,
  useClientAppointmentReminders,
} from './utils/clientReminderWatcher';
import { calculateCartPricing } from './utils/pricingEngine';
import {
  resolveEffectiveServicePrices,
  useShopPricingConfig,
} from './utils/shopPricingStore';
import { HairColorConfig } from './types';
import {
  Phone,
  Ticket,
  AlertTriangle,
  RotateCcw,
  Scissors,
  Crown,
  Users,
  Star,
  HelpCircle,
  QrCode,
  ChevronDown,
  X,
} from 'lucide-react';
import { SALON_INFO } from './data/barbershopData';
import { pickLang } from './utils/i18n';
import {
  formatSalonDisplayPhone,
  normalizeSalonTelHref,
  useSalonProfileSettings,
} from './utils/salonSettingsStore';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Salon Boumlik UI ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF9F6] dark:bg-[#0B0C10] text-slate-900 dark:text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#13151B] border border-red-200 dark:border-red-500/40 p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-black font-display">Salon Boumlik</h1>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              حدث خطأ في العرض / Une erreur d’affichage est survenue.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة التحميل / Recharger</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function SalonBoumlikApp() {
  const { lang, isRtl } = useLanguage();
  const salonSettings = useSalonProfileSettings();

  // Modals & Panels
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isTrackBookingOpen, setIsTrackBookingOpen] = useState(false);
  const [trackSearchInitial, setTrackSearchInitial] = useState('');
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [activePublicInfo, setActivePublicInfo] = useState<PublicInfoSection | null>(null);

  // All homepage content sections collapsed/hidden by default until clicked
  const [expandedSections, setExpandedSections] = useState<
    Record<HomepageSectionKey, boolean>
  >({
    services: false,
    loyalty: false,
    team: false,
    reviews: false,
    faq: false,
    contact: false,
  });

  // Live Cart State for Services
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(['haircut', 'beard']);
  const [colorConfig, setColorConfig] = useState<HairColorConfig>({
    tone: 'grey_white',
    coverage: 'full',
  });
  const [proteinPrice, setProteinPrice] = useState<number>(200);

  // Barber state for Booking
  const [selectedBarberId, setSelectedBarberId] = useState<string>('hassan');

  // Shared client phone across BookingSection & LoyaltyProgramSection
  const [activeClientPhone, setActiveClientPhone] = useState<string>(() => {
    const phones = getRememberedPhones();
    return phones.length > 0 ? phones[phones.length - 1] : '';
  });

  const shopPricingConfig = useShopPricingConfig();
  const nowLocal = new Date();
  const todayLocalStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
  const todayShopPricing = resolveEffectiveServicePrices({
    dateStr: todayLocalStr,
    shopConfig: shopPricingConfig,
  });

  const hiddenServiceSet = new Set(shopPricingConfig.hiddenServiceIds || []);
  const activeSelectedServiceIds = selectedServiceIds.filter((id) => !hiddenServiceSet.has(id));

  // Dynamic Pricing Calculation (live global shop prices + today's special day rules + bundles + hidden services)
  const pricingResult = calculateCartPricing({
    selectedIds: activeSelectedServiceIds,
    colorConfig,
    proteinPrice,
    lang,
    effectiveServicePrices: todayShopPricing.priceMap,
    specialRuleLabel: todayShopPricing.activeSpecialRuleLabels[0],
    hiddenServiceIds: shopPricingConfig.hiddenServiceIds,
    serviceBundles: shopPricingConfig.serviceBundles,
  });

  // Keep live PWA reminder notifications active for tracked client tickets
  useClientAppointmentReminders(lang);

  // Check URL hash for admin route (#admin) or ticket tracking deep-link (#track=SB-XXXX)
  useEffect(() => {
    const handleHash = () => {
      const rawHash = window.location.hash || '';
      const path = rawHash.toLowerCase() || window.location.pathname.toLowerCase();
      if (path.includes('admin')) {
        setIsAdminOpen(true);
      } else if (rawHash.toLowerCase().includes('checkin=')) {
        const ticket = decodeURIComponent(rawHash.split(/checkin=/i)[1].split('&')[0]).trim();
        if (ticket) {
          setTrackSearchInitial(ticket);
          setIsTrackBookingOpen(true);
        }
      } else if (rawHash.toLowerCase().includes('track=')) {
        const ticket = decodeURIComponent(rawHash.split(/track=/i)[1].split('&')[0]).trim();
        if (ticket) {
          setTrackSearchInitial(ticket);
          setIsTrackBookingOpen(true);
        }
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Close Booking Modal on Escape key
  useEffect(() => {
    if (!isBookingModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsBookingModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBookingModalOpen]);

  const handleToggleServiceId = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectServiceForBooking = (id: string) => {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setIsDrawerOpen(false);
    setIsBookingModalOpen(true);
  };

  const handleOpenBookingModal = () => {
    setIsBookingModalOpen(true);
  };

  const handleOpenTrackWithTicket = (ticket: string) => {
    setIsBookingModalOpen(false);
    setTrackSearchInitial(ticket);
    setIsTrackBookingOpen(true);
  };

  const toggleSectionCard = (key: HomepageSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleNavigateToSection = (sectionId: HomepageSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: true,
    }));
    setTimeout(() => {
      const el = document.getElementById(`section-${sectionId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  const sectionItems: {
    key: HomepageSectionKey;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
    renderContent: () => React.ReactNode;
  }[] = [
    {
      key: 'services',
      icon: Scissors,
      title: pickLang(lang, {
        ar: 'الخدمات والأثمنة',
        fr: 'Services & Tarifs',
        amz: 'ⵜⵉⵏⴰⴼⵓⵜⵉⵏ ⴷ ⵡⴰⵜⵉⴳⵏ',
        en: 'Services & Pricing',
        es: 'Servicios y tarifas',
      }),
      subtitle: pickLang(lang, {
        ar: 'تصفح الخدمات، الباقات وتوصيات الحلاقين',
        fr: 'Prestations, combos et favoris de l’équipe',
        amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ, ⵉⵙⵏⴼⵍⵏ ⴷ ⵉⵙⵜⴰⵢⵏ ⵏ ⵉⵎⴽⵔⴰⴹⵏ',
        en: 'Full grooming menu, bundles & staff favorites',
        es: 'Menú completo, combos y favoritos',
      }),
      renderContent: () => (
        <ServicesSection
          selectedIds={selectedServiceIds}
          onToggleServiceId={handleToggleServiceId}
          colorConfig={colorConfig}
          onChangeColorConfig={setColorConfig}
          proteinPrice={proteinPrice}
          onChangeProteinPrice={setProteinPrice}
          pricingResult={pricingResult}
          onProceedToBooking={handleOpenBookingModal}
        />
      ),
    },
    {
      key: 'loyalty',
      icon: Crown,
      title: pickLang(lang, {
        ar: 'برنامج الولاء والنقاط',
        fr: 'Programme Fidélité & Points',
        amz: 'ⵜⴰⵖⵓⵏⵉ ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ',
        en: 'Loyalty Program & Rewards',
        es: 'Programa de fidelidad',
      }),
      subtitle: pickLang(lang, {
        ar: 'تتبع نقاطك واقترب من الحلاقة المجانية',
        fr: 'Suivez vos points et votre coupe offerte',
        amz: 'ⴹⴼⵕ ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵏⵏⴽ ⵉ ⵓⵣⵣⴰⵔ ⴼⴰⴱⵓⵔ',
        en: 'Track your points toward a free haircut',
        es: 'Sigue tus puntos y cortes gratis',
      }),
      renderContent: () => (
        <LoyaltyProgramSection
          activeClientPhone={activeClientPhone}
          onClientIdentified={(phone) => setActiveClientPhone(phone)}
          onClearClient={() => setActiveClientPhone('')}
          onOpenBooking={handleOpenBookingModal}
          onOpenTrackBooking={(query) => handleOpenTrackWithTicket(query || '')}
        />
      ),
    },
    {
      key: 'team',
      icon: Users,
      title: pickLang(lang, {
        ar: 'فريق الحلاقين',
        fr: 'Notre Équipe de Barbiers',
        amz: 'ⵜⴰⵔⴰⴱⴱⵓⵜ ⵏ ⵉⵎⴽⵔⴰⴹⵏ',
        en: 'Our Barbers Team',
        es: 'Equipo de Barberos',
      }),
      subtitle: pickLang(lang, {
        ar: 'جميع الحلاقين يتقنون كافة الخدمات بنفس الجودة',
        fr: 'Tous nos barbiers maîtrisent toutes les prestations',
        amz: 'ⵎⴰⵕⵕⴰ ⵉⵎⴽⵔⴰⴹⵏ ⵙⵙⵏⵏ ⵉ ⵜⵡⵓⵔⵉⵡⵉⵏ ⴰⴽⴽⵯ',
        en: 'All barbers deliver every grooming service equally',
        es: 'Todos los barberos dominan cada servicio',
      }),
      renderContent: () => (
        <TeamSection
          onSelectBarberToBook={(barberId) => {
            setSelectedBarberId(barberId);
            handleOpenBookingModal();
          }}
        />
      ),
    },
    {
      key: 'reviews',
      icon: Star,
      title: pickLang(lang, {
        ar: 'آراء وتقييمات الزبناء',
        fr: 'Avis Clients Google 5.0',
        amz: 'ⵉⵙⵓⵜⴰⴳ ⵏ ⵉⵎⵣⴷⴰⵖ',
        en: 'Google Reviews 5.0',
        es: 'Reseñas Google 5.0',
      }),
      subtitle: pickLang(lang, {
        ar: 'تقييم 5.0 ★ في تارودانت وشهادات الزبناء',
        fr: 'Note 5.0 ★ vérifiée à Taroudant',
        amz: 'ⵜⴰⵏⵏⴰⵢⵉⵏ 5.0 ★ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ',
        en: 'Verified 5.0 ★ client testimonials in Taroudant',
        es: 'Opiniones verificadas 5.0 ★ en Taroudant',
      }),
      renderContent: () => <ReviewsSection />,
    },
    {
      key: 'faq',
      icon: HelpCircle,
      title: pickLang(lang, {
        ar: 'الأسئلة الشائعة والسياسات',
        fr: 'FAQ & Politiques du Salon',
        amz: 'ⵉⵙⵇⵙⵉⵜⵏ ⴷ ⵉⵍⵓⴳⴰⵏ',
        en: 'FAQ & Salon Policies',
        es: 'Preguntas frecuentes',
      }),
      subtitle: pickLang(lang, {
        ar: 'معلومات الحجز، الساعات، الموقع بتارودانت والسياسات',
        fr: 'Horaires, réservation, Taroudant & règles du salon',
        amz: 'ⵉⵎⵉⵔⵏ, ⴰⵙⵔⵓⵙ, ⵜⴰⵔⵓⴷⴰⵏⵜ ⴷ ⵉⵍⵓⴳⴰⵏ',
        en: 'Booking rules, Taroudant hours, CIH & policies',
        es: 'Horarios, reservas y políticas del salón',
      }),
      renderContent: () => <FAQSection />,
    },
    {
      key: 'contact',
      icon: QrCode,
      title: pickLang(lang, {
        ar: 'التواصل، الشبكات والباركود',
        fr: 'Contact, Réseaux & QR Codes',
        amz: 'ⴰⵎⵢⴰⵡⴰⴹ ⴷ ⴱⴰⵔⴽⵓⴷ',
        en: 'Contact, Socials & QR Codes',
        es: 'Contacto, Redes y QR',
      }),
      subtitle: pickLang(lang, {
        ar: 'رموز QR، الواتساب المباشر، البريد والرسائل',
        fr: 'QR officiels, WhatsApp direct, Gmail & message',
        amz: 'ⴱⴰⵔⴽⵓⴷ, ⵡⴰⵜⵙⴰⴱ, ⵉⵎⵉⵢⵍ ⴷ ⵓⵎⵢⴰⵡⴰⴹ',
        en: 'Official QR codes, WhatsApp, Gmail & message form',
        es: 'Códigos QR, WhatsApp, Gmail y formulario',
      }),
      renderContent: () => <ContactSection />,
    },
  ];

  const ui = {
    bookingModalTitle: pickLang(lang, {
      ar: 'حجز موعد — صالون بومليك',
      fr: 'Prendre Rendez-vous — Salon Boumlik',
      amz: 'ⵃⵊⵣ ⴰⵙⵉⵀⵍ — ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ',
      en: 'Book Appointment — Salon Boumlik',
      es: 'Reservar Cita — Salon Boumlik',
    }),
    closeModalAria: pickLang(lang, {
      ar: 'إغلاق نافذة الحجز',
      fr: 'Fermer la fenêtre de réservation',
      amz: 'ⵇⵇⵏ',
      en: 'Close booking window',
      es: 'Cerrar reserva',
    }),
    mobileTrackTitle: pickLang(lang, {
      ar: 'تتبع حجزي',
      fr: 'Suivre ma réservation',
      amz: 'ⴹⴼⵕ ⴰⵙⵉⵀⵍ',
      en: 'Track Booking',
      es: 'Seguir reserva',
    }),
    mobileTrackShort: pickLang(lang, {
      ar: 'تتبّع',
      fr: 'Suivi',
      amz: 'ⴹⴼⵕ',
      en: 'Track',
      es: 'Seguir',
    }),
    mobileCallAria: pickLang(lang, {
      ar: 'اتصال بالصالون',
      fr: 'Appeler le salon',
      amz: 'ⵜⵉⵍⵉⴼⵓⵏ',
      en: 'Call salon',
      es: 'Llamar al salón',
    }),
    mobileBookLabel: pickLang(lang, {
      ar: 'احجز موعد',
      fr: 'Réserver',
      amz: 'ⵃⵊⵣ',
      en: 'Book Now',
      es: 'Reservar',
    }),
    mobileBarAria: pickLang(lang, {
      ar: 'إجراءات سريعة',
      fr: 'Actions rapides',
      amz: 'ⵉⵙⵡⵓⵔⵉⵜⵏ ⵉⵣⵔⴱⵏ',
      en: 'Quick actions',
      es: 'Acciones rápidas',
    }),
  };

  return (
    <div
      className={`min-h-screen bg-[#FAF9F6] dark:bg-[#0B0C10] text-slate-900 dark:text-zinc-100 flex flex-col font-body selection:bg-amber-500/20 dark:selection:bg-amber-500/30 selection:text-slate-950 dark:selection:text-white overflow-x-hidden relative transition-colors duration-200 ${
        isRtl ? 'font-arabic' : ''
      }`}
    >
      {/* Subtle Brand Watermark */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden select-none"
      >
        <img
          src={SALON_INFO.media.logoClean}
          alt=""
          className="w-[460px] sm:w-[680px] lg:w-[860px] max-w-none opacity-[0.035] dark:opacity-[0.025] filter grayscale contrast-125 dark:invert pointer-events-none"
        />
      </div>

      {/* Global Alerts & Connectivity Indicator */}
      <ToastContainer />
      <OfflineIndicator />

      {/* 1. Minimal Top Navigation Bar */}
      <Navbar
        onOpenBooking={handleOpenBookingModal}
        onOpenTrackBooking={() => {
          setTrackSearchInitial('');
          setIsTrackBookingOpen(true);
        }}
        onOpenDrawerMenu={() => setIsDrawerOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* 2. Compact Main Homepage: Concise Action Card + Collapsed Section Headers */}
      <main className="flex-1 relative z-10 pb-24 sm:pb-12">
        <Hero
          onOpenBooking={handleOpenBookingModal}
          onOpenTrackBooking={() => {
            setTrackSearchInitial('');
            setIsTrackBookingOpen(true);
          }}
        />

        {/* Collapsible Homepage Sections (Hidden Until Clicked) */}
        <MotionConfig reducedMotion="user">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-3">
            {sectionItems.map((section) => {
              const Icon = section.icon;
              const isOpen = expandedSections[section.key];
              return (
                <div
                  key={section.key}
                  id={`section-${section.key}`}
                  className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 overflow-hidden shadow-2xs transition-colors"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleSectionCard(section.key)}
                    className="w-full min-h-[68px] px-4 sm:px-5 py-4 flex items-center justify-between gap-3 text-start hover:bg-stone-50/90 dark:hover:bg-zinc-900/50 active:scale-[0.995] transition-all duration-150 cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug truncate">
                          {section.title}
                        </h2>
                        <p className="text-[11px] sm:text-xs text-stone-500 dark:text-zinc-400 truncate mt-0.5">
                          {section.subtitle}
                        </p>
                      </div>
                    </div>

                    <ChevronDown
                      className={`w-5 h-5 flex-shrink-0 text-stone-400 dark:text-zinc-500 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isOpen ? 'rotate-180 text-amber-600 dark:text-amber-400' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key={`section-content-${section.key}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{
                          height: 'auto',
                          opacity: 1,
                          transition: {
                            height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                            opacity: { duration: 0.24, delay: 0.05 },
                          },
                        }}
                        exit={{
                          height: 0,
                          opacity: 0,
                          transition: {
                            height: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
                            opacity: { duration: 0.16 },
                          },
                        }}
                        className="overflow-hidden border-t border-stone-200 dark:border-zinc-800"
                      >
                        <motion.div
                          initial={{ y: -10 }}
                          animate={{
                            y: 0,
                            transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
                          }}
                          exit={{
                            y: -10,
                            transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
                          }}
                        >
                          {section.renderContent()}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </MotionConfig>
      </main>

      {/* 3. Footer */}
      <Footer
        onOpenBooking={handleOpenBookingModal}
        onOpenTrackBooking={() => {
          setTrackSearchInitial('');
          setIsTrackBookingOpen(true);
        }}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onNavigateToSection={handleNavigateToSection}
        onOpenInfoModal={(section) => setActivePublicInfo(section)}
      />

      {/* 4. Direct Booking Modal Overlay (Full 6-Step Progressive Wizard) */}
      <ModalPortal>
        <MotionConfig reducedMotion="user">
          <AnimatePresence>
            {isBookingModalOpen && (
              <motion.div
                key="booking-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 sb-modal-backdrop"
                role="dialog"
                aria-modal="true"
                aria-labelledby="booking-modal-heading"
                onClick={() => setIsBookingModalOpen(false)}
              >
                <motion.div
                  key="booking-modal-dialog"
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 14, scale: 0.98 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#0D0F14] border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header Bar */}
                  <div className="px-4 sm:px-6 py-3.5 border-b border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-[#111318] flex items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                        <Scissors className="w-4 h-4" />
                      </div>
                      <h2
                        id="booking-modal-heading"
                        className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate"
                      >
                        {ui.bookingModalTitle}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsBookingModalOpen(false)}
                      aria-label={ui.closeModalAria}
                      className="min-h-[40px] min-w-[40px] p-2 rounded-xl text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Embedded 6-Step Booking Wizard */}
                  <div className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-6">
                    <BookingSection
                      isEmbeddedModal
                      onRequestClose={() => setIsBookingModalOpen(false)}
                      pricingResult={pricingResult}
                      colorConfig={colorConfig}
                      proteinPrice={proteinPrice}
                      selectedBarberId={selectedBarberId}
                      onSelectBarberId={setSelectedBarberId}
                      selectedServiceIds={selectedServiceIds}
                      onToggleServiceId={handleToggleServiceId}
                      onSetServiceIds={setSelectedServiceIds}
                      onBookingConfirmed={(booking) => {
                        if (booking.clientPhone) setActiveClientPhone(booking.clientPhone);
                      }}
                      onClientIdentified={(phone) => setActiveClientPhone(phone)}
                      onOpenTrackBooking={handleOpenTrackWithTicket}
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </MotionConfig>
      </ModalPortal>

      {/* 5. Slide-Out Drawer Menu */}
      <DrawerMenu
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenAdmin={() => {
          setIsDrawerOpen(false);
          setIsAdminOpen(true);
        }}
        onOpenBookingModal={() => {
          setIsDrawerOpen(false);
          handleOpenBookingModal();
        }}
        onNavigateToSection={handleNavigateToSection}
        onOpenTrackBooking={() => {
          setTrackSearchInitial('');
          setIsTrackBookingOpen(true);
        }}
        onSelectBarberForBooking={(barberId) => {
          setSelectedBarberId(barberId);
          handleOpenBookingModal();
        }}
        selectedServiceIds={selectedServiceIds}
        onSelectServiceForBooking={handleSelectServiceForBooking}
      />

      {/* 6. Real-Time Track Booking Modal */}
      <TrackBookingModal
        isOpen={isTrackBookingOpen}
        onClose={() => setIsTrackBookingOpen(false)}
        initialSearch={trackSearchInitial}
      />

      {/* 6b. Public Informational Modal (About, Contact, Privacy, Terms) */}
      <PublicInfoModal
        activeSection={activePublicInfo}
        onSelectSection={setActivePublicInfo}
        onClose={() => setActivePublicInfo(null)}
        onOpenBooking={handleOpenBookingModal}
      />

      {/* 7. Hidden Admin Dashboard (Protected by PIN) */}
      <AdminDashboard
        isOpen={isAdminOpen}
        onClose={() => {
          setIsAdminOpen(false);
          if (window.location.hash.includes('admin')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
        onOpenClientTracking={handleOpenTrackWithTicket}
      />

      {/* 8. Floating Mobile Quick Action Bar */}
      <aside
        aria-label={ui.mobileBarAria}
        className="sm:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto bg-white dark:bg-[#13151B] p-2 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-lg flex items-center gap-2"
      >
        <a
          href={normalizeSalonTelHref(salonSettings.salonPhone)}
          aria-label={ui.mobileCallAria}
          title={formatSalonDisplayPhone(salonSettings.salonPhone)}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-stone-100 hover:bg-stone-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center active:scale-95 transition-all flex-shrink-0"
        >
          <Phone className="w-4 h-4 text-amber-700 dark:text-amber-400" />
        </a>

        <button
          type="button"
          onClick={() => {
            setTrackSearchInitial('');
            setIsTrackBookingOpen(true);
          }}
          className="min-h-[44px] px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
          title={ui.mobileTrackTitle}
          aria-label={ui.mobileTrackTitle}
        >
          <Ticket className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0" />
          <span>{ui.mobileTrackShort}</span>
        </button>

        <button
          type="button"
          onClick={handleOpenBookingModal}
          className="flex-1 min-h-[44px] px-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <Scissors className="w-4 h-4 flex-shrink-0" />
          <span>{ui.mobileBookLabel}</span>
        </button>
      </aside>

      {/* 9. Floating Bottom-Right WhatsApp Quick Message Button */}
      <FloatingWhatsAppButton
        pricingResult={pricingResult}
        selectedBarberId={selectedBarberId}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <SalonBoumlikApp />
        </LanguageProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
