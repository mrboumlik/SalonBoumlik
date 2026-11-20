import QRCode from 'qrcode';
import { AppointmentBooking, Language } from '../types';
import { SALON_INFO, TEAM_MEMBERS } from '../data/barbershopData';
import { buildBookingCheckInQrPayload } from './clientQr';
import { pickLang } from './i18n';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}...`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}...`;
}

/**
 * Generates a crisp PNG image of the digital appointment ticket via HTML5 <canvas>
 * and triggers a direct download named `Salon_Boumlik_Ticket.png`.
 */
export async function downloadTicketAsPng(
  booking: AppointmentBooking,
  existingQrDataUrl?: string,
  langOverride?: Language
): Promise<void> {
  const lang = langOverride || booking.clientLanguage || 'ar';
  const barberObj = TEAM_MEMBERS.find((b) => b.id === booking.barberId);
  const accentColor = booking.barberColor || barberObj?.themeColor || '#D97706';

  const qrPayload = buildBookingCheckInQrPayload(booking);
  const qrDataUrl =
    existingQrDataUrl ||
    (await QRCode.toDataURL(qrPayload, {
      width: 260,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    }));

  const [logoImg, qrImg] = await Promise.all([
    loadImage(SALON_INFO.media.logoClean),
    loadImage(qrDataUrl),
  ]);

  const srvItems = booking.cartItemsSummary || [];
  const hasQueueAvoidance =
    /تفادي الانتظار|Coupe-File|Queue Avoidance/i.test(booking.notes || '') ||
    (srvItems.length > 0 &&
      Math.round(
        (booking.finalTotalMAD ?? 0) -
          srvItems.reduce((sum, item) => sum + (item.finalPrice || 0), 0)
      ) === 10);

  const itemsSum = srvItems.reduce((sum, item) => sum + (item.finalPrice || 0), 0);
  const queueFee = hasQueueAvoidance ? 10 : 0;
  const impliedLoyaltyDiscount =
    srvItems.length > 0
      ? Math.max(0, itemsSum + queueFee - (booking.finalTotalMAD ?? 0))
      : 0;

  interface TicketLineRow {
    label: string;
    amount: string;
    labelColor: string;
    amountColor: string;
  }

  const displayRows: TicketLineRow[] = [];

  if (srvItems.length === 0) {
    displayRows.push({
      label: pickLang(lang, {
        ar: '• حلاقة وعناية — صالون بومليك',
        fr: '• Coiffure & Soins Salon Boumlik',
        amz: '• ⵜⴰⴽⵔⴹⴰ ⴷ ⵓⴼⵓⵍⴽⵉ — ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ',
        en: '• Grooming & Care — Salon Boumlik',
        es: '• Corte y cuidado — Salon Boumlik',
      }),
      amount: `${Math.max(0, (booking.finalTotalMAD ?? 0) - queueFee)} MAD`,
      labelColor: '#E4E4E7',
      amountColor: '#FBBF24',
    });
  } else {
    srvItems.forEach((item) => {
      displayRows.push({
        label: `• ${item.name}`,
        amount: `${item.finalPrice} MAD`,
        labelColor: '#F4F4F5',
        amountColor: '#FBBF24',
      });
    });
  }

  if (hasQueueAvoidance) {
    displayRows.push({
      label: pickLang(lang, {
        ar: '⚡ خدمة تفادي الانتظار',
        fr: '⚡ Service Coupe-File',
        amz: '⚡ ⵜⴰⵏⴰⴼⵓⵜ ⵏ ⵓⵣⵔⴰⵢ',
        en: '⚡ Queue Avoidance Service',
        es: '⚡ Servicio Sin Espera',
      }),
      amount: '+10 MAD',
      labelColor: '#FCD34D',
      amountColor: '#FBBF24',
    });
  }

  if (impliedLoyaltyDiscount > 0) {
    displayRows.push({
      label:
        booking.loyaltyRewardApplied ||
        pickLang(lang, {
          ar: '🎁 تخفيض الولاء / VIP',
          fr: '🎁 Remise Fidélité / VIP',
          amz: '🎁 ⴰⵙⵙⵏⵇⵙ ⵏ ⵜⵖⵓⵏⵉ / VIP',
          en: '🎁 Loyalty / VIP Discount',
          es: '🎁 Descuento Fidelidad / VIP',
        }),
      amount: `-${impliedLoyaltyDiscount} MAD`,
      labelColor: '#6EE7B7',
      amountColor: '#34D399',
    });
  } else if ((booking.totalSavingsMAD ?? 0) > 0) {
    displayRows.push({
      label: pickLang(lang, {
        ar: '🎁 إجمالي التوفير المطبق',
        fr: '🎁 Économie totale appliquée',
        amz: '🎁 ⵜⵉⵙⵏⴼⴰⵍ ⵎⴰⵕⵕⴰ',
        en: '🎁 Total Savings Applied',
        es: '🎁 Ahorro total aplicado',
      }),
      amount: `-${booking.totalSavingsMAD} MAD`,
      labelColor: '#6EE7B7',
      amountColor: '#34D399',
    });
  }

  const rowHeight = 36;
  const srvBoxHeaderH = 66;
  const srvBoxFooterH = 88;
  const srvHeight = srvBoxHeaderH + Math.max(1, displayRows.length) * rowHeight + srvBoxFooterH;

  // Layout vertical anchors computed dynamically so any number of services fits cleanly
  const cardX = 36;
  const cardY = 36;
  const cardW = 900 - 72;
  const headerY = cardY + 44;
  const div1Y = headerY + 114;
  const barberBoxY = div1Y + 26;
  const gridY = barberBoxY + 112;
  const cellH = 98;
  const srvY = gridY + cellH * 2 + 40;
  const cihGap = booking.cihReceiptName ? 70 : 0;
  const bottomAreaY = srvY + srvHeight + 24;
  const qrBoxY = bottomAreaY + cihGap + 10;
  const qrSize = 180;
  const qrPad = 14;
  const neededHeight = qrBoxY + qrSize + qrPad * 2 + 46 + 36;

  const width = 900;
  const height = Math.max(1280, neededHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Outer backdrop
  ctx.fillStyle = '#07080B';
  ctx.fillRect(0, 0, width, height);

  // Main Ticket Card Shell
  const cardH = height - 72;

  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = '#11141B';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = accentColor;
  ctx.stroke();
  ctx.clip();

  // Top Barber-Pole Tricolor Bar
  const stripeW = cardW / 3;
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(cardX, cardY, stripeW, 14);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(cardX + stripeW, cardY, stripeW, 14);
  ctx.fillStyle = '#2563EB';
  ctx.fillRect(cardX + stripeW * 2, cardY, stripeW + 2, 14);

  // Header: Salon Logo & Title
  const logoSize = 86;
  const logoX = cardX + 42;
  drawRoundedRect(ctx, logoX, headerY, logoSize, logoSize, 20);
  ctx.fillStyle = '#090A0E';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#D97706';
  ctx.stroke();

  if (logoImg) {
    ctx.save();
    drawRoundedRect(ctx, logoX + 4, headerY + 4, logoSize - 8, logoSize - 8, 16);
    ctx.clip();
    ctx.drawImage(logoImg, logoX + 4, headerY + 4, logoSize - 8, logoSize - 8);
    ctx.restore();
  } else {
    ctx.fillStyle = '#F59E0B';
    ctx.font = '900 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SB', logoX + logoSize / 2, headerY + 54);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 34px sans-serif';
  ctx.fillText('SALON BOUMLIK', logoX + logoSize + 24, headerY + 38);

  ctx.fillStyle = '#FBBF24';
  ctx.font = '700 18px sans-serif';
  ctx.fillText('MORE THAN BARBER SHOP • TAROUDANT', logoX + logoSize + 24, headerY + 68);

  // Ticket Number Badge (top right)
  const cleanTicket = booking.ticketNumber.startsWith('#')
    ? booking.ticketNumber
    : `#${booking.ticketNumber}`;
  ctx.font = '900 26px monospace';
  const badgeW = Math.max(180, ctx.measureText(cleanTicket).width + 44);
  const badgeH = 54;
  const badgeX = cardX + cardW - 42 - badgeW;
  const badgeY = headerY + 14;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 16);
  ctx.fillStyle = accentColor;
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(cleanTicket, badgeX + badgeW / 2, badgeY + 36);

  // Divider line
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 42, div1Y);
  ctx.lineTo(cardX + cardW - 42, div1Y);
  ctx.stroke();

  // Barber Banner
  drawRoundedRect(ctx, cardX + 42, barberBoxY, cardW - 84, 86, 20);
  ctx.fillStyle = '#181C26';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accentColor;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cardX + 80, barberBoxY + 43, 12, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#A1A1AA';
  ctx.font = '700 15px sans-serif';
  ctx.fillText(
    pickLang(lang, {
      ar: 'الحلاق المعين • BARBIER',
      fr: 'BARBIER ASSIGNÉ',
      amz: 'ⴰⵎⴽⵕⴰⴹ • BARBIER',
      en: 'ASSIGNED BARBER',
      es: 'BARBERO ASIGNADO',
    }),
    cardX + 108,
    barberBoxY + 32
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 26px sans-serif';
  ctx.fillText(
    truncateText(ctx, booking.barberName, cardW - 200),
    cardX + 108,
    barberBoxY + 64
  );

  // Client & Schedule 2x2 Grid
  const colW = (cardW - 104) / 2;

  const cells = [
    {
      x: cardX + 42,
      y: gridY,
      label: pickLang(lang, {
        ar: 'الزبون • CLIENT',
        fr: 'CLIENT',
        amz: 'ⴰⵎⵙⴰⵖ • CLIENT',
        en: 'CLIENT',
        es: 'CLIENTE',
      }),
      value: booking.clientName,
      color: '#FFFFFF',
    },
    {
      x: cardX + 62 + colW,
      y: gridY,
      label: pickLang(lang, {
        ar: 'الهاتف • PHONE',
        fr: 'TÉLÉPHONE',
        amz: 'ⵜⵉⵍⵉⴼⵓⵏ • PHONE',
        en: 'PHONE',
        es: 'TELÉFONO',
      }),
      value: booking.clientPhone,
      color: '#34D399',
    },
    {
      x: cardX + 42,
      y: gridY + cellH + 18,
      label: pickLang(lang, {
        ar: 'التاريخ • DATE',
        fr: 'DATE',
        amz: 'ⴰⵙⴰⴽⵓⴷ • DATE',
        en: 'DATE',
        es: 'FECHA',
      }),
      value: booking.date,
      color: '#FBBF24',
    },
    {
      x: cardX + 62 + colW,
      y: gridY + cellH + 18,
      label: pickLang(lang, {
        ar: 'التوقيت • TIME',
        fr: 'HORAIRE',
        amz: 'ⴰⴽⵓⴷ • TIME',
        en: 'TIME',
        es: 'HORARIO',
      }),
      value:
        booking.timeSlot === 'FLEXIBLE'
          ? pickLang(lang, {
              ar: 'يختاره الحلاق (مرن)',
              fr: 'Choix du barbier',
              amz: 'ⴰⴽⵓⴷ ⴰⵍⵡⵡⴰⵖ',
              en: 'Barber Choice',
              es: 'Elige el barbero',
            })
          : booking.timeSlot,
      color: '#60A5FA',
    },
  ];

  cells.forEach((cell) => {
    drawRoundedRect(ctx, cell.x, cell.y, colW, cellH, 18);
    ctx.fillStyle = '#0B0D13';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#27272A';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '700 14px sans-serif';
    ctx.fillText(cell.label, cell.x + 20, cell.y + 34);

    ctx.fillStyle = cell.color;
    ctx.font = '800 24px sans-serif';
    ctx.fillText(truncateText(ctx, cell.value, colW - 40), cell.x + 20, cell.y + 72);
  });

  // Services, Fees & Total Box (All selected services + Queue Avoidance fee)
  drawRoundedRect(ctx, cardX + 42, srvY, cardW - 84, srvHeight, 22);
  ctx.fillStyle = '#0B0D13';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#27272A';
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '700 15px sans-serif';
  ctx.fillText(
    pickLang(lang, {
      ar: 'الخدمات والرسوم • SERVICES & FEES',
      fr: 'PRESTATIONS & FRAIS SÉLECTIONNÉS',
      amz: 'ⵜⵉⵡⵓⵔⵉⵡⵉⵏ • SERVICES',
      en: 'SELECTED SERVICES & FEES',
      es: 'SERVICIOS Y TARIFAS',
    }),
    cardX + 66,
    srvY + 34
  );

  let itemCursorY = srvY + 72;
  displayRows.forEach((row) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = row.labelColor;
    ctx.font = '600 19px sans-serif';
    ctx.fillText(
      truncateText(ctx, row.label, cardW - 260),
      cardX + 66,
      itemCursorY
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = row.amountColor;
    ctx.font = '800 20px monospace';
    ctx.fillText(row.amount, cardX + cardW - 66, itemCursorY);
    itemCursorY += rowHeight;
  });

  // Divider inside services box
  const totalDivY = srvY + srvHeight - 84;
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 64, totalDivY);
  ctx.lineTo(cardX + cardW - 64, totalDivY);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#D4D4D8';
  ctx.font = '800 20px sans-serif';
  ctx.fillText(
    pickLang(lang, {
      ar: 'المجموع النهائي (الأداء بالصالون)',
      fr: 'TOTAL FINAL (PAIEMENT AU SALON)',
      amz: 'ⵜⵉⵖⵔⴰⴷ ⵎⴰⵕⵕⴰ (ⴰⵙⴰⵍⵓⵏ)',
      en: 'FINAL TOTAL (PAY AT SALON)',
      es: 'TOTAL FINAL (PAGO EN SALÓN)',
    }),
    cardX + 66,
    totalDivY + 48
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#F59E0B';
  ctx.font = '900 34px monospace';
  ctx.fillText(`${booking.finalTotalMAD ?? 0} MAD`, cardX + cardW - 66, totalDivY + 50);

  // CIH Transfer note badge if attached
  if (booking.cihReceiptName) {
    drawRoundedRect(ctx, cardX + 42, bottomAreaY, cardW - 84, 44, 12);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.fill();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#34D399';
    ctx.font = '700 17px sans-serif';
    ctx.fillText(
      `✓ CIH Deposit Receipt Attached: ${truncateText(ctx, booking.cihReceiptName, 520)}`,
      cardX + cardW / 2,
      bottomAreaY + 28
    );
  }

  // QR Code & Verification Section
  const qrFrameX = cardX + 46;

  drawRoundedRect(ctx, qrFrameX, qrBoxY, qrSize + qrPad * 2, qrSize + qrPad * 2, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  if (qrImg) {
    ctx.drawImage(qrImg, qrFrameX + qrPad, qrBoxY + qrPad, qrSize, qrSize);
  }

  const infoX = qrFrameX + qrSize + qrPad * 2 + 28;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px sans-serif';
  ctx.fillText(
    pickLang(lang, {
      ar: 'تذكرة إلكترونية رسمية',
      fr: 'BILLET ÉLECTRONIQUE OFFICIEL',
      amz: 'ⵜⴰⴼⵔⴽⵉⵜ ⵜⴰⵎⴰⴷⴷⵓⴷⵜ',
      en: 'OFFICIAL DIGITAL TICKET',
      es: 'TICKET DIGITAL OFICIAL',
    }),
    infoX,
    qrBoxY + 44
  );

  ctx.fillStyle = '#A1A1AA';
  ctx.font = '500 17px sans-serif';
  ctx.fillText('Rue Bir Anzarane (2e etage)', infoX, qrBoxY + 82);
  ctx.fillText('Au-dessus Boulangerie ITRI • Taroudant', infoX, qrBoxY + 110);

  ctx.fillStyle = '#34D399';
  ctx.font = '800 20px monospace';
  ctx.fillText('Tel / WhatsApp: 06 35 39 25 03', infoX, qrBoxY + 150);

  ctx.fillStyle = '#FBBF24';
  ctx.font = '700 16px sans-serif';
  ctx.fillText(
    booking.checkInToken
      ? `Check-In QR (${booking.checkInToken}) • Scan at Salon`
      : 'Scan Check-In QR upon arrival',
    infoX,
    qrBoxY + 184
  );

  ctx.restore();

  // Trigger Crisp PNG File Download (compatible with mobile & desktop)
  await new Promise<void>((resolve, reject) => {
    const triggerAnchorDownload = (href: string, revokeAfter?: string) => {
      const a = document.createElement('a');
      a.href = href;
      a.download = 'Salon_Boumlik_Ticket.png';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (revokeAfter) {
        setTimeout(() => URL.revokeObjectURL(revokeAfter), 5000);
      }
      resolve();
    };

    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            triggerAnchorDownload(url, url);
          } else {
            try {
              const dataUrl = canvas.toDataURL('image/png');
              triggerAnchorDownload(dataUrl);
            } catch (err) {
              reject(err);
            }
          }
        },
        'image/png',
        1.0
      );
    } else {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        triggerAnchorDownload(dataUrl);
      } catch (err) {
        reject(err);
      }
    }
  });
}
