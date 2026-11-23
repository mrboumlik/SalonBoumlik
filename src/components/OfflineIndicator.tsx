import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { lang } = useLanguage();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-[65] px-3.5 py-2 rounded-full bg-zinc-950 border border-amber-500 text-amber-300 text-xs font-bold flex items-center gap-2 shadow-2xl"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
      <span>
        {pickLang(lang, {
          ar: 'وضع عدم الاتصال — التذاكر المخزنة متاحة للمعاينة',
          fr: 'Mode hors ligne — consultation en cache active',
          amz: 'ⴰⵙⴽⴽⵉⵏ ⴱⵍⴰ ⴰⵏⵜⵉⵔⵏⵉⵜ — ⴰⵙⴽⵏ ⵏ ⵜⵡⵔⵉⵇⵉⵏ',
          en: 'Offline mode — cached view active',
          es: 'Modo sin conexión — vista en caché activa',
        })}
      </span>
    </div>
  );
};
