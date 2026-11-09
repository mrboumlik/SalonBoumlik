import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Scissors, 
  CheckCircle2, 
  MessageCircle, 
  Ticket, 
  AlertCircle, 
  Sparkles, 
  Copy,
  ChevronDown,
  Printer,
  Zap,
  Coffee,
  Check,
  CheckSquare,
  Square,
  Pencil
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../context/LanguageContext';
import { TEAM_MEMBERS, SALON_INFO } from '../data/barbershopData';
import { createNewBooking } from '../utils/bookingStore';
import { PricingEngineResult, AppointmentBooking, DrinkPreference } from '../types';
import { BASE_SERVICES } from '../utils/pricingEngine';

interface BookingSectionProps {
  pricingResult: PricingEngineResult;
  selectedBarberId: string;
  onSelectBarberId: (barberId: string) => void;
  selectedServiceIds: string[];
  onToggleServiceId: (serviceId: string) => void;
  onBookingConfirmed?: (booking: AppointmentBooking) => void;
  onOpenTrackBooking?: (ticket: string) => void;
}

export const BookingSection: React.FC<BookingSectionProps> = ({
  pricingResult,
  selectedBarberId,
  onSelectBarberId,
  selectedServiceIds,
  onToggleServiceId,
  onBookingConfirmed,
  onOpenTrackBooking,
}) => {
  const { lang, t, isRtl } = useLanguage();

  // Form fields
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('16:00');
  const [notes, setNotes] = useState('');
  const [drinkPreference, setDrinkPreference] = useState<DrinkPreference>('tea');
  const [includeWaitingSkip, setIncludeWaitingSkip] = useState<boolean>(true);

  // Ticket modal state
  const [createdBooking, setCreatedBooking] = useState<AppointmentBooking | null>(null);
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [formError, setFormError] = useState('');

  // Available Time Slots
  const timeSlots = [
    '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30',
    '21:00', '21:30'
  ];

  const selectedBarber = TEAM_MEMBERS.find((b) => b.id === selectedBarberId) || TEAM_MEMBERS[0];
  const barberNameLocalized = selectedBarber.name[lang] || selectedBarber.name.fr;

  // Calculate total with priority queue (+10 MAD if checked)
  const waitingSkipFee = includeWaitingSkip ? 10 : 0;
  const grandTotal = pricingResult.finalTotal + waitingSkipFee;

  const validateForm = () => {
    if (!clientName.trim()) {
      setFormError(
        lang === 'ar' ? 'يرجى إدخال اسمك الكريم' :
        lang === 'amz' ? 'ⵙⵙⴽⵛⵎ ⵉⵙⵎ ⵏⵏⴽ ⵉⵖⵓⴷⴰⵏ' :
        'Veuillez saisir votre nom complet.'
      );
      return false;
    }
    const digits = clientPhone.replace(/\D/g, '');
    if (digits.length < 9) {
      setFormError(
        lang === 'ar' ? 'يرجى إدخال رقم هاتف مغربي صحيح (مثال: 06...)' :
        lang === 'amz' ? 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⵉⵖⵓⴷⴰⵏ' :
        'Numéro de téléphone marocain invalide (ex: 06...)'
      );
      return false;
    }
    if (selectedServiceIds.length === 0) {
      setFormError(
        lang === 'ar' ? 'يرجى اختيار خدمة واحدة على الأقل من القائمة أدناه' :
        lang === 'amz' ? 'ⴼⵔⵏ ⵎⵇⵇⴰⵔ ⴷ ⵢⴰⵜ ⵜⵡⵓⵔⵉ' :
        'Veuillez sélectionner au moins un soin dans la liste ci-dessous.'
      );
      return false;
    }
    setFormError('');
    return true;
  };

  const getDrinkName = (drink: DrinkPreference) => {
    if (drink === 'coffee') {
      return lang === 'ar' ? '☕ قهوة' : lang === 'amz' ? '☕ ⵇⴰⵀⵡⴰ' : '☕ Café';
    }
    if (drink === 'tea') {
      return lang === 'ar' ? '🌿 أتاي فقط' : lang === 'amz' ? '🌿 ⴰⵜⴰⵢ ⵖⴰⵙ' : '🌿 Thé Marocain';
    }
    return lang === 'ar' ? 'بدون' : lang === 'amz' ? 'ⵓⵔ ⵔⵉⵖ' : 'Rien / Aucun';
  };

  // 1. Confirm on Site Handler
  const handleConfirmOnSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const newBooking = createNewBooking({
      services: [],
      cartItemsSummary: pricingResult.items,
      barberId: selectedBarber.id,
      barberName: barberNameLocalized,
      date,
      timeSlot,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      drinkPreference,
      notes: [
        notes.trim(),
        includeWaitingSkip ? (lang === 'ar' ? 'خدمة تفادي الانتظار (+10 دراهم)' : 'Service Coupe-File (+10 MAD)') : ''
      ].filter(Boolean).join(' | '),
      originalTotalMAD: pricingResult.originalSubtotal + waitingSkipFee,
      finalTotalMAD: grandTotal,
      totalSavingsMAD: pricingResult.totalSavings,
      bookingMethod: 'site',
      status: 'pending',
    });

    try {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#eab308', '#ef4444', '#ffffff', '#2563eb'],
      });
    } catch {
      // ignore
    }

    setCreatedBooking(newBooking);
    if (onBookingConfirmed) onBookingConfirmed(newBooking);
  };

  // 2. Book via WhatsApp Handler
  const handleBookViaWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const servicesListText = pricingResult.items
      .map((i) => `• ${i.name} (${i.finalPrice} MAD)`)
      .join('\n');

    const msg = [
      `💈 *RÉSERVATION & DEVIS SALON BOUMLIK* 💈`,
      `👤 *Client:* ${clientName.trim()}`,
      `📱 *Téléphone:* ${clientPhone.trim()}`,
      `✂️ *Barbier choisi:* ${barberNameLocalized}`,
      `☕ *Boisson offerte:* ${getDrinkName(drinkPreference)}`,
      `📅 *Date:* ${date}`,
      `⏰ *Heure:* ${timeSlot}`,
      `-----------------------`,
      `📋 *Services sélectionnés:*`,
      servicesListText,
      includeWaitingSkip ? `⚡ *Service Coupe-File (Anti-attente):* +10 MAD` : '',
      `-----------------------`,
      pricingResult.totalSavings > 0 ? `🎁 *Économie réalisée:* -${pricingResult.totalSavings} MAD` : '',
      `💰 *Total à payer:* *${grandTotal} MAD*`,
      notes.trim() ? `📝 *Note:* ${notes.trim()}` : '',
      `\n📍 Salon Boumlik, 2ème Étage, Rue Bir Anzarane, Taroudant`,
      `📞 Contact direct: 06 35 39 25 03`,
    ]
      .filter(Boolean)
      .join('\n');

    const booking = createNewBooking({
      services: [],
      cartItemsSummary: pricingResult.items,
      barberId: selectedBarber.id,
      barberName: barberNameLocalized,
      date,
      timeSlot,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      drinkPreference,
      notes: [
        notes.trim(),
        includeWaitingSkip ? (lang === 'ar' ? 'خدمة تفادي الانتظار (+10 دراهم)' : 'Service Coupe-File (+10 MAD)') : ''
      ].filter(Boolean).join(' | '),
      originalTotalMAD: pricingResult.originalSubtotal + waitingSkipFee,
      finalTotalMAD: grandTotal,
      totalSavingsMAD: pricingResult.totalSavings,
      bookingMethod: 'whatsapp',
      status: 'pending',
    });

    if (onBookingConfirmed) onBookingConfirmed(booking);

    const waUrl = `https://wa.me/${SALON_INFO.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyTicket = (ticket: string) => {
    navigator.clipboard.writeText(ticket);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
  };

  // Localized UI Texts
  const ui = {
    title: {
      ar: 'طلب موعد وتسعيرة واتساب',
      fr: 'Demande de Rendez-vous & Devis WhatsApp',
      en: 'Appointment Request & WhatsApp Quote',
      amz: 'ⴰⵙⵓⵜⵔ ⵏ ⵓⵙⵔⵓⵙ ⴷ ⵡⴰⵜⵉⴳ ⴳ ⵡⴰⵜⵙⴰⴱ',
      es: 'Solicitud de Cita y Presupuesto WhatsApp',
    }[lang] || 'طلب موعد وتسعيرة واتساب',
    subtitle: {
      ar: 'حدد الخدمات المطلوبة واختر الحلاق المفضل ومشروبك، سيقوم حسن بمراجعة طلبك وإرسال التذكرة مباشرة عبر الواتساب.',
      fr: 'Choisissez vos prestations, votre barbier attitré et votre boisson. Hassan valide votre demande et vous transmet votre ticket directement.',
      en: 'Select your services, preferred barber, and complimentary drink. Hassan reviews your request and sends your confirmation directly.',
      amz: 'ⴼⵔⵏ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⴷ ⵓⵎⴽⵔⴰⴹ ⵏⵏⴽ ⴷ ⵓⵙⵙⵡⵉ. ⵃⴰⵙⴰⵏ ⵔⴰⴷ ⵉⵙⵙⴷⵓ ⴰⵙⵔⵓⵙ ⵏⵏⴽ.',
      es: 'Elige tus servicios, barbero preferido y bebida. Hassan revisará tu solicitud y enviará tu ticket directamente.',
    }[lang] || 'حدد الخدمات المطلوبة واختر الحلاق المفضل ومشروبك.',
    waitingTitle: {
      ar: 'خدمة تفادي الانتظار (+10 دراهم)',
      fr: 'Service Coupe-File / Anti-attente (+10 MAD)',
      en: 'Zero-Wait Priority Queue (+10 MAD)',
      amz: 'ⵜⴰⵏⴰⴼⵓⵜ ⵏ ⵓⵙⵙⵉⴷⵔ ⵏ ⵓⵇⵇⵍ (+10 ⴷⵔⵀⵎ)',
      es: 'Servicio Sin Espera Prioritario (+10 MAD)',
    }[lang] || 'خدمة تفادي الانتظار (+10 دراهم)',
    waitingDesc: {
      ar: 'تُضاف 10 دراهم إلى تسعيرة الحلاقة عند حجز موعد محدد مسبقاً لتفادي الانتظار داخل الصالون، حيث يتم الاتصال بالزبون مباشرة فور اقتراب دوره.',
      fr: '10 MAD sont ajoutés au tarif de la coupe pour garantir un créneau prioritaire sans attente au salon. Le salon vous appelle dès que votre fauteuil est prêt.',
      en: '10 MAD is added to ensure priority seating without in-salon waiting. You are notified immediately as your chair becomes available.',
      amz: 'ⵜⵜⵓⵔⵏⵓⵏ 10 ⴷⵔⵀⵎ ⵉ ⵡⴰⵜⵉⴳ ⵏ ⵜⴽⵔⴹⴰ ⴰⴼⴰⴷ ⴰⴷ ⵓⵔ ⵜⵇⵇⵍⴷ ⴳ ⵓⵙⴰⵍⵓⵏ, ⴰⵔ ⴽ ⵏⵜⵜⵉⵍⵉⴼⵓⵏ ⴰⴷ ⵜⴷⴷⵓⴷ.',
      es: 'Se añaden 10 MAD para garantizar turno prioritario sin esperas en el salón. Te avisamos directamente cuando tu turno esté listo.',
    }[lang] || 'تُضاف 10 دراهم إلى تسعيرة الحلاقة عند حجز موعد مسبقاً لتفادي الانتظار.',
    step1: {
      ar: `1. اختر الخدمات التي ترغب بها (${selectedServiceIds.length})`,
      fr: `1. Choisissez vos prestations (${selectedServiceIds.length})`,
      en: `1. Select Your Services (${selectedServiceIds.length})`,
      amz: `1. ⴼⵔⵏ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⴽ (${selectedServiceIds.length})`,
      es: `1. Elige los servicios (${selectedServiceIds.length})`,
    }[lang] || '1. اختر الخدمات',
    step2: {
      ar: '2. اختر الحلاق المفضل *',
      fr: '2. Choisissez votre barbier favori *',
      en: '2. Choose your preferred barber *',
      amz: '2. ⴼⵔⵏ ⴰⵎⴽⵔⴰⴹ ⵏⵏⴽ ⵉⵥⵍⵉⵏ *',
      es: '2. Elige tu barbero preferido *',
    }[lang] || '2. اختر الحلاق المفضل *',
    step3: {
      ar: '3. اختيار المشروب أثناء الانتظار',
      fr: '3. Boisson offerte pendant votre visite',
      en: '3. Complimentary drink during your visit',
      amz: '3. ⴰⵙⵜⴰⵢ ⵏ ⵓⵙⵙⵡⵉ ⴼⴰⴱⵓⵕ',
      es: '3. Bebida de cortesía durante la espera',
    }[lang] || '3. اختيار المشروب أثناء الانتظار',
    step4: {
      ar: '4. تاريخ الموعد والتوقيت والمعلومات',
      fr: '4. Date, horaire & coordonnées',
      en: '4. Date, time slot & details',
      amz: '4. ⴰⵙⴰⴽⵓⴷ ⴷ ⵓⴽⵓⴷ ⴷ ⵉⵏⵖⵎⵉⵙⵏ',
      es: '4. Fecha, hora y contacto',
    }[lang] || '4. تاريخ الموعد',
    btnWhatsApp: {
      ar: 'إرسال تفاصيل الحجز عبر واتساب',
      fr: 'Envoyer la demande via WhatsApp',
      en: 'Send Booking via WhatsApp',
      amz: 'ⴰⵣⵏ ⴰⵙⵔⵓⵙ ⴳ ⵡⴰⵜⵙⴰⴱ',
      es: 'Enviar reserva por WhatsApp',
    }[lang] || 'إرسال عبر واتساب',
    btnSite: {
      ar: 'تأكيد الحجز مباشرة في الموقع والحصول على التذكرة',
      fr: 'Confirmer sur le site et obtenir le ticket',
      en: 'Confirm on Site & Get Ticket',
      amz: 'ⵙⵙⴷⵓ ⴳ ⵓⵙⵉⵜ ⴷ ⵜⵉⴽⵉ',
      es: 'Confirmar en la web y obtener ticket',
    }[lang] || 'تأكيد الحجز على الموقع',
    roleOwner: {
      ar: 'المالك وخبير الحلاقة',
      fr: 'Propriétaire & Maître Barbier',
      en: 'Owner & Master Barber',
      amz: 'ⴰⵎⵙⴱⴷⴰⴷ',
      es: 'Propietario y Maestro Barbero',
    }[lang] || 'المالك',
    roleBarber: {
      ar: 'حلاق محترف',
      fr: 'Barbier Professionnel',
      en: 'Pro Barber',
      amz: 'ⴰⵎⴽⵔⴰⴹ',
      es: 'Barbero Pro',
    }[lang] || 'حلاق',
  };

  return (
    <section id="booking" className="py-12 sm:py-20 bg-[#090A0E] text-white relative border-b border-zinc-800">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] bg-amber-500/5 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[300px] bg-red-600/5 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Main Card Shell - Perfectly matching screenshot styling */}
        <div className="rounded-3xl bg-[#0D0F14] border border-amber-500/30 p-5 sm:p-8 shadow-2xl space-y-7">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {ui.title}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-xl mx-auto">
              {ui.subtitle}
            </p>
          </div>

          {/* Priority Waiting Skip Box (Gold callout as shown in screenshot) */}
          <div 
            onClick={() => setIncludeWaitingSkip(!includeWaitingSkip)}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer select-none ${
              includeWaitingSkip 
                ? 'bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-500/10' 
                : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-xl bg-amber-500/20 text-amber-400 flex-shrink-0">
                <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-amber-400 flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>{ui.waitingTitle}</span>
                  </h3>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${includeWaitingSkip ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {includeWaitingSkip ? (lang === 'ar' ? 'مفعّلة' : 'Active') : (lang === 'ar' ? 'معطّلة' : 'Désactivée')}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-300 mt-1.5 leading-relaxed">
                  {ui.waitingDesc}
                </p>
              </div>
            </div>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* STEP 1: Select Services (Compact rows matching screenshot) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-200">
              <span className="flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-amber-400" />
                <span>{ui.step1}</span>
              </span>
              <span className="text-[11px] text-amber-400 font-normal">
                {pricingResult.totalSavings > 0 && `(وفرت ${pricingResult.totalSavings} دراهم)`}
              </span>
            </div>

            <div className="space-y-2">
              {BASE_SERVICES.map((srv) => {
                const isSelected = selectedServiceIds.includes(srv.id);
                const srvName = srv.name[lang] || srv.name.ar;

                return (
                  <div
                    key={srv.id}
                    onClick={() => onToggleServiceId(srv.id)}
                    className={`px-4 py-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/70 shadow-sm'
                        : 'bg-[#12141B] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-white block truncate">
                        {srvName}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        ~{srv.durationMinutes} min
                      </span>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        ({srv.basePrice} MAD)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-amber-500 text-black shadow'
                            : 'border border-zinc-700 bg-zinc-900 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Choose Preferred Barber (Summary Bar + 2x2 Grid) */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-400" />
              <span>{ui.step2}</span>
            </label>

            {/* Current Barber Summary Bar */}
            <div className="px-4 py-3 rounded-xl bg-[#12141B] border border-zinc-800 flex items-center justify-between text-xs text-zinc-200">
              <span className="font-bold text-white">
                {barberNameLocalized} {selectedBarber.isOwner && `— (${ui.roleOwner})`}
              </span>
              <Pencil className="w-3.5 h-3.5 text-zinc-500" />
            </div>

            {/* 2x2 Grid of Barber Pills (Exactly as shown in screenshot) */}
            <div className="grid grid-cols-2 gap-2.5">
              {TEAM_MEMBERS.map((barber) => {
                const isSelected = selectedBarberId === barber.id;
                const bName = barber.name[lang] || barber.name.ar;

                return (
                  <button
                    key={barber.id}
                    type="button"
                    onClick={() => onSelectBarberId(barber.id)}
                    className={`p-2.5 sm:p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500'
                        : 'bg-[#12141B] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <img 
                      src={barber.avatar} 
                      alt={bName} 
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover bg-zinc-800 flex-shrink-0 ring-2 ring-zinc-700/80"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-white text-xs sm:text-sm block truncate">
                        {bName}
                      </span>
                      <span className="text-[10px] sm:text-[11px] font-semibold text-amber-400 block truncate">
                        {barber.isOwner ? (lang === 'ar' ? 'المالك' : 'Fondateur') : (lang === 'ar' ? 'حلاق' : 'Barbier')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: Drink Preference (3 horizontal buttons) */}
          <div className="space-y-2.5 pt-2">
            <label className="block text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>{ui.step3}</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDrinkPreference('tea')}
                className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  drinkPreference === 'tea'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                    : 'bg-[#12141B] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <span>🌿</span>
                <span>{lang === 'ar' ? 'أتاي فقط' : lang === 'amz' ? 'ⴰⵜⴰⵢ ⵖⴰⵙ' : 'Thé'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDrinkPreference('coffee')}
                className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  drinkPreference === 'coffee'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                    : 'bg-[#12141B] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <span>☕</span>
                <span>{lang === 'ar' ? 'قهوة' : lang === 'amz' ? 'ⵇⴰⵀⵡⴰ' : 'Café'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDrinkPreference('none')}
                className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  drinkPreference === 'none'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                    : 'bg-[#12141B] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <span>🚫</span>
                <span>{lang === 'ar' ? 'بدون' : lang === 'amz' ? 'ⵓⵔ ⵔⵉⵖ' : 'Rien'}</span>
              </button>
            </div>
          </div>

          {/* STEP 4: Date, Time & Client Info (strictly Name & Phone, NO email) */}
          <div className="space-y-4 pt-2">
            <label className="block text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>{ui.step4}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  {lang === 'ar' ? 'تاريخ الموعد' : 'Date du rendez-vous'}
                </label>
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-[#12141B] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  {lang === 'ar' ? 'التوقيت المفضل' : 'Heure préférée'}
                </label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full bg-[#12141B] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                >
                  {timeSlots.map((ts) => (
                    <option key={ts} value={ts}>
                      {ts}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-400" />
                  <span>{lang === 'ar' ? 'الاسم الكامل *' : 'Nom complet *'}</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: يوسف الإدريسي' : 'Ex: Youssef El Idrissi'}
                  required
                  className="w-full bg-[#12141B] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-400" />
                  <span>{lang === 'ar' ? 'رقم الهاتف (واتساب) *' : 'Numéro WhatsApp *'}</span>
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="06 35 39 25 03"
                  required
                  className="w-full bg-[#12141B] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                {lang === 'ar' ? 'ملاحظة خاصة أو تفضيل بالقصة (اختياري)' : 'Précisions ou style souhaité (optionnel)'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: تدرج منخفض مع الحفاظ على اللحية' : 'Ex: Taper fade, taille de barbe soignée...'}
                className="w-full bg-[#12141B] border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Price & Summary Box */}
          <div className="p-4 rounded-2xl bg-[#12141B] border border-zinc-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span>{lang === 'ar' ? 'مجموع الخدمات:' : 'Sous-total prestations:'}</span>
              <span className="font-mono text-white">{pricingResult.originalSubtotal} MAD</span>
            </div>

            {pricingResult.totalSavings > 0 && (
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>{lang === 'ar' ? '🎁 تخفيض الباقة المطبقة:' : '🎁 Remise bundle appliquée:'}</span>
                <span className="font-mono">-{pricingResult.totalSavings} MAD</span>
              </div>
            )}

            {includeWaitingSkip && (
              <div className="flex items-center justify-between text-amber-400">
                <span className="flex items-center gap-1">
                  <span>⚡</span>
                  <span>{lang === 'ar' ? 'خدمة تفادي الانتظار:' : 'Service Coupe-File:'}</span>
                </span>
                <span className="font-mono font-bold">+10 MAD</span>
              </div>
            )}

            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-sm font-black text-white block">
                  {lang === 'ar' ? 'المجموع النهائي للطلب:' : 'Total à payer :'}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {lang === 'ar' ? 'الأداء في الصالون بعد الخدمة' : 'Paiement au salon après la prestation'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-amber-400 font-mono block">
                  {grandTotal} <span className="text-xs text-amber-400/80">MAD</span>
                </span>
              </div>
            </div>
          </div>

          {/* DUAL ACTION BUTTONS (WhatsApp + Site Ticket) */}
          <div className="space-y-3 pt-2">
            
            {/* Primary Action 1: Book via WhatsApp */}
            <button
              type="button"
              onClick={handleBookViaWhatsApp}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <MessageCircle className="w-5 h-5" />
              <span>{ui.btnWhatsApp}</span>
            </button>

            {/* Primary Action 2: Confirm on Site (Ticket Generation) */}
            <button
              type="button"
              onClick={handleConfirmOnSite}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#181B23] hover:bg-[#202430] border border-zinc-700/80 active:scale-[0.99] text-zinc-200 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Ticket className="w-4 h-4 text-amber-400" />
              <span>{ui.btnSite}</span>
            </button>

          </div>

        </div>

      </div>

      {/* CONFIRMED TICKET MODAL */}
      {createdBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0E1015] border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center animate-in fade-in duration-300">
            
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider font-bold text-amber-400">
                {lang === 'ar' ? 'تم تسجيل حجزك بنجاح' : 'Réservation Enregistrée !'}
              </span>
              <h3 className="text-2xl font-black text-white font-display">
                {createdBooking.ticketNumber}
              </h3>
              <p className="text-xs text-zinc-400">
                {lang === 'ar' ? 'احتفظ برقم التذكرة أو تتبعه مباشرة' : 'Conservez votre numéro de ticket.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-left text-xs space-y-2">
              <div className="flex justify-between text-zinc-400">
                <span>{lang === 'ar' ? 'الاسم:' : 'Client :'}</span>
                <span className="text-white font-bold">{createdBooking.clientName}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{lang === 'ar' ? 'الحلاق:' : 'Barbier :'}</span>
                <span className="text-amber-400 font-bold">{createdBooking.barberName}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{lang === 'ar' ? 'الموعد:' : 'Date & Heure :'}</span>
                <span className="text-white font-mono">{createdBooking.date} • {createdBooking.timeSlot}</span>
              </div>
              <div className="flex justify-between text-zinc-400 pt-2 border-t border-zinc-800">
                <span>{lang === 'ar' ? 'المجموع النهائي:' : 'Total :'}</span>
                <span className="text-amber-400 font-bold font-mono text-sm">{createdBooking.finalTotalMAD} MAD</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleCopyTicket(createdBooking.ticketNumber)}
                className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4 text-amber-400" />
                <span>{copiedTicket ? (lang === 'ar' ? 'تم النسخ!' : 'Copié !') : (lang === 'ar' ? 'نسخ رقم التذكرة' : 'Copier le Ticket')}</span>
              </button>

              {onOpenTrackBooking && (
                <button
                  type="button"
                  onClick={() => {
                    const tNum = createdBooking.ticketNumber;
                    setCreatedBooking(null);
                    onOpenTrackBooking(tNum);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Ticket className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تتبع تذكرتي الآن' : 'Suivre mon statut'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCreatedBooking(null)}
                className="w-full py-2.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق النافذة' : 'Fermer'}
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};
