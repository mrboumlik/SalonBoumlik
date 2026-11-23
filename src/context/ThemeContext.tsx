import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppTheme } from '../types';
import { safeStorageGet, safeStorageSet } from '../utils/safeBrowser';

interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  themeConfig: {
    id: AppTheme;
    name: {
      fr: string;
      ar: string;
      en: string;
      amz: string;
      es: string;
    };
    icon: string;
  };
}

const THEME_INFO: Record<AppTheme, { id: AppTheme; name: { fr: string; ar: string; en: string; amz: string; es: string }; icon: string }> = {
  luxury_gold: {
    id: 'luxury_gold',
    name: {
      fr: 'Mode Sombre',
      ar: 'الوضع الداكن',
      en: 'Dark Mode',
      amz: 'ⵓⵔⵖ ⴷ ⵓⴱⵕⴽⴰⵏ',
      es: 'Modo Oscuro',
    },
    icon: '🌙',
  },
  charcoal: {
    id: 'charcoal',
    name: {
      fr: 'Charbon Moderne',
      ar: 'رمادي فحمي عصري',
      en: 'Modern Charcoal',
      amz: 'ⴰⴼⵃⵎ ⴰⵜⵔⴰⵔ',
      es: 'Carbón Moderno',
    },
    icon: '💈',
  },
  minimal_light: {
    id: 'minimal_light',
    name: {
      fr: 'Mode Clair',
      ar: 'الوضع الفاتح',
      en: 'Light Mode',
      amz: 'ⴰⵎⵍⵍⴰⵍ ⵉⴼⴰⵡⵏ',
      es: 'Modo Claro',
    },
    icon: '☀️',
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = safeStorageGet('salon_boumlik_theme', 'local') as AppTheme | null;
    if (saved && (saved === 'luxury_gold' || saved === 'charcoal' || saved === 'minimal_light')) {
      return saved;
    }
    return 'minimal_light';
  });

  const isDark = theme !== 'minimal_light';

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    safeStorageSet('salon_boumlik_theme', newTheme, 'local');
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'minimal_light' : 'luxury_gold');
  };

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      root.style.colorScheme = isDark ? 'dark' : 'light';
    } catch {
      // ignore unsupported colorScheme property on older browsers
    }
    root.classList.remove('theme-gold', 'theme-charcoal', 'theme-light');
    if (theme === 'luxury_gold') {
      root.classList.add('theme-gold');
    } else if (theme === 'charcoal') {
      root.classList.add('theme-charcoal');
    } else if (theme === 'minimal_light') {
      root.classList.add('theme-light');
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', isDark ? '#0B0C10' : '#FAF9F6');
    }
  }, [theme, isDark]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme, themeConfig: THEME_INFO[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
