import React, { useState } from 'react';
import { 
  Mail, 
  Send, 
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
  Wifi
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { createGmailComposeUrl, createWhatsAppUrl } from '../utils/calendar';
import { useLanguage } from '../context/LanguageContext';

export const ContactSection: React.FC = () => {
  const { lang, t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Demande de renseignements / Devis Salon Boumlik');
  const [message, setMessage] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [submittedInApp, setSubmittedInApp] = useState(false);

  // QR Lightbox modal state
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

  const formattedBody = `Nom complet: ${fullName || 'Non spécifié'}
Téléphone: ${phone || 'Non spécifié'}
Email: ${email || 'Non spécifié'}

Message:
${message}

---
Envoyé depuis le site Salon Boumlik (Taroudant, Rue Bir Anzarane, 2ème étage)`;

  const gmailComposeUrl = createGmailComposeUrl(
    SALON_INFO.email,
    `[Salon Boumlik] ${subject}`,
    formattedBody
  );

  const handleSendViaWhatsApp = () => {
    const text = `Salam Si Hassan (Salon Boumlik), je m'appelle ${fullName || 'un client'}. ${message || 'Je souhaite avoir des informations sur vos formules et disponibilités sur Rue Bir Anzarane.'}`;
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
      title: lang === 'ar' ? 'واتساب مباشر (0635392503)' : lang === 'amz' ? 'ⵡⴰⵜⵙⴰⴱ ⵓⵙⵔⵉⴷ (0635392503)' : 'WhatsApp Direct (0635392503)',
      subtitle: lang === 'ar' ? 'امسح الباركود للتواصل مع حسن' : lang === 'amz' ? 'ⵙⴽⴰⵏ ⵉ ⵓⵎⵢⴰⵡⴰⴹ ⴷ ⵃⴰⵙⴰⵏ' : 'Scanner pour discuter avec Hassan',
      image: SALON_INFO.media.qrWhatsApp,
      icon: MessageCircle,
      accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      actionUrl: `https://wa.me/${SALON_INFO.whatsappNumber}`,
    },
    {
      title: 'Instagram @SalonBoumlik',
      subtitle: lang === 'ar' ? 'صور وفيديوهات لقصات الشعر والتدريج' : lang === 'amz' ? 'ⵜⵉⵡⵍⴰⴼⵉⵏ ⵏ ⵜⴽⵔⴹⴰ ⴷ ⵜⵎⴰⵔⵜ' : 'Photos de coupes, dégradés & vidéos',
      image: SALON_INFO.media.qrInstagram,
      icon: Instagram,
      accent: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
      actionUrl: SALON_INFO.social.instagram,
    },
    {
      title: 'Facebook Salon Boumlik',
      subtitle: lang === 'ar' ? 'أخبار ومجتمع تارودانت' : lang === 'amz' ? 'ⵉⵏⵖⵎⵉⵙⵏ ⴷ ⵜⴰⵔⵓⴷⴰⵏⵜ' : 'Actualités & communauté Taroudant',
      image: SALON_INFO.media.qrFacebook,
      icon: Facebook,
      accent: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      actionUrl: SALON_INFO.social.facebook,
    },
    {
      title: lang === 'ar' ? 'واي فاي مجاني بالصالون' : lang === 'amz' ? 'ⵡⴰⵢ-ⴼⴰⵢ ⴼⴰⴱⵓⵕ' : 'Wi-Fi Gratuit du Salon',
      subtitle: lang === 'ar' ? 'اتصال تلقائي وسريع في الطابق الثاني' : lang === 'amz' ? 'ⴰⵎⵢⴰⵡⴰⴹ ⴳ ⵓⵙⵡⵉⵔ 2' : 'Connexion automatique au 2ème étage',
      image: SALON_INFO.media.qrWifi,
      icon: Wifi,
      accent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      actionUrl: '#',
    },
  ];

  return (
    <section id="contact" className="py-16 md:py-24 bg-[#050609] relative border-t border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            <QrCode className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.navContact}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-display tracking-tight">
            {lang === 'ar' ? (
              <span>التواصل، <span className="text-gold-gradient">الشبكات والباركود</span></span>
            ) : lang === 'amz' ? (
              <span>ⴰⵎⵢⴰⵡⴰⴹ ⴷ <span className="text-gold-gradient">ⴱⴰⵔⴽⵓⴷ</span></span>
            ) : lang === 'en' ? (
              <span>CONTACT, <span className="text-gold-gradient">SOCIALS & QR CODES</span></span>
            ) : (
              <span>CONTACT, <span className="text-gold-gradient">RÉSEAUX & QR CODES</span></span>
            )}
          </h2>

          <p className="text-sm sm:text-base text-zinc-300 font-body">
            {lang === 'ar'
              ? 'امسح رموز الاستجابة السريعة الرسمية أو تواصل مع حسن مباشرة عبر الواتساب على الرقم 0635392503.'
              : lang === 'amz'
              ? 'ⵙⴽⴰⵏ ⴱⴰⵔⴽⵓⴷ ⵏⵏⵖ ⵏⵖ ⵙⴰⵡⵍ ⴷ ⵃⴰⵙⴰⵏ ⴳ ⵡⴰⵜⵙⴰⴱ 0635392503.'
              : lang === 'en'
              ? 'Scan our official QR codes or reach Hassan directly on WhatsApp at 0635392503 or via Gmail.'
              : 'Scannez nos QR codes officiels ou contactez Hassan directement par WhatsApp au 0635392503 ou via Gmail.'}
          </p>
        </div>

        {/* Official QR Cards Grid (Instagram, WhatsApp, Facebook, Free Wi-Fi) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
          {qrSocials.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-3xl p-5 bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/40 transition-all flex flex-col items-center text-center shadow-xl group"
              >
                {/* QR preview box */}
                <div 
                  onClick={() => setActiveQrModal({
                    title: item.title,
                    image: item.image,
                    description: item.subtitle,
                  })}
                  className="w-36 h-36 rounded-2xl bg-white p-2 shadow-inner cursor-pointer hover:scale-105 transition-transform mb-3 relative flex items-center justify-center"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center transition-opacity">
                    <QrCode className="w-8 h-8 text-white" />
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                    <Icon className="w-4 h-4 text-amber-400" />
                    <span>{item.title}</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400">{item.subtitle}</p>
                </div>

                <div className="mt-auto w-full pt-2 border-t border-zinc-800/80 flex gap-2">
                  <button
                    onClick={() => setActiveQrModal({
                      title: item.title,
                      image: item.image,
                      description: item.subtitle,
                    })}
                    className="flex-1 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer"
                  >
                    {lang === 'ar' ? 'تكبير الباركود' : lang === 'amz' ? 'ⵙⵉⵎⵖⵓⵔ' : 'Agrandir QR'}
                  </button>
                  {item.actionUrl !== '#' && (
                    <a
                      href={item.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-xl bg-amber-400 text-zinc-950 hover:bg-amber-300"
                      title="Ouvrir le lien"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact Form & Direct Inquiries with Gmail / WhatsApp */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Details */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400" />
                <span>
                  {lang === 'ar' ? 'الاتصال المباشر والمالك' : lang === 'amz' ? 'ⴰⵎⵢⴰⵡⴰⴹ ⵓⵙⵔⵉⴷ' : 'Contact Direct & Propriétaire'}
                </span>
              </h3>

              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-amber-500/30 space-y-2">
                <div className="text-xs text-zinc-400">
                  {lang === 'ar' ? 'المؤسس وخبير الحلاقة :' : lang === 'amz' ? 'ⴰⵎⵙⴱⴷⴰⴷ ⵏ ⵙⴰⵍⵓⵏ :' : 'Propriétaire & Maître Barbier :'}
                </div>
                <div className="text-base font-bold text-white">
                  {SALON_INFO.owner[lang] || SALON_INFO.owner.fr}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <a 
                    href={`tel:${SALON_INFO.phone}`} 
                    className="text-lg font-mono font-black text-amber-400 hover:underline"
                  >
                    06 35 39 25 03
                  </a>
                  <a
                    href={`https://wa.me/${SALON_INFO.whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-1 shadow-md"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Email box */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                <div className="text-xs text-zinc-400">
                  {lang === 'ar' ? 'البريد الإلكتروني / Gmail :' : lang === 'amz' ? 'ⵉⵎⵉⵢⵍ :' : 'Courriel officiel / Gmail :'}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-mono font-bold text-zinc-200 break-all">
                    {SALON_INFO.email}
                  </span>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                  >
                    {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Exact location summary */}
              <div className="space-y-2 pt-2 text-xs text-zinc-300">
                <a
                  href={SALON_INFO.googleMapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-amber-500/50 hover:text-white transition-all group"
                >
                  <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div className="flex-1">
                    <span>{SALON_INFO.address[lang] || SALON_INFO.address.fr}</span>
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-blue-400 font-bold">
                      <span>{lang === 'ar' ? 'فتح في خرائط Google' : 'Ouvrir dans Google Maps'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Right Form with Direct Gmail Compose & WhatsApp */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 p-6 sm:p-8 shadow-2xl">
              <div className="mb-6">
                <h3 className="text-lg sm:text-xl font-bold text-white font-display">
                  Envoyer une Demande / Message
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Posez vos questions ou demandez un devis directement à Hassan.
                </p>
              </div>

              {submittedInApp ? (
                <div className="p-8 rounded-2xl bg-zinc-950 border border-emerald-500/40 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h4 className="text-base font-bold text-white">Message enregistré avec succès !</h4>
                  <p className="text-xs text-zinc-300 max-w-sm mx-auto">
                    Merci {fullName}. L'équipe du Salon Boumlik vous répondra rapidement au {phone || 'votre numéro'}.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitInApp} className="space-y-4">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Nom & Prénom *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Tariq"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Numéro de Téléphone *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="06 XX XX XX XX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Votre Message / Question *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Indiquez votre demande (coupe, protéine, barbe, horaire souhaité sur Rue Bir Anzarane)..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full bg-zinc-950 text-xs text-zinc-100 p-3.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Actions: Send WhatsApp & Gmail */}
                  <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleSendViaWhatsApp}
                        className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Envoyer par WhatsApp (0635392503)</span>
                      </button>

                      <a
                        href={gmailComposeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all text-center"
                      >
                        <Mail className="w-4 h-4" />
                        <span>Rédiger via Gmail Direct</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl max-w-xs sm:max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setActiveQrModal(null)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h4 className="text-base font-bold text-white">{activeQrModal.title}</h4>
              <p className="text-xs text-zinc-400 mt-1">{activeQrModal.description}</p>
            </div>

            <div className="w-56 h-56 mx-auto rounded-2xl overflow-hidden p-3 bg-white shadow-2xl">
              <img
                src={activeQrModal.image}
                alt={activeQrModal.title}
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[11px] text-zinc-500">
              Scannez ce code avec l'appareil photo de votre téléphone.
            </p>
          </div>
        </div>
      )}

    </section>
  );
};
