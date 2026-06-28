// Service worker minimal : cache l'app shell pour l'offline. Cache-first.
const CACHE = 'temps-v11';
const ASSETS = ['.', 'index.html', 'style.css', 'time.js', 'parse.js', 'ui.js', 'manifest.json', 'icons/icon.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // active la nouvelle version sans attendre la fermeture des onglets
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()) // prend le contrôle des onglets ouverts tout de suite
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
