const CACHE = 'mesheures-shell-v28.0.0';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-512.png',
  './style/refonte.css?v=28.0.0',
  './style/v24-modules.css?v=28.0.0',
  './style/v24.css?v=28.0.0',
  './scripts/app-core.js',
  './scripts/app-pwa.js',
  './scripts/app-ui.js',
  './scripts/app-parser.js',
  './scripts/app-plugins.js',
  './scripts/app.js',
  './scripts/app-pay.js',
  './scripts/app-projection.js',
  './scripts/app-legal.js',
  './scripts/app-backup.js',
  './scripts/app-runtime.js',
  './scripts/app-intelligence.js',
  './scripts/app-evidence.js',
  './scripts/app-dossier.js',
  './scripts/app-reconciliation.js',
  './scripts/app-hybrid.js',
  './scripts/app-v24.js',
  './scripts/app-v25.js',
  './scripts/app-v26.js',
  './scripts/app-v27.js',
  './scripts/app-v28.js',
  './data/mesheures-default-backup.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('mesheures-shell-') && key !== CACHE)
            .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Application assets: network-first keeps the installed PWA fresh while
  // the cache remains a real offline fallback.
  if (sameOrigin) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // External libraries (CDN): cache-first after their first successful load.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
