import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, GripHorizontal } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface QuickScrollControlProps {
  hidden?: boolean;
  targetRef?: React.RefObject<HTMLElement | null>;
  positionClassName?: string;
}

const getScrollInfo = (container?: HTMLElement | null) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { scrollY: 0, maxScroll: 0, atTop: true, atBottom: true, scrollable: false };
  }

  if (container) {
    const scrollY = container.scrollTop || 0;
    const maxScroll = Math.max(0, (container.scrollHeight || 0) - (container.clientHeight || 0));
    return {
      scrollY,
      maxScroll,
      atTop: scrollY <= 10,
      atBottom: maxScroll <= 10 || scrollY >= maxScroll - 10,
      scrollable: maxScroll > 36,
    };
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

export const QuickScrollControl: React.FC<QuickScrollControlProps> = ({
  hidden = false,
  targetRef,
  positionClassName = 'fixed right-1.5 sm:right-3.5 top-1/2 -translate-y-1/2 z-40',
}) => {
  const { lang } = useLanguage();
  const [metrics, setMetrics] = useState(() => getScrollInfo(targetRef?.current));
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
    setMetrics(getScrollInfo(targetRef?.current));
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef?.current;
    refreshMetrics();

    const scrollTarget: EventTarget = el || window;
    scrollTarget.addEventListener('scroll', refreshMetrics, { passive: true });
    window.addEventListener('resize', refreshMetrics, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    const observeTarget = el || (typeof document !== 'undefined' ? document.body : null);
    if (typeof ResizeObserver !== 'undefined' && observeTarget) {
      resizeObserver = new ResizeObserver(() => {
        refreshMetrics();
      });
      resizeObserver.observe(observeTarget);
      if (el && el.firstElementChild) {
        resizeObserver.observe(el.firstElementChild);
      }
    }

    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined' && el) {
      let rafId = 0;
      mutationObserver = new MutationObserver(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          refreshMetrics();
        });
      });
      mutationObserver.observe(el, { childList: true, subtree: true });
    }

    return () => {
      scrollTarget.removeEventListener('scroll', refreshMetrics);
      window.removeEventListener('resize', refreshMetrics);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
    };
  }, [refreshMetrics, targetRef]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current.active) return;
      const el = targetRef?.current;
      const info = getScrollInfo(el);
      const maxScroll = Math.max(dragStateRef.current.maxScroll, info.maxScroll);
      const deltaY = e.clientY - dragStateRef.current.startClientY;
      const { startScrollY } = dragStateRef.current;

      const multiplier = Math.max(2.2, maxScroll / 220);
      const nextY = Math.max(0, Math.min(maxScroll, startScrollY + deltaY * multiplier));

      setDragThumbOffset(Math.max(-6, Math.min(6, Math.round(deltaY * 0.14))));

      if (el) {
        el.scrollTop = nextY;
      } else {
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
  }, [isDragging, targetRef]);

  const handleDragStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const info = getScrollInfo(targetRef?.current);
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
    const el = targetRef?.current;
    const viewHeight = el ? el.clientHeight || 600 : window.innerHeight || 700;
    const step = Math.max(240, Math.round(viewHeight * 0.68)) * direction;

    if (el) {
      const nextTop = Math.max(0, Math.min(el.scrollHeight, el.scrollTop + step));
      try {
        el.scrollTo({ top: nextTop, behavior: 'smooth' });
      } catch {
        el.scrollTop = nextTop;
      }
      return;
    }

    try {
      window.scrollBy({ top: step, behavior: 'smooth' });
    } catch {
      window.scrollBy(0, step);
    }
  };

  const scrollToEdge = (edge: 'top' | 'bottom') => {
    const el = targetRef?.current;
    if (el) {
      const target = edge === 'top' ? 0 : el.scrollHeight;
      try {
        el.scrollTo({ top: target, behavior: 'smooth' });
      } catch {
        el.scrollTop = target;
      }
      return;
    }

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
      style={{ left: 'auto' }}
      className={`flex flex-col items-center gap-1 p-1 sm:p-1.5 rounded-2xl bg-[#0F172A] dark:bg-[#1E293B] border-2 border-[#F59E0B] shadow-xl select-none ${positionClassName}`}
    >
      <button
        type="button"
        onClick={() => scrollToEdge('top')}
        disabled={metrics.atTop}
        aria-label={labels.top}
        title={labels.top}
        className={`w-8 h-6 sm:w-9 sm:h-6 rounded-lg border flex items-center justify-center transition-colors ${
          metrics.atTop
            ? 'bg-[#0F172A] border-[#334155] text-[#64748B] cursor-not-allowed'
            : 'bg-[#1E293B] hover:bg-[#334155] border-[#64748B] text-[#FDE68A] hover:text-white cursor-pointer active:scale-95'
        }`}
      >
        <ChevronsUp className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>

      <button
        type="button"
        onClick={() => scrollStepBy(-1)}
        disabled={metrics.atTop}
        aria-label={labels.up}
        title={labels.up}
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 flex items-center justify-center transition-colors ${
          metrics.atTop
            ? 'bg-[#1E293B] border-[#334155] text-[#64748B] cursor-not-allowed'
            : 'bg-[#2563EB] hover:bg-[#1D4ED8] border-[#93C5FD] text-white cursor-pointer active:scale-95 shadow-sm'
        }`}
      >
        <ChevronUp className="w-5 h-5" strokeWidth={2.75} />
      </button>

      {/* Center High-Contrast Draggable Handle Button */}
      <button
        type="button"
        onPointerDown={handleDragStart}
        aria-label={labels.drag}
        title={labels.drag}
        style={{
          transform: `translate3d(0, ${dragThumbOffset}px, 0)`,
          touchAction: 'none',
        }}
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border-2 transition-colors ${
          isDragging
            ? 'bg-white border-[#F59E0B] text-[#0F172A] cursor-grabbing shadow-md'
            : 'bg-[#F59E0B] hover:bg-[#FBBF24] border-[#FEF3C7] text-[#0F172A] cursor-grab shadow-sm'
        }`}
      >
        <GripHorizontal className="w-4 h-4" strokeWidth={2.75} />
      </button>

      <button
        type="button"
        onClick={() => scrollStepBy(1)}
        disabled={metrics.atBottom}
        aria-label={labels.down}
        title={labels.down}
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 flex items-center justify-center transition-colors ${
          metrics.atBottom
            ? 'bg-[#1E293B] border-[#334155] text-[#64748B] cursor-not-allowed'
            : 'bg-[#D97706] hover:bg-[#B45309] border-[#FDE68A] text-white cursor-pointer active:scale-95 shadow-sm'
        }`}
      >
        <ChevronDown className="w-5 h-5" strokeWidth={2.75} />
      </button>

      <button
        type="button"
        onClick={() => scrollToEdge('bottom')}
        disabled={metrics.atBottom}
        aria-label={labels.bottom}
        title={labels.bottom}
        className={`w-8 h-6 sm:w-9 sm:h-6 rounded-lg border flex items-center justify-center transition-colors ${
          metrics.atBottom
            ? 'bg-[#0F172A] border-[#334155] text-[#64748B] cursor-not-allowed'
            : 'bg-[#1E293B] hover:bg-[#334155] border-[#64748B] text-[#FDE68A] hover:text-white cursor-pointer active:scale-95'
        }`}
      >
        <ChevronsDown className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
};
