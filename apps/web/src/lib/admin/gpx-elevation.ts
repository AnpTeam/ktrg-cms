import { distanceM, type LngLatEle } from "./line";

// Takes only the elevations from a GPX track and puts them on a line that is already drawn: the shape of the line is not
// touched. Each point of the line takes the height of the track where the track runs closest to it (measured on the track
// between its two nearest points, so a sparse track still gives a smooth height). A point far from the track has no height
// of its own; it is filled in between the points on either side of it, along the line.

/** A track point further than this from a line point (m) says nothing about it. */
export const MATCH_METERS = 80;
/** Fewer matches than this share of the line, and the file is not this route's track. */
export const MIN_MATCHED = 0.2;

const CELL = 0.002; // about 200 m: a grid of the track's points, so each line point looks only at its neighbours

type Pt = readonly [number, number, number];

/** Metres east and north of `origin` (flat approximation, fine over tens of metres). */
const local = (p: readonly (number | undefined)[], origin: readonly (number | undefined)[]) => {
  const k = Math.cos((origin[1]! * Math.PI) / 180);
  return [(p[0]! - origin[0]!) * 111_320 * k, (p[1]! - origin[1]!) * 110_540] as const;
};

/** The height at the closest point of segment a-b to p, and how far that point is (m). */
function onSegment(p: readonly (number | undefined)[], a: Pt, b: Pt): { d: number; ele: number } {
  const [ax, ay] = local(a, p);
  const [bx, by] = local(b, p);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  // p is the origin, so the closest point is a + t (b - a) with t = -a . (b - a) / |b - a|^2
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return { d: Math.hypot(ax + t * dx, ay + t * dy), ele: a[2] + t * (b[2] - a[2]) };
}

export function applyGpxElevations(line: readonly LngLatEle[], track: readonly LngLatEle[]): { points: LngLatEle[]; matched: number } | null {
  const pts = track.filter((p): p is [number, number, number] => typeof p[2] === "number");
  if (pts.length < 2 || line.length < 2) return null;
  const grid = new Map<string, number[]>();
  pts.forEach((p, i) => {
    const key = `${Math.floor(p[0] / CELL)}/${Math.floor(p[1] / CELL)}`;
    grid.set(key, [...(grid.get(key) ?? []), i]);
  });
  const near = (p: readonly (number | undefined)[]) => {
    const cx = Math.floor(p[0]! / CELL);
    const cy = Math.floor(p[1]! / CELL);
    const found: number[] = [];
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) found.push(...(grid.get(`${x}/${y}`) ?? []));
    return found;
  };

  // The height of the track at each line point, or null where the track is not near.
  const got: (number | null)[] = line.map((p) => {
    let best: { d: number; ele: number } | null = null;
    for (const i of near(p)) {
      for (const [a, b] of [[i - 1, i], [i, i + 1]] as const) {
        if (a < 0 || b >= pts.length) continue;
        const r = onSegment(p, pts[a]!, pts[b]!);
        if (!best || r.d < best.d) best = r;
      }
    }
    return best && best.d <= MATCH_METERS ? best.ele : null;
  });
  const matched = got.filter((e) => e !== null).length;
  if (matched / line.length < MIN_MATCHED) return null;

  // Between matched points, by distance along the line; before the first and after the last, the nearest height.
  const along: number[] = [0];
  for (let i = 1; i < line.length; i++) along.push(along[i - 1]! + distanceM(line[i - 1]!, line[i]!));
  const known = got.flatMap((e, i) => (e === null ? [] : [i]));
  const points = line.map((p, i): LngLatEle => {
    let ele = got[i];
    if (ele === null || ele === undefined) {
      const before = [...known].reverse().find((k) => k < i);
      const after = known.find((k) => k > i);
      if (before === undefined) ele = got[after!]!;
      else if (after === undefined) ele = got[before]!;
      else {
        const span = along[after]! - along[before]!;
        const t = span === 0 ? 0 : (along[i]! - along[before]!) / span;
        ele = got[before]! + t * (got[after]! - got[before]!);
      }
    }
    return [p[0], p[1], Math.round(ele * 10) / 10];
  });
  return { points, matched };
}
