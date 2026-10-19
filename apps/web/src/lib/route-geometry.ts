import type { RouteArea } from "./map-screen";
import { downsample, normalizePoints, type Sketch } from "./sketch";

// Pure helpers that turn a route's line into what the screens draw: the rectangle on the overview map and the
// silhouette with its elevation. No server code, so the admin's live preview can use them in the browser too.

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG_AT_EQUATOR = 111_320;
/** An area never gets smaller than this, so a short course is still a shape you can tap. */
const MIN_AREA_M = 1500;

type Point = readonly [lng: number, lat: number, ele?: number];

/** The box around a course, as the rectangle drawn on the overview map. */
export function areaFromBounds(b: { west: number; south: number; east: number; north: number } | null): RouteArea | null {
  if (!b) return null;
  const lat = (b.south + b.north) / 2;
  const lng = (b.west + b.east) / 2;
  const widthM = Math.max(MIN_AREA_M, (b.east - b.west) * M_PER_DEG_LNG_AT_EQUATOR * Math.cos((lat * Math.PI) / 180));
  const heightM = Math.max(MIN_AREA_M, (b.north - b.south) * M_PER_DEG_LAT);
  return { lat, lng, widthM, heightM, verified: true };
}

/** A line as a 0..1 silhouette (north up); elevations ride along when the line has them. */
export function sketchFromPoints(points: readonly Point[], max = 40): Sketch | null {
  if (points.length < 2) return null;
  const kept = downsample(points, max);
  const midLat = kept.reduce((s, p) => s + p[1], 0) / kept.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const sketch: Sketch = { points: normalizePoints(kept.map((p) => [p[0] * k, -p[1]] as [number, number])) };
  const eles = kept.map((p) => p[2]);
  if (eles.every((e): e is number => typeof e === "number")) sketch.elevations = eles;
  return sketch;
}
