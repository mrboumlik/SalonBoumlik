import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Phone, 
  Menu, 
  X, 
  Ticket, 
  Globe, 
  Shield, 
  Scissors,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Language, AppTheme } from '../types';
import { FlagIcon } from './LanguageFlags';
import { Palette, Sun, Moon, Sparkles } from 'lucide-react';
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
  onOpenAdmin,
}) => {
  const { lang, setLang, t, isRtl } = useLanguage();
  const { theme, setTheme, toggleTheme, themeConfig } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
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

  return (
    <>
      {/* Barber pole top stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-red-600 via-white to-blue-600 z-50 fixed top-0 inset-x-0" />

      {/* Top micro bar */}
      <div className="mt-1 bg-black border-b border-zinc-900 text-xs py-1.5 px-4 text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Men's Services Only Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-950/40 border border-red-500/30 text-red-300 font-bold text-[11px] tracking-wide">
              <Shield className="w-3 h-3 text-red-400" />
              <span>{t.mensOnly}</span>
            </span>

            <span className="hidden md:inline-flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span className="truncate max-w-xs">{SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live opening badge */}
            <div className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-0.5 rounded-full border border-zinc-800">
              <span className={`w-2 h-2 rounded-full ${isOpenNow ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-[11px] font-semibold text-zinc-300">
                {isOpenNow ? t.openStatus : t.closedStatus}
              </span>
            </div>

            {/* Direct phone call */}
            <a 
              href={`tel:${SALON_INFO.phone}`} 
              className="text-white hover:text-red-400 flex items-center gap-1.5 font-bold text-xs transition-colors"
            >
              <Phone className="w-3 h-3 text-red-500 flex-shrink-0" />
              <span dir="ltr" className="inline-block font-mono tracking-wider">{SALON_INFO.displayPhone}</span>
            </a>
          </div>

        </div>
      </div>

      {/* Main Sticky Header */}
      <header 
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isScrolled 
            ? 'bg-black/95 backdrop-blur-md shadow-2xl border-b border-zinc-800 py-2.5' 
            : 'bg-black/85 backdrop-blur-sm py-3 border-b border-zinc-800/80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          
          {/* Logo & Brand Name */}
          <a href="#" className="flex items-center gap-3 group flex-shrink-0">
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 p-0.5 flex items-center justify-center shadow-lg group-hover:border-red-500 transition-colors">
              <img 
                src={logoImage || SALON_INFO.media.logoClean} 
                alt="Salon Boumlik Official Logo" 
                className="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform"
              />
            </div>
            
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-lg sm:text-xl font-black tracking-wider text-white">
                  SALON <span className="text-red-500">BOU</span><span className="text-blue-500">MLIK</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 font-medium">
                {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
              </p>
            </div>
          </a>

          {/* Center Navigation Links (Homepage ONLY displays these sections) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-zinc-400">
            <a href="#booking" className="hover:text-amber-400 transition-colors font-black">
              {lang === 'ar' ? 'طلب موعد' : 'Réservation'}
            </a>
            <a href="#services" className="hover:text-white transition-colors">
              {lang === 'ar' ? 'الخدمات والأسعار' : 'Prestations & Tarifs'}
            </a>
            <a href="#reviews" className="hover:text-white transition-colors">
              {lang === 'ar' ? 'آراء الزبناء' : 'Avis Google 5.0'}
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              {lang === 'ar' ? 'اتصل بنا' : 'Contact'}
            </a>
          </nav>

          {/* Right Actions: Language Switcher, Track Booking, Book CTA & Hamburger Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* 5-Language Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
                aria-label="Changer de langue"
              >
                <FlagIcon lang={lang} className="w-4 h-4 rounded-full" />
                <span className="hidden sm:inline uppercase text-[11px]">{lang}</span>
              </button>

              {langDropdownOpen && (
                <div 
                  className={`absolute top-full mt-2 ${isRtl ? 'left-0' : 'right-0'} w-36 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl py-1 z-50`}
                >
                  {languageOptions.map((opt) => (
                    <button
                      key={opt.code}
                      onClick={() => {
                        setLang(opt.code);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-zinc-900 transition-colors ${
                        lang === opt.code ? 'text-red-400 font-bold bg-zinc-900/60' : 'text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FlagIcon lang={opt.code} className="w-3.5 h-3.5 rounded-full" />
                        <span>{opt.label}</span>
                      </div>
                      {lang === opt.code && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme Customizer Switcher */}
            <div className="relative">
              <button
                onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
                className="p-1.5 px-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Changer de thème"
                aria-label="Changer de thème"
              >
                <span>{themeConfig.icon}</span>
                <span className="hidden xl:inline text-[11px] text-zinc-400">
                  {themeConfig.name[lang] || themeConfig.name.fr}
                </span>
              </button>

              {themeDropdownOpen && (
                <div 
                  className={`absolute top-full mt-2 ${isRtl ? 'left-0' : 'right-0'} w-44 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl py-1 z-50`}
                >
                  <button
                    onClick={() => {
                      setTheme('luxury_gold');
                      setThemeDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-zinc-900 transition-colors ${
                      theme === 'luxury_gold' ? 'text-amber-400 font-bold bg-zinc-900/60' : 'text-zinc-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>✨</span>
                      <span>{lang === 'ar' ? 'ذهبي فاخر' : 'Luxury Gold'}</span>
                    </span>
                    {theme === 'luxury_gold' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setTheme('charcoal');
                      setThemeDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-zinc-900 transition-colors ${
                      theme === 'charcoal' ? 'text-blue-400 font-bold bg-zinc-900/60' : 'text-zinc-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>💈</span>
                      <span>{lang === 'ar' ? 'رمادي فحمي' : 'Charcoal'}</span>
                    </span>
                    {theme === 'charcoal' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setTheme('minimal_light');
                      setThemeDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-zinc-900 transition-colors ${
                      theme === 'minimal_light' ? 'text-zinc-100 font-bold bg-zinc-900/60' : 'text-zinc-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>☀️</span>
                      <span>{lang === 'ar' ? 'أبيض نقي' : 'Light Mode'}</span>
                    </span>
                    {theme === 'minimal_light' && <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />}
                  </button>
                </div>
              )}
            </div>

            {/* Track Booking Button */}
            <button
              onClick={onOpenTrackBooking}
              className="py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Suivi de réservation"
            >
              <Ticket className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">
                {lang === 'ar' ? 'تتبع التذكرة' : 'Suivi Ticket'}
              </span>
            </button>

            {/* Book Now Button */}
            <a
              href="#booking"
              onClick={(e) => {
                // If user clicks, scroll smoothly to #booking or trigger modal
                const el = document.getElementById('booking');
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  onOpenBooking();
                }
              }}
              className="py-1.5 px-3.5 sm:px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-600/20 active:scale-95 transition-all"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'احجز الآن' : 'Réserver'}</span>
            </a>

            {/* Hamburger Menu Button (Opens DrawerMenu for Team, Gallery, Wi-Fi, Location) */}
            <button
              onClick={onOpenDrawerMenu}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
              aria-label="Menu complet (Équipe, Galerie, Wi-Fi)"
              title="Menu complet"
            >
              <Menu className="w-5 h-5 text-red-500" />
            </button>

          </div>

        </div>
      </header>
    </>
  );
};
