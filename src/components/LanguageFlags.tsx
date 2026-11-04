import React from 'react';
import { Language } from '../types';

export const FlagIcon: React.FC<{ lang: Language; className?: string }> = ({ lang, className = 'w-5 h-3.5' }) => {
  switch (lang) {
    case 'ar':
      // Official Flag of Morocco (Red with green pentagram star)
      return (
        <svg 
          viewBox="0 0 900 600" 
          className={`inline-block rounded-xs shadow-xs object-cover flex-shrink-0 ${className}`}
          aria-label="Drapeau du Maroc"
        >
          <rect width="900" height="600" fill="#c1272d" />
          <polygon
            points="450,195 479,285 574,285 497,341 526,431 450,375 374,431 403,341 326,285 421,285"
            fill="none"
            stroke="#006233"
            strokeWidth="16"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'amz':
      // Official Amazigh Flag (Blue, Green, Yellow horizontal tricolor with central red Tifinagh Yaz ⵣ)
      return (
        <svg 
          viewBox="0 0 900 600" 
          className={`inline-block rounded-xs shadow-xs object-cover flex-shrink-0 ${className}`}
          aria-label="Drapeau Amazigh"
        >
          {/* Blue Stripe (Mediterranean / Atlantic) */}
          <rect width="900" height="200" y="0" fill="#0080FF" />
          {/* Green Stripe (Nature / Atlas Mountains) */}
          <rect width="900" height="200" y="200" fill="#00AA33" />
          {/* Yellow Stripe (Sahara Sands) */}
          <rect width="900" height="200" y="400" fill="#FFD700" />
          {/* Red Yaz symbol ⵣ (Free man / Aza) */}
          <g transform="translate(450, 300) scale(1.15)">
            {/* Center vertical pillar */}
            <path
              d="M -6,-115 L 6,-115 L 6,115 L -6,115 Z"
              fill="#E60000"
            />
            {/* Left curved arm */}
            <path
              d="M -75,-90 C -25,-90 -20,-30 -20,0 C -20,30 -25,90 -75,90"
              fill="none"
              stroke="#E60000"
              strokeWidth="20"
              strokeLinecap="round"
            />
            {/* Right curved arm */}
            <path
              d="M 75,-90 C 25,-90 20,-30 20,0 C 20,30 25,90 75,90"
              fill="none"
              stroke="#E60000"
              strokeWidth="20"
              strokeLinecap="round"
            />
          </g>
        </svg>
      );

    case 'fr':
      // Flag of France (Blue, White, Red vertical tricolor)
      return (
        <svg 
          viewBox="0 0 900 600" 
          className={`inline-block rounded-xs shadow-xs object-cover flex-shrink-0 ${className}`}
          aria-label="Drapeau de la France"
        >
          <rect width="300" height="600" x="0" fill="#002654" />
          <rect width="300" height="600" x="300" fill="#FFFFFF" />
          <rect width="300" height="600" x="600" fill="#CE1126" />
        </svg>
      );

    case 'en':
      // Flag of the United Kingdom (Union Jack)
      return (
        <svg 
          viewBox="0 0 60 30" 
          className={`inline-block rounded-xs shadow-xs object-cover flex-shrink-0 ${className}`}
          aria-label="Flag of the United Kingdom"
        >
          <clipPath id="s">
            <path d="M0,0 v30 h60 v-30 z"/>
          </clipPath>
          <clipPath id="t">
            <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/>
          </clipPath>
          <g clipPath="url(#s)">
            <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
            <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
            <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
            <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
          </g>
        </svg>
      );
  }
};
