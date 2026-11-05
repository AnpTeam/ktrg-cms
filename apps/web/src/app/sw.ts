/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

// The service worker (Phase B, slice B4; docs/phase-b-offline-plan.md). What it does, and on purpose does NOT do:
//  - precaches the app's own scripts, styles and the /offline page (the build writes the list into __SW_MANIFEST);
//  - keeps /_next/static files and our fonts and icons (hashed: a changed file has a new name) after the first load;
//  - when a page cannot be fetched at all (no signal), shows /offline instead of the browser's error page;
//  - waits for the visitor to tap "update" before a new version takes over (skipWaiting is off), so nobody is
//    switched to a new version in the middle of a walk. The prompt is in components/ServiceWorker.tsx.
// It never caches /api/* (answers carry the session), never caches a page the network can give (a stale page would show
// another person's stamps), and never touches a POST. Saved map tiles (B5) are the one exception, answered from a course's pack before the network.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Pages always come from the network. This route exists so that when the network fails the fallback below can answer:
    // the fallback only runs for a request some route took. 10 s, not less: a slow mountain connection should still load.
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly({ networkTimeoutSeconds: 10 }),
    },
    // Map tiles saved with a course's offline map (lib/offline-pack.ts) come from the phone; any other tile goes to the
    // network and is not kept (the visitor chose what to keep, nothing is saved unasked).
    {
      matcher: ({ url }) => url.hostname === "cyberjapandata.gsi.go.jp",
      handler: async ({ request }) => (await caches.match(request)) ?? fetch(request),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({ cacheName: "ktrg-next-static", plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })] }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && /^\/(icon|apple-icon|favicon)/.test(url.pathname),
      handler: new CacheFirst({ cacheName: "ktrg-icons", plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 })] }),
    },
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
