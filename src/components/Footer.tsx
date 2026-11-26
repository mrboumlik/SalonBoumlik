import React, { useRef, useState } from 'react';
import {
  MapPin,
  Phone,
  Mail,
  ArrowUp,
  Instagram,
  Facebook,
  MessageCircle,
  Ticket,
  ExternalLink,
  Star,
  Scissors,
  Compass,
  ChevronRight,
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import {
  useSalonProfileSettings,
  formatSalonDisplayPhone,
  normalizeSalonTelHref,
  normalizeSalonWhatsappDigits,
} from '../utils/salonSettingsStore';
import { pickLang } from '../utils/i18n';
import { buildWhatsAppInquiryMessage } from '../utils/whatsappAutomation';

import type { HomepageSectionKey } from './DrawerMenu';
import type { PublicInfoSection } from './PublicInfoModal';
import { BrandMark } from './BrandMark';

interface FooterProps {
  onOpenBooking: () => void;
  onOpenTrackBooking?: () => void;
  onOpenAdmin?: () => void;
  onNavigateToSection?: (sectionId: HomepageSectionKey) => void;
  onOpenInfoModal?: (section: PublicInfoSection) => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenBooking,
  onOpenTrackBooking,
  onOpenAdmin,
  onNavigateToSection,
  onOpenInfoModal,
}) => {
  const { lang } = useLanguage();
  const salonSettings = useSalonProfileSettings();
  const lastTapTimeRef = useRef<number>(0);
  const lastTriggerTimeRef = useRef<number>(0);
  const logoTapTimestampsRef = useRef<number[]>([]);
  const [hoveredSocial, setHoveredSocial] = useState<string | null>(null);

  const handleBrandLogoClick = () => {
    if (!onOpenAdmin) return;
    const now = Date.now();
    const recent = logoTapTimestampsRef.current.filter((ts) => now - ts <= 700);
    recent.push(now);
    logoTapTimestampsRef.current = recent;
    if (recent.length >= 3) {
      logoTapTimestampsRef.current = [];
      triggerDiscreetAdmin();
    }
  };

  const triggerDiscreetAdmin = () => {
    if (!onOpenAdmin) return;
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 500) return;
    lastTriggerTimeRef.current = now;
    lastTapTimeRef.current = 0;
    onOpenAdmin();
  };

  const handleRightsClick = () => {
    const now = Date.now();
    if (lastTapTimeRef.current > 0 && now - lastTapTimeRef.current <= 420) {
      triggerDiscreetAdmin();
    } else {
      lastTapTimeRef.current = now;
    }
  };

  const handleRightsDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    triggerDiscreetAdmin();
  };

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const handleSectionLink = (e: React.MouseEvent, sectionId: HomepageSectionKey) => {
    if (onNavigateToSection) {
      e.preventDefault();
      onNavigateToSection(sectionId);
    }
  };

  const whatsappHref = `https://wa.me/${normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp)}?text=${encodeURIComponent(
    buildWhatsAppInquiryMessage({
      lang,
      requestType: 'inquiry',
      includeMessagePrompt: true,
    })
  )}`;

  const labels = {
    about: pickLang(lang, {
      ar: 'صالون حلاقة وعناية متكاملة مخصص للرجال في تارودانت.',
      fr: 'Salon de coiffure et barbier exclusivement masculin à Taroudant.',
      amz: 'ⴰⵙⴰⵍⵓⵏ ⵏ ⵜⴽⵔⴹⴰ ⵉⵥⵍⵉ ⵉ ⵉⵔⴳⴰⵣⵏ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ.',
      en: 'Men-only barbershop & grooming lounge in Taroudant.',
      es: 'Barbería y cuidado masculino en Taroudant.',
    }),
    quickActionsTitle: pickLang(lang, {
      ar: 'روابط سريعة',
      fr: 'Navigation',
      amz: 'ⵉⵣⴷⴰⵢⵏ',
      en: 'Quick Links',
      es: 'Enlaces',
    }),
    bookOnline: pickLang(lang, {
      ar: 'حجز موعد عبر الموقع',
      fr: 'Réserver en ligne',
      amz: 'ⴰⵙⵔⵓⵙ ⴳ ⵓⵙⵉⵜ',
      en: 'Book Appointment',
      es: 'Reservar cita',
    }),
    servicesLink: pickLang(lang, {
      ar: 'الخدمات والأثمنة',
      fr: 'Services & Tarifs',
      amz: 'ⵜⵉⵏⴰⴼⵓⵜⵉⵏ',
      en: 'Services & Pricing',
      es: 'Servicios y tarifas',
    }),
    reviewsLink: pickLang(lang, {
      ar: 'تقييمات Google 5.0',
      fr: 'Avis Google 5.0',
      amz: 'ⵉⵙⵓⵜⴰⴳ Google 5.0',
      en: 'Google Reviews 5.0',
      es: 'Reseñas Google 5.0',
    }),
    faqLink: pickLang(lang, {
      ar: 'الأسئلة الشائعة',
      fr: 'FAQ & Règles',
      amz: 'ⵉⵙⵇⵙⵉⵜⵏ',
      en: 'FAQ & Policies',
      es: 'Preguntas frecuentes',
    }),
    contactLink: pickLang(lang, {
      ar: 'التواصل والباركود',
      fr: 'Contact & QR',
      amz: 'ⴰⵎⵢⴰⵡⴰⴹ',
      en: 'Contact & QR',
      es: 'Contacto y QR',
    }),
    teamLink: pickLang(lang, {
      ar: 'فريق الحلاقين',
      fr: 'Équipe de Barbiers',
      amz: 'ⵜⴰⵔⴰⴱⴱⵓⵜ',
      en: 'Barbers Team',
      es: 'Equipo',
    }),
    loyaltyLink: pickLang(lang, {
      ar: 'برنامج الولاء',
      fr: 'Programme Fidélité',
      amz: 'ⵜⴰⵖⵓⵏⵉ',
      en: 'Loyalty Program',
      es: 'Fidelidad',
    }),
    servicesHeading: pickLang(lang, {
      ar: 'خدمات الزبناء',
      fr: 'Services Client',
      amz: 'ⵜⵉⵏⴰⴼⵓⵜⵉⵏ',
      en: 'Client Services',
      es: 'Servicios Cliente',
    }),
    trackBtn: pickLang(lang, {
      ar: 'تتبع التذكرة',
      fr: 'Suivre mon rendez-vous',
      amz: 'ⴹⴼⵕ ⵜⴰⵡⵔⵉⵇⵜ',
      en: 'Track Ticket',
      es: 'Seguir reserva',
    }),
    googleReviewBtn: pickLang(lang, {
      ar: 'تقييم 5★ على Google',
      fr: 'Avis 5★ sur Google',
      amz: 'ⵜⴰⵏⵏⴰⵢⵜ 5★ Google',
      en: 'Leave 5★ Google Review',
      es: 'Reseña 5★ Google',
    }),
    directionsBtn: pickLang(lang, {
      ar: 'الاتجاهات (Maps)',
      fr: 'Itinéraire Maps',
      amz: 'ⴰⵖⴰⵔⴰⵙ Maps',
      en: 'Maps Directions',
      es: 'Cómo llegar',
    }),
    addressHeading: pickLang(lang, {
      ar: 'العنوان والتواصل',
      fr: 'Adresse & Contact',
      amz: 'ⴰⴷⵖⴰⵔ ⴷ ⵓⵎⵢⴰⵡⴰⴹ',
      en: 'Location & Contact',
      es: 'Ubicación y Contacto',
    }),
    rightsPrefix: pickLang(lang, {
      ar: 'صالون بومليك تارودانت —',
      fr: 'Salon Boumlik Taroudant —',
      amz: 'ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⵜⴰⵔⵓⴷⴰⵏⵜ —',
      en: 'Salon Boumlik Taroudant —',
      es: 'Salon Boumlik Taroudant —',
    }),
    rightsReserved: pickLang(lang, {
      ar: 'جميع الحقوق محفوظة',
      fr: 'Tous droits réservés',
      amz: 'ⴰⴽⴽⵯ ⵉⵣⵔⴼⴰⵏ ⵜⵜⵓⵃⴹⴰⵏ',
      en: 'All rights reserved',
      es: 'Todos los derechos reservados',
    }),
    topAria: pickLang(lang, {
      ar: 'العودة إلى الأعلى',
      fr: 'Haut de page',
      amz: 'ⴰⴼⵍⵍⴰ ⵏ ⵜⵙⵏⴰ',
      en: 'Back to top',
      es: 'Subir',
    }),
    aboutPageLink: pickLang(lang, {
      ar: 'من نحن',
      fr: 'À propos',
      amz: 'ⵖⵉⴼⵏⵖ',
      en: 'About Us',
      es: 'Sobre nosotros',
    }),
    contactPageLink: pickLang(lang, {
      ar: 'اتصل بنا',
      fr: 'Contact',
      amz: 'ⴰⵎⵢⴰⵡⴰⴹ',
      en: 'Contact Us',
      es: 'Contacto',
    }),
    privacyLink: pickLang(lang, {
      ar: 'سياسة الخصوصية',
      fr: 'Politique de confidentialité',
      amz: 'ⵜⴰⵙⵔⵜⵉⵜ ⵏ ⵜⵓⵙⵍⵉⴳⵜ',
      en: 'Privacy Policy',
      es: 'Política de privacidad',
    }),
    termsLink: pickLang(lang, {
      ar: 'شروط الاستخدام',
      fr: "Conditions d'utilisation",
      amz: 'ⵜⵉⴼⴰⴷⵉⵡⵉⵏ ⵏ ⵓⵙⵎⵔⵙ',
      en: 'Terms of Use',
      es: 'Términos de uso',
    }),
    googleRatingBadge: pickLang(lang, {
      ar: 'تقييم 5.0 ★ على Google — آراء الزبناء',
      fr: 'Note 5.0 ★ sur Google — Voir les avis',
      amz: 'ⵜⴰⵏⵏⴰⵢⵜ 5.0 ★ Google — ⵉⵙⵓⵜⴰⴳ',
      en: '5.0 ★ Google Rating — Client Reviews',
      es: 'Valoración 5.0 ★ en Google — Reseñas',
    }),
    locationBadge: pickLang(lang, {
      ar: 'موقع الصالون — شارع بئر أنزران، تارودانت',
      fr: 'Localisation — Rue Bir Anzarane, Taroudant',
      amz: 'ⴰⴷⵖⴰⵔ — ⴱⵉⵔ ⴰⵏⵣⴰⵔⴰⵏ, ⵜⴰⵔⵓⴷⴰⵏⵜ',
      en: 'Salon Location — Rue Bir Anzarane, Taroudant',
      es: 'Ubicación — Rue Bir Anzarane, Taroudant',
    }),
    socialLabel: pickLang(lang, {
      ar: 'مواقع التواصل',
      fr: 'Réseaux sociaux',
      amz: 'ⵉⵥⴹⵡⴰⵏ ⵏ ⵓⵎⵢⴰⵡⴰⴹ',
      en: 'Social Media',
      es: 'Redes sociales',
    }),
  };

  return (
    <footer className="relative z-10 bg-stone-100 dark:bg-[#0B0C10] border-t border-stone-200 dark:border-zinc-800/80 text-stone-600 dark:text-zinc-400 text-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 sm:pt-10 sm:pb-20">
        {/* ==================== MOBILE LAYOUT (< md) — UNTOUCHED ==================== */}
        <div className="md:hidden">
          {/* Main Responsive Footer Grid: Brand Identity + Quick Links + Client Services + Contact Card */}
          <div className="grid grid-cols-2 gap-7 items-start">
            {/* 1. Brand Identity Column */}
            <div className="col-span-2 flex flex-col items-center text-center pb-6 border-b border-stone-200/80 dark:border-zinc-800/80 space-y-3">
              <div onClick={handleBrandLogoClick} className="inline-flex select-none">
                <BrandMark variant="footer" className="flex-shrink-0" />
              </div>

              <div className="space-y-1 max-w-md">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300/90">
                  {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
                </p>
                <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed text-balance">
                  {labels.about}
                </p>
              </div>

              {/* Social Media: Unified Monochrome Icons on Mobile / Restrained Desktop + Direct WhatsApp CTA */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
                  {labels.socialLabel}
                </div>

                {/* Mobile (< sm): Single unified monochrome icon-only row */}
                <div className="flex sm:hidden items-center justify-center gap-2.5">
                  <a
                    href={SALON_INFO.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 hover:bg-stone-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-stone-200 dark:border-zinc-800 inline-flex items-center justify-center transition-colors shadow-2xs active:scale-95"
                    title="Instagram @SalonBoumlik"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-4 h-4" />
                    <span className="sr-only">Instagram</span>
                  </a>

                  <a
                    href={SALON_INFO.social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 hover:bg-stone-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-stone-200 dark:border-zinc-800 inline-flex items-center justify-center transition-colors shadow-2xs active:scale-95"
                    title="Facebook Salon Boumlik"
                    aria-label="Facebook"
                  >
                    <Facebook className="w-4 h-4" />
                    <span className="sr-only">Facebook</span>
                  </a>

                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 hover:bg-stone-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-stone-200 dark:border-zinc-800 inline-flex items-center justify-center transition-colors shadow-2xs active:scale-95"
                    title={`WhatsApp ${formatSalonDisplayPhone(salonSettings.salonWhatsapp)}`}
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="sr-only">WhatsApp</span>
                  </a>
                </div>

                {/* Small Tablet (sm to <md): Restrained monochrome Instagram & Facebook + Direct WhatsApp CTA */}
                <div className="hidden sm:block space-y-1">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <a
                      href={SALON_INFO.social.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => setHoveredSocial('Instagram · @SalonBoumlik')}
                      onMouseLeave={() => setHoveredSocial(null)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-stone-200 hover:border-stone-400 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white border border-stone-200 dark:border-zinc-800 inline-flex items-center gap-1.5 text-[11px] font-bold transition-all duration-150 shadow-2xs"
                      title="Instagram @SalonBoumlik"
                      aria-label="Instagram"
                    >
                      <Instagram className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {pickLang(lang, {
                          ar: 'إنستغرام',
                          fr: 'Instagram',
                          amz: 'Instagram',
                          en: 'Instagram',
                          es: 'Instagram',
                        })}
                      </span>
                    </a>

                    <a
                      href={SALON_INFO.social.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => setHoveredSocial('Facebook · Salon Boumlik')}
                      onMouseLeave={() => setHoveredSocial(null)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-stone-200 hover:border-stone-400 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white border border-stone-200 dark:border-zinc-800 inline-flex items-center gap-1.5 text-[11px] font-bold transition-all duration-150 shadow-2xs"
                      title="Facebook Salon Boumlik"
                      aria-label="Facebook"
                    >
                      <Facebook className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {pickLang(lang, {
                          ar: 'فيسبوك',
                          fr: 'Facebook',
                          amz: 'Facebook',
                          en: 'Facebook',
                          es: 'Facebook',
                        })}
                      </span>
                    </a>

                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() =>
                        setHoveredSocial(`WhatsApp · ${formatSalonDisplayPhone(salonSettings.salonWhatsapp)}`)
                      }
                      onMouseLeave={() => setHoveredSocial(null)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 dark:border-emerald-500 inline-flex items-center gap-1.5 text-[11px] font-bold transition-all duration-150 shadow-2xs"
                      title={`WhatsApp ${formatSalonDisplayPhone(salonSettings.salonWhatsapp)}`}
                      aria-label="WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {pickLang(lang, {
                          ar: 'واتساب',
                          fr: 'WhatsApp',
                          amz: 'WhatsApp',
                          en: 'WhatsApp',
                          es: 'WhatsApp',
                        })}
                      </span>
                    </a>
                  </div>
                  <p className="min-h-[15px] text-[10px] font-mono text-stone-500 dark:text-zinc-400" dir="ltr">
                    {hoveredSocial || '\u00A0'}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Quick Links */}
            <div className="col-span-1 space-y-3">
              <h4 className="font-black text-slate-900 dark:text-white text-xs tracking-wide">
                {labels.quickActionsTitle}
              </h4>
              <ul className="space-y-2.5 text-xs text-stone-600 dark:text-zinc-400">
                <li>
                  <button
                    type="button"
                    onClick={onOpenBooking}
                    className="hover:text-amber-700 dark:hover:text-amber-400 font-bold text-slate-800 dark:text-zinc-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-0.5 text-start"
                  >
                    <Scissors className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                    <span>{labels.bookOnline}</span>
                  </button>
                </li>
                <li>
                  <a
                    href="#section-services"
                    onClick={(e) => handleSectionLink(e, 'services')}
                    className="hover:text-slate-950 dark:hover:text-white transition-colors inline-block py-0.5"
                  >
                    {labels.servicesLink}
                  </a>
                </li>
                <li>
                  <a
                    href="#section-team"
                    onClick={(e) => handleSectionLink(e, 'team')}
                    className="hover:text-slate-950 dark:hover:text-white transition-colors inline-block py-0.5"
                  >
                    {labels.teamLink}
                  </a>
                </li>
                <li>
                  <a
                    href="#section-faq"
                    onClick={(e) => handleSectionLink(e, 'faq')}
                    className="hover:text-slate-950 dark:hover:text-white transition-colors inline-block py-0.5"
                  >
                    {labels.faqLink}
                  </a>
                </li>
                <li>
                  <a
                    href="#section-contact"
                    onClick={(e) => handleSectionLink(e, 'contact')}
                    className="hover:text-slate-950 dark:hover:text-white transition-colors inline-block py-0.5"
                  >
                    {labels.contactLink}
                  </a>
                </li>
              </ul>
            </div>

            {/* 3. Client Services */}
            <div className="col-span-1 space-y-3">
              <h4 className="font-black text-slate-900 dark:text-white text-xs tracking-wide">
                {labels.servicesHeading}
              </h4>
              <ul className="space-y-2.5 text-xs text-stone-600 dark:text-zinc-400">
                {onOpenTrackBooking && (
                  <li>
                    <button
                      type="button"
                      onClick={onOpenTrackBooking}
                      className="hover:text-amber-700 dark:hover:text-amber-400 font-bold text-slate-800 dark:text-zinc-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-0.5 text-start"
                    >
                      <Ticket className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                      <span>{labels.trackBtn}</span>
                    </button>
                  </li>
                )}

                <li>
                  <a
                    href="#section-loyalty"
                    onClick={(e) => handleSectionLink(e, 'loyalty')}
                    className="hover:text-slate-950 dark:hover:text-white transition-colors inline-block py-0.5"
                  >
                    {labels.loyaltyLink}
                  </a>
                </li>

                <li>
                  <a
                    href="#section-reviews"
                    onClick={(e) => handleSectionLink(e, 'reviews')}
                    className="hover:text-slate-950 dark:hover:text-white transition-colors inline-block py-0.5"
                  >
                    {labels.reviewsLink}
                  </a>
                </li>

                <li>
                  <a
                    href={salonSettings.googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 py-0.5"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 flex-shrink-0" />
                    <span>{labels.googleReviewBtn}</span>
                  </a>
                </li>

                <li>
                  <a
                    href={salonSettings.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-slate-950 dark:hover:text-white transition-colors inline-flex items-center gap-1.5 py-0.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                    <span>{labels.directionsBtn}</span>
                    <ExternalLink className="w-3 h-3 opacity-70 flex-shrink-0" />
                  </a>
                </li>
              </ul>
            </div>

            {/* 4. Clean Contact & Location Card */}
            <div className="col-span-2 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-4 shadow-2xs space-y-3">
              <h4 className="font-black text-slate-900 dark:text-white text-xs tracking-wide">
                {labels.addressHeading}
              </h4>
              <div className="space-y-2.5 text-xs text-stone-600 dark:text-zinc-400">
                <a
                  href={salonSettings.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 hover:text-amber-700 dark:hover:text-amber-400 transition-colors leading-relaxed"
                >
                  <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}</span>
                </a>

                <a
                  href={normalizeSalonTelHref(salonSettings.salonPhone)}
                  className="flex items-center gap-2.5 text-slate-800 dark:text-zinc-200 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                >
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span dir="ltr" className="font-mono font-bold">
                    {formatSalonDisplayPhone(salonSettings.salonPhone)}
                  </span>
                </a>
                {(salonSettings.additionalPhones || []).map((extraPhone) => (
                  <a
                    key={extraPhone}
                    href={normalizeSalonTelHref(extraPhone)}
                    className="flex items-center gap-2.5 text-slate-700 dark:text-zinc-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-stone-500 dark:text-zinc-400 flex-shrink-0" />
                    <span dir="ltr" className="font-mono font-semibold">
                      {formatSalonDisplayPhone(extraPhone)}
                    </span>
                  </a>
                ))}

                <a
                  href={`mailto:${SALON_INFO.email}`}
                  className="flex items-center gap-2.5 text-slate-700 dark:text-zinc-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                >
                  <Mail className="w-4 h-4 text-stone-500 dark:text-zinc-400 flex-shrink-0" />
                  <span dir="ltr" className="font-mono truncate">
                    {SALON_INFO.email}
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* 4. Centered Google Rating (Jumps to Reviews Section) + Location Actions */}
          <div className="mt-7 pt-6 border-t border-stone-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#section-reviews"
              onClick={(e) => handleSectionLink(e, 'reviews')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#13151B] border border-amber-200 dark:border-amber-500/35 hover:border-amber-400 dark:hover:border-amber-400/60 text-slate-900 dark:text-white font-bold text-xs inline-flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <Star className="w-4 h-4 fill-amber-500 text-amber-500 flex-shrink-0" />
              <span>{labels.googleRatingBadge}</span>
            </a>

            <a
              href={salonSettings.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500/40 text-slate-800 dark:text-zinc-200 font-bold text-xs inline-flex items-center gap-2 shadow-2xs transition-colors"
            >
              <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0" />
              <span>{labels.locationBadge}</span>
              <ExternalLink className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
            </a>
          </div>

          {/* 5. Harmoniously Centered Public Info Links Bar (About, Contact, Privacy Policy, Terms of Use) */}
          {onOpenInfoModal && (
            <nav
              aria-label={pickLang(lang, {
                ar: 'معلومات وسياسات الصالون',
                fr: 'Informations et mentions légales',
                amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵙⴰⵍⵓⵏ',
                en: 'Salon information and policies',
                es: 'Información y políticas',
              })}
              className="mt-5 pt-4 border-t border-stone-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs"
            >
              {(
                [
                  { id: 'about', label: labels.aboutPageLink },
                  { id: 'contact', label: labels.contactPageLink },
                  { id: 'privacy', label: labels.privacyLink },
                  { id: 'terms', label: labels.termsLink },
                ] as { id: PublicInfoSection; label: string }[]
              ).map((item, idx) => (
                <React.Fragment key={item.id}>
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-stone-300 dark:text-zinc-700 hidden sm:inline">
                      ·
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenInfoModal(item.id)}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg font-bold text-stone-600 dark:text-zinc-300 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-zinc-900 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {item.label}
                  </button>
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* 6. Sleek Bottom Copyright Bar (Discreet double-click on rights reserved text opens staff login) */}
          <div className="mt-4 pt-4 border-t border-stone-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-stone-500 dark:text-zinc-400">
            <span>
              © {new Date().getFullYear()} {labels.rightsPrefix}{' '}
              <span
                onClick={handleRightsClick}
                onDoubleClick={handleRightsDoubleClick}
                className="select-none cursor-default"
              >
                {labels.rightsReserved}
              </span>
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={scrollToTop}
                className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 hover:bg-stone-200 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
                aria-label={labels.topAria}
                title={labels.topAria}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ==================== WEB / DESKTOP LAYOUT (md+) — MODERN CARD GRID ==================== */}
        <div className="hidden md:block space-y-4">
          {/* Row 1: 4 Equal-Height Balanced Bento Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-[1.35fr_0.9fr_1fr_1.15fr] gap-4 items-stretch">
            {/* Card 1: Brand Identity & Social Hub */}
            <div className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-5 shadow-2xs flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div onClick={handleBrandLogoClick} className="inline-flex select-none">
                  <BrandMark variant="footer" className="flex-shrink-0" />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300/90">
                    {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
                    {labels.about}
                  </p>
                </div>
              </div>

              <div className="pt-3.5 border-t border-stone-100 dark:border-zinc-800/80 space-y-2">
                <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
                  {labels.socialLabel}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={SALON_INFO.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() => setHoveredSocial('Instagram · @SalonBoumlik')}
                    onMouseLeave={() => setHoveredSocial(null)}
                    className="min-h-[34px] px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-zinc-900 hover:bg-stone-100 hover:border-stone-300 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white border border-stone-200 dark:border-zinc-800 inline-flex items-center gap-1.5 text-[11px] font-bold transition-colors"
                    title="Instagram @SalonBoumlik"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      {pickLang(lang, {
                        ar: 'إنستغرام',
                        fr: 'Instagram',
                        amz: 'Instagram',
                        en: 'Instagram',
                        es: 'Instagram',
                      })}
                    </span>
                  </a>

                  <a
                    href={SALON_INFO.social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() => setHoveredSocial('Facebook · Salon Boumlik')}
                    onMouseLeave={() => setHoveredSocial(null)}
                    className="min-h-[34px] px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-zinc-900 hover:bg-stone-100 hover:border-stone-300 dark:hover:bg-zinc-800 dark:hover:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white border border-stone-200 dark:border-zinc-800 inline-flex items-center gap-1.5 text-[11px] font-bold transition-colors"
                    title="Facebook Salon Boumlik"
                    aria-label="Facebook"
                  >
                    <Facebook className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      {pickLang(lang, {
                        ar: 'فيسبوك',
                        fr: 'Facebook',
                        amz: 'Facebook',
                        en: 'Facebook',
                        es: 'Facebook',
                      })}
                    </span>
                  </a>

                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() =>
                      setHoveredSocial(`WhatsApp · ${formatSalonDisplayPhone(salonSettings.salonWhatsapp)}`)
                    }
                    onMouseLeave={() => setHoveredSocial(null)}
                    className="min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 dark:border-emerald-500 inline-flex items-center gap-1.5 text-[11px] font-bold transition-colors shadow-2xs"
                    title={`WhatsApp ${formatSalonDisplayPhone(salonSettings.salonWhatsapp)}`}
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      {pickLang(lang, {
                        ar: 'واتساب',
                        fr: 'WhatsApp',
                        amz: 'WhatsApp',
                        en: 'WhatsApp',
                        es: 'WhatsApp',
                      })}
                    </span>
                  </a>
                </div>

                <p className="min-h-[15px] text-[10px] font-mono text-stone-400 dark:text-zinc-500" dir="ltr">
                  {hoveredSocial || '\u00A0'}
                </p>
              </div>
            </div>

            {/* Card 2: Quick Links */}
            <div className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-5 shadow-2xs flex flex-col">
              <div className="flex items-center gap-2 pb-3 mb-2.5 border-b border-stone-100 dark:border-zinc-800/80">
                <span className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 inline-flex items-center justify-center text-amber-700 dark:text-amber-400 flex-shrink-0">
                  <Compass className="w-3.5 h-3.5" />
                </span>
                <h4 className="font-black text-slate-900 dark:text-white text-xs tracking-wide">
                  {labels.quickActionsTitle}
                </h4>
              </div>

              <ul className="space-y-1 text-xs text-stone-600 dark:text-zinc-400 flex-1 flex flex-col justify-between">
                <li>
                  <button
                    type="button"
                    onClick={onOpenBooking}
                    className="w-full px-2.5 py-2 -mx-0.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200/80 dark:border-amber-500/25 font-bold text-amber-900 dark:text-amber-300 transition-colors flex items-center justify-between gap-2 cursor-pointer text-start"
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <Scissors className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                      <span className="truncate">{labels.bookOnline}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 flex-shrink-0 rtl:rotate-180" />
                  </button>
                </li>
                <li>
                  <a
                    href="#section-services"
                    onClick={(e) => handleSectionLink(e, 'services')}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 hover:text-slate-950 dark:hover:text-white transition-colors flex items-center justify-between gap-2"
                  >
                    <span>{labels.servicesLink}</span>
                    <ChevronRight className="w-3 h-3 opacity-35 flex-shrink-0 rtl:rotate-180" />
                  </a>
                </li>
                <li>
                  <a
                    href="#section-team"
                    onClick={(e) => handleSectionLink(e, 'team')}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 hover:text-slate-950 dark:hover:text-white transition-colors flex items-center justify-between gap-2"
                  >
                    <span>{labels.teamLink}</span>
                    <ChevronRight className="w-3 h-3 opacity-35 flex-shrink-0 rtl:rotate-180" />
                  </a>
                </li>
                <li>
                  <a
                    href="#section-faq"
                    onClick={(e) => handleSectionLink(e, 'faq')}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 hover:text-slate-950 dark:hover:text-white transition-colors flex items-center justify-between gap-2"
                  >
                    <span>{labels.faqLink}</span>
                    <ChevronRight className="w-3 h-3 opacity-35 flex-shrink-0 rtl:rotate-180" />
                  </a>
                </li>
                <li>
                  <a
                    href="#section-contact"
                    onClick={(e) => handleSectionLink(e, 'contact')}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 hover:text-slate-950 dark:hover:text-white transition-colors flex items-center justify-between gap-2"
                  >
                    <span>{labels.contactLink}</span>
                    <ChevronRight className="w-3 h-3 opacity-35 flex-shrink-0 rtl:rotate-180" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Card 3: Client Services */}
            <div className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-5 shadow-2xs flex flex-col">
              <div className="flex items-center gap-2 pb-3 mb-2.5 border-b border-stone-100 dark:border-zinc-800/80">
                <span className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 inline-flex items-center justify-center text-amber-700 dark:text-amber-400 flex-shrink-0">
                  <Ticket className="w-3.5 h-3.5" />
                </span>
                <h4 className="font-black text-slate-900 dark:text-white text-xs tracking-wide">
                  {labels.servicesHeading}
                </h4>
              </div>

              <ul className="space-y-1 text-xs text-stone-600 dark:text-zinc-400 flex-1 flex flex-col justify-between">
                {onOpenTrackBooking && (
                  <li>
                    <button
                      type="button"
                      onClick={onOpenTrackBooking}
                      className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-zinc-900 hover:bg-stone-100 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 font-bold text-slate-800 dark:text-zinc-200 hover:text-amber-700 dark:hover:text-amber-400 transition-colors flex items-center justify-between gap-2 cursor-pointer text-start"
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <Ticket className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                        <span className="truncate">{labels.trackBtn}</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0 rtl:rotate-180" />
                    </button>
                  </li>
                )}

                <li>
                  <a
                    href="#section-loyalty"
                    onClick={(e) => handleSectionLink(e, 'loyalty')}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 hover:text-slate-950 dark:hover:text-white transition-colors flex items-center justify-between gap-2"
                  >
                    <span>{labels.loyaltyLink}</span>
                    <ChevronRight className="w-3 h-3 opacity-35 flex-shrink-0 rtl:rotate-180" />
                  </a>
                </li>

                <li>
                  <a
                    href="#section-reviews"
                    onClick={(e) => handleSectionLink(e, 'reviews')}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 hover:text-slate-950 dark:hover:text-white transition-colors flex items-center justify-between gap-2"
                  >
                    <span>{labels.reviewsLink}</span>
                    <ChevronRight className="w-3 h-3 opacity-35 flex-shrink-0 rtl:rotate-180" />
                  </a>
                </li>

                <li>
                  <a
                    href={salonSettings.googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-800 dark:hover:text-amber-300 transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 flex-shrink-0" />
                      <span>{labels.googleReviewBtn}</span>
                    </span>
                    <ExternalLink className="w-3 h-3 opacity-50 flex-shrink-0" />
                  </a>
                </li>

                <li>
                  <a
                    href={salonSettings.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 hover:text-slate-950 dark:hover:text-white transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                      <span>{labels.directionsBtn}</span>
                    </span>
                    <ExternalLink className="w-3 h-3 opacity-50 flex-shrink-0" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Card 4: Location & Direct Contact */}
            <div className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-5 shadow-2xs flex flex-col">
              <div className="flex items-center gap-2 pb-3 mb-2.5 border-b border-stone-100 dark:border-zinc-800/80">
                <span className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 inline-flex items-center justify-center text-amber-700 dark:text-amber-400 flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                </span>
                <h4 className="font-black text-slate-900 dark:text-white text-xs tracking-wide">
                  {labels.addressHeading}
                </h4>
              </div>

              <div className="space-y-1.5 text-xs text-stone-600 dark:text-zinc-400 flex-1 flex flex-col justify-between">
                <a
                  href={salonSettings.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-2 -mx-1 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 flex items-start gap-2.5 hover:text-amber-700 dark:hover:text-amber-400 transition-colors leading-relaxed"
                >
                  <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}</span>
                </a>

                <div className="space-y-1 pt-1 border-t border-stone-100 dark:border-zinc-800/70">
                  <a
                    href={normalizeSalonTelHref(salonSettings.salonPhone)}
                    className="px-2.5 py-1.5 -mx-1 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 flex items-center gap-2.5 text-slate-800 dark:text-zinc-200 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                  >
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span dir="ltr" className="font-mono font-bold">
                      {formatSalonDisplayPhone(salonSettings.salonPhone)}
                    </span>
                  </a>

                  {(salonSettings.additionalPhones || []).map((extraPhone) => (
                    <a
                      key={extraPhone}
                      href={normalizeSalonTelHref(extraPhone)}
                      className="px-2.5 py-1.5 -mx-1 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 flex items-center gap-2.5 text-slate-700 dark:text-zinc-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-stone-500 dark:text-zinc-400 flex-shrink-0" />
                      <span dir="ltr" className="font-mono font-semibold">
                        {formatSalonDisplayPhone(extraPhone)}
                      </span>
                    </a>
                  ))}
                </div>

                <a
                  href={`mailto:${SALON_INFO.email}`}
                  className="px-2.5 py-1.5 -mx-1 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/60 flex items-center gap-2.5 text-slate-700 dark:text-zinc-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors pt-1 border-t border-stone-100 dark:border-zinc-800/70"
                >
                  <Mail className="w-4 h-4 text-stone-500 dark:text-zinc-400 flex-shrink-0" />
                  <span dir="ltr" className="font-mono truncate">
                    {SALON_INFO.email}
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* Row 2: Two Balanced Horizontal Feature Action Cards Aligned to Grid */}
          <div className="grid grid-cols-2 gap-4">
            <a
              href="#section-reviews"
              onClick={(e) => handleSectionLink(e, 'reviews')}
              className="rounded-2xl bg-white dark:bg-[#13151B] border border-amber-200 dark:border-amber-500/35 hover:border-amber-400 dark:hover:border-amber-400/60 px-5 py-3.5 shadow-2xs flex items-center justify-between gap-3 text-slate-900 dark:text-white font-bold text-xs transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 inline-flex items-center justify-center flex-shrink-0">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                </span>
                <span className="truncate">{labels.googleRatingBadge}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 rtl:rotate-180" />
            </a>

            <a
              href={salonSettings.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500/40 px-5 py-3.5 shadow-2xs flex items-center justify-between gap-3 text-slate-800 dark:text-zinc-200 font-bold text-xs transition-colors"
            >
              <span className="inline-flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 inline-flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                </span>
                <span className="truncate">{labels.locationBadge}</span>
              </span>
              <ExternalLink className="w-4 h-4 text-stone-400 flex-shrink-0" />
            </a>
          </div>

          {/* Row 3: Unified Legal Info & Copyright Card Strip */}
          <div className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 px-5 py-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <span className="text-[11px] text-stone-500 dark:text-zinc-400">
              © {new Date().getFullYear()} {labels.rightsPrefix}{' '}
              <span
                onClick={handleRightsClick}
                onDoubleClick={handleRightsDoubleClick}
                className="select-none cursor-default"
              >
                {labels.rightsReserved}
              </span>
            </span>

            {onOpenInfoModal && (
              <nav
                aria-label={pickLang(lang, {
                  ar: 'معلومات وسياسات الصالون',
                  fr: 'Informations et mentions légales',
                  amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵙⴰⵍⵓⵏ',
                  en: 'Salon information and policies',
                  es: 'Información y políticas',
                })}
                className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs"
              >
                {(
                  [
                    { id: 'about', label: labels.aboutPageLink },
                    { id: 'contact', label: labels.contactPageLink },
                    { id: 'privacy', label: labels.privacyLink },
                    { id: 'terms', label: labels.termsLink },
                  ] as { id: PublicInfoSection; label: string }[]
                ).map((item, idx) => (
                  <React.Fragment key={item.id}>
                    {idx > 0 && (
                      <span aria-hidden="true" className="text-stone-300 dark:text-zinc-700">
                        ·
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenInfoModal(item.id)}
                      className="min-h-[32px] px-2.5 py-1 rounded-lg font-bold text-stone-600 dark:text-zinc-300 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-stone-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {item.label}
                    </button>
                  </React.Fragment>
                ))}
              </nav>
            )}

            <button
              type="button"
              onClick={scrollToTop}
              className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-zinc-900 hover:bg-stone-200 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
              aria-label={labels.topAria}
              title={labels.topAria}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
