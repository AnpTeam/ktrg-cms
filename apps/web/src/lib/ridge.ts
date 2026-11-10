// The whole trail as one ridge: every course's elevation profile laid end to end, in course order, from the sea at
// Tomogashima to the mountains. Drawn on the landing page as the site's line (docs/design-language.md, Motifs 1).
// Real data only: a course without a profile or a length is left out, never guessed.

import type { Sketch } from "./sketch";

export interface RidgeCourse {
  order: number;
  distanceKm: number | null;
  sketch: Sketch | null;
}

export interface Ridge {
  /** SVG path text in a WIDTH x HEIGHT box, y downward. */
  d: string;
  /** Courses drawn, so the caption can say how much of the trail it shows. */
  courses: number;
  /** Highest point drawn, in metres. */
  topM: number;
  /** Where each course drawn runs along the line, [from, to] in the box's x, keyed by course order. */
  spans: Map<number, [number, number]>;
}

export const RIDGE_WIDTH = 1000;
export const RIDGE_HEIGHT = 200;

/** The ridge path, or null when fewer than two points are known (nothing worth drawing). */
export function ridgePath(courses: readonly RidgeCourse[]): Ridge | null {
  const known = [...courses]
    .filter((c) => (c.distanceKm ?? 0) > 0 && (c.sketch?.elevations?.length ?? 0) >= 2)
    .sort((a, b) => a.order - b.order);
  // [km along the trail, metres]
  const points: [number, number][] = [];
  const kmSpans: [number, number, number][] = []; // [order, from km, to km]
  let start = 0;
  for (const c of known) {
    const eles = c.sketch!.elevations!;
    const km = c.distanceKm!;
    eles.forEach((m, i) => points.push([start + (km * i) / (eles.length - 1), m]));
    kmSpans.push([c.order, start, start + km]);
    start += km;
  }
  if (points.length < 2) return null;
  const topM = Math.max(...points.map((p) => p[1]));
  const lowM = Math.min(0, ...points.map((p) => p[1]));
  const span = topM - lowM || 1;
  // A little room above the summit so the line never touches the edge.
  const y = (m: number) => RIDGE_HEIGHT - ((m - lowM) / span) * (RIDGE_HEIGHT * 0.9);
  const x = (km: number) => (km / start) * RIDGE_WIDTH;
  const d = points.map(([km, m], i) => `${i === 0 ? "M" : "L"}${x(km).toFixed(1)} ${y(m).toFixed(1)}`).join(" ");
  const spans = new Map(kmSpans.map(([order, a, b]) => [order, [x(a), x(b)] as [number, number]]));
  return { d, courses: known.length, topM: Math.round(topM), spans };
}
