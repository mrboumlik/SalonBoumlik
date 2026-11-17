import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage } from '../context/LanguageContext';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { lang } = useLanguage();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-[65] px-3.5 py-2 rounded-full bg-zinc-950/95 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
      <span>
        {lang === 'ar'
          ? 'وضع عدم الاتصال — التذاكر المخزنة متاحة للمعاينة'
          : lang === 'en'
          ? 'Offline mode — cached view active'
          : 'Mode hors ligne — consultation en cache active'}
      </span>
    </div>
  );
};
