/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { PAGES_CACHE } from "@/lib/offline-pack";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

// The service worker (Phase B, slice B4; docs/phase-b-offline-plan.md). What it does, and on purpose does NOT do:
//  - precaches the app's own scripts, styles and the /offline page (the build writes the list into __SW_MANIFEST);
//  - keeps /_next/static files and our fonts and icons (hashed: a changed file has a new name) after the first load;
//  - when a page cannot be fetched at all (no signal), shows /offline instead of the browser's error page;
//  - waits for the visitor to tap "update" before a new version takes over (skipWaiting is off), so nobody is
//    switched to a new version in the middle of a walk. The prompt is in components/ServiceWorker.tsx.
// It never caches /api/* by itself, never serves a saved page while the network can give one (a stale page would show old
// stamps), and never touches a POST. Only what the visitor saved with a course's offline map is read back, and only when the
// network fails. Saved map tiles (B5) are the one exception, answered from a course's pack before the network.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// When the network fails: the page the visitor saved with a course's offline map, else the /offline page. Written as our own
// plugin because Serwist's `fallbacks` option skips any strategy that already has a handlerDidError plugin.
const pageFromNetwork = new NetworkOnly({
  networkTimeoutSeconds: 10,
  plugins: [{ handlerDidError: async ({ request }) => (await caches.match(request, { cacheName: PAGES_CACHE, ignoreVary: true })) ?? serwist.matchPrecache("/offline") }],
});

const serwist: Serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Pages always come from the network; only when it fails does pageFromNetwork answer (above). 10 s, not less: a slow
    // mountain connection should still load.
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: pageFromNetwork,
    },
    // A saved course's line, only when the network cannot give it (the navigation reads it; see line-client.ts).
    {
      matcher: ({ url, sameOrigin, request }) => sameOrigin && request.method === "GET" && /^\/api\/v1\/routes\/[^/]+$/.test(url.pathname),
      handler: async ({ request }) => {
        try {
          return await fetch(request, { signal: AbortSignal.timeout(8000) });
        } catch (error) {
          const saved = await caches.match(request);
          if (saved) return saved;
          throw error;
        }
      },
    },
    // Map tiles saved with a course's offline map (lib/offline-pack.ts) come from the phone; any other tile goes to the
    // network and is not kept (the visitor chose what to keep, nothing is saved unasked).
    {
      matcher: ({ url }) => url.hostname === "cyberjapandata.gsi.go.jp",
      // A pack being updated asks with cache: "reload" and must reach the network.
      handler: async ({ request }) => (request.cache !== "reload" ? await caches.match(request) : undefined) ?? fetch(request),
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
});

serwist.addEventListeners();
