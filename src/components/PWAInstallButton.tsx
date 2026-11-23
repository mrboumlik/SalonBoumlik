import React, { useState, useEffect } from 'react';
import { Download, Share, X, Smartphone, PlusSquare, CheckCircle2, Compass } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { ModalPortal } from './ModalPortal';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'drawer';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'navbar' }) => {
  const { isInstallable, isInstalled, isIOS, isIOSSafari, promptInstall } = usePWAInstall();
  const { lang, isRtl } = useLanguage();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (!showIOSGuide) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowIOSGuide(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showIOSGuide]);

  if (isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  const labels = {
    installShort: pickLang(lang, {
      ar: 'تثبيت',
      fr: 'Installer',
      amz: 'ⵙⴱⴷⴷ',
      en: 'Install',
      es: 'Instalar',
    }),
    installFull: pickLang(lang, {
      ar: 'تثبيت التطبيق',
      fr: 'Installer l’application',
      amz: 'ⵙⴱⴷⴷ ⴰⵙⵏⴰⵙ',
      en: 'Install App',
      es: 'Instalar App',
    }),
    modalTitle: pickLang(lang, {
      ar: 'تثبيت تطبيق صالون بومليك على iPhone',
      fr: 'Installer Salon Boumlik sur iPhone',
      amz: 'ⵙⴱⴷⴷ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⵖⴼ iPhone',
      en: 'Install Salon Boumlik on iPhone',
      es: 'Instalar Salon Boumlik en iPhone',
    }),
    modalSubtitle: pickLang(lang, {
      ar: 'أضف التطبيق إلى الشاشة الرئيسية للوصول السريع وتلقي التذكيرات في 3 خطوات بسيطة:',
      fr: 'Ajoutez l’application à votre écran d’accueil en 3 étapes simples :',
      amz: 'ⵔⵏⵓ ⴰⵙⵏⴰⵙ ⵖⵔ ⵓⴳⴷⵉⵍ ⴰⵎⵣⵡⴰⵔⵓ ⴳ 3 ⵉⵙⵓⵔⴰⴼⵏ :',
      en: 'Add Salon Boumlik to your Home Screen in 3 quick steps:',
      es: 'Añade la app a tu pantalla de inicio en 3 simples pasos:',
    }),
    step1: pickLang(lang, {
      ar: 'اضغط على زر «مشاركة» (Share) في شريط متصفح Safari.',
      fr: 'Appuyez sur le bouton « Partager » dans la barre Safari.',
      amz: 'ⴰⴷⵔ ⵖⴼ ⵜⴰⵙⴰⵖⵓⵍⵜ « Share » ⴳ Safari.',
      en: 'Tap the Share button in Safari’s toolbar.',
      es: 'Pulsa el botón Compartir en la barra de Safari.',
    }),
    step2: pickLang(lang, {
      ar: 'مرّر للأسفل واختر «إضافة إلى الشاشة الرئيسية» (Add to Home Screen).',
      fr: 'Faites défiler et choisissez « Sur l’écran d’accueil ».',
      amz: 'ⴼⵔⵏ « Add to Home Screen ».',
      en: 'Scroll down and tap “Add to Home Screen”.',
      es: 'Desliza y elige “Añadir a pantalla de inicio”.',
    }),
    step3: pickLang(lang, {
      ar: 'اضغط «إضافة» (Add) أعلى الشاشة لتثبيت الأيقونة مباشرة.',
      fr: 'Appuyez sur « Ajouter » en haut pour terminer.',
      amz: 'ⴰⴷⵔ « Add » ⵉ ⵓⵙⵎⴷ.',
      en: 'Tap “Add” in the top corner to confirm.',
      es: 'Pulsa “Añadir” arriba para finalizar.',
    }),
    safariHint: pickLang(lang, {
      ar: 'ملاحظة: إذا كنت تتصفح من داخل تطبيق آخر أو Chrome، افتح الرابط في Safari أولاً لإظهار خيار التثبيت.',
      fr: 'Astuce : si vous êtes hors de Safari, ouvrez ce lien dans Safari pour installer l’application.',
      amz: 'ⵜⴰⵎⴰⵜⴰⵔⵜ: ⵕⵥⵎ ⴰⵙⵖⵏ ⴰⴷ ⴳ Safari ⵉⵖ ⵓⵔ ⵜⴻⵍⵍⵉⴷ ⴷⵉⴳⵙ.',
      en: 'Tip: If you’re viewing inside another app or browser, open this page in Safari first.',
      es: 'Consejo: si estás en otro navegador o app, abre esta página primero en Safari.',
    }),
    gotIt: pickLang(lang, {
      ar: 'فهمت',
      fr: 'Compris',
      amz: 'ⵔⵎⵙⵖ',
      en: 'Got it',
      es: 'Entendido',
    }),
    closeAria: pickLang(lang, {
      ar: 'إغلاق',
      fr: 'Fermer',
      amz: 'ⵇⵇⵏ',
      en: 'Close',
      es: 'Cerrar',
    }),
  };

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
          aria-label={labels.installFull}
          title={labels.installFull}
          className="min-h-[34px] min-w-[34px] sm:min-h-[38px] px-2 sm:px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-2xs active:scale-95"
        >
          <Download className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
          <span className="hidden sm:inline">{labels.installShort}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full min-h-[42px] py-2.5 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0" />
          <span>{labels.installFull}</span>
        </button>
      )}

      {showIOSGuide && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 sb-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-heading"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              dir={isRtl ? 'rtl' : 'ltr'}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900 dark:text-white"
            >
              <div className="flex items-start justify-between gap-3 border-b border-stone-200 dark:border-zinc-800 pb-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 id="ios-install-heading" className="font-black text-sm leading-snug">
                      {labels.modalTitle}
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      {labels.modalSubtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={labels.closeAria}
                  className="min-w-[36px] min-h-[36px] p-1.5 rounded-xl text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="space-y-2.5 text-xs">
                <li className="flex items-start gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-[11px] flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                    <span className="text-slate-800 dark:text-zinc-200 font-semibold leading-relaxed">
                      {labels.step1}
                    </span>
                    <Share className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  </div>
                </li>

                <li className="flex items-start gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-black text-[11px] flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                    <span className="text-slate-800 dark:text-zinc-200 font-semibold leading-relaxed">
                      {labels.step2}
                    </span>
                    <PlusSquare className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                  </div>
                </li>

                <li className="flex items-start gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                    <span className="text-slate-800 dark:text-zinc-200 font-semibold leading-relaxed">
                      {labels.step3}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  </div>
                </li>
              </ol>

              {!isIOSSafari && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                  <Compass className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{labels.safariHint}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs transition-colors cursor-pointer shadow-xs"
              >
                {labels.gotIt}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};
