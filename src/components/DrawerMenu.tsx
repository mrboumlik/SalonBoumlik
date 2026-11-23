import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Users,
  Image as ImageIcon,
  Wifi,
  MapPin,
  Lock,
  Phone,
  Instagram,
  ExternalLink,
  Scissors,
  CheckCircle2,
  Copy,
  ChevronDown,
  Check,
  Ticket,
  Gift,
  Star,
  HelpCircle,
  Calendar,
  MessageCircle,
  Search,
  Clock,
  Award,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useSalonProfileSettings } from '../utils/salonSettingsStore';
import { pickLang } from '../utils/i18n';
import { getMergedBarbers, useBarberProfiles } from '../utils/barberProfileStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import { ServiceDefinition } from '../utils/pricingEngine';
import {
  getVisibleBaseServices,
  resolveEffectiveServicePrices,
  useShopPricingConfig,
} from '../utils/shopPricingStore';
import { BarberStaff, Language } from '../types';
import { FlagIcon } from './LanguageFlags';
import { PWAInstallButton } from './PWAInstallButton';

export type HomepageSectionKey =
  | 'services'
  | 'loyalty'
  | 'team'
  | 'reviews'
  | 'faq'
  | 'contact';

type DrawerCategoryKey =
  | 'sections'
  | 'serviceCatalog'
  | 'team'
  | 'gallery'
  | 'wifi'
  | 'location';

type ServiceFilterGroup =
  | 'all'
  | 'hair'
  | 'beard'
  | 'facial'
  | 'treatments'
  | 'color';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdmin: () => void;
  onOpenBookingModal: () => void;
  onNavigateToSection: (sectionId: HomepageSectionKey) => void;
  onOpenTrackBooking?: () => void;
  onSelectBarberForBooking?: (barberId: string) => void;
  selectedServiceIds?: string[];
  onSelectServiceForBooking?: (serviceId: string) => void;
}

interface SmoothCategoryAccordionProps {
  isExpanded: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  iconBoxClassName?: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  children: React.ReactNode;
}

const SmoothCategoryAccordion: React.FC<SmoothCategoryAccordionProps> = ({
  isExpanded,
  onToggle,
  icon,
  iconBoxClassName = 'bg-stone-100 dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300',
  title,
  subtitle,
  badgeText,
  children,
}) => {
  return (
    <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#13151B] overflow-hidden shadow-2xs transition-colors">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="w-full min-h-[54px] p-3.5 flex items-center justify-between gap-3 text-start hover:bg-stone-50 dark:hover:bg-zinc-900/60 active:scale-[0.99] transition-all cursor-pointer touch-manipulation select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors ${iconBoxClassName}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {title}
              </h3>
              {badgeText && (
                <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 flex-shrink-0">
                  {badgeText}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-stone-500 dark:text-zinc-400 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isExpanded ? 'rotate-180 text-amber-600 dark:text-amber-400' : ''
          }`}
        />
      </button>

      {/* Smooth Framer Motion slide & height expand/collapse animation */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="accordion-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.22, delay: 0.04 },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.14 },
              },
            }}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ y: -8 }}
              animate={{
                y: 0,
                transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
              }}
              exit={{
                y: -8,
                transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
              }}
              className="p-3.5 pt-2.5 border-t border-stone-200 dark:border-zinc-800"
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const DrawerMenu: React.FC<DrawerMenuProps> = ({
  isOpen,
  onClose,
  onOpenAdmin,
  onOpenBookingModal,
  onNavigateToSection,
  onOpenTrackBooking,
  onSelectBarberForBooking,
  selectedServiceIds = [],
  onSelectServiceForBooking,
}) => {
  const { lang, setLang, isRtl } = useLanguage();
  const { isDark, setTheme } = useTheme();
  const salonSettings = useSalonProfileSettings();
  const shopPricingConfig = useShopPricingConfig();
  const barberRoster = useBarberRoster();
  const barberProfiles = useBarberProfiles();
  const mergedBarbers = useMemo(
    () => getMergedBarbers(barberProfiles, barberRoster),
    [barberProfiles, barberRoster]
  );

  const nowLocal = new Date();
  const todayLocalStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
  const resolvedTodayPricing = resolveEffectiveServicePrices({
    dateStr: todayLocalStr,
    shopConfig: shopPricingConfig,
  });

  const [expandedCategories, setExpandedCategories] = useState<
    Record<DrawerCategoryKey, boolean>
  >({
    sections: true,
    serviceCatalog: false,
    team: false,
    gallery: false,
    wifi: false,
    location: false,
  });
  const [serviceSearch, setServiceSearch] = useState('');
  const [activeServiceGroup, setActiveServiceGroup] = useState<ServiceFilterGroup>('all');
  const [wifiCopied, setWifiCopied] = useState(false);

  // Close drawer on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const trimmedQuery = serviceSearch.trim().toLowerCase();

  const visibleServices = useMemo(
    () => getVisibleBaseServices(shopPricingConfig),
    [shopPricingConfig]
  );

  const matchingServices = useMemo(() => {
    if (!trimmedQuery) return [];
    return visibleServices.filter((srv) => {
      const searchableChunks = [
        srv.id,
        srv.category,
        srv.name.ar,
        srv.name.fr,
        srv.name.en,
        srv.name.amz,
        srv.name.es,
        srv.description.ar,
        srv.description.fr,
        srv.description.en,
        srv.description.amz,
        srv.description.es,
      ];
      return searchableChunks.some((txt) => txt.toLowerCase().includes(trimmedQuery));
    });
  }, [trimmedQuery, visibleServices]);

  const categorizedServices = useMemo(() => {
    return visibleServices.filter((srv) => {
      if (activeServiceGroup === 'all') return true;
      if (activeServiceGroup === 'hair') return srv.category === 'haircut' || srv.category === 'wash';
      if (activeServiceGroup === 'beard') return srv.category === 'beard';
      if (activeServiceGroup === 'facial') return srv.category === 'facial';
      if (activeServiceGroup === 'treatments') return srv.category === 'protein' || srv.category === 'relaxing';
      if (activeServiceGroup === 'color') return srv.category === 'color';
      return true;
    });
  }, [activeServiceGroup, visibleServices]);

  const quickLangOptions: { code: Language; label: string }[] = [
    { code: 'ar', label: 'عربي' },
    { code: 'fr', label: 'FR' },
    { code: 'en', label: 'EN' },
    { code: 'amz', label: 'ⵜⵎⵣ' },
    { code: 'es', label: 'ES' },
  ];

  const toggleCategory = (category: DrawerCategoryKey) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleCloseDrawer = () => {
    setServiceSearch('');
    onClose();
  };

  const copyWifiPassword = () => {
    navigator.clipboard.writeText(SALON_INFO.media.wifiPassword);
    setWifiCopied(true);
    setTimeout(() => setWifiCopied(false), 2000);
  };

  const formatServicePrice = (srv: ServiceDefinition) => {
    const resolvedPrice = resolvedTodayPricing.priceMap[srv.id] ?? srv.basePrice;
    if (srv.id === 'protein' && resolvedPrice === 200) return '200+ MAD';
    if (srv.id === 'hair-color' && resolvedPrice === 150) return '50–150 MAD';
    return `${resolvedPrice} MAD`;
  };

  const formatDuration = (mins: number) =>
    pickLang(lang, {
      ar: `${mins} د`,
      fr: `${mins} min`,
      amz: `${mins} ⵜⵓⵙⴷⵉⴷⵜ`,
      en: `${mins} min`,
      es: `${mins} min`,
    });

  const handlePickService = (srv: ServiceDefinition) => {
    if (onSelectServiceForBooking) {
      setServiceSearch('');
      onSelectServiceForBooking(srv.id);
    } else {
      handleCloseDrawer();
      onNavigateToSection('services');
    }
  };

  const galleryPhotos = [
    {
      src: SALON_INFO.media.logoClean,
      alt: 'Salon Boumlik Interior and Style',
    },
    {
      src: '/assets/aistudio/IMG-20240103-WA0029_222599c1.jpg',
      alt: 'Precision Beard Sculpting',
    },
    {
      src: '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
      alt: 'Clean Razor Line-up',
    },
    {
      src: '/assets/aistudio/IMG-20231231-WA0004_393afdd0.jpg',
      alt: 'Salon Boumlik Atmosphere',
    },
  ];

  const serviceFilterGroups: { id: ServiceFilterGroup; label: string }[] = [
    {
      id: 'all',
      label: pickLang(lang, { ar: 'الكل', fr: 'Tout', amz: 'ⴰⴽⴽⵯ', en: 'All', es: 'Todo' }),
    },
    {
      id: 'hair',
      label: pickLang(lang, { ar: 'الشعر', fr: 'Cheveux', amz: 'ⵓⵣⵣⴰⵔ', en: 'Hair', es: 'Pelo' }),
    },
    {
      id: 'beard',
      label: pickLang(lang, { ar: 'اللحية', fr: 'Barbe', amz: 'ⵜⴰⵎⴰⵔⵜ', en: 'Beard', es: 'Barba' }),
    },
    {
      id: 'facial',
      label: pickLang(lang, { ar: 'الوجه', fr: 'Visage', amz: 'ⵓⴷⵎ', en: 'Facial', es: 'Facial' }),
    },
    {
      id: 'treatments',
      label: pickLang(lang, { ar: 'بروتين', fr: 'Soins', amz: 'ⴰⵙⵓⵊⵊⵉ', en: 'Treatments', es: 'Tratamientos' }),
    },
    {
      id: 'color',
      label: pickLang(lang, { ar: 'صباغة', fr: 'Couleur', amz: 'ⴰⴽⵍⵓ', en: 'Color', es: 'Color' }),
    },
  ];

  const sectionShortcuts: { id: HomepageSectionKey; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    {
      id: 'services',
      icon: Scissors,
      label: pickLang(lang, {
        ar: 'الخدمات والأثمنة',
        fr: 'Services & Tarifs',
        amz: 'ⵜⵉⵏⴰⴼⵓⵜⵉⵏ',
        en: 'Services & Prices',
        es: 'Servicios y tarifas',
      }),
    },
    {
      id: 'loyalty',
      icon: Gift,
      label: pickLang(lang, {
        ar: 'برنامج الولاء',
        fr: 'Programme Fidélité',
        amz: 'ⵜⴰⵖⵓⵏⵉ',
        en: 'Loyalty Program',
        es: 'Fidelidad',
      }),
    },
    {
      id: 'team',
      icon: Users,
      label: pickLang(lang, {
        ar: 'فريق الحلاقين',
        fr: 'Équipe de Barbiers',
        amz: 'ⵜⴰⵔⴰⴱⴱⵓⵜ',
        en: 'Barbers Team',
        es: 'Nuestro Equipo',
      }),
    },
    {
      id: 'reviews',
      icon: Star,
      label: pickLang(lang, {
        ar: 'آراء الزبناء',
        fr: 'Avis Google 5.0',
        amz: 'ⵉⵙⵓⵜⴰⴳ',
        en: 'Client Reviews',
        es: 'Reseñas Google',
      }),
    },
    {
      id: 'faq',
      icon: HelpCircle,
      label: pickLang(lang, {
        ar: 'الأسئلة الشائعة',
        fr: 'FAQ & Règles',
        amz: 'ⵉⵙⵇⵙⵉⵜⵏ',
        en: 'FAQ & Policies',
        es: 'Preguntas',
      }),
    },
    {
      id: 'contact',
      icon: MessageCircle,
      label: pickLang(lang, {
        ar: 'التواصل والباركود',
        fr: 'Contact & QR',
        amz: 'ⴰⵎⵢⴰⵡⴰⴹ',
        en: 'Contact & QR',
        es: 'Contacto y QR',
      }),
    },
  ];

  const labels = {
    closeAria: pickLang(lang, {
      ar: 'إغلاق القائمة',
      fr: 'Fermer le menu',
      amz: 'ⵇⵇⵏ ⵜⴰⵍⴳⴰⵎⵜ',
      en: 'Close menu',
      es: 'Cerrar menú',
    }),
    searchPlaceholder: pickLang(lang, {
      ar: 'ابحث عن خدمة (حسانة، لحية، بروتين...)',
      fr: 'Rechercher un service (coupe, barbe, protéine...)',
      amz: 'ⵔⵣⵓ ⵖⴼ ⵜⵡⵓⵔⵉ (ⵜⴰⴽⵔⴹⴰ, ⵜⴰⵎⴰⵔⵜ...)',
      en: 'Search services (haircut, beard, protein...)',
      es: 'Buscar servicio (corte, barba, proteína...)',
    }),
    clearSearchAria: pickLang(lang, {
      ar: 'مسح البحث',
      fr: 'Effacer la recherche',
      amz: 'ⵙⴼⴰⴹ ⴰⵔⵣⵣⵓ',
      en: 'Clear search',
      es: 'Limpiar búsqueda',
    }),
    searchResultsHeader: pickLang(lang, {
      ar: 'نتائج البحث السريع',
      fr: 'Résultats rapides',
      amz: 'ⵜⵉⵢⴰⴼⵓⵜⵉⵏ ⵏ ⵓⵔⵣⵣⵓ',
      en: 'Quick Search Results',
      es: 'Resultados rápidos',
    }),
    noResults: pickLang(lang, {
      ar: 'لم يتم العثور على خدمة مطابقة لهذا البحث.',
      fr: 'Aucune prestation trouvée pour cette recherche.',
      amz: 'ⵓⵔ ⵜⴻⵜⵜⵓⴼⴰ ⵜⵡⵓⵔⵉ ⵉ ⵓⵔⵣⵣⵓ ⴰⴷ.',
      en: 'No matching services found.',
      es: 'No se encontraron servicios.',
    }),
    resetSearch: pickLang(lang, {
      ar: 'عرض كل الخدمات',
      fr: 'Voir tous les services',
      amz: 'ⵥⵕ ⵎⴰⵕⵕⴰ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ',
      en: 'Show all services',
      es: 'Ver todos los servicios',
    }),
    bookServiceBtn: pickLang(lang, {
      ar: 'احجز الآن',
      fr: 'Réserver',
      amz: 'ⵃⵊⵣ',
      en: 'Book',
      es: 'Reservar',
    }),
    openFullCatalogBtn: pickLang(lang, {
      ar: 'عرض قائمة الخدمات الكاملة',
      fr: 'Voir tout le menu des tarifs',
      amz: 'ⵥⵕ ⵜⴰⵍⴳⴰⵎⵜ ⵏ ⵡⴰⵜⵉⴳⵏ',
      en: 'Open full services menu',
      es: 'Ver catálogo completo',
    }),
    staffFavBadge: pickLang(lang, {
      ar: 'مفضل',
      fr: 'Favori',
      amz: 'ⴰⵙⵜⴰⵢ',
      en: 'Favorite',
      es: 'Favorito',
    }),
    bookNow: pickLang(lang, {
      ar: 'احجز موعدك الآن',
      fr: 'Réserver un rendez-vous',
      amz: 'ⵃⵊⵣ ⴰⵙⵉⵀⵍ ⵏⵏⴽ',
      en: 'Book Appointment',
      es: 'Reservar cita',
    }),
    trackTicket: pickLang(lang, {
      ar: 'تتبع الموعد وتذكرتي',
      fr: 'Suivre mon rendez-vous',
      amz: 'ⴹⴼⵕ ⵜⴰⵡⵔⵉⵇⵜ ⵏⵏⴽ',
      en: 'Track Appointment',
      es: 'Seguir mi cita',
    }),
    quickMenuTitle: pickLang(lang, {
      ar: 'أقسام الموقع السريعة',
      fr: 'Raccourcis du salon',
      amz: 'ⵉⴳⵣⵎⴰⵏ ⵏ ⵓⵙⴰⵍⵓⵏ',
      en: 'Salon Sections',
      es: 'Secciones del salón',
    }),
    quickMenuSub: pickLang(lang, {
      ar: 'الخدمات، الولاء، التقييمات والأسئلة',
      fr: 'Services, fidélité, avis & FAQ',
      amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ, ⵜⴰⵖⵓⵏⵉ ⴷ ⵜⵏⵏⴰⵢⵉⵏ',
      en: 'Services, loyalty, reviews & FAQ',
      es: 'Servicios, fidelidad y reseñas',
    }),
    serviceCatalogTitle: pickLang(lang, {
      ar: 'تصفح الخدمات حسب التصنيف',
      fr: 'Services par catégorie',
      amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵙ ⵓⵙⵜⴰⵢ',
      en: 'Services by Category',
      es: 'Servicios por categoría',
    }),
    serviceCatalogSub: pickLang(lang, {
      ar: 'اختر خدمة للانتقال السريع إلى الحجز',
      fr: 'Touchez une prestation pour réserver vite',
      amz: 'ⵙⵜⵢ ⵜⴰⵡⵓⵔⵉ ⵉ ⵓⵙⵔⵓⵙ ⵉⵣⵔⴱⵏ',
      en: 'Tap any service to jump into booking',
      es: 'Toca un servicio para reservar rápido',
    }),
    utilitiesTitle: pickLang(lang, {
      ar: 'الأقسام والخدمات السريعة',
      fr: 'Catégories & Outils du Salon',
      amz: 'ⵜⵉⵏⴰⴼⵓⵜⵉⵏ ⴷ ⵉⵏⵖⵎⵉⵙⵏ',
      en: 'Categories & Salon Tools',
      es: 'Categorías y herramientas',
    }),
    team: pickLang(lang, {
      ar: 'معلومات والتواصل مع الحلاقين',
      fr: 'Fiches & Contact Barbiers',
      amz: 'ⵜⴰⵔⴰⴱⴱⵓⵜ ⵏⵏⵖ',
      en: 'Barbers & Direct Contact',
      es: 'Barberos y contacto',
    }),
    teamSub: pickLang(lang, {
      ar: '4 حلاقين محترفين بتارودانت',
      fr: '4 maîtres barbiers à Taroudant',
      amz: '4 ⵉⵎⴽⵔⴰⴹⵏ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ',
      en: '4 master barbers in Taroudant',
      es: '4 barberos en Taroudant',
    }),
    founderRole: pickLang(lang, {
      ar: 'المؤسس وخبير الحلاقة (منذ 2016)',
      fr: 'Fondateur & Maître Barbier (depuis 2016)',
      amz: 'ⴰⵎⵙⴱⴷⴰⴷ ⴷ ⵓⵎⴽⵔⴰⴹ (2016)',
      en: 'Founder & Master Barber (since 2016)',
      es: 'Fundador y Maestro Barbero (2016)',
    }),
    barberRole: pickLang(lang, {
      ar: 'حلاق محترف',
      fr: 'Barbier Professionnel',
      amz: 'ⴰⵎⴽⵔⴰⴹ ⴰⵎⵙⵙⵏⵜⵓ',
      en: 'Professional Barber',
      es: 'Barbero Profesional',
    }),
    chooseBarber: pickLang(lang, {
      ar: 'حجز',
      fr: 'Choisir',
      amz: 'ⴼⵔⵏ',
      en: 'Book',
      es: 'Elegir',
    }),
    gallery: pickLang(lang, {
      ar: 'معرض الصور وإنستغرام',
      fr: 'Galerie & Instagram',
      amz: 'ⵜⴰⵙⵏⵜ ⵏ ⵜⵡⵍⴰⴼⵉⵏ',
      en: 'Gallery & Instagram',
      es: 'Galería e Instagram',
    }),
    gallerySub: pickLang(lang, {
      ar: 'قصات التدريج واللحية',
      fr: 'Dégradés, coupes & rituels',
      amz: 'ⵜⵉⵡⵍⴰⴼⵉⵏ ⵏ ⵓⵙⴰⵍⵓⵏ',
      en: 'Fades, styles & beard work',
      es: 'Fotos y degradados',
    }),
    instaCta: pickLang(lang, {
      ar: 'تابعنا على إنستغرام لمشاهدة أحدث القصات اليومية',
      fr: 'Suivez nos créations quotidiennes sur Instagram',
      amz: 'ⴹⴼⵕ ⵜⵉⵡⵍⴰⴼⵉⵏ ⵏⵏⵖ ⴳ ⵉⵏⵙⵜⴰⴳⵔⴰⵎ',
      en: 'Follow our daily cuts on Instagram',
      es: 'Sigue nuestros cortes en Instagram',
    }),
    instaBtn: pickLang(lang, {
      ar: 'متابعة @SalonBoumlik',
      fr: 'Suivre @SalonBoumlik',
      amz: 'ⴹⴼⵕ @SalonBoumlik',
      en: 'Follow @SalonBoumlik',
      es: 'Seguir @SalonBoumlik',
    }),
    wifi: pickLang(lang, {
      ar: 'الواي فاي وصالة الانتظار',
      fr: 'Wi-Fi & Salon Lounge',
      amz: 'ⵡⴰⵢ ⴼⴰⵢ ⴷ ⵓⵙⴰⵢⵔⴰⵔ',
      en: 'Wi-Fi & Lounge',
      es: 'Wi-Fi y salón',
    }),
    wifiSub: pickLang(lang, {
      ar: 'واي فاي مجاني بالصالون',
      fr: 'Connexion Fibre gratuite',
      amz: 'ⵡⴰⵢ-ⴼⴰⵢ ⴼⴰⴱⵓⵕ',
      en: 'Free Wi-Fi access',
      es: 'Wi-Fi gratuito',
    }),
    ssidLabel: pickLang(lang, {
      ar: 'الشبكة:',
      fr: 'Réseau :',
      amz: 'ⴰⵥⵟⵟⴰ:',
      en: 'Network:',
      es: 'Red:',
    }),
    passLabel: pickLang(lang, {
      ar: 'كلمة السر:',
      fr: 'Code :',
      amz: 'ⴰⵙⴰⵔⵓⵜ:',
      en: 'Password:',
      es: 'Clave:',
    }),
    wifiNote: pickLang(lang, {
      ar: 'صالون مكيف مع ضيافة الشاي المغربي',
      fr: 'Salon climatisé avec thé marocain offert.',
      amz: 'ⴰⵙⴰⵍⵓⵏ ⵉⵙⵎⵎⵉⴹⵏ ⴷ ⴰⵜⴰⵢ ⴰⵎⵖⵔⴰⴱⵉ.',
      en: 'Air-conditioned lounge with Moroccan tea.',
      es: 'Salón climatizado con té marroquí.',
    }),
    location: pickLang(lang, {
      ar: 'الموقع الدقيق على الخريطة',
      fr: 'Adresse & Google Maps',
      amz: 'ⴰⴷⵖⴰⵔ ⴷ ⵓⵖⴰⵔⴰⵙ',
      en: 'Location & Google Maps',
      es: 'Ubicación y mapa',
    }),
    openMaps: pickLang(lang, {
      ar: 'فتح الاتجاهات في Google Maps',
      fr: 'Ouvrir Google Maps',
      amz: 'ⵕⵥⵎ Google Maps',
      en: 'Open Google Maps',
      es: 'Abrir Google Maps',
    }),
    appearanceLabel: pickLang(lang, {
      ar: 'مظهر الموقع:',
      fr: 'Apparence :',
      amz: 'ⴰⵙⴽⴽⵉⵏ:',
      en: 'Theme:',
      es: 'Tema:',
    }),
    lightMode: pickLang(lang, {
      ar: 'فاتح',
      fr: 'Clair',
      amz: 'ⴰⵎⵍⵍⴰⵍ',
      en: 'Light',
      es: 'Claro',
    }),
    darkMode: pickLang(lang, {
      ar: 'داكن',
      fr: 'Sombre',
      amz: 'ⴰⴱⵕⴽⴰⵏ',
      en: 'Dark',
      es: 'Oscuro',
    }),
    adminButton: pickLang(lang, {
      ar: 'لوحة تحكم الإدارة (للحلاقين)',
      fr: 'Espace Administration (Staff)',
      amz: 'ⴰⵎⵙⵙⵓⴳⵓⵔ ⵏ ⵓⵙⴰⵍⵓⵏ',
      en: 'Staff Admin Dashboard',
      es: 'Panel de administración',
    }),
    cityBadge: pickLang(lang, {
      ar: 'تارودانت',
      fr: 'Taroudant',
      amz: 'ⵜⴰⵔⵓⴷⴰⵏⵜ',
      en: 'Taroudant',
      es: 'Taroudant',
    }),
  };

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {isOpen && (
          <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm"
              onClick={handleCloseDrawer}
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: isRtl ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '-100%' : '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={`fixed inset-y-0 ${
                isRtl ? 'left-0 border-r' : 'right-0 border-l'
              } max-w-full w-full sm:max-w-md bg-[#FAF9F6] dark:bg-[#0B0C10] border-stone-200 dark:border-zinc-800 shadow-2xl flex flex-col z-10`}
            >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#111318]">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 rounded-full bg-amber-600 dark:bg-amber-400" />
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-wide font-display">
                SALON <span className="text-amber-700 dark:text-amber-400">BOUMLIK</span>
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400 font-medium">
                {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseDrawer}
            className="p-2 rounded-xl text-stone-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-900 border border-stone-200 dark:border-zinc-800 transition-colors cursor-pointer"
            aria-label={labels.closeAria}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Service Search Bar (Sticky below Drawer Header for instant access) */}
        <div className="px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-white/95 dark:bg-[#111318]/95">
          <div className="relative">
            <Search className="w-4 h-4 text-amber-600 dark:text-amber-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
            <input
              type="search"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder={labels.searchPlaceholder}
              aria-label={labels.searchPlaceholder}
              className="w-full min-h-[42px] ps-10 pe-9 py-2 rounded-xl bg-stone-100/80 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-stone-500 dark:placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
            {serviceSearch && (
              <button
                type="button"
                onClick={() => setServiceSearch('')}
                aria-label={labels.clearSearchAria}
                className="p-1 rounded-lg text-stone-400 hover:text-slate-800 dark:hover:text-white absolute top-1/2 -translate-y-1/2 end-2.5 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Live Search Results Section when typing */}
          <AnimatePresence initial={false}>
            {trimmedQuery.length > 0 && (
              <motion.div
                key="drawer-search-results"
                initial={{ height: 0, opacity: 0, y: -6 }}
                animate={{
                  height: 'auto',
                  opacity: 1,
                  y: 0,
                  transition: {
                    height: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.2 },
                    y: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                  y: -6,
                  transition: {
                    height: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.14 },
                  },
                }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border border-amber-300/80 dark:border-amber-500/40 bg-white dark:bg-[#13151B] p-3.5 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>{labels.searchResultsHeader}</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 tabular-nums">
                  {matchingServices.length}
                </span>
              </div>

              {matchingServices.length === 0 ? (
                <div className="py-5 text-center space-y-2.5">
                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                    {labels.noResults}
                  </p>
                  <button
                    type="button"
                    onClick={() => setServiceSearch('')}
                    className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-zinc-900 hover:bg-stone-200 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-bold text-slate-800 dark:text-zinc-200 cursor-pointer transition-colors"
                  >
                    {labels.resetSearch}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {matchingServices.map((srv) => {
                    const isSelected = selectedServiceIds.includes(srv.id);
                    return (
                      <div
                        key={`search-${srv.id}`}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-400/70 dark:border-amber-500/50'
                            : 'bg-stone-50/80 dark:bg-zinc-900/70 border-stone-200 dark:border-zinc-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {srv.name[lang] || srv.name.fr}
                            </span>
                            {srv.staffFavorite && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[9px] font-bold">
                                <Award className="w-2.5 h-2.5" />
                                <span>{labels.staffFavBadge}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-600 dark:text-zinc-400 line-clamp-1">
                            {srv.description[lang] || srv.description.fr}
                          </p>
                          <div className="flex items-center gap-2.5 pt-0.5 text-[11px] font-mono">
                            <span className="font-black text-amber-700 dark:text-amber-400">
                              {formatServicePrice(srv)}
                            </span>
                            <span className="text-stone-400">•</span>
                            <span className="inline-flex items-center gap-1 text-stone-500 dark:text-zinc-400">
                              <Clock className="w-3 h-3" />
                              <span>
                                {formatDuration(
                                  resolvedTodayPricing.durationMap[srv.id] ?? srv.durationMinutes
                                )}
                              </span>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePickService(srv)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-black flex items-center gap-1 flex-shrink-0 cursor-pointer transition-all shadow-2xs"
                        >
                          <span>{labels.bookServiceBtn}</span>
                          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      handleCloseDrawer();
                      onNavigateToSection('services');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-stone-100 dark:bg-zinc-900 hover:bg-stone-200 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Scissors className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{labels.openFullCatalogBtn}</span>
                  </button>
                </div>
              )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Primary Action Tiles (Direct Booking + Ticket Tracking) */}
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => {
                handleCloseDrawer();
                onOpenBookingModal();
              }}
              className="w-full min-h-[46px] p-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer touch-manipulation"
            >
              <Calendar className="w-4 h-4" />
              <span>{labels.bookNow}</span>
            </button>

            {onOpenTrackBooking && (
              <button
                type="button"
                onClick={() => {
                  handleCloseDrawer();
                  onOpenTrackBooking();
                }}
                className="w-full min-h-[44px] p-3 rounded-2xl bg-white dark:bg-[#13151B] hover:bg-stone-100 dark:hover:bg-zinc-900 active:scale-[0.99] border border-stone-200 dark:border-zinc-800 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation"
              >
                <Ticket className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>{labels.trackTicket}</span>
              </button>
            )}
          </div>

          {/* Expandable Menu Categories with Smooth Mobile Animations */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 block px-1">
              {labels.utilitiesTitle}
            </span>

            {/* CATEGORY 1: SALON SECTIONS SHORTCUTS */}
            <SmoothCategoryAccordion
              isExpanded={expandedCategories.sections}
              onToggle={() => toggleCategory('sections')}
              icon={<Layers className="w-4 h-4" />}
              iconBoxClassName="bg-amber-50 dark:bg-amber-500/10 border-amber-200/70 dark:border-amber-500/20 text-amber-700 dark:text-amber-400"
              title={labels.quickMenuTitle}
              subtitle={labels.quickMenuSub}
            >
              <div className="grid grid-cols-2 gap-2">
                {sectionShortcuts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        handleCloseDrawer();
                        onNavigateToSection(item.id);
                      }}
                      className="p-3 rounded-xl bg-stone-50/80 dark:bg-zinc-900/60 hover:bg-white dark:hover:bg-zinc-900 hover:border-amber-500/60 active:scale-[0.98] border border-stone-200 dark:border-zinc-800 flex flex-col items-start gap-2 text-start transition-all cursor-pointer group touch-manipulation"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 leading-snug">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </SmoothCategoryAccordion>

            {/* CATEGORY 2: SERVICES BY CATEGORY */}
            <SmoothCategoryAccordion
              isExpanded={expandedCategories.serviceCatalog}
              onToggle={() => toggleCategory('serviceCatalog')}
              icon={<Scissors className="w-4 h-4" />}
              iconBoxClassName="bg-amber-50 dark:bg-amber-500/10 border-amber-200/70 dark:border-amber-500/20 text-amber-700 dark:text-amber-400"
              title={labels.serviceCatalogTitle}
              subtitle={labels.serviceCatalogSub}
            >
              <div className="space-y-3">
                {/* Category Filter Pills inside Drawer */}
                <div className="flex flex-wrap gap-1.5">
                  {serviceFilterGroups.map((grp) => {
                    const active = activeServiceGroup === grp.id;
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => setActiveServiceGroup(grp.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer touch-manipulation ${
                          active
                            ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-2xs'
                            : 'bg-stone-100 dark:bg-zinc-900 text-stone-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border border-stone-200 dark:border-zinc-800'
                        }`}
                      >
                        {grp.label}
                      </button>
                    );
                  })}
                </div>

                {/* Matching Category Services List */}
                <div className="space-y-2 max-h-64 overflow-y-auto pe-0.5">
                  {categorizedServices.map((srv) => {
                    const isSelected = selectedServiceIds.includes(srv.id);
                    return (
                      <button
                        key={`cat-${srv.id}`}
                        type="button"
                        onClick={() => handlePickService(srv)}
                        className={`w-full p-2.5 rounded-xl border text-start flex items-center justify-between gap-2.5 transition-all active:scale-[0.99] cursor-pointer touch-manipulation ${
                          isSelected
                            ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-400/70 dark:border-amber-500/40'
                            : 'bg-stone-50 dark:bg-zinc-900/60 hover:bg-stone-100/90 dark:hover:bg-zinc-900 border-stone-200 dark:border-zinc-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {srv.name[lang] || srv.name.fr}
                            </span>
                            {srv.staffFavorite && (
                              <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] text-stone-500 dark:text-zinc-400 block truncate">
                            {formatDuration(
                              resolvedTodayPricing.durationMap[srv.id] ?? srv.durationMinutes
                            )}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-black text-amber-700 dark:text-amber-400 flex-shrink-0">
                          {formatServicePrice(srv)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleCloseDrawer();
                    onNavigateToSection('services');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-stone-100 dark:bg-zinc-900 hover:bg-stone-200 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Scissors className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{labels.openFullCatalogBtn}</span>
                </button>
              </div>
            </SmoothCategoryAccordion>

            {/* CATEGORY 3: BARBERS TEAM & DIRECT CONTACT */}
            <SmoothCategoryAccordion
              isExpanded={expandedCategories.team}
              onToggle={() => toggleCategory('team')}
              icon={<Users className="w-4 h-4" />}
              iconBoxClassName="bg-amber-50 dark:bg-amber-500/10 border-amber-200/70 dark:border-amber-500/20 text-amber-700 dark:text-amber-400"
              title={labels.team}
              subtitle={labels.teamSub}
            >
              <div className="space-y-3">
                {mergedBarbers.map((barber: BarberStaff) => {
                  const name = barber.name[lang] || barber.name.fr;
                  const bio = barber.bio ? barber.bio[lang] || barber.bio.fr : '';

                  return (
                    <div
                      key={barber.id}
                      className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900/60 border border-stone-200 dark:border-zinc-800 space-y-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white dark:bg-zinc-800 flex-shrink-0 border border-stone-200 dark:border-zinc-700">
                          <img src={barber.avatar} alt={name} className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{name}</h4>
                          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 block truncate">
                            {barber.isOwner ? labels.founderRole : labels.barberRole}
                          </span>
                        </div>
                      </div>

                      {barber.isOwner && bio && (
                        <p className="text-xs text-stone-600 dark:text-zinc-300 leading-relaxed bg-white dark:bg-black/40 p-2.5 rounded-lg border border-stone-200 dark:border-zinc-800">
                          {bio}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                        {barber.phone && (
                          <a
                            href={`tel:${barber.phone}`}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-white hover:bg-stone-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-200 text-center font-mono flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Phone className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span dir="ltr">{barber.phone}</span>
                          </a>
                        )}

                        {barber.whatsappNumber && (
                          <a
                            href={`https://wa.me/${barber.whatsappNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1 transition-colors"
                          >
                            <span>WhatsApp</span>
                          </a>
                        )}

                        {onSelectBarberForBooking && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectBarberForBooking(barber.id);
                              handleCloseDrawer();
                            }}
                            className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors cursor-pointer"
                          >
                            {labels.chooseBarber}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SmoothCategoryAccordion>

            {/* CATEGORY 4: GALLERY & INSTAGRAM */}
            <SmoothCategoryAccordion
              isExpanded={expandedCategories.gallery}
              onToggle={() => toggleCategory('gallery')}
              icon={<ImageIcon className="w-4 h-4" />}
              title={labels.gallery}
              subtitle={labels.gallerySub}
            >
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-zinc-900/70 border border-stone-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                    <Instagram className="w-4 h-4" />
                    <span>@SalonBoumlik</span>
                  </div>
                  <p className="text-slate-700 dark:text-zinc-300 text-xs">{labels.instaCta}</p>
                  <a
                    href={SALON_INFO.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 py-2 px-3.5 rounded-lg bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs transition-colors"
                  >
                    <span>{labels.instaBtn}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {galleryPhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="aspect-square rounded-xl overflow-hidden bg-stone-100 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800"
                    >
                      <img src={photo.src} alt={photo.alt} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </SmoothCategoryAccordion>

            {/* CATEGORY 5: WI-FI & LOUNGE */}
            <SmoothCategoryAccordion
              isExpanded={expandedCategories.wifi}
              onToggle={() => toggleCategory('wifi')}
              icon={<Wifi className="w-4 h-4" />}
              title={labels.wifi}
              subtitle={labels.wifiSub}
            >
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900/70 border border-stone-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500 dark:text-zinc-400">{labels.ssidLabel}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                      {SALON_INFO.media.wifiSsid}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-stone-200 dark:border-zinc-800">
                    <span className="text-stone-500 dark:text-zinc-400">{labels.passLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400" dir="ltr">
                        {SALON_INFO.media.wifiPassword}
                      </span>
                      <button
                        type="button"
                        onClick={copyWifiPassword}
                        className="p-1 rounded bg-white hover:bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 cursor-pointer"
                        aria-label={labels.passLabel}
                      >
                        {wifiCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-stone-600 dark:text-zinc-400 p-2 rounded-lg bg-stone-50 dark:bg-zinc-900/40">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>{labels.wifiNote}</span>
                </div>
              </div>
            </SmoothCategoryAccordion>

            {/* CATEGORY 6: LOCATION */}
            <SmoothCategoryAccordion
              isExpanded={expandedCategories.location}
              onToggle={() => toggleCategory('location')}
              icon={<MapPin className="w-4 h-4" />}
              iconBoxClassName="bg-amber-50 dark:bg-amber-500/10 border-amber-200/70 dark:border-amber-500/20 text-amber-700 dark:text-amber-400"
              title={labels.location}
              subtitle={SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}
            >
              <div className="space-y-2.5 text-xs">
                <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                  {SALON_INFO.address[lang] || SALON_INFO.address.fr}
                </p>
                <a
                  href={salonSettings.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  <span>{labels.openMaps}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </SmoothCategoryAccordion>
          </div>
        </div>

        {/* PWA Install Prompt */}
        <div className="px-4 py-2 bg-white dark:bg-[#111318] border-t border-stone-200 dark:border-zinc-800">
          <PWAInstallButton variant="drawer" />
        </div>

        {/* Quick Language Switcher Row */}
        <div
          dir="ltr"
          className="px-3 py-2.5 bg-white dark:bg-[#111318] border-t border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-1.5"
        >
          {quickLangOptions.map((opt) => {
            const active = lang === opt.code;
            return (
              <button
                key={`drawer-lang-${opt.code}`}
                type="button"
                onClick={() => setLang(opt.code)}
                aria-pressed={active}
                className={`flex-1 min-h-[34px] px-1.5 py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  active
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-stone-100 dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 border border-stone-200 dark:border-zinc-800 hover:bg-stone-200/80 dark:hover:bg-zinc-800'
                } ${opt.code === 'amz' ? 'font-tifinagh' : opt.code === 'ar' ? 'font-arabic' : ''}`}
              >
                <FlagIcon lang={opt.code} className="w-3.5 h-2.5 rounded-[2px] flex-shrink-0" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Theme Switcher */}
        <div className="p-3 bg-white dark:bg-[#111318] border-t border-stone-200 dark:border-zinc-800 flex items-center justify-between text-xs">
          <span className="text-stone-600 dark:text-zinc-400 font-semibold text-[11px]">
            {labels.appearanceLabel}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTheme('minimal_light')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                !isDark
                  ? 'bg-slate-900 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              ☀️ {labels.lightMode}
            </button>
            <button
              type="button"
              onClick={() => setTheme('luxury_gold')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                isDark
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-stone-100 text-slate-700 border border-stone-200 hover:bg-stone-200'
              }`}
            >
              🌙 {labels.darkMode}
            </button>
          </div>
        </div>

        {/* Footer with Staff Admin Access */}
        <div className="p-4 border-t border-stone-200 dark:border-zinc-800 bg-stone-100/70 dark:bg-black/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              handleCloseDrawer();
              onOpenAdmin();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-stone-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-stone-200 dark:border-zinc-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>{labels.adminButton}</span>
          </button>

          <span className="text-[10px] text-stone-500 dark:text-zinc-500 font-mono">
            {labels.cityBadge}
          </span>
        </div>
      </motion.div>
    </div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
};
