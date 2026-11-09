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
  RotateCcw
} from 'lucide-react';
import { 
  getAllBookings, 
  updateBookingStatus, 
  deleteBooking 
} from '../utils/bookingStore';
import { AppointmentBooking, BookingStatus } from '../types';
import { SALON_INFO } from '../data/barbershopData';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [bookings, setBookings] = useState<AppointmentBooking[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Reschedule dialog state
  const [reschedulingBooking, setReschedulingBooking] = useState<AppointmentBooking | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('17:00');
  const [adminNote, setAdminNote] = useState('');

  const VALID_PINS = ['1980', '0635392503', '1234'];

  const reloadBookings = () => {
    setBookings(getAllBookings());
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      reloadBookings();
    }
  }, [isOpen, isAuthenticated]);

  useEffect(() => {
    const handleUpdate = () => {
      if (isAuthenticated) reloadBookings();
    };
    window.addEventListener('salon_bookings_updated', handleUpdate);
    return () => window.removeEventListener('salon_bookings_updated', handleUpdate);
  }, [isAuthenticated]);

  if (!isOpen) return null;

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (VALID_PINS.includes(pinInput.trim())) {
      setIsAuthenticated(true);
      setPinError(false);
      reloadBookings();
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleConfirm = (id: string) => {
    updateBookingStatus(id, 'confirmed', 'Confirmé par Hassan. Votre créneau est réservé.');
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
    setAdminNote('Décalé pour vous éviter l’attente.');
  };

  const handleSaveReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingBooking) return;

    updateBookingStatus(
      reschedulingBooking.id,
      'rescheduled',
      adminNote,
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

  // Filtered list
  const filteredBookings = bookings.filter((b) => {
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesSearch =
      b.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.clientPhone.includes(searchQuery) ||
      b.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.barberName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Stats
  const totalCount = bookings.length;
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;
  const totalRevenue = bookings
    .filter((b) => b.status === 'confirmed')
    .reduce((sum, b) => sum + (b.finalTotalMAD || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col my-6 max-h-[90vh] overflow-hidden">
        
        {/* Barber Pole Top Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-white to-blue-600" />

        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 font-black">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  ESPACE ADMIN • SALON BOUMLIK
                </h2>
                {isAuthenticated && (
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Connecté (Hassan)
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Gestion des tickets, confirmation des créneaux & synchronisation directe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={() => setIsAuthenticated(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
                title="Verrouiller"
              >
                Déconnexion
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PIN Security Screen */}
        {!isAuthenticated ? (
          <div className="p-8 sm:p-12 text-center max-w-md mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-red-500 shadow-xl">
              <Lock className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Code PIN Administrateur</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Réservé à l'équipe du Salon Boumlik (Hassan). Entrez votre code à 4 chiffres (ou téléphone).
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                maxLength={10}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="Ex: 1980 ou 0635392503"
                className="w-full text-center text-xl font-mono tracking-widest bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-red-500"
                autoFocus
              />

              {pinError && (
                <p className="text-xs text-red-400 font-medium">
                  Code PIN invalide. Réessayez avec 1980 ou le numéro du salon.
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors shadow-lg shadow-red-600/20"
              >
                Accéder au Panneau d'Administration
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Dashboard View */
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Total Réservations</span>
                <p className="text-xl font-black text-white font-mono mt-0.5">{totalCount}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30">
                <span className="text-[10px] text-amber-400 uppercase font-bold">En Attente (Validation)</span>
                <p className="text-xl font-black text-amber-300 font-mono mt-0.5">{pendingCount}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 uppercase font-bold">Confirmés</span>
                <p className="text-xl font-black text-emerald-300 font-mono mt-0.5">{confirmedCount}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/30">
                <span className="text-[10px] text-blue-400 uppercase font-bold">Recette Confirmée</span>
                <p className="text-xl font-black text-blue-300 font-mono mt-0.5">{totalRevenue} MAD</p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold scrollbar-none">
                {['all', 'pending', 'confirmed', 'rescheduled', 'rejected'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                      statusFilter === st
                        ? 'bg-zinc-800 text-white border border-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {st === 'all' ? 'Toutes' : st}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nom, tél, #SB..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Bookings List */}
            <div className="space-y-3">
              {filteredBookings.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  Aucune réservation trouvée dans cette catégorie.
                </div>
              ) : (
                filteredBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
                  >
                    {/* Top Row: Ticket & Status & Time */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-black text-white">{b.ticketNumber}</span>
                        <span className="text-xs text-zinc-400 font-mono">📅 {b.date} • ⏰ {b.timeSlot}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-red-400">
                          Barbier: {b.barberName}
                        </span>
                      </div>

                      {/* Status badge */}
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                        b.status === 'confirmed'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : b.status === 'rescheduled'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : b.status === 'rejected'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                      }`}>
                        {b.status}
                      </span>
                    </div>

                    {/* Client & Price Details */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-white text-sm">{b.clientName}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <a
                            href={`tel:${b.clientPhone}`}
                            className="text-zinc-300 hover:text-white flex items-center gap-1 font-mono text-[11px]"
                          >
                            <Phone className="w-3 h-3 text-emerald-400" />
                            {b.clientPhone}
                          </a>
                          <a
                            href={`https://wa.me/${b.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `Bonjour ${b.clientName}, ici Hassan du Salon Boumlik concernant votre réservation ${b.ticketNumber}.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-semibold"
                          >
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </a>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-black text-red-500 font-mono">
                          {b.finalTotalMAD ?? 0} MAD
                        </div>
                        {(b.totalSavingsMAD || 0) > 0 && (
                          <div className="text-[10px] text-emerald-400 font-medium">
                            Économie client: {b.totalSavingsMAD} MAD
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prestations summary */}
                    <div className="bg-black/40 p-2 rounded-lg border border-zinc-800/80 text-[11px] text-zinc-300 flex flex-wrap gap-2">
                      {(b.cartItemsSummary || []).map((item, i) => (
                        <span key={i} className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-200">
                          {item.name} ({item.finalPrice} MAD)
                        </span>
                      ))}
                    </div>

                    {/* Admin notes if any */}
                    {b.adminNotes && (
                      <p className="text-[11px] text-zinc-400 italic bg-zinc-950 p-2 rounded border border-zinc-800">
                        Note: {b.adminNotes}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        {b.status !== 'confirmed' && (
                          <button
                            onClick={() => handleConfirm(b.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" /> Confirmer
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenReschedule(b)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 transition-colors"
                        >
                          <Clock3 className="w-3.5 h-3.5" /> Décaler créneau
                        </button>

                        {b.status !== 'rejected' && (
                          <button
                            onClick={() => handleReject(b.id)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-600/30 text-zinc-300 hover:text-red-300 text-xs font-semibold transition-colors"
                          >
                            Refuser
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Reschedule Modal Pop-over */}
        {reschedulingBooking && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-20">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <h3 className="font-bold text-white text-sm">
                  Décaler le rendez-vous {reschedulingBooking.ticketNumber}
                </h3>
                <button
                  onClick={() => setReschedulingBooking(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveReschedule} className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-300 block mb-1 font-semibold">Nouvelle Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 block mb-1 font-semibold">Nouvel Horaire</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 block mb-1 font-semibold">Message pour le client (visible sur son suivi)</label>
                  <input
                    type="text"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReschedulingBooking(null)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
                  >
                    Enregistrer et Notifier
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
