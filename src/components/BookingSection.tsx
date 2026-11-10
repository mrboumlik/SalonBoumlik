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
  Check,
  CheckSquare,
  Square,
  Pencil,
  PhoneCall,
  Mail,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../context/LanguageContext';
import { TEAM_MEMBERS, SALON_INFO } from '../data/barbershopData';
import { createNewBooking } from '../utils/bookingStore';
import { PricingEngineResult, AppointmentBooking } from '../types';
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
  const [clientEmail, setClientEmail] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('16:00');
  const [notes, setNotes] = useState('');
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
        'Numéro de téléphone marocain valide requis (ex: 06...)'
      );
      return false;
    }
    if (selectedServiceIds.length === 0) {
      setFormError(
        lang === 'ar' ? 'يرجى اختيار خدمة واحدة على الأقل من القائمة أدناه' :
        lang === 'amz' ? 'ⴼⵔⵏ ⵎⵇⵇⴰⵔ ⴷ ⵢⴰⵜ ⵜⵡⵓⵔⵉ' :
        'Veuillez sélectionner au moins un soin dans la liste.'
      );
      return false;
    }
    setFormError('');
    return true;
  };

  // Single Primary Submit Action: Confirm Booking & Get Ticket (Routes to Database first)
  const handleConfirmBooking = (e: React.FormEvent) => {
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
      clientEmail: clientEmail.trim() || undefined,
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
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#eab308', '#dc2626', '#ffffff', '#2563eb'],
      });
    } catch {
      // ignore
    }

    setCreatedBooking(newBooking);
    if (onBookingConfirmed) onBookingConfirmed(newBooking);
  };

  const handleCopyTicket = (ticket: string) => {
    navigator.clipboard.writeText(ticket);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
  };

  // Localized UI Texts
  const ui = {
    title: {
      ar: 'طلب موعد وتسعيرة',
      fr: 'Demande de Rendez-vous & Devis',
      en: 'Appointment Request & Pricing',
      amz: 'ⴰⵙⵓⵜⵔ ⵏ ⵓⵙⵔⵓⵙ ⴷ ⵡⴰⵜⵉⴳ',
      es: 'Solicitud de Cita y Presupuesto',
    }[lang] || 'طلب موعد وتسعيرة',
    subtitle: {
      ar: 'حدد الخدمات المطلوبة واختر الحلاق المفضل، سيتم تسجيل حجزك فوراً واستخراج تذكرتك الإلكترونية.',
      fr: 'Choisissez vos prestations et votre barbier attitré. Votre réservation est enregistrée instantanément.',
      en: 'Select your grooming services and preferred barber. Your booking is logged and ticket issued instantly.',
      amz: 'ⴼⵔⵏ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⴷ ⵓⵎⴽⵔⴰⴹ ⵏⵏⴽ. ⵔⴰⴷ ⵏⵙⵙⴷⵓ ⴰⵙⵔⵓⵙ ⵏⵏⴽ ⵙ ⵜⵉⵣⵣⵍⴰ.',
      es: 'Elige tus servicios y tu barbero preferido. Tu reserva se registrará de inmediato.',
    }[lang] || 'حدد الخدمات المطلوبة واختر الحلاق المفضل.',
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
      ar: '3. تاريخ الموعد والتوقيت والمعلومات',
      fr: '3. Date, horaire & coordonnées',
      en: '3. Date, time slot & details',
      amz: '3. ⴰⵙⴰⴽⵓⴷ ⴷ ⵓⴽⵓⴷ ⴷ ⵉⵏⵖⵎⵉⵙⵏ',
      es: '3. Fecha, hora y contacto',
    }[lang] || '3. تاريخ الموعد',
    btnSubmit: {
      ar: 'تأكيد الحجز واستخراج التذكرة',
      fr: 'Confirmer la Réservation & Obtenir mon Ticket',
      en: 'Confirm Booking & Get Ticket',
      amz: 'ⵙⵙⴷⵓ ⴰⵙⵔⵓⵙ ⴷ ⵜⵉⴽⵉ',
      es: 'Confirmar Reserva y Obtener Ticket',
    }[lang] || 'تأكيد الحجز واستخراج التذكرة',
    roleOwner: {
      ar: 'المالك وخبير الحلاقة',
      fr: 'Propriétaire & Maître Barbier',
      en: 'Owner & Master Barber',
      amz: 'ⴰⵎⵙⴱⴷⴰⴷ',
      es: 'Propietario y Maestro Barbero',
    }[lang] || 'المالك',
  };

  // Find barber contact for modal buttons
  const createdBarber = createdBooking 
    ? (TEAM_MEMBERS.find((b) => b.id === createdBooking.barberId) || TEAM_MEMBERS[0])
    : selectedBarber;

  const chosenBarberPhone = createdBarber.phone || '0635392503';
  const chosenBarberWa = createdBarber.whatsappNumber || '212635392503';

  return (
    <section id="booking" className="py-10 sm:py-16 bg-[#090A0E] text-white relative border-b border-zinc-800">
      
      {/* Background ambient lighting in Barber Red and Blue */}
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] bg-red-600/5 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[300px] bg-blue-600/5 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Main Card Shell with subtle gold border accent */}
        <div className="rounded-3xl bg-[#0D0F14] border border-amber-500/30 p-5 sm:p-8 shadow-2xl space-y-7">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold mb-1">
              <Ticket className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'ar' ? 'حجز فوري ومباشر • صالون بومليك' : 'Réservation Directe Sans Inscription'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
              {ui.title}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-xl mx-auto">
              {ui.subtitle}
            </p>
          </div>

          {/* Priority Waiting Skip Box (Gold callout as specified) */}
          <div 
            onClick={() => setIncludeWaitingSkip(!includeWaitingSkip)}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer select-none ${
              includeWaitingSkip 
                ? 'bg-gradient-to-r from-amber-950/40 via-amber-900/25 to-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-500/10' 
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
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${includeWaitingSkip ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
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

          {/* STEP 1: Select Services (Compact rows) */}
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

            {/* 2x2 Grid of Barber Pills (Including Mounir querdeny with styled avatar) */}
            <div className="grid grid-cols-2 gap-2.5">
              {TEAM_MEMBERS.map((barber) => {
                const isSelected = selectedBarberId === barber.id;
                const bName = barber.name[lang] || barber.name.ar;

                return (
                  <button
                    key={barber.id}
                    type="button"
                    onClick={() => onSelectBarberId(barber.id)}
                    className={`p-2.5 sm:p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500'
                        : 'bg-[#12141B] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <img 
                      src={barber.avatar} 
                      alt={bName} 
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover object-center bg-zinc-800 flex-shrink-0 ring-2 ring-zinc-700/80 group-hover:ring-amber-500/50 transition-all shadow"
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

          {/* STEP 3: Date, Time & Client Info (With Optional Email) */}
          <div className="space-y-4 pt-2">
            <label className="block text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>{ui.step3}</span>
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

            {/* Client Coordinates: Name, WhatsApp Phone, and Optional Email */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-blue-400" />
                  <span>{lang === 'ar' ? 'الإيميل (اختياري)' : 'Email (Optionnel)'}</span>
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full bg-[#12141B] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
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

          {/* ONLY ONE PRIMARY SUBMIT BUTTON: Confirm Booking & Get Ticket (Routes to Database first) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleConfirmBooking}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/25 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Ticket className="w-5 h-5 text-black" />
              <span>{ui.btnSubmit}</span>
            </button>
          </div>

        </div>

      </div>

      {/* CONFIRMED TICKET MODAL WITH PROMINENT RECOMMENDATION & DIRECT CONTACT BUTTONS */}
      {createdBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0E1015] border border-amber-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 text-center animate-in fade-in duration-300 max-h-[92vh] overflow-y-auto">
            
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider font-bold text-amber-400">
                {lang === 'ar' ? 'تم تسجيل حجزك بنجاح في النظام' : 'Réservation Enregistrée !'}
              </span>
              <h3 className="text-2xl font-black text-white font-display">
                {createdBooking.ticketNumber}
              </h3>
              <p className="text-xs text-zinc-400">
                {lang === 'ar' ? 'تم حفظ طلبك في قاعدة بيانات الصالون' : 'Votre billet a été généré et enregistré avec succès.'}
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

            {/* PROMINENT RECOMMENDATION NOTE (Requirement #2) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/30 to-amber-950/40 border border-amber-500/50 text-center space-y-1 shadow-sm">
              <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
                <span>
                  {lang === 'ar' ? 'تأكيد فوري وسريع' : 'Confirmation Rapide Recommandée'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-amber-200/95 leading-relaxed font-semibold">
                {lang === 'ar' 
                  ? 'للحصول على تأكيد ورد سريع، يُنصح بالتواصل معنا الآن عبر الواتساب أو الاتصال.' 
                  : 'Pour une confirmation immédiate et un traitement prioritaire, nous vous recommandons vivement de nous contacter dès maintenant par WhatsApp ou par téléphone.'}
              </p>
            </div>

            {/* Direct Contact Buttons (Barber & Hassan) */}
            <div className="space-y-2">
              {/* 1. Direct WhatsApp to Chosen Barber */}
              <a
                href={`https://wa.me/${chosenBarberWa}?text=${encodeURIComponent(
                  `Salam ${createdBooking.barberName}, je viens d'enregistrer ma réservation sous le ticket ${createdBooking.ticketNumber} au Salon Boumlik pour le ${createdBooking.date} à ${createdBooking.timeSlot}. Pouvez-vous me confirmer le créneau ? Merci !`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white flex-shrink-0" />
                <span>
                  {lang === 'ar' ? `مراسلة الحلاق عبر الواتساب (${createdBooking.barberName})` : `WhatsApp avec le Barbier (${createdBooking.barberName})`}
                </span>
              </a>

              {/* 2. Direct Contact to Salon Owner Hassan */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/212635392503?text=${encodeURIComponent(
                    `Salam Si Hassan, je viens d'enregistrer le ticket ${createdBooking.ticketNumber} au Salon Boumlik pour le ${createdBooking.date} à ${createdBooking.timeSlot}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lang === 'ar' ? 'واتساب الإدارة (حسن)' : 'WhatsApp Hassan'}</span>
                </a>

                <a
                  href="tel:0635392503"
                  className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-blue-400" />
                  <span>06 35 39 25 03</span>
                </a>
              </div>
            </div>

            {/* Ticket Management Actions */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => handleCopyTicket(createdBooking.ticketNumber)}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Ticket className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تتبع تذكرتي الآن' : 'Suivre mon statut'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCreatedBooking(null)}
                className="w-full py-2 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
