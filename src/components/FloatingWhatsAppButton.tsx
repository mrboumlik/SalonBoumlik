import React, { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { PricingEngineResult } from '../types';
import { SALON_INFO, TEAM_MEMBERS } from '../data/barbershopData';
import {
  useSalonProfileSettings,
  normalizeSalonWhatsappDigits,
} from '../utils/salonSettingsStore';

interface FloatingWhatsAppButtonProps {
  pricingResult: PricingEngineResult;
  selectedBarberId: string;
}

export const FloatingWhatsAppButton: React.FC<FloatingWhatsAppButtonProps> = ({
  pricingResult,
  selectedBarberId,
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
      selectedServiceNames.length > 0
        ? selectedServiceNames.join(' + ')
        : lang === 'ar'
        ? 'لم يتم تحديد خدمة بعد'
        : lang === 'en'
        ? 'No specific service selected yet'
        : lang === 'es'
        ? 'Sin servicio seleccionado aún'
        : lang === 'amz'
        ? 'ⵓⵔ ⵉⵜⵜⵓⵙⵜⵢ ⵓⵎⵓⵙⵙⵓ ⵜⴰⴷ'
        : 'Aucune prestation sélectionnée';

    const totalText =
      pricingResult.items.length > 0 ? `${pricingResult.finalTotal} MAD` : '';

    if (lang === 'ar') {
      return [
        'مرحباً صالون بومليك (تارودانت)، لدي استفسار عاجل بخصوص الحجز:',
        `• الخدمة المختارة: ${servicesText}`,
        totalText ? `• المجموع التقديري: ${totalText}` : null,
        `• الحلاق المفضل: ${barberName}`,
        'سؤالي العاجل: ',
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (lang === 'en') {
      return [
        'Hello Salon Boumlik (Taroudant), I have an urgent question regarding a booking:',
        `• Selected service: ${servicesText}`,
        totalText ? `• Estimated total: ${totalText}` : null,
        `• Preferred barber: ${barberName}`,
        'My urgent question: ',
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (lang === 'es') {
      return [
        'Hola Salon Boumlik (Taroudant), tengo una consulta urgente sobre mi cita:',
        `• Servicio seleccionado: ${servicesText}`,
        totalText ? `• Total estimado: ${totalText}` : null,
        `• Barbero preferido: ${barberName}`,
        'Mi pregunta urgente: ',
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (lang === 'amz') {
      return [
        'Azul Salon Boumlik (Taroudant), ⵖⵓⵔⵉ ⴰⵙⵇⵙⵉ ⵉⵣⵔⴱⵏ ⵖⴼ ⵓⵙⵔⵓⵙ:',
        `• ⵜⴰⵡⵓⵔⵉ ⵉⵜⵜⵓⵙⵜⵢⵏ: ${servicesText}`,
        totalText ? `• ⴰⵜⵉⴳ: ${totalText}` : null,
        `• ⴰⵎⴽⵔⴰⴹ: ${barberName}`,
        'ⴰⵙⵇⵙⵉ ⵉⵏⵓ: ',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // French default
    return [
      'Bonjour Salon Boumlik (Taroudant), j’ai une question urgente concernant mon rendez-vous :',
      `• Prestation sélectionnée : ${servicesText}`,
      totalText ? `• Total estimé : ${totalText}` : null,
      `• Barbier souhaité : ${barberName}`,
      'Ma question urgente : ',
    ]
      .filter(Boolean)
      .join('\n');
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

  return (
    <div
      dir="ltr"
      className="hidden sm:flex fixed bottom-6 right-6 z-40 items-center"
    >
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${buttonLabel} — ${primaryServicePreview}`}
        title={formattedMessage}
        dir={isRtl ? 'rtl' : 'ltr'}
        className="group relative flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white border border-emerald-400/50 dark:border-emerald-400/40 shadow-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-black"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 border border-white/25 flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-white fill-white/15 group-hover:scale-105 transition-transform" />
        </span>

        <div className="flex flex-col items-start text-start leading-tight pr-0.5">
          <span className="text-xs font-black tracking-tight whitespace-nowrap">
            {buttonLabel}
          </span>
          <span className="text-[10px] font-semibold text-emerald-100 max-w-[175px] truncate">
            {primaryServicePreview}
          </span>
        </div>
      </a>
    </div>
  );
};
