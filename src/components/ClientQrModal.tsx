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
} from '../utils/clientQr';
import { formatMoroccanWhatsAppNumber } from '../utils/whatsappAutomation';

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
  const waShareText = `مرحباً ${client.clientName}، هذا رابط ملفك الشخصي وبطاقة الولاء في صالون بومليك لمتابعة مواعيدك ورصيد زياراتك مباشرة:\n${deepLinkUrl}`;

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
                رمز QR الخاص بملف الزبون
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono truncate">
                Client Profile QR · {client.id}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="إغلاق"
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
                    زيارات مؤكدة: {client.verifiedVisits}
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
                <span>جاري توليد الرمز...</span>
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
            امسح هذا الرمز عبر{' '}
            <span className="text-blue-400 font-bold">ماسح التذاكر والزبناء</span>{' '}
            أثناء الحضور لفتح نافذة تتبع الزبون وسجل الولاء مباشرة.
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
                <span>فتح نافذة تتبع الزبون الآن (Open Tracking Modal)</span>
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
                <span>{isDownloading ? 'جاري التحميل...' : 'تحميل بطاقة QR'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-emerald-300">تم نسخ الرابط ✓</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span>نسخ رابط التتبع</span>
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
              <span>إرسال رابط التتبع للزبون عبر WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
