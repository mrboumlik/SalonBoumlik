// Trusted Service Worker Push & Notification Click Handlers for Salon Boumlik
// Imported by the VitePWA / Workbox Service Worker (/sw.js)

const DEFAULT_ICON = '/pwa-192x192.png';
const DEFAULT_BADGE = '/pwa-192x192.png';
const DEFAULT_TITLE = 'Salon Boumlik • صالون بومليك';

function buildSafeNotificationPayload(event) {
  const fallback = {
    title: DEFAULT_TITLE,
    body: 'تحديث جديد بخصوص موعدك في صالون بومليك',
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'salon-boumlik-update',
    renotify: false,
    requireInteraction: false,
    data: { url: '/' },
  };

  if (!event.data) {
    return fallback;
  }

  try {
    const parsed = event.data.json();
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }
    return {
      title: String(parsed.title || DEFAULT_TITLE).slice(0, 120),
      body: String(parsed.body || fallback.body).slice(0, 300),
      icon: typeof parsed.icon === 'string' && parsed.icon.startsWith('/') ? parsed.icon : DEFAULT_ICON,
      badge: typeof parsed.badge === 'string' && parsed.badge.startsWith('/') ? parsed.badge : DEFAULT_BADGE,
      tag: String(parsed.tag || 'salon-boumlik-update').slice(0, 96),
      renotify: Boolean(parsed.renotify),
      requireInteraction: false,
      vibrate: [160, 80, 160],
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
      data: parsed.data && typeof parsed.data === 'object' ? parsed.data : { url: '/' },
    };
  } catch {
    try {
      const text = event.data.text();
      return {
        ...fallback,
        body: String(text || fallback.body).slice(0, 300),
      };
    } catch {
      return fallback;
    }
  }
}

// Always invoke showNotification inside event.waitUntil to comply with userVisibleOnly
// and prevent Chromium "Possible spam" / silent-push heuristic warnings.
self.addEventListener('push', (event) => {
  const payload = buildSafeNotificationPayload(event);
  const { title, ...options } = payload;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/') || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if (targetUrl !== '/' && 'navigate' in client) {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle browser key rotation cleanly by notifying open windows
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: 'SALON_BOUMLIK_PUSH_SUB_CHANGED' });
      });
    })
  );
});
