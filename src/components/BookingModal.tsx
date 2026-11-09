import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Scissors, 
  User, 
  Phone, 
  Mail, 
  Check, 
  Sparkles, 
  MessageCircle, 
  Download, 
  CalendarPlus, 
  ArrowRight, 
  ShieldCheck, 
  Building,
  Coffee,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SERVICES, TEAM_MEMBERS, SALON_INFO } from '../data/barbershopData';
import { BarberService, AppointmentBooking, DrinkPreference } from '../types';
import { 
  downloadIcsFile, 
  createGoogleCalendarUrl, 
  createWhatsAppUrl, 
  createFormattedWhatsAppQuoteMessage,
  createOwnerWhatsAppAlertMessage,
  createOwnerEmailNotificationUrl,
  getDrinkLabel
} from '../utils/calendar';
import { useLanguage } from '../context/LanguageContext';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedServices: BarberService[];
  onToggleService: (service: BarberService) => void;
  selectedBarberId?: string;
  onAppointmentBooked: (booking: AppointmentBooking) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  selectedServices,
  onToggleService,
  selectedBarberId: initialBarberId,
  onAppointmentBooked,
}) => {
  const { lang, t, isRtl } = useLanguage();

  // Client Details
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  
  // Date & Time
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTime, setSelectedTime] = useState<string>('14:30');
  
  // Mandatory Barber Selection
  const [barberId, setBarberId] = useState<string>(initialBarberId || '');
  const [barberError, setBarberError] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Complimentary Drink Selection
  const [drinkPreference, setDrinkPreference] = useState<DrinkPreference>('tea');
  
  // Notes
  const [notes, setNotes] = useState('');

  // Confirmation view
  const [confirmedBooking, setConfirmedBooking] = useState<AppointmentBooking | null>(null);

  useEffect(() => {
    if (initialBarberId) {
      setBarberId(initialBarberId);
      setBarberError(false);
    }
  }, [initialBarberId]);

  if (!isOpen) return null;

  const totalDuration = selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0);

  const availableTimeSlots = [
    '10:30', '11:15', '12:00', '14:30', '15:15', '16:00', 
    '17:00', '18:00', '19:00', '20:00', '21:00', '21:45'
  ];

  const drinkOptions: { id: DrinkPreference; label: string; icon: string }[] = [
    { id: 'coffee', label: t.drinkCoffee, icon: '☕' },
    { id: 'tea', label: t.drinkTea, icon: '🍃' },
    { id: 'none', label: t.drinkNone, icon: '🚫' },
  ];

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // If no barber chosen yet, default to Hassan (Owner)
    const activeBarberId = barberId || TEAM_MEMBERS[0].id;
    const chosenBarber = TEAM_MEMBERS.find((b) => b.id === activeBarberId) || TEAM_MEMBERS[0];

    // Services selection check (default to haircut if none selected)
    const activeServices = selectedServices.length > 0 ? selectedServices : [SERVICES[0]];

    const defaultClientName = lang === 'ar' ? 'زبون محترم' : lang === 'amz' ? 'ⴰⵎⵣⴷⴰⵖ' : 'Client';
    const finalClientName = clientName.trim() || defaultClientName;
    const finalClientPhone = clientPhone.trim() || '';

    const ticketRef = `SB-${Math.floor(1000 + Math.random() * 9000)}`;

    const newBooking: AppointmentBooking = {
      id: `booking-${Date.now()}`,
      ticketNumber: ticketRef,
      services: activeServices,
      barberId: chosenBarber.id,
      barberName: chosenBarber.name[lang] || chosenBarber.name.fr,
      drinkPreference,
      date: selectedDate || todayStr,
      timeSlot: selectedTime || '14:30',
      clientName: finalClientName,
      clientPhone: finalClientPhone,
      clientEmail: clientEmail.trim(),
      notes: notes.trim() || undefined,
      totalDurationMinutes: activeServices.reduce((acc, s) => acc + s.durationMinutes, 0),
      createdAt: new Date().toISOString(),
      status: 'pending_quote',
    };

    // Save appointment locally so no booking is lost
    try {
      const storedHistory = JSON.parse(localStorage.getItem('salon_boumlik_appointments_history') || '[]');
      localStorage.setItem('salon_boumlik_appointments_history', JSON.stringify([newBooking, ...storedHistory.slice(0, 49)]));
    } catch (e) {
      console.warn('Could not save booking locally:', e);
    }

    setConfirmedBooking(newBooking);
    onAppointmentBooked(newBooking);

    // Launch celebratory confetti
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.5 },
        colors: ['#D4AF37', '#F59E0B', '#10B981', '#ffffff']
      });
    } catch (err) {
      console.warn(err);
    }
  };

  const handleResetAndClose = () => {
    setConfirmedBooking(null);
    setValidationError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0C0E14] border border-amber-500/40 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {confirmedBooking ? (
          /* CONFIRMATION & DUAL MESSAGING REDIRECT VIEW */
          <div className="space-y-6 text-center py-2 animate-in zoom-in-95 duration-200">
            
            <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-400/10">
              <Sparkles className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                {lang === 'ar' ? 'تم تسجيل طلب الموعد بنجاح' : lang === 'amz' ? 'ⵉⵎⵓⵙⵙⵓ ⵏ ⵓⵙⵔⵓⵙ ⵉⵙⵎⴷ' : 'Demande Enregistrée'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white font-display mt-2">
                {confirmedBooking.clientName}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 mt-1 max-w-md mx-auto">
                {lang === 'ar'
                  ? 'تم تجهيز تفاصيل الموعد. يمكنك إرسالها مباشرة للحلاق ونسخ الإشعار لسي حسن عبر الواتساب أو الإيميل.'
                  : lang === 'amz'
                  ? 'ⵜⴰⴱⵔⴰⵜ ⵏ ⵡⴰⵜⵙⴰⴱ ⵜⵍⵍⴰ ⵖⵔ ⵓⵎⴽⵕⴰⴹ ⴷ ⵃⴰⵙⴰⵏ.'
                  : 'Votre demande a été préparée. Envoyez-la directement sur WhatsApp et avisez Hassan.'}
              </p>
            </div>

            {/* Ticket Card */}
            <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-5 text-left space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <span className="text-[11px] text-zinc-400">Ticket</span>
                  <div className="text-base font-mono font-bold text-amber-400">
                    #{confirmedBooking.ticketNumber}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-zinc-400">Contact Salon</span>
                  <div className="text-xs font-bold text-emerald-400">
                    <span dir="ltr" className="inline-block font-mono">06 35 39 25 03</span>
                  </div>
                </div>
              </div>

              {/* VIP Reservation Rule Notice Badge */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{t.vipReservationNotice}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-zinc-400">
                    {lang === 'ar' ? 'التاريخ :' : lang === 'amz' ? 'ⴰⵙⴰⴽⵓⴷ :' : 'Date :'}
                  </span>
                  <div className="font-semibold text-white mt-0.5">{confirmedBooking.date}</div>
                </div>
                <div>
                  <span className="text-zinc-400">
                    {lang === 'ar' ? 'التوقيت :' : lang === 'amz' ? 'ⴰⴽⵓⴷ :' : 'Heure :'}
                  </span>
                  <div className="font-semibold text-amber-300 mt-0.5">{confirmedBooking.timeSlot}</div>
                </div>
                <div>
                  <span className="text-zinc-400">
                    {lang === 'ar' ? 'الحلاق المختار :' : lang === 'amz' ? 'ⴰⵎⴽⵕⴰⴹ :' : 'Barbier choisi :'}
                  </span>
                  <div className="font-semibold text-white mt-0.5">{confirmedBooking.barberName}</div>
                </div>
                <div>
                  <span className="text-zinc-400">
                    {lang === 'ar' ? 'اختيار المشروب :' : lang === 'amz' ? 'ⵜⵉⵙⵉⵜ :' : 'Boisson :'}
                  </span>
                  <div className="font-semibold text-amber-300 mt-0.5">
                    {confirmedBooking.drinkPreference === 'coffee'
                      ? (lang === 'ar' ? '☕ قهوة' : lang === 'amz' ? '☕ ⵜⴰⴽⴰⴼⵉⵜ' : '☕ Café')
                      : confirmedBooking.drinkPreference === 'tea'
                      ? (lang === 'ar' ? '🍃 أتاي فقط' : lang === 'amz' ? '🍃 ⴰⵜⴰⵢ' : '🍃 Thé')
                      : (lang === 'ar' ? '🚫 والو' : lang === 'amz' ? '🚫 ⵡⴰⵍⵓ' : '🚫 Rien')}
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <span className="text-xs text-zinc-400">
                  {lang === 'ar' ? 'الخدمات المحددة :' : lang === 'amz' ? 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ :' : 'Prestations sélectionnées :'}
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {confirmedBooking.services.map((s) => (
                    <span key={s.id} className="text-xs bg-zinc-800 px-2.5 py-1 rounded-lg text-amber-300 font-semibold border border-zinc-700">
                      ✓ {s.name[lang] || s.name.fr}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1">
                <Building className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>{SALON_INFO.address[lang] || SALON_INFO.address.fr}</span>
              </div>
            </div>

            {/* DUAL WHATSAPP & OWNER TRACKING NOTIFICATIONS */}
            {(() => {
              const activeBarber = TEAM_MEMBERS.find((b) => b.id === confirmedBooking.barberId) || TEAM_MEMBERS[0];
              const barberWhatsApp = activeBarber.whatsappNumber || SALON_INFO.whatsappNumber;
              const isHassan = activeBarber.isOwner || activeBarber.id === 'hassan';

              return (
                <div className="space-y-3">
                  {/* Action 1: Direct WhatsApp to chosen barber */}
                  <a
                    href={createWhatsAppUrl(
                      barberWhatsApp,
                      createFormattedWhatsAppQuoteMessage(confirmedBooking)
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:brightness-105 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
                  >
                    <MessageCircle className="w-5 h-5 fill-white" />
                    <span>
                      {isHassan
                        ? (lang === 'ar'
                            ? `إرسال الحجز لسي حسان (المالك وخبير الحلاقة) على الواتساب`
                            : lang === 'amz'
                            ? `ⴰⵣⵏ ⴳ ⵡⴰⵜⵙⴰⴱ ⵉ ⵃⴰⵙⴰⵏ (0635392503)`
                            : `Envoyer la réservation à Hassan (Fondateur) sur WhatsApp`)
                        : (lang === 'ar'
                            ? `1. إرسال الحجز للحلاق ${confirmedBooking.barberName} على الواتساب`
                            : lang === 'amz'
                            ? `1. ⴰⵣⵏ ⴳ ⵡⴰⵜⵙⴰⴱ ⵉ ${confirmedBooking.barberName}`
                            : `1. Envoyer la réservation à ${confirmedBooking.barberName} sur WhatsApp`)}
                    </span>
                  </a>

                  {/* Action 2: Direct Owner (Hassan - 0635392503) Notification & Fallback (Ensures Hassan tracks every single client request) */}
                  {!isHassan && (
                    <a
                      href={createWhatsAppUrl(
                        SALON_INFO.whatsappNumber,
                        createOwnerWhatsAppAlertMessage(confirmedBooking)
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 border border-amber-500/40 shadow-md transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>
                        {lang === 'ar'
                          ? `2. إرسال إشعار لسي حسن (المالك - 0635392503) لمتابعة الحجز`
                          : lang === 'amz'
                          ? `2. ⴰⵣⵏ ⵜⴰⵏⵏⴰⵢⵜ ⵉ ⵃⴰⵙⴰⵏ (ⴰⵎⵙⴱⴷⴰⴷ - 0635392503)`
                          : `2. Notifier Hassan (Propriétaire - 0635392503) pour suivi`}
                      </span>
                    </a>
                  )}

                  {/* Action 3: Email Notification Option to MrBoumlik@gmail.com & Google Calendar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <a
                      href={createOwnerEmailNotificationUrl(confirmedBooking)}
                      className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 border border-amber-500/30 transition-colors"
                    >
                      <Mail className="w-4 h-4 text-amber-400" />
                      <span>{t.notifyOwnerBtn} (Gmail)</span>
                    </a>

                    <a
                      href={createGoogleCalendarUrl(confirmedBooking)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs flex items-center justify-center gap-2 border border-zinc-800 transition-colors"
                    >
                      <CalendarPlus className="w-4 h-4 text-blue-400" />
                      <span>Google Calendar</span>
                    </a>
                  </div>

                  {/* Local Storage Saved Confirmation Notice */}
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 pt-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'ar'
                        ? 'تم حفظ تفاصيل التذكرة محلياً في جهازك لضمان عدم ضياع الموعد'
                        : lang === 'amz'
                        ? 'ⵜⵜⵓⵃⴹⴰⵏ ⵉⵏⵖⵎⵉⵙⵏ ⴳ ⵓⵎⵙⵙⵓⴷⵙ ⵏⵏⴽ'
                        : 'Réservation sécurisée et enregistrée localement sur votre appareil'}
                    </span>
                  </div>
                </div>
              );
            })()}

            <button
              onClick={handleResetAndClose}
              className="px-6 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer"
            >
              {lang === 'ar' ? 'إغلاق' : lang === 'amz' ? 'ⵔⴳⵍ' : lang === 'en' ? 'Close' : 'Fermer'}
            </button>

          </div>
        ) : (
          /* FORM VIEW */
          <div>
            <div className="text-center mb-6">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-2">
                <Scissors className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white font-display">
                {lang === 'ar' ? 'طلب موعد وتسعيرة واتساب' : lang === 'amz' ? 'ⴰⵙⵔⵓⵙ ⵏ ⵓⵎⴰⴳⴰⵔ ⴷ ⵡⴰⵜⵉⴳ' : 'Réservation & Devis WhatsApp'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {t.selectServicesSubtitle}
              </p>
            </div>

            {/* VIP RESERVATION NOTICE (+10 DH RULE) BANNER */}
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-300 flex items-start gap-2.5 shadow-md">
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-black uppercase tracking-wider block text-[11px] text-amber-400">
                  ⚡ {t.vipReservationBadge}
                </span>
                <p className="text-[11px] text-zinc-200 leading-relaxed">
                  {t.vipReservationNotice}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitBooking} className="space-y-5">
              
              {/* 1. Services Checklist (Multi-selection) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-amber-400" />
                    <span>1. {t.selectServicesTitle} ({selectedServices.length})</span>
                  </label>
                  <span className="text-xs text-amber-400 font-bold">
                    ~{totalDuration} min
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                  {SERVICES.map((service) => {
                    const isSelected = selectedServices.some((s) => s.id === service.id);

                    return (
                      <div
                        key={service.id}
                        onClick={() => onToggleService(service)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-400 text-white shadow-sm'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-amber-400 border-amber-400 text-zinc-950' : 'border-zinc-700'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="truncate">
                            <span className="font-semibold text-zinc-100">{service.name[lang] || service.name.fr}</span>
                            <span className="block text-[10px] text-zinc-500">~{service.durationMinutes} min</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-400 font-bold uppercase flex-shrink-0">
                          ✓
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. MANDATORY Barber Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>2. {t.formBarberChoice} *</span>
                  </label>
                  <span className="text-[10px] text-red-400 font-bold uppercase">
                    {lang === 'ar' ? 'إجباري' : lang === 'amz' ? 'ⵉⵇⵇⴰⵏ ⴷ' : lang === 'en' ? 'Mandatory' : 'Obligatoire'}
                  </span>
                </div>

                {/* Dropdown selection */}
                <select
                  required
                  value={barberId}
                  onChange={(e) => {
                    setBarberId(e.target.value);
                    if (e.target.value) setBarberError(false);
                  }}
                  className={`w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-3 rounded-xl border transition-colors ${
                    barberError 
                      ? 'border-red-500 ring-1 ring-red-500' 
                      : 'border-zinc-800 focus:outline-none focus:border-amber-500'
                  }`}
                >
                  <option value="">{t.selectBarberPlaceholder}</option>
                  {TEAM_MEMBERS.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name[lang] || barber.name.fr}{barber.role ? ` — (${barber.role[lang] || barber.role.fr})` : ''}
                    </option>
                  ))}
                </select>

                {barberError && (
                  <p className="text-xs text-red-400 flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{t.barberRequiredAlert}</span>
                  </p>
                )}

                {/* Visual Barber Cards selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {TEAM_MEMBERS.map((b) => (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => {
                        setBarberId(b.id);
                        setBarberError(false);
                      }}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                        barberId === b.id
                          ? 'bg-zinc-800 border-amber-400 ring-2 ring-amber-400/50'
                          : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800'
                      }`}
                    >
                      <img 
                        src={b.avatar} 
                        alt={b.name[lang] || b.name.fr} 
                        className="w-7 h-7 rounded-full object-cover border border-amber-500/40 flex-shrink-0"
                      />
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-white truncate">{b.name[lang] || b.name.fr}</div>
                        <div className="text-[9px] text-amber-400 truncate">
                          {b.isOwner 
                            ? (lang === 'ar' ? 'المالك' : lang === 'amz' ? 'ⴰⵎⵙⴱⴷⴰⴷ' : 'Owner')
                            : (lang === 'ar' ? 'حلاق' : lang === 'amz' ? 'ⴰⵎⴽⵕⴰⴹ' : 'Barber')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Complimentary Drink Selection */}
              <div>
                <label className="block text-xs font-bold text-zinc-200 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-amber-400" />
                  <span>3. {t.drinkSelectionTitle}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {drinkOptions.map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setDrinkPreference(opt.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        drinkPreference === opt.id
                          ? 'bg-amber-400/20 border-amber-400 text-amber-200 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
                      }`}
                    >
                      <span className="text-sm mr-1">{opt.icon}</span>
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Preferred Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-200 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>4. {t.formDate}</span>
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-200 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>5. {t.formTime}</span>
                  </label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                  >
                    {availableTimeSlots.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Client Details (Name, Phone Number, Gmail/Email - Smooth Non-Mandatory) */}
              <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    {lang === 'ar' 
                      ? '6. بيانات الزبون ومعلومات الاتصال' 
                      : lang === 'amz' 
                      ? '6. ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵎⵣⴷⴰⵖ' 
                      : lang === 'en' 
                      ? '6. Client Contact Details' 
                      : '6. Coordonnées du Client'}
                  </label>
                  <span className="text-[10px] text-zinc-400">
                    {lang === 'ar' ? 'سريعة واختيارية' : 'Optionnel / Rapide'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder={t.formClientName}
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <input
                      type="tel"
                      placeholder={t.formClientPhone}
                      value={clientPhone}
                      onChange={(e) => {
                        setClientPhone(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="email"
                      placeholder={t.formClientEmail}
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder={t.formNotes}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Inline Validation Error */}
              {validationError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 text-zinc-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/25 hover:brightness-105 active:scale-98 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5 fill-zinc-950" />
                  <span>{t.requestQuoteViaWhatsApp}</span>
                  <ArrowRight className="w-4 h-4 text-zinc-950" />
                </button>
                <div className="text-center text-[11px] text-zinc-400 mt-2 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {lang === 'ar'
                      ? 'إرسال مباشر إلى واتساب حسن (0635392503) مع ملخص الطلب'
                      : lang === 'amz'
                      ? 'ⵓⵙⵔⵉⴷ ⵖⵔ ⵡⴰⵜⵙⴰⴱ ⵏ ⵃⴰⵙⴰⵏ (0635392503)'
                      : lang === 'en'
                      ? 'Direct WhatsApp to Hassan (0635392503) with full booking summary'
                      : 'Direct WhatsApp à Hassan (0635392503) avec récapitulatif complet'}
                  </span>
                </div>
              </div>

            </form>
          </div>
        )}

      </div>
    </div>
  );
};
