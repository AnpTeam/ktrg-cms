import type { RouteArea } from "./map-screen";
import { downsample, normalizePoints, type Sketch } from "./sketch";

// Pure helpers that turn a route's line into what the screens draw: the rectangle on the overview map and the
// silhouette with its elevation. No server code, so the admin's live preview can use them in the browser too.

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG_AT_EQUATOR = 111_320;
/** An area never gets smaller than this, so a short course is still a shape you can tap. */
const MIN_AREA_M = 1500;

type Point = readonly [lng: number, lat: number, ele?: number];

export type Bounds = { west: number; south: number; east: number; north: number };
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** A course area as the editor types it: the centre and the size in metres. */
export function boxFromBounds(b: Bounds): { lat: number; lng: number; widthM: number; heightM: number } {
  const lat = (b.south + b.north) / 2;
  return { lat, lng: (b.west + b.east) / 2, widthM: (b.east - b.west) * M_PER_DEG_LNG_AT_EQUATOR * Math.cos((lat * Math.PI) / 180), heightM: (b.north - b.south) * M_PER_DEG_LAT };
}

/** The corners (degrees, 6 decimals) of a box given by its centre and its size in metres. */
export function boundsFromBox(box: { lat: number; lng: number; widthM: number; heightM: number }): Bounds {
  const halfLat = box.heightM / 2 / M_PER_DEG_LAT;
  const halfLng = box.widthM / 2 / (M_PER_DEG_LNG_AT_EQUATOR * Math.cos((box.lat * Math.PI) / 180));
  return { west: round6(box.lng - halfLng), south: round6(box.lat - halfLat), east: round6(box.lng + halfLng), north: round6(box.lat + halfLat) };
}

/** No smaller than this (about 100 m) when a corner is dragged across the box. */
const MIN_DEG = 0.001;

/** One corner of a box dragged to a new place: the opposite corner stays, and the box cannot turn inside out. */
export function dragCorner(b: Bounds, corner: "nw" | "ne" | "sw" | "se", to: { lat: number; lng: number }): Bounds {
  const lng = round6(to.lng);
  const lat = round6(to.lat);
  const out = { ...b };
  if (corner === "nw" || corner === "sw") out.west = Math.min(lng, b.east - MIN_DEG);
  else out.east = Math.max(lng, b.west + MIN_DEG);
  if (corner === "nw" || corner === "ne") out.north = Math.max(lat, b.south + MIN_DEG);
  else out.south = Math.min(lat, b.north - MIN_DEG);
  return out;
}

/** The same box with its centre at a new place. */
export function moveBox(b: Bounds, centre: { lat: number; lng: number }): Bounds {
  const [halfLng, halfLat] = [(b.east - b.west) / 2, (b.north - b.south) / 2];
  return { west: round6(centre.lng - halfLng), south: round6(centre.lat - halfLat), east: round6(centre.lng + halfLng), north: round6(centre.lat + halfLat) };
}

/** The box that just holds some points ([lng, lat, ...]); none when there are none. */
export function boundsOfPoints(points: readonly (readonly number[])[]): Bounds | null {
  if (points.length === 0) return null;
  const lngs = points.map((p) => p[0]!);
  const lats = points.map((p) => p[1]!);
  return { west: Math.min(...lngs), south: Math.min(...lats), east: Math.max(...lngs), north: Math.max(...lats) };
}

/** A box grown by a tenth on each side (at least about 800 m each way, so a short course still has room), as a start to adjust. */
export function padBounds(b: Bounds | null): Bounds | null {
  if (!b) return null;
  const padLng = Math.max(0.008, (b.east - b.west) * 0.1);
  const padLat = Math.max(0.008, (b.north - b.south) * 0.1);
  return { west: round6(b.west - padLng), south: round6(b.south - padLat), east: round6(b.east + padLng), north: round6(b.north + padLat) };
}

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
