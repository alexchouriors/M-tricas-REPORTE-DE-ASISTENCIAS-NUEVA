/* ================================================================
   SERVICE WORKER — Métricas C.C.R.M
   Estrategia: Stale-While-Revalidate
   Actualiza la versión de CACHE_NAME para forzar un nuevo caché
================================================================ */

const CACHE_NAME = 'metricas-v1';

/* Archivos que se pre-cachean en la instalación */
const PRECACHE_URLS = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* ── INSTALL: pre-cachea los archivos principales ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  /* Activa el nuevo SW sin esperar a que se cierren las pestañas */
  self.skipWaiting();
});

/* ── ACTIVATE: limpia cachés de versiones anteriores ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  /* Toma el control de todas las pestañas abiertas inmediatamente */
  self.clients.claim();
});

/* ── FETCH: Stale-While-Revalidate ──
   1. Responde con la versión cacheada (rápida) si existe.
   2. Al mismo tiempo, hace la petición a la red y actualiza el caché.
   3. Si no hay caché y la red falla, devuelve lo que haya disponible.
   Las peticiones a APIs externas (GitHub, Google Fonts, CDNs) se
   pasan directamente a la red sin cachear para evitar datos obsoletos.
*/
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Excluye peticiones a APIs externas de la estrategia de caché */
  const isExternalApi =
    url.hostname.includes('api.github.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('sheets.googleapis.com');

  if (isExternalApi || event.request.method !== 'GET') {
    /* Para APIs y no-GET: ir directo a la red */
    event.respondWith(fetch(event.request));
    return;
  }

  /* Stale-While-Revalidate para recursos propios */
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);

      /* Lanza la petición de red en paralelo para actualizar el caché */
      const networkFetch = fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          /* Red no disponible — el SW ya devolvió el caché si existía */
        });

      /* Devuelve el caché inmediatamente si existe; si no, espera la red */
      return cached || networkFetch;
    })
  );
});
