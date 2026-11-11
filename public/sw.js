// Service Worker for Salon Boumlik notifications and offline support
const CACHE_NAME = 'salon-boumlik-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'Salon Boumlik';
    const options = {
      body: data.body || 'Mise à jour de votre réservation',
      icon: data.icon || '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
      badge: data.badge || '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
      data: data.data || {},
      vibrate: [200, 100, 200],
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Salon Boumlik', {
        body: text,
        icon: '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
