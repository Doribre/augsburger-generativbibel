// Service Worker — macht die Augsburger GenerativBibel offline-fähig.
// Strategie: App-Hülle + Kerndaten beim Install vorab cachen; Buch-Dateien
// werden bei Erstaufruf zur Laufzeit gecacht (cache-first → danach offline).
const CACHE = 'agb-v2';
const CORE = [
  './', './index.html', './css/style.css', './js/app.js', './pruefbericht.html',
  './manifest.webmanifest', './icon.svg',
  './data/nt_books.json', './data/manifest.json', './data/history.json', './data/lexicon.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
