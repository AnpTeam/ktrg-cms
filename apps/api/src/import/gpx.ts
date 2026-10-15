import { distanceMeters } from "../lib/geo";

// Reads the GPX file Navivi writes with a route (`raw_track.gpx`): named waypoints and one track
// with an elevation on every point. Pure functions, unit-tested. It is a DRAFT source: the track is
// the path drawn or routed in Navivi (not a recording), its times are simulated at walking speed
// (never use them as a real walking time), and nothing here is checked against an official source.

export interface TrackPoint {
  lat: number;
  lng: number;
  /** Metres above sea level; null when the point has none. */
  ele: number | null;
}

export interface Waypoint {
  name: string;
  lat: number;
  lng: number;
}

export interface Gpx {
  waypoints: Waypoint[];
  track: TrackPoint[];
}

const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => entities[m] ?? m);

function coordinate(lat: string, lng: string, what: string): { lat: number; lng: number } {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || a < -90 || a > 90) throw new Error(`${what}: bad latitude "${lat}"`);
  if (!Number.isFinite(b) || b < -180 || b > 180) throw new Error(`${what}: bad longitude "${lng}"`);
  return { lat: a, lng: b };
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? "";

export function parseGpx(xml: string): Gpx {
  const waypoints: Waypoint[] = [];
  for (const m of xml.matchAll(/<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/g)) {
    const { lat, lng } = coordinate(attr(m[1]!, "lat"), attr(m[1]!, "lon"), "waypoint");
    const name = /<name>([\s\S]*?)<\/name>/.exec(m[2]!)?.[1] ?? "";
    waypoints.push({ name: decode(name.trim()), lat, lng });
  }

  const track: TrackPoint[] = [];
  for (const m of xml.matchAll(/<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g)) {
    const { lat, lng } = coordinate(attr(m[1]!, "lat"), attr(m[1]!, "lon"), `track point ${track.length + 1}`);
    const eleText = /<ele>\s*([^<\s]+)\s*<\/ele>/.exec(m[2] ?? "")?.[1];
    const ele = eleText !== undefined && Number.isFinite(Number(eleText)) ? Number(eleText) : null;
    track.push({ lat, lng, ele });
  }
  return { waypoints, track };
}

/** Length of the track in metres (great-circle distance between consecutive points). */
export function trackLengthM(track: readonly TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < track.length; i++) total += distanceMeters(track[i - 1]!, track[i]!);
  return total;
}

/** Moving average over `window` points, so a noisy elevation does not count as climbing. */
function smooth(values: readonly number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length - 1, i + half);
    let sum = 0;
    for (let j = from; j <= to; j++) sum += values[j]!;
    return sum / (to - from + 1);
  });
}

export interface ElevationStats {
  ascentM: number;
  descentM: number;
  minM: number;
  maxM: number;
}

/** Total climb and descent from the smoothed elevations; null when fewer than two points have one. */
export function elevationStats(track: readonly TrackPoint[], window = 9): ElevationStats | null {
  const eles = track.map((p) => p.ele).filter((e): e is number => e !== null);
  if (eles.length < 2) return null;
  const s = smooth(eles, window);
  let ascent = 0;
  let descent = 0;
  for (let i = 1; i < s.length; i++) {
    const d = s[i]! - s[i - 1]!;
    if (d > 0) ascent += d;
    else descent -= d;
  }
  return { ascentM: Math.round(ascent), descentM: Math.round(descent), minM: Math.round(Math.min(...eles)), maxM: Math.round(Math.max(...eles)) };
}

/** The elevation sampled at `count` places spread evenly along the track's length, in metres. */
export function elevationProfile(track: readonly TrackPoint[], count: number): number[] {
  const withEle = track.filter((p) => p.ele !== null);
  if (withEle.length < 2 || count < 2) return [];
  const along = [0];
  for (let i = 1; i < withEle.length; i++) along.push(along[i - 1]! + distanceMeters(withEle[i - 1]!, withEle[i]!));
  const total = along[along.length - 1]! || 1;
  const eles = smooth(withEle.map((p) => p.ele as number), 5);
  const out: number[] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / (count - 1)) * total;
    while (j < along.length - 2 && along[j + 1]! < target) j++;
    const span = along[j + 1]! - along[j]! || 1;
    const t = Math.min(1, Math.max(0, (target - along[j]!) / span));
    out.push(Math.round((eles[j]! + (eles[j + 1]! - eles[j]!) * t) * 10) / 10);
  }
  return out;
}

/**
 * Douglas-Peucker: fewer points that keep the shape. The tolerance is in metres; it is raised until
 * at most `maxPoints` remain (the first and last points are always kept).
 */
export function simplifyTrack(track: readonly TrackPoint[], maxPoints: number): TrackPoint[] {
  if (track.length <= maxPoints) return [...track];
  const meanLat = track.reduce((s, p) => s + p.lat, 0) / track.length;
  const kx = 111_320 * Math.cos((meanLat * Math.PI) / 180);
  const ky = 110_540;
  const xy = track.map((p) => [p.lng * kx, p.lat * ky] as const);

  const distToSegment = (p: readonly [number, number], a: readonly [number, number], b: readonly [number, number]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };

  const run = (tolerance: number): number[] => {
    const keep = new Uint8Array(track.length);
    keep[0] = 1;
    keep[track.length - 1] = 1;
    const stack: [number, number][] = [[0, track.length - 1]];
    while (stack.length) {
      const [from, to] = stack.pop()!;
      let worst = -1;
      let at = -1;
      for (let i = from + 1; i < to; i++) {
        const d = distToSegment(xy[i]!, xy[from]!, xy[to]!);
        if (d > worst) {
          worst = d;
          at = i;
        }
      }
      if (worst > tolerance && at > 0) {
        keep[at] = 1;
        stack.push([from, at], [at, to]);
      }
    }
    return [...keep].flatMap((k, i) => (k ? [i] : []));
  };

  let tolerance = 1;
  let kept = run(tolerance);
  while (kept.length > maxPoints && tolerance < 5000) {
    tolerance *= 1.5;
    kept = run(tolerance);
  }
  return kept.map((i) => track[i]!);
}
