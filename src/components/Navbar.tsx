import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Phone,
  Menu,
  Ticket,
  Shield,
  Scissors,
  ExternalLink,
  Star,
  Sun,
  Moon
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useSalonProfileSettings } from '../utils/salonSettingsStore';
import { Language } from '../types';
import { FlagIcon } from './LanguageFlags';
import { PWAInstallButton } from './PWAInstallButton';
import logoImage from '../assets/images/regenerated_image_1793760774705.png';

interface NavbarProps {
  onOpenBooking: () => void;
  onOpenTrackBooking: () => void;
  onOpenDrawerMenu: () => void;
  onOpenAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenBooking,
  onOpenTrackBooking,
  onOpenDrawerMenu,
}) => {
  const { lang, setLang, t, isRtl } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const salonSettings = useSalonProfileSettings();
  const [isScrolled, setIsScrolled] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [isOpenNow, setIsOpenNow] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    if (day === 5) {
      setIsOpenNow(hour >= 15 && hour < 23);
    } else if (day === 0) {
      setIsOpenNow(hour >= 10 && hour < 21);
    } else {
      setIsOpenNow(hour >= 10 && hour < 22);
    }
  }, []);

  const languageOptions: { code: Language; label: string }[] = [
    { code: 'ar', label: 'العربية' },
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
    { code: 'amz', label: 'ⵜⴰⵎⴰⵣⵉⵖⵜ' },
    { code: 'es', label: 'Español' },
  ];

  const themeToggleText = isDark
    ? {
        ar: 'فاتح',
        fr: 'Clair',
        en: 'Light',
        amz: 'ⵉⴼⴰⵡⵏ',
        es: 'Claro',
      }[lang] || 'Clair'
    : {
        ar: 'داكن',
        fr: 'Sombre',
        en: 'Dark',
        amz: 'ⴰⴱⵕⴽⴰⵏ',
        es: 'Oscuro',
      }[lang] || 'Sombre';

  const themeToggleAria = isDark
    ? {
        ar: 'التبديل إلى الوضع الفاتح عالي التباين',
        fr: 'Passer au thème clair haute visibilité',
        en: 'Switch to high-contrast light theme',
        amz: 'ⵙⵏⴼⵍ ⵖⵔ ⵓⵎⵍⵍⴰⵍ',
        es: 'Cambiar al tema claro de alto contraste',
      }[lang] || 'Passer au thème clair'
    : {
        ar: 'التبديل إلى الوضع الداكن',
        fr: 'Passer au thème sombre',
        en: 'Switch to dark theme',
        amz: 'ⵙⵏⴼⵍ ⵖⵔ ⵓⴱⵕⴽⴰⵏ',
        es: 'Cambiar al tema oscuro',
      }[lang] || 'Passer au thème sombre';

  return (
    <>
      {/* Barber pole top stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-red-600 via-white to-blue-600 z-50 fixed top-0 inset-x-0" />

      {/* Top micro bar */}
      <div className="mt-1 bg-slate-100 dark:bg-black border-b border-slate-200 dark:border-zinc-900 text-xs py-1.5 px-4 text-slate-700 dark:text-zinc-400 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Men's Services Only Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 font-bold text-[11px] tracking-wide">
              <Shield className="w-3 h-3 text-red-600 dark:text-red-400" />
              <span>{t.mensOnly}</span>
            </span>

            <a
              href={salonSettings.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-white hover:border-blue-400 text-[11px] font-semibold transition-colors"
              title="Google Maps — Salon Boumlik Taroudant"
            >
              <MapPin className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="hidden md:inline truncate max-w-xs">{SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}</span>
              <span className="md:hidden">Google Maps</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-80" />
            </a>

            <a
              href={salonSettings.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-200 text-[10px] font-bold transition-colors"
              title="Google Business Profile 5.0"
            >
              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
              <span>Google 5.0</span>
            </a>
          </div>

          <div className="flex items-center gap-3">
            {/* Live opening badge */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2.5 py-0.5 rounded-full border border-slate-300 dark:border-zinc-800 shadow-2xs">
              <span className={`w-2 h-2 rounded-full ${isOpenNow ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-amber-500 dark:bg-amber-400'}`} />
              <span className="text-[11px] font-semibold text-slate-800 dark:text-zinc-300">
                {isOpenNow ? t.openStatus : t.closedStatus}
              </span>
            </div>

            {/* Direct phone call */}
            <a 
              href={`tel:${SALON_INFO.phone}`} 
              className="text-slate-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1.5 font-bold text-xs transition-colors"
            >
              <Phone className="w-3 h-3 text-red-600 dark:text-red-500 flex-shrink-0" />
              <span dir="ltr" className="inline-block font-mono tracking-wider">{SALON_INFO.displayPhone}</span>
            </a>
          </div>

        </div>
      </div>

      {/* Main Sticky Header */}
      <header 
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/95 dark:bg-black/95 backdrop-blur-md shadow-lg dark:shadow-2xl border-b border-slate-200 dark:border-zinc-800 py-2.5' 
            : 'bg-white/90 dark:bg-black/85 backdrop-blur-sm py-3 border-b border-slate-200/90 dark:border-zinc-800/80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-4">
          
          {/* Logo & Brand Name */}
          <a href="#" className="flex items-center gap-3 group flex-shrink-0">
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 p-0.5 flex items-center justify-center shadow-md group-hover:border-red-500 transition-colors">
              <img 
                src={logoImage || SALON_INFO.media.logoClean} 
                alt="Salon Boumlik Official Logo" 
                className="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform"
              />
            </div>
            
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-lg sm:text-xl font-black tracking-wider text-slate-900 dark:text-white">
                  SALON <span className="text-red-600 dark:text-red-500">BOU</span><span className="text-blue-600 dark:text-blue-500">MLIK</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-zinc-400 font-medium">
                {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
              </p>
            </div>
          </a>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            <a href="#booking" className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors font-black">
              {lang === 'ar' ? 'طلب موعد' : 'Réservation'}
            </a>
            <a href="#services" className="hover:text-slate-950 dark:hover:text-white transition-colors">
              {lang === 'ar' ? 'الخدمات والأسعار' : 'Prestations & Tarifs'}
            </a>
            <a href="#team" className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
              {lang === 'ar' ? 'فريق الحلاقين' : lang === 'en' ? 'Barbers' : 'Équipe'}
            </a>
            <a href="#reviews" className="hover:text-slate-950 dark:hover:text-white transition-colors">
              {lang === 'ar' ? 'آراء الزبناء' : 'Avis Google 5.0'}
            </a>
            <a href="#contact" className="hover:text-slate-950 dark:hover:text-white transition-colors">
              {lang === 'ar' ? 'اتصل بنا' : 'Contact'}
            </a>
          </nav>

          {/* Right Actions: Language Switcher, Theme Toggle, Track Booking, Book CTA & Hamburger Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            
            {/* 5-Language Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="min-h-[38px] flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                aria-label="Changer de langue"
              >
                <FlagIcon lang={lang} className="w-4 h-4 rounded-full" />
                <span className="hidden sm:inline uppercase text-[11px]">{lang}</span>
              </button>

              {langDropdownOpen && (
                <div 
                  className={`absolute top-full mt-2 ${isRtl ? 'left-0' : 'right-0'} w-36 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl py-1 z-50`}
                >
                  {languageOptions.map((opt) => (
                    <button
                      type="button"
                      key={opt.code}
                      onClick={() => {
                        setLang(opt.code);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left rtl:text-right flex items-center justify-between text-xs hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer ${
                        lang === opt.code ? 'text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-zinc-900/60' : 'text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FlagIcon lang={opt.code} className="w-3.5 h-3.5 rounded-full" />
                        <span>{opt.label}</span>
                      </div>
                      {lang === opt.code && <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Direct High-Contrast Light / Dark Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={!isDark}
              aria-label={themeToggleAria}
              title={themeToggleAria}
              className={`min-h-[38px] min-w-[38px] py-1.5 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-amber-300 hover:border-amber-400/60'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white shadow-sm'
              }`}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 flex-shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-amber-300 flex-shrink-0" />
              )}
              <span className="hidden lg:inline text-[11px] font-bold">
                {themeToggleText}
              </span>
            </button>

            {/* Track Booking Button */}
            <button
              type="button"
              onClick={onOpenTrackBooking}
              className="min-h-[38px] py-1.5 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              title="Suivi de réservation"
            >
              <Ticket className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">
                {lang === 'ar' ? 'تتبع التذكرة' : 'Suivi Ticket'}
              </span>
            </button>

            {/* Book Now Button */}
            <a
              href="#booking"
              onClick={(e) => {
                const el = document.getElementById('booking');
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  onOpenBooking();
                }
              }}
              className="min-h-[38px] py-1.5 px-3 sm:px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-600/20 active:scale-95 transition-all"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'احجز الآن' : 'Réserver'}</span>
            </a>

            {/* PWA Install Button */}
            <PWAInstallButton variant="navbar" />

            {/* Hamburger Menu Button (Opens DrawerMenu for Team, Gallery, Wi-Fi, Location) */}
            <button
              type="button"
              onClick={onOpenDrawerMenu}
              className="min-h-[38px] min-w-[38px] p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Menu complet (Équipe, Galerie, Wi-Fi)"
              title="Menu complet"
            >
              <Menu className="w-5 h-5 text-red-600 dark:text-red-500" />
            </button>

          </div>

        </div>
      </header>
    </>
  );
};
