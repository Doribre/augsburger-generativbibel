// Service Worker — macht die Augsburger GenerativBibel offline-fähig.
// Strategie:
//   • HTML-Seiten            → network-first (immer aktuelle Fassung, offline aus Cache)
//   • Code & Katalog (klein) → stale-while-revalidate (sofort aus Cache, Update im
//                              Hintergrund → neue Funktionen/Bücher kommen zuverlässig durch)
//   • Buch-Daten & Bilder    → cache-first (große, selten geänderte Dateien)
// Beim Install werden die Kerndaten vorab gecacht. Zusammen mit der Selbstheilung
// in index.html (controllerchange → einmaliger Reload) sehen Besucher Updates ohne
// manuelles Leeren des Caches.
const CACHE = 'agb-v21';
const CORE = [
  './', './index.html', './css/style.css', './js/app.js', './pruefbericht.html',
  './manifest.webmanifest', './icon.svg',
  './data/nt_books.json', './data/ot_books.json', './data/manifest.json',
  './data/history.json', './data/lexicon.json'
];

// Kleine, häufig aktualisierte Dateien (Code + Katalog/Metadaten):
// stale-while-revalidate, damit neue Versionen zuverlässig durchsickern.
function isFreshAsset(url) {
  return /\.(?:js|css)$/.test(url.pathname)
    || /\/(?:nt_books|ot_books|manifest|history|lexicon)\.json$/.test(url.pathname)
    || url.pathname.endsWith('/manifest.webmanifest');
}

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

function cachePut(req, res) {
  if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // fremde Hosts unangetastet lassen
  const isDoc = req.mode === 'navigate' || req.destination === 'document';

  e.respondWith((async () => {
    // HTML-Seiten: network-first — immer die aktuelle Fassung; offline Fallback auf Cache.
    if (isDoc) {
      try {
        return cachePut(req, await fetch(req));
      } catch (err) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
      }
    }

    // Code & Katalog: stale-while-revalidate — sofort aus Cache, parallel auffrischen.
    if (isFreshAsset(url)) {
      const cached = await caches.match(req);
      const fresh = fetch(req).then((res) => cachePut(req, res)).catch(() => null);
      return cached || (await fresh) || Response.error();
    }

    // Buch-Daten / Bilder: cache-first.
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      return cachePut(req, await fetch(req));
    } catch (err) {
      return Response.error();
    }
  })());
});
