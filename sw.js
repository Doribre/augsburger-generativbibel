// Service Worker — macht die Augsburger GenerativBibel offline-fähig.
// Strategie: HTML-Seiten network-first (immer aktuelle Fassung, offline Fallback
// auf Cache); statische Assets (CSS/JS/JSON/Bilder) cache-first. Kerndaten werden
// beim Install vorab gecacht; Buch-Dateien zur Laufzeit.
const CACHE = 'agb-v20';
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
  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  e.respondWith((async () => {
    // HTML-Seiten: network-first — immer die aktuelle Fassung; offline Fallback auf Cache.
    if (isDoc) {
      try {
        const res = await fetch(req);
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
      }
    }
    // Statische Assets (CSS/JS/JSON/Bilder): cache-first.
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
