import type { RouteArea } from "./map-screen";
import { gsiTileUrl, vectorTileUrl, zoomLimits } from "./map";
import type { MapSettings } from "./map-settings";
import { tileUrls } from "./offline-tiles";

// The offline map of one course (Phase B, slice B5; docs/phase-b-offline-plan.md): the map tiles around it, kept in
// Cache Storage under one cache per course, so deleting a course is deleting that cache. The worker (app/sw.ts) answers
// a tile request from here before it asks the network. A small JSON entry in the same cache says when it was saved and
// how big it is, so the cache and its description can never disagree.
// shortcut: a tile shared by two neighbouring courses is stored twice, when storage matters keep one shared tile cache.

const META_URL = "/__pack-meta";
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
}

/**
 * Downloads the tiles of a course. Tiles that do not exist (sea, outside GSI's coverage answer 404) are skipped; the pack
 * only fails when most of them could not be fetched, so one bad moment of signal does not leave a half map labelled "saved".
 * The description is written last: a download that is cut off shows as not saved.
 */
export async function savePack(routeId: string, urls: string[], onProgress: (done: number, total: number) => void, now = Date.now()): Promise<PackInfo> {
  const cache = await caches.open(packCacheName(routeId));
  let done = 0;
  let stored = 0;
  let bytes = 0;
  for (let i = 0; i < urls.length; i += AT_A_TIME) {
    await Promise.all(
      urls.slice(i, i + AT_A_TIME).map(async (url) => {
        try {
          const res = await fetch(url);
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
  if (urls.length === 0 || stored < urls.length * 0.75) {
    await caches.delete(packCacheName(routeId));
    throw new Error("pack incomplete");
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
