import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Phone, 
  Calendar, 
  Clock, 
  Menu, 
  X, 
  Sparkles,
  BookmarkCheck,
  Globe,
  Coffee,
  Shield,
  MessageCircle
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../types';

interface NavbarProps {
  onOpenBooking: () => void;
  onOpenMyAppointments: () => void;
  savedAppointmentsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenBooking,
  onOpenMyAppointments,
  savedAppointmentsCount,
}) => {
  const { lang, setLang, t, isRtl } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOpenNow, setIsOpenNow] = useState(true);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 25);
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

  const languageOptions: { code: Language; label: string; flag: string }[] = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'ar', label: 'العربية', flag: '🇲ⴰ' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'amz', label: 'ⵜⴰⵎⴰⵣⵉⵖⵜ', flag: 'ⵣ' },
  ];

  return (
    <>
      {/* Top micro bar with location info, men's only badge, and contact */}
      <div className="bg-[#050608] border-b border-zinc-800/80 text-xs py-1.5 px-4 text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Men's Services Only Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px] tracking-wide">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>{t.mensOnly}</span>
            </span>

            <span className="hidden md:inline-flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              <span className="truncate max-w-xs">{SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live opening badge */}
            <div className="flex items-center gap-1.5 bg-zinc-900/90 px-2.5 py-0.5 rounded-full border border-zinc-800">
              <span className={`w-2 h-2 rounded-full ${isOpenNow ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-[11px] font-semibold text-zinc-300">
                {isOpenNow ? t.openStatus : t.closedStatus}
              </span>
            </div>

            {/* Direct phone call */}
            <a 
              href={`tel:${SALON_INFO.phone}`} 
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold text-xs transition-colors"
            >
              <Phone className="w-3 h-3" />
              <span>{SALON_INFO.displayPhone}</span>
            </a>
          </div>

        </div>
      </div>

      {/* Main Sticky Header */}
      <header 
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isScrolled 
            ? 'bg-[#08090C]/96 backdrop-blur-md shadow-2xl border-b border-amber-500/30 py-2.5' 
            : 'bg-[#08090C]/85 backdrop-blur-sm py-3.5 border-b border-zinc-800/60'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          
          {/* Logo & Brand Identity */}
          <a href="#" className="flex items-center gap-3 group flex-shrink-0">
            <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-white/5 border border-amber-500/40 p-1 flex items-center justify-center shadow-lg shadow-amber-500/10 group-hover:border-amber-400 transition-colors">
              <img 
                src={SALON_INFO.media.logo} 
                alt="Salon Boumlik Official Logo" 
                className="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform"
              />
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg sm:text-xl font-black tracking-wider text-white">
                  {lang === 'amz' ? (
                    <span>ⵙⴰⵍⵓⵏ <span className="text-gold-gradient">ⴱⵓⵎⵍⵉⴽ</span></span>
                  ) : lang === 'ar' ? (
                    <span>صالون <span className="text-gold-gradient">بومليك</span></span>
                  ) : (
                    <span>SALON <span className="text-gold-gradient">BOUMLIK</span></span>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-amber-400/90 font-medium tracking-wide flex items-center gap-1.5">
                <span className="italic font-serif">"{SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}"</span>
                <span className="text-zinc-600 hidden sm:inline">•</span>
                <span className="text-zinc-400 hidden sm:inline text-[10px]">{SALON_INFO.city[lang] || SALON_INFO.city.fr}</span>
              </p>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-6 text-xs sm:text-sm font-semibold text-zinc-300">
            <a href="#services" className="hover:text-amber-400 transition-colors">
              {t.navServices}
            </a>
            <a href="#amenities" className="hover:text-amber-400 transition-colors flex items-center gap-1.5 text-amber-300/90">
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.navAmenities}</span>
            </a>
            <a href="#team" className="hover:text-amber-400 transition-colors">
              {t.navTeam}
            </a>
            <a href="#location" className="hover:text-amber-400 transition-colors">
              {t.navLocation}
            </a>
            <a href="#reviews" className="hover:text-amber-400 transition-colors flex items-center gap-1">
              <span>{t.navReviews}</span>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">5.0 ★</span>
            </a>
            <a href="#contact" className="hover:text-amber-400 transition-colors">
              {t.navContact}
            </a>
          </nav>

          {/* Right Action Cluster: Language Switcher + Booking CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Multilingual Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                title="Choisir la langue / اختر اللغة / Select Language"
              >
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span className="uppercase">{lang}</span>
                <span className="text-[10px] text-zinc-400">▼</span>
              </button>

              {langDropdownOpen && (
                <div 
                  className={`absolute top-full mt-2 w-36 rounded-xl bg-zinc-950 border border-amber-500/40 p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
                    isRtl ? 'left-0' : 'right-0'
                  }`}
                >
                  {languageOptions.map((opt) => (
                    <button
                      key={opt.code}
                      onClick={() => {
                        setLang(opt.code);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition-colors ${
                        lang === opt.code
                          ? 'bg-amber-400 text-zinc-950 font-bold'
                          : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span>{opt.flag}</span>
                        <span>{opt.label}</span>
                      </span>
                      {lang === opt.code && <span className="text-[10px] font-black">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* My Appointments saved counter */}
            {savedAppointmentsCount > 0 && (
              <button
                onClick={onOpenMyAppointments}
                className="hidden sm:flex relative p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 transition-all items-center gap-1 text-xs font-semibold cursor-pointer"
                title="Voir mes réservations"
              >
                <BookmarkCheck className="w-4 h-4 text-amber-400" />
                <span className="bg-amber-400 text-zinc-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {savedAppointmentsCount}
                </span>
              </button>
            )}

            {/* Primary Action Button (WhatsApp Booking / Custom Quote) */}
            <button
              onClick={onOpenBooking}
              className="relative group overflow-hidden px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs sm:text-sm text-zinc-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-zinc-950 fill-zinc-950" />
              <span className="hidden sm:inline">{t.bookAppointment}</span>
              <span className="sm:hidden">
                {lang === 'ar' ? 'حجز' : lang === 'amz' ? 'ⴰⵙⵔⵓⵙ' : lang === 'en' ? 'Book' : 'Réserver'}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-zinc-950 opacity-80 group-hover:rotate-12 transition-transform" />
            </button>

            {/* Mobile Hamburger toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-xl bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>

        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden bg-[#0A0C10] border-b border-zinc-800 px-4 pt-3 pb-6 mt-2 space-y-3 shadow-2xl">
            
            {/* Multilingual Selector inside mobile menu */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 mb-2">
              {languageOptions.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => {
                    setLang(opt.code);
                    setMobileMenuOpen(false);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold text-center transition-all ${
                    lang === opt.code
                      ? 'bg-amber-400 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.code.toUpperCase()}
                </button>
              ))}
            </div>

            <nav className="flex flex-col space-y-1.5 text-sm font-semibold text-zinc-300">
              <a 
                href="#services" 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-xl hover:bg-zinc-900 hover:text-amber-400 transition-colors flex items-center justify-between"
              >
                <span>{t.navServices}</span>
                <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-bold">
                  {lang === 'ar' ? 'طلب السعر' : lang === 'amz' ? 'ⴰⵜⵉⴳ' : 'Sur Devis'}
                </span>
              </a>

              <a 
                href="#amenities" 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-xl hover:bg-zinc-900 hover:text-amber-400 transition-colors flex items-center justify-between text-amber-300"
              >
                <span>{t.navAmenities}</span>
                <Coffee className="w-4 h-4 text-amber-400" />
              </a>

              <a 
                href="#team" 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-xl hover:bg-zinc-900 hover:text-amber-400 transition-colors"
              >
                {t.navTeam}
              </a>

              <a 
                href="#location" 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-xl hover:bg-zinc-900 hover:text-amber-400 transition-colors flex items-center justify-between"
              >
                <span>{t.navLocation}</span>
                <MapPin className="w-4 h-4 text-amber-400" />
              </a>

              <a 
                href="#reviews" 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-xl hover:bg-zinc-900 hover:text-amber-400 transition-colors flex items-center justify-between"
              >
                <span>{t.navReviews}</span>
                <span className="text-amber-400 text-xs font-bold">5.0 ★</span>
              </a>

              <a 
                href="#contact" 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-xl hover:bg-zinc-900 hover:text-amber-400 transition-colors"
              >
                {t.navContact}
              </a>
            </nav>

            <div className="pt-2 border-t border-zinc-800 space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenBooking();
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-400/25"
              >
                <MessageCircle className="w-4 h-4 fill-zinc-950" />
                <span>{t.bookAppointment}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`tel:${SALON_INFO.phone}`}
                  className="py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-center text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>{SALON_INFO.phone}</span>
                </a>

                <a
                  href={`https://wa.me/${SALON_INFO.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-center text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

          </div>
        )}

      </header>
    </>
  );
};
