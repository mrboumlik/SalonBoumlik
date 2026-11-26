import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../types';
import { OFFICIAL_SALON_BOUMLIK_BRAND_ASSETS } from '../data/barbershopData';

export interface SalonBoumlikCrestProps {
  className?: string;
  alt?: string;
  decorative?: boolean;
}

/**
 * LOCKED AUTHENTIC BRAND EMBLEM — Salon Boumlik (Taroudant).
 * Renders Hassan Ait Boumlik's authentic official Barber Pole PNG inside a clean ivory badge
 * so it remains sharp and 100% consistent in both Light Mode and Dark Mode.
 * Self-contained and safe inside ErrorBoundaries (no React context dependencies).
 */
export const SalonBoumlikCrest: React.FC<SalonBoumlikCrestProps> = ({
  className = 'w-10 h-10',
  alt = 'Salon Boumlik',
  decorative = false,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl bg-[#FAF9F6] border border-stone-200 dark:border-amber-500/35 p-1 shadow-2xs select-none flex-shrink-0 overflow-hidden ${className}`}
      aria-hidden={decorative ? true : undefined}
    >
      {!imgFailed ? (
        <img
          src={OFFICIAL_SALON_BOUMLIK_BRAND_ASSETS.officialBarberPolePng}
          alt={decorative ? '' : alt}
          draggable={false}
          decoding="async"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain select-none"
        />
      ) : (
        <span
          dir="ltr"
          className="font-display font-black text-[10px] tracking-tight text-slate-900 leading-none"
        >
          SB
        </span>
      )}
    </span>
  );
};

export interface BrandMarkProps {
  className?: string;
  variant?: 'full' | 'compact' | 'hero' | 'footer' | 'mark' | 'pole';
  alt?: string;
  /** Forces a crisp light ivory signature plate (ideal on dark surfaces/tickets regardless of theme). */
  forceLightPlate?: boolean;
  /** Optional override for signature caption visibility. */
  showSignature?: boolean;
}

function getSignatureLabel(lang: Language): string {
  if (lang === 'ar') return 'صالون بومليك • تارودانت';
  if (lang === 'amz') return 'ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ • ⵜⴰⵔⵓⴷⴰⵏⵜ';
  return 'TAROUDANT • EST. 2016';
}

/**
 * LOCKED OFFICIAL BRAND LOCKUP — Salon Boumlik (Taroudant).
 * Exclusively uses Hassan's official Salon Boumlik PNG logo (barber pole + SALON BOUMLIK + mustache).
 * Never substitute generic vector crests or placeholder icons.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  className = '',
  variant = 'full',
  alt = 'Salon Boumlik — More Than Barber Shop',
  forceLightPlate = false,
  showSignature,
}) => {
  const { lang } = useLanguage();
  const [logoFailed, setLogoFailed] = useState(false);

  if (variant === 'mark' || variant === 'pole') {
    return (
      <SalonBoumlikCrest
        className={className || 'w-10 h-10'}
        alt={alt}
      />
    );
  }

  const plateSurfaceClass = forceLightPlate
    ? 'bg-[#FAF9F6] border border-stone-200 shadow-xs'
    : 'bg-transparent dark:bg-[#FAF9F6] dark:border dark:border-amber-500/35 dark:shadow-sm';

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center select-none rounded-xl transition-colors ${
          forceLightPlate
            ? 'px-2.5 py-1 ' + plateSurfaceClass
            : 'dark:px-2.5 dark:py-1 ' + plateSurfaceClass
        } ${className}`}
        aria-label={alt}
      >
        {!logoFailed ? (
          <img
            src={OFFICIAL_SALON_BOUMLIK_BRAND_ASSETS.officialLogoTransparentPng}
            alt={alt}
            width={168}
            height={90}
            draggable={false}
            decoding="async"
            onError={() => setLogoFailed(true)}
            className="h-9 sm:h-11 w-auto max-w-[140px] sm:max-w-[168px] object-contain select-none"
          />
        ) : (
          <span
            dir="ltr"
            className="font-display font-black tracking-[0.06em] text-sm sm:text-base text-slate-900 dark:text-white leading-none whitespace-nowrap"
          >
            SALON BOUMLIK
          </span>
        )}
      </span>
    );
  }

  const isHero = variant === 'hero';
  const signature = getSignatureLabel(lang);
  const shouldShowSignature = showSignature !== undefined ? showSignature : true;

  return (
    <span
      className={`inline-flex flex-col ${
        isHero ? 'items-center lg:items-start' : 'items-center md:items-start'
      } select-none ${className}`}
      aria-label={alt}
    >
      <span
        className={`inline-flex items-center justify-center rounded-2xl transition-colors ${
          forceLightPlate
            ? (isHero ? 'px-4 py-2.5 ' : 'px-3 py-1.5 ') + plateSurfaceClass
            : (isHero ? 'dark:px-4 dark:py-2.5 ' : 'dark:px-3 dark:py-1.5 ') + plateSurfaceClass
        }`}
      >
        {!logoFailed ? (
          <img
            src={OFFICIAL_SALON_BOUMLIK_BRAND_ASSETS.officialLogoTransparentPng}
            alt={alt}
            width={isHero ? 260 : 196}
            height={isHero ? 140 : 105}
            draggable={false}
            decoding="async"
            onError={() => setLogoFailed(true)}
            className={
              isHero
                ? 'h-20 sm:h-24 lg:h-[104px] w-auto object-contain select-none'
                : 'h-14 sm:h-16 w-auto object-contain select-none'
            }
          />
        ) : (
          <span
            dir="ltr"
            className={`font-display font-black tracking-[0.06em] text-slate-900 dark:text-white leading-none whitespace-nowrap ${
              isHero ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'
            }`}
          >
            SALON BOUMLIK
          </span>
        )}
      </span>

      {shouldShowSignature && (
        <span
          className={`mt-2 inline-flex items-center gap-2 font-bold tracking-[0.08em] text-amber-800 dark:text-amber-300 leading-none ${
            isHero ? 'text-[11px] sm:text-xs' : 'text-[10px] sm:text-[11px]'
          }`}
        >
          <span className="w-4 h-px bg-amber-600/50 dark:bg-amber-400/50" aria-hidden="true" />
          <span>{signature}</span>
          <span className="w-4 h-px bg-amber-600/50 dark:bg-amber-400/50" aria-hidden="true" />
        </span>
      )}
    </span>
  );
};
