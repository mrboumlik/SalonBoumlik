import { AppointmentBooking, Language } from '../types';

export type WhatsAppProvider = 'green-api' | 'ultramsg';

export interface WhatsAppAutomationConfig {
  enabled: boolean;
  provider: WhatsAppProvider;
  apiUrl: string;
  instanceId: string;
  token: string;
  reminderMinutesBefore: number;
  autoSendOnConfirm: boolean;
  autoSendOnReschedule: boolean;
}

const WHATSAPP_AUTOMATION_STORAGE_KEY = 'salon_boumlik_wa_automation_v1';

const DEFAULT_CONFIG: WhatsAppAutomationConfig = {
  enabled: false,
  provider: 'green-api',
  apiUrl: 'https://api.green-api.com',
  instanceId: '',
  token: '',
  reminderMinutesBefore: 60,
  autoSendOnConfirm: true,
  autoSendOnReschedule: true,
};

export function getWhatsAppAutomationConfig(): WhatsAppAutomationConfig {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(WHATSAPP_AUTOMATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    }
  } catch (err) {
    console.warn('Could not read WhatsApp automation config:', err);
  }
  return DEFAULT_CONFIG;
}

export function saveWhatsAppAutomationConfig(config: WhatsAppAutomationConfig): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(WHATSAPP_AUTOMATION_STORAGE_KEY, JSON.stringify(config));
    }
  } catch (err) {
    console.warn('Could not save WhatsApp automation config:', err);
  }
}

export function formatMoroccanWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '212635392503';
  if (digits.startsWith('212')) return digits;
  if (digits.startsWith('0')) return `212${digits.slice(1)}`;
  return `212${digits}`;
}

/**
 * Builds a direct WhatsApp reminder link (`https://wa.me/...`) for a client credit record.
 * Strictly preserves client privacy: shows ONLY amount owed and optional credit date
 * (never leaks internal staff client aliases or private notes).
 */
export function buildCreditWhatsAppReminderUrl(params: {
  clientPhone?: string;
  clientName?: string;
  amountOwedMAD: number;
  creditDate?: string;
  creditorName?: string;
  note?: string;
  lang?: Language;
}): string | null {
  const digits = String(params.clientPhone || '').replace(/\D/g, '');
  if (digits.length < 6) return null;

  const waPhone = formatMoroccanWhatsAppNumber(params.clientPhone || '');
  const creditor = (params.creditorName || 'صالون بومليك').trim();
  const amount = Math.max(0, Math.round(Number(params.amountOwedMAD) || 0));
  const cleanDate = params.creditDate?.trim() || '';

  const text =
    params.lang === 'fr'
      ? `Bonjour, petit rappel amical de Salon Boumlik (${creditor}) concernant votre reste à payer de ${amount} MAD.${cleanDate ? `\nDate du crédit : ${cleanDate}` : ''}\nMerci et à bientôt !`
      : params.lang === 'en'
      ? `Hello, friendly reminder from Salon Boumlik (${creditor}) regarding your remaining balance of ${amount} MAD.${cleanDate ? `\nCredit date: ${cleanDate}` : ''}\nThank you!`
      : `السلام عليكم، تذكير ودي من صالون بومليك (${creditor}) بخصوص المبلغ المستحق (الكريدي): ${amount} درهم.${cleanDate ? `\nتاريخ الكريدي: ${cleanDate}` : ''}\nمرحباً بك في أي وقت!`;

  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Dynamically formats full booking details for manual WhatsApp clicks
 * on BOTH client tickets and admin dashboard tickets in the target language.
 */
export function buildClientTicketWhatsAppMessage(
  booking: AppointmentBooking,
  langOverride?: Language
): string {
  const targetLang: Language = langOverride || booking.clientLanguage || 'ar';
  const cleanTicket = `#${booking.ticketNumber.replace(/^#+/, '')}`;
  const servicesList =
    (booking.cartItemsSummary || []).map((s) => s.name).join(' + ') || 'Prestations Salon Boumlik';
  const barber = booking.barberName;
  const total = booking.finalTotalMAD ?? 0;

  let statusText = '';
  if (booking.status === 'confirmed') {
    statusText =
      targetLang === 'ar'
        ? 'تم تأكيد وقبول الموعد ✅'
        : targetLang === 'amz'
        ? 'ⵉⵜⵜⵓⵙⵙⴷⴰ ⵓⵙⵔⵓⵙ ✅'
        : targetLang === 'es'
        ? 'Cita confirmada ✅'
        : targetLang === 'en'
        ? 'Appointment Confirmed ✅'
        : 'Rendez-vous Confirmé ✅';
  } else if (booking.status === 'rescheduled' && booking.rescheduledTo) {
    statusText =
      targetLang === 'ar'
        ? `تم اقتراح موعد جديد: 📅 ${booking.rescheduledTo.date} الساعة ⏰ ${booking.rescheduledTo.time}`
        : targetLang === 'es'
        ? `Nuevo horario propuesto: 📅 ${booking.rescheduledTo.date} a las ⏰ ${booking.rescheduledTo.time}`
        : targetLang === 'en'
        ? `New time proposed: 📅 ${booking.rescheduledTo.date} at ⏰ ${booking.rescheduledTo.time}`
        : `Nouvel horaire proposé : 📅 ${booking.rescheduledTo.date} à ⏰ ${booking.rescheduledTo.time}`;
  } else if (booking.status === 'cancelled') {
    statusText =
      targetLang === 'ar'
        ? 'تم إلغاء الموعد'
        : targetLang === 'es'
        ? 'Cita cancelada'
        : targetLang === 'en'
        ? 'Appointment Cancelled'
        : 'Rendez-vous Annulé';
  } else if (booking.status === 'flexible_pending') {
    statusText =
      targetLang === 'ar'
        ? 'طلب مرن — سيختار الحلاق أفضل وقت متاح ⏳'
        : targetLang === 'es'
        ? 'Horario flexible — el barbero asignará la hora ⏳'
        : targetLang === 'en'
        ? 'Flexible time — Barber assigning optimal slot ⏳'
        : 'Horaire flexible — Le barbier attribue le créneau ⏳';
  } else if (booking.status === 'rejected') {
    statusText =
      targetLang === 'ar'
        ? 'نعتذر، التوقيت غير متاح'
        : targetLang === 'es'
        ? 'Horario no disponible'
        : targetLang === 'en'
        ? 'Time slot unavailable'
        : 'Créneau indisponible';
  } else {
    statusText =
      targetLang === 'ar'
        ? 'الطلب قيد المراجعة'
        : targetLang === 'es'
        ? 'Pendiente de confirmación'
        : targetLang === 'en'
        ? 'Pending Confirmation'
        : 'En attente de validation';
  }

  const displayTime =
    booking.timeSlot === 'FLEXIBLE'
      ? targetLang === 'ar'
        ? 'مرن (يختاره الحلاق)'
        : 'Flexible (Assigné par le barbier)'
      : booking.timeSlot;

  const cihLine = booking.cihReceiptName
    ? targetLang === 'ar'
      ? `\nإيصال تحويل CIH مرفق: ${booking.cihReceiptName}`
      : `\nReçu CIH joint : ${booking.cihReceiptName}`
    : '';

  if (targetLang === 'ar') {
    return `مرحباً، بخصوص موعد صالون بومليك (تارودانت):
الزبون: ${booking.clientName}
التذكرة رقم: ${cleanTicket}
الحلاق: ${barber}
الموعد: 📅 ${booking.date} • ⏰ ${displayTime}
الخدمات: ${servicesList}
المجموع: ${total} MAD
الحالة الحالية: ${statusText}${cihLine}`;
  }

  if (targetLang === 'amz') {
    return `Azul ${booking.clientName}, Salon Boumlik Taroudant:
Tiki: ${cleanTicket}
Amkrad: ${barber}
Asakud: 📅 ${booking.date} • ⏰ ${booking.timeSlot}
Tiwwuriwin: ${servicesList}
Atig: ${total} MAD
Addad: ${statusText}${cihLine}`;
  }

  if (targetLang === 'en') {
    return `Hello ${booking.clientName}, Salon Boumlik (Taroudant):
Ticket: ${cleanTicket}
Barber: ${barber}
Date & Time: 📅 ${booking.date} • ⏰ ${booking.timeSlot}
Services: ${servicesList}
Total Price: ${total} MAD
Status: ${statusText}${cihLine}`;
  }

  if (targetLang === 'es') {
    return `Hola ${booking.clientName}, Salon Boumlik (Taroudant):
Ticket: ${cleanTicket}
Barbero: ${barber}
Fecha y hora: 📅 ${booking.date} • ⏰ ${booking.timeSlot}
Servicios: ${servicesList}
Total: ${total} MAD
Estado: ${statusText}${cihLine}`;
  }

  return `Bonjour ${booking.clientName}, Salon Boumlik (Taroudant) :
Ticket : ${cleanTicket}
Barbier : ${barber}
Rendez-vous : 📅 ${booking.date} • ⏰ ${booking.timeSlot}
Prestations : ${servicesList}
Total : ${total} MAD
Statut actuel : ${statusText}${cihLine}`;
}

export type ReminderTriggerType = 'confirmation' | 'reschedule' | 'reminder_1h';

export function buildAutomatedReminderMessage(
  booking: AppointmentBooking,
  trigger: ReminderTriggerType
): string {
  const baseDetails = buildClientTicketWhatsAppMessage(booking, booking.clientLanguage || 'ar');
  if (trigger === 'reminder_1h') {
    const lang = booking.clientLanguage || 'ar';
    const prefix =
      lang === 'ar'
        ? '⏰ تذكير تلقائي باقتراب موعدك في صالون بومليك:'
        : lang === 'en'
        ? '⏰ Automatic Reminder for your upcoming Salon Boumlik appointment:'
        : lang === 'es'
        ? '⏰ Recordatorio automático de tu próxima cita en Salon Boumlik:'
        : lang === 'amz'
        ? '⏰ ⴰⵙⴽⵜⵉ ⵏ ⵓⵙⵉⵀⵍ ⵏⵏⴽ ⴳ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ:'
        : '⏰ Rappel automatique pour votre rendez-vous imminent au Salon Boumlik :';
    return `${prefix}\n\n${baseDetails}`;
  }
  return baseDetails;
}

export interface WhatsAppDispatchResult {
  success: boolean;
  provider: WhatsAppProvider;
  reason?: string;
}

/**
 * Frontend API dispatch hook compatible with Green-API and UltraMsg gateways.
 * Only sends when explicitly configured and enabled by the salon owner in Admin Dashboard.
 */
export async function dispatchAutomatedWhatsAppMessage(
  booking: AppointmentBooking,
  trigger: ReminderTriggerType,
  configOverride?: WhatsAppAutomationConfig
): Promise<WhatsAppDispatchResult> {
  const config = configOverride || getWhatsAppAutomationConfig();

  if (!config.enabled) {
    return { success: false, provider: config.provider, reason: 'disabled' };
  }

  if (!config.instanceId.trim() || !config.token.trim()) {
    return { success: false, provider: config.provider, reason: 'missing_credentials' };
  }

  const phoneIntl = formatMoroccanWhatsAppNumber(booking.clientPhone);
  const message = buildAutomatedReminderMessage(booking, trigger);

  try {
    if (config.provider === 'green-api') {
      const baseUrl = (config.apiUrl || 'https://api.green-api.com').replace(/\/+$/, '');
      const endpoint = `${baseUrl}/waInstance${encodeURIComponent(config.instanceId.trim())}/sendMessage/${encodeURIComponent(config.token.trim())}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${phoneIntl}@c.us`,
          message,
        }),
      });
      if (!res.ok) {
        return { success: false, provider: 'green-api', reason: `HTTP ${res.status}` };
      }
      return { success: true, provider: 'green-api' };
    }

    // UltraMsg Gateway
    const baseUrl = (config.apiUrl || 'https://api.ultramsg.com').replace(/\/+$/, '');
    const endpoint = `${baseUrl}/${encodeURIComponent(config.instanceId.trim())}/messages/chat`;
    const body = new URLSearchParams({
      token: config.token.trim(),
      to: `+${phoneIntl}`,
      body: message,
    });
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      return { success: false, provider: 'ultramsg', reason: `HTTP ${res.status}` };
    }
    return { success: true, provider: 'ultramsg' };
  } catch (err) {
    return {
      success: false,
      provider: config.provider,
      reason: err instanceof Error ? err.message : 'network_error',
    };
  }
}
