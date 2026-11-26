import React, { useState } from 'react';
import { BellRing, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { Language } from '../types';
import { requestResilientClientNotifications } from '../utils/webPushClient';
import { showToast } from '../utils/notifications';
import { pickLang } from '../utils/i18n';
import { ModalPortal } from './ModalPortal';

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

  const ui = {
    ticketBadge: pickLang(lang, {
      ar: `تم إصدار تذكرتك ${ticketNumber} بنجاح`,
      fr: `Ticket ${ticketNumber} généré`,
      amz: `ⴰⵜⵉⴽⵉ ${ticketNumber} ⵉⵜⵜⵓⵙⴽⵔ`,
      en: `Ticket ${ticketNumber} Generated`,
      es: `Ticket ${ticketNumber} generado`,
    }),
    title: pickLang(lang, {
      ar: 'تفعيل إشعارات الموعد المباشرة',
      fr: 'Restez informé en temps réel',
      amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵙⵉⵀⵍ ⵙ ⵜⵉⵣⵣⵍⴰ',
      en: 'Stay Updated on Your Appointment',
      es: 'Mantente informado sobre tu cita',
    }),
    description: pickLang(lang, {
      ar: 'للبقاء على اطلاع دائم بموعدك، التغييرات، وتأكيد الحضور، يرجى السماح بتلقي الإشعارات.',
      fr: 'Autorisez les notifications Salon Boumlik pour recevoir les confirmations, changements d’horaire et mises à jour de fidélité.',
      amz: 'ⵙⵙⵉⵔⴳ ⵉ ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⴰⴼⴰⴷ ⴰⴷ ⵜⴰⵎⵥⴷ ⵉⵙⵉⵙⴼⵉⵡⵏ ⵏ ⵓⵙⵉⵀⵍ ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ.',
      en: 'Allow trusted Salon Boumlik alerts to receive instant updates on confirmation, schedule changes, and loyalty points.',
      es: 'Permite las notificaciones de Salon Boumlik para recibir avisos de confirmación, cambios de horario y puntos de fidelidad.',
    }),
    bullet1: pickLang(lang, {
      ar: 'تأكيد الحضور والقبول من طرف الحلاق والإدارة',
      fr: 'Confirmation immédiate de présence et validation',
      amz: 'ⴰⵙⵙⴷⵓ ⵓⵙⵔⵉⴷ ⵙⴳ ⵓⵎⴽⵔⴰⴹ ⴷ ⵜⵎⵙⵙⵓⴳⵓⵔⵜ',
      en: 'Instant barber and admin arrival confirmation',
      es: 'Confirmación inmediata de asistencia',
    }),
    bullet2: pickLang(lang, {
      ar: 'تنبيهات تعديل التوقيت وتحديث نقاط الولاء حتى عند إغلاق المتصفح',
      fr: 'Mises à jour d’horaire et points de fidélité même navigateur fermé',
      amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵜⵙⵔⴰⴳⵜ ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵏ ⵜⵖⵓⵏⵉ',
      en: 'Schedule changes and loyalty updates even when browser is closed',
      es: 'Cambios de horario y puntos de fidelidad incluso con el navegador cerrado',
    }),
    laterBtn: pickLang(lang, {
      ar: 'لاحقاً',
      fr: 'Plus tard',
      amz: 'ⴰⵔ ⴷⴼⴼⵉⵔ',
      en: 'Later',
      es: 'Más tarde',
    }),
    allowBtn: pickLang(lang, {
      ar: 'موافق',
      fr: 'Autoriser',
      amz: 'ⵙⵙⵉⵔⴳ',
      en: 'Allow',
      es: 'Permitir',
    }),
    toastSuccessTitle: pickLang(lang, {
      ar: 'تم تفعيل الإشعارات الموثوقة بنجاح ✓',
      fr: 'Notifications activées ✓',
      amz: 'ⵉⵜⵜⵓⵙⵔⴳ ⵓⵣⵏ ⵏ ⵉⵏⵖⵎⵉⵙⵏ ✓',
      en: 'Notifications Enabled ✓',
      es: 'Notificaciones activadas ✓',
    }),
    toastSuccessBody: pickLang(lang, {
      ar: `سيصلك إشعار فوري عند تأكيد الموعد (${ticketNumber}) أو تحديث التوقيت أو نقاط الولاء.`,
      fr: `Vous recevrez les alertes en temps réel pour le ticket ${ticketNumber}.`,
      amz: `ⴰⴷ ⵜⴰⵎⵥⴷ ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵜⵉⴽⵉ ${ticketNumber}.`,
      en: `You will receive instant updates for ticket ${ticketNumber}.`,
      es: `Recibirás avisos en tiempo real para tu ticket ${ticketNumber}.`,
    }),
    toastBlockedTitle: pickLang(lang, {
      ar: 'الإشعارات مبلوكية / غير مفعّلة',
      fr: 'Notifications bloquées / désactivées',
      amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵜⵜⵓⴳⴷⴰⵍⵏ',
      en: 'Notifications Blocked / Disabled',
      es: 'Notificaciones bloqueadas',
    }),
    toastBlockedBody: pickLang(lang, {
      ar: 'تأكد من إغلاق الفقاعات العائمة على أندرويد أو السماح بالإشعارات من إعدادات المتصفح.',
      fr: 'Fermez les bulles flottantes sur Android ou autorisez les notifications dans les paramètres du navigateur.',
      amz: 'ⵜⵥⴹⴰⵕⴷ ⴰⴷ ⵜⵙⵙⵉⵔⴳⴷ ⵉⵏⵖⵎⵉⵙⵏ ⵙⴳ ⵉⵙⵖⴰⵍⵏ ⵏ ⵓⵎⵙⵙⵓⴳⵓⵔ.',
      en: 'Close screen overlays on Android or enable notifications in your browser settings.',
      es: 'Cierra superposiciones en Android o habilita notificaciones en tu navegador.',
    }),
  };

  const handleAllowClick = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await requestResilientClientNotifications({
        clientPhone,
        clientName,
        lang,
        allowPrompt: true,
      });

      if (result.granted) {
        showToast(ui.toastSuccessTitle, ui.toastSuccessBody, 'success');
        onSubscribed?.(true);
      } else {
        showToast(ui.toastBlockedTitle, ui.toastBlockedBody, 'warning');
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
    <ModalPortal>
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 sb-modal-backdrop animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-consent-title"
      >
        <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#11141D] border border-amber-300 dark:border-amber-500/45 shadow-2xl overflow-hidden text-slate-900 dark:text-white">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-lg text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-lg shadow-amber-500/10">
              <BellRing className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{ui.ticketBadge}</span>
              </div>

              <h3
                id="notif-consent-title"
                className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug pt-1"
              >
                {ui.title}
              </h3>

              <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-200 leading-relaxed font-medium">
                {ui.description}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#171B26] border border-stone-200 dark:border-zinc-800 text-[11px] text-stone-700 dark:text-zinc-300 space-y-1.5 text-start">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>{ui.bullet1}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>{ui.bullet2}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {ui.laterBtn}
              </button>

              <button
                type="button"
                onClick={handleAllowClick}
                disabled={isProcessing}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
              >
                <BellRing className="w-4 h-4 text-black" />
                <span>{isProcessing ? '...' : ui.allowBtn}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
