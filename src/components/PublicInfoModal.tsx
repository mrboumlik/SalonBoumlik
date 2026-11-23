import React, { useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  X,
  Info,
  Phone,
  MessageCircle,
  Instagram,
  MapPin,
  Clock,
  ShieldCheck,
  FileText,
  ExternalLink,
  Scissors,
  Users,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import {
  useSalonProfileSettings,
  formatSalonDisplayPhone,
  normalizeSalonTelHref,
  normalizeSalonWhatsappDigits,
} from '../utils/salonSettingsStore';
import { pickLang } from '../utils/i18n';

export type PublicInfoSection = 'about' | 'contact' | 'privacy' | 'terms';

interface PublicInfoModalProps {
  activeSection: PublicInfoSection | null;
  onSelectSection: (section: PublicInfoSection) => void;
  onClose: () => void;
  onOpenBooking?: () => void;
}

export const PublicInfoModal: React.FC<PublicInfoModalProps> = ({
  activeSection,
  onSelectSection,
  onClose,
  onOpenBooking,
}) => {
  const { lang, isRtl } = useLanguage();
  const salonSettings = useSalonProfileSettings();

  useEffect(() => {
    if (!activeSection) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSection, onClose]);

  const navItems: {
    id: PublicInfoSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'about',
      icon: Info,
      label: pickLang(lang, {
        ar: 'من نحن',
        fr: 'À propos',
        amz: 'ⵖⵉⴼⵏⵖ',
        en: 'About Us',
        es: 'Sobre nosotros',
      }),
    },
    {
      id: 'contact',
      icon: Phone,
      label: pickLang(lang, {
        ar: 'اتصل بنا',
        fr: 'Contact',
        amz: 'ⴰⵎⵢⴰⵡⴰⴹ',
        en: 'Contact',
        es: 'Contacto',
      }),
    },
    {
      id: 'privacy',
      icon: ShieldCheck,
      label: pickLang(lang, {
        ar: 'سياسة الخصوصية',
        fr: 'Confidentialité',
        amz: 'ⵜⴰⵙⵔⵜⵉⵜ ⵏ ⵜⵓⵙⵍⵉⴳⵜ',
        en: 'Privacy Policy',
        es: 'Privacidad',
      }),
    },
    {
      id: 'terms',
      icon: FileText,
      label: pickLang(lang, {
        ar: 'شروط الاستخدام',
        fr: "Conditions d'utilisation",
        amz: 'ⵜⵉⴼⴰⴷⵉⵡⵉⵏ ⵏ ⵓⵙⵎⵔⵙ',
        en: 'Terms of Use',
        es: 'Términos de uso',
      }),
    },
  ];

  const closeAria = pickLang(lang, {
    ar: 'إغلاق النافذة',
    fr: 'Fermer la fenêtre',
    amz: 'ⵇⵇⵏ ⵜⴰⵙⴼⵉⴼⵜ',
    en: 'Close modal',
    es: 'Cerrar ventana',
  });

  const renderAbout = () => (
    <div className="space-y-5">
      <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-500/20 p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-500/30 p-1 flex items-center justify-center flex-shrink-0">
            <img
              src={SALON_INFO.media.logoClean}
              alt="Salon Boumlik"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {pickLang(lang, {
                ar: 'صالون بومليك — تارودانت',
                fr: 'Salon Boumlik — Taroudant',
                amz: 'ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ — ⵜⴰⵔⵓⴷⴰⵏⵜ',
                en: 'Salon Boumlik — Taroudant',
                es: 'Salon Boumlik — Taroudant',
              })}
            </h3>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {SALON_INFO.slogan[lang] || SALON_INFO.slogan.ar}
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
          {pickLang(lang, {
            ar: 'يُعد صالون بومليك فضاءً متكاملاً للحلاقة والعناية الرجالية في قلب مدينة تارودانت (شارع بئر أنزران)، تأسس تحت إشراف الخبير حسن ايت بومليك بخبرة تمتد منذ سنة 2016 لتقديم قصات دقيقة، عناية باللحية، وعلاجات عصرية في أجواء هادئة ومريحة.',
            fr: 'Situé au cœur de Taroudant (Rue Bir Anzarane), Salon Boumlik est un espace exclusivement dédié à la coiffure et aux soins masculins. Dirigé par Hassan Ait Boumlik (depuis 2016), le salon allie savoir-faire artisanal, hygiène irréprochable et accueil soigné.',
            amz: 'ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ (ⴰⵖⴰⵔⴰⵙ ⵏ ⴱⵉⵔ ⴰⵏⵣⴰⵔⴰⵏ) ⵉⵥⵍⵉ ⵉ ⵜⴽⵔⴹⴰ ⴷ ⵓⴼⵔⴰⴳ ⵏ ⵉⵔⴳⴰⵣⵏ, ⵙ ⵓⵙⵡⵓⴷⴷⵓ ⵏ ⵃⴰⵙⴰⵏ ⴰⵢⵜ ⴱⵓⵎⵍⵉⴽ ⵙⴳ 2016.',
            en: "Located in the heart of Taroudant (Rue Bir Anzarane), Salon Boumlik is a dedicated men's grooming lounge led by founder and master barber Hassan Ait Boumlik since 2016—blending precision cuts, beard sculpting, and calm hospitality.",
            es: 'Ubicado en Taroudant (Rue Bir Anzarane), Salon Boumlik es una barbería masculina dirigida por Hassan Ait Boumlik desde 2016, especializada en cortes de precisión y cuidado integral.',
          })}
        </p>
      </div>

      {/* Team Highlights */}
      <div className="rounded-2xl bg-stone-50 dark:bg-zinc-900/60 border border-stone-200 dark:border-zinc-800 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
          <Users className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          <span>
            {pickLang(lang, {
              ar: 'فريق الحلاقين بالصالون',
              fr: "L'équipe du salon",
              amz: 'ⵜⴰⵔⴰⴱⴱⵓⵜ ⵏ ⵉⵎⴽⵔⴰⴹⵏ',
              en: 'Our Barber Team',
              es: 'Nuestro equipo',
            })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {[
            {
              name: pickLang(lang, { ar: 'حسن ايت بومليك', fr: 'Hassan Ait Boumlik', en: 'Hassan Ait Boumlik' }),
              role: pickLang(lang, { ar: 'المؤسس وخبير الحلاقة (منذ 2016)', fr: 'Fondateur & Maître Barbier (depuis 2016)', en: 'Founder & Master Barber (since 2016)' }),
              dot: '#D97706',
            },
            {
              name: pickLang(lang, { ar: 'أنور عريف', fr: 'Anouar Arif', en: 'Anouar Arif' }),
              role: pickLang(lang, { ar: 'حلاق محترف وتدريج عصري', fr: 'Barbier professionnel & dégradés', en: 'Senior Barber & Modern Fades' }),
              dot: '#2563EB',
            },
            {
              name: pickLang(lang, { ar: 'لحسن الهنز', fr: 'Lahcen Lhanz', en: 'Lahcen Lhanz' }),
              role: pickLang(lang, { ar: 'حلاق متمرس وعناية باللحية', fr: 'Barbier expert & taille de barbe', en: 'Experienced Barber & Beard Care' }),
              dot: '#059669',
            },
            {
              name: pickLang(lang, { ar: 'منير', fr: 'Mounir', en: 'Mounir' }),
              role: pickLang(lang, { ar: 'قصات رجالية وعناية متكاملة', fr: 'Coiffure homme & soins complets', en: 'Men’s Haircuts & Grooming' }),
              dot: '#7C3AED',
            },
          ].map((member) => (
            <div
              key={member.name}
              className="p-3 rounded-xl bg-white dark:bg-zinc-950/70 border border-stone-200/80 dark:border-zinc-800 flex items-center gap-2.5"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: member.dot }}
              />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 dark:text-white truncate">{member.name}</div>
                <div className="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{member.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Online Booking Value */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900/50 border border-stone-200 dark:border-zinc-800 p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
          <Scissors className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          <span>
            {pickLang(lang, {
              ar: 'نظام حجز إلكتروني ذكي بدون انتظار',
              fr: 'Réservation en ligne moderne sans attente',
              amz: 'ⴰⵙⵔⵓⵙ ⴰⵍⵉⴽⵜⵕⵓⵏⵉ ⵡⴰⵔ ⴰⴳⴰⵏⵉ',
              en: 'Modern Online Booking Without Waiting',
              es: 'Reserva online moderna sin esperas',
            })}
          </span>
        </div>
        <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
          {pickLang(lang, {
            ar: 'يتيح لك موقعنا حجز موعدك مسبقاً واختيار الحلاق المفضل والخدمات الدقيقة مع عرض الأوقات المتاحة لحظياً، واستلام تذكرة QR رقمية، وتتبع دورك ونقاط الولاء بكل سهولة.',
            fr: 'Réservez votre créneau en ligne avec le barbier de votre choix, visualisez les disponibilités en temps réel, recevez un ticket QR instantané et suivez votre fidélité.',
            amz: 'ⵙⵔⵙ ⴰⵙⵉⵀⴰⵔ ⵏⵏⴽ ⵙ ⵜⴼⵙⵙⵉ, ⵙⵜⵉ ⴰⵎⴽⵔⴰⴹ ⵏⵏⴽ ⴷ ⵜⵉⵏⴰⴼⵓⵜⵉⵏ, ⵜⴰⵎⵥⴷ ⵜⴰⵡⵔⵉⵇⵜ QR.',
            en: 'Book online in seconds with real-time barber availability, instant QR tickets, queue visibility, and verified visit loyalty rewards.',
            es: 'Reserva tu cita con tu barbero favorito en tiempo real, obtén tu ticket QR y acumula puntos de fidelidad.',
          })}
        </p>
        {onOpenBooking && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBooking();
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>
                {pickLang(lang, {
                  ar: 'احجز موعدك الآن',
                  fr: 'Réserver maintenant',
                  amz: 'ⵙⵔⵙ ⴰⵙⵉⵀⴰⵔ ⴷⵖⵉ',
                  en: 'Book an Appointment',
                  es: 'Reservar ahora',
                })}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderContact = () => (
    <div className="space-y-4">
      {/* Direct Contact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href={normalizeSalonTelHref(salonSettings.salonPhone)}
          className="p-4 rounded-2xl bg-stone-50 hover:bg-stone-100/80 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex items-center gap-3 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Phone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
              {pickLang(lang, {
                ar: 'الهاتف المباشر',
                fr: 'Téléphone',
                amz: 'ⴰⵜⵉⵍⵉⴼⵓⵏ',
                en: 'Direct Phone',
                es: 'Teléfono',
              })}
            </div>
            <div dir="ltr" className="text-sm font-black font-mono text-slate-900 dark:text-white">
              {formatSalonDisplayPhone(salonSettings.salonPhone)}
            </div>
          </div>
        </a>

        <a
          href={`https://wa.me/${normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 rounded-2xl bg-stone-50 hover:bg-emerald-50/50 dark:bg-zinc-900/60 dark:hover:bg-emerald-950/20 border border-stone-200 dark:border-zinc-800 flex items-center gap-3 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
              WhatsApp
            </div>
            <div dir="ltr" className="text-sm font-black font-mono text-slate-900 dark:text-white">
              {formatSalonDisplayPhone(salonSettings.salonWhatsapp)}
            </div>
          </div>
        </a>

        <a
          href="https://www.instagram.com/h.a.boumlik"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 rounded-2xl bg-stone-50 hover:bg-amber-50/50 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex items-center gap-3 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Instagram className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
              Instagram
            </div>
            <div dir="ltr" className="text-sm font-black font-mono text-slate-900 dark:text-white truncate">
              @h.a.boumlik
            </div>
          </div>
        </a>

        <a
          href={`mailto:${SALON_INFO.email}`}
          className="p-4 rounded-2xl bg-stone-50 hover:bg-stone-100/80 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex items-center gap-3 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-200/70 dark:bg-zinc-800 border border-stone-300/70 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
              {pickLang(lang, { ar: 'البريد الإلكتروني', fr: 'Email', amz: 'ⵉⵎⴰⵢⵍ', en: 'Email', es: 'Correo' })}
            </div>
            <div dir="ltr" className="text-xs font-bold font-mono text-slate-900 dark:text-white truncate">
              {SALON_INFO.email}
            </div>
          </div>
        </a>
      </div>

      {(salonSettings.additionalPhones || []).length > 0 && (
        <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-900/60 border border-stone-200 dark:border-zinc-800 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
            {pickLang(lang, {
              ar: 'أرقام إضافية:',
              fr: 'Autres numéros :',
              amz: 'ⵓⵟⵟⵓⵏⵏ ⵢⴰⴹⵏ:',
              en: 'Additional phones:',
              es: 'Otros teléfonos:',
            })}
          </span>
          {(salonSettings.additionalPhones || []).map((extraPhone) => (
            <a
              key={extraPhone}
              href={normalizeSalonTelHref(extraPhone)}
              dir="ltr"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-700 text-xs font-mono font-bold text-slate-900 dark:text-white hover:border-amber-500/60"
            >
              <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{formatSalonDisplayPhone(extraPhone)}</span>
            </a>
          ))}
        </div>
      )}

      {/* Address & Google Maps */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/50 border border-stone-200 dark:border-zinc-800 space-y-3">
        <div className="flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-black text-slate-900 dark:text-white">
              {pickLang(lang, {
                ar: 'العنوان — تارودانت',
                fr: 'Adresse — Taroudant',
                amz: 'ⴰⴷⵖⴰⵔ — ⵜⴰⵔⵓⴷⴰⵏⵜ',
                en: 'Salon Address — Taroudant',
                es: 'Dirección — Taroudant',
              })}
            </div>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              {SALON_INFO.address[lang] || SALON_INFO.address.ar}
            </p>
          </div>
        </div>

        <a
          href={salonSettings.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black inline-flex items-center gap-2 transition-colors shadow-xs"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>
            {pickLang(lang, {
              ar: 'فتح الموقع على خرائط Google',
              fr: 'Ouvrir sur Google Maps',
              amz: 'ⵕⵥⵎ ⴳ Google Maps',
              en: 'Open in Google Maps',
              es: 'Abrir en Google Maps',
            })}
          </span>
          <ExternalLink className="w-3.5 h-3.5 opacity-85" />
        </a>
      </div>

      {/* Opening Hours */}
      <div className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-900/60 border border-stone-200 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
          <Clock className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          <span>
            {pickLang(lang, {
              ar: 'أوقات العمل الرسمية',
              fr: "Horaires d'ouverture",
              amz: 'ⴰⴽⵓⴷ ⵏ ⵜⵡⵓⵔⵉ',
              en: 'Opening Hours',
              es: 'Horario de apertura',
            })}
          </span>
        </div>

        <div className="divide-y divide-stone-200/80 dark:divide-zinc-800">
          {SALON_INFO.hours.map((item) => {
            const dayName =
              lang === 'ar'
                ? item.dayAr
                : lang === 'en'
                ? item.dayEn
                : lang === 'amz'
                ? item.dayAmz
                : item.dayFr;
            const noteText =
              lang === 'ar'
                ? item.noteAr
                : lang === 'en'
                ? item.noteEn
                : lang === 'amz'
                ? item.noteAmz
                : item.noteFr;
            const isClosed = item.dayEn === 'Monday';

            return (
              <div
                key={item.dayEn}
                className="py-2 flex items-center justify-between gap-2 text-xs"
              >
                <span className="font-bold text-slate-800 dark:text-zinc-200">
                  {dayName}
                </span>
                <div className="flex items-center gap-2">
                  {noteText && (
                    <span
                      className={`text-[11px] font-semibold ${
                        isClosed
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      ({noteText})
                    </span>
                  )}
                  <span
                    dir="ltr"
                    className={`font-mono font-semibold ${
                      isClosed
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    {isClosed
                      ? pickLang(lang, {
                          ar: 'مغلق',
                          fr: 'Fermé',
                          amz: 'ⵉⵇⵇⵏ',
                          en: 'Closed',
                          es: 'Cerrado',
                        })
                      : item.hours}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderPrivacy = () => {
    const points = [
      {
        title: pickLang(lang, {
          ar: 'البيانات التي يتم جمعها',
          fr: 'Données collectées',
          amz: 'ⵉⵙⴼⴽⴰ ⵉⵜⵜⵓⵙⵎⵓⵏⵏ',
          en: 'Information We Collect',
          es: 'Datos que recopilamos',
        }),
        body: pickLang(lang, {
          ar: 'نجمع فقط المعلومات الضرورية لتنظيم مواعيدك بالصالون، وهي: الاسم الكامل، رقم الهاتف المغربي، سجل الحجوزات والخدمات المختارة، ورصيد النقاط أو الديون (الكريدي) المسجلة في حسابك عند الحاجة.',
          fr: 'Nous recueillons uniquement les informations nécessaires à la gestion de vos rendez-vous : nom complet, numéro de téléphone, historique des réservations et suivi transparent des points de fidélité ou éventuels crédits en salon.',
          amz: 'ⵏⵙⵙⵓⵎⵓⵏ ⵖⴰⵙ ⵉⵙⴼⴽⴰ ⵉⵅⵚⵚⴰⵏ ⵉ ⵓⵙⵉⵀⴰⵔ: ⵉⵙⵎ, ⵓⵟⵟⵓⵏ ⵏ ⵓⵜⵉⵍⵉⴼⵓⵏ, ⴰⵎⵣⵔⵓⵢ ⵏ ⵉⵙⵉⵀⴰⵔⵏ ⴷ ⵓⵙⵎⵉⴹⵏ.',
          en: 'We collect only the details strictly required to organize your salon visits: your name, phone number, appointment history, selected services, and transparent loyalty or in-salon credit balance records.',
          es: 'Solo recopilamos los datos necesarios para gestionar tus citas: nombre, número de teléfono, historial de reservas, puntos de fidelidad o saldo pendiente en el salón.',
        }),
      },
      {
        title: pickLang(lang, {
          ar: 'الغرض الحصري من الاستخدام',
          fr: 'Usage strictement réservé au salon',
          amz: 'ⴰⵙⵎⵔⵙ ⵉ ⵜⵡⵓⵔⵉ ⵏ ⵓⵙⴰⵍⵓⵏ ⵖⴰⵙ',
          en: 'Used Solely for Salon Operations',
          es: 'Uso exclusivo para el servicio del salón',
        }),
        body: pickLang(lang, {
          ar: 'تُستخدم بياناتك حصرياً لتأكيد المواعيد، إرسال تذكيرات الحضور عبر التذكرة أو WhatsApp، تفعيل مزايا الولاء، وحفظ حقوق الزبون والصالون في المعاملات المالية.',
          fr: 'Vos données servent exclusivement à confirmer vos rendez-vous, envoyer des rappels de passage, valider votre fidélité et assurer la transparence des règlements et crédits.',
          amz: 'ⵉⵙⴼⴽⴰ ⵏⵏⴽ ⵜⵜⵓⵙⵎⵔⴰⵙⵏ ⵖⴰⵙ ⵉ ⵓⵙⵏⵜⵎ ⵏ ⵉⵙⵉⵀⴰⵔⵏ, ⵉⵙⴽⵜⵉⵜⵏ ⴷ ⵓⴹⴼⴰⵕ ⵏ ⵜⵖⵓⴷⴰ.',
          en: 'Your information is used strictly to confirm bookings, coordinate queue updates, verify loyalty visits, and maintain accurate billing/credit records inside Salon Boumlik.',
          es: 'Tus datos se utilizan únicamente para confirmar citas, enviar recordatorios, gestionar tu fidelidad y mantener un control transparente de pagos.',
        }),
      },
      {
        title: pickLang(lang, {
          ar: 'عدم البيع أو المشاركة مع أطراف ثالثة',
          fr: 'Aucune revente ni partage commercial',
          amz: 'ⵓⵔ ⵜⵜⵓⵣⵏⵣⴰⵏ ⵉⵙⴼⴽⴰ ⵉ ⵡⵉⵢⵢⴰⴹ',
          en: 'Never Sold to Third Parties',
          es: 'Nunca vendemos tus datos',
        }),
        body: pickLang(lang, {
          ar: 'نلتزم التزاماً تاماً بعدم بيع أو كراء أو مشاركة بيانات الزبناء مع أي شركات إعلانية أو جهات خارجية تحت أي ظرف، ويقتصر الاطلاع عليها على إدارة وحلاقي صالون بومليك لخدمتك.',
          fr: 'Salon Boumlik ne vend, ne loue et ne partage jamais vos informations personnelles avec des tiers à des fins commerciales ou publicitaires.',
          amz: 'ⵓⵔ ⵏⵣⵣⵏⵣⴰ, ⵓⵔ ⵏⵜⵜⵓⴽⴽⴰ ⵉⵙⴼⴽⴰ ⵏ ⵉⵎⵙⴰⵖⵏ ⵉ ⵉⵎⴰⵣⵣⴰⵍⵏ ⵏ ⵓⴱⵕⵕⴰ.',
          en: 'Salon Boumlik never sells, rents, or shares your phone number or booking history with third-party marketers or external brokers.',
          es: 'Salon Boumlik nunca vende, alquila ni comparte tus datos personales con terceros.',
        }),
      },
      {
        title: pickLang(lang, {
          ar: 'حماية البيانات وحق التعديل أو الحذف',
          fr: 'Sécurité & droits d’accès',
          amz: 'ⴰⴼⵔⴰⴳ ⴷ ⵓⵣⵔⴼ ⵏ ⵓⵙⵏⴼⵍ',
          en: 'Security & Data Requests',
          es: 'Seguridad y derechos',
        }),
        body: pickLang(lang, {
          ar: 'يتم حفظ الحجوزات بشكل آمن، كما نستخدم معرفات تقنية مجهولة للوقاية من الحجوزات الوهمية فقط. يمكنك في أي وقت مراجعة تذاكرك أو طلب تحديث أو حذف بياناتك بالتواصل المباشر مع إدارة الصالون.',
          fr: 'Les données sont stockées de manière sécurisée. Des identifiants techniques anonymisés sont utilisés uniquement contre le spam. Vous pouvez demander la modification ou suppression de vos données à tout moment.',
          amz: 'ⵉⵙⴼⴽⴰ ⵜⵜⵓⵃⴹⴰⵏ ⵙ ⵜⵖⴰⵔⴰⵙⵜ ⵜⴰⵎⴰⵜⵜⴰⵢⵜ. ⵜⵣⵎⵔⴷ ⴰⴷ ⵜⵜⵔⴷ ⴰⵙⵏⴼⵍ ⵏⵖ ⴰⴽⴽⴰⵙ ⵏ ⵉⵙⴼⴽⴰ ⵏⵏⴽ.',
          en: 'Records are stored securely, and anonymized device/IP checks are used solely to stop duplicate spam bookings. Contact Salon Boumlik anytime to update or delete your record.',
          es: 'Tus registros están protegidos y puedes solicitar la actualización o eliminación de tus datos contactando al salón en cualquier momento.',
        }),
      },
    ];

    return (
      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
            {pickLang(lang, {
              ar: 'احترام خصوصية زبنائنا في تارودانت أولوية أساسية. إليك توضيح مباشر لكيفية التعامل مع بياناتك عند الحجز.',
              fr: 'La confidentialité de nos clients à Taroudant est primordiale. Voici comment vos informations sont protégées.',
              amz: 'ⴰⴼⵔⴰⴳ ⵏ ⵜⵓⵙⵍⵉⴳⵜ ⵏ ⵉⵎⵙⴰⵖⵏ ⵏⵏⵖ ⵉⴳⴰ ⵜⴰⵣⵡⴰⵔⴰ.',
              en: 'Protecting our clients’ privacy in Taroudant is a core priority. Here is how your booking details are handled.',
              es: 'Proteger la privacidad de nuestros clientes es fundamental. Así gestionamos tus datos.',
            })}
          </p>
        </div>

        {points.map((item) => (
          <div
            key={item.title}
            className="p-4 rounded-2xl bg-white dark:bg-zinc-900/50 border border-stone-200 dark:border-zinc-800 space-y-1.5"
          >
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
              <span>{item.title}</span>
            </h4>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    );
  };

  const renderTerms = () => {
    const rules = [
      {
        title: pickLang(lang, {
          ar: 'سياسة الحجز العادل (حد أقصى حجزين نشطين)',
          fr: 'Règle anti-abus (maximum 2 réservations actives)',
          amz: 'ⵜⵉⵍⵉⵙⵜ ⵏ 2 ⵉⵙⵉⵀⴰⵔⵏ',
          en: 'Fair Booking Cap (Max 2 Active Bookings)',
          es: 'Límite justo (máx. 2 citas activas)',
        }),
        body: pickLang(lang, {
          ar: 'حرصاً على إتاحة الأوقات لجميع الزبناء ومنع الحجوزات العشوائية أو الوهمية، يُسمح لكل جهاز أو زبون بحد أقصى لا يتجاوز حجزين قادمين نشطين في نفس الوقت. وللحالات الاستثنائية أو حجز العائلة يمكن التواصل مباشرة مع إدارة الصالون.',
          fr: 'Pour garantir l’accès aux créneaux à tous nos clients et éviter les réservations abusives, chaque appareil ou client est limité à 2 rendez-vous actifs simultanés maximum.',
          amz: 'ⵉ ⵓⴼⵔⴰⴳ ⵏ ⵡⴰⴽⵓⴷ ⵉ ⵎⴰⵕⵕⴰ ⵉⵎⵙⴰⵖⵏ, ⴽⵓ ⴰⵎⵙⴰⵖ ⵉⵣⵎⵔ ⴰⴷ ⵢⴰⵎⵥ 2 ⵉⵙⵉⵀⴰⵔⵏ ⴳ ⵓⵣⵎⵣ ⵢⵉⵡⵏ.',
          en: 'To keep chairs available for genuine clients and prevent prank/spam reservations, each device or client may hold up to 2 active upcoming bookings at a time.',
          es: 'Para evitar reservas duplicadas o falsas, cada dispositivo o cliente puede tener un máximo de 2 citas activas simultáneas.',
        }),
      },
      {
        title: pickLang(lang, {
          ar: 'الالتزام بالوقت والتأخر عن الحصة',
          fr: 'Ponctualité & gestion des retards',
          amz: 'ⴰⵣⵎⵣ ⴷ ⵓⵎⴰⵟⵟⵍ',
          en: 'Punctuality & Late Arrival Handling',
          es: 'Puntualidad y retrasos',
        }),
        body: pickLang(lang, {
          ar: 'يرجى الحضور قبل الموعد بـ 5 إلى 10 دقائق. في حال التأخر، يرجى إخبار الحلاق مبكراً ليتم تأجيل موعدك إلى أقرب وقت متاح أو تحويلك للطابور دون تعطيل دور الزبناء الآخرين.',
          fr: 'Merci de vous présenter 5 à 10 minutes avant l’heure prévue. En cas de retard, prévenez le salon au plus tôt pour décaler au prochain créneau libre ou rejoindre la file d’attente.',
          amz: 'ⵜⵜⵓⵜⵔⴰ ⵜⵉⵍⵉⵏⵜ 5 ⴰⵔ 10 ⵜⵓⵙⴷⵉⴷⵉⵏ ⴷⴰⵜ ⵏ ⵓⵙⵉⵀⴰⵔ. ⵉⵖ ⵜⵎⴰⵟⵟⵍⴷ, ⵙⵏⴼⵍ ⴰⴽⵓⴷ.',
          en: 'Please arrive 5–10 minutes before your slot. If delayed, notify the salon early so your appointment can move to the nearest open slot or waitlist without holding up other guests.',
          es: 'Por favor llega 5–10 minutos antes. Si llegas tarde, avisa para reubicar tu turno al hueco disponible más cercano.',
        }),
      },
      {
        title: pickLang(lang, {
          ar: 'الإلغاء والتغيب المتكرر',
          fr: 'Annulation & absences répétées',
          amz: 'ⴰⵙⵔ ⴷ ⵜⴰⵏⵖⵓⴱⴰ',
          en: 'Cancellations & No-Show Etiquette',
          es: 'Cancelaciones y ausencias',
        }),
        body: pickLang(lang, {
          ar: 'إذا تعذر عليك الحضور، يُرجى إشعار الصالون مسبقاً لتحرير الحصة لغيرك. تسجيل تغيّبين متتاليين دون اعتذار قد يؤدي إلى تقييد الحجز الإلكتروني مؤقتاً.',
          fr: 'Si vous ne pouvez pas venir, prévenez à l’avance pour libérer le créneau. Deux absences non justifiées peuvent restreindre la réservation en ligne.',
          amz: 'ⵉⵖ ⵓⵔ ⵜⵣⵎⵉⵔⴷ ⴰⴷ ⵜⴰⵙⴷ, ⴰⵣⵏ ⴰⵍⵖⵓ ⵣⵉⴽ. ⵙⵉⵏ ⵉⵏⵖⵓⴱⴰⵏ ⵣⵎⵔⵏ ⴰⴷ ⵙⴱⴷⴷⵏ ⴰⵙⵔⵓⵙ.',
          en: 'If plans change, cancel ahead of time so another client can use the slot. Repeated unexcused no-shows may restrict future online bookings.',
          es: 'Si no puedes asistir, avisa con antelación para liberar la hora. Las ausencias repetidas pueden restringir la reserva online.',
        }),
      },
      {
        title: pickLang(lang, {
          ar: 'الخدمات والأسعار والمعاملات',
          fr: 'Services, tarifs & règlements',
          amz: 'ⵜⵉⵏⴰⴼⵓⵜⵉⵏ ⴷ ⵡⴰⵜⵉⴳⵏ',
          en: 'Men-Only Services & Transparent Pricing',
          es: 'Servicios y transparencia de precios',
        }),
        body: pickLang(lang, {
          ar: 'جميع خدمات الصالون مخصصة للرجال فقط، وتُعرض الأسعار بوضوح قبل تأكيد الحجز (بما فيها الباقات أو الأسعار الخاصة بالأيام الموسمية). الدفع يتم داخل الصالون أو عبر التحويل البنكي الموثق CIH.',
          fr: 'Le salon est exclusivement masculin. Les tarifs (y compris packs et journées spéciales) sont affichés clairement avant confirmation. Règlement sur place ou via virement CIH.',
          amz: 'ⵜⵉⵏⴰⴼⵓⵜⵉⵏ ⵉⵥⵍⵉⵏ ⵉ ⵉⵔⴳⴰⵣⵏ ⵖⴰⵙ, ⵙ ⵡⴰⵜⵉⴳⵏ ⵉⴼⴰⵡⵏ.',
          en: 'Services are exclusively for men, with clear pricing (including packs and special-day rates) displayed before confirmation. Payment is accepted in-salon or via verified CIH transfer.',
          es: 'Servicios exclusivos para hombres con precios visibles antes de confirmar.',
        }),
      },
    ];

    return (
      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 flex items-start gap-3">
          <FileText className="w-5 h-5 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
            {pickLang(lang, {
              ar: 'استخدام نظام الحجز الإلكتروني في صالون بومليك يعني الموافقة على هذه الضوابط البسيطة لضمان خدمة عادلة ومنظمة للجميع.',
              fr: "L'utilisation de la réservation en ligne Salon Boumlik implique l'acceptation de ces règles simples pour un service fluide pour tous.",
              amz: 'ⴰⵙⵎⵔⵙ ⵏ ⵓⵙⵔⵓⵙ ⴳ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⵉⵙⵙⵓⵜⵓⵔ ⴰⵣⵔⴰⴽ ⵏ ⵉⵍⵓⴳⴰⵏ ⴰⴷ.',
              en: 'Using Salon Boumlik’s online booking implies agreeing to these simple guidelines for fair, punctual service.',
              es: 'El uso de la reserva online implica aceptar estas normas para ofrecer un servicio puntual a todos.',
            })}
          </p>
        </div>

        {rules.map((rule) => (
          <div
            key={rule.title}
            className="p-4 rounded-2xl bg-white dark:bg-zinc-900/50 border border-stone-200 dark:border-zinc-800 space-y-1.5"
          >
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
              <span>{rule.title}</span>
            </h4>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              {rule.body}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {activeSection && (
          <motion.div
            key="public-info-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            dir={isRtl ? 'rtl' : 'ltr'}
            onClick={onClose}
          >
            <motion.div
              key="public-info-dialog"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#0D0F14] border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 sm:px-5 pt-3.5 pb-3 border-b border-stone-200/80 dark:border-zinc-800 bg-stone-50/90 dark:bg-[#111318] space-y-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                      {activeSection === 'about' && <Info className="w-4 h-4" />}
                      {activeSection === 'contact' && <Phone className="w-4 h-4" />}
                      {activeSection === 'privacy' && <ShieldCheck className="w-4 h-4" />}
                      {activeSection === 'terms' && <FileText className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                        {navItems.find((i) => i.id === activeSection)?.label}
                      </h2>
                      <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate">
                        Salon Boumlik • Taroudant
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={closeAria}
                    className="min-h-[38px] min-w-[38px] p-2 rounded-xl text-stone-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Clean 4-Tab Switcher */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {navItems.map((item) => {
                    const TabIcon = item.icon;
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectSection(item.id)}
                        className={`min-h-[36px] px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                          active
                            ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-black border-amber-600 dark:border-amber-400 shadow-xs'
                            : 'bg-white dark:bg-zinc-900 text-stone-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border-stone-200 dark:border-zinc-800'
                        }`}
                      >
                        <TabIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 bg-[#FAF9F6] dark:bg-[#0D0F14]">
                {activeSection === 'about' && renderAbout()}
                {activeSection === 'contact' && renderContact()}
                {activeSection === 'privacy' && renderPrivacy()}
                {activeSection === 'terms' && renderTerms()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
};
