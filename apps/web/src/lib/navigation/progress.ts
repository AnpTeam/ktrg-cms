// How far along a course the visitor is, and what is left, as pure functions over the navigation model and state.
// No React, no browser, no network, and no coordinates: only distances and counts.

import type { NavModel, NavState } from "./session";

/**
 * Walking pace for the time left: 50 m a minute, 3 km/h.
 * shortcut: a flat pace that ignores the climb; use each course's recorded minutes (`fromPrev`) or its elevation when the
 * elevation strip (N6) lands, since a mountain course is slower than this.
 */
export const WALK_M_PER_MIN = 50;

export interface NavProgress {
  /** Stamp places on the course. */
  total: number;
  /** Stamped, or closed (a closed place counts as done for completion, CLAUDE.md). */
  done: number;
  /** Metres to the target, the way the visitor is guided; null before a fix. */
  toNextM: number | null;
  toNextMin: number | null;
  /** Metres along the course line to cover every place still to stamp, from where the visitor is on it; null when the
   *  visitor is off the line, or a place left cannot be placed on it, so a wrong number is never shown. */
  leftM: number | null;
  leftMin: number | null;
}

const minutes = (m: number) => Math.max(1, Math.ceil(m / WALK_M_PER_MIN));

export function courseProgress(model: NavModel, state: NavState, stamped: ReadonlySet<string>): NavProgress {
  const left: (number | null)[] = [];
  let done = 0;
  model.stops.forEach((s, i) => {
    if (stamped.has(s.id) || s.status === "closed") done++;
    else left.push(model.stopAlongM[i] ?? null);
  });

  let leftM: number | null = null;
  if (state.alongM !== null && left.length > 0 && left.every((a): a is number => a !== null)) {
    const lo = Math.min(...(left as number[]));
    const hi = Math.max(...(left as number[]));
    // From the visitor to the nearer end of what is left, then across it.
    leftM = hi - lo + Math.min(Math.abs(state.alongM - lo), Math.abs(state.alongM - hi));
  }

  return {
    total: model.stops.length,
    done,
    toNextM: state.distanceM,
    toNextMin: state.distanceM === null ? null : minutes(state.distanceM),
    leftM,
    leftMin: leftM === null ? null : minutes(leftM),
  };
}
