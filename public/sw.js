/* Service Worker manual — TradingView Gratis
 *
 * Estrategias:
 *  - Navigation (HTML): NetworkFirst con fallback a cache y, en ultimo
 *    recurso, a /offline.html.
 *  - Estaticos (/_next/static, /icons, manifest, favicon): CacheFirst con
 *    actualizacion en segundo plano.
 *  - API Binance (api.binance.com / *.binance.com / streams): NetworkOnly.
 *    No se cachea NUNCA datos de mercado en vivo: mostrarlos viejos seria
 *    peligroso para decisiones de trading.
 *  - WebSocket: no pasa por fetch handlers, no requiere logica aqui.
 */

const VERSION = "tv-gratis-v1";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/favicon.svg",
  "/icons/icon.svg",
  "/icons/apple-touch-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Limpiar caches de versiones anteriores
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isBinance(url) {
  return /(\.|^)binance\.com$/.test(url.hostname);
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/manifest.json" ||
      url.pathname === "/favicon.svg" ||
      url.pathname === "/favicon.ico" ||
      /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|webp|svg)$/.test(url.pathname))
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 1) Binance API: NUNCA cachear. Pasar directo a la red.
  if (isBinance(url)) return;

  // 2) Navegacion HTML (modo SPA: documento principal)
  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  // 3) Estaticos: CacheFirst con revalidacion
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 4) Por defecto: pasar a la red sin cachear
});

async function networkFirstNavigation(request) {
  try {
    const fresh = await fetch(request);
    // Guardar copia en runtime cache para fallback offline futuro
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match(OFFLINE_URL);
    return (
      fallback ||
      new Response("Sin conexion", { status: 503, statusText: "Offline" })
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Revalidacion en segundo plano (no bloquea la respuesta)
    fetch(request)
      .then((res) => {
        if (res && res.ok) cache.put(request, res.clone());
      })
      .catch(() => {});
    return cached;
  }
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}
