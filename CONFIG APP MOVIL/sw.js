/* ================================================================
   SERVICE WORKER — REPORTES C.C.R.M
   Ubicación física: /CONFIG APP MOVIL/sw.js
   Scope registrado: '/'  (controla toda la aplicación)
   Estrategia: Stale-While-Revalidate
================================================================ */

const CACHE_NAME = 'metricas-v12';

/* Archivos de ROLES/PERMISOS (RBAC): cambian cada vez que se guarda
   algo desde el Panel de Control de Permisos (Usuario Rules.js) o se
   edita USUARIOS.JS/SecurityConfig.js/AccessManager.js manualmente.
   NUNCA deben servirse desde caché — ver _fetch handler más abajo,
   que los intercepta ANTES de la lógica de Stale-While-Revalidate. */
const RBAC_FILES = [
  'USUARIOS.JS',
  'SecurityConfig.js',
  'AccessManager.js',
  'Usuario Rules.js',
];

function isRbacFile(url) {
  const path = decodeURIComponent(url.pathname);
  return RBAC_FILES.some(name => path === '/' + name || path.endsWith('/' + name));
}

/* Archivos pre-cacheados en la instalación.
   Las rutas son absolutas desde la raíz del sitio porque el scope es '/'. */
const PRECACHE_URLS = [
  '/index.html',
  '/style.css',
  '/app.js',
  '/CONFIG APP MOVIL/manifest.json',
  '/CONFIG APP MOVIL/icon-192.png',
  '/CONFIG APP MOVIL/icon-512.png'
];

/* ── INSTALL ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

/* ── ACTIVATE: elimina cachés de versiones anteriores ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ── FETCH: Stale-While-Revalidate ──
   Responde con caché si existe (rápido) y en paralelo actualiza el caché.
   APIs externas (GitHub, Fonts, CDNs) se sirven directo desde la red.
*/
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* ── Archivos RBAC: network-only, jamás caché ──
     Se sirven directo de la red con cache:'no-store'. Si la red
     falla (offline), como último recurso se intenta el caché para
     no dejar la app completamente rota, pero NUNCA se escribe una
     copia nueva en caché desde aquí — así se garantiza que un
     cambio de permisos/roles se refleje de inmediato en la próxima
     carga, sin depender de que Stale-While-Revalidate ya haya
     revalidado en segundo plano. */
  if (isRbacFile(url) && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  const isExternal =
    url.hostname.includes('api.github.com')       ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')    ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('sheets.googleapis.com');

  if (isExternal || event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request)
        .then(res => {
          if (res && res.status === 200) {
            cache.put(event.request, res.clone());
          }
          return res;
        })
        .catch(() => undefined);

      return cached || networkFetch;
    })
  );
});
