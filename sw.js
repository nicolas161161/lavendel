// Offline-Speicher. Bei jedem Update die Versionsnummer erhÃ¶hen (auch VERSION in app.js).
const CACHE = 'lavendel-v9';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'foods.js', 'foods-db.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png',
  'vendor/tabler-icons.min.css', 'vendor/tabler-icons.woff2', 'vendor/html5-qrcode.min.js'];

self.addEventListener('install', e => {
  // cache: 'reload' umgeht den Browser-Zwischenspeicher, damit wirklich die neuen Dateien geladen werden
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin === location.origin) {
    // Eigene Dateien: zuerst online holen (immer aktuell), offline aus dem Speicher
    e.respondWith(Promise.race([fetch(e.request, { cache: 'no-cache' }), timeout(4000)])
      .then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(hit => hit || caches.match('index.html'))));
    return;
  }

  // Fremde Adressen (nur noch Open Food Facts): nicht speichern, direkt durchreichen
});
