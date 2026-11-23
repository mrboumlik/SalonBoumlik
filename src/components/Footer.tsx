import React from 'react';
import {
  MapPin,
  Phone,
  Mail,
  ArrowUp,
  Instagram,
  Facebook,
  MessageCircle,
  Lock,
  Ticket,
  ExternalLink,
  Star,
  Scissors,
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

import type { HomepageSectionKey } from './DrawerMenu';
import type { PublicInfoSection } from './PublicInfoModal';

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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSectionLink = (e: React.MouseEvent, sectionId: HomepageSectionKey) => {
    if (onNavigateToSection) {
      e.preventDefault();
      onNavigateToSection(sectionId);
    }
  };

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
    rights: pickLang(lang, {
      ar: 'صالون بومليك تارودانت — جميع الحقوق محفوظة',
      fr: 'Salon Boumlik Taroudant — Tous droits réservés',
      amz: 'ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⵜⴰⵔⵓⴷⴰⵏⵜ — ⴰⴽⴽⵯ ⵉⵣⵔⴼⴰⵏ ⵜⵜⵓⵃⴹⴰⵏ',
      en: 'Salon Boumlik Taroudant — All rights reserved',
      es: 'Salon Boumlik Taroudant — Todos los derechos reservados',
    }),
    staffAccess: pickLang(lang, {
      ar: 'دخول الإدارة',
      fr: 'Accès Équipe',
      amz: 'ⴰⴽⵛⵓⵎ ⵏ ⵜⵔⴰⴱⴱⵓⵜ',
      en: 'Staff Access',
      es: 'Acceso Equipo',
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
  };

  return (
    <footer className="relative z-10 bg-stone-100/80 dark:bg-[#0B0C10] border-t border-stone-200 dark:border-zinc-800/80 text-stone-600 dark:text-zinc-400 text-xs transition-colors">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24 sm:py-9">
        {/* 1. Centered Brand Identity Header */}
        <div className="flex flex-col items-center text-center pb-7 mb-7 border-b border-stone-200/80 dark:border-zinc-800/80 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700/80 p-1 flex items-center justify-center shadow-2xs">
            <img
              src={SALON_INFO.media.logoClean}
              alt="Salon Boumlik Logo"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-1 max-w-md">
            <span className="font-display text-lg sm:text-xl font-black tracking-wide text-slate-900 dark:text-white block">
              SALON <span className="text-amber-700 dark:text-amber-400">BOUMLIK</span>
            </span>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300/90">
              {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
            </p>
            <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed text-balance">
              {labels.about}
            </p>
          </div>

          {/* Centered Social Media Icon Row */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <a
              href={SALON_INFO.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 hover:bg-stone-200/80 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border border-stone-200 dark:border-zinc-800 flex items-center justify-center transition-all duration-200 shadow-2xs"
              title="Instagram @SalonBoumlik"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>

            <a
              href={SALON_INFO.social.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 hover:bg-stone-200/80 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border border-stone-200 dark:border-zinc-800 flex items-center justify-center transition-all duration-200 shadow-2xs"
              title="Facebook Salon Boumlik"
              aria-label="Facebook"
            >
              <Facebook className="w-4 h-4" />
            </a>

            <a
              href={`https://wa.me/${normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 hover:bg-stone-200/80 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 border border-stone-200 dark:border-zinc-800 flex items-center justify-center transition-all duration-200 shadow-2xs"
              title={`WhatsApp ${formatSalonDisplayPhone(salonSettings.salonWhatsapp)}`}
              aria-label="WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* 2. Compact 2-Column Mobile / 3-Column Desktop Grid (Links + Contact Card) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 items-start">
          {/* Quick Links */}
          <div className="space-y-3">
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

          {/* Client Services */}
          <div className="space-y-3">
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

          {/* 3. Clean Contact & Location Card */}
          <div className="col-span-2 md:col-span-1 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-4 shadow-2xs space-y-3">
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

        {/* 4. Public Info Links Bar (About, Contact, Privacy Policy, Terms of Use) */}
        {onOpenInfoModal && (
          <nav
            aria-label={pickLang(lang, {
              ar: 'معلومات وسياسات الصالون',
              fr: 'Informations et mentions légales',
              amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵙⴰⵍⵓⵏ',
              en: 'Salon information and policies',
              es: 'Información y políticas',
            })}
            className="mt-7 pt-5 border-t border-stone-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2 text-xs"
          >
            {(
              [
                { id: 'about', label: labels.aboutPageLink },
                { id: 'contact', label: labels.contactPageLink },
                { id: 'privacy', label: labels.privacyLink },
                { id: 'terms', label: labels.termsLink },
              ] as { id: PublicInfoSection; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenInfoModal(item.id)}
                className="font-bold text-stone-600 dark:text-zinc-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors cursor-pointer py-1"
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        {/* 5. Sleek Bottom Copyright & Admin Bar */}
        <div
          className={`${
            onOpenInfoModal ? 'mt-4 pt-4' : 'mt-7 pt-5'
          } border-t border-stone-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-stone-500 dark:text-zinc-400`}
        >
          <span>
            © {new Date().getFullYear()} {labels.rights}
          </span>

          <div className="flex items-center gap-2.5">
            {onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-stone-600 dark:text-zinc-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-stone-200 dark:hover:border-zinc-800 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{labels.staffAccess}</span>
              </button>
            )}

            <button
              type="button"
              onClick={scrollToTop}
              className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 hover:bg-stone-200/80 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
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
