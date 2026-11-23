import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, GripHorizontal } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface QuickScrollControlProps {
  hidden?: boolean;
}

const getScrollInfo = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { scrollY: 0, maxScroll: 0, atTop: true, atBottom: true, scrollable: false };
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
    scrollY,
    maxScroll,
    atTop: scrollY <= 12,
    atBottom: maxScroll <= 12 || scrollY >= maxScroll - 12,
    scrollable: maxScroll > 40,
  };
};

export const QuickScrollControl: React.FC<QuickScrollControlProps> = ({ hidden = false }) => {
  const { lang } = useLanguage();
  const [metrics, setMetrics] = useState(getScrollInfo);
  const [isDragging, setIsDragging] = useState(false);
  const [dragThumbOffset, setDragThumbOffset] = useState(0);
  const dragStateRef = useRef<{
    active: boolean;
    startClientY: number;
    startScrollY: number;
    maxScroll: number;
  }>({
    active: false,
    startClientY: 0,
    startScrollY: 0,
    maxScroll: 0,
  });

  const refreshMetrics = useCallback(() => {
    setMetrics(getScrollInfo());
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

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current.active) return;
      const deltaY = e.clientY - dragStateRef.current.startClientY;
      const { startScrollY, maxScroll } = dragStateRef.current;

      const multiplier = Math.max(2.2, maxScroll / 220);
      const nextY = Math.max(0, Math.min(maxScroll, startScrollY + deltaY * multiplier));

      setDragThumbOffset(Math.max(-6, Math.min(6, Math.round(deltaY * 0.14))));

      try {
        window.scrollTo({ top: nextY, behavior: 'instant' as ScrollBehavior });
      } catch {
        window.scrollTo(0, nextY);
      }
    };

    const stopDragging = () => {
      dragStateRef.current.active = false;
      setIsDragging(false);
      setDragThumbOffset(0);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [isDragging]);

  const handleDragStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const info = getScrollInfo();
    dragStateRef.current = {
      active: true,
      startClientY: e.clientY,
      startScrollY: info.scrollY,
      maxScroll: info.maxScroll,
    };
    setDragThumbOffset(0);
    setIsDragging(true);
  };

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
    drag: pickLang(lang, {
      ar: 'اسحب للأعلى أو للأسفل للتمرير السلس',
      fr: 'Glisser vers le haut ou le bas pour défiler',
      amz: 'ⵙⵎⵓⵜⵜⵉ ⵙ ⴰⴼⵍⵍⴰ ⵏⵖ ⵉⵣⴷⴰⵔ',
      en: 'Drag up or down to scroll smoothly',
      es: 'Arrastra arriba o abajo para desplazar',
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
      className="hidden sm:flex fixed right-3 lg:right-5 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-1 p-1.5 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-700 shadow-lg select-none"
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
        className={`w-10 h-9 rounded-xl flex items-center justify-center transition-colors border ${
          metrics.atTop
            ? 'bg-stone-50 dark:bg-zinc-900/60 border-stone-200/60 dark:border-zinc-800/60 text-stone-300 dark:text-zinc-600 cursor-not-allowed'
            : 'bg-stone-50 dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 hover:bg-amber-50 dark:hover:bg-amber-500/15 hover:border-amber-300 dark:hover:border-amber-500/40 hover:text-amber-800 dark:hover:text-amber-300 cursor-pointer active:scale-95'
        }`}
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      {/* Center Draggable Handle Button */}
      <button
        type="button"
        onPointerDown={handleDragStart}
        aria-label={labels.drag}
        title={labels.drag}
        style={{
          transform: `translate3d(0, ${dragThumbOffset}px, 0)`,
        }}
        className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center border touch-none transition-colors ${
          isDragging
            ? 'bg-amber-600 border-amber-600 text-white cursor-grabbing shadow-md'
            : 'bg-stone-100 dark:bg-zinc-800/90 border-stone-300 dark:border-zinc-600 text-stone-600 dark:text-zinc-300 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300 cursor-grab'
        }`}
      >
        <GripHorizontal className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => scrollStepBy(1)}
        disabled={metrics.atBottom}
        aria-label={labels.down}
        title={labels.down}
        className={`w-10 h-9 rounded-xl flex items-center justify-center transition-colors border ${
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
