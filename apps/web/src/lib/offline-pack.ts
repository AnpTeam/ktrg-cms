import type { RouteArea } from "./map-screen";
import { gsiTileUrl, vectorTileUrl, zoomLimits } from "./map";
import type { MapSettings } from "./map-settings";
import { tileUrls } from "./offline-tiles";
import { readJson } from "@/lib/read-json";

// The offline map of one course (Phase B, slice B5; docs/phase-b-offline-plan.md): the map tiles around it, kept in
// Cache Storage under one cache per course, so deleting a course is deleting that cache. The worker (app/sw.ts) answers
// a tile request from here before it asks the network. A small JSON entry in the same cache says when it was saved and
// how big it is, so the cache and its description can never disagree.
// The pack also keeps the pages the map needs (the map and the course page) and the course's line, so the app opens cold with
// no signal. Pages are the visitor's own (their stamps), kept in one shared cache that is emptied at sign-out (clearSavedPages),
// and the worker only uses them when the network fails, never in place of a page it can fetch.
// shortcut: a person whose session simply expired never signs out; their saved pages stay until the next sign-out or save.
// shortcut: a tile shared by two neighbouring courses is stored twice, when storage matters keep one shared tile cache.

const META_URL = "/__pack-meta";
/** The cache of saved pages; sw.ts reads it by this name. */
export const PAGES_CACHE = "ktrg-pages";
const MAP_PAGE = "/map";
const MIN_ZOOM = 11;
const MAX_ZOOM = 15;
const PER_LAYER_LIMIT = 300;
const AT_A_TIME = 6;

export const packCacheName = (routeId: string) => `ktrg-pack-${routeId}`;

/** The tiles a course needs: the visitor's base map and its terrain overlay, from zoom 11 to 15 (the overlay stops sooner). */
export function packTileUrls(area: RouteArea, settings: Pick<MapSettings, "base" | "terrain">): string[] {
  // The vector map's tiles are GSI's vector tiles; its names (glyphs) and icons are not kept yet, so offline it draws without names.
  const baseTemplate = settings.base === "large" ? vectorTileUrl : gsiTileUrl(settings.base === "photo" ? "seamlessphoto" : settings.base);
  const baseMax = settings.base === "blank" ? 14 : settings.base === "large" ? 16 : MAX_ZOOM;
  const terrainLayer = settings.terrain === "relief" ? "relief" : "hillshademap";
  const terrainMax = Math.min(MAX_ZOOM, settings.terrain === "relief" ? zoomLimits.reliefMax : zoomLimits.hillshadeMax);
  return [
    ...tileUrls(area, baseTemplate, MIN_ZOOM, baseMax, PER_LAYER_LIMIT),
    ...tileUrls(area, gsiTileUrl(terrainLayer), MIN_ZOOM, terrainMax, PER_LAYER_LIMIT),
  ];
}

export interface PackInfo {
  savedAt: number;
  bytes: number;
  tiles: number;
}

/** The pack saved for a course, or null when there is none (or this browser has no Cache Storage). */
export async function readPack(routeId: string): Promise<PackInfo | null> {
  if (typeof caches === "undefined") return null;
  try {
    if (!(await caches.has(packCacheName(routeId)))) return null;
    const hit = await (await caches.open(packCacheName(routeId))).match(META_URL);
    return hit ? ((await hit.json()) as PackInfo) : null;
  } catch {
    return null;
  }
}

export async function deletePack(routeId: string): Promise<void> {
  await caches.delete(packCacheName(routeId));
  const pages = await caches.open(PAGES_CACHE);
  await pages.delete(coursePage(routeId));
  // The map page is shared by every pack: it goes with the last one.
  if (!(await caches.keys()).some((k) => k.startsWith("ktrg-pack-"))) await pages.delete(MAP_PAGE);
}

/** Sign-out: the saved pages show the person's name and stamps, so they must not outlive the session. Tiles are public and stay. */
export async function clearSavedPages(): Promise<void> {
  if (typeof caches !== "undefined") await caches.delete(PAGES_CACHE).catch(() => false);
}

const coursePage = (routeId: string) => `/routes/${encodeURIComponent(routeId)}`;
const lineUrl = (routeId: string) => `/api/v1/routes/${encodeURIComponent(routeId)}`;

/**
 * The pages and the line, fetched with the visitor's own session like any page load. The line is stored as a small answer of
 * its own (just the line, the one thing the navigation reads from that address), never the whole course with the person's stamps.
 */
async function savePages(routeId: string, cache: Cache): Promise<void> {
  const pages = await caches.open(PAGES_CACHE);
  for (const url of [MAP_PAGE, coursePage(routeId)]) {
    const res = await fetch(url, { cache: "reload" });
    if (!res.ok) throw new Error("page");
    await pages.put(url, res);
  }
  const res = await fetch(lineUrl(routeId));
  if (!res.ok) return; // a course without a line is fine: the navigation then guides to the stops
  const line = (await readJson<{ route?: { line?: unknown } }>(res))?.route?.line ?? null;
  if (line) await cache.put(lineUrl(routeId), new Response(JSON.stringify({ route: { line } }), { headers: { "content-type": "application/json" } }));
}

/**
 * Downloads the tiles of a course. Tiles that do not exist (sea, outside GSI's coverage answer 404) are skipped; the pack
 * only fails when most of them could not be fetched, so one bad moment of signal does not leave a half map labelled "saved".
 * The description is written last: a download that is cut off shows as not saved. An update that fails keeps the pack already
 * saved, which may be the only map the visitor has: it is written over in place, and a tile is only replaced by a good copy.
 */
export async function savePack(routeId: string, urls: string[], onProgress: (done: number, total: number) => void, now = Date.now()): Promise<PackInfo> {
  const cache = await caches.open(packCacheName(routeId));
  const hadPack = (await cache.match(META_URL)) !== undefined;
  const giveUp = async (): Promise<never> => {
    if (!hadPack) await caches.delete(packCacheName(routeId));
    throw new Error("pack incomplete");
  };
  try {
    await savePages(routeId, cache);
  } catch {
    return giveUp();
  }
  let done = 0;
  let stored = 0;
  let bytes = 0;
  for (let i = 0; i < urls.length; i += AT_A_TIME) {
    await Promise.all(
      urls.slice(i, i + AT_A_TIME).map(async (url) => {
        try {
          // reload: past the worker's saved copy too, or an update would only save the old tile again (app/sw.ts).
          const res = await fetch(url, { cache: "reload" });
          if (res.ok) {
            const size = (await res.clone().blob()).size; // added after the await: `bytes += await` would lose parallel updates
            bytes += size;
            await cache.put(url, res);
            stored += 1;
          }
        } catch {
          // counted as missing below
        }
        onProgress(++done, urls.length);
      }),
    );
  }
  if (urls.length === 0 || stored < urls.length * 0.75) return giveUp();
  // Tiles of the last pack this one no longer uses (another base map, a changed course area) would only fill the phone.
  const wanted = new Set(urls);
  for (const req of await cache.keys()) {
    const url = typeof req === "string" ? req : req.url;
    if (!wanted.has(url) && !url.endsWith(META_URL) && !url.endsWith(lineUrl(routeId))) await cache.delete(req);
  }
  const info: PackInfo = { savedAt: now, bytes, tiles: stored };
  await cache.put(META_URL, new Response(JSON.stringify(info), { headers: { "content-type": "application/json" } }));
  return info;
}

/** "3 days ago" as a number and a unit, for the screen to word in the visitor's language. */
export function packAge(savedAt: number, now: number): { n: number; unit: "minute" | "hour" | "day" } {
  const minutes = Math.max(0, Math.floor((now - savedAt) / 60_000));
  if (minutes < 60) return { n: minutes, unit: "minute" };
  if (minutes < 60 * 24) return { n: Math.floor(minutes / 60), unit: "hour" };
  return { n: Math.floor(minutes / (60 * 24)), unit: "day" };
}

/** Megabytes with one decimal under ten ("0.8", "12"), never "0". */
export function megabytes(bytes: number): string {
  const mb = bytes / 1_000_000;
  return mb < 10 ? Math.max(0.1, Math.round(mb * 10) / 10).toString() : Math.round(mb).toString();
}
