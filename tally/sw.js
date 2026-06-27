/* Tally service worker — offline cache + reliable updates + notifications */
const VERSION = 'tally-v3';
const CORE = [
  './', './index.html', './styles.css', './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App shell (html/css/js/manifest) = network-first so a fresh deploy shows up on next open.
// Everything else (icons) = cache-first for speed/offline.
function isShell(url) {
  return /\.(html|css|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isShell(url)) {
    e.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => { try { c.put(request, copy); } catch (_) {} });
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => { try { c.put(request, copy); } catch (_) {} });
        return res;
      }).catch(() => cached)
    )
  );
});

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'notify' && self.registration && self.registration.showNotification) {
    self.registration.showNotification(d.title || 'Tally', {
      body: d.body || '', icon: './icons/icon-192.png', badge: './icons/icon-192.png',
      tag: d.tag || 'tally-reminder', renotify: true
    });
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cl) => {
    for (const c of cl) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('./index.html');
  }));
});
