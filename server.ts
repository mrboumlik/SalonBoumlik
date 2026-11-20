import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type * as WebPushLib from 'web-push';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof WebPushLib;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const VAPID_KEYS_FILE = path.join(__dirname, '.vapid-keys.json');
const DEFAULT_VAPID_SUBJECT = 'mailto:MrBoumlik@gmail.com';

function stripQuotes(value?: string): string {
  return (value || '').trim().replace(/^["']+|["']+$/g, '');
}

function resolveVapidSubject(rawSubject?: string): string {
  const cleaned = stripQuotes(rawSubject);
  if (!cleaned) return DEFAULT_VAPID_SUBJECT;

  const candidate = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)
    ? `mailto:${cleaned}`
    : cleaned;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'mailto:' || parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return candidate;
    }
  } catch {
    // Fall through to warning + safe default
  }

  console.warn(
    `Invalid VAPID_SUBJECT ("${cleaned.slice(0, 12)}..."); falling back to ${DEFAULT_VAPID_SUBJECT}.`
  );
  return DEFAULT_VAPID_SUBJECT;
}

const VAPID_SUBJECT = resolveVapidSubject(process.env.VAPID_SUBJECT);

interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
}

function loadOrGenerateVapidKeys(): VapidKeyPair {
  const envPub = stripQuotes(process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY);
  const envPriv = stripQuotes(process.env.VAPID_PRIVATE_KEY);
  if (envPub && envPriv) {
    return { publicKey: envPub, privateKey: envPriv };
  }

  try {
    if (fs.existsSync(VAPID_KEYS_FILE)) {
      const raw = fs.readFileSync(VAPID_KEYS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<VapidKeyPair>;
      if (parsed.publicKey && parsed.privateKey) {
        return { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
      }
    }
  } catch (err) {
    console.warn('Could not read persisted VAPID keys, regenerating:', err);
  }

  const generated = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(
      VAPID_KEYS_FILE,
      JSON.stringify(
        {
          publicKey: generated.publicKey,
          privateKey: generated.privateKey,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (err) {
    console.warn('Could not persist VAPID keys to disk (using in-memory keys):', err);
  }

  return {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
  };
}

function initializeVapid(): { keys: VapidKeyPair; ready: boolean } {
  const candidateKeys = loadOrGenerateVapidKeys();
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, candidateKeys.publicKey, candidateKeys.privateKey);
    return { keys: candidateKeys, ready: true };
  } catch (err) {
    console.warn(
      'Configured VAPID keys failed validation; generating fresh runtime VAPID keys so server can start:',
      err
    );
    try {
      const fallbackKeys = webpush.generateVAPIDKeys();
      webpush.setVapidDetails(DEFAULT_VAPID_SUBJECT, fallbackKeys.publicKey, fallbackKeys.privateKey);
      return { keys: fallbackKeys, ready: true };
    } catch (fallbackErr) {
      console.error('Web Push initialization disabled due to VAPID error:', fallbackErr);
      return { keys: { publicKey: '', privateKey: '' }, ready: false };
    }
  }
}

const vapidInit = initializeVapid();
const vapidKeys = vapidInit.keys;
const pushReady = vapidInit.ready;

interface IncomingPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface IncomingPushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  eventType?: string;
  ticketNumber?: string;
  lang?: string;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '512kb' }));

  // Ensure Service Workers are served with trusted scope & fresh cache headers
  app.use((req, res, next) => {
    if (
      req.path === '/sw.js' ||
      req.path === '/dev-sw.js' ||
      req.path === '/sw-push.js' ||
      req.path === '/manifest.webmanifest'
    ) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  });

  if (!IS_PRODUCTION) {
    app.get('/sw.js', (_req, res, next) => {
      const devSwPath = path.join(__dirname, 'dev-dist', 'sw.js');
      if (fs.existsSync(devSwPath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.sendFile(devSwPath);
        return;
      }
      next();
    });
    app.get(/^\/workbox-[a-zA-Z0-9_-]+\.js$/, (req, res, next) => {
      const candidate = path.join(__dirname, 'dev-dist', path.basename(req.path));
      if (fs.existsSync(candidate)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.sendFile(candidate);
        return;
      }
      next();
    });
  }

  // Expose VAPID Public Key for browser PushManager.subscribe()
  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  // Dispatch verified VAPID Web Push notifications to target client or staff subscriptions
  app.post('/api/push/send', async (req, res) => {
    try {
      if (!pushReady) {
        res.status(503).json({ sent: 0, failed: 0, expiredEndpoints: [], error: 'Push not initialized' });
        return;
      }
      const body = req.body as {
        subscriptions?: IncomingPushSubscription[];
        payload?: IncomingPushPayload;
      };

      const rawSubs = Array.isArray(body?.subscriptions) ? body.subscriptions : [];
      const validSubs = rawSubs
        .filter(
          (sub) =>
            sub &&
            typeof sub.endpoint === 'string' &&
            sub.endpoint.startsWith('https://') &&
            sub.keys &&
            typeof sub.keys.p256dh === 'string' &&
            typeof sub.keys.auth === 'string'
        )
        .slice(0, 50);

      if (validSubs.length === 0) {
        res.json({ sent: 0, failed: 0, expiredEndpoints: [] });
        return;
      }

      const rawPayload = body?.payload || {};
      const title = String(rawPayload.title || 'Salon Boumlik').trim().slice(0, 120);
      const messageBody = String(
        rawPayload.body || 'تحديث بخصوص موعدك في صالون بومليك — Taroudant'
      )
        .trim()
        .slice(0, 300);
      const targetUrl =
        typeof rawPayload.url === 'string' && rawPayload.url.startsWith('/')
          ? rawPayload.url.slice(0, 200)
          : '/';
      const tag = String(rawPayload.tag || `salon-boumlik-${Date.now()}`).slice(0, 96);

      const pushPayload = JSON.stringify({
        title,
        body: messageBody,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag,
        renotify: false,
        requireInteraction: false,
        timestamp: Date.now(),
        data: {
          url: targetUrl,
          eventType: String(rawPayload.eventType || 'notification').slice(0, 64),
          ticketNumber: rawPayload.ticketNumber
            ? String(rawPayload.ticketNumber).slice(0, 32)
            : undefined,
        },
      });

      const expiredEndpoints: string[] = [];
      let sent = 0;
      let failed = 0;

      await Promise.all(
        validSubs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.keys.p256dh,
                  auth: sub.keys.auth,
                },
              },
              pushPayload,
              {
                TTL: 86400,
                urgency: 'high',
                topic: tag.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || undefined,
              }
            );
            sent += 1;
          } catch (err: unknown) {
            failed += 1;
            const statusCode =
              typeof err === 'object' && err !== null && 'statusCode' in err
                ? Number((err as { statusCode?: number }).statusCode)
                : 0;
            if (statusCode === 404 || statusCode === 410) {
              expiredEndpoints.push(sub.endpoint);
            } else {
              console.warn(`Web push delivery error (${statusCode || 'unknown'}):`, err);
            }
          }
        })
      );

      res.json({ sent, failed, expiredEndpoints });
    } catch (err) {
      console.error('Error in /api/push/send:', err);
      res.status(500).json({ error: 'Failed to dispatch push notifications' });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });

    // HMR is disabled in AI Studio; Vite 8 still injects /@vite/client and unconditionally
    // opens a WebSocket on port 24678. Serve a clean zero-WebSocket shim before vite.middlewares.
    const viteClientNoHmrShim = [
      'import "/node_modules/vite/dist/client/env.mjs";',
      '',
      'const sheetsMap = new Map();',
      'const linkSheetsMap = new Map();',
      'if (typeof document !== "undefined") {',
      '  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {',
      '    const id = el.getAttribute("data-vite-dev-id");',
      '    if (id) sheetsMap.set(id, el);',
      '  });',
      '  document.querySelectorAll("link[rel=\\"stylesheet\\"][data-vite-dev-id]").forEach((el) => {',
      '    const id = el.getAttribute("data-vite-dev-id");',
      '    if (id) linkSheetsMap.set(id, el);',
      '  });',
      '}',
      '',
      'let lastInsertedStyle;',
      'function updateStyle(id, content) {',
      '  if (typeof document === "undefined" || linkSheetsMap.has(id)) return;',
      '  let style = sheetsMap.get(id);',
      '  if (!style) {',
      '    style = document.createElement("style");',
      '    style.setAttribute("type", "text/css");',
      '    style.setAttribute("data-vite-dev-id", id);',
      '    style.textContent = content;',
      '    const nonceEl = document.querySelector("meta[property=csp-nonce]");',
      '    const nonce = nonceEl && nonceEl.getAttribute("nonce");',
      '    if (nonce) style.setAttribute("nonce", nonce);',
      '    if (!lastInsertedStyle) {',
      '      document.head.appendChild(style);',
      '      setTimeout(() => { lastInsertedStyle = void 0; }, 0);',
      '    } else {',
      '      lastInsertedStyle.insertAdjacentElement("afterend", style);',
      '    }',
      '    lastInsertedStyle = style;',
      '  } else if (style.textContent !== content) {',
      '    style.textContent = content;',
      '  }',
      '  sheetsMap.set(id, style);',
      '}',
      '',
      'function removeStyle(id) {',
      '  if (typeof document === "undefined") return;',
      '  if (linkSheetsMap.has(id)) {',
      '    document.querySelectorAll(`link[rel="stylesheet"][data-vite-dev-id="${CSS.escape(id)}"]`).forEach((el) => el.remove());',
      '    linkSheetsMap.delete(id);',
      '  }',
      '  const style = sheetsMap.get(id);',
      '  if (style) {',
      '    style.remove();',
      '    sheetsMap.delete(id);',
      '  }',
      '}',
      '',
      'function createHotContext() {',
      '  return {',
      '    data: {},',
      '    accept() {},',
      '    acceptExports() {},',
      '    dispose() {},',
      '    prune() {},',
      '    decline() {},',
      '    invalidate() {},',
      '    on() {},',
      '    off() {},',
      '    send() {},',
      '  };',
      '}',
      '',
      'function injectQuery(url, queryToInject) {',
      '  if (url[0] !== "." && url[0] !== "/") return url;',
      '  const pathname = url.replace(/[?#].*$/, "");',
      '  const { search, hash } = new URL(url, "http://vite.dev");',
      '  return `${pathname}?${queryToInject}${search ? "&" + search.slice(1) : ""}${hash || ""}`;',
      '}',
      '',
      'const BaseElement = typeof HTMLElement !== "undefined" ? HTMLElement : class {};',
      'class ErrorOverlay extends BaseElement {}',
      '',
      'export { ErrorOverlay, createHotContext, injectQuery, removeStyle, updateStyle };',
    ].join('\n');

    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(viteClientNoHmrShim);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Salon Boumlik server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
