// ═══════════════════════════════════════════════════
//  ArogyaAI Service Worker v2 — Optimized PWA
// ═══════════════════════════════════════════════════
const CACHE = 'arogyaai-v2';
const RUNTIME = 'arogyaai-runtime-v2';
const OFFLINE_URL = '/arogyaai/offline.html';

const PRECACHE = [
  '/arogyaai/', '/arogyaai/index.html', '/arogyaai/login.html',
  '/arogyaai/dashboard.html', '/arogyaai/find-doctors.html',
  '/arogyaai/features.html', '/arogyaai/cash-system.html',
  '/arogyaai/onboarding.html', '/arogyaai/api.js',
  '/arogyaai/manifest.json', '/arogyaai/icon-192.svg',
  '/arogyaai/icon-512.svg', '/arogyaai/offline.html',
];

// Install — precache core
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

// Activate — purge old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== RUNTIME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - HTML pages: network-first (fresh content), fallback to cache, then offline page
// - Static assets (fonts, svg, js): cache-first (instant load)
// - API calls: never cache
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  // Never cache API/AI calls
  if (url.includes('api.anthropic.com') || url.includes('railway.app') || url.includes('/v1/messages')) return;

  // Fonts & CDN — cache-first, long-lived
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') || url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const clone = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, clone));
        return res;
      }))
    );
    return;
  }

  // HTML pages — network-first for freshness
  if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req).then(cached => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Everything else (svg, js, etc) — cache-first
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, clone));
      }
      return res;
    }).catch(() => cached))
  );
});

// Push notifications
self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil(self.registration.showNotification(d.title || 'ArogyaAI', {
    body: d.body || 'You have a new notification',
    icon: '/arogyaai/icon-192.svg', badge: '/arogyaai/icon-192.svg',
    data: { url: d.url || '/arogyaai/dashboard.html' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
