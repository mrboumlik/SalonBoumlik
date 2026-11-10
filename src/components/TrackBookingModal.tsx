import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Ticket, 
  Phone, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Clock3, 
  XCircle, 
  Sparkles,
  MessageCircle,
  Copy,
  Scissors,
  RefreshCw
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getBookingByTicket, getBookingsByPhone, getAllBookings } from '../utils/bookingStore';
import { AppointmentBooking, BookingStatus } from '../types';
import { SALON_INFO } from '../data/barbershopData';

interface TrackBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSearch?: string;
}

export const TrackBookingModal: React.FC<TrackBookingModalProps> = ({
  isOpen,
  onClose,
  initialSearch = '',
}) => {
  const { lang, t, isRtl } = useLanguage();
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [foundBookings, setFoundBookings] = useState<AppointmentBooking[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState<string | null>(null);

  const performSearch = (query: string) => {
    const q = query.trim();
    if (!q) {
      setFoundBookings([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    // Check if query is ticket-like or phone-like
    const byTicket = getBookingByTicket(q);
    if (byTicket) {
      setFoundBookings([byTicket]);
      return;
    }

    const byPhone = getBookingsByPhone(q);
    if (byPhone.length > 0) {
      setFoundBookings(byPhone);
      return;
    }

    // Try name or loose match
    const all = getAllBookings();
    const loose = all.filter(
      (b) =>
        b.clientName.toLowerCase().includes(q.toLowerCase()) ||
        b.ticketNumber.toLowerCase().includes(q.toLowerCase())
    );
    setFoundBookings(loose);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialSearch) {
        setSearchTerm(initialSearch);
        performSearch(initialSearch);
      } else {
        // default to recent booking if exists
        const all = getAllBookings();
        if (all.length > 0) {
          setFoundBookings([all[0]]);
          setHasSearched(false);
        }
      }
    }
  }, [isOpen, initialSearch]);

  // Real-time synchronization: listen to storage updates
  useEffect(() => {
    const handleUpdate = () => {
      if (searchTerm) {
        performSearch(searchTerm);
      } else {
        const all = getAllBookings();
        if (all.length > 0) {
          setFoundBookings([all[0]]);
        }
      }
    };

    window.addEventListener('salon_bookings_updated', handleUpdate);
    return () => window.removeEventListener('salon_bookings_updated', handleUpdate);
  }, [searchTerm]);

  if (!isOpen) return null;

  const handleCopy = (ticket: string) => {
    navigator.clipboard.writeText(ticket);
    setCopiedTicket(ticket);
    setTimeout(() => setCopiedTicket(null), 2000);
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'تم تأكيد الحجز من الصالون' : lang === 'es' ? 'Reserva confirmada' : 'Rendez-vous Confirmé'}
            </span>
          </div>
        );
      case 'rescheduled':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold text-xs">
            <Clock3 className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'تم تعديل الموعد (مرفق بالأسفل)' : lang === 'es' ? 'Cita reprogramada' : 'Hora Réaménagée'}
            </span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-xs">
            <XCircle className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'الموعد غير متاح / ملغى' : lang === 'es' ? 'Cita cancelada/no disponible' : 'Demande Annulée / Indisponible'}
            </span>
          </div>
        );
      case 'pending':
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'قيد المراجعة وتجهيز الكرسي' : lang === 'es' ? 'Pendiente de confirmación' : 'En Attente de Validation'}
            </span>
          </div>
        );
    }
  };

  const ui = {
    title: {
      fr: 'Suivi de Votre Réservation en Temps Réel',
      ar: 'تتبع موعدك وحالة الحجز مباشرة',
      en: 'Real-Time Appointment Tracking',
      amz: 'ⵜⵉⴹⴰⴼ ⵏ ⵓⵙⵔⵓⵙ ⵏⵏⴽ',
      es: 'Seguimiento de tu reserva en tiempo real',
    }[lang] || 'Suivi de Réservation',
    subtitle: {
      fr: 'Entrez votre numéro de ticket (ex: #SB-1024) ou votre numéro de téléphone',
      ar: 'أدخل رقم التذكرة (مثل: #SB-1024) أو رقم هاتفك لمعرفة الحالة الحالية',
      en: 'Enter your ticket number (e.g., #SB-1024) or phone number to view live status',
      amz: 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⴽⵉ ⵏⵖ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ',
      es: 'Introduce tu número de ticket (ej: #SB-1024) o tu teléfono',
    }[lang] || 'Entrez votre numéro de ticket',
    placeholder: {
      fr: 'Rechercher par #SB-XXXX ou Téléphone...',
      ar: 'ابحث برقم التذكرة أو رقم الهاتف...',
      en: 'Search by #SB-XXXX or Phone...',
      amz: 'ⵔⵣⵓ ⵙ #SB-XXXX ⵏⵖ ⵜⵉⵍⵉⴼⵓⵏ...',
      es: 'Buscar por #SB-XXXX o teléfono...',
    }[lang] || 'Rechercher...',
    searchBtn: {
      fr: 'Vérifier',
      ar: 'تحقق الآن',
      en: 'Check Status',
      amz: 'ⵥⵕ',
      es: 'Comprobar',
    }[lang] || 'Vérifier',
    noResults: {
      fr: 'Aucune réservation trouvée pour cette recherche.',
      ar: 'لم يتم العثور على أي حجز مطابق. تأكد من رقم التذكرة أو رقم الهاتف.',
      en: 'No booking found matching your search.',
      amz: 'ⵓⵔ ⵉⵍⵍⵉ ⵓⵙⵔⵓⵙ ⵙ ⵓⵟⵟⵓⵏ ⴰⴷ.',
      es: 'No se encontró ninguna reserva para esta búsqueda.',
    }[lang] || 'Aucune réservation trouvée.',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8">
        
        {/* Header with barber pole top line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-white to-blue-600" />
        
        <div className="p-6 border-b border-zinc-800 flex items-start justify-between bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400">
              <Ticket className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">{ui.title}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">{ui.subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 pb-2">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              performSearch(searchTerm);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={ui.placeholder}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-colors shadow-md flex items-center gap-1.5"
            >
              <span>{ui.searchBtn}</span>
            </button>
          </form>
        </div>

        {/* Results List */}
        <div className="p-6 pt-3 space-y-4 max-h-[60vh] overflow-y-auto">
          {foundBookings.length === 0 && hasSearched ? (
            <div className="text-center py-8 text-zinc-400 text-xs">
              <AlertCircle className="w-8 h-8 text-amber-500/80 mx-auto mb-2" />
              <p>{ui.noResults}</p>
            </div>
          ) : (
            foundBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-4 hover:border-zinc-700 transition-all shadow-lg"
              >
                {/* Top card bar: Ticket & Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-white tracking-wider">
                      {booking.ticketNumber}
                    </span>
                    <button
                      onClick={() => handleCopy(booking.ticketNumber)}
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors text-xs flex items-center gap-1"
                      title="Copier le ticket"
                    >
                      {copiedTicket === booking.ticketNumber ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {getStatusBadge(booking.status)}
                </div>

                {/* Reschedule alert banner if applicable */}
                {booking.status === 'rescheduled' && booking.rescheduledTo && (
                  <div className="p-3 bg-blue-950/40 border border-blue-500/40 rounded-xl text-xs text-blue-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-blue-300">
                      <Clock3 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تعديل التوقيت المقترح من الحلاق:' : 'Nouvel Horaire Proposé :'}</span>
                    </div>
                    <p className="font-mono text-sm font-bold text-white">
                      📅 {booking.rescheduledTo.date} • ⏰ {booking.rescheduledTo.time}
                    </p>
                  </div>
                )}

                {/* Staff Note from Dashboard (Visible to Client) */}
                {booking.adminNotes && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300 text-[11px]">
                      <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === 'ar' ? 'ملاحظة خاصة من الحلاق:' : 'Message de confirmation du Barbier :'}</span>
                    </div>
                    <p className="text-xs text-zinc-200 font-medium leading-relaxed italic">
                      "{booking.adminNotes}"
                    </p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {lang === 'ar' ? 'الزبون' : 'Client'}
                    </span>
                    <span className="font-bold text-white truncate block">{booking.clientName}</span>
                    <span dir="ltr" className="text-[11px] font-mono text-zinc-400 block">{booking.clientPhone}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {lang === 'ar' ? 'الحلاق المختار' : 'Barbier Assigné'}
                    </span>
                    <span className="font-bold text-red-400 truncate block">{booking.barberName}</span>
                    <span className="text-[11px] text-zinc-400 block">{lang === 'ar' ? 'كرسي خاص' : 'Fauteuil réservé'}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {lang === 'ar' ? 'التاريخ المجدول' : 'Date de passage'}
                    </span>
                    <span className="font-mono font-bold text-white block">{booking.date}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                      {lang === 'ar' ? 'التوقيت المختار' : 'Heure de Passage'}
                    </span>
                    <span className="font-mono font-bold text-blue-400 block">{booking.timeSlot}</span>
                  </div>
                </div>

                {/* Cart summary */}
                <div className="p-3 bg-black/50 rounded-xl border border-zinc-800/80 space-y-2 text-xs">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                    {lang === 'ar' ? 'الخدمات المحجوزة' : 'Prestations Demandées'}
                  </span>
                  <div className="space-y-1">
                    {(booking.cartItemsSummary || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-zinc-300">
                        <span>• {item.name} {item.discountApplied ? <span className="text-[10px] text-emerald-400">({item.discountApplied})</span> : null}</span>
                        <span className="font-mono font-bold text-white">{item.finalPrice} MAD</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex justify-between items-center font-bold">
                    <span className="text-zinc-300">{lang === 'ar' ? 'المجموع النهائي:' : 'Montant Total :'}</span>
                    <div className="text-right">
                      {(booking.totalSavingsMAD || 0) > 0 && (
                        <span className="text-[10px] text-emerald-400 block font-normal">
                          {lang === 'ar' ? `وفّرت: ${booking.totalSavingsMAD} MAD` : `Économie : ${booking.totalSavingsMAD} MAD`}
                        </span>
                      )}
                      <span className="text-base text-red-500 font-black font-mono">
                        {booking.finalTotalMAD ?? 0} MAD
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Help Button */}
                <div className="pt-1 flex items-center justify-between text-xs">
                  <a
                    href={`https://wa.me/${SALON_INFO.whatsappNumber}?text=${encodeURIComponent(
                      `Salam Salon Boumlik, je souhaite avoir des détails sur ma réservation ${booking.ticketNumber}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تواصل معنا واتساب حول التذكرة' : 'Contacter le Salon par WhatsApp'}</span>
                  </a>

                  <span className="text-[10px] text-zinc-400">
                    Rue Bir Anzarane, Taroudant
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
            <span>{lang === 'ar' ? 'التحديث التلقائي الفوري مفعّل' : 'Synchronisation directe avec le salon'}</span>
          </span>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
          >
            {lang === 'ar' ? 'إغلاق' : 'Fermer'}
          </button>
        </div>

      </div>
    </div>
  );
};
