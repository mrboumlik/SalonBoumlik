import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../types';
import { FlagIcon } from './LanguageFlags';

interface LanguageSwitcherProps {
  className?: string;
  mode?: 'auto' | 'desktop' | 'mobile';
  onDropdownToggle?: (open: boolean) => void;
}

const LANGUAGES: {
  code: Language;
  shortLabel: string;
  desktopLabel: string;
  fullLabel: string;
}[] = [
  { code: 'ar', shortLabel: 'عربي', desktopLabel: 'العربية', fullLabel: 'العربية' },
  { code: 'fr', shortLabel: 'FR', desktopLabel: 'Français', fullLabel: 'Français' },
  { code: 'en', shortLabel: 'EN', desktopLabel: 'English', fullLabel: 'English' },
  { code: 'amz', shortLabel: 'ⵜⵎⵣ', desktopLabel: 'ⵜⴰⵎⴰⵣⵉⵖⵜ', fullLabel: 'ⵜⴰⵎⴰⵣⵉⵖⵜ' },
  { code: 'es', shortLabel: 'ES', desktopLabel: 'Español', fullLabel: 'Español' },
];

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  mode = 'auto',
  onDropdownToggle,
}) => {
  const { lang, setLang, isRtl } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeLang = LANGUAGES.find((item) => item.code === lang) || LANGUAGES[0];

  const updateDropdownOpen = (next: boolean) => {
    setIsDropdownOpen(next);
    if (onDropdownToggle) onDropdownToggle(next);
  };

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        updateDropdownOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') updateDropdownOpen(false);
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
    updateDropdownOpen(false);
  };

  const showDesktop = mode === 'auto' || mode === 'desktop';
  const showMobile = mode === 'auto' || mode === 'mobile';

  return (
    <div className={`relative shrink-0 ${className}`} ref={dropdownRef}>
      {/* Tablet & Desktop Refined Balanced Switcher */}
      {showDesktop && (
        <div
          dir="ltr"
          role="group"
          aria-label="Language switcher (Arabic, French, English, Amazigh, Spanish)"
          className={`${
            mode === 'desktop' ? 'flex' : 'hidden md:flex'
          } items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-2xs select-none`}
        >
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
                className={`min-h-[34px] px-2.5 lg:px-3 py-1 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isActive
                    ? 'bg-white dark:bg-[#1B1F2A] text-amber-800 dark:text-amber-300 font-extrabold shadow-2xs ring-1 ring-amber-400/50 dark:ring-amber-500/35'
                    : 'text-stone-600 dark:text-zinc-400 font-semibold hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-zinc-800/70'
                } ${opt.code === 'amz' ? 'font-tifinagh' : opt.code === 'ar' ? 'font-arabic' : ''}`}
              >
                <FlagIcon
                  lang={opt.code}
                  className={`w-3.5 h-2.5 rounded-[2px] flex-shrink-0 transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-80'
                  }`}
                />
                <span className="xl:hidden">{opt.shortLabel}</span>
                <span className="hidden xl:inline">{opt.desktopLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Mobile Compact Language Dropdown */}
      {showMobile && (
        <div className={mode === 'mobile' ? 'block' : 'md:hidden'}>
          <button
            type="button"
            onClick={() => updateDropdownOpen(!isDropdownOpen)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
            aria-label={`Language: ${activeLang.fullLabel}`}
            className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white hover:bg-stone-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
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
                } w-52 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 shadow-xl p-1.5 z-50 space-y-0.5`}
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
      )}
    </div>
  );
};
