import { AppointmentBooking, Language } from '../types';
import { SALON_INFO } from '../data/barbershopData';
import { buildWhatsAppInquiryMessage } from './whatsappAutomation';

export function getDrinkLabel(pref?: 'coffee' | 'tea' | 'none'): string {
  switch (pref) {
    case 'coffee':
      return 'Café / قهوة';
    case 'tea':
      return 'Thé / أتاي فقط';
    case 'none':
    default:
      return 'Rien / والو';
  }
}

export function createFormattedWhatsAppQuoteMessage(
  appointment: AppointmentBooking,
  langOverride?: Language
): string {
  const targetLang: Language = langOverride || appointment.clientLanguage || 'ar';
  const servicesList =
    (appointment.cartItemsSummary || []).map((s) => s.name).join(' + ') ||
    (appointment.services || [])
      .map((s) => s.name[targetLang] || s.name.fr)
      .join(' + ');

  const fallbackEstimatedPrice =
    typeof appointment.finalTotalMAD === 'number' && appointment.finalTotalMAD > 0
      ? appointment.finalTotalMAD
      : (appointment.services || []).reduce((sum, s) => sum + (s.basePrice || 0), 0);

  return buildWhatsAppInquiryMessage({
    lang: targetLang,
    requestType: 'quote',
    servicesText: servicesList || undefined,
    estimatedPriceMAD: fallbackEstimatedPrice > 0 ? fallbackEstimatedPrice : undefined,
    barberName: appointment.barberName,
    clientName: appointment.clientName || undefined,
    clientPhone: appointment.clientPhone || undefined,
    ticketNumber: appointment.ticketNumber || undefined,
    date: appointment.date || undefined,
    timeSlot: appointment.timeSlot || undefined,
    notes: appointment.notes || undefined,
  });
}

export function createOwnerWhatsAppAlertMessage(appointment: AppointmentBooking): string {
  const serviceList =
    (appointment.cartItemsSummary || []).map((s) => s.name).join(' + ') ||
    (appointment.services || []).map((s) => `${s.name.fr} (${s.name.ar})`).join(' + ');

  const totalPrice =
    typeof appointment.finalTotalMAD === 'number' && appointment.finalTotalMAD > 0
      ? `${appointment.finalTotalMAD} MAD`
      : null;

  return [
    'السلام عليكم،',
    [
      'Salon Boumlik — Taroudant',
      `Ticket : #${appointment.ticketNumber.replace(/^#+/, '')}`,
    ].join('\n'),
    [
      `Service / Pack : ${serviceList}`,
      totalPrice ? `Prix estimé : ${totalPrice}` : null,
      `Barbier : ${appointment.barberName}`,
      `Date & heure : ${appointment.date} — ${appointment.timeSlot}`,
      `Boisson : ${getDrinkLabel(appointment.drinkPreference)}`,
    ]
      .filter(Boolean)
      .join('\n'),
    [
      `Client : ${appointment.clientName || 'Client'}`,
      appointment.clientPhone ? `Téléphone : ${appointment.clientPhone}` : null,
      appointment.notes ? `Remarque : ${appointment.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  ].join('\n\n');
}

export function createOwnerEmailNotificationUrl(appointment: AppointmentBooking): string {
  const serviceNames = appointment.services.map(s => s.name.fr).join(', ');
  const subject = `[RDV SALON BOUMLIK] Ticket #${appointment.ticketNumber} - ${appointment.clientName || 'Client'}`;
  const body = `Bonjour Hassan,

Un nouveau rendez-vous a été enregistré sur le site web Salon Boumlik :

• Ticket : #${appointment.ticketNumber}
• Client : ${appointment.clientName || 'Client (Réservation rapide)'}
• Téléphone : ${appointment.clientPhone || 'Non spécifié'}
• Email : ${appointment.clientEmail || 'Non spécifié'}
• Barbier choisi : ${appointment.barberName}
• Date & Heure : ${appointment.date} à ${appointment.timeSlot}
• Boisson : ${getDrinkLabel(appointment.drinkPreference)}
• Prestations : ${serviceNames}
• Option Sans Attente : +10 DH applicable sur la coupe
${appointment.notes ? `• Remarques : ${appointment.notes}\n` : ''}

Consulter et répondre au client sur WhatsApp au 0635392503.`;

  return `mailto:MrBoumlik@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}


export function createGoogleCalendarUrl(appointment: AppointmentBooking): string {
  const title = encodeURIComponent(`Salon Boumlik - ${appointment.services.map(s => s.name.fr).join(', ')}`);
  const details = encodeURIComponent(
    `Rendez-vous réservé au Salon Boumlik Taroudant\n` +
    `Barbier: ${appointment.barberName}\n` +
    `Prestations: ${appointment.services.map(s => s.name.fr).join(', ')}\n` +
    `Boisson: ${getDrinkLabel(appointment.drinkPreference)}\n` +
    `Durée estimée: ${appointment.totalDurationMinutes} min\n` +
    `Lieu: 2ème étage, au-dessus boulangerie ITRI, Rue Bir Anzarane, Taroudant\n` +
    `Réf: ${appointment.ticketNumber}\n` +
    `Contact WhatsApp: ${SALON_INFO.phone}`
  );
  const location = encodeURIComponent('Salon Boumlik, 2ème étage au-dessus boulangerie ITRI, Rue Bir Anzarane, Taroudant, Maroc');

  const [hours, minutes] = appointment.timeSlot.split(':').map(Number);
  const dateObj = new Date(appointment.date);
  dateObj.setHours(hours, minutes, 0);

  const duration = appointment.totalDurationMinutes || 45;
  const endDateObj = new Date(dateObj.getTime() + duration * 60000);

  const formatIsoForGCal = (d: Date) => {
    return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  };

  const dates = `${formatIsoForGCal(dateObj)}/${formatIsoForGCal(endDateObj)}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

export function downloadIcsFile(appointment: AppointmentBooking) {
  const [hours, minutes] = appointment.timeSlot.split(':').map(Number);
  const start = new Date(appointment.date);
  start.setHours(hours, minutes, 0);
  const duration = appointment.totalDurationMinutes || 45;
  const end = new Date(start.getTime() + duration * 60000);

  const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
  const formatICSDate = (d: Date) => {
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      'Z'
    );
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Salon Boumlik//Taroudant Barbershop//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:salon-boumlik-${appointment.id}@boumlik.ma`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:Salon Boumlik - ${appointment.barberName}`,
    `DESCRIPTION:Prestations: ${appointment.services.map(s => s.name.fr).join(', ')}\\nBarbier: ${appointment.barberName}\\nBoisson: ${getDrinkLabel(appointment.drinkPreference)}\\nTicket: ${appointment.ticketNumber}\\nTel: ${SALON_INFO.phone}`,
    'LOCATION:2ème étage\\, au-dessus boulangerie ITRI\\, Rue Bir Anzarane\\, Taroudant',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Salon_Boumlik_${appointment.ticketNumber}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export function createGmailComposeUrl(toEmail: string, subject: string, body: string): string {
  const encodedTo = encodeURIComponent(toEmail);
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
}

export function createWhatsAppUrl(phoneClean: string, message: string): string {
  return `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`;
}
