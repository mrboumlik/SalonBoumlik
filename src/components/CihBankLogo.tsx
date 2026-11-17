import React from 'react';

interface CihBankLogoProps {
  className?: string;
}

export const CihBankLogo: React.FC<CihBankLogoProps> = ({ className = 'w-10 h-10 sm:w-11 sm:h-11' }) => {
  return (
    <div
      className={`${className} rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700/80 p-1 flex items-center justify-center flex-shrink-0 shadow-xs`}
      aria-label="CIH Bank Logo"
    >
      <svg
        viewBox="0 0 64 64"
        className="w-full h-full"
        role="img"
        aria-label="CIH Bank"
      >
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#0B132B" />
        <path d="M14 28 L32 14 L50 28 L44 28 L32 18.5 L20 28 Z" fill="#00A3E0" />
        <path d="M18 33 C23 26, 41 26, 46 33 C40 29.5, 24 29.5, 18 33 Z" fill="#FF5A1F" />
        <text
          x="32"
          y="46"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="13"
          letterSpacing="1.2"
        >
          CIH
        </text>
        <text
          x="32"
          y="55"
          textAnchor="middle"
          fill="#00A3E0"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="700"
          fontSize="6.5"
          letterSpacing="1.6"
        >
          BANK
        </text>
      </svg>
    </div>
  );
};
