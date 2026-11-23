import { AppointmentBooking, Language } from '../types';
import { safeStorageGet, safeStorageSet } from './safeBrowser';

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
    const raw = safeStorageGet(WHATSAPP_AUTOMATION_STORAGE_KEY, 'local');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('Could not read WhatsApp automation config:', err);
  }
  return DEFAULT_CONFIG;
}

export function saveWhatsAppAutomationConfig(config: WhatsAppAutomationConfig): void {
  try {
    safeStorageSet(WHATSAPP_AUTOMATION_STORAGE_KEY, JSON.stringify(config), 'local');
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

export type WhatsAppRequestKind = 'booking' | 'inquiry' | 'quote' | 'cih';

export interface WhatsAppInquiryMessageParams {
  lang: Language;
  requestType?: WhatsAppRequestKind;
  servicesText?: string;
  estimatedPriceMAD?: number | null;
  barberName?: string;
  clientName?: string;
  clientPhone?: string;
  ticketNumber?: string;
  date?: string;
  timeSlot?: string;
  notes?: string;
  includeMessagePrompt?: boolean;
}

/**
 * Formats outgoing WhatsApp (`wa.me`) booking & inquiry messages cleanly
 * with clear line breaks and structured, readable fields.
 */
export function buildWhatsAppInquiryMessage(params: WhatsAppInquiryMessageParams): string {
  const {
    lang,
    requestType = 'inquiry',
    servicesText,
    estimatedPriceMAD,
    barberName,
    clientName,
    clientPhone,
    ticketNumber,
    date,
    timeSlot,
    notes,
    includeMessagePrompt = false,
  } = params;

  const greeting =
    lang === 'ar'
      ? 'السلام عليكم،'
      : lang === 'amz'
      ? 'ⴰⵣⵓⵍ ⴼⵍⵍⴰⵡⵏ،'
      : lang === 'en'
      ? 'Hello,'
      : lang === 'es'
      ? 'Hola,'
      : 'Bonjour,';

  const salonHeader =
    lang === 'ar'
      ? 'صالون بومليك — تارودانت'
      : lang === 'amz'
      ? 'ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ — ⵜⴰⵔⵓⴷⴰⵏⵜ'
      : 'Salon Boumlik — Taroudant';

  const requestTypeLabel =
    lang === 'ar'
      ? 'نوع الطلب'
      : lang === 'amz'
      ? 'ⴰⵏⴰⵡ ⵏ ⵜⵓⵜⵜⵔⴰ'
      : lang === 'en'
      ? 'Request Type'
      : lang === 'es'
      ? 'Tipo de solicitud'
      : 'Type de demande';

  const requestTypeValue =
    requestType === 'booking'
      ? lang === 'ar'
        ? 'حجز موعد'
        : lang === 'amz'
        ? 'ⴰⵙⵔⵓⵙ ⵏ ⵓⵙⵉⵀⵍ'
        : lang === 'en'
        ? 'Appointment Booking'
        : lang === 'es'
        ? 'Reserva de cita'
        : 'Demande de rendez-vous'
      : requestType === 'quote'
      ? lang === 'ar'
        ? 'حجز موعد واستفسار عن السعر'
        : lang === 'amz'
        ? 'ⴰⵙⵔⵓⵙ ⴷ ⵓⵜⵉⴳ'
        : lang === 'en'
        ? 'Booking & Price Inquiry'
        : lang === 'es'
        ? 'Reserva y presupuesto'
        : 'Rendez-vous & devis'
      : requestType === 'cih'
      ? lang === 'ar'
        ? 'إرسال إيصال التحويل البنكي CIH لتأكيد الحجز'
        : lang === 'amz'
        ? 'ⵜⴰⵏⴼⵓⵍⵜ ⵏ CIH ⵉ ⵓⵙⵏⵜⵎ'
        : lang === 'en'
        ? 'CIH Bank Transfer Receipt Confirmation'
        : lang === 'es'
        ? 'Confirmación de transferencia CIH'
        : 'Confirmation de virement CIH'
      : lang === 'ar'
      ? 'استفسار عام'
      : lang === 'amz'
      ? 'ⴰⵙⵇⵙⵉ'
      : lang === 'en'
      ? 'General Inquiry'
      : lang === 'es'
      ? 'Consulta general'
      : 'Demande de renseignements';

  const headerLines = [salonHeader, `${requestTypeLabel}: ${requestTypeValue}`];
  if (ticketNumber) {
    const ticketLabel =
      lang === 'ar'
        ? 'رقم التذكرة'
        : lang === 'amz'
        ? 'ⵜⵉⴽⵉ'
        : lang === 'en'
        ? 'Ticket'
        : lang === 'es'
        ? 'Ticket'
        : 'Ticket';
    headerLines.push(`${ticketLabel}: #${ticketNumber.replace(/^#+/, '')}`);
  }

  const detailLines: string[] = [];

  if (servicesText && servicesText.trim()) {
    const label =
      lang === 'ar'
        ? 'الخدمة / الباقة المختارة'
        : lang === 'amz'
        ? 'ⵜⴰⵡⵓⵔⵉ ⵉⵜⵜⵓⵙⵜⵢⵏ'
        : lang === 'en'
        ? 'Selected Service / Pack'
        : lang === 'es'
        ? 'Servicio / Pack seleccionado'
        : 'Service / Pack sélectionné';
    detailLines.push(`${label}: ${servicesText.trim()}`);
  }

  if (typeof estimatedPriceMAD === 'number' && Number.isFinite(estimatedPriceMAD) && estimatedPriceMAD > 0) {
    const label =
      lang === 'ar'
        ? 'السعر التقديري'
        : lang === 'amz'
        ? 'ⴰⵜⵉⴳ'
        : lang === 'en'
        ? 'Estimated Price'
        : lang === 'es'
        ? 'Precio estimado'
        : 'Prix estimé';
    detailLines.push(`${label}: ${Math.round(estimatedPriceMAD)} MAD`);
  }

  if (barberName && barberName.trim()) {
    const label =
      lang === 'ar'
        ? 'الحلاق المفضل'
        : lang === 'amz'
        ? 'ⴰⵎⴽⵔⴰⴹ'
        : lang === 'en'
        ? 'Preferred Barber'
        : lang === 'es'
        ? 'Barbero preferido'
        : 'Barbier souhaité';
    detailLines.push(`${label}: ${barberName.trim()}`);
  }

  if (date && date.trim()) {
    const label =
      lang === 'ar'
        ? 'التاريخ'
        : lang === 'amz'
        ? 'ⴰⵙⴰⴽⵓⴷ'
        : lang === 'en'
        ? 'Date'
        : lang === 'es'
        ? 'Fecha'
        : 'Date';
    detailLines.push(`${label}: ${date.trim()}`);
  }

  if (timeSlot && timeSlot.trim()) {
    const label =
      lang === 'ar'
        ? 'التوقيت'
        : lang === 'amz'
        ? 'ⴰⴽⵓⴷ'
        : lang === 'en'
        ? 'Time'
        : lang === 'es'
        ? 'Hora'
        : 'Horaire';
    detailLines.push(`${label}: ${timeSlot.trim()}`);
  }

  const clientLines: string[] = [];
  if (clientName && clientName.trim()) {
    const label =
      lang === 'ar'
        ? 'الاسم'
        : lang === 'amz'
        ? 'ⵉⵙⵎ'
        : lang === 'en'
        ? 'Name'
        : lang === 'es'
        ? 'Nombre'
        : 'Nom';
    clientLines.push(`${label}: ${clientName.trim()}`);
  }

  if (clientPhone && clientPhone.trim()) {
    const label =
      lang === 'ar'
        ? 'الهاتف'
        : lang === 'amz'
        ? 'ⵜⵉⵍⵉⴼⵓⵏ'
        : lang === 'en'
        ? 'Phone'
        : lang === 'es'
        ? 'Teléfono'
        : 'Téléphone';
    clientLines.push(`${label}: ${clientPhone.trim()}`);
  }

  const sections: string[] = [greeting, headerLines.join('\n')];
  if (detailLines.length > 0) sections.push(detailLines.join('\n'));
  if (clientLines.length > 0) sections.push(clientLines.join('\n'));

  if (notes && notes.trim()) {
    const msgLabel =
      lang === 'ar'
        ? 'الرسالة'
        : lang === 'amz'
        ? 'ⵜⴰⴱⵔⴰⵜ'
        : lang === 'en'
        ? 'Message'
        : lang === 'es'
        ? 'Mensaje'
        : 'Message';
    sections.push(`${msgLabel}:\n${notes.trim()}`);
  } else if (includeMessagePrompt) {
    const promptLabel =
      lang === 'ar'
        ? 'استفساري:'
        : lang === 'amz'
        ? 'ⴰⵙⵇⵙⵉ ⵉⵏⵓ:'
        : lang === 'en'
        ? 'My message:'
        : lang === 'es'
        ? 'Mi consulta:'
        : 'Mon message :';
    sections.push(`${promptLabel}\n`);
  }

  return sections.join('\n\n');
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
    (booking.cartItemsSummary || []).map((s) => s.name).join(' + ') ||
    (booking.services || []).map((s) => s.name[targetLang] || s.name.fr).join(' + ') ||
    'Salon Boumlik';
  const barber = booking.barberName;
  const total = booking.finalTotalMAD ?? 0;

  let statusText = '';
  if (booking.status === 'confirmed') {
    statusText =
      targetLang === 'ar'
        ? 'تم تأكيد وقبول الموعد'
        : targetLang === 'amz'
        ? 'ⵉⵜⵜⵓⵙⵙⴷⴰ ⵓⵙⵔⵓⵙ'
        : targetLang === 'es'
        ? 'Cita confirmada'
        : targetLang === 'en'
        ? 'Appointment Confirmed'
        : 'Rendez-vous confirmé';
  } else if (booking.status === 'rescheduled' && booking.rescheduledTo) {
    statusText =
      targetLang === 'ar'
        ? `تم اقتراح موعد جديد: ${booking.rescheduledTo.date} — ${booking.rescheduledTo.time}`
        : targetLang === 'es'
        ? `Nuevo horario propuesto: ${booking.rescheduledTo.date} — ${booking.rescheduledTo.time}`
        : targetLang === 'en'
        ? `New time proposed: ${booking.rescheduledTo.date} — ${booking.rescheduledTo.time}`
        : `Nouvel horaire proposé : ${booking.rescheduledTo.date} — ${booking.rescheduledTo.time}`;
  } else if (booking.status === 'cancelled') {
    statusText =
      targetLang === 'ar'
        ? 'تم إلغاء الموعد'
        : targetLang === 'es'
        ? 'Cita cancelada'
        : targetLang === 'en'
        ? 'Appointment Cancelled'
        : 'Rendez-vous annulé';
  } else if (booking.status === 'flexible_pending') {
    statusText =
      targetLang === 'ar'
        ? 'طلب مرن (في انتظار تحديد التوقيت)'
        : targetLang === 'es'
        ? 'Horario flexible (por asignar)'
        : targetLang === 'en'
        ? 'Flexible queue (time pending)'
        : 'File intelligente (créneau à confirmer)';
  } else if (booking.status === 'rejected') {
    statusText =
      targetLang === 'ar'
        ? 'التوقيت غير متاح'
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
        ? 'الطابور الذكي (مرن)'
        : targetLang === 'en'
        ? 'Smart Queue (Flexible)'
        : targetLang === 'es'
        ? 'Cola Inteligente (Flexible)'
        : targetLang === 'amz'
        ? 'ⴰⵙⵉⵀⵍ ⵉⵣⵎⵣⴰⵏ'
        : 'File intelligente (Flexible)'
      : booking.timeSlot;

  const cihLine = booking.cihReceiptName
    ? targetLang === 'ar'
      ? `إيصال CIH المرفق: ${booking.cihReceiptName}`
      : `Reçu CIH joint : ${booking.cihReceiptName}`
    : '';

  if (targetLang === 'ar') {
    return [
      'السلام عليكم،',
      [
        'صالون بومليك — تارودانت',
        'نوع الطلب: متابعة / حجز موعد',
        `رقم التذكرة: ${cleanTicket}`,
      ].join('\n'),
      [
        `الخدمة / الباقة: ${servicesList}`,
        `السعر التقديري: ${total} MAD`,
        `الحلاق: ${barber}`,
        `التاريخ والتوقيت: ${booking.date} — ${displayTime}`,
      ].join('\n'),
      [
        `الزبون: ${booking.clientName}`,
        `الحالة: ${statusText}`,
        cihLine,
      ]
        .filter(Boolean)
        .join('\n'),
    ].join('\n\n');
  }

  if (targetLang === 'amz') {
    return [
      'ⴰⵣⵓⵍ ⴼⵍⵍⴰⵡⵏ،',
      [
        'ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ — ⵜⴰⵔⵓⴷⴰⵏⵜ',
        'ⴰⵏⴰⵡ ⵏ ⵜⵓⵜⵜⵔⴰ: ⴰⵙⵔⵓⵙ',
        `ⵜⵉⴽⵉ: ${cleanTicket}`,
      ].join('\n'),
      [
        `ⵜⵉⵡⵓⵔⵉⵡⵉⵏ: ${servicesList}`,
        `ⴰⵜⵉⴳ: ${total} MAD`,
        `ⴰⵎⴽⵔⴰⴹ: ${barber}`,
        `ⴰⵙⴰⴽⵓⴷ: ${booking.date} — ${displayTime}`,
      ].join('\n'),
      [
        `ⴰⵎⵙⴰⵖ: ${booking.clientName}`,
        `ⴰⴷⴷⴰⴷ: ${statusText}`,
        cihLine,
      ]
        .filter(Boolean)
        .join('\n'),
    ].join('\n\n');
  }

  if (targetLang === 'en') {
    return [
      'Hello,',
      [
        'Salon Boumlik — Taroudant',
        'Request Type: Appointment Booking',
        `Ticket: ${cleanTicket}`,
      ].join('\n'),
      [
        `Selected Service / Pack: ${servicesList}`,
        `Estimated Price: ${total} MAD`,
        `Barber: ${barber}`,
        `Date & Time: ${booking.date} — ${displayTime}`,
      ].join('\n'),
      [
        `Client: ${booking.clientName}`,
        `Status: ${statusText}`,
        cihLine,
      ]
        .filter(Boolean)
        .join('\n'),
    ].join('\n\n');
  }

  if (targetLang === 'es') {
    return [
      'Hola,',
      [
        'Salon Boumlik — Taroudant',
        'Tipo de solicitud: Reserva de cita',
        `Ticket: ${cleanTicket}`,
      ].join('\n'),
      [
        `Servicio / Pack: ${servicesList}`,
        `Precio estimado: ${total} MAD`,
        `Barbero: ${barber}`,
        `Fecha y hora: ${booking.date} — ${displayTime}`,
      ].join('\n'),
      [
        `Cliente: ${booking.clientName}`,
        `Estado: ${statusText}`,
        cihLine,
      ]
        .filter(Boolean)
        .join('\n'),
    ].join('\n\n');
  }

  return [
    'Bonjour,',
    [
      'Salon Boumlik — Taroudant',
      'Type de demande : Suivi de rendez-vous',
      `Ticket : ${cleanTicket}`,
    ].join('\n'),
    [
      `Service / Pack : ${servicesList}`,
      `Prix estimé : ${total} MAD`,
      `Barbier : ${barber}`,
      `Date & créneau : ${booking.date} — ${displayTime}`,
    ].join('\n'),
    [
      `Client : ${booking.clientName}`,
      `Statut : ${statusText}`,
      cihLine,
    ]
      .filter(Boolean)
      .join('\n'),
  ].join('\n\n');
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
        ? 'تذكير تلقائي باقتراب موعدك في صالون بومليك:'
        : lang === 'en'
        ? 'Automatic reminder for your upcoming Salon Boumlik appointment:'
        : lang === 'es'
        ? 'Recordatorio automático de tu próxima cita en Salon Boumlik:'
        : lang === 'amz'
        ? 'ⴰⵙⴽⵜⵉ ⵏ ⵓⵙⵉⵀⵍ ⵏⵏⴽ ⴳ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ:'
        : 'Rappel automatique pour votre rendez-vous au Salon Boumlik :';
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
