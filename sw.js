const CACHE_NAME = 'xc-command-v6';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './roster-import.js',
  './results-import.js',
  './practice-enhancements.js',
  './speech-to-text.js',
  './data-integrity-fixes.js',
  './firebase-cloud.js',
  './distance-enhancements.js',
  './ai-coach.js',
  './individual-science-engine.js',
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
  const isNavigation = event.request.mode === 'navigate';
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (isNavigation) return caches.match('./index.html');
        return new Response('Offline resource unavailable.', { status: 503, statusText: 'Offline' });
      })
  );
});
