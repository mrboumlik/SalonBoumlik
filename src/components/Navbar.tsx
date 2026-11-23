import React, { useState, useEffect } from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import logoImage from '../assets/images/regenerated_image_1793760774705.png';

interface NavbarProps {
  onOpenBooking?: () => void;
  onOpenTrackBooking?: () => void;
  onOpenDrawerMenu: () => void;
  onOpenAdmin?: () => void;
  onNavigateHome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenDrawerMenu,
  onNavigateHome,
}) => {
  const { lang } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const themeToggleAria = isDark
    ? {
        ar: 'التبديل إلى الوضع الفاتح',
        fr: 'Passer au mode clair',
        en: 'Switch to light mode',
        amz: 'ⵙⵏⴼⵍ ⵖⵔ ⵓⵎⵍⵍⴰⵍ',
        es: 'Cambiar a modo claro',
      }[lang] || 'Passer au mode clair'
    : {
        ar: 'التبديل إلى الوضع الداكن',
        fr: 'Passer au mode sombre',
        en: 'Switch to dark mode',
        amz: 'ⵙⵏⴼⵍ ⵖⵔ ⵓⴱⵕⴽⴰⵏ',
        es: 'Cambiar a modo oscuro',
      }[lang] || 'Passer au mode sombre';

  const menuAria = {
    ar: 'فتح القائمة الكاملة',
    fr: 'Ouvrir le menu',
    en: 'Open menu',
    amz: 'ⵕⵥⵎ ⵜⴰⵍⴳⴰⵎⵜ',
    es: 'Abrir el menú',
  }[lang] || 'Menu';

  const homeAria = {
    ar: 'العودة إلى الصفحة الرئيسية — صالون بومليك',
    fr: 'Retour à l’accueil — Salon Boumlik',
    en: 'Back to home — Salon Boumlik',
    amz: 'ⴰⵖⵓⵍ ⵖⵔ ⵜⴰⵙⵏⴰ ⵜⴰⵎⵣⵡⴰⵔⵓⵜ — Salon Boumlik',
    es: 'Volver al inicio — Salon Boumlik',
  }[lang] || 'Salon Boumlik';

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (onNavigateHome) {
      onNavigateHome();
      return;
    }
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-200 border-b ${
        isScrolled
          ? 'bg-white dark:bg-[#0B0C10] border-stone-200 dark:border-zinc-800 shadow-xs py-2.5'
          : 'bg-[#FAF9F6] dark:bg-[#0B0C10] border-stone-200 dark:border-zinc-800 py-3'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Logo & Brand Name ONLY */}
        <a
          href="#top"
          onClick={handleLogoClick}
          aria-label={homeAria}
          title={homeAria}
          className="flex items-center gap-2.5 sm:gap-3 group flex-shrink-0 min-w-0 cursor-pointer"
        >
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700/80 p-0.5 flex items-center justify-center shadow-2xs group-hover:border-amber-500/60 transition-colors">
            <img
              src={logoImage || SALON_INFO.media.logoClean}
              alt="Salon Boumlik"
              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
            />
          </div>

          <div className="min-w-0">
            <span className="font-display text-base sm:text-lg font-black tracking-wider text-slate-900 dark:text-white whitespace-nowrap block leading-none">
              SALON{' '}
              <span className="text-amber-700 dark:text-amber-400">BOUMLIK</span>
            </span>
            <p
              key={`nav-slogan-${lang}`}
              className="hidden sm:block text-[10px] text-stone-500 dark:text-zinc-400 font-medium mt-0.5 truncate lang-switch-transition"
            >
              {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
            </p>
          </div>
        </a>

        {/* Minimal Controls: Language Switcher + Theme Toggle + Hamburger Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <LanguageSwitcher />

          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={isDark}
            aria-label={themeToggleAria}
            title={themeToggleAria}
            className="min-h-[38px] min-w-[38px] p-2 rounded-xl bg-white hover:bg-stone-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-amber-400 transition-colors flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenDrawerMenu}
            aria-label={menuAria}
            title={menuAria}
            className="min-h-[38px] min-w-[38px] p-2 rounded-xl bg-white hover:bg-stone-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 transition-colors flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
