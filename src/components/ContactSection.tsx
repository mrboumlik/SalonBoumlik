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
  Shield,
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { createGmailComposeUrl, createWhatsAppUrl } from '../utils/calendar';
import { useLanguage } from '../context/LanguageContext';
import {
  useSalonProfileSettings,
  formatSalonDisplayPhone,
  normalizeSalonTelHref,
  normalizeSalonWhatsappDigits,
} from '../utils/salonSettingsStore';
import { pickLang } from '../utils/i18n';
import { safeCopyToClipboard } from '../utils/safeBrowser';
import { buildWhatsAppInquiryMessage } from '../utils/whatsappAutomation';
import {
  SALON_WIFI_CONFIG,
  buildSalonWifiUri,
  copyWifiPasswordSafely,
  copyWifiSsidSafely,
} from '../utils/wifiConnect';

type ContactQrKind = 'whatsapp' | 'instagram' | 'facebook' | 'wifi';

export const ContactSection: React.FC = () => {
  const { lang, t } = useLanguage();
  const salonSettings = useSalonProfileSettings();
  const liveDisplayPhone = formatSalonDisplayPhone(salonSettings.salonPhone);
  const liveWhatsappCompact = formatSalonDisplayPhone(salonSettings.salonWhatsapp).replace(/\s+/g, '');
  const liveWhatsappDigits = normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp);
  const liveTelHref = normalizeSalonTelHref(salonSettings.salonPhone);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedWifiPass, setCopiedWifiPass] = useState(false);
  const [copiedWifiSsid, setCopiedWifiSsid] = useState(false);
  const [wifiConnectFeedback, setWifiConnectFeedback] = useState(false);
  const [submittedInApp, setSubmittedInApp] = useState(false);

  const [activeQrModal, setActiveQrModal] = useState<{
    kind: ContactQrKind;
    title: string;
    image: string;
    description: string;
    actionUrl: string;
    actionLabel: string;
  } | null>(null);

  const handleCopyEmail = () => {
    void safeCopyToClipboard(SALON_INFO.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyWifiPass = () => {
    void copyWifiPasswordSafely();
    setCopiedWifiPass(true);
    setTimeout(() => setCopiedWifiPass(false), 2200);
  };

  const handleCopyWifiSsid = () => {
    void copyWifiSsidSafely();
    setCopiedWifiSsid(true);
    setTimeout(() => setCopiedWifiSsid(false), 2000);
  };

  const handleDirectWifiConnect = () => {
    void copyWifiPasswordSafely();
    setCopiedWifiPass(true);
    setWifiConnectFeedback(true);
    setTimeout(() => setCopiedWifiPass(false), 2200);
    setTimeout(() => setWifiConnectFeedback(false), 5000);
  };

  const wifiUri = buildSalonWifiUri();

  const ui = {
    heading: pickLang(lang, {
      ar: 'التواصل، الشبكات والباركود',
      fr: 'CONTACT, RÉSEAUX & QR CODES',
      amz: 'ⴰⵎⵢⴰⵡⴰⴹ ⴷ ⴱⴰⵔⴽⵓⴷ',
      en: 'CONTACT, SOCIALS & QR CODES',
      es: 'CONTACTO, REDES Y QR',
    }),
    subtitle: pickLang(lang, {
      ar: `امسح رموز الاستجابة السريعة الرسمية أو تواصل مع حسن مباشرة عبر الواتساب على الرقم ${liveWhatsappCompact}.`,
      fr: `Scannez nos QR codes officiels ou contactez Hassan directement par WhatsApp au ${liveWhatsappCompact} ou via Gmail.`,
      amz: `ⵙⴽⴰⵏ ⴱⴰⵔⴽⵓⴷ ⵏⵏⵖ ⵏⵖ ⵙⴰⵡⵍ ⴷ ⵃⴰⵙⴰⵏ ⴳ ⵡⴰⵜⵙⴰⴱ ${liveWhatsappCompact}.`,
      en: `Scan our official QR codes or reach Hassan directly on WhatsApp at ${liveWhatsappCompact} or via Gmail.`,
      es: `Escanea nuestros códigos QR o contacta a Hassan directamente por WhatsApp al ${liveWhatsappCompact} o Gmail.`,
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
      ar: `إرسال عبر واتساب (${liveWhatsappCompact})`,
      fr: `Envoyer par WhatsApp (${liveWhatsappCompact})`,
      amz: `ⴰⵣⵏ ⴳ ⵡⴰⵜⵙⴰⴱ (${liveWhatsappCompact})`,
      en: `Send via WhatsApp (${liveWhatsappCompact})`,
      es: `Enviar por WhatsApp (${liveWhatsappCompact})`,
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
    socialStripTitle: pickLang(lang, {
      ar: 'مواقع التواصل والاتصال المباشر',
      fr: 'Réseaux Sociaux & Accès Direct',
      amz: 'ⵉⵥⴹⵡⴰⵏ ⵏ ⵓⵎⵢⴰⵡⴰⴹ ⵓⵙⵔⵉⴷ',
      en: 'Social Media & Direct Access',
      es: 'Redes Sociales y Acceso Directo',
    }),
    socialStripSub: pickLang(lang, {
      ar: 'ادخل مباشرة إلى صفحات صالون بومليك الرسمية أو راسلنا بنقرة واحدة',
      fr: 'Accédez en un clic aux pages officielles du Salon Boumlik',
      amz: 'ⴽⵛⵎ ⵓⵙⵔⵉⴷ ⵖⵔ ⵜⵙⵏⵉⵡⵉⵏ ⵏ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ',
      en: 'Open Salon Boumlik official social pages or message us in one tap',
      es: 'Abre las páginas oficiales de Salon Boumlik o escríbenos en un clic',
    }),
    openWhatsappBtn: pickLang(lang, {
      ar: 'فتح واتساب',
      fr: 'Ouvrir WhatsApp',
      amz: 'ⵕⵥⵎ ⵡⴰⵜⵙⴰⴱ',
      en: 'Open WhatsApp',
      es: 'Abrir WhatsApp',
    }),
    openInstagramBtn: pickLang(lang, {
      ar: 'فتح إنستغرام',
      fr: 'Ouvrir Instagram',
      amz: 'ⵕⵥⵎ ⵉⵏⵙⵜⴰⴳⵔⴰⵎ',
      en: 'Open Instagram',
      es: 'Abrir Instagram',
    }),
    openFacebookBtn: pickLang(lang, {
      ar: 'فتح فيسبوك',
      fr: 'Ouvrir Facebook',
      amz: 'ⵕⵥⵎ ⴼⵉⵙⴱⵓⴽ',
      en: 'Open Facebook',
      es: 'Abrir Facebook',
    }),
    wifiQuickConnectBtn: pickLang(lang, {
      ar: 'اتصال بالواي فاي',
      fr: 'Connexion Wi-Fi',
      amz: 'ⴰⵎⵢⴰⵡⴰⴹ Wi-Fi',
      en: 'Connect Wi-Fi',
      es: 'Conectar Wi-Fi',
    }),
    wifiCopyBtn: pickLang(lang, {
      ar: 'نسخ كلمة المرور',
      fr: 'Copier le code',
      amz: 'ⵏⵖⵍ ⴰⵙⴰⵔⵓⵜ',
      en: 'Copy Password',
      es: 'Copiar clave',
    }),
    wifiCopiedBtn: pickLang(lang, {
      ar: 'تم النسخ!',
      fr: 'Copié !',
      amz: 'ⵉⵜⵜⵓⵏⵖⴰⵍ!',
      en: 'Copied!',
      es: '¡Copiado!',
    }),
    wifiSsidLabel: pickLang(lang, {
      ar: 'الشبكة:',
      fr: 'Réseau :',
      amz: 'ⴰⵥⵟⵟⴰ:',
      en: 'SSID:',
      es: 'Red:',
    }),
    wifiSecurityLabel: pickLang(lang, {
      ar: 'الحماية:',
      fr: 'Sécurité :',
      amz: 'ⵜⴰⵏⴼⵔⵓⵜ:',
      en: 'Security:',
      es: 'Seguridad:',
    }),
    wifiPassLabel: pickLang(lang, {
      ar: 'كلمة المرور:',
      fr: 'Code :',
      amz: 'ⴰⵙⴰⵔⵓⵜ:',
      en: 'Password:',
      es: 'Clave:',
    }),
    wifiFeedback: pickLang(lang, {
      ar: 'تم نسخ كلمة المرور (@SalonBoumlik) للاتصال السريع.',
      fr: 'Mot de passe copié (@SalonBoumlik) pour connexion rapide.',
      amz: 'ⵉⵜⵜⵓⵏⵖⴰⵍ ⵓⵙⴰⵔⵓⵜ (@SalonBoumlik).',
      en: 'Password copied (@SalonBoumlik) — select @SalonBoumlik in Wi-Fi settings if not auto-connected.',
      es: 'Contraseña copiada (@SalonBoumlik) para conexión rápida.',
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

  const starterWhatsappText = buildWhatsAppInquiryMessage({
    lang,
    requestType: 'inquiry',
    includeMessagePrompt: true,
  });
  const directWhatsappUrl = createWhatsAppUrl(liveWhatsappDigits, starterWhatsappText);

  const whatsappInquiryText = buildWhatsAppInquiryMessage({
    lang,
    requestType: 'inquiry',
    clientName: fullName.trim() || undefined,
    clientPhone: phone.trim() || undefined,
    notes: message.trim() || undefined,
    includeMessagePrompt: !message.trim(),
  });
  const whatsappComposeUrl = createWhatsAppUrl(liveWhatsappDigits, whatsappInquiryText);

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

  const qrSocials: Array<{
    kind: ContactQrKind;
    title: string;
    subtitle: string;
    image: string;
    icon: typeof MessageCircle;
    actionUrl: string;
    actionLabel: string;
    buttonTone: string;
  }> = [
    {
      kind: 'whatsapp',
      title: pickLang(lang, {
        ar: `واتساب مباشر (${liveWhatsappCompact})`,
        amz: `ⵡⴰⵜⵙⴰⴱ ⵓⵙⵔⵉⴷ (${liveWhatsappCompact})`,
        en: `Direct WhatsApp (${liveWhatsappCompact})`,
        es: `WhatsApp Directo (${liveWhatsappCompact})`,
        fr: `WhatsApp Direct (${liveWhatsappCompact})`,
      }),
      subtitle: pickLang(lang, {
        ar: 'امسح الباركود أو راسل حسن مباشرة',
        amz: 'ⵙⴽⴰⵏ ⵉ ⵓⵎⵢⴰⵡⴰⴹ ⴷ ⵃⴰⵙⴰⵏ',
        en: 'Scan or message Hassan directly',
        es: 'Escanea o escribe a Hassan',
        fr: 'Scanner ou écrire à Hassan',
      }),
      image: SALON_INFO.media.qrWhatsApp,
      icon: MessageCircle,
      actionUrl: directWhatsappUrl,
      actionLabel: ui.openWhatsappBtn,
      buttonTone: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    {
      kind: 'instagram',
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
      actionLabel: ui.openInstagramBtn,
      buttonTone: 'bg-rose-600 hover:bg-rose-700 text-white',
    },
    {
      kind: 'facebook',
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
      actionLabel: ui.openFacebookBtn,
      buttonTone: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    {
      kind: 'wifi',
      title: pickLang(lang, {
        ar: 'واي فاي مجاني بالصالون',
        amz: 'ⵡⴰⵢ-ⴼⴰⵢ ⴼⴰⴱⵓⵕ',
        en: 'Free Salon Wi-Fi',
        es: 'Wi-Fi Gratis del Salón',
        fr: 'Wi-Fi Gratuit du Salon',
      }),
      subtitle: pickLang(lang, {
        ar: 'اتصال مباشر أو امسح الباركود في الطابق الثاني',
        amz: 'ⴰⵎⵢⴰⵡⴰⴹ ⴳ ⵓⵙⵡⵉⵔ 2',
        en: 'Quick connect or scan at 2nd floor',
        es: 'Conexión directa o escanea en 2º piso',
        fr: 'Connexion directe ou scan au 2ème étage',
      }),
      image: SALON_INFO.media.qrWifi,
      icon: Wifi,
      actionUrl: wifiUri,
      actionLabel: ui.wifiQuickConnectBtn,
      buttonTone: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
  ];

  return (
    <section
      id="contact"
      className="py-10 sm:py-14 bg-[#FAF9F6] dark:bg-[#0B0C10] relative transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2.5 mb-8">
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

        {/* Dedicated Direct Social Media Buttons Strip ("مواقع التواصل") */}
        <div className="rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 p-4 sm:p-5 mb-6 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {ui.socialStripTitle}
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                {ui.socialStripSub}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 md:min-w-[460px]">
              <a
                href={directWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-2xs"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span>{ui.openWhatsappBtn}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-85 flex-shrink-0" />
              </a>

              <a
                href={SALON_INFO.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-2xs"
              >
                <Instagram className="w-4 h-4 flex-shrink-0" />
                <span>{ui.openInstagramBtn}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-85 flex-shrink-0" />
              </a>

              <a
                href={SALON_INFO.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-2xs"
              >
                <Facebook className="w-4 h-4 flex-shrink-0" />
                <span>{ui.openFacebookBtn}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-85 flex-shrink-0" />
              </a>
            </div>
          </div>
        </div>

        {/* Official QR Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {qrSocials.map((item) => {
            const Icon = item.icon;
            const isWifiCard = item.kind === 'wifi';
            return (
              <div
                key={item.kind}
                className="rounded-2xl p-4 bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 hover:border-amber-500/50 transition-all flex flex-col items-center text-center shadow-2xs group"
              >
                <div
                  onClick={() =>
                    setActiveQrModal({
                      kind: item.kind,
                      title: item.title,
                      image: item.image,
                      description: item.subtitle,
                      actionUrl: item.actionUrl,
                      actionLabel: item.actionLabel,
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

                <div className="space-y-1 mb-3 w-full">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                    <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>{item.title}</span>
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">{item.subtitle}</p>

                  {isWifiCard && (
                    <div className="mt-2 p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-[11px] space-y-1 text-start">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-stone-500 dark:text-zinc-400">{ui.wifiSsidLabel}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                          {SALON_WIFI_CONFIG.ssid}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-stone-500 dark:text-zinc-400">{ui.wifiSecurityLabel}</span>
                        <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400" dir="ltr">
                          {SALON_WIFI_CONFIG.security}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-stone-500 dark:text-zinc-400">{ui.wifiPassLabel}</span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400" dir="ltr">
                          {SALON_WIFI_CONFIG.password}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto w-full pt-2.5 border-t border-stone-200 dark:border-zinc-800 space-y-2">
                  {isWifiCard ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      <a
                        href={wifiUri}
                        onClick={handleDirectWifiConnect}
                        className={`py-2 px-2.5 rounded-xl ${item.buttonTone} text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer`}
                      >
                        <Wifi className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{item.actionLabel}</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyWifiPass}
                        className="py-2 px-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedWifiPass ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedWifiPass ? ui.wifiCopiedBtn : ui.wifiCopyBtn}</span>
                      </button>
                    </div>
                  ) : (
                    <a
                      href={item.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full py-2 px-3 rounded-xl ${item.buttonTone} text-xs font-bold flex items-center justify-center gap-1.5 transition-colors`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{item.actionLabel}</span>
                      <ExternalLink className="w-3 h-3 opacity-85 flex-shrink-0" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setActiveQrModal({
                        kind: item.kind,
                        title: item.title,
                        image: item.image,
                        description: item.subtitle,
                        actionUrl: item.actionUrl,
                        actionLabel: item.actionLabel,
                      })
                    }
                    className="w-full py-1.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{ui.zoomQr}</span>
                  </button>
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
                    href={liveTelHref}
                    className="text-lg font-mono font-black text-amber-700 dark:text-amber-400 hover:underline"
                    dir="ltr"
                  >
                    {liveDisplayPhone}
                  </a>
                  <a
                    href={directWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
                {(salonSettings.additionalPhones || []).length > 0 && (
                  <div className="pt-2 border-t border-stone-200/70 dark:border-zinc-800 flex flex-wrap gap-2">
                    {(salonSettings.additionalPhones || []).map((extraPhone) => (
                      <a
                        key={extraPhone}
                        href={normalizeSalonTelHref(extraPhone)}
                        dir="ltr"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-xs font-mono font-bold text-slate-800 dark:text-zinc-200 hover:border-amber-500/60"
                      >
                        <Phone className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>{formatSalonDisplayPhone(extraPhone)}</span>
                      </a>
                    ))}
                  </div>
                )}
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
                      <a
                        href={whatsappComposeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all text-center"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{ui.sendWaBtn}</span>
                      </a>

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

      {/* QR Code Lightbox Modal with Direct Action & Wi-Fi Credentials */}
      {activeQrModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sb-modal-backdrop"
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

            {activeQrModal.kind === 'wifi' ? (
              <div className="space-y-3">
                <div className="p-3 bg-stone-100 dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800 text-start text-xs space-y-2">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-stone-500 dark:text-zinc-400">{ui.wifiSsidLabel}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                        {SALON_WIFI_CONFIG.ssid}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyWifiSsid}
                        aria-label={ui.wifiSsidLabel}
                        className="p-1 rounded bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300 cursor-pointer"
                      >
                        {copiedWifiSsid ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-stone-200 dark:border-zinc-800">
                    <span className="text-stone-500 dark:text-zinc-400">{ui.wifiSecurityLabel}</span>
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700 dark:text-emerald-400" dir="ltr">
                      <Shield className="w-3 h-3" />
                      <span>{SALON_WIFI_CONFIG.security}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-stone-200 dark:border-zinc-800">
                    <span className="text-stone-500 dark:text-zinc-400">{ui.wifiPassLabel}</span>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400" dir="ltr">
                      {SALON_WIFI_CONFIG.password}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={wifiUri}
                    onClick={handleDirectWifiConnect}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Wifi className="w-4 h-4 flex-shrink-0" />
                    <span>{ui.wifiQuickConnectBtn}</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyWifiPass}
                    className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedWifiPass ? <Check className="w-4 h-4 flex-shrink-0" /> : <Copy className="w-4 h-4 flex-shrink-0" />}
                    <span>{copiedWifiPass ? ui.wifiCopiedBtn : ui.wifiCopyBtn}</span>
                  </button>
                </div>

                {wifiConnectFeedback && (
                  <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-700/50 rounded-xl p-2.5 text-start">
                    {ui.wifiFeedback}
                  </p>
                )}
              </div>
            ) : (
              <a
                href={activeQrModal.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <span>{activeQrModal.actionLabel}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <p className="text-[11px] text-stone-500 dark:text-zinc-500">{ui.scanHint}</p>
          </div>
        </div>
      )}
    </section>
  );
};
