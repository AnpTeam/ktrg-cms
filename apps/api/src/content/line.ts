import { distanceMeters } from "../lib/geo";

/** A route line as GeoJSON: [lng, lat] with an optional third number, the elevation in metres. */
export type LineString = { type: "LineString"; coordinates: [lng: number, lat: number, ele?: number][] };

const MAX_POINTS_ACCEPTED = 50_000;
// Japan with some margin: nothing outside this box can be a Katsuragi route.
const LNG = [122, 154] as const;
const LAT = [20, 46] as const;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Check a line from outside (a request body): shape, finite numbers, inside Japan, not absurdly long. */
export function parseLine(input: unknown): { ok: true; line: LineString } | { ok: false } {
  if (typeof input !== "object" || input === null) return { ok: false };
  const { type, coordinates } = input as { type?: unknown; coordinates?: unknown };
  if (type !== "LineString" || !Array.isArray(coordinates)) return { ok: false };
  if (coordinates.length < 2 || coordinates.length > MAX_POINTS_ACCEPTED) return { ok: false };
  const out: LineString["coordinates"] = [];
  for (const c of coordinates) {
    if (!Array.isArray(c) || c.length < 2 || c.length > 3) return { ok: false };
    const [lng, lat, ele] = c as unknown[];
    if (!isNum(lng) || !isNum(lat) || lng < LNG[0] || lng > LNG[1] || lat < LAT[0] || lat > LAT[1]) return { ok: false };
    if (ele !== undefined && !isNum(ele)) return { ok: false };
    out.push(ele === undefined ? [lng, lat] : [lng, lat, ele]);
  }
  return { ok: true, line: { type: "LineString", coordinates: out } };
}

// Distance from p to the segment a-b, in degrees (planar). Good enough for choosing which points to drop.
function perpendicular(p: readonly (number | undefined)[], a: readonly (number | undefined)[], b: readonly (number | undefined)[]): number {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / len2));
  return Math.hypot(p[0]! - (a[0]! + t * dx), p[1]! - (a[1]! + t * dy));
}

function douglasPeucker(pts: LineString["coordinates"], tolerance: number): LineString["coordinates"] {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let worst = -1;
    let at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpendicular(pts[i]!, pts[lo]!, pts[hi]!);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (at >= 0 && worst > tolerance) {
      keep[at] = 1;
      stack.push([lo, at], [at, hi]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Drop points that barely change the shape until at most `maxPoints` remain. The first and last point stay. */
export function simplifyLine(line: LineString, maxPoints = 2000): LineString {
  if (line.coordinates.length <= maxPoints) return line;
  let tolerance = 1e-7;
  let pts = line.coordinates;
  while (pts.length > maxPoints) {
    tolerance *= 1.6;
    pts = douglasPeucker(line.coordinates, tolerance);
  }
  return { type: "LineString", coordinates: pts };
}

/** Length along the line in kilometres, to two decimals. */
export function lineLengthKm(line: LineString): number {
  let m = 0;
  for (let i = 1; i < line.coordinates.length; i++) {
    const [aLng, aLat] = line.coordinates[i - 1]!;
    const [bLng, bLat] = line.coordinates[i]!;
    m += distanceMeters({ lat: aLat, lng: aLng }, { lat: bLat, lng: bLng });
  }
  return Math.round(m / 10) / 100;
}

/** A rough shape for list pages: at most `maxPoints` points as [lng, lat]. */
export function sketchOf(line: LineString, maxPoints = 40): [number, number][] {
  return simplifyLine(line, maxPoints).coordinates.map(([lng, lat]) => [lng, lat]);
}
