import React, { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { PricingEngineResult } from '../types';
import { SALON_INFO, TEAM_MEMBERS } from '../data/barbershopData';
import {
  useSalonProfileSettings,
  normalizeSalonWhatsappDigits,
} from '../utils/salonSettingsStore';
import { buildWhatsAppInquiryMessage } from '../utils/whatsappAutomation';

interface FloatingWhatsAppButtonProps {
  pricingResult: PricingEngineResult;
  selectedBarberId: string;
  hidden?: boolean;
}

export const FloatingWhatsAppButton: React.FC<FloatingWhatsAppButtonProps> = ({
  pricingResult,
  selectedBarberId,
  hidden = false,
}) => {
  const { lang, isRtl } = useLanguage();
  const salonSettings = useSalonProfileSettings();

  const selectedBarber = useMemo(
    () => TEAM_MEMBERS.find((b) => b.id === selectedBarberId),
    [selectedBarberId]
  );

  const selectedServiceNames = useMemo(() => {
    return pricingResult.items.map((item) =>
      item.discountApplied ? `${item.name} (${item.discountApplied})` : item.name
    );
  }, [pricingResult.items]);

  const formattedMessage = useMemo(() => {
    const barberName = selectedBarber
      ? selectedBarber.name[lang] || selectedBarber.name.fr
      : SALON_INFO.owner[lang] || SALON_INFO.owner.fr;

    const servicesText =
      selectedServiceNames.length > 0 ? selectedServiceNames.join(' + ') : undefined;

    return buildWhatsAppInquiryMessage({
      lang,
      requestType: pricingResult.items.length > 0 ? 'booking' : 'inquiry',
      servicesText,
      estimatedPriceMAD: pricingResult.items.length > 0 ? pricingResult.finalTotal : undefined,
      barberName,
      includeMessagePrompt: true,
    });
  }, [lang, pricingResult.finalTotal, pricingResult.items.length, selectedBarber, selectedServiceNames]);

  const whatsappHref = useMemo(() => {
    const phone = normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp);
    return `https://wa.me/${phone}?text=${encodeURIComponent(formattedMessage)}`;
  }, [formattedMessage, salonSettings.salonWhatsapp]);

  const buttonLabel = useMemo(() => {
    if (lang === 'ar') return 'مراسلة عبر واتساب';
    if (lang === 'en') return 'Message on WhatsApp';
    if (lang === 'es') return 'Mensaje por WhatsApp';
    if (lang === 'amz') return 'ⴰⵣⵏ ⴳ ⵡⴰⵜⵙⴰⴱ';
    return 'Message sur WhatsApp';
  }, [lang]);

  const primaryServicePreview = useMemo(() => {
    if (pricingResult.items.length === 0) {
      return lang === 'ar'
        ? 'استفسار سريع'
        : lang === 'amz'
        ? 'ⴰⵙⵇⵙⵉ ⵉⵣⵔⴱⵏ'
        : lang === 'en'
        ? 'Quick support'
        : lang === 'es'
        ? 'Consulta rápida'
        : 'Réponse rapide';
    }
    const first = pricingResult.items[0].name;
    if (pricingResult.items.length === 1) return first;
    return `${first} +${pricingResult.items.length - 1}`;
  }, [lang, pricingResult.items]);

  const compactLabel = useMemo(() => {
    if (lang === 'ar') return 'واتساب';
    return 'WhatsApp';
  }, [lang]);

  if (hidden) return null;

  return (
    <div
      dir="ltr"
      className={`hidden sm:flex fixed bottom-5 ${
        isRtl ? 'left-5' : 'right-5'
      } z-40 items-center`}
    >
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${buttonLabel} — ${primaryServicePreview}`}
        title={formattedMessage}
        dir={isRtl ? 'rtl' : 'ltr'}
        className="group relative flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white border border-emerald-500 shadow-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-black"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-700/60 border border-emerald-400/40 flex-shrink-0">
          <MessageCircle className="w-4 h-4 text-white group-hover:scale-105 transition-transform" />
        </span>

        <span className="text-xs font-black tracking-tight whitespace-nowrap pe-0.5">
          {compactLabel}
        </span>
      </a>
    </div>
  );
};
