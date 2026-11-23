import { SALON_INFO } from '../data/barbershopData';
import { Language } from '../types';
import { safeCopyToClipboard } from './safeBrowser';

export const SALON_WIFI_CONFIG = {
  ssid: SALON_INFO.media.wifiSsid,
  password: SALON_INFO.media.wifiPassword,
  security: 'WPA/WPA2',
  qrType: 'WPA' as const,
};

function escapeWifiField(value: string): string {
  return String(value || '').replace(/([\\;,:"])/g, '\\$1');
}

/**
 * Generates standard Wi-Fi quick-connect payload URI:
 * WIFI:T:WPA;S:@SalonBoumlik;P:@SalonBoumlik;;
 */
export function buildSalonWifiUri(
  ssid: string = SALON_WIFI_CONFIG.ssid,
  password: string = SALON_WIFI_CONFIG.password
): string {
  return `WIFI:T:${SALON_WIFI_CONFIG.qrType};S:${escapeWifiField(ssid)};P:${escapeWifiField(password)};;`;
}

export function formatWifiCredentialsSummary(lang: Language): string {
  if (lang === 'ar') {
    return [
      `الشبكة (SSID): ${SALON_WIFI_CONFIG.ssid}`,
      `الحماية: ${SALON_WIFI_CONFIG.security}`,
      `كلمة المرور: ${SALON_WIFI_CONFIG.password}`,
    ].join('\n');
  }
  if (lang === 'fr') {
    return [
      `Réseau (SSID) : ${SALON_WIFI_CONFIG.ssid}`,
      `Sécurité : ${SALON_WIFI_CONFIG.security}`,
      `Mot de passe : ${SALON_WIFI_CONFIG.password}`,
    ].join('\n');
  }
  if (lang === 'es') {
    return [
      `Red (SSID): ${SALON_WIFI_CONFIG.ssid}`,
      `Seguridad: ${SALON_WIFI_CONFIG.security}`,
      `Contraseña: ${SALON_WIFI_CONFIG.password}`,
    ].join('\n');
  }
  if (lang === 'amz') {
    return [
      `ⴰⵥⵟⵟⴰ (SSID): ${SALON_WIFI_CONFIG.ssid}`,
      `ⵜⴰⵏⴼⵔⵓⵜ: ${SALON_WIFI_CONFIG.security}`,
      `ⵜⴰⴳⵓⵔⵉ ⵏ ⵓⵣⵔⴰⵢ: ${SALON_WIFI_CONFIG.password}`,
    ].join('\n');
  }
  return [
    `Network (SSID): ${SALON_WIFI_CONFIG.ssid}`,
    `Security: ${SALON_WIFI_CONFIG.security}`,
    `Password: ${SALON_WIFI_CONFIG.password}`,
  ].join('\n');
}

/**
 * Copies the Wi-Fi password safely for immediate paste on desktop/iOS,
 * while allowing the native WIFI: URI link to launch on supported devices.
 */
export async function copyWifiPasswordSafely(): Promise<boolean> {
  return safeCopyToClipboard(SALON_WIFI_CONFIG.password);
}

export async function copyWifiSsidSafely(): Promise<boolean> {
  return safeCopyToClipboard(SALON_WIFI_CONFIG.ssid);
}
