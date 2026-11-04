import React from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  Trash2, 
  MessageCircle, 
  CalendarPlus, 
  Download, 
  BookmarkCheck,
  Building
} from 'lucide-react';
import { AppointmentBooking } from '../types';
import { downloadIcsFile, createGoogleCalendarUrl, createWhatsAppUrl, createFormattedWhatsAppQuoteMessage, getDrinkLabel } from '../utils/calendar';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';

interface MyAppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: AppointmentBooking[];
  onCancelAppointment: (id: string) => void;
  onOpenBooking: () => void;
}

export const MyAppointmentsModal: React.FC<MyAppointmentsModalProps> = ({
  isOpen,
  onClose,
  appointments,
  onCancelAppointment,
  onOpenBooking,
}) => {
  const { lang, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0C0E14] border border-zinc-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <BookmarkCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white font-display">
              {lang === 'ar' ? 'طلباتي ومواعيدي المحفوظة' : lang === 'amz' ? 'ⵉⵎⴰⴳⴰⵔⵏ ⵉⵏⵓ' : 'Mes Demandes & Rendez-vous'}
            </h3>
            <p className="text-xs text-zinc-400">
              {lang === 'ar' ? 'مواعيدك وتفاصيل تسعيرة الواتساب' : lang === 'amz' ? 'ⴰⴽⵓⴷ ⴷ ⵡⴰⵜⵉⴳ ⴳ ⵡⴰⵜⵙⴰⴱ' : 'Vos créneaux et devis WhatsApp au Salon Boumlik'}
            </p>
          </div>
        </div>

        {appointments.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <Calendar className="w-12 h-12 text-zinc-600 mx-auto" />
            <div className="text-sm font-semibold text-zinc-300">
              {lang === 'ar' ? 'لا توجد مواعيد محفوظة' : lang === 'amz' ? 'ⵓⵔ ⵍⵍⵉⵏ ⵉⵎⴰⴳⴰⵔⵏ' : 'Aucune demande enregistrée'}
            </div>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto">
              {lang === 'ar' 
                ? 'حدد خدماتك واطلب السعر المناسب مباشرة من حسن عبر الواتساب.' 
                : lang === 'amz' 
                ? 'ⵙⵜⵢ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⴽ ⴳ ⵡⴰⵜⵙⴰⴱ.' 
                : 'Sélectionnez vos prestations et demandez un devis directement à Hassan sur WhatsApp.'}
            </p>
            <button
              onClick={() => {
                onClose();
                onOpenBooking();
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer"
            >
              {lang === 'ar' ? 'طلب موعد جديد' : lang === 'amz' ? 'ⴰⵙⵔⵓⵙ ⴰⵎⴰⵢⵏⵓ' : 'Composer ma formule'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appt) => (
              <div
                key={appt.id}
                className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-5 space-y-3 relative group"
              >
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                      #{appt.ticketNumber}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                      Devis WhatsApp
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-zinc-400">
                    ~{appt.totalDurationMinutes} min
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>{appt.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{appt.timeSlot}</span>
                  </div>
                </div>

                <div className="text-xs text-zinc-300">
                  <span className="text-zinc-500">
                    {lang === 'ar' ? 'الحلاق : ' : lang === 'amz' ? 'ⴰⵎⴽⵕⴰⴹ : ' : 'Barbier : '}
                  </span>{' '}
                  <strong className="text-white">{appt.barberName}</strong>
                </div>

                {appt.drinkPreference && (
                  <div className="text-xs text-zinc-300">
                    <span className="text-zinc-500">
                      {lang === 'ar' ? 'المشروب المجاني : ' : lang === 'amz' ? 'ⵜⵉⵙⵉⵜ : ' : 'Boisson : '}
                    </span>{' '}
                    <span className="text-amber-300 font-medium">
                      {appt.drinkPreference === 'coffee'
                        ? (lang === 'ar' ? '☕ قهوة' : lang === 'amz' ? '☕ ⵜⴰⴽⴰⴼⵉⵜ' : '☕ Café Expresso')
                        : appt.drinkPreference === 'tea'
                        ? (lang === 'ar' ? '🍃 أتاي مغربي' : lang === 'amz' ? '🍃 ⴰⵜⴰⵢ ⵏ ⵍⵎⵖⵔⵉⴱ' : '🍃 Thé à la menthe')
                        : (lang === 'ar' ? '🚫 لا شيء' : lang === 'amz' ? '🚫 ⵡⴰⵍⵓ' : '🚫 Rien')}
                    </span>
                  </div>
                )}

                <div className="text-xs text-zinc-300">
                  <span className="text-zinc-500">
                    {lang === 'ar' ? 'الخدمات : ' : lang === 'amz' ? 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ : ' : 'Prestations : '}
                  </span>{' '}
                  <span className="text-amber-300 font-medium">
                    {appt.services.map((s) => s.name[lang] || s.name.fr).join(', ')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 pt-1">
                  <Building className="w-3 h-3 text-amber-500" />
                  <span>{SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}</span>
                </div>

                {/* Quick actions for this appointment */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80">
                  <a
                    href={createWhatsAppUrl(
                      SALON_INFO.whatsappNumber,
                      createFormattedWhatsAppQuoteMessage(appt)
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 px-2.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 text-[11px] font-bold flex items-center gap-1 border border-emerald-800/60"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={createGoogleCalendarUrl(appt)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] flex items-center gap-1"
                  >
                    <CalendarPlus className="w-3 h-3 text-blue-400" />
                    <span>Google Cal</span>
                  </a>

                  <button
                    onClick={() => downloadIcsFile(appt)}
                    className="p-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-amber-400" />
                    <span>.ICS</span>
                  </button>

                  <button
                    onClick={() => onCancelAppointment(appt.id)}
                    className="ml-auto p-1.5 px-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 text-[11px] flex items-center gap-1 border border-red-900/40"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
