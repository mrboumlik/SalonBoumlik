import React, { useEffect, useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface QuickScrollControlProps {
  hidden?: boolean;
}

const getScrollMetrics = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { atTop: true, atBottom: true, scrollable: false };
  }
  const scrollY =
    window.pageYOffset !== undefined
      ? window.pageYOffset
      : document.documentElement.scrollTop || 0;
  const docHeight = Math.max(
    document.body ? document.body.scrollHeight : 0,
    document.documentElement ? document.documentElement.scrollHeight : 0
  );
  const viewHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const maxScroll = Math.max(0, docHeight - viewHeight);

  return {
    atTop: scrollY <= 12,
    atBottom: maxScroll <= 12 || scrollY >= maxScroll - 12,
    scrollable: maxScroll > 40,
  };
};

export const QuickScrollControl: React.FC<QuickScrollControlProps> = ({ hidden = false }) => {
  const { lang } = useLanguage();
  const [metrics, setMetrics] = useState(getScrollMetrics);

  const refreshMetrics = useCallback(() => {
    setMetrics(getScrollMetrics());
  }, []);

  useEffect(() => {
    refreshMetrics();

    window.addEventListener('scroll', refreshMetrics, { passive: true });
    window.addEventListener('resize', refreshMetrics, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && document.body) {
      resizeObserver = new ResizeObserver(() => {
        refreshMetrics();
      });
      resizeObserver.observe(document.body);
    }

    return () => {
      window.removeEventListener('scroll', refreshMetrics);
      window.removeEventListener('resize', refreshMetrics);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [refreshMetrics]);

  const scrollStepBy = (direction: -1 | 1) => {
    const viewHeight = window.innerHeight || 700;
    const step = Math.max(260, Math.round(viewHeight * 0.68)) * direction;
    try {
      window.scrollBy({ top: step, behavior: 'smooth' });
    } catch {
      window.scrollBy(0, step);
    }
  };

  const scrollToEdge = (edge: 'top' | 'bottom') => {
    const docHeight = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0
    );
    const target = edge === 'top' ? 0 : docHeight;
    try {
      window.scrollTo({ top: target, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, target);
    }
  };

  if (hidden || !metrics.scrollable) return null;

  const labels = {
    navAria: pickLang(lang, {
      ar: 'أزرار التمرير السريع',
      fr: 'Contrôles de défilement rapide',
      amz: 'ⵜⵉⵙⴰⵖⵓⵍⵉⵏ ⵏ ⵓⵙⵎⵓⵜⵜⵉ',
      en: 'Quick page scroll controls',
      es: 'Controles rápidos de desplazamiento',
    }),
    top: pickLang(lang, {
      ar: 'إلى الأعلى',
      fr: 'Haut de page',
      amz: 'ⴰⴼⵍⵍⴰ',
      en: 'Top of page',
      es: 'Ir arriba del todo',
    }),
    up: pickLang(lang, {
      ar: 'تمرير للأعلى',
      fr: 'Défiler vers le haut',
      amz: 'ⵙⵎⵓⵜⵜⵉ ⵙ ⴰⴼⵍⵍⴰ',
      en: 'Scroll up',
      es: 'Desplazar hacia arriba',
    }),
    down: pickLang(lang, {
      ar: 'تمرير للأسفل',
      fr: 'Défiler vers le bas',
      amz: 'ⵙⵎⵓⵜⵜⵉ ⵙ ⵉⵣⴷⴰⵔ',
      en: 'Scroll down',
      es: 'Desplazar hacia abajo',
    }),
    bottom: pickLang(lang, {
      ar: 'إلى الأسفل',
      fr: 'Bas de page',
      amz: 'ⵉⵣⴷⴰⵔ',
      en: 'Bottom of page',
      es: 'Ir abajo del todo',
    }),
  };

  return (
    <div
      dir="ltr"
      role="region"
      aria-label={labels.navAria}
      className="hidden sm:flex fixed bottom-6 left-6 z-40 flex-col items-center gap-1 p-1.5 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-700 shadow-lg"
    >
      <button
        type="button"
        onClick={() => scrollToEdge('top')}
        disabled={metrics.atTop}
        aria-label={labels.top}
        title={labels.top}
        className={`w-9 h-8 rounded-xl flex items-center justify-center transition-colors ${
          metrics.atTop
            ? 'text-stone-300 dark:text-zinc-600 cursor-not-allowed'
            : 'text-stone-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-amber-700 dark:hover:text-amber-400 cursor-pointer active:scale-95'
        }`}
      >
        <ChevronsUp className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => scrollStepBy(-1)}
        disabled={metrics.atTop}
        aria-label={labels.up}
        title={labels.up}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors border ${
          metrics.atTop
            ? 'bg-stone-50 dark:bg-zinc-900/60 border-stone-200/60 dark:border-zinc-800/60 text-stone-300 dark:text-zinc-600 cursor-not-allowed'
            : 'bg-stone-50 dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 hover:bg-amber-50 dark:hover:bg-amber-500/15 hover:border-amber-300 dark:hover:border-amber-500/40 hover:text-amber-800 dark:hover:text-amber-300 cursor-pointer active:scale-95'
        }`}
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      <div className="w-6 h-px bg-stone-200 dark:bg-zinc-800 my-0.5" aria-hidden="true" />

      <button
        type="button"
        onClick={() => scrollStepBy(1)}
        disabled={metrics.atBottom}
        aria-label={labels.down}
        title={labels.down}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors border ${
          metrics.atBottom
            ? 'bg-stone-50 dark:bg-zinc-900/60 border-stone-200/60 dark:border-zinc-800/60 text-stone-300 dark:text-zinc-600 cursor-not-allowed'
            : 'bg-amber-600 hover:bg-amber-500 border-amber-600 text-white cursor-pointer active:scale-95 shadow-xs'
        }`}
      >
        <ChevronDown className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={() => scrollToEdge('bottom')}
        disabled={metrics.atBottom}
        aria-label={labels.bottom}
        title={labels.bottom}
        className={`w-9 h-8 rounded-xl flex items-center justify-center transition-colors ${
          metrics.atBottom
            ? 'text-stone-300 dark:text-zinc-600 cursor-not-allowed'
            : 'text-stone-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-amber-700 dark:hover:text-amber-400 cursor-pointer active:scale-95'
        }`}
      >
        <ChevronsDown className="w-4 h-4" />
      </button>
    </div>
  );
};
