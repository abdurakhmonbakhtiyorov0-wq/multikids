/* MultiKids service worker.
 * Maxfiylik qoidalari: faqat bir xil domendagi statik GET so‘rovlar keshlanadi.
 * /api/* (shaxsiy ma’lumot, natijalar, token) va boshqa domenlar (backend) HECH QACHON keshlanmaydi.
 * Sahifalar qobig‘i (HTML) shaxsiy ma’lumot saqlamaydi: ma’lumot sahifa ochilgach API orqali olinadi.
 */
const VERSION = "v1";
const STATIC = `mk-static-${VERSION}`;
const PAGES = `mk-pages-${VERSION}`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Chiqishda sahifa kesh tozalanadi (umumiy qurilmalar uchun qo‘shimcha ehtiyot).
self.addEventListener("message", (event) => {
  if (event.data === "clear-caches") event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
});

const isStaticAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/questions/");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // backend va tashqi manbalar — kesh yo‘q
  if (url.pathname.startsWith("/api/")) return;
  if (url.searchParams.has("_rsc") || req.headers.get("RSC")) return; // React Server Components so‘rovlari

  if (isStaticAsset(url)) {
    // Hash li fayllar o‘zgarmaydi: avval keshdan, yo‘q bo‘lsa tarmoqdan olib saqlaymiz.
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    // Havolasida maxfiy parametr (masalan ?token=) bor sahifalar keshlanmaydi.
    const cacheable = url.search === "";
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (cacheable ? await caches.match(req) : undefined) ?? (await caches.match("/offline"))),
    );
  }
});
