// ═══════════════════════════════════════════════════
//  ArogyaAI Service Worker — PWA Offline Support
// ═══════════════════════════════════════════════════

const CACHE = 'arogyaai-v1';
const OFFLINE_URL = '/arogyaai/offline.html';

const PRECACHE = [
  '/arogyaai/',
  '/arogyaai/index.html',
  '/arogyaai/login.html',
  '/arogyaai/dashboard.html',
  '/arogyaai/find-doctors.html',
  '/arogyaai/features.html',
  '/arogyaai/api.js',
  '/arogyaai/manifest.json',
  '/arogyaai/icon-192.svg',
  '/arogyaai/icon-512.svg',
  '/arogyaai/offline.html',
];

// Install — cache all core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET and API calls
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('api.anthropic.com')) return;
  if (event.request.url.includes('railway.app')) return;
  if (event.request.url.includes('fonts.googleapis.com')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful HTML/JS responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// Background sync for offline bookings
self.addEventListener('sync', event => {
  if (event.tag === 'sync-appointments') {
    event.waitUntil(syncPendingAppointments());
  }
});

async function syncPendingAppointments() {
  const pending = JSON.parse(localStorage.getItem('pending_appointments') || '[]');
  for (const apt of pending) {
    try {
      await fetch('/api/appointments', { method: 'POST', body: JSON.stringify(apt) });
    } catch(e) { /* will retry on next sync */ }
  }
}

// Push notifications
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'ArogyaAI', {
      body: data.body || 'You have a new notification',
      icon: '/arogyaai/icon-192.svg',
      badge: '/arogyaai/icon-192.svg',
      data: { url: data.url || '/arogyaai/dashboard.html' },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action !== 'dismiss') {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
