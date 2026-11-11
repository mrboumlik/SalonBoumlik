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
  Users,
  QrCode,
  Archive,
  CalendarDays,
  Sparkles,
  Camera,
  RefreshCw,
  Sliders
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { requestWebNotificationPermission, sendWebNotification } from '../utils/notifications';
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
  
  // Date Views: 'today' or 'archive'
  const [activeTab, setActiveTab] = useState<'today' | 'archive'>('today');
  const [archiveDateFilter, setArchiveDateFilter] = useState<string>('');

  // Status Filter: 'all', 'pending', 'confirmed', 'rejected'
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [masterBarberFilter, setMasterBarberFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // QR Scanner Modal & Camera Controls
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannerCameraError, setScannerCameraError] = useState<string | null>(null);
  const [scannedTicketNotice, setScannedTicketNotice] = useState<string | null>(null);

  // Reschedule dialog state
  const [reschedulingBooking, setReschedulingBooking] = useState<AppointmentBooking | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('17:00');
  const [rescheduleNote, setRescheduleNote] = useState('');

  // Per-booking client note state
  const [notesState, setNotesState] = useState<Record<string, string>>({});
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

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

  // Handler to open scanner with instant browser native permission request (navigator.mediaDevices.getUserMedia)
  const handleOpenScanner = async () => {
    setScannerCameraError(null);
    setIsScannerOpen(true);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacingMode },
        });
        // Immediately stop temporary test tracks after obtaining permission
        stream.getTracks().forEach((track) => track.stop());
      } catch (err: any) {
        console.warn('Initial camera permission request warning:', err);
      }
    }
  };

  // Switch between Rear (environment) and Front (user) camera
  const handleToggleCamera = () => {
    setCameraFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // QR Scanner initialization using Html5Qrcode with forced rear/environment camera by default
  useEffect(() => {
    if (!isScannerOpen) return;

    let html5Qr: Html5Qrcode | null = null;
    let isStopped = false;

    const timer = setTimeout(async () => {
      try {
        const container = document.getElementById('qr-reader-container');
        if (!container) return;

        html5Qr = new Html5Qrcode('qr-reader-container');

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5Qr.start(
          { facingMode: cameraFacingMode },
          config,
          (decodedText) => {
            if (isStopped) return;
            isStopped = true;
            let ticket = decodedText;
            if (decodedText.includes('track=')) {
              ticket = decodeURIComponent(decodedText.split('track=')[1].split('&')[0]);
            }
            setSearchQuery(ticket.trim());
            setScannedTicketNotice(`Ticket scanné : ${ticket.trim()}`);
            if (html5Qr && html5Qr.isScanning) {
              html5Qr.stop().then(() => html5Qr?.clear()).catch(console.error);
            }
            setIsScannerOpen(false);
          },
          (errorMessage) => {
            // scanning frame noise, ignore
          }
        );
      } catch (err: any) {
        console.error('Html5Qrcode scanner failed to start:', err);
        setScannerCameraError(
          err?.message || 'Impossible d’accéder à la caméra. Vérifiez les autorisations de votre navigateur.'
        );
      }
    }, 250);

    return () => {
      isStopped = true;
      clearTimeout(timer);
      if (html5Qr && html5Qr.isScanning) {
        html5Qr.stop().then(() => html5Qr?.clear()).catch(console.error);
      }
    };
  }, [isScannerOpen, cameraFacingMode]);

  if (!isOpen) return null;

  // RBAC Authentication (Password input type, no exposed PINs in placeholder)
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();

    let newSession: StaffSession | null = null;

    // 1. Hassan (Master Admin): PINs 1994 OR 0635392503
    if (cleanPin === '1994' || cleanPin === '0635392503' || cleanPin === '212635392503') {
      newSession = {
        barberId: 'all',
        name: 'Hassan ait boumlik',
        role: 'master',
        title: 'Master Admin / المؤسس وخبير الحلاقة',
      };
    } else if (cleanPin === '1234') {
      // 2. Anouar (Barber): PIN 1234
      newSession = {
        barberId: 'anouar-arif',
        name: 'Anouar arif',
        role: 'barber',
        title: 'Barbier / حلاق',
      };
    } else if (cleanPin === '5678') {
      // 3. Lahcen (Barber): PIN 5678
      newSession = {
        barberId: 'lahcen-lhanz',
        name: 'Lahcen lhanz',
        role: 'barber',
        title: 'Barbier / حلاق',
      };
    } else if (cleanPin === '1111') {
      // 4. Mounir (Barber): PIN 1111
      newSession = {
        barberId: 'mounir-querdeny',
        name: 'Mounir querdeny',
        role: 'barber',
        title: 'Barbier / حلاق',
      };
    }

    if (newSession) {
      setSession(newSession);
      setPinError(false);
      setPinInput('');
      reloadBookings();

      // Trigger Web Notification permission prompt immediately upon successfully logging into /#admin
      requestWebNotificationPermission().then((permission) => {
        if (permission === 'granted') {
          sendWebNotification('لوحة التحكم نشطة • صالون بومليك', {
            body: `مرحباً ${newSession?.name}، تم تفعيل الإشعارات الفورية للحجوزات الجديدة والتحديثات.`,
          });
        }
      });
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

  // Helper to find barber color
  const getBarberColor = (booking: AppointmentBooking) => {
    if (booking.barberColor) return booking.barberColor;
    const found = TEAM_MEMBERS.find((b) => b.id === booking.barberId);
    return found?.themeColor || '#D97706';
  };

  // RBAC & Date Filtering:
  const visibleBookings = bookings.filter((b) => {
    if (!session) return false;

    // 1. RBAC Constraint
    if (session.role === 'barber') {
      const isAssigned = b.barberId === session.barberId || 
        b.barberName.toLowerCase().includes(session.name.toLowerCase().split(' ')[0]);
      if (!isAssigned) return false;
    } else if (session.role === 'master') {
      if (masterBarberFilter !== 'all') {
        const matches = b.barberId === masterBarberFilter || 
          b.barberName.toLowerCase().includes(masterBarberFilter.toLowerCase().split('-')[0]);
        if (!matches) return false;
      }
    }

    // 2. Date View: 'today' or 'archive'
    if (activeTab === 'today') {
      if (b.date !== todayStr) return false;
    } else {
      // Archive View
      if (archiveDateFilter && b.date !== archiveDateFilter) {
        return false;
      }
    }

    // 3. Status Filter (Pending, Confirmed, Rejected)
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending' && b.status !== 'pending') return false;
      if (statusFilter === 'confirmed' && b.status !== 'confirmed') return false;
      if (statusFilter === 'rejected' && b.status !== 'rejected') return false;
    }

    // 4. Search query
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

  // KPI Calculations
  const todayTickets = bookings.filter((b) => b.date === todayStr);
  const pendingCount = todayTickets.filter((b) => b.status === 'pending').length;
  const confirmedCount = todayTickets.filter((b) => b.status === 'confirmed').length;
  const rejectedCount = todayTickets.filter((b) => b.status === 'rejected').length;

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

        {/* SECURE PIN SCREEN (Password input type, no exposed PINs in placeholder) */}
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
                  placeholder="••••"
                  className="w-full text-center text-2xl font-mono tracking-widest bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
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
            
            {/* Navigation Tabs: Today's View vs. Archive / History + QR Scanner Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('today');
                    setArchiveDateFilter('');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'today'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>تذاكر اليوم ({todayStr})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('archive')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'archive'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  <span>الأرشيف والسجل الكامل</span>
                </button>
              </div>

              {/* QR Scanner Tool */}
              <button
                type="button"
                onClick={handleOpenScanner}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>ماسح التذاكر (QR Scanner)</span>
              </button>
            </div>

            {scannedTicketNotice && (
              <div className="p-3 bg-blue-950/40 border border-blue-500/40 rounded-xl text-xs text-blue-200 flex items-center justify-between">
                <span>{scannedTicketNotice}</span>
                <button 
                  onClick={() => setScannedTicketNotice(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Archive Date Filter Picker (Shown only in Archive tab) */}
            {activeTab === 'archive' && (
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-amber-400" />
                  <span>تصفية الأرشيف حسب تاريخ محدد:</span>
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={archiveDateFilter}
                    onChange={(e) => setArchiveDateFilter(e.target.value)}
                    className="bg-black border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  {archiveDateFilter && (
                    <button
                      onClick={() => setArchiveDateFilter('')}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs"
                    >
                      عرض كل التواريخ
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TODAY'S KPI METRICS */}
            {activeTab === 'today' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                    تذاكر اليوم
                  </span>
                  <span className="text-2xl font-black text-white font-mono">{todayTickets.length}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">
                    قيد المراجعة (معلق)
                  </span>
                  <span className="text-2xl font-black text-amber-400 font-mono">{pendingCount}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                    مؤكد ومقبول
                  </span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">{confirmedCount}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-red-400 uppercase font-bold tracking-wider block">
                    مرفوض / ملغى
                  </span>
                  <span className="text-2xl font-black text-red-400 font-mono">{rejectedCount}</span>
                </div>
              </div>
            )}

            {/* Filter Toolbar & Status Tabs */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                
                {/* Search Input */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث برقم التذكرة، اسم الزبون، الهاتف..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Highly Visible Status Toggle Tabs: Pending (معلق), Confirmed (مقبول), Rejected (مرفوض) */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-zinc-200 text-black shadow'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    الكل
                  </button>

                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-zinc-800 text-amber-400 hover:bg-zinc-700'
                    }`}
                  >
                    معلق (Pending)
                  </button>

                  <button
                    onClick={() => setStatusFilter('confirmed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'confirmed'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-zinc-800 text-emerald-400 hover:bg-zinc-700'
                    }`}
                  >
                    مقبول (Confirmed)
                  </button>

                  <button
                    onClick={() => setStatusFilter('rejected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'rejected'
                        ? 'bg-red-600 text-white shadow'
                        : 'bg-zinc-800 text-red-400 hover:bg-zinc-700'
                    }`}
                  >
                    مرفوض (Rejected)
                  </button>
                </div>
              </div>

              {/* Master Admin Only: Barber Filter Tabs with Barber Color Indicators */}
              {session.role === 'master' && (
                <div className="pt-2 border-t border-zinc-800 flex items-center gap-2 overflow-x-auto text-xs">
                  <span className="text-zinc-400 font-semibold text-[11px] flex items-center gap-1 flex-shrink-0">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>تصفية حسب الحلاق :</span>
                  </span>

                  <button
                    onClick={() => setMasterBarberFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      masterBarberFilter === 'all'
                        ? 'bg-zinc-200 text-black'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    كل الحلاقين ({bookings.length})
                  </button>

                  {TEAM_MEMBERS.map((b) => {
                    const count = bookings.filter(
                      (item) => item.barberId === b.id || item.barberName.toLowerCase().includes(b.name.fr.toLowerCase().split(' ')[0])
                    ).length;
                    const bColor = b.themeColor || '#D97706';

                    return (
                      <button
                        key={b.id}
                        onClick={() => setMasterBarberFilter(b.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          masterBarberFilter === b.id
                            ? 'text-white shadow ring-1'
                            : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                        style={{
                          backgroundColor: masterBarberFilter === b.id ? bColor : undefined,
                          borderColor: bColor,
                        }}
                      >
                        <span 
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: bColor }}
                        />
                        <span className="truncate">{b.name.ar}</span>
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
                {activeTab === 'today'
                  ? 'لا توجد أي حجوزات مسجلة لهذا اليوم.'
                  : 'لا توجد أي تذاكر مطابقة في الأرشيف.'}
              </div>
            ) : (
              <div className="space-y-4">
                {visibleBookings.map((booking) => {
                  const clientPhoneClean = formatClientWhatsAppPhone(booking.clientPhone);
                  const isNoteSaved = savedNoteId === booking.id;
                  const barberColor = getBarberColor(booking);

                  return (
                    <div
                      key={booking.id}
                      className="p-4 sm:p-5 rounded-2xl bg-zinc-900/70 border-2 hover:border-zinc-700/80 transition-all space-y-4 shadow-lg relative overflow-hidden"
                      style={{
                        borderColor: `${barberColor}60`,
                      }}
                    >
                      {/* Barber Color Indicator Top Line */}
                      <div 
                        className="h-1 -mx-5 -mt-5 mb-3"
                        style={{ backgroundColor: barberColor }}
                      />

                      {/* Top Bar: Ticket #, Barber Tag with Hex Color, Date & Time, Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-base font-black text-white bg-black/60 px-2.5 py-1 rounded-lg border border-zinc-800">
                            {booking.ticketNumber}
                          </span>

                          {/* Distinct Barber Hex Color Badge */}
                          <div 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white font-bold text-xs shadow-xs"
                            style={{ backgroundColor: barberColor }}
                          >
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span>{booking.barberName}</span>
                          </div>

                          <span className="text-xs text-zinc-400 font-mono">
                            📅 {booking.date} • ⏰ {booking.timeSlot}
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
                            {booking.status === 'confirmed' ? 'مقبول (Confirmed)' :
                             booking.status === 'pending' ? 'معلق (Pending)' :
                             booking.status === 'rescheduled' ? 'معدل (Rescheduled)' : 'مرفوض (Rejected)'}
                          </span>
                        </div>
                      </div>

                      {/* Client Info with DIRECT WHATSAPP BUTTON */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">الزبون :</span>
                            <span className="font-bold text-white text-sm">{booking.clientName}</span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                            <span className="text-zinc-400">الهاتف :</span>
                            <div className="flex items-center gap-2">
                              <span dir="ltr" className="font-mono text-zinc-200">{booking.clientPhone}</span>
                              
                              {/* Direct WhatsApp Client Button */}
                              <a
                                href={`https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(
                                  `Salam ${booking.clientName}, ici ${session.name} de Salon Boumlik concernant votre réservation ${booking.ticketNumber} prévue le ${booking.date} à ${booking.timeSlot}.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors shadow-xs"
                                title="Contacter directement sur WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp Client</span>
                              </a>
                            </div>
                          </div>

                          {booking.notes && (
                            <div className="pt-1 text-[11px] text-zinc-400">
                              <span className="text-zinc-500 font-semibold">ملاحظة الزبون: </span>
                              <span>{booking.notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Services & Total */}
                        <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 space-y-1.5 text-xs">
                          <div className="text-zinc-400 font-semibold text-[11px]">الخدمات المطلوبة :</div>
                          <div className="space-y-0.5">
                            {(booking.cartItemsSummary || []).map((itm, i) => (
                              <div key={i} className="flex justify-between text-zinc-300 text-[11px]">
                                <span>• {itm.name}</span>
                                <span className="font-mono font-bold text-white">{itm.finalPrice} MAD</span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-1.5 border-t border-zinc-800 flex justify-between font-bold">
                            <span className="text-zinc-300">المجموع المطلوب للأداء :</span>
                            <span className="text-amber-400 font-mono text-sm">{booking.finalTotalMAD} MAD</span>
                          </div>
                        </div>
                      </div>

                      {/* CLIENT STATUS NOTE (Universal Ticket Tools) */}
                      <div className="p-3 rounded-xl bg-[#12141B] border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>ملاحظة أو رد مخصص للزبون (Client Note) :</span>
                          </label>
                          <span className="text-[10px] text-zinc-500">
                            (تظهر مباشرة في صفحة تتبع الزبون فور حفظها)
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
                            placeholder="مثال: تم حجز الكرسي، مرحباً بك قبل الموعد بـ 5 دقائق..."
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
                                <span>تم الحفظ!</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                <span>حفظ الرد</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Action Triggers: Accept / Reschedule / Reject */}
                      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {booking.status !== 'confirmed' && (
                            <button
                              onClick={() => handleConfirm(booking.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>قبول وتأكيد</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenReschedule(booking)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Clock3 className="w-3.5 h-3.5" />
                            <span>تعديل الموعد</span>
                          </button>

                          {booking.status !== 'rejected' && (
                            <button
                              onClick={() => handleReject(booking.id)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              رفض الطلب
                            </button>
                          )}
                        </div>

                        <span className="text-[10px] text-zinc-500">
                          ID: {booking.id.slice(0, 14)}...
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>

      {/* QR Code Scanner Dialog Modal (Forced Rear/Environment by default, with camera switcher) */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                <Camera className="w-4 h-4 text-blue-400" />
                <span>مسح تذكرة الزبون</span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Switch Camera Button (Toggles between environment and user) */}
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-blue-300 hover:text-white text-xs font-semibold flex items-center gap-1 border border-zinc-700 transition-colors cursor-pointer"
                  title="Changer de caméra (Arrière / Avant)"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{cameraFacingMode === 'environment' ? 'كاميرا خلفية 🔄' : 'كاميرا أمامية 🔄'}</span>
                </button>

                <button 
                  onClick={() => setIsScannerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Error banner if browser denied or camera unavailable */}
            {scannerCameraError && (
              <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
                {scannerCameraError}
              </div>
            )}

            <div id="qr-reader-container" className="w-full rounded-xl overflow-hidden bg-black min-h-[260px] border border-zinc-800" />

            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>الوضع الافتراضي: الكاميرا الخلفية (Rear)</span>
              <button
                type="button"
                onClick={handleToggleCamera}
                className="text-blue-400 hover:underline font-bold"
              >
                تبديل الكاميرا
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Dialog Modal */}
      {reschedulingBooking && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-white text-base">
              تعديل الموعد المقترح لـ {reschedulingBooking.clientName}
            </h3>
            
            <form onSubmit={handleSaveReschedule} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">التاريخ الجديد :</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">التوقيت الجديد :</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">رسالة توضيحية للزبون :</label>
                <input
                  type="text"
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                  placeholder="مثال: تم تأخير الموعد بـ 30 دقيقة لتفادي الانتظار بالصالون..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReschedulingBooking(null)}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  تحديث وإشعار الزبون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
