/* Минимальный безопасный service worker для PWA.
 * Стратегия: cache-first ТОЛЬКО для неизменяемой статики (_next/static, /icons) —
 * всё остальное (страницы, /api) идёт в сеть, чтобы приватный токен-гейтированный
 * контент никогда не оседал в кэше и авторизация проверялась каждый раз.
 * Наличие fetch-обработчика делает приложение устанавливаемым.
 */
const CACHE = "azs-pwa-static-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const isImmutable = url.pathname.includes("/_next/static/") || url.pathname.includes("/icons/");
  if (!isImmutable) return; // сеть как обычно (свежесть + токен-гейт)

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })(),
  );
});
