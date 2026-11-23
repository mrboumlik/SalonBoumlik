import React, { useState } from 'react';
import { ChevronDown, HelpCircle, MapPin, CalendarCheck, Scissors, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { SALON_INFO } from '../data/barbershopData';
import { pickLang } from '../utils/i18n';
import { normalizeSalonWhatsappDigits, useSalonProfileSettings } from '../utils/salonSettingsStore';

type FaqCategory = 'all' | 'booking' | 'services' | 'policies';

interface FaqEntry {
  id: string;
  category: Exclude<FaqCategory, 'all'>;
  question: {
    ar: string;
    fr: string;
    en: string;
    amz: string;
    es: string;
  };
  answer: {
    ar: string;
    fr: string;
    en: string;
    amz: string;
    es: string;
  };
}

const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'faq-location-hours',
    category: 'policies',
    question: {
      ar: 'أين يقع صالون بومليك في تارودانت وما هي أوقات العمل؟',
      fr: 'Où se situe le Salon Boumlik à Taroudant et quels sont les horaires ?',
      en: 'Where is Salon Boumlik located in Taroudant and what are your hours?',
      amz: 'ⵎⴰⵏⵉ ⴳ ⵉⵍⵍⴰ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ ⴷ ⵉⵎⵉⵔⵏ ⵏ ⵓⵕⵥⵥⵓⵎ?',
      es: '¿Dónde está ubicado Salon Boumlik en Taroudant y cuál es su horario?',
    },
    answer: {
      ar: 'يقع الصالون في شارع بئر أنزران بتارودانت، الطابق الثاني فوق صانع الأسنان ومخبزة إتري (ITRI). نستقبلكم من الثلاثاء إلى الأحد (11:00–13:00 و 16:00–22:00)، ويوم الجمعة بعد الصلاة (15:00–22:00). يوم الإثنين عطلة أسبوعية.',
      fr: 'Nous sommes situés Rue Bir Anzarane à Taroudant, au 2ème étage au-dessus du technicien dentaire et de la boulangerie ITRI. Ouvert du mardi au dimanche (11h00–13h00 et 16h00–22h00), vendredi de 15h00 à 22h00. Fermé le lundi.',
      en: 'We are on Rue Bir Anzarane in Taroudant, 2nd floor above the Dental Technician and ITRI Bakery. Open Tuesday–Sunday (11:00–13:00 & 16:00–22:00) and Friday (15:00–22:00). Closed on Mondays.',
      amz: 'ⵏⵍⵍⴰ ⴳ ⵓⵖⴰⵔⴰⵙ ⵏ ⴱⵉⵔ ⴰⵏⵣⴰⵔⴰⵏ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ, ⴰⵙⵡⵉⵔ ⵡⵉⵙⵙ 2 ⵖⵉⴳⴼ ⵏ ⵜⴼⵔⵏⵓⵜ ⵏ ITRI. ⵏⵕⵥⵎ ⵙⴳ ⴰⵙⵉⵏⴰⵙ ⴰⵔ ⴰⵙⴰⵎⴰⵙ (11:00–13:00 ⴷ 16:00–22:00), ⵙⵉⵎⵡⴰⵙ 15:00–22:00. ⴰⵢⵏⴰⵙ ⵉⵇⵇⵏ.',
      es: 'Estamos en Rue Bir Anzarane, Taroudant, 2º piso sobre la panadería ITRI y el protésico dental. Abierto de martes a domingo (11:00–13:00 y 16:00–22:00) y viernes (15:00–22:00). Cerrado los lunes.',
    },
  },
  {
    id: 'faq-booking-flexible',
    category: 'booking',
    question: {
      ar: 'كيف يتم الحجز عبر الموقع وماذا أفعل إذا كان توقيتي المفضل محجوزاً؟',
      fr: 'Comment réserver en ligne et que faire si mon créneau préféré est pris ?',
      en: 'How does online booking work and what if my preferred time slot is busy?',
      amz: 'ⵎⴰⵎⵏⴽ ⴰ ⵙⵔⵓⵙⵖ ⴰⵙⴰⴽⵓⴷ ⴳ ⵓⵙⵉⵜ ⵉⵖ ⵉⵜⵜⵓⵟⵟⴼ ⵓⴽⵓⴷ ⵉⵏⵓ?',
      es: '¿Cómo funciona la reserva en línea y qué pasa si mi hora está ocupada?',
    },
    answer: {
      ar: 'الحجز يتم في خطوات بسيطة بدون إنشاء حساب: اختر حالتك (جديد أو زبون دائم)، الحلاق (حسن، أنور، لحسن، أو منير)، الخدمات، والوقت. إذا كانت الساعة محجوزة، يقترح النظام حلاقاً آخر متاحاً في نفس الوقت أو يتيح لك خيار "دع الحلاق يختار لي الوقت المناسب".',
      fr: 'La réservation se fait en quelques clics sans compte : indiquez si vous êtes nouveau ou client fidèle, choisissez votre barbier, vos prestations et l’horaire. Si un créneau est complet, le système propose automatiquement un autre barbier disponible ou l’option « Laisser le barbier choisir ».',
      en: 'Booking takes seconds with no account required: select First Time or Returning Client, pick your barber, services, and slot. If a slot is booked, you will see real-time openings with other barbers or can choose "Let the barber choose a suitable time".',
      amz: 'ⴰⵙⵔⵓⵙ ⵉⴼⵙⵓⵙ ⴱⵍⴰ ⴰⵎⵉⴹⴰⵏ: ⵙⵜⵢ ⴰⵎⴽⵔⴰⴹ ⵏⵏⴽ (ⵃⴰⵙⴰⵏ, ⴰⵏⵡⴰⵔ, ⵍⵃⵙⵏ, ⵏⵖ ⵎⵓⵏⵉⵔ), ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⴷ ⵓⴽⵓⴷ. ⵉⵖ ⵉⵜⵜⵓⵟⵟⴼ ⵓⴽⵓⴷ, ⵜⵥⴹⴰⵕⴷ ⴰⴷ ⵜⵙⵜⵢⴷ ⴰⵎⴽⵔⴰⴹ ⵢⴰⴹⵏ ⵏⵖ ⴰⴷ ⵜⴰⵊⵊⴷ ⴰⵎⴽⵔⴰⴹ ⴰⴷ ⵉⴼⵔⵏ.',
      es: 'Reservas en segundos sin registro: elige si eres nuevo o habitual, selecciona barbero, servicios y horario. Si una hora está ocupada, verás barberos alternativos libres o la opción de horario flexible.',
    },
  },
  {
    id: 'faq-queue-skip',
    category: 'booking',
    question: {
      ar: 'ما هي خدمة تفادي الانتظار (+10 درهم) وهل هي إجبارية؟',
      fr: 'Qu’est-ce que l’option Coupe-File (+10 MAD) et est-elle obligatoire ?',
      en: 'What is the Queue Avoidance (+10 MAD) service and is it mandatory?',
      amz: 'ⵎⴰⵜⵜⴰ ⵜⴰⵏⴰⴼⵓⵜ ⵏ ⵓⵙⵙⵉⴷⵔ ⵏ ⵓⵇⵇⵍ (+10 MAD), ⵉⵙ ⵜⴱⵣⵣⵉⵣ?',
      es: '¿Qué es la opción Sin Espera (+10 MAD) y es obligatoria?',
    },
    answer: {
      ar: 'خدمة تفادي الانتظار اختيارية تماماً وتمنحك أولوية الدخول المباشر في الموعد المحدد دون انتظار الدور، ويمكنك تفعيلها أو إلغاؤها بضغطة زر في خطوة التأكيد الأخيرة.',
      fr: 'L’option Coupe-File (+10 MAD) est entièrement facultative. Elle garantit une prise en charge prioritaire à l’heure exacte de votre créneau. Vous pouvez l’activer ou la désactiver librement à la dernière étape.',
      en: 'Queue Avoidance (+10 MAD) is completely optional and prioritizes your chair right at your scheduled time to eliminate waiting. You can toggle it on or off in the final confirmation step.',
      amz: 'ⵜⴰⵏⴰⴼⵓⵜ ⴰⴷ (+10 MAD) ⵓⵔ ⵜⴱⵣⵣⵉⵣ, ⵜⴰⴽⴽⴰ ⴰⴽ ⵜⵉⵣⵡⵓⵔⵉ ⵉ ⵓⴽⵛⵓⵎ ⵓⵙⵔⵉⴷ ⴳ ⵓⴽⵓⴷ ⵏⵏⴽ.',
      es: 'Es totalmente opcional. Garantiza atención prioritaria a tu hora exacta sin esperas y puedes activarla o desactivarla antes de confirmar.',
    },
  },
  {
    id: 'faq-cih-payment',
    category: 'policies',
    question: {
      ar: 'متى يتم الدفع؟ وهل التحويل عبر CIH Bank ضروري؟',
      fr: 'Quand règle-t-on la prestation et le virement CIH Bank est-il obligatoire ?',
      en: 'When do I pay and is CIH Bank transfer required?',
      amz: 'ⵎⵉⵍⵎⵉ ⴰ ⵏⵜⵜⵅⵍⵍⴰⵚ? ⵉⵙ ⵉⴱⵣⵣⵉⵣ ⵓⵙⵙⵉⵡⴹ ⵏ CIH Bank?',
      es: '¿Cuándo se realiza el pago y es obligatoria la transferencia CIH?',
    },
    answer: {
      ar: 'الأداء الأساسي يتم نقداً في الصالون بعد إتمام الخدمة. التحويل البنكي عبر CIH Bank ورفع صورة الإيصال خيار إضافي مستحسن لمن يرغب في تثبيت موعده مسبقاً وبأولوية فورية.',
      fr: 'Le règlement s’effectue sur place au salon après votre prestation. Le virement CIH Bank avec envoi de reçu est une option facultative recommandée pour verrouiller votre rendez-vous en priorité à l’avance.',
      en: 'Standard payment is made in person at the salon after your service. Optional CIH Bank transfer with receipt upload is recommended if you prefer instant priority pre-confirmation.',
      amz: 'ⴰⵅⵍⵍⴰⵚ ⵉⵜⵜⵉⵍⵉ ⴳ ⵙⴰⵍⵓⵏ ⴷⴼⴼⵉⵔ ⵜⵡⵓⵔⵉ. ⴰⵙⵙⵉⵡⴹ ⵏ CIH Bank ⵉⴳⴰ ⴰⵙⵜⴰⵢ ⵉⴼⵓⵍⴽⵉⵏ ⵉ ⵓⵙⵙⴷⵓ ⴰⵣⵔⴰⴱ.',
      es: 'El pago se realiza en el salón tras el servicio. La transferencia por CIH Bank es opcional y ayuda a confirmar tu cita con prioridad.',
    },
  },
  {
    id: 'faq-combos-pricing',
    category: 'services',
    question: {
      ar: 'ما هي العروض والتخفيضات المتوفرة على الباقات والعناية بالشعر؟',
      fr: 'Quels forfaits et remises automatiques proposez-vous sur vos prestations ?',
      en: 'What service combos and automatic discounts do you offer?',
      amz: 'ⵎⴰⵜⵜⴰ ⵜⵉⵙⵎⵖⵓⵔⵉⵏ ⴷ ⵉⵙⵉⴷⵔⵏ ⵉⵍⵍⴰⵏ ⴳ ⵜⵡⵓⵔⵉⵡⵉⵏ?',
      es: '¿Qué paquetes y descuentos automáticos ofrecen?',
    },
    answer: {
      ar: 'يطبق الموقع التخفيضات تلقائياً: باقة حسانة + لحية بـ 35 درهم بدل 40 درهم، حسانة مجانية (0 درهم) عند اختيار البروتين/الكيراتين، تخفيض الحسانة إلى 15 درهم مع الترطيبة أو الصباغة الرمادية/البيضاء، وتخفيض غسيل الشعر والشمع والبروشينغ عند إضافتها مع الحسانة.',
      fr: 'Le calculateur applique les remises automatiquement : Coupe + Barbe à 35 MAD au lieu de 40 MAD, Coupe OFFERTE avec le soin Protéine/Kératine, Coupe à 15 MAD avec Défrisage ou Coloration Grise/Blanche, et tarifs réduits sur le shampoing, la cire et le brushing.',
      en: 'Discounts apply automatically: Haircut + Beard combo is 35 MAD (instead of 40 MAD), Haircut is FREE with Protein/Keratin treatment, Haircut drops to 15 MAD with Straightening or Grey/White color, and Hair Wash/Wax/Blowout receive 5 MAD off with a haircut.',
      amz: 'ⵉⵙⵉⴷⵔⵏ ⵜⵜⵓⴳⴳⴰⵏ ⵙ ⵜⵓⵎⴰⵏⵜ: ⵜⴰⴽⵔⴹⴰ + ⵜⴰⵎⴰⵔⵜ ⵙ 35 MAD, ⵜⴰⴽⵔⴹⴰ ⴼⴰⴱⵓⵔ ⴷ ⵓⴱⵔⵓⵜⵉⵏ, ⵜⴰⴽⵔⴹⴰ ⵙ 15 MAD ⴷ ⵓⵙⵎⵙⴰⵙ ⵏⵖ ⴰⴽⵍⵓ ⴰⵎⵍⵍⴰⵍ.',
      es: 'Los descuentos se aplican automáticamente: combo Corte + Barba por 35 MAD, Corte GRATIS con tratamiento de Proteína/Queratina, y descuentos en lavado, cera y peinado.',
    },
  },
  {
    id: 'faq-loyalty',
    category: 'policies',
    question: {
      ar: 'كيف يعمل برنامج نقاط الولاء والمكافآت للزبناء الدائمين؟',
      fr: 'Comment fonctionne le programme de fidélité et le cumul de points ?',
      en: 'How does the Salon Boumlik Loyalty Program work?',
      amz: 'ⵎⴰⵎⵏⴽ ⴰ ⵉⵙⵡⵓⵔⵉ ⵓⵖⴰⵡⴰⵙ ⵏ ⵜⵏⴼⵍⵓⵙⵜ ⴷ ⵉⵏⵇⵉⵟⵏ?',
      es: '¿Cómo funciona el programa de fidelidad y puntos?',
    },
    answer: {
      ar: 'تحصل على 10 نقاط ولاء عن كل زيارة مؤكدة بالحضور في الصالون، إضافة إلى مكافآت مجانية كل 5 زيارات (غسل شعر مجاني، خصومات وتقشير، ثم حلاقة ولحية VIP مجانية). يمكنك تتبع تقدمك واستبدال نقاطك بخصومات (-10، -30، أو -70 درهم) أثناء الحجز أو عبر «تتبع التذكرة».',
      fr: 'Chaque visite honorée et validée au salon vous rapporte +10 points fidélité ainsi qu’un palier cadeau toutes les 5 visites (shampoing offert, remise -20 MAD + soin visage, puis coupe + barbe VIP offerte). Échangez vos points directement à la réservation ou via « Suivi Ticket ».',
      en: 'Every attended visit verified by the salon earns +10 loyalty points plus free milestone rewards every 5 visits (free wash, 20 MAD off + facial, then free VIP haircut & beard). Track and redeem points during booking or inside Track Ticket.',
      amz: 'ⴽⵓ ⵜⵉⵔⵣⵉ ⵉⵜⵜⵓⵙⵙⴷⴰⵏ ⵜⴰⴽⴽⴰ +10 ⵏ ⵉⵏⵇⵉⵟⵏ ⴷ ⵜⵙⵎⵖⵓⵔⵜ ⴽⵓ 5 ⵏ ⵜⵉⵔⵣⴰ.',
      es: 'Cada visita verificada suma +10 puntos y desbloquea premios cada 5 visitas (lavado gratis, descuento facial y corte + barba VIP gratis).',
    },
  },
  {
    id: 'faq-cancellation-mens',
    category: 'policies',
    question: {
      ar: 'ما هي سياسة الإلغاء، التعديل، والخدمات المخصصة للرجال؟',
      fr: 'Quelle est la politique d’annulation et d’accès réservé aux hommes ?',
      en: 'What is your cancellation policy and Men’s Services Only rule?',
      amz: 'ⵎⴰⵜⵜⴰ ⵜⴰⵙⵔⵜⵉⵜ ⵏ ⵓⵙⵙⵓⴼⵖ ⵏ ⵓⵙⵔⵓⵙ ⴷ ⵜⵏⴰⴼⵓⵜⵉⵏ ⵏ ⵉⵔⴳⴰⵣⵏ?',
      es: '¿Cuál es la política de cancelación y de servicio exclusivo masculino?',
    },
    answer: {
      ar: 'صالون بومليك مخصص للرجال فقط لضمان أقصى درجات الراحة والخصوصية. إذا تعذر عليك الحضور، يرجى إلغاء أو تعديل موعدك عبر «تتبع التذكرة» أو الواتساب قبل ساعة على الأقل لإتاحة الفرصة لزبناء آخرين في تارودانت.',
      fr: 'Le Salon Boumlik est exclusivement réservé aux hommes. En cas d’empêchement, merci d’annuler ou prévenir via « Suivi Ticket » ou WhatsApp au moins 1 heure avant l’horaire afin de libérer le fauteuil pour d’autres clients à Taroudant.',
      en: 'Salon Boumlik provides Men’s Services Only. If your plans change, please cancel or reschedule via Track Ticket or WhatsApp at least 1 hour ahead so another Taroudant client can book the slot.',
      amz: 'ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⵉⵥⵍⵉ ⵉ ⵉⵔⴳⴰⵣⵏ ⵖⴰⵙ. ⵉⵖ ⵓⵔ ⵜⵥⴹⵉⵕⴷ ⴰⴷ ⵜⴰⵙⴷ, ⵙⵙⵓⴼⵖ ⴰⵙⵔⵓⵙ ⵏⵏⴽ ⵙ « Suivi Ticket » ⵏⵖ ⵡⴰⵜⵙⴰⴱ 1 ⵜⵙⵔⴰⴳⵜ ⴷⴰⵜ.',
      es: 'Salon Boumlik ofrece servicios exclusivamente masculinos. Si no puedes asistir, cancela o reprograma al menos 1 hora antes mediante Seguimiento o WhatsApp.',
    },
  },
];

export const FAQSection: React.FC = () => {
  const { lang } = useLanguage();
  const salonSettings = useSalonProfileSettings();
  const [activeCategory, setActiveCategory] = useState<FaqCategory>('all');
  const [openId, setOpenId] = useState<string | null>(FAQ_ENTRIES[0].id);

  const visibleEntries = FAQ_ENTRIES.filter((entry) =>
    activeCategory === 'all' ? true : entry.category === activeCategory
  );

  const categories: { id: FaqCategory; label: string }[] = [
    {
      id: 'all',
      label:
        lang === 'ar'
          ? 'الكل'
          : lang === 'amz'
          ? 'ⴰⴽⴽⵯ'
          : lang === 'en'
          ? 'All'
          : lang === 'es'
          ? 'Todo'
          : 'Tout',
    },
    {
      id: 'booking',
      label:
        lang === 'ar'
          ? 'الحجز والمواعيد'
          : lang === 'amz'
          ? 'ⴰⵙⵔⵓⵙ'
          : lang === 'en'
          ? 'Booking'
          : lang === 'es'
          ? 'Reservas'
          : 'Réservation',
    },
    {
      id: 'services',
      label:
        lang === 'ar'
          ? 'الخدمات والأسعار'
          : lang === 'amz'
          ? 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ'
          : lang === 'en'
          ? 'Services & Prices'
          : lang === 'es'
          ? 'Servicios'
          : 'Services & Tarifs',
    },
    {
      id: 'policies',
      label:
        lang === 'ar'
          ? 'تارودانت والسياسات'
          : lang === 'amz'
          ? 'ⵜⴰⵔⵓⴷⴰⵏⵜ ⴷ ⵉⵍⵓⴳⴰⵏ'
          : lang === 'en'
          ? 'Taroudant & Policies'
          : lang === 'es'
          ? 'Políticas'
          : 'Taroudant & Règles',
    },
  ];

  const sectionUi = {
    kicker: {
      ar: 'الأسئلة الشائعة · تارودانت',
      fr: 'Questions Fréquentes · Taroudant',
      en: 'Frequently Asked Questions · Taroudant',
      amz: 'ⵉⵙⵇⵙⵉⵜⵏ ⵉⵜⵜⵓⵙⵇⵙⴰⵏ · ⵜⴰⵔⵓⴷⴰⵏⵜ',
      es: 'Preguntas Frecuentes · Taroudant',
    }[lang] || 'FAQ · Taroudant',
    title: {
      ar: 'كل ما تحتاج معرفته قبل زيارتك',
      fr: 'Réponses à Vos Questions',
      en: 'Answers Before Your Visit',
      amz: 'ⵉⵔⴰⵔⵏ ⵖⴼ ⵉⵙⵇⵙⵉⵜⵏ ⵏⵏⴽ',
      es: 'Respuestas a Tus Dudas',
    }[lang] || 'Réponses à Vos Questions',
    subtitle: {
      ar: 'معلومات دقيقة حول الحجز الفوري، الأسعار، الموقع بشارع بئر أنزران، وسياسات صالون بومليك.',
      fr: 'Tout savoir sur la réservation en ligne, les forfaits, l’accès Rue Bir Anzarane et nos règles.',
      en: 'Clear answers about booking, pricing combos, Rue Bir Anzarane access, and salon policies.',
      amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵖⴼ ⵓⵙⵔⵓⵙ, ⴰⵜⵉⴳ, ⴰⴷⵖⴰⵔ ⴳ ⴱⵉⵔ ⴰⵏⵣⴰⵔⴰⵏ ⴷ ⵉⵍⵓⴳⴰⵏ ⵏ ⵙⴰⵍⵓⵏ.',
      es: 'Todo sobre reservas, precios, ubicación en Rue Bir Anzarane y políticas del salón.',
    }[lang] || 'Informations pratiques à Taroudant.',
    ctaText: {
      ar: 'لديك سؤال إضافي؟ تواصل معنا مباشرة',
      fr: 'Une autre question ? Écrivez-nous sur WhatsApp',
      en: 'Still have a question? Message us directly',
      amz: 'ⵖⵓⵔⴽ ⴰⵙⵇⵙⵉ ⵢⴰⴹⵏ? ⴰⵣⵏ ⴰⵖ ⴳ ⵡⴰⵜⵙⴰⴱ',
      es: '¿Otra consulta? Escríbenos por WhatsApp',
    }[lang] || 'Message WhatsApp',
  };

  return (
    <section
      id="faq"
      className="py-16 sm:py-20 bg-white dark:bg-[#08090C] text-slate-900 dark:text-white border-t border-slate-200 dark:border-zinc-900 transition-colors"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2.5">
          <div className="inline-flex items-center justify-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
            <HelpCircle className="w-4 h-4" />
            <span>{sectionUi.kicker}</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white font-display">
            {sectionUi.title}
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            {sectionUi.subtitle}
          </p>
        </div>

        {/* Interactive Category Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 max-w-fit mx-auto">
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  const firstMatch = FAQ_ENTRIES.find((e) =>
                    cat.id === 'all' ? true : e.category === cat.id
                  );
                  if (firstMatch) setOpenId(firstMatch.id);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-amber-300 shadow-xs ring-1 ring-slate-200 dark:ring-zinc-700'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Compact Accordion List */}
        <div className="divide-y divide-slate-200 dark:divide-zinc-800/90 rounded-3xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/90 overflow-hidden shadow-lg dark:shadow-2xl">
          {visibleEntries.map((item) => {
            const isExpanded = openId === item.id;
            const qText = item.question[lang] || item.question.fr;
            const aText = item.answer[lang] || item.answer.fr;
            const panelId = `faq-panel-${item.id}`;

            return (
              <div key={item.id} className="transition-colors">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => setOpenId(isExpanded ? null : item.id)}
                  className="w-full min-h-[56px] px-5 sm:px-6 py-4 flex items-center justify-between gap-4 text-start hover:bg-slate-100/80 dark:hover:bg-zinc-900/60 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
                >
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {qText}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                      isExpanded
                        ? 'rotate-180 text-amber-600 dark:text-amber-400'
                        : 'text-slate-400 dark:text-zinc-500'
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div
                    id={panelId}
                    className="px-5 sm:px-6 pb-5 pt-0.5 text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed"
                  >
                    {aText}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Footer Bar inside FAQ */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 px-1 text-xs text-slate-600 dark:text-zinc-400">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span>{SALON_INFO.city[lang] || 'Taroudant'}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <CalendarCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>
                {pickLang(lang, {
                  ar: 'حجز فوري 6/7',
                  fr: 'Réservation 6j/7',
                  amz: 'ⴰⵙⵔⵓⵙ 6/7',
                  en: 'Instant Booking 6/7',
                  es: 'Reserva rápida 6/7',
                })}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Scissors className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span>
                {pickLang(lang, {
                  ar: 'للرجال فقط',
                  fr: 'Hommes Uniquement',
                  amz: 'ⵉⵔⴳⴰⵣⵏ ⵖⴰⵙ',
                  en: "Men's Only",
                  es: 'Solo Hombres',
                })}
              </span>
            </span>
          </div>

          <a
            href={`https://wa.me/${normalizeSalonWhatsappDigits(salonSettings.salonWhatsapp)}?text=${encodeURIComponent(
              pickLang(lang, {
                ar: 'مرحباً صالون بومليك، لدي سؤال حول الخدمات والحجز في تارودانت:',
                fr: 'Bonjour Salon Boumlik, j’ai une question concernant vos prestations à Taroudant :',
                amz: 'ⴰⵣⵓⵍ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ, ⵖⵓⵔⵉ ⴰⵙⵇⵙⵉ ⵖⴼ ⵜⵡⵓⵔⵉⵡⵉⵏ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ :',
                en: 'Hello Salon Boumlik, I have a question about your services and booking in Taroudant:',
                es: 'Hola Salon Boumlik, tengo una consulta sobre vuestros servicios y reservas en Taroudant:',
              })
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{sectionUi.ctaText}</span>
          </a>
        </div>
      </div>
    </section>
  );
};
