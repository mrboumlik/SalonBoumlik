import React, { useState, useEffect, useRef } from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PWAInstallButton } from './PWAInstallButton';
import { BrandMark } from './BrandMark';

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
  const [isHiddenOnScroll, setIsHiddenOnScroll] = useState(false);
  const [isTopHovering, setIsTopHovering] = useState(false);
  const [isHeaderHovering, setIsHeaderHovering] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const lastScrollYRef = useRef<number>(0);

  useEffect(() => {
    const getScrollY = () =>
      window.pageYOffset !== undefined
        ? window.pageYOffset
        : document.documentElement.scrollTop || 0;

    lastScrollYRef.current = getScrollY();

    const handleScroll = () => {
      const currentY = getScrollY();
      const prevY = lastScrollYRef.current;

      setIsScrolled(currentY > 12);

      if (currentY <= 72) {
        setIsHiddenOnScroll(false);
      } else if (currentY > prevY + 8 && currentY > 96) {
        setIsHiddenOnScroll(true);
      } else if (currentY < prevY - 6) {
        setIsHiddenOnScroll(false);
      }

      lastScrollYRef.current = currentY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 52) {
        setIsTopHovering(true);
      } else if (e.clientY > 88) {
        setIsTopHovering(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const shouldHideHeader =
    isHiddenOnScroll && !isTopHovering && !isHeaderHovering && !isLangMenuOpen;

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
    setIsHiddenOnScroll(false);
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
    <>
      {/* Subtle Top-Edge Cursor Wake Sensor when header is auto-hidden */}
      {shouldHideHeader && (
        <div
          aria-hidden="true"
          onMouseEnter={() => setIsTopHovering(true)}
          className="fixed top-0 inset-x-0 h-4 z-40"
        />
      )}

      <header
        onMouseEnter={() => setIsHeaderHovering(true)}
        onMouseLeave={() => setIsHeaderHovering(false)}
        className={`sticky top-0 z-40 border-b transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          shouldHideHeader
            ? '-translate-y-full pointer-events-none'
            : 'translate-y-0'
        } ${
          isScrolled
            ? 'sb-navbar-scrolled border-stone-200 dark:border-zinc-800 shadow-xs py-2'
            : 'bg-[#FAF9F6] dark:bg-[#0B0C10] border-stone-200 dark:border-zinc-800 py-2.5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
          {/* Zone 1: Clean Transparent Logo + Compact Slogan (Navigates Home on Click) */}
          <a
            href="#top"
            onClick={handleLogoClick}
            aria-label={homeAria}
            title={homeAria}
            className="flex items-center gap-2 sm:gap-2.5 group flex-1 md:flex-initial min-w-0 cursor-pointer"
          >
            <BrandMark variant="compact" className="flex-shrink-0 group-hover:scale-[1.02] transition-transform" />

            <p
              key={`nav-slogan-${lang}`}
              className="hidden sm:block text-[11px] text-stone-600 dark:text-zinc-400 font-semibold truncate max-w-[180px] lg:max-w-[220px] leading-tight lang-switch-transition"
            >
              {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
            </p>
          </a>

          {/* Zone 2: Centered Balanced Desktop Language Switcher */}
          <div className="hidden md:flex flex-1 items-center justify-center px-2">
            <LanguageSwitcher mode="desktop" />
          </div>

          {/* Zone 3: Action Controls (Mobile Language Dropdown + Install Prompt + Theme + Drawer Menu) */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div className="md:hidden">
              <LanguageSwitcher mode="mobile" onDropdownToggle={setIsLangMenuOpen} />
            </div>

            <PWAInstallButton variant="navbar" />

            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={isDark}
              aria-label={themeToggleAria}
              title={themeToggleAria}
              className="min-h-[34px] min-w-[34px] sm:min-h-[38px] sm:min-w-[38px] p-1.5 sm:p-2 rounded-xl bg-white hover:bg-stone-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-700 dark:text-amber-400 transition-colors flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
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
              className="min-h-[34px] min-w-[34px] sm:min-h-[38px] sm:min-w-[38px] p-1.5 sm:p-2 rounded-xl bg-white hover:bg-stone-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 transition-colors flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
