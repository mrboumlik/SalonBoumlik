import React, { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  Download,
  QrCode
} from 'lucide-react';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [formError, setFormError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const ticketCardRef = useRef<HTMLDivElement>(null);

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

  // Generate QR Code whenever createdBooking changes
  useEffect(() => {
    if (createdBooking) {
      // Embed tracking URL or Ticket ID
      const qrPayload = `${window.location.origin}/#track=${encodeURIComponent(createdBooking.ticketNumber)}`;
      QRCode.toDataURL(qrPayload, {
        width: 180,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('QR code generation error:', err));
    } else {
      setQrCodeDataUrl('');
    }
  }, [createdBooking]);

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
      barberColor: selectedBarber.themeColor || '#D97706',
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

  // Download Ticket as PNG Image using html2canvas
  const handleDownloadTicket = async () => {
    if (!ticketCardRef.current || !createdBooking) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(ticketCardRef.current, {
        scale: 2,
        backgroundColor: '#0E1015',
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Ticket-SalonBoumlik-${createdBooking.ticketNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export ticket image:', err);
    } finally {
      setIsDownloading(false);
    }
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
      ar: 'اختر الحلاق أولاً، ثم حدد الخدمات وتاريخ الموعد لتسجيل حجزك واستخراج تذكرتك الإلكترونية فوراً.',
      fr: 'Choisissez d’abord votre barbier, puis vos prestations et votre créneau horaire.',
      en: 'Choose your barber first, then select services and appointment details.',
      amz: 'ⴼⵔⵏ ⴰⵎⴽⵔⴰⴹ ⴷⴰⵜ, ⵉⵍⵎⵎⴰ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⴽ.',
      es: 'Elige tu barbero primero, luego tus servicios y detalles.',
    }[lang] || 'اختر الحلاق والخدمات',
    waitingTitle: {
      ar: 'خدمة تفادي الانتظار (+10 دراهم)',
      fr: 'Service Coupe-File / Anti-attente (+10 MAD)',
      en: 'Zero-Wait Priority Queue (+10 MAD)',
      amz: 'ⵜⴰⵏⴰⴼⵓⵜ ⵏ ⵓⵙⵙⵉⴷⵔ ⵏ ⵓⵇⵇⵍ (+10 ⴷⵔⵀⵎ)',
      es: 'Servicio Sin Espera Prioritario (+10 MAD)',
    }[lang] || 'خدمة تفادي الانتظار (+10 دراهم)',
    waitingDesc: {
      ar: 'تُضاف 10 دراهم إلى تسعيرة الحلاقة عند حجز موعد محدد مسبقاً لتفادي الانتظار داخل الصالون، حيث يتم الاتصال بالزبون مباشرة فور اقتراب دوره.',
      fr: '10 MAD sont ajoutés au tarif de la coupe pour garantir un créneau prioritaire sans attente au salon.',
      en: '10 MAD is added to ensure priority seating without in-salon waiting.',
      amz: 'ⵜⵜⵓⵔⵏⵓⵏ 10 ⴷⵔⵀⵎ ⵉ ⵡⴰⵜⵉⴳ ⵏ ⵜⴽⵔⴹⴰ ⴰⴼⴰⴷ ⴰⴷ ⵓⵔ ⵜⵇⵇⵍⴷ ⴳ ⵓⵙⴰⵍⵓⵏ.',
      es: 'Se añaden 10 MAD para garantizar turno prioritario sin esperas en el salón.',
    }[lang] || 'تُضاف 10 دراهم لتفادي الانتظار.',
    step1: {
      ar: '1. اختر الحلاق المفضل *',
      fr: '1. Choisissez votre barbier favori *',
      en: '1. Choose your preferred barber *',
      amz: '1. ⴼⵔⵏ ⴰⵎⴽⵔⴰⴹ ⵏⵏⴽ ⵉⵥⵍⵉⵏ *',
      es: '1. Elige tu barbero preferido *',
    }[lang] || '1. اختر الحلاق المفضل *',
    step2: {
      ar: `2. اختر الخدمات التي ترغب بها (${selectedServiceIds.length})`,
      fr: `2. Choisissez vos prestations (${selectedServiceIds.length})`,
      en: `2. Select Your Services (${selectedServiceIds.length})`,
      amz: `2. ⴼⵔⵏ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⴽ (${selectedServiceIds.length})`,
      es: `2. Elige los servicios (${selectedServiceIds.length})`,
    }[lang] || '2. اختر الخدمات',
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
  const activeBarberColor = createdBarber.themeColor || '#D97706';

  return (
    <section id="booking" className="py-8 sm:py-14 bg-white dark:bg-[#090A0E] text-zinc-900 dark:text-white relative border-b border-zinc-200 dark:border-zinc-800">
      
      {/* Ambient background glows */}
      <div className="absolute top-1/4 right-1/4 w-[350px] sm:w-[450px] h-[300px] bg-red-600/5 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[350px] sm:w-[450px] h-[300px] bg-blue-600/5 blur-[140px] rounded-full pointer-events-none" />

      {/* Mobile-First Container (max-w-md or optimized responsive container) */}
      <div className="max-w-md sm:max-w-2xl mx-auto px-4 relative z-10">
        
        {/* Main Card Shell */}
        <div className="rounded-3xl bg-white dark:bg-[#0D0F14] border border-zinc-200 dark:border-amber-500/30 p-5 sm:p-7 shadow-xl space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold">
              <Ticket className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{lang === 'ar' ? 'حجز فوري ومباشر • صالون بومليك' : 'Réservation Directe Sans Inscription'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight font-display">
              {ui.title}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
              {ui.subtitle}
            </p>
          </div>

          {/* Priority Waiting Skip Box */}
          <div 
            onClick={() => setIncludeWaitingSkip(!includeWaitingSkip)}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none ${
              includeWaitingSkip 
                ? 'bg-amber-50/70 dark:bg-gradient-to-r dark:from-amber-950/40 dark:via-amber-900/25 dark:to-amber-950/40 border-amber-300 dark:border-amber-500/60 shadow-sm' 
                : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex-shrink-0">
                <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>{ui.waitingTitle}</span>
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${includeWaitingSkip ? 'bg-amber-500 text-black' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                    {includeWaitingSkip ? (lang === 'ar' ? 'مفعّلة' : 'Active') : (lang === 'ar' ? 'معطّلة' : 'Désactivée')}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                  {ui.waitingDesc}
                </p>
              </div>
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          {/* STRICT SEQUENCE: STEP 1 - CHOOSE BARBER FIRST */}
          <div className="space-y-3 pt-1">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-500" />
              <span>{ui.step1}</span>
            </label>

            {/* Current Barber Summary Tag with color indicator */}
            <div className="px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span 
                  className="w-3 h-3 rounded-full flex-shrink-0 shadow-xs" 
                  style={{ backgroundColor: selectedBarber.themeColor || '#D97706' }} 
                />
                <span className="font-bold text-zinc-900 dark:text-white">
                  {barberNameLocalized} {selectedBarber.isOwner && `— (${ui.roleOwner})`}
                </span>
              </div>
              <span 
                className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white font-mono"
                style={{ backgroundColor: selectedBarber.themeColor || '#D97706' }}
              >
                {selectedBarber.colorName || 'Active'}
              </span>
            </div>

            {/* 2x2 Grid of Barbers (Hassan, Anouar, Lahcen, Mounir) with Barber Colors */}
            <div className="grid grid-cols-2 gap-2.5">
              {TEAM_MEMBERS.map((barber) => {
                const isSelected = selectedBarberId === barber.id;
                const bName = barber.name[lang] || barber.name.ar;
                const bColor = barber.themeColor || '#D97706';

                return (
                  <button
                    key={barber.id}
                    type="button"
                    onClick={() => onSelectBarberId(barber.id)}
                    className={`p-2.5 rounded-2xl border text-left rtl:text-right flex items-center gap-2.5 transition-all cursor-pointer group relative overflow-hidden ${
                      isSelected
                        ? 'bg-amber-50/50 dark:bg-zinc-900 border-2 shadow-md'
                        : 'bg-zinc-50/60 dark:bg-[#12141B] border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                    style={{
                      borderColor: isSelected ? bColor : undefined,
                    }}
                  >
                    {/* Top Accent Color Line on Barber Card */}
                    <div 
                      className="absolute top-0 inset-x-0 h-1" 
                      style={{ backgroundColor: bColor }} 
                    />

                    <img 
                      src={barber.avatar} 
                      alt={bName} 
                      className="w-10 h-10 rounded-full object-cover object-center bg-zinc-200 dark:bg-zinc-800 flex-shrink-0 shadow-xs"
                      style={{
                        outline: isSelected ? `2px solid ${bColor}` : '2px solid transparent',
                        outlineOffset: '2px',
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-zinc-900 dark:text-white text-xs block truncate">
                        {bName}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span 
                          className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                          style={{ backgroundColor: bColor }}
                        />
                        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block truncate">
                          {barber.isOwner ? (lang === 'ar' ? 'المالك' : 'Fondateur') : (lang === 'ar' ? 'حلاق' : 'Barbier')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STRICT SEQUENCE: STEP 2 - SELECT SERVICES (Maintain pricing: Haircut+Beard=35 MAD, Protein=90m, Color=100m, Drink removed) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200">
              <span className="flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-amber-500" />
                <span>{ui.step2}</span>
              </span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-normal">
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
                    className={`px-3.5 py-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-500 shadow-xs'
                        : 'bg-zinc-50/70 dark:bg-[#12141B] border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white block truncate">
                        {srvName}
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        ~{srv.durationMinutes} min
                      </span>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                        ({srv.basePrice} MAD)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-amber-500 text-black shadow-xs'
                            : 'border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-transparent'
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

          {/* STRICT SEQUENCE: STEP 3 - DATE, TIME & CONTACT INFO */}
          <div className="space-y-3.5 pt-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>{ui.step3}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                  {lang === 'ar' ? 'تاريخ الموعد' : 'Date du rendez-vous'}
                </label>
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                  {lang === 'ar' ? 'التوقيت المفضل' : 'Heure préférée'}
                </label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-amber-500"
                >
                  {timeSlots.map((ts) => (
                    <option key={ts} value={ts}>
                      {ts}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Coordinates: Name, Phone (WhatsApp), and Optional Email */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-400" />
                  <span>{lang === 'ar' ? 'الاسم الكامل *' : 'Nom complet *'}</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: يوسف الإدريسي' : 'Ex: Youssef El Idrissi'}
                  required
                  className="w-full bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-500" />
                  <span>{lang === 'ar' ? 'رقم الهاتف (واتساب) *' : 'Numéro WhatsApp *'}</span>
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="06 35 39 25 03"
                  required
                  className="w-full bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white font-mono placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-blue-500" />
                  <span>{lang === 'ar' ? 'الإيميل (اختياري)' : 'Email (Optionnel)'}</span>
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                {lang === 'ar' ? 'ملاحظة خاصة أو تفضيل بالقصة (اختياري)' : 'Précisions ou style souhaité (optionnel)'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: تدرج منخفض مع الحفاظ على اللحية' : 'Ex: Taper fade, taille de barbe...'}
                className="w-full bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Price & Summary Box */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-[#12141B] border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>{lang === 'ar' ? 'مجموع الخدمات:' : 'Sous-total prestations:'}</span>
              <span className="font-mono text-zinc-900 dark:text-white">{pricingResult.originalSubtotal} MAD</span>
            </div>

            {pricingResult.totalSavings > 0 && (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span>{lang === 'ar' ? '🎁 تخفيض الباقة المطبقة:' : '🎁 Remise bundle appliquée:'}</span>
                <span className="font-mono">-{pricingResult.totalSavings} MAD</span>
              </div>
            )}

            {includeWaitingSkip && (
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                <span className="flex items-center gap-1">
                  <span>⚡</span>
                  <span>{lang === 'ar' ? 'خدمة تفادي الانتظار:' : 'Service Coupe-File:'}</span>
                </span>
                <span className="font-mono font-bold">+10 MAD</span>
              </div>
            )}

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-sm font-black text-zinc-900 dark:text-white block">
                  {lang === 'ar' ? 'المجموع النهائي للطلب:' : 'Total à payer :'}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {lang === 'ar' ? 'الأداء في الصالون بعد الخدمة' : 'Paiement au salon après la prestation'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono block">
                  {grandTotal} <span className="text-xs text-amber-600/80">MAD</span>
                </span>
              </div>
            </div>
          </div>

          {/* SINGLE PRIMARY SUBMIT BUTTON: Confirm Booking & Get Ticket */}
          <div className="pt-1">
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

      {/* ADVANCED DIGITAL TICKET MODAL (With Barber Color-Coding, QR Code, and Image Download) */}
      {createdBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0E1015] border border-amber-500/40 rounded-3xl p-5 sm:p-6 max-w-sm sm:max-w-md w-full shadow-2xl space-y-4 text-center animate-in fade-in duration-300 max-h-[92vh] overflow-y-auto text-white">
            
            {/* The Actual Downloadable Ticket Card (captured via html2canvas) */}
            <div 
              ref={ticketCardRef}
              className="p-5 rounded-3xl bg-[#12141B] border-2 shadow-2xl space-y-4 text-left relative overflow-hidden"
              style={{
                borderColor: activeBarberColor,
              }}
            >
              {/* Barber Pole Top Line */}
              <div className="h-1.5 -mx-5 -mt-5 mb-4 bg-gradient-to-r from-red-600 via-white to-blue-600" />

              {/* Barber Identity Badge */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3.5 h-3.5 rounded-full shadow-sm"
                    style={{ backgroundColor: activeBarberColor }}
                  />
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                      {lang === 'ar' ? 'الحلاق المعين' : 'Barbier Assigné'}
                    </span>
                    <span className="text-xs font-black text-white">
                      {createdBooking.barberName}
                    </span>
                  </div>
                </div>

                <span 
                  className="px-2.5 py-1 rounded-lg text-white font-bold text-[10px] font-mono shadow-xs"
                  style={{ backgroundColor: activeBarberColor }}
                >
                  #{createdBooking.ticketNumber}
                </span>
              </div>

              {/* QR Code & Main Ticket Info */}
              <div className="flex items-center gap-4 bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800">
                {qrCodeDataUrl ? (
                  <div className="p-1.5 bg-white rounded-xl flex-shrink-0 shadow-md">
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Booking QR Code" 
                      className="w-20 h-20 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-8 h-8 text-zinc-500 animate-pulse" />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-[10px] text-zinc-400 block uppercase">Salon Boumlik</span>
                  <div className="text-sm font-bold text-white truncate">
                    {createdBooking.clientName}
                  </div>
                  <div className="text-xs text-amber-400 font-mono font-semibold">
                    📅 {createdBooking.date}
                  </div>
                  <div className="text-xs text-blue-400 font-mono font-bold">
                    ⏰ {createdBooking.timeSlot}
                  </div>
                </div>
              </div>

              {/* Total & Status */}
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-zinc-400">
                  {lang === 'ar' ? 'المجموع النهائي للطلب:' : 'Total de la réservation:'}
                </span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {createdBooking.finalTotalMAD} MAD
                </span>
              </div>
            </div>

            {/* Recommendation Banner for Instant Confirmation */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/30 to-amber-950/40 border border-amber-500/50 text-center space-y-1 shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
                <span>
                  {lang === 'ar' ? 'تأكيد فوري وسريع' : 'Confirmation Rapide Recommandée'}
                </span>
              </div>
              <p className="text-[11px] text-amber-200/95 leading-relaxed font-semibold">
                {lang === 'ar' 
                  ? 'للحصول على تأكيد ورد سريع، يُنصح بالتواصل معنا الآن عبر الواتساب أو الاتصال.' 
                  : 'Pour une confirmation immédiate et un traitement prioritaire, nous vous recommandons vivement de nous contacter dès maintenant.'}
              </p>
            </div>

            {/* Download Ticket Image Button */}
            <button
              type="button"
              onClick={handleDownloadTicket}
              disabled={isDownloading}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>
                {isDownloading 
                  ? (lang === 'ar' ? 'جارٍ تحميل الصورة...' : 'Génération de l’image...') 
                  : (lang === 'ar' ? 'تحميل التذكرة كصورة (PNG)' : 'Télécharger le Ticket (Image)')}
              </span>
            </button>

            {/* Direct Contact Buttons (Barber & Hassan) */}
            <div className="space-y-2">
              <a
                href={`https://wa.me/${chosenBarberWa}?text=${encodeURIComponent(
                  `Salam ${createdBooking.barberName}, je viens d'enregistrer ma réservation sous le ticket ${createdBooking.ticketNumber} au Salon Boumlik pour le ${createdBooking.date} à ${createdBooking.timeSlot}. Pouvez-vous me confirmer le créneau ? Merci !`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white flex-shrink-0" />
                <span>
                  {lang === 'ar' ? `مراسلة الحلاق عبر الواتساب (${createdBooking.barberName})` : `WhatsApp avec le Barbier (${createdBooking.barberName})`}
                </span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/212635392503?text=${encodeURIComponent(
                    `Salam Si Hassan, je viens d'enregistrer le ticket ${createdBooking.ticketNumber} au Salon Boumlik pour le ${createdBooking.date} à ${createdBooking.timeSlot}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lang === 'ar' ? 'واتساب حسن' : 'WhatsApp Hassan'}</span>
                </a>

                <a
                  href="tel:0635392503"
                  className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-blue-400" />
                  <span>06 35 39 25 03</span>
                </a>
              </div>
            </div>

            {/* Quick Actions: Copy Ticket, Track, Close */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => handleCopyTicket(createdBooking.ticketNumber)}
                className="w-full py-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                  className="w-full py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Ticket className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تتبع تذكرتي الآن' : 'Suivre mon statut'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCreatedBooking(null)}
                className="w-full py-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
