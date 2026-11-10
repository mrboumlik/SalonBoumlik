import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  Clock, 
  Clock3, 
  XCircle, 
  Trash2, 
  Phone, 
  MessageCircle, 
  Calendar, 
  User, 
  Filter, 
  Search, 
  AlertCircle,
  TrendingUp,
  Scissors,
  Check,
  RotateCcw,
  Save,
  ShieldCheck,
  Users
} from 'lucide-react';
import { 
  getAllBookings, 
  updateBookingStatus, 
  updateBookingAdminNote,
  deleteBooking 
} from '../utils/bookingStore';
import { AppointmentBooking, BookingStatus } from '../types';
import { SALON_INFO, TEAM_MEMBERS } from '../data/barbershopData';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StaffSession {
  barberId: 'all' | 'hassan' | 'anouar-arif' | 'lahcen-lhanz' | 'mounir-querdeny';
  name: string;
  role: 'master' | 'barber';
  title: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [pinInput, setPinInput] = useState('');
  const [session, setSession] = useState<StaffSession | null>(null);
  const [pinError, setPinError] = useState(false);
  const [bookings, setBookings] = useState<AppointmentBooking[]>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [masterBarberFilter, setMasterBarberFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Reschedule dialog state
  const [reschedulingBooking, setReschedulingBooking] = useState<AppointmentBooking | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('17:00');
  const [rescheduleNote, setRescheduleNote] = useState('');

  // Per-booking client note state
  const [notesState, setNotesState] = useState<Record<string, string>>({});
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  const reloadBookings = () => {
    const all = getAllBookings();
    setBookings(all);
    const initialNotes: Record<string, string> = {};
    all.forEach((b) => {
      initialNotes[b.id] = b.adminNotes || '';
    });
    setNotesState(initialNotes);
  };

  useEffect(() => {
    if (isOpen && session) {
      reloadBookings();
    }
  }, [isOpen, session]);

  useEffect(() => {
    const handleUpdate = () => {
      if (session) reloadBookings();
    };
    window.addEventListener('salon_bookings_updated', handleUpdate);
    return () => window.removeEventListener('salon_bookings_updated', handleUpdate);
  }, [session]);

  if (!isOpen) return null;

  // RBAC Authentication
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();

    // 1. Hassan (Master Admin): PINs 1994 OR 0635392503
    if (cleanPin === '1994' || cleanPin === '0635392503' || cleanPin === '212635392503') {
      setSession({
        barberId: 'all',
        name: 'Hassan ait boumlik',
        role: 'master',
        title: 'Master Admin / المؤسس وخبير الحلاقة',
      });
      setPinError(false);
      setPinInput('');
      reloadBookings();
      return;
    }

    // 2. Anouar (Barber): PIN 1234
    if (cleanPin === '1234') {
      setSession({
        barberId: 'anouar-arif',
        name: 'Anouar arif',
        role: 'barber',
        title: 'Barbier / حلاق',
      });
      setPinError(false);
      setPinInput('');
      reloadBookings();
      return;
    }

    // 3. Lahcen (Barber): PIN 5678
    if (cleanPin === '5678') {
      setSession({
        barberId: 'lahcen-lhanz',
        name: 'Lahcen lhanz',
        role: 'barber',
        title: 'Barbier / حلاق',
      });
      setPinError(false);
      setPinInput('');
      reloadBookings();
      return;
    }

    // 4. Mounir (Barber): PIN 1111
    if (cleanPin === '1111') {
      setSession({
        barberId: 'mounir-querdeny',
        name: 'Mounir querdeny',
        role: 'barber',
        title: 'Barbier / حلاق',
      });
      setPinError(false);
      setPinInput('');
      reloadBookings();
      return;
    }

    // Invalid PIN
    setPinError(true);
    setPinInput('');
  };

  const handleLogout = () => {
    setSession(null);
    setPinInput('');
    setPinError(false);
  };

  const handleConfirm = (id: string) => {
    updateBookingStatus(id, 'confirmed', `Confirmé par ${session?.name || 'le salon'}. Votre créneau est réservé.`);
    reloadBookings();
  };

  const handleReject = (id: string) => {
    const reason = window.prompt('Motif du refus ou créneau complet (optionnel) :', 'Créneau indisponible, veuillez choisir un autre horaire.');
    if (reason !== null) {
      updateBookingStatus(id, 'rejected', reason || 'Non disponible');
      reloadBookings();
    }
  };

  const handleOpenReschedule = (booking: AppointmentBooking) => {
    setReschedulingBooking(booking);
    setNewDate(booking.date);
    setNewTime(booking.timeSlot);
    setRescheduleNote('Décalé pour vous éviter l’attente au salon.');
  };

  const handleSaveReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingBooking) return;

    updateBookingStatus(
      reschedulingBooking.id,
      'rescheduled',
      rescheduleNote,
      { date: newDate, time: newTime }
    );
    setReschedulingBooking(null);
    reloadBookings();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer définitivement cette réservation ?')) {
      deleteBooking(id);
      reloadBookings();
    }
  };

  const handleSaveClientNote = (bookingId: string) => {
    const note = notesState[bookingId] || '';
    updateBookingAdminNote(bookingId, note);
    setSavedNoteId(bookingId);
    setTimeout(() => setSavedNoteId(null), 2500);
    reloadBookings();
  };

  const formatClientWhatsAppPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('212')) return digits;
    if (digits.startsWith('0')) return `212${digits.slice(1)}`;
    return `212${digits}`;
  };

  // RBAC Filtering:
  // - Barbers see ONLY bookings assigned to their barberId
  // - Master (Hassan) sees ALL bookings, with optional filter by barber
  const visibleBookings = bookings.filter((b) => {
    if (!session) return false;

    // Barber view constraint
    if (session.role === 'barber') {
      const isAssigned = b.barberId === session.barberId || 
        b.barberName.toLowerCase().includes(session.name.toLowerCase().split(' ')[0]);
      if (!isAssigned) return false;
    } else if (session.role === 'master') {
      // Hassan's optional barber filter
      if (masterBarberFilter !== 'all') {
        const matches = b.barberId === masterBarberFilter || 
          b.barberName.toLowerCase().includes(masterBarberFilter.toLowerCase().split('-')[0]);
        if (!matches) return false;
      }
    }

    // Status filter
    if (statusFilter !== 'all' && b.status !== statusFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = b.clientName.toLowerCase().includes(q) ||
        b.clientPhone.includes(q) ||
        b.ticketNumber.toLowerCase().includes(q) ||
        b.barberName.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Stats calculation
  const totalCount = visibleBookings.length;
  const pendingCount = visibleBookings.filter((b) => b.status === 'pending').length;
  const confirmedCount = visibleBookings.filter((b) => b.status === 'confirmed').length;
  const totalRevenue = visibleBookings
    .filter((b) => b.status === 'confirmed')
    .reduce((sum, b) => sum + (b.finalTotalMAD || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col my-6 max-h-[92vh] overflow-hidden">
        
        {/* Barber Pole Top Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-white to-blue-600" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 font-black flex-shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white font-display">
                  ESPACE GESTION • SALON BOUMLIK
                </h2>
                {session && (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                    session.role === 'master' 
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                      : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  }`}>
                    <ShieldCheck className="w-3 h-3" />
                    <span>{session.name} ({session.role === 'master' ? 'Master Admin' : 'Barbier'})</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                {session?.role === 'master' 
                  ? 'Gestion globale des réservations & notes clients en temps réel' 
                  : `Tableau de bord personnel : rendez-vous assignés à ${session?.name || 'vous'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                title="Déconnexion"
              >
                Déconnexion
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SECURE PIN SCREEN (CRITICAL: No PIN in placeholder, type password) */}
        {!session ? (
          <div className="p-8 sm:p-12 text-center max-w-md mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-amber-400 shadow-xl">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Espace Staff & Direction</h3>
              <p className="text-xs text-zinc-400">
                Accès sécurisé pour l'équipe du Salon Boumlik. Veuillez entrer votre code confidentiel.
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="Enter 4-digit PIN"
                  className="w-full text-center text-xl font-mono tracking-widest bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  autoFocus
                  required
                />
              </div>

              {pinError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>Code PIN invalide. Veuillez réessayer.</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Connexion au Tableau de Bord
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED STAFF DASHBOARD */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                  Total Billets
                </span>
                <span className="text-2xl font-black text-white font-mono">{totalCount}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">
                  En Attente
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono">{pendingCount}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                  Confirmés
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">{confirmedCount}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                  Chiffre Confirmé
                </span>
                <span className="text-2xl font-black text-white font-mono">{totalRevenue} MAD</span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Recherche client, ticket, téléphone..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Status Filter Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  {['all', 'pending', 'confirmed', 'rescheduled', 'rejected'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        statusFilter === st
                          ? 'bg-amber-500 text-black shadow'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {st === 'all' && 'Tous'}
                      {st === 'pending' && 'En Attente'}
                      {st === 'confirmed' && 'Confirmés'}
                      {st === 'rescheduled' && 'Replanifiés'}
                      {st === 'rejected' && 'Refusés'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Admin Only: Barber Filter Tabs */}
              {session.role === 'master' && (
                <div className="pt-2 border-t border-zinc-800 flex items-center gap-2 overflow-x-auto text-xs">
                  <span className="text-zinc-400 font-semibold text-[11px] flex items-center gap-1 flex-shrink-0">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Filtrer par Barbier :</span>
                  </span>

                  <button
                    onClick={() => setMasterBarberFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      masterBarberFilter === 'all'
                        ? 'bg-zinc-200 text-black'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    Tous les Barbiers ({bookings.length})
                  </button>

                  {TEAM_MEMBERS.map((b) => {
                    const count = bookings.filter(
                      (item) => item.barberId === b.id || item.barberName.toLowerCase().includes(b.name.fr.toLowerCase().split(' ')[0])
                    ).length;

                    return (
                      <button
                        key={b.id}
                        onClick={() => setMasterBarberFilter(b.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          masterBarberFilter === b.id
                            ? 'bg-amber-500 text-black shadow'
                            : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        <span className="truncate">{b.name.fr.split(' ')[0]}</span>
                        <span className="opacity-75 font-mono">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bookings List */}
            {visibleBookings.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-xs">
                Aucune réservation ne correspond à vos critères.
              </div>
            ) : (
              <div className="space-y-4">
                {visibleBookings.map((booking) => {
                  const clientPhoneClean = formatClientWhatsAppPhone(booking.clientPhone);
                  const isNoteSaved = savedNoteId === booking.id;

                  return (
                    <div
                      key={booking.id}
                      className="p-4 sm:p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700/80 transition-all space-y-4 shadow-lg"
                    >
                      {/* Top Bar: Ticket #, Date & Time, Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-base font-black text-white bg-black/60 px-2.5 py-1 rounded-lg border border-zinc-800">
                            {booking.ticketNumber}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">
                            📅 {booking.date} • ⏰ {booking.timeSlot}
                          </span>
                          <span className="text-xs font-bold text-amber-400">
                            ✂️ {booking.barberName}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            booking.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                            booking.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                            booking.status === 'rescheduled' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                            'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                      </div>

                      {/* Client Info with DIRECT WHATSAPP BUTTON (Requirement #4) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">Client :</span>
                            <span className="font-bold text-white text-sm">{booking.clientName}</span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                            <span className="text-zinc-400">Téléphone :</span>
                            <div className="flex items-center gap-2">
                              <span dir="ltr" className="font-mono text-zinc-200">{booking.clientPhone}</span>
                              
                              {/* Direct WhatsApp Client Button */}
                              <a
                                href={`https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(
                                  `Salam ${booking.clientName}, ici ${session.name} de Salon Boumlik concernant votre réservation ${booking.ticketNumber} prévue le ${booking.date} à ${booking.timeSlot}.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors shadow-sm"
                                title="Contacter directement sur WhatsApp sans enregistrer le numéro"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp Client</span>
                              </a>
                            </div>
                          </div>

                          {booking.notes && (
                            <div className="pt-1 text-[11px] text-zinc-400">
                              <span className="text-zinc-500 font-semibold">Note client : </span>
                              <span>{booking.notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Services & Total */}
                        <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 space-y-1.5 text-xs">
                          <div className="text-zinc-400 font-semibold text-[11px]">Services demandés :</div>
                          <div className="space-y-0.5">
                            {(booking.cartItemsSummary || []).map((itm, i) => (
                              <div key={i} className="flex justify-between text-zinc-300 text-[11px]">
                                <span>• {itm.name}</span>
                                <span className="font-mono font-bold text-white">{itm.finalPrice} MAD</span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-1.5 border-t border-zinc-800 flex justify-between font-bold">
                            <span className="text-zinc-300">Total à encaisser :</span>
                            <span className="text-amber-400 font-mono text-sm">{booking.finalTotalMAD} MAD</span>
                          </div>
                        </div>
                      </div>

                      {/* CLIENT STATUS NOTE (UNIVERSAL TICKET MANAGEMENT - Requirement #4) */}
                      <div className="p-3 rounded-xl bg-[#12141B] border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>ملاحظة للزبون / Note pour le Suivi Client :</span>
                          </label>
                          <span className="text-[10px] text-zinc-500">
                            (Visible par le client sur sa page de suivi)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={notesState[booking.id] ?? ''}
                            onChange={(e) => setNotesState({ ...notesState, [booking.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveClientNote(booking.id);
                              }
                            }}
                            placeholder="Ex: Fauteuil réservé, merci d'arriver 5 minutes à l'avance..."
                            className="flex-1 bg-black/60 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveClientNote(booking.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isNoteSaved
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                            }`}
                          >
                            {isNoteSaved ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Enregistré !</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                <span>Enregistrer</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Action Triggers */}
                      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {booking.status !== 'confirmed' && (
                            <button
                              onClick={() => handleConfirm(booking.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Confirmer</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenReschedule(booking)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Clock3 className="w-3.5 h-3.5" />
                            <span>Décaler Horaire</span>
                          </button>

                          {booking.status !== 'rejected' && (
                            <button
                              onClick={() => handleReject(booking.id)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Refuser
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => handleDelete(booking.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Supprimer la réservation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>

      {/* Reschedule Dialog Modal */}
      {reschedulingBooking && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-white text-base">
              Proposer un Nouvel Horaire pour {reschedulingBooking.clientName}
            </h3>
            
            <form onSubmit={handleSaveReschedule} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nouvelle Date :</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nouvelle Heure :</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Message d'explication au client :</label>
                <input
                  type="text"
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                  placeholder="Ex: Décalé de 30 min..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReschedulingBooking(null)}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  Mettre à jour & Notifier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
