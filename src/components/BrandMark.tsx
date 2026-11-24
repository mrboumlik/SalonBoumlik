import React from 'react';
import { SALON_INFO } from '../data/barbershopData';

interface BrandMarkProps {
  className?: string;
  variant?: 'full' | 'pole';
  alt?: string;
}

/**
 * Clean transparent-background Salon Boumlik brand mark derived from the official logo PNG.
 * Uses theme-matched light & dark transparent PNGs with zero outer box framing.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  className = 'h-9 w-auto object-contain',
  variant = 'full',
  alt = 'Salon Boumlik',
}) => {
  if (variant === 'pole') {
    return (
      <img
        src={SALON_INFO.media.logoPole}
        alt={alt}
        draggable={false}
        className={`select-none object-contain ${className}`}
      />
    );
  }

  return (
    <>
      <img
        src={SALON_INFO.media.logoClean}
        alt={alt}
        draggable={false}
        className={`dark:hidden select-none object-contain ${className}`}
      />
      <img
        src={SALON_INFO.media.logoDarkClean}
        alt={alt}
        draggable={false}
        className={`hidden dark:block select-none object-contain ${className}`}
      />
    </>
  );
};
