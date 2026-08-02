const CACHE_NAME = 'xc-command-v11';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './roster-import.js',
  './results-import.js',
  './practice-enhancements.js',
  './speech-to-text.js',
  './season-bootstrap.js',
  './app-modules.js',
  './startup-reconcile.js',
  './roster-profile.js',
  './data-integrity-fixes.js',
  './firebase-cloud.js',
  './sync-core.js',
  './distance-enhancements.js',
  './distance-core.js',
  './past-seasons.js',
  './readability.js',
  './workflow-ui.js',
  './ai-coach.js',
  './individual-science-engine.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({
      type: 'xccommand:build-active',
      build: CACHE_NAME
    }));
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const isNavigation = event.request.mode === 'navigate';

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (
          response.ok
          && event.request.url.startsWith(self.location.origin)
        ) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (isNavigation) return caches.match('./index.html');
        return new Response('Offline resource unavailable.', {
          status: 503,
          statusText: 'Offline'
        });
      })
  );
});
