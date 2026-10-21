// Pure helpers for the route line in the map editor. The API checks and measures the line again when it is saved
// (apps/api/src/content/line.ts); these give the editor the same numbers while the admin is still drawing.

/** [longitude, latitude, elevation in metres (optional)] */
export type LngLatEle = [lng: number, lat: number, ele?: number];

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: readonly (number | undefined)[], b: readonly (number | undefined)[]): number {
  const dLat = rad(b[1]! - a[1]!);
  const dLng = rad(b[0]! - a[0]!);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1]!)) * Math.cos(rad(b[1]!)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Length along the line in kilometres, to two decimals (the same rounding as the API). */
export function lengthKm(points: readonly (readonly (number | undefined)[])[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += distanceM(points[i - 1]!, points[i]!);
  return Math.round(m / 10) / 100;
}

function perpendicular(p: readonly (number | undefined)[], a: readonly (number | undefined)[], b: readonly (number | undefined)[]): number {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / len2));
  return Math.hypot(p[0]! - (a[0]! + t * dx), p[1]! - (a[1]! + t * dy));
}

/** Drop points that barely change the shape until at most `maxPoints` remain. The first and last point stay. */
export function simplify(points: readonly LngLatEle[], maxPoints: number): LngLatEle[] {
  if (points.length <= maxPoints) return [...points];
  const run = (tolerance: number) => {
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack: [number, number][] = [[0, points.length - 1]];
    while (stack.length) {
      const [lo, hi] = stack.pop()!;
      let worst = -1;
      let at = -1;
      for (let i = lo + 1; i < hi; i++) {
        const d = perpendicular(points[i]!, points[lo]!, points[hi]!);
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
    return points.filter((_, i) => keep[i]);
  };
  let tolerance = 1e-7;
  let out = [...points];
  while (out.length > maxPoints) {
    tolerance *= 1.6;
    out = run(tolerance);
  }
  return out;
}

/**
 * Total climb in metres. The readings are smoothed over three points first, so a bouncing GPS reading (a metre up,
 * a metre down) is not counted as climbing.
 */
export function climbM(elevations: readonly number[]): number {
  if (elevations.length < 2) return 0;
  const smooth = elevations.map((_, i) => {
    if (i === 0 || i === elevations.length - 1) return elevations[i]!; // the ends stay as measured
    const w = elevations.slice(Math.max(0, i - 1), i + 2);
    return w.reduce((s, v) => s + v, 0) / w.length;
  });
  let up = 0;
  for (let i = 1; i < smooth.length; i++) {
    const d = smooth[i]! - smooth[i - 1]!;
    if (d > 0) up += d;
  }
  return Math.round(up);
}

/** The elevations of a line when every point has one; otherwise null. */
export function elevationsOf(points: readonly LngLatEle[]): number[] | null {
  const e = points.map((p) => p[2]);
  return e.length > 0 && e.every((v): v is number => typeof v === "number") ? e : null;
}
