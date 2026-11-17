import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import { SALON_INFO } from '../data/barbershopData';

export interface ClientQrTarget {
  id: string;
  clientName: string;
  phoneDisplay: string;
  normalizedPhone: string;
  verifiedVisits?: number;
  isVip?: boolean;
  isBanned?: boolean;
}

export interface ParsedQrScanResult {
  kind: 'client' | 'ticket' | 'phone';
  query: string;
  clientId?: string;
}

/**
 * Builds the deterministic deep-link URL encoded inside each client's unique profile QR code.
 */
export function buildClientProfileQrPayload(client: ClientQrTarget): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://salonboumlik.com';
  const lookup = client.phoneDisplay || client.normalizedPhone || client.id;
  return `${origin}/#track=${encodeURIComponent(lookup)}&cid=${encodeURIComponent(client.id)}`;
}

/**
 * Generates a high-contrast QR code Data URL for a client's unique profile.
 */
export async function generateClientProfileQrDataUrl(
  client: ClientQrTarget
): Promise<string> {
  const payload = buildClientProfileQrPayload(client);
  return QRCode.toDataURL(payload, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#09090B',
      light: '#FFFFFF',
    },
  });
}

/**
 * Parses scanned QR text from either a Client Profile QR, an Appointment Ticket QR,
 * or a raw ticket/phone code, normalizing it for direct lookup in TrackBookingModal or Admin filters.
 */
export function parseScannedQrResult(rawDecoded: string): ParsedQrScanResult {
  const text = rawDecoded.trim();

  if (!text) {
    return { kind: 'ticket', query: '' };
  }

  // Legacy/explicit prefix check (e.g. SBOUMLIK_CLIENT:c_612345678|0612345678)
  if (text.toUpperCase().startsWith('SBOUMLIK_CLIENT:')) {
    const rest = text.slice('SBOUMLIK_CLIENT:'.length);
    const [cidPart, phonePart] = rest.split('|');
    const query = (phonePart || cidPart || '').trim();
    return {
      kind: 'client',
      query,
      clientId: cidPart?.trim() || undefined,
    };
  }

  // Hash deep-link parsing (#track=...&cid=...)
  if (text.toLowerCase().includes('track=')) {
    const afterTrack = text.split(/track=/i)[1] || '';
    const rawTrackVal = afterTrack.split('&')[0] || '';
    let decodedQuery = rawTrackVal.trim();
    try {
      decodedQuery = decodeURIComponent(rawTrackVal).trim();
    } catch {
      decodedQuery = rawTrackVal.trim();
    }

    let clientId: string | undefined;
    const cidMatch = text.match(/[?&#]cid=([^&#]+)/i);
    if (cidMatch?.[1]) {
      try {
        clientId = decodeURIComponent(cidMatch[1]).trim();
      } catch {
        clientId = cidMatch[1].trim();
      }
    }

    if (clientId) {
      return {
        kind: 'client',
        query: decodedQuery || clientId,
        clientId,
      };
    }

    return {
      kind: 'ticket',
      query: decodedQuery,
    };
  }

  // Raw CRM doc ID (c_612345678)
  if (/^c_\d{4,}$/i.test(text)) {
    return {
      kind: 'client',
      query: text,
      clientId: text,
    };
  }

  // Raw Moroccan/international phone digits
  const digitsOnly = text.replace(/\D/g, '');
  if (!text.toUpperCase().includes('SB') && digitsOnly.length >= 8) {
    return {
      kind: 'phone',
      query: text,
    };
  }

  return {
    kind: 'ticket',
    query: text,
  };
}

/**
 * Decodes a QR code from an uploaded image File using Html5Qrcode.
 */
export async function scanQrImageFile(
  file: File,
  containerId: string
): Promise<string> {
  const html5Qr = new Html5Qrcode(containerId);
  try {
    return await html5Qr.scanFile(file, true);
  } finally {
    try {
      html5Qr.clear();
    } catch {
      // ignore cleanup error when element has no active camera
    }
  }
}

function loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
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

function drawRoundedBox(
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

/**
 * Renders and downloads a branded PNG pass card containing the client's unique QR code.
 */
export async function downloadClientQrPassPng(
  client: ClientQrTarget,
  existingQrDataUrl?: string
): Promise<void> {
  const qrDataUrl = existingQrDataUrl || (await generateClientProfileQrDataUrl(client));
  const [logoImg, qrImg] = await Promise.all([
    loadCanvasImage(SALON_INFO.media.logoClean),
    loadCanvasImage(qrDataUrl),
  ]);

  const width = 540;
  const height = 680;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background card
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, width, height);

  // Subtle inner card surface
  ctx.fillStyle = '#111319';
  drawRoundedBox(ctx, 24, 24, width - 48, height - 48, 22);
  ctx.fill();
  ctx.strokeStyle = client.isVip ? '#F59E0B' : '#27272A';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top barber-pole stripe
  const stripeW = (width - 48) / 3;
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(24, 24, stripeW, 7);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(24 + stripeW, 24, stripeW, 7);
  ctx.fillStyle = '#2563EB';
  ctx.fillRect(24 + stripeW * 2, 24, stripeW, 7);

  // Header brand
  if (logoImg) {
    ctx.save();
    drawRoundedBox(ctx, 48, 52, 54, 54, 12);
    ctx.clip();
    ctx.drawImage(logoImg, 48, 52, 54, 54);
    ctx.restore();
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('SALON BOUMLIK', logoImg ? 116 : 48, 76);

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('CLIENT PROFILE PASS • TAROUDANT', logoImg ? 116 : 48, 99);

  // Divider
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 124);
  ctx.lineTo(width - 48, 124);
  ctx.stroke();

  // Client Name & Details
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
  ctx.fillText(client.clientName.slice(0, 28), width / 2, 168);

  ctx.fillStyle = '#A1A1AA';
  ctx.font = 'bold 16px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(client.phoneDisplay || client.normalizedPhone, width / 2, 198);

  ctx.fillStyle = '#FBBF24';
  ctx.font = 'bold 13px ui-monospace, SFMono-Regular, monospace';
  const badgeText = [
    `ID: ${client.id}`,
    typeof client.verifiedVisits === 'number' ? `VISITS: ${client.verifiedVisits}` : null,
    client.isVip ? 'VIP' : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  ctx.fillText(badgeText, width / 2, 226);

  // White QR Container
  ctx.fillStyle = '#FFFFFF';
  drawRoundedBox(ctx, 115, 254, 310, 310, 20);
  ctx.fill();

  if (qrImg) {
    ctx.drawImage(qrImg, 130, 269, 280, 280);
  }

  // Bottom Scan Instruction
  ctx.fillStyle = '#D4D4D8';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('امسح الكود لفتح ملف التتبع والولاء فوراً', width / 2, 600);

  ctx.fillStyle = '#71717A';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('Scan at Salon Boumlik to open tracking & loyalty history', width / 2, 624);

  const link = document.createElement('a');
  const safeName = (client.clientName || client.id)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || client.id;
  link.download = `Salon_Boumlik_Client_QR_${safeName}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
