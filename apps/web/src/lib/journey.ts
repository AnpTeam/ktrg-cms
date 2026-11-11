// The maths of the landing journey (docs/landing-journey-design.md): which beat a scroll position is in, how much of the
// ridge is drawn, how many seals have dropped, and where the seals stand. Pure: no React, no DOM, so it is unit-tested.

import { RIDGE_HEIGHT, RIDGE_WIDTH, type Ridge } from "./ridge";

/** Where each beat (sea, ridge, seals, start) begins, as a share of the scene's scroll. */
export const BEAT_STARTS = [0, 0.2, 0.5, 0.8] as const;
export type BeatIndex = 0 | 1 | 2 | 3;

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

/** How much of the ridge is drawn: nothing until 0.15 of the scroll, all of it at 0.5. */
export function drawnShare(progress: number): number {
  const p = clamp01(progress);
  return clamp01((p - 0.15) / (0.5 - 0.15));
}

/** How many of `total` seals have dropped: none until 0.5 of the scroll, all of them at 0.8. */
export function sealsPlaced(progress: number, total: number): number {
  if (total <= 0) return 0;
  const p = clamp01(progress);
  return Math.min(total, Math.max(0, Math.floor(clamp01((p - 0.5) / (0.8 - 0.5)) * total)));
}

/**
 * `count` points spaced evenly by the length of the line (the first at its start, the last at its end; one point stands at
 * the middle). Nothing for a count of zero or a line of fewer than two points.
 */
export function sealPoints(points: readonly [number, number][], count: number): [number, number][] {
  if (count <= 0 || points.length < 2) return [];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return [];
  const at = (distance: number): [number, number] => {
    let left = distance;
    for (let i = 0; i < lengths.length; i++) {
      const len = lengths[i]!;
      if (len > 0 && left <= len) {
        const [ax, ay] = points[i]!;
        const [bx, by] = points[i + 1]!;
        const t = left / len;
        return [ax + (bx - ax) * t, ay + (by - ay) * t];
      }
      left -= len;
    }
    return [...points[points.length - 1]!];
  };
  return Array.from({ length: count }, (_, i) => at(count === 1 ? total / 2 : (total * i) / (count - 1)));
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
