// The state of one navigation session, as pure functions: a model built once per route, and a step for each fix.
// No React, no browser, no network. The state keeps only numbers and ids, never the visitor's coordinates.
//
// Heading: the next stop that is not stamped and not closed (nextTarget). Guidance covers the leg that ends at it,
// starting where the last stamped stop ended (so a closed stop in between does not make the visitor look off route).

import { cumulativeDistances, cutLegs, distanceM, legProgress, nextTarget, offRouteStep, type Leg, type LegProgress, type LinePoint, type Stop } from "./geometry";

/** A fix whose own error radius is worse than this is ignored (CLAUDE.md: drop poor-accuracy readings). */
export const MAX_ACCURACY_M = 100;

export interface NavStop extends Stop {
  /** The check-in radius of the place, in metres. */
  radiusM: number;
  status?: "open" | "caution" | "closed";
}

export interface NavReading {
  lat: number;
  lng: number;
  accuracyM: number;
}

/** Built once per route (and again when the stops change). */
export interface NavModel {
  line: readonly LinePoint[];
  cum: readonly number[];
  stops: readonly NavStop[];
  /** One per stop, in the same order. */
  legs: readonly Leg[];
}

export function buildModel(line: readonly LinePoint[], stops: readonly NavStop[]): NavModel {
  const cum = cumulativeDistances(line);
  return { line, cum, stops, legs: cutLegs(line, cum, stops) };
}

export interface NavState {
  /** The stop being headed for; null when every stop is stamped or closed (or the route has none). */
  targetId: string | null;
  /** Straight-line metres to the target; null until a usable fix has arrived. */
  distanceToTargetM: number | null;
  /** Progress on the current leg; null while no fix has arrived, or when the leg is unreliable. */
  leg: LegProgress | null;
  /** True when the numbers come from the straight line because the leg or the line cannot be trusted. */
  straightLineOnly: boolean;
  /** The visitor is inside the target's check-in radius: the stamp button can be offered. */
  inRadius: boolean;
  offRouteCount: number;
  offRoute: boolean;
  /** Fixes ignored for poor accuracy, so the screen can say "GPS signal is weak". */
  ignoredFixes: number;
}

export function initialState(model: NavModel, stamped: ReadonlySet<string>): NavState {
  const i = nextTarget(model.stops, stamped);
  return {
    targetId: i === null ? null : model.stops[i]!.id,
    distanceToTargetM: null,
    leg: null,
    straightLineOnly: false,
    inRadius: false,
    offRouteCount: 0,
    offRoute: false,
    ignoredFixes: 0,
  };
}

/** The leg to the target, starting where the last stamped stop before it ended. */
function currentLeg(model: NavModel, targetIndex: number, stamped: ReadonlySet<string>): Leg {
  let startM = 0;
  for (let j = targetIndex - 1; j >= 0; j--) {
    if (stamped.has(model.stops[j]!.id)) {
      startM = model.legs[j]!.endM;
      break;
    }
  }
  return { ...model.legs[targetIndex]!, startM };
}

/** Take one fix. Call again with the new `stamped` set after a stamp: the target moves on at the next fix. */
export function applyFix(model: NavModel, prev: NavState, reading: NavReading, stamped: ReadonlySet<string>): NavState {
  if (!(reading.accuracyM <= MAX_ACCURACY_M)) return { ...prev, ignoredFixes: prev.ignoredFixes + 1 }; // also catches NaN

  const i = nextTarget(model.stops, stamped);
  if (i === null) return { ...initialState(model, stamped), ignoredFixes: prev.ignoredFixes };
  const stop = model.stops[i]!;
  const sameTarget = prev.targetId === stop.id;

  const straightM = distanceM(reading, stop);
  const inRadius = straightM <= stop.radiusM;
  const base = { targetId: stop.id, inRadius, ignoredFixes: prev.ignoredFixes };

  const leg = model.legs[i]!;
  if (!leg.reliable) {
    return { ...base, distanceToTargetM: straightM, leg: null, straightLineOnly: true, offRouteCount: 0, offRoute: false };
  }
  const progress = legProgress(model.line, model.cum, currentLeg(model, i, stamped), reading);
  if (!progress) {
    return { ...base, distanceToTargetM: straightM, leg: null, straightLineOnly: true, offRouteCount: 0, offRoute: false };
  }
  const off = offRouteStep(sameTarget ? prev.offRouteCount : 0, progress.offM);
  return { ...base, distanceToTargetM: straightM, leg: progress, straightLineOnly: false, offRouteCount: off.count, offRoute: off.offRoute };
}
