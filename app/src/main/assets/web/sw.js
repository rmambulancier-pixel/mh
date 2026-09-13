const CACHE = 'mesheures-shell-v18.0.18';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg', './style/refonte.css?v=18.0.18', './scripts/app-core.js', './scripts/app-pwa.js', './scripts/app-ui.js', './scripts/app-parser.js', './scripts/app-plugins.js', './scripts/app.js', './scripts/app-projection.js', './scripts/app-legal.js', './scripts/app-backup.js', './scripts/app-v18.js', './scripts/app-intelligence.js', './scripts/app-evidence.js', './scripts/app-dossier.js', './scripts/app-reconciliation.js', './scripts/app-pay.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Les fichiers de l'application doivent toujours tenter le réseau en premier :
  // cela évite qu'une ancienne version de GitHub Pages reste affichée plusieurs jours.
  if (sameOrigin) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Les bibliothèques CDN restent cache-first après leur premier chargement.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }))
  );
});
