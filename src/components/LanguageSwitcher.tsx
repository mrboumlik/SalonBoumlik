import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../types';
import { FlagIcon } from './LanguageFlags';

interface LanguageSwitcherProps {
  className?: string;
}

const LANGUAGES: {
  code: Language;
  shortLabel: string;
  fullLabel: string;
  dirLabel: 'RTL' | 'LTR';
}[] = [
  { code: 'ar', shortLabel: 'عربي', fullLabel: 'العربية', dirLabel: 'RTL' },
  { code: 'fr', shortLabel: 'FR', fullLabel: 'Français', dirLabel: 'LTR' },
  { code: 'en', shortLabel: 'EN', fullLabel: 'English', dirLabel: 'LTR' },
  { code: 'amz', shortLabel: 'ⵜⵎⵣ', fullLabel: 'ⵜⴰⵎⴰⵣⵉⵖⵜ', dirLabel: 'LTR' },
  { code: 'es', shortLabel: 'ES', fullLabel: 'Español', dirLabel: 'LTR' },
];

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { lang, setLang, isRtl } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeLang = LANGUAGES.find((item) => item.code === lang) || LANGUAGES[0];
  const activeIndex = LANGUAGES.findIndex((item) => item.code === lang);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isDropdownOpen]);

  const handleSelect = (code: Language) => {
    setLang(code);
    setIsDropdownOpen(false);
  };

  return (
    <div className={`relative shrink-0 ${className}`} ref={dropdownRef}>
      {/* Tablet & Desktop Segmented Switcher (AR, FR, EN, AMZ, ES) */}
      <div
        dir="ltr"
        role="group"
        aria-label="Language switcher (Arabic, French, English, Amazigh, Spanish)"
        className="hidden md:grid relative grid-cols-5 items-center p-0.5 rounded-xl bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-2xs select-none"
      >
        {activeIndex >= 0 && (
          <span
            aria-hidden="true"
            style={{
              transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
            }}
            className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/5)] rounded-lg bg-white dark:bg-zinc-800 shadow-xs ring-1 ring-stone-200 dark:ring-zinc-700 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          />
        )}

        {LANGUAGES.map((opt) => {
          const isActive = lang === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => handleSelect(opt.code)}
              aria-pressed={isActive}
              aria-label={opt.fullLabel}
              title={opt.fullLabel}
              className={`relative z-10 min-h-[36px] px-2 lg:px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                isActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              } ${opt.code === 'amz' ? 'font-tifinagh' : opt.code === 'ar' ? 'font-arabic' : ''}`}
            >
              <FlagIcon
                lang={opt.code}
                className={`w-3.5 h-2.5 rounded-[2px] flex-shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                  isActive ? 'scale-105' : 'scale-95 opacity-80'
                }`}
              />
              <span className="lg:hidden">{opt.shortLabel}</span>
              <span className="hidden lg:inline">{opt.shortLabel === 'عربي' ? 'العربية' : opt.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile Compact Language Dropdown (Cleanly Fits 360px+ Screens, Shows All Languages) */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
          aria-label={`Language: ${activeLang.fullLabel}`}
          className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white hover:bg-stone-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
        >
          <FlagIcon lang={activeLang.code} className="w-4 h-3 rounded-[2px] flex-shrink-0" />
          <span
            className={
              activeLang.code === 'ar'
                ? 'font-arabic text-xs'
                : activeLang.code === 'amz'
                ? 'font-tifinagh text-xs'
                : 'text-[11px] tracking-wide'
            }
          >
            {activeLang.shortLabel}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-stone-500 dark:text-zinc-400 transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180 text-amber-600 dark:text-amber-400' : ''
            }`}
          />
        </button>

        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              role="listbox"
              aria-label="Select language"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={`absolute top-full mt-2 ${
                isRtl ? 'left-0' : 'right-0'
              } w-48 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 shadow-xl p-1.5 z-50 space-y-0.5`}
            >
              {LANGUAGES.map((opt) => {
                const isActive = lang === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(opt.code)}
                    className={`w-full min-h-[40px] px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-start text-xs font-bold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                        : 'text-slate-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <FlagIcon lang={opt.code} className="w-4 h-3 rounded-[2px] flex-shrink-0" />
                      <span
                        className={`truncate ${
                          opt.code === 'ar'
                            ? 'font-arabic text-sm'
                            : opt.code === 'amz'
                            ? 'font-tifinagh'
                            : ''
                        }`}
                      >
                        {opt.fullLabel}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] font-mono text-stone-400 dark:text-zinc-500 uppercase">
                        {opt.code}
                      </span>
                      {isActive && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
