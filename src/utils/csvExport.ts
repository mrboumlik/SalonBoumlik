import { AppointmentBooking } from '../types';
import { AggregatedCrmClient } from './crmStore';

function escapeCsvCell(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return '';
  let str = String(value).replace(/\r\n|\r|\n/g, ' ');
  // Guard against spreadsheet formula execution (allow phone numbers like +212...)
  if (/^[=@]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatBookingServicesForCsv(booking: AppointmentBooking): {
  summary: string;
  count: number;
} {
  const cartItems = booking.cartItemsSummary || [];
  if (cartItems.length > 0) {
    return {
      summary: cartItems
        .map((item) => `${item.name} (${Number(item.finalPrice) || 0} MAD)`)
        .join(' + '),
      count: cartItems.length,
    };
  }

  const rawServices = booking.services || [];
  if (rawServices.length > 0) {
    return {
      summary: rawServices
        .map((srv) => `${srv.name?.ar || srv.name?.fr || srv.id} (${Number(srv.basePrice) || 0} MAD)`)
        .join(' + '),
      count: rawServices.length,
    };
  }

  return {
    summary: booking.notes || 'خدمة حلاقة',
    count: 0,
  };
}

export interface CrmCsvExportResult {
  clientCount: number;
  rowCount: number;
  completedRevenueMAD: number;
  filename: string;
}

export function buildCrmAccountingCsv(clients: AggregatedCrmClient[]): {
  csvContent: string;
  clientCount: number;
  rowCount: number;
  completedRevenueMAD: number;
} {
  const headers = [
    'Client ID',
    'Client Name',
    'Client Phone',
    'VIP Status',
    'Account Status',
    'Verified Visits',
    'No-Show Count',
    'Client Lifetime Spend (MAD)',
    'Ticket Number',
    'Appointment Date',
    'Appointment Time',
    'Booking Status',
    'Barber',
    'Selected Services',
    'Services Count',
    'Original Subtotal (MAD)',
    'Discounts / Savings (MAD)',
    'Final Billed Total (MAD)',
    'Recognized Revenue (MAD)',
    'Completed Revenue (MAD)',
    'CIH Receipt Attached',
    'Booking Method',
    'Loyalty / Booking Notes',
    'Created At',
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];
  let rowCount = 0;
  let completedRevenueMAD = 0;

  for (const client of clients) {
    const vipLabel = client.isVip ? 'VIP' : 'Standard';
    const accountStatus = client.isBanned ? 'Banned' : 'Active';

    if (client.bookings.length === 0) {
      rowCount += 1;
      rows.push(
        [
          client.id,
          client.clientName,
          client.phoneDisplay,
          vipLabel,
          accountStatus,
          client.verifiedVisits,
          client.noShowCount,
          client.lifetimeSpendMAD,
          'CRM_PROFILE_ONLY',
          client.lastVisitDate || '',
          '',
          'profile_only',
          '',
          '',
          0,
          0,
          0,
          0,
          0,
          0,
          'No',
          '',
          client.rewardNote || client.banReason || '',
          '',
        ]
          .map(escapeCsvCell)
          .join(',')
      );
      continue;
    }

    for (const booking of client.bookings) {
      rowCount += 1;
      const effectiveDate = booking.rescheduledTo?.date || booking.date;
      const effectiveTime = booking.rescheduledTo?.time || booking.timeSlot;
      const servicesInfo = formatBookingServicesForCsv(booking);
      const finalTotal = Number(booking.finalTotalMAD) || 0;
      const originalTotal =
        booking.originalTotalMAD !== undefined ? Number(booking.originalTotalMAD) || 0 : finalTotal;
      const savings = Number(booking.totalSavingsMAD) || 0;
      const recognizedRevenue =
        booking.status === 'completed' || booking.status === 'confirmed' ? finalTotal : 0;
      const completedRevenue = booking.status === 'completed' ? finalTotal : 0;
      completedRevenueMAD += completedRevenue;

      const noteParts = [
        booking.loyaltyRewardApplied || '',
        booking.clientNotes || '',
        booking.notes && booking.notes !== booking.clientNotes ? booking.notes : '',
        booking.adminNotes || '',
      ].filter(Boolean);
      const combinedNotes = noteParts.join(' | ');

      rows.push(
        [
          client.id,
          client.clientName,
          client.phoneDisplay,
          vipLabel,
          accountStatus,
          client.verifiedVisits,
          client.noShowCount,
          client.lifetimeSpendMAD,
          booking.ticketNumber,
          effectiveDate,
          effectiveTime,
          booking.status,
          booking.barberName,
          servicesInfo.summary,
          servicesInfo.count,
          originalTotal,
          savings,
          finalTotal,
          recognizedRevenue,
          completedRevenue,
          booking.cihReceiptName || booking.cihReceiptPreview ? 'Yes' : 'No',
          booking.bookingMethod || 'site',
          combinedNotes,
          booking.createdAt,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }
  }

  // UTF-8 BOM ensures Excel/Sheets renders Arabic text cleanly
  return {
    csvContent: `\uFEFF${rows.join('\r\n')}`,
    clientCount: clients.length,
    rowCount,
    completedRevenueMAD,
  };
}

export function downloadCrmAccountingCsv(clients: AggregatedCrmClient[]): CrmCsvExportResult {
  const { csvContent, clientCount, rowCount, completedRevenueMAD } = buildCrmAccountingCsv(clients);
  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `salon-boumlik-crm-revenue-${todayStr}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return {
    clientCount,
    rowCount,
    completedRevenueMAD,
    filename,
  };
}
