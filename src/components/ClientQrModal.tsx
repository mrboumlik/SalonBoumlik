import React, { useEffect, useState } from 'react';
import {
  X,
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import {
  ClientQrTarget,
  buildClientProfileQrPayload,
  downloadClientQrPassPng,
  generateClientProfileQrDataUrl,
  normalizePhoneForQrId,
} from '../utils/clientQr';
import { formatMoroccanWhatsAppNumber } from '../utils/whatsappAutomation';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';

interface ClientQrModalProps {
  client: ClientQrTarget | null;
  onClose: () => void;
  onOpenClientTracking?: (query: string) => void;
}

export const ClientQrModal: React.FC<ClientQrModalProps> = ({
  client,
  onClose,
  onOpenClientTracking,
}) => {
  const { lang } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!client) {
      setQrDataUrl('');
      return;
    }

    let cancelled = false;
    setIsGenerating(true);
    generateClientProfileQrDataUrl(client)
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch((err) => {
        console.error('Failed to generate client QR code:', err);
      })
      .finally(() => {
        if (!cancelled) {
          setIsGenerating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  if (!client) return null;

  const deepLinkUrl = buildClientProfileQrPayload(client);
  const lookupKey = client.phoneDisplay || client.normalizedPhone || client.id;
  const clientWa = formatMoroccanWhatsAppNumber(lookupKey);
  const waShareText = pickLang(lang, {
    ar: `مرحباً ${client.clientName}، هذا رابط ملفك الشخصي وبطاقة الولاء في صالون بومليك لمتابعة مواعيدك ورصيد زياراتك مباشرة:\n${deepLinkUrl}`,
    fr: `Bonjour ${client.clientName}, voici le lien de votre profil et carte de fidélité Salon Boumlik pour suivre vos rendez-vous et visites :\n${deepLinkUrl}`,
    amz: `ⴰⵣⵓⵍ ${client.clientName}, ⵡⴰⴷ ⵉⴳⴰ ⵓⵙⵖⵡⵏ ⵏ ⵓⴼⴰⵢⵍⵓ ⵏⵏⴽ ⴷ ⵜⴽⴰⵕⴹⴰ ⵏ ⵜⵏⵎⵎⵉⵔⵜ ⴳ Salon Boumlik:\n${deepLinkUrl}`,
    en: `Hello ${client.clientName}, here is your Salon Boumlik profile & loyalty card link to track your appointments and visits:\n${deepLinkUrl}`,
    es: `Hola ${client.clientName}, aquí tienes el enlace de tu perfil y tarjeta de fidelidad en Salon Boumlik:\n${deepLinkUrl}`,
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(deepLinkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadPng = async () => {
    setIsDownloading(true);
    try {
      await downloadClientQrPassPng(client, qrDataUrl || undefined);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenTracking = () => {
    if (onOpenClientTracking) {
      onClose();
      onOpenClientTracking(lookupKey);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">
                {pickLang(lang, {
                  ar: 'رمز QR الخاص بملف الزبون',
                  fr: 'QR Code du profil client',
                  amz: 'ⴰⵏⴳⴰⵍ QR ⵏ ⵓⴼⴰⵢⵍⵓ ⵏ ⵓⵎⵙⴰⵖ',
                  en: 'Client Profile QR Code',
                  es: 'Código QR del perfil del cliente',
                })}
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono truncate">
                {pickLang(lang, {
                  ar: 'ملف الزبون',
                  fr: 'Profil client',
                  amz: 'ⴰⴼⴰⵢⵍⵓ',
                  en: 'Client Profile QR',
                  es: 'Perfil QR',
                })}{' '}
                · ID: {normalizePhoneForQrId(client.phoneDisplay || client.normalizedPhone) || client.id}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label={pickLang(lang, { ar: 'إغلاق', fr: 'Fermer', amz: 'ⵇⵇⵏ', en: 'Close', es: 'Cerrar' })}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-center">
          {/* Client Metadata */}
          <div className="space-y-1">
            <div className="text-base font-black text-white flex items-center justify-center gap-2">
              <span>{client.clientName}</span>
              {client.isVip && (
                <span className="text-xs font-bold text-amber-400">· VIP</span>
              )}
            </div>
            <div className="text-xs text-zinc-400 font-mono tabular-nums flex flex-wrap items-center justify-center gap-2">
              <span dir="ltr">{client.phoneDisplay || client.normalizedPhone}</span>
              {typeof client.verifiedVisits === 'number' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300 font-bold">
                    {pickLang(lang, {
                      ar: `زيارات مؤكدة: ${client.verifiedVisits}`,
                      fr: `Visites confirmées : ${client.verifiedVisits}`,
                      amz: `ⵜⵉⵔⵣⴰ ⵉⵜⵜⵓⵙⵏⵜⵎⵏ: ${client.verifiedVisits}`,
                      en: `Verified visits: ${client.verifiedVisits}`,
                      es: `Visitas confirmadas: ${client.verifiedVisits}`,
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Crisp QR Display */}
          <div className="inline-flex flex-col items-center justify-center p-4 rounded-2xl bg-white border-4 border-zinc-800 shadow-lg min-w-[232px] min-h-[232px]">
            {isGenerating || !qrDataUrl ? (
              <div className="flex flex-col items-center justify-center gap-2 text-zinc-600 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
                <span>
                  {pickLang(lang, {
                    ar: 'جاري توليد الرمز...',
                    fr: 'Génération du code...',
                    amz: 'ⴰⵙⵏⴼⵍⵓⵍ ⵏ ⵓⵏⴳⴰⵍ...',
                    en: 'Generating code...',
                    es: 'Generando código...',
                  })}
                </span>
              </div>
            ) : (
              <img
                src={qrDataUrl}
                alt={`QR Code for ${client.clientName}`}
                className="w-52 h-52 object-contain"
              />
            )}
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {pickLang(lang, {
              ar: 'امسح هذا الرمز عبر ماسح التذاكر والزبناء أثناء الحضور لفتح نافذة تتبع الزبون وسجل الولاء مباشرة.',
              fr: 'Scannez ce code via le scanner de tickets et clients à l’arrivée pour ouvrir directement le suivi et la fidélité.',
              amz: 'ⵙⴽⴰⵏⵉ ⴰⵏⴳⴰⵍ ⴰⴷ ⵙ ⵓⵎⵙⵙⴼⵔⵓ ⵏ ⵜⵜⵉⴽⵉⵜⵉⵏ ⵉ ⵓⵕⵥⴰⵎ ⵏ ⵓⴹⴼⴰⵕ ⵏ ⵓⵎⵙⴰⵖ ⴷ ⵜⵏⵎⵎⵉⵔⵜ.',
              en: 'Scan this code using the Ticket & Client Scanner on arrival to open the client tracking & loyalty profile directly.',
              es: 'Escanea este código con el escáner de tickets al llegar para abrir directamente el seguimiento y la fidelidad.',
            })}
          </p>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {onOpenClientTracking && (
              <button
                type="button"
                onClick={handleOpenTracking}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                <span>
                  {pickLang(lang, {
                    ar: 'فتح نافذة تتبع الزبون الآن',
                    fr: 'Ouvrir le suivi du client maintenant',
                    amz: 'ⵕⵥⵎ ⴰⴹⴼⴰⵕ ⵏ ⵓⵎⵙⴰⵖ ⴷⵖⵉ',
                    en: 'Open Client Tracking Modal Now',
                    es: 'Abrir seguimiento del cliente ahora',
                  })}
                </span>
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isGenerating || isDownloading || !qrDataUrl}
                onClick={handleDownloadPng}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  {isDownloading
                    ? pickLang(lang, { ar: 'جاري التحميل...', fr: 'Téléchargement...', amz: 'ⴰⵣⴷⴰⵎ...', en: 'Downloading...', es: 'Descargando...' })
                    : pickLang(lang, { ar: 'تحميل بطاقة QR', fr: 'Télécharger carte QR', amz: 'ⵣⴷⵎ ⵜⴰⴽⴰⵕⴹⴰ QR', en: 'Download QR Pass', es: 'Descargar tarjeta QR' })}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-emerald-300">
                      {pickLang(lang, { ar: 'تم نسخ الرابط ✓', fr: 'Lien copié ✓', amz: 'ⵉⵜⵜⵓⵏⵖⵍ ⵓⵙⵖⵡⵏ ✓', en: 'Link copied ✓', es: 'Enlace copiado ✓' })}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span>
                      {pickLang(lang, { ar: 'نسخ رابط التتبع', fr: 'Copier le lien', amz: 'ⵏⵖⵍ ⴰⵙⵖⵡⵏ', en: 'Copy Tracking Link', es: 'Copiar enlace' })}
                    </span>
                  </>
                )}
              </button>
            </div>

            <a
              href={`https://wa.me/${clientWa}?text=${encodeURIComponent(waShareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                {pickLang(lang, {
                  ar: 'إرسال رابط التتبع للزبون عبر WhatsApp',
                  fr: 'Envoyer le lien au client sur WhatsApp',
                  amz: 'ⴰⵣⵏ ⴰⵙⵖⵡⵏ ⵉ ⵓⵎⵙⴰⵖ ⵙ WhatsApp',
                  en: 'Send Tracking Link via WhatsApp',
                  es: 'Enviar enlace por WhatsApp',
                })}
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
