import { AppointmentBooking } from '../types';
import { SALON_INFO } from '../data/barbershopData';

export function getDrinkLabel(pref: 'coffee' | 'tea' | 'none'): string {
  switch (pref) {
    case 'coffee':
      return 'Café Expresso / قهوة';
    case 'tea':
      return 'Thé à la Menthe Marocain / أتاي';
    case 'none':
      return 'Rien / والو';
  }
}

export function createFormattedWhatsAppQuoteMessage(appointment: AppointmentBooking): string {
  const serviceList = appointment.services.map((s, idx) => `  ${idx + 1}. ${s.name.fr} (${s.name.ar})`).join('\n');
  const drink = getDrinkLabel(appointment.drinkPreference);

  return `*💈 DEMANDE DE RENDEZ-VOUS & DEVIS - SALON BOUMLIK 💈*
_More than barber shop • Taroudant_

*👤 INFORMATIONS CLIENT :*
• *Nom complet :* ${appointment.clientName}
• *Téléphone :* ${appointment.clientPhone}
• *Email :* ${appointment.clientEmail || 'Non spécifié'}

*✂️ BARBIER CHOISI :*
• *Barbier :* ${appointment.barberName}

*☕ BOISSON OFFERTE PENDANT L'ATTENTE :*
• *Choix :* ${drink}

*📅 DATE & CRÉNEAU SOUHAITÉS :*
• *Date :* ${appointment.date}
• *Heure :* ${appointment.timeSlot}

*💈 PRESTATIONS SÉLECTIONNÉES :*
${serviceList}
• *Durée estimée :* ~${appointment.totalDurationMinutes} min

${appointment.notes ? `*📝 REMARQUES PARTICULIÈRES :*\n${appointment.notes}\n` : ''}
*📍 LIEU DU RENDEZ-VOUS :*
${SALON_INFO.address.fr}
(Contact Salon: ${SALON_INFO.displayPhone})

---
Salam Si Hassan, merci de me confirmer la disponibilité et de m'envoyer le devis / tarif pour cette formule. بارك الله فيك !`;
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

  const endDateObj = new Date(dateObj.getTime() + appointment.totalDurationMinutes * 60000);

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
  const end = new Date(start.getTime() + appointment.totalDurationMinutes * 60000);

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
