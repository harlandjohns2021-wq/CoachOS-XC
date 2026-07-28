const ASSET_VERSION = '2026-07-28-v2';
const CACHE_NAME = `xc-command-${ASSET_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  `./styles.css?v=${ASSET_VERSION}`,
  `./app.js?v=${ASSET_VERSION}`,
  `./roster-import.js?v=${ASSET_VERSION}`,
  `./results-import.js?v=${ASSET_VERSION}`,
  `./practice-enhancements.js?v=${ASSET_VERSION}`,
  `./speech-to-text.js?v=${ASSET_VERSION}`,
  './firebase-cloud.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
