import React, { useState } from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'drawer';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'navbar' }) => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const { lang } = useLanguage();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  const label = pickLang(lang, {
    ar: 'تثبيت التطبيق',
    fr: 'Installer App',
    amz: 'ⵙⴱⴷⴷ ⴰⵙⵏⴰⵙ',
    en: 'Install App',
    es: 'Instalar App',
  });

  const handleClick = async () => {
    if (isIOS && !isInstallable) {
      setShowIOSGuide(true);
      return;
    }
    await promptInstall();
  };

  return (
    <>
      {variant === 'navbar' ? (
        <button
          type="button"
          onClick={handleClick}
          className="min-h-[38px] py-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          title={label}
        >
          <Download className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          <span className="hidden lg:inline">{label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full py-2.5 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          <span>{label}</span>
        </button>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-amber-500/40 p-5 space-y-3 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2 font-black text-sm">
                <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>
                  {pickLang(lang, {
                    ar: 'تثبيت تطبيق صالون بومليك',
                    fr: 'Installer Salon Boumlik',
                    amz: 'ⵙⴱⴷⴷ ⴰⵙⵏⴰⵙ ⵏ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ',
                    en: 'Install Salon Boumlik App',
                    es: 'Instalar Salon Boumlik',
                  })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed flex items-start gap-2">
              <Share className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span>
                {pickLang(lang, {
                  ar: 'على جهاز iPhone/iPad: اضغط على زر المشاركة (Share) أسفل المتصفح ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen) لتثبيت التطبيق وتلقي التذكيرات.',
                  fr: 'Sur Safari iOS : appuyez sur le bouton Partager en bas puis sélectionnez "Sur l’écran d’accueil".',
                  amz: 'ⵖⴼ iPhone/iPad: ⴰⴷⵔ ⵖⴼ Share ⵉⵍⵎⵎⴰ "Add to Home Screen".',
                  en: 'On Safari iOS: tap the Share button below and choose "Add to Home Screen" to install Salon Boumlik.',
                  es: 'En Safari iOS: pulsa Compartir abajo y elige "Añadir a pantalla de inicio".',
                })}
              </span>
            </p>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs cursor-pointer"
            >
              {pickLang(lang, {
                ar: 'فهمت',
                fr: 'Compris',
                amz: 'ⵔⵎⵙⵖ',
                en: 'Got it',
                es: 'Entendido',
              })}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
