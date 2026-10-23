// Keeps what a person saved with 「オフラインで使う」 so a route page and its map still open without a signal.
// It only adds to the network: with a signal everything loads as usual, and nothing here is saved unasked
// except the site's own versioned scripts and styles (their names change with every release).
const PAGES = "ktrg-pages";
const TILES = "ktrg-tiles";
const STATIC = "ktrg-static";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
  } else if (url.hostname === "cyberjapandata.gsi.go.jp") {
    // Saved tiles first; any other tile comes from the network and is not kept.
    event.respondWith(caches.match(request, { cacheName: TILES }).then((hit) => hit || fetch(request)));
  } else if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(fetch(request).catch(async () => (await caches.match(request, { cacheName: PAGES, ignoreSearch: true })) || Response.error()));
  }
});
