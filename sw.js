/* sw.js — offline first. No signal at the pitch is the normal case. */

const CACHE = 'rota-v11';

const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'rotation.js',
  'sound.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-512.png',
  /* the design is set in Barlow. A pitch has no signal, so the faces have to
     already be on the phone or the whole thing falls back to Arial Narrow. */
  'fonts/barlow-600-latin.woff2',
  'fonts/barlow-600-latin-ext.woff2',
  'fonts/barlow-condensed-700-latin.woff2',
  'fonts/barlow-condensed-700-latin-ext.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* the debug hook puts ?t= on the page URL. Cache under the path alone so
     one game never fills the cache with query-string copies of the shell. */
  const key = new Request(url.origin + url.pathname, { headers: request.headers });

  event.respondWith(
    caches.open(CACHE).then((cache) => cache.match(key).then((hit) => {
      const network = fetch(key).then((response) => {
        if (response && response.ok) cache.put(key, response.clone());
        return response;
      });
      if (hit) {
        network.catch(() => {});
        return hit;
      }
      return network.catch(() => cache.match('index.html'));
    }))
  );
});
