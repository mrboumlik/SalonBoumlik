import React, { useState } from 'react';
import { BellOff, BellRing, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { Language } from '../types';
import { pickLang } from '../utils/i18n';
import { playNotificationSound, showToast } from '../utils/notifications';
import {
  detectNotificationEnvironment,
  requestResilientClientNotifications,
  ResilientNotificationResult,
} from '../utils/webPushClient';

interface NotificationStatusBannerProps {
  lang: Language;
  clientPhone?: string;
  clientName?: string;
  notifResult: ResilientNotificationResult | null;
  onResultChange: (res: ResilientNotificationResult) => void;
  compact?: boolean;
}

export const NotificationStatusBanner: React.FC<NotificationStatusBannerProps> = ({
  lang,
  clientPhone,
  clientName,
  notifResult,
  onResultChange,
  compact = false,
}) => {
  const [retrying, setRetrying] = useState(false);

  const env = notifResult?.env || detectNotificationEnvironment();
  const isGranted =
    Boolean(notifResult?.granted) || env.permission === 'granted';

  const getTipText = (): string => {
    if (env.isIos && !env.isStandalonePwa) {
      return pickLang(lang, {
        ar: 'على آيفون: اضغط زر المشاركة (Share) ← «إضافة إلى الشاشة الرئيسية» (Add to Home Screen) لتفعيل الإشعارات. متابعة التذكرة المباشرة تبقى شغالة داخل الصفحة.',
        fr: 'Sur iPhone : touchez Partager ← « Sur l’écran d’accueil » pour activer les alertes. Le suivi en direct reste actif sur cette page.',
        amz: 'ⴳ iPhone : ⴰⴷⵔ ⵖⴼ Share ← «Add to Home Screen» ⴰⴼⴰⴷ ⴰⴷ ⵕⵥⵎⵏ ⵉⵏⵖⵎⵉⵙⵏ. ⴰⴹⴼⴼⵓⵕ ⵓⵙⵔⵉⴷ ⵉⵅⴷⴷⵎ ⴷⴰ.',
        en: 'On iPhone: tap Share → "Add to Home Screen" to enable alerts. Live ticket status remains active inside this page.',
        es: 'En iPhone: pulsa Compartir → "Añadir a pantalla de inicio" para activar alertas. El seguimiento en vivo sigue activo aquí.',
      });
    }

    if (
      env.isAndroid ||
      notifResult?.reason === 'overlay_or_blocked' ||
      env.reason === 'overlay_or_blocked'
    ) {
      return pickLang(lang, {
        ar: 'على أندرويد: أغلق الفقاعات العائمة فوق الشاشة (Screen Overlay / فقاعات المحادثة) أو اسمح بالإشعارات من إعدادات المتصفح ثم أعد المحاولة. متابعة التذكرة الحية تبقى شغالة داخل الصفحة.',
        fr: 'Sur Android : fermez les bulles flottantes / superpositions d’écran ou autorisez les notifications dans Chrome puis réessayez. Le suivi en direct reste actif ici.',
        amz: 'ⴳ Android : ⵇⵇⵏ ⵜⵉⴼⵍⵡⵉⵏ ⵏ ⵓⴼⵍⵍⴰ (Screen Overlay) ⵏⵖ ⵙⵙⵉⵔⴳ ⵉⵏⵖⵎⵉⵙⵏ ⴳ ⵉⵙⵖⴰⵍⵏ ⵏ ⵓⵎⵙⵙⵓⴳⵓⵔ. ⴰⴹⴼⴼⵓⵕ ⵓⵙⵔⵉⴷ ⵉⵅⴷⴷⵎ ⴷⴰ.',
        en: 'On Android: close floating chat bubbles / screen overlays or allow alerts in Chrome site settings, then retry. Live in-page ticket updates remain active.',
        es: 'En Android: cierra las burbujas flotantes / superposición de pantalla o permite notificaciones en Chrome y reintenta. El seguimiento en vivo sigue activo.',
      });
    }

    return pickLang(lang, {
      ar: 'تأكد من السماح بالإشعارات من إعدادات الموقع في المتصفح ثم أعد المحاولة. متابعة حالة تذكرتك المباشرة تبقى شغالة تلقائياً داخل هذه الصفحة.',
      fr: 'Autorisez les notifications dans les paramètres du site de votre navigateur puis réessayez. Le suivi en direct du ticket reste actif sur cette page.',
      amz: 'ⵙⵙⵉⵔⴳ ⵉⵏⵖⵎⵉⵙⵏ ⵙⴳ ⵉⵙⵖⴰⵍⵏ ⵏ ⵓⵎⵙⵙⵓⴳⵓⵔ ⵉⵍⵎⵎⴰ ⴰⵍⵙ ⵜⵉⵔⵎⵉⵜ. ⴰⴹⴼⴼⵓⵕ ⵏ ⵜⵉⴽⵉ ⵉⵅⴷⴷⵎ ⴷⴰ.',
      en: 'Allow notifications in your browser site settings and retry. Live ticket updates continue automatically on this page.',
      es: 'Permite las notificaciones en la configuración del navegador y reintenta. Las actualizaciones en vivo siguen activas aquí.',
    });
  };

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const res = await requestResilientClientNotifications({
        clientPhone,
        clientName,
        lang,
        allowPrompt: true,
      });
      onResultChange(res);

      if (res.granted) {
        playNotificationSound();
        showToast(
          pickLang(lang, {
            ar: 'الإشعارات مفعّلة ✓',
            fr: 'Notifications activées ✓',
            amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵕⵥⵎⵏ ✓',
            en: 'Notifications Enabled ✓',
            es: 'Notificaciones activadas ✓',
          }),
          pickLang(lang, {
            ar: 'ستصلك التنبيهات المباشرة عند تأكيد الموعد وتحديث التوقيت ونقاط الولاء.',
            fr: 'Vous recevrez les alertes en temps réel pour votre ticket.',
            amz: 'ⴰⴷ ⵜⴰⵎⵥⴷ ⵉⵏⵖⵎⵉⵙⵏ ⵓⵙⵔⵉⴷⵏ ⵏ ⵓⵙⵉⵀⵍ ⵏⵏⴽ.',
            en: 'You will receive live updates for your appointment and loyalty points.',
            es: 'Recibirás alertas en vivo de tu cita y puntos.',
          }),
          'success'
        );
      } else {
        showToast(
          pickLang(lang, {
            ar: 'الإشعارات مبلوكية / غير مفعّلة',
            fr: 'Notifications bloquées / désactivées',
            amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵜⵜⵓⴳⴷⴰⵍⵏ',
            en: 'Notifications Blocked / Disabled',
            es: 'Notificaciones bloqueadas',
          }),
          getTipText(),
          'warning'
        );
      }
    } finally {
      setRetrying(false);
    }
  };

  if (isGranted) {
    return (
      <div
        className={`rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 ${
          compact ? 'px-3 py-2 flex items-center justify-between gap-2' : 'px-3.5 py-2.5 space-y-1 text-start'
        }`}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-black">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {pickLang(lang, {
              ar: 'الإشعارات مفعّلة ✓',
              fr: 'Notifications activées ✓',
              amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵕⵥⵎⵏ ✓',
              en: 'Notifications Enabled ✓',
              es: 'Notificaciones activadas ✓',
            })}
          </span>
        </div>
        {!compact && (
          <p className="text-[10px] font-medium text-emerald-700/90 dark:text-emerald-300/90 leading-relaxed">
            {pickLang(lang, {
              ar: 'ستصلك تنبيهات فورية عند تأكيد الموعد، تعديل التوقيت، أو تحديث نقاط الولاء.',
              fr: 'Alertes en temps réel activées pour vos confirmations, horaires et points.',
              amz: 'ⴰⴷ ⵜⴰⵎⵥⴷ ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵙⵏⵜⵎ ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵏ ⵜⵖⵓⵏⵉ.',
              en: 'Real-time alerts are active for confirmations, reschedules, and loyalty points.',
              es: 'Alertas en tiempo real activas para confirmaciones, horarios y puntos.',
            })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl bg-amber-50/90 dark:bg-amber-950/25 border border-amber-300 dark:border-amber-500/40 text-amber-950 dark:text-amber-100 text-start ${
        compact ? 'p-2.5 space-y-2' : 'p-3 space-y-2'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-rose-700 dark:text-rose-300">
          <BellOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            {pickLang(lang, {
              ar: 'الإشعارات مبلوكية / غير مفعّلة',
              fr: 'Notifications bloquées / désactivées',
              amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵜⵜⵓⴳⴷⴰⵍⵏ / ⵓⵔ ⵕⵥⵉⵎⵏ',
              en: 'Notifications Blocked / Disabled',
              es: 'Notificaciones bloqueadas / desactivadas',
            })}
          </span>
        </span>

        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
        >
          {retrying ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <BellRing className="w-3 h-3" />
          )}
          <span>
            {pickLang(lang, {
              ar: 'إعادة المحاولة / تفعيل الإشعارات',
              fr: 'Réessayer / Activer',
              amz: 'ⴰⵍⵙ ⵜⵉⵔⵎⵉⵜ / ⵕⵥⵎ',
              en: 'Retry / Enable Alerts',
              es: 'Reintentar / Activar',
            })}
          </span>
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-amber-900/90 dark:text-amber-200/90 flex items-start gap-1.5">
        <Smartphone className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <span>{getTipText()}</span>
      </p>
    </div>
  );
};
