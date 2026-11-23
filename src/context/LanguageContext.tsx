import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';
import { UI_TRANSLATIONS } from '../data/barbershopData';
import { safeStorageGet, safeStorageSet } from '../utils/safeBrowser';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: typeof UI_TRANSLATIONS['fr'];
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = safeStorageGet('salon_boumlik_lang', 'local') as Language | null;
    if (saved && (saved === 'fr' || saved === 'ar' || saved === 'en' || saved === 'amz' || saved === 'es')) {
      return saved;
    }
    return 'ar';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    safeStorageSet('salon_boumlik_lang', newLang, 'local');
  };

  const isRtl = lang === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isRtl]);

  const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.fr;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
