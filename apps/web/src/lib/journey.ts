// The maths of the landing journey (docs/landing-journey-design.md): which beat a scroll position is in, how much of the
// ridge is drawn, how many seals have dropped, and where the seals stand. Pure: no React, no DOM, so it is unit-tested.

import { RIDGE_HEIGHT, RIDGE_WIDTH, type Ridge } from "./ridge";

/** Where each beat (sea, ridge, seals) begins, as a share of the scene's scroll. The start is a chapter after the scene. */
export const BEAT_STARTS = [0, 0.25, 0.6] as const;
export type BeatIndex = 0 | 1 | 2;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** The current beat: the last whose start the scroll has reached. */
export function beatAt(progress: number): BeatIndex {
  const p = clamp01(progress);
  let beat: BeatIndex = 0;
  BEAT_STARTS.forEach((start, i) => {
    if (p >= start) beat = i as BeatIndex;
  });
  return beat;
}

/** How much of the ridge is drawn: it starts growing at 0.02 of the scroll (so scrolling always shows something move), all of it at 0.5. */
export function drawnShare(progress: number): number {
  const p = clamp01(progress);
  return clamp01((p - 0.02) / (0.5 - 0.02));
}

/** How many of `total` seals have dropped: none until 0.6 of the scroll, all of them at 0.9. */
export function sealsPlaced(progress: number, total: number): number {
  if (total <= 0) return 0;
  const p = clamp01(progress);
  return Math.min(total, Math.max(0, Math.floor(clamp01((p - 0.6) / (0.9 - 0.6)) * total)));
}

/** The point `distance` along a line, or null when the line has no length. */
function pointAlong(points: readonly [number, number][], distance: number): { at: [number, number]; total: number } | null {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return null;
  let left = Math.min(total, Math.max(0, distance));
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    if (len > 0 && left <= len) {
      const [ax, ay] = points[i]!;
      const [bx, by] = points[i + 1]!;
      const t = left / len;
      return { at: [ax + (bx - ax) * t, ay + (by - ay) * t], total };
    }
    left -= len;
  }
  return { at: [...points[points.length - 1]!], total };
}

const lineLength = (points: readonly [number, number][]) => pointAlong(points, 0)?.total ?? 0;

/**
 * `count` points spaced evenly by the length of the line (the first at its start, the last at its end; one point stands at
 * the middle). Nothing for a count of zero or a line of fewer than two points.
 */
export function sealPoints(points: readonly [number, number][], count: number): [number, number][] {
  const total = lineLength(points);
  if (count <= 0 || points.length < 2 || total === 0) return [];
  return Array.from({ length: count }, (_, i) => pointAlong(points, count === 1 ? total / 2 : (total * i) / (count - 1))!.at);
}

/**
 * One seal for every stamp place, grouped by mound: `groups[i]` is how many places mound i has (1 or 2). The mounds stand
 * evenly along the line; a mound with two places gets two seals side by side, `pairGap` of the line's length apart,
 * kept inside the line (a pair at an end stands against that end).
 */
export function moundSealPoints(points: readonly [number, number][], groups: readonly number[], pairGap = 0.022): [number, number][] {
  const total = lineLength(points);
  if (groups.length === 0 || points.length < 2 || total === 0) return [];
  const centres = sealPoints(points, groups.length);
  const gap = pairGap * total;
  const out: [number, number][] = [];
  groups.forEach((n, i) => {
    const [cx, cy] = centres[i]!;
    if (n < 2) {
      out.push([cx, cy]);
      return;
    }
    // Find the centre's distance along the line by searching, then spread the pair about it, inside the line.
    const centre = distanceOf(points, [cx, cy]);
    const start = Math.min(total - gap * (n - 1), Math.max(0, centre - (gap * (n - 1)) / 2));
    for (let k = 0; k < n; k++) out.push(pointAlong(points, start + gap * k)!.at);
  });
  return out;
}

/** How far along the line a point that lies on it is. */
function distanceOf(points: readonly [number, number][], p: [number, number]): number {
  let travelled = 0;
  let best = { d: Infinity, at: 0 };
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (len > 0) {
      const t = Math.min(1, Math.max(0, ((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay)) / (len * len)));
      const d = Math.hypot(ax + (bx - ax) * t - p[0], ay + (by - ay) * t - p[1]);
      if (d < best.d) best = { d, at: travelled + len * t };
    }
    travelled += len;
  }
  return best.at;
}

/** The line the stage draws: the real ridge, or, with no ridge data, a plain straight rise (never an invented profile). */
export function stageLine(ridge: Ridge | null): { d: string; points: [number, number][] } {
  if (ridge) return { d: ridge.d, points: ridge.points };
  const points: [number, number][] = [
    [0, RIDGE_HEIGHT],
    [RIDGE_WIDTH, RIDGE_HEIGHT * 0.1],
  ];
  return { d: points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "), points };
}

/** What the scene does for this visitor: the full scroll scene, only a fade-in of each beat, or nothing (calm wins). */
export function motionMode(env: { reduce: boolean; calm: boolean }): "scene" | "fade" | "static" {
  if (env.calm) return "static";
  return env.reduce ? "fade" : "scene";
}
