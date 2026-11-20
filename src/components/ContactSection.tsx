import React, { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Instagram,
  Facebook,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  QrCode,
  X,
  Wifi,
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { createGmailComposeUrl, createWhatsAppUrl } from '../utils/calendar';
import { useLanguage } from '../context/LanguageContext';
import { useSalonProfileSettings } from '../utils/salonSettingsStore';
import { pickLang } from '../utils/i18n';

export const ContactSection: React.FC = () => {
  const { lang, t } = useLanguage();
  const salonSettings = useSalonProfileSettings();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [submittedInApp, setSubmittedInApp] = useState(false);

  const [activeQrModal, setActiveQrModal] = useState<{
    title: string;
    image: string;
    description: string;
  } | null>(null);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SALON_INFO.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const ui = {
    heading: pickLang(lang, {
      ar: 'التواصل، الشبكات والباركود',
      fr: 'CONTACT, RÉSEAUX & QR CODES',
      amz: 'ⴰⵎⵢⴰⵡⴰⴹ ⴷ ⴱⴰⵔⴽⵓⴷ',
      en: 'CONTACT, SOCIALS & QR CODES',
      es: 'CONTACTO, REDES Y QR',
    }),
    subtitle: pickLang(lang, {
      ar: 'امسح رموز الاستجابة السريعة الرسمية أو تواصل مع حسن مباشرة عبر الواتساب على الرقم 0635392503.',
      fr: 'Scannez nos QR codes officiels ou contactez Hassan directement par WhatsApp au 0635392503 ou via Gmail.',
      amz: 'ⵙⴽⴰⵏ ⴱⴰⵔⴽⵓⴷ ⵏⵏⵖ ⵏⵖ ⵙⴰⵡⵍ ⴷ ⵃⴰⵙⴰⵏ ⴳ ⵡⴰⵜⵙⴰⴱ 0635392503.',
      en: 'Scan our official QR codes or reach Hassan directly on WhatsApp at 0635392503 or via Gmail.',
      es: 'Escanea nuestros códigos QR o contacta a Hassan directamente por WhatsApp al 0635392503 o Gmail.',
    }),
    zoomQr: pickLang(lang, {
      ar: 'تكبير الباركود',
      fr: 'Agrandir QR',
      amz: 'ⵙⵉⵎⵖⵓⵔ QR',
      en: 'Zoom QR',
      es: 'Ampliar QR',
    }),
    openLink: pickLang(lang, {
      ar: 'فتح الرابط',
      fr: 'Ouvrir le lien',
      amz: 'ⵕⵥⵎ ⴰⵙⵖⵏ',
      en: 'Open link',
      es: 'Abrir enlace',
    }),
    directContactTitle: pickLang(lang, {
      ar: 'الاتصال المباشر والمالك',
      fr: 'Contact Direct & Propriétaire',
      amz: 'ⴰⵎⵢⴰⵡⴰⴹ ⵓⵙⵔⵉⴷ',
      en: 'Direct Contact & Owner',
      es: 'Contacto Directo y Propietario',
    }),
    ownerRoleLabel: pickLang(lang, {
      ar: 'المؤسس وخبير الحلاقة :',
      fr: 'Propriétaire & Maître Barbier :',
      amz: 'ⴰⵎⵙⴱⴷⴰⴷ ⵏ ⵓⵙⴰⵍⵓⵏ :',
      en: 'Owner & Master Barber:',
      es: 'Propietario y Maestro Barbero:',
    }),
    emailLabel: pickLang(lang, {
      ar: 'البريد الإلكتروني / Gmail :',
      fr: 'Courriel officiel / Gmail :',
      amz: 'ⵉⵎⵉⵢⵍ :',
      en: 'Official Email / Gmail:',
      es: 'Correo oficial / Gmail:',
    }),
    openMaps: pickLang(lang, {
      ar: 'فتح في خرائط Google',
      fr: 'Ouvrir dans Google Maps',
      amz: 'ⵕⵥⵎ ⴳ Google Maps',
      en: 'Open in Google Maps',
      es: 'Abrir en Google Maps',
    }),
    formTitle: pickLang(lang, {
      ar: 'إرسال استفسار أو رسالة',
      fr: 'Envoyer une Demande / Message',
      amz: 'ⴰⵣⵏ ⵜⴰⴱⵔⴰⵜ ⵏⵖ ⴰⵙⵇⵙⵉ',
      en: 'Send an Inquiry / Message',
      es: 'Enviar Consulta / Mensaje',
    }),
    formSubtitle: pickLang(lang, {
      ar: 'اطرح أسئلتك أو تواصل مباشرة مع حسن وفريق صالون بومليك.',
      fr: 'Posez vos questions ou demandez un devis directement à Hassan.',
      amz: 'ⵙⵇⵙⴰ ⵃⴰⵙⴰⵏ ⵓⵙⵔⵉⴷ ⵖⴼ ⵜⵡⵓⵔⵉⵡⵉⵏ ⴷ ⵉⵎⵉⵔⵏ.',
      en: 'Ask your questions or message Hassan directly.',
      es: 'Haz tus preguntas o consulta directamente con Hassan.',
    }),
    submittedTitle: pickLang(lang, {
      ar: 'تم تسجيل رسالتك بنجاح!',
      fr: 'Message enregistré avec succès !',
      amz: 'ⵜⵓⵣⵏ ⵜⴱⵔⴰⵜ ⵏⵏⴽ ⵙ ⵜⵖⴰⵔⴰⵙⵜ ⵉⴼⵓⵍⴽⵉⵏ!',
      en: 'Message recorded successfully!',
      es: '¡Mensaje guardado correctamente!',
    }),
    submittedDesc: pickLang(lang, {
      ar: `شكراً ${fullName}. سيتواصل معك فريق صالون بومليك قريباً على ${phone || 'رقمك'}.`,
      fr: `Merci ${fullName}. L’équipe du Salon Boumlik vous répondra rapidement au ${phone || 'votre numéro'}.`,
      amz: `ⵜⴰⵏⵎⵎⵉⵔⵜ ${fullName}. ⵜⴰⵔⴰⴱⴱⵓⵜ ⵏ ⵓⵙⴰⵍⵓⵏ ⴰⴷ ⴽ ⵜⵎⵙⴰⵡⴰⴹ ⵙ ⵜⵉⵣⵣⵍⴰ.`,
      en: `Thank you ${fullName}. The Salon Boumlik team will reply shortly on ${phone || 'your number'}.`,
      es: `Gracias ${fullName}. El equipo de Salon Boumlik te responderá pronto al ${phone || 'tu número'}.`,
    }),
    nameLabel: pickLang(lang, {
      ar: 'الاسم الكامل *',
      fr: 'Nom & Prénom *',
      amz: 'ⵉⵙⵎ ⵓⵎⵎⵉⴷ *',
      en: 'Full Name *',
      es: 'Nombre y Apellido *',
    }),
    namePlaceholder: pickLang(lang, {
      ar: 'مثال: طارق',
      fr: 'Ex: Tariq',
      amz: 'ⴰⵎⴷⵢⴰ: Tariq',
      en: 'Ex: Tariq',
      es: 'Ej: Tariq',
    }),
    phoneLabel: pickLang(lang, {
      ar: 'رقم الهاتف *',
      fr: 'Numéro de Téléphone *',
      amz: 'ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ *',
      en: 'Phone Number *',
      es: 'Número de Teléfono *',
    }),
    messageLabel: pickLang(lang, {
      ar: 'رسالتك أو استفسارك *',
      fr: 'Votre Message / Question *',
      amz: 'ⵜⴰⴱⵔⴰⵜ ⵏⵏⴽ / ⴰⵙⵇⵙⵉ *',
      en: 'Your Message / Question *',
      es: 'Tu Mensaje / Consulta *',
    }),
    messagePlaceholder: pickLang(lang, {
      ar: 'اكتب طلبك (قصة شعر، بروتين، لحية، أو الوقت المناسب بشارع بئر أنزران)...',
      fr: 'Indiquez votre demande (coupe, protéine, barbe, horaire souhaité sur Rue Bir Anzarane)...',
      amz: 'ⴰⵔⴰ ⵜⵓⵜⵜⵔⴰ ⵏⵏⴽ (ⵜⴰⴽⵔⴹⴰ, ⴱⵔⵓⵜⵉⵏ, ⵜⴰⵎⴰⵔⵜ)...',
      en: 'Describe your inquiry (haircut, protein treatment, beard, or preferred time)...',
      es: 'Indica tu consulta (corte, proteína, barba u horario preferido)...',
    }),
    sendWaBtn: pickLang(lang, {
      ar: 'إرسال عبر واتساب (0635392503)',
      fr: 'Envoyer par WhatsApp (0635392503)',
      amz: 'ⴰⵣⵏ ⴳ ⵡⴰⵜⵙⴰⴱ (0635392503)',
      en: 'Send via WhatsApp (0635392503)',
      es: 'Enviar por WhatsApp (0635392503)',
    }),
    sendGmailBtn: pickLang(lang, {
      ar: 'مراسلة عبر Gmail مباشر',
      fr: 'Rédiger via Gmail Direct',
      amz: 'ⴰⵣⵏ ⴳ Gmail',
      en: 'Compose via Gmail',
      es: 'Enviar por Gmail',
    }),
    scanHint: pickLang(lang, {
      ar: 'امسح هذا الرمز بكاميرا هاتفك.',
      fr: 'Scannez ce code avec l’appareil photo de votre téléphone.',
      amz: 'ⵙⴽⴰⵏ ⴰⴽⵓⴷ ⴰⴷ ⵙ ⵜⴽⴰⵎⵉⵔⴰⵜ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⵏⵏⴽ.',
      en: 'Scan this code with your phone camera.',
      es: 'Escanea este código con la cámara de tu teléfono.',
    }),
    subjectLine: pickLang(lang, {
      ar: 'استفسار من موقع صالون بومليك',
      fr: 'Demande de renseignements / Devis Salon Boumlik',
      amz: 'ⴰⵙⵇⵙⵉ ⵙⴳ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ',
      en: 'Salon Boumlik Website Inquiry',
      es: 'Consulta desde Salon Boumlik',
    }),
  };

  const formattedBody = `${ui.nameLabel}: ${fullName || '-'}
${ui.phoneLabel}: ${phone || '-'}
Email: ${email || '-'}

${ui.messageLabel}:
${message}

---
Salon Boumlik Taroudant`;

  const gmailComposeUrl = createGmailComposeUrl(
    SALON_INFO.email,
    `[Salon Boumlik] ${ui.subjectLine}`,
    formattedBody
  );

  const handleSendViaWhatsApp = () => {
    const text = pickLang(lang, {
      ar: `السلام عليكم سي حسن (صالون بومليك)، معكم ${fullName || 'زبون'}. ${message || 'أرغب في الاستفسار عن الخدمات والمواعيد المتاحة.'}`,
      fr: `Salam Si Hassan (Salon Boumlik), je m'appelle ${fullName || 'un client'}. ${message || 'Je souhaite avoir des informations sur vos formules et disponibilités.'}`,
      amz: `Azul Si Hassan (Salon Boumlik), ⵉⵙⵎ ⵉⵏⵓ ${fullName || 'ⴰⵎⵙⴰⵖ'}. ${message || 'ⵔⵉⵖ ⵉⵏⵖⵎⵉⵙⵏ ⵖⴼ ⵜⵡⵓⵔⵉⵡⵉⵏ.'}`,
      en: `Hello Si Hassan (Salon Boumlik), my name is ${fullName || 'a client'}. ${message || 'I would like information about your services and availability.'}`,
      es: `Hola Si Hassan (Salon Boumlik), soy ${fullName || 'un cliente'}. ${message || 'Me gustaría consultar sobre servicios y disponibilidad.'}`,
    });
    window.open(createWhatsAppUrl(SALON_INFO.whatsappNumber, text), '_blank');
  };

  const handleSubmitInApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !message) return;

    setSubmittedInApp(true);
    setTimeout(() => {
      setSubmittedInApp(false);
      setFullName('');
      setEmail('');
      setPhone('');
      setMessage('');
    }, 4000);
  };

  const qrSocials = [
    {
      title: pickLang(lang, {
        ar: 'واتساب مباشر (0635392503)',
        amz: 'ⵡⴰⵜⵙⴰⴱ ⵓⵙⵔⵉⴷ (0635392503)',
        en: 'Direct WhatsApp (0635392503)',
        es: 'WhatsApp Directo (0635392503)',
        fr: 'WhatsApp Direct (0635392503)',
      }),
      subtitle: pickLang(lang, {
        ar: 'امسح الباركود للتواصل مع حسن',
        amz: 'ⵙⴽⴰⵏ ⵉ ⵓⵎⵢⴰⵡⴰⴹ ⴷ ⵃⴰⵙⴰⵏ',
        en: 'Scan to message Hassan',
        es: 'Escanea para escribir a Hassan',
        fr: 'Scanner pour discuter avec Hassan',
      }),
      image: SALON_INFO.media.qrWhatsApp,
      icon: MessageCircle,
      actionUrl: `https://wa.me/${SALON_INFO.whatsappNumber}`,
    },
    {
      title: 'Instagram @SalonBoumlik',
      subtitle: pickLang(lang, {
        ar: 'صور وفيديوهات لقصات الشعر والتدريج',
        amz: 'ⵜⵉⵡⵍⴰⴼⵉⵏ ⵏ ⵜⴽⵔⴹⴰ ⴷ ⵜⵎⴰⵔⵜ',
        en: 'Fade & haircut photos & videos',
        es: 'Fotos y vídeos de cortes',
        fr: 'Photos de coupes, dégradés & vidéos',
      }),
      image: SALON_INFO.media.qrInstagram,
      icon: Instagram,
      actionUrl: SALON_INFO.social.instagram,
    },
    {
      title: 'Facebook Salon Boumlik',
      subtitle: pickLang(lang, {
        ar: 'أخبار ومجتمع تارودانت',
        amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⴷ ⵜⴰⵔⵓⴷⴰⵏⵜ',
        en: 'Taroudant news & community',
        es: 'Novedades en Taroudant',
        fr: 'Actualités & communauté Taroudant',
      }),
      image: SALON_INFO.media.qrFacebook,
      icon: Facebook,
      actionUrl: SALON_INFO.social.facebook,
    },
    {
      title: pickLang(lang, {
        ar: 'واي فاي مجاني بالصالون',
        amz: 'ⵡⴰⵢ-ⴼⴰⵢ ⴼⴰⴱⵓⵕ',
        en: 'Free Salon Wi-Fi',
        es: 'Wi-Fi Gratis del Salón',
        fr: 'Wi-Fi Gratuit du Salon',
      }),
      subtitle: pickLang(lang, {
        ar: 'اتصال تلقائي وسريع في الطابق الثاني',
        amz: 'ⴰⵎⵢⴰⵡⴰⴹ ⴳ ⵓⵙⵡⵉⵔ 2',
        en: 'Instant 2nd-floor connection',
        es: 'Conexión rápida en 2º piso',
        fr: 'Connexion automatique au 2ème étage',
      }),
      image: SALON_INFO.media.qrWifi,
      icon: Wifi,
      actionUrl: '#',
    },
  ];

  return (
    <section
      id="contact"
      className="py-10 sm:py-14 bg-[#FAF9F6] dark:bg-[#0B0C10] relative transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2.5 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-xs font-bold text-amber-700 dark:text-amber-400">
            <QrCode className="w-3.5 h-3.5" />
            <span>{t.navContact}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-display tracking-tight">
            {ui.heading}
          </h2>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-300 font-body">
            {ui.subtitle}
          </p>
        </div>

        {/* Official QR Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {qrSocials.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl p-4 bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 hover:border-amber-500/50 transition-all flex flex-col items-center text-center shadow-2xs group"
              >
                <div
                  onClick={() =>
                    setActiveQrModal({
                      title: item.title,
                      image: item.image,
                      description: item.subtitle,
                    })
                  }
                  className="w-32 h-32 rounded-2xl bg-white border border-stone-200 dark:border-transparent p-2 shadow-inner cursor-pointer hover:scale-105 transition-transform mb-3 relative flex items-center justify-center"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center transition-opacity">
                    <QrCode className="w-7 h-7 text-white" />
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                    <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>{item.title}</span>
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">{item.subtitle}</p>
                </div>

                <div className="mt-auto w-full pt-2 border-t border-stone-200 dark:border-zinc-800 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveQrModal({
                        title: item.title,
                        image: item.image,
                        description: item.subtitle,
                      })
                    }
                    className="flex-1 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {ui.zoomQr}
                  </button>
                  {item.actionUrl !== '#' && (
                    <a
                      href={item.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-xl bg-amber-600 text-white hover:bg-amber-500 transition-colors"
                      title={ui.openLink}
                      aria-label={ui.openLink}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact Form & Direct Inquiries */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Details */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{ui.directContactTitle}</span>
              </h3>

              <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-950/80 border border-amber-300 dark:border-amber-500/30 space-y-2">
                <div className="text-xs text-stone-500 dark:text-zinc-400">
                  {ui.ownerRoleLabel}
                </div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  {SALON_INFO.owner[lang] || SALON_INFO.owner.fr}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <a
                    href={`tel:${SALON_INFO.phone}`}
                    className="text-lg font-mono font-black text-amber-700 dark:text-amber-400 hover:underline"
                    dir="ltr"
                  >
                    06 35 39 25 03
                  </a>
                  <a
                    href={`https://wa.me/${SALON_INFO.whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Email box */}
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-950/80 border border-stone-200 dark:border-zinc-800 space-y-2">
                <div className="text-xs text-stone-500 dark:text-zinc-400">
                  {ui.emailLabel}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-zinc-200 break-all" dir="ltr">
                    {SALON_INFO.email}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="p-1.5 rounded-lg bg-white hover:bg-stone-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-stone-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 cursor-pointer"
                    aria-label="Copy email"
                  >
                    {copiedEmail ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Exact location summary */}
              <a
                href={salonSettings.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-zinc-950/80 border border-stone-200 dark:border-zinc-800 hover:border-amber-500/60 transition-all group text-xs text-slate-700 dark:text-zinc-300"
              >
                <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{SALON_INFO.address[lang] || SALON_INFO.address.fr}</span>
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                    <span>{ui.openMaps}</span>
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </a>
            </div>
          </div>

          {/* Right Form with Direct Gmail Compose & WhatsApp */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-5 sm:p-6 shadow-2xs">
              <div className="mb-5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                  {ui.formTitle}
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                  {ui.formSubtitle}
                </p>
              </div>

              {submittedInApp ? (
                <div className="p-8 rounded-2xl bg-stone-50 dark:bg-zinc-950 border border-emerald-300 dark:border-emerald-500/40 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {ui.submittedTitle}
                  </h4>
                  <p className="text-xs text-stone-600 dark:text-zinc-300 max-w-sm mx-auto">
                    {ui.submittedDesc}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitInApp} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                        {ui.nameLabel}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={ui.namePlaceholder}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-stone-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-zinc-100 placeholder-stone-400 dark:placeholder-zinc-500 px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                        {ui.phoneLabel}
                      </label>
                      <input
                        type="tel"
                        required
                        dir="ltr"
                        placeholder="06 XX XX XX XX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-stone-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-zinc-100 placeholder-stone-400 dark:placeholder-zinc-500 px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      {ui.messageLabel}
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder={ui.messagePlaceholder}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full bg-stone-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-zinc-100 placeholder-stone-400 dark:placeholder-zinc-500 p-3.5 rounded-xl border border-stone-200 dark:border-zinc-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-stone-200 dark:border-zinc-800 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleSendViaWhatsApp}
                        className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{ui.sendWaBtn}</span>
                      </button>

                      <a
                        href={gmailComposeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 px-4 rounded-xl bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all text-center"
                      >
                        <Mail className="w-4 h-4" />
                        <span>{ui.sendGmailBtn}</span>
                      </a>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Lightbox Modal */}
      {activeQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setActiveQrModal(null)}
        >
          <div
            className="bg-white dark:bg-zinc-950 border border-stone-200 dark:border-amber-500/40 rounded-3xl max-w-xs sm:max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveQrModal(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-stone-100 dark:bg-zinc-900 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {activeQrModal.title}
              </h4>
              <p className="text-xs text-stone-600 dark:text-zinc-400 mt-1">
                {activeQrModal.description}
              </p>
            </div>

            <div className="w-56 h-56 mx-auto rounded-2xl overflow-hidden p-3 bg-white border border-stone-200 dark:border-transparent shadow-xl">
              <img
                src={activeQrModal.image}
                alt={activeQrModal.title}
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[11px] text-stone-500 dark:text-zinc-500">{ui.scanHint}</p>
          </div>
        </div>
      )}
    </section>
  );
};
