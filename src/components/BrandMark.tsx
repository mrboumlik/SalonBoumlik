import React from 'react';

interface BrandMarkProps {
  className?: string;
}

/**
 * Clean, transparent-background Salon Boumlik Barber Pole emblem.
 * Avoids rectangular image-box framing and dark side artifacts across Light & Dark themes.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ className = 'w-8 h-10' }) => {
  const clipId = React.useId();

  return (
    <svg
      viewBox="0 0 48 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="13" y="14" width="22" height="36" rx="2" />
        </clipPath>
      </defs>

      {/* Top Finial & Cap */}
      <circle cx="24" cy="6" r="3" fill="#78716C" />
      <path d="M12 12C12 8.68629 17.3726 6 24 6C30.6274 6 36 8.68629 36 12H12Z" fill="#334155" />
      <rect x="10" y="11.5" width="28" height="3.5" rx="1.75" fill="#94A3B8" />

      {/* Glass Cylinder Base */}
      <rect x="13" y="14" width="22" height="36" fill="#FFFFFF" />

      {/* Diagonal Barber Pole Stripes */}
      <g clipPath={`url(#${clipId})`}>
        <path d="M8 22L40 8V15L8 29Z" fill="#B91C1C" />
        <path d="M8 32L40 18V25L8 39Z" fill="#1E3A8A" />
        <path d="M8 42L40 28V35L8 49Z" fill="#B91C1C" />
        <path d="M8 52L40 38V45L8 59Z" fill="#1E3A8A" />
        <path d="M8 62L40 48V55L8 69Z" fill="#B91C1C" />
      </g>

      {/* Subtle Glass Cylinder Border & Specular Highlight */}
      <rect x="14.5" y="15" width="3" height="34" rx="1.5" fill="#FFFFFF" fillOpacity="0.45" />
      <rect
        x="13"
        y="14"
        width="22"
        height="36"
        stroke="#475569"
        strokeWidth="1.2"
      />

      {/* Bottom Cap & Finial */}
      <rect x="10" y="49" width="28" height="3.5" rx="1.75" fill="#94A3B8" />
      <path d="M12 52.5H36C36 55.8137 30.6274 58.5 24 58.5C17.3726 58.5 12 55.8137 12 52.5Z" fill="#334155" />
      <circle cx="24" cy="60" r="2.2" fill="#78716C" />
    </svg>
  );
};
