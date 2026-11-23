import React, { useState, useEffect } from 'react';
import { subscribeToToasts, ToastMessage } from '../utils/notifications';
import { Bell, CheckCircle2, Clock3, AlertCircle, X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((newToast) => {
      setToasts((prev) => [newToast, ...prev.slice(0, 3)]); // Keep max 4 visible

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 6000);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ModalPortal>
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[150] pointer-events-none space-y-2.5">
        {toasts.map((toast) => {
          let icon = <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
          let borderColor = 'border-amber-300 dark:border-amber-500/50';
          const bgGlow = 'bg-white dark:bg-[#141720]';

          if (toast.type === 'success') {
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
            borderColor = 'border-emerald-300 dark:border-emerald-500/50';
          } else if (toast.type === 'reschedule') {
            icon = <Clock3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
            borderColor = 'border-blue-300 dark:border-blue-500/50';
          } else if (toast.type === 'warning') {
            icon = <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
            borderColor = 'border-red-300 dark:border-red-500/50';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-2xl ${bgGlow} border ${borderColor} text-slate-900 dark:text-white shadow-2xl flex items-start gap-3 animate-in slide-in-from-top-3 duration-300 transition-all`}
            >
              <div className="p-2 rounded-xl bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex-shrink-0 mt-0.5">
                {icon}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide truncate">
                  {toast.title}
                </h4>
                <p className="text-[11px] text-stone-600 dark:text-zinc-300 mt-0.5 leading-relaxed break-words font-medium">
                  {toast.body}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg text-stone-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ModalPortal>
  );
};
