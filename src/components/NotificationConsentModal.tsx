import React, { useState } from 'react';
import { BellRing, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { Language } from '../types';
import { registerClientPushSubscription } from '../utils/webPushClient';
import { showToast } from '../utils/notifications';

interface NotificationConsentModalProps {
  isOpen: boolean;
  ticketNumber: string;
  clientName: string;
  clientPhone: string;
  lang: Language;
  onClose: () => void;
  onSubscribed?: (granted: boolean) => void;
}

export const NotificationConsentModal: React.FC<NotificationConsentModalProps> = ({
  isOpen,
  ticketNumber,
  clientName,
  clientPhone,
  lang,
  onClose,
  onSubscribed,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const isAr = lang === 'ar';

  const handleAllowClick = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await registerClientPushSubscription({
        clientPhone,
        clientName,
        lang,
      });

      if (result.granted) {
        // Show in-app UI confirmation only (no redundant OS popup on grant to avoid browser spam flags)
        showToast(
          isAr ? 'تم تفعيل الإشعارات الموثوقة بنجاح ✓' : 'Notifications activées ✓',
          isAr
            ? `سيصلك إشعار فوري عند تأكيد الموعد (${ticketNumber}) أو تحديث التوقيت أو نقاط الولاء.`
            : `Vous recevrez les alertes en temps réel pour le ticket ${ticketNumber}.`,
          'success'
        );
        onSubscribed?.(true);
      } else {
        showToast(
          isAr ? 'تم حظر الإشعارات في المتصفح' : 'Notifications bloquées',
          isAr
            ? 'يمكنك تفعيل الإشعارات لاحقاً من إعدادات المتصفح لمتابعة تذكرتك.'
            : 'Vous pouvez autoriser les notifications depuis les paramètres du navigateur.',
          'warning'
        );
        onSubscribed?.(false);
      }
      onClose();
    } catch (err) {
      console.warn('Notification consent flow error:', err);
      onSubscribed?.(false);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-consent-title"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-[#0E1015] border border-amber-500/45 shadow-2xl overflow-hidden text-white">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-emerald-400 to-amber-500" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 space-y-5 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <BellRing className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {isAr
                  ? `تم إصدار تذكرتك ${ticketNumber} بنجاح`
                  : lang === 'en'
                  ? `Ticket ${ticketNumber} Generated`
                  : lang === 'es'
                  ? `Ticket ${ticketNumber} generado`
                  : `Ticket ${ticketNumber} généré`}
              </span>
            </div>

            <h3
              id="notif-consent-title"
              className="text-base sm:text-lg font-black text-white leading-snug pt-1"
            >
              {isAr
                ? 'تفعيل إشعارات الموعد المباشرة'
                : lang === 'en'
                ? 'Stay Updated on Your Appointment'
                : lang === 'es'
                ? 'Mantente informado sobre tu cita'
                : 'Restez informé en temps réel'}
            </h3>

            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-medium">
              للبقاء على اطلاع دائم بموعدك، التغييرات، وتأكيد الحضور، يرجى السماح بتلقي الإشعارات.
            </p>

            {!isAr && (
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {lang === 'en'
                  ? 'Allow trusted Salon Boumlik alerts to receive instant updates on confirmation, schedule changes, and loyalty points.'
                  : lang === 'es'
                  ? 'Permite las notificaciones de Salon Boumlik para recibir avisos de confirmación, cambios de horario y puntos de fidelidad.'
                  : 'Autorisez les notifications Salon Boumlik pour recevoir les confirmations, changements d’horaire et mises à jour de fidélité.'}
              </p>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-[11px] text-zinc-300 space-y-1.5 text-start">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>
                {isAr
                  ? 'تأكيد الحضور والقبول من طرف الحلاق والإدارة'
                  : 'Confirmation immédiate de présence et validation'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>
                {isAr
                  ? 'تنبيهات تعديل التوقيت وتحديث نقاط الولاء حتى عند إغلاق المتصفح'
                  : 'Mises à jour d’horaire et points de fidélité même navigateur fermé'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAr ? 'لاحقاً (Later)' : 'لاحقاً • Later'}
            </button>

            <button
              type="button"
              onClick={handleAllowClick}
              disabled={isProcessing}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
            >
              <BellRing className="w-4 h-4 text-black" />
              <span>
                {isProcessing
                  ? '...'
                  : isAr
                  ? 'موافق (Allow)'
                  : 'موافق • Allow'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
