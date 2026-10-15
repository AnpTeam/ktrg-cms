// The route silhouette and elevation fill on the list (WBS 3.2.3), from a simplified line.
// Pure functions, unit-tested. The API sends an already simplified, normalized line
// (at most about 40 points); these helpers only turn it into SVG path text.

/** A route line normalized to a 0..1 box (x to the right, y downward) plus optional elevations in metres. */
export interface Sketch {
  points: [number, number][];
  elevations?: number[];
}

/** Normalize raw [x, y] points into a 0..1 box, keeping the aspect ratio. */
export function normalizePoints(raw: readonly [number, number][]): [number, number][] {
  if (raw.length === 0) return [];
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  return raw.map(([x, y]) => [(x - minX) / span, (y - minY) / span]);
}

/** Keep at most `max` points, always including the first and the last. */
export function downsample<T>(items: readonly T[], max: number): T[] {
  if (max < 2 || items.length <= max) return [...items];
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(items[Math.round((i * (items.length - 1)) / (max - 1))] as T);
  return out;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** The points scaled to fit a width x height box (aspect kept, centred, `pad` on every side). */
export function fitPoints(points: readonly [number, number][], width: number, height: number, pad = 4): [number, number][] {
  if (points.length === 0) return [];
  const w = width - pad * 2;
  const h = height - pad * 2;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  // An axis with no extent (a flat or vertical line) must not limit the scale.
  const limits = [spanX > 0 ? w / spanX : Infinity, spanY > 0 ? h / spanY : Infinity];
  const scale = Math.min(...limits);
  const k = Number.isFinite(scale) ? scale : 1;
  const offX = pad + (w - spanX * k) / 2 - Math.min(...xs) * k;
  const offY = pad + (h - spanY * k) / 2 - Math.min(...ys) * k;
  return points.map(([x, y]) => [x * k + offX, y * k + offY]);
}

/** SVG path for the line inside a width x height box with `pad` on every side. */
export function linePath(points: readonly [number, number][], width: number, height: number, pad = 4): string {
  if (points.length < 2) return "";
  return fitPoints(points, width, height, pad)
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`)
    .join(" ");
}

/** Closed area path under an elevation profile, or "" when there is nothing to draw. */
export function elevationArea(elevations: readonly number[], width: number, height: number, pad = 2): string {
  if (elevations.length < 2) return "";
  const lo = Math.min(...elevations);
  const hi = Math.max(...elevations);
  const range = hi - lo || 1;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const step = w / (elevations.length - 1);
  const top = elevations.map((e, i) => `${i === 0 ? "M" : "L"}${fmt(pad + i * step)} ${fmt(pad + h - ((e - lo) / range) * h)}`);
  return `${top.join(" ")} L${fmt(pad + w)} ${fmt(pad + h)} L${fmt(pad)} ${fmt(pad + h)} Z`;
}
