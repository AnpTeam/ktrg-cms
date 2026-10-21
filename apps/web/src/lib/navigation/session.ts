// The state of one navigation session, as pure functions: a model built once per course, and a step for each fix.
// No React, no browser, no network. The state keeps numbers and ids, never the visitor's coordinates.
//
// The rules (agreed 2026-10-20):
// - head for the NEAREST stop not yet stamped and not closed (the visitor may join anywhere, walk either way);
// - ON the course line (within OFF_ROUTE_M) and the stop sits on it: guide along that line ("line");
// - OFF it: follow a walking path from OpenRouteService when the screen has one for this stop and the visitor is
//   within OFF_ROUTE_M of it ("path"), otherwise point straight at the stop ("straight").
// - A new path is asked for only while guided straight, so walking along a path costs no requests.

import {
  bearingDeg,
  cumulativeDistances,
  cutLegs,
  distanceM,
  nearestTarget,
  nextTurn,
  OFF_ROUTE_M,
  offRouteStep,
  turnDelta,
  turnKind,
  pointAlong,
  projectOnLine,
  type LatLng,
  type LinePoint,
  type Stop,
  type TurnKind,
} from "./geometry";

/** A fix whose own error radius is worse than this is ignored (CLAUDE.md: drop poor-accuracy readings). */
export const MAX_ACCURACY_M = 100;
/** The direction is taken toward a point this far ahead on the line, so it follows the bends of the trail. */
export const LOOK_AHEAD_M = 30;
/** While on the line, a fix is matched only this far from where the visitor was, so a doubled-back trail does not jump. */
const SEARCH_WINDOW_M = 300;
/** Beyond this, the fix is re-matched against the whole line (the visitor may have rejoined it somewhere else). */
const OFF_LINE_RECHECK_M = 100;
/** Once following a walking path, the visitor leaves it only beyond this (joining needs OFF_ROUTE_M). */
const OFF_PATH_LEAVE_M = 60;

export interface NavStop extends Stop {
  /** The check-in radius of the place, in metres. */
  radiusM: number;
  status?: "open" | "caution" | "closed";
}

export interface NavReading {
  lat: number;
  lng: number;
  accuracyM: number;
  /** The direction the visitor is walking, when known (from the phone, or from how they moved). */
  headingDeg?: number;
}

/** Moved at least this far since the last heading: a new direction of travel can be read from the two fixes. */
export const HEADING_MIN_MOVE_M = 8;

/** The direction of travel from one fix to the next, or null when the visitor has hardly moved. */
export function movementHeading(from: LatLng | null, to: LatLng): number | null {
  if (!from || distanceM(from, to) < HEADING_MIN_MOVE_M) return null;
  return bearingDeg(from, to);
}

/** A line to follow with its cumulative distances (the course line, or a path from OpenRouteService). */
export interface Track {
  line: readonly LinePoint[];
  cum: readonly number[];
}

/** A walking path to one stop, from OpenRouteService. */
export interface NavPath extends Track {
  stopId: string;
}

export function trackOf(line: readonly LinePoint[]): Track {
  return { line, cum: cumulativeDistances(line) };
}

/** Built once per course (and again when the stops change). */
export interface NavModel extends Track {
  stops: readonly NavStop[];
  /** Where each stop sits along the course line (metres from its start); null when it cannot be placed on it. */
  stopAlongM: readonly (number | null)[];
}

export function buildModel(line: readonly LinePoint[], stops: readonly NavStop[]): NavModel {
  const track = trackOf(line);
  const legs = cutLegs(track.line, track.cum, stops);
  return { ...track, stops, stopAlongM: legs.map((l) => (l.reliable ? l.endM : null)) };
}

export type NavMode = "line" | "path" | "straight";

export interface NavState {
  /** The stop being headed for; null before the first fix, or when every stop is stamped or closed. */
  targetId: string | null;
  /** Metres to the target the way the visitor is guided (along the line or the path, or straight). */
  distanceM: number | null;
  /** Which way to walk now, in degrees clockwise from north. */
  bearingDeg: number | null;
  /** The next turn on the line or path being followed ("in 50 m, turn left"); null when straight on, or guided straight. */
  turn: { kind: TurnKind; inM: number } | null;
  /** The direction the visitor is walking; null until it is known. Kept while they stand still. */
  headingDeg: number | null;
  /** The way to the target relative to the walking direction ("straight", or a turn), when walking and guided straight. */
  steer: TurnKind | "straight" | null;
  mode: NavMode | null;
  /** Straight-line metres to the target (the stamp check uses this, on the server). */
  straightM: number | null;
  /** Where the visitor is along the course line, while near it (keeps the next match close by). */
  alongM: number | null;
  /** Metres from the course line; null without a usable line. */
  offLineM: number | null;
  /** Inside the target's check-in radius: the stamp button can be offered. */
  inRadius: boolean;
  offRouteCount: number;
  /** Off the course line for OFF_ROUTE_FIXES fixes in a row. */
  offRoute: boolean;
  /** Fixes ignored for poor accuracy, so the screen can say "GPS signal is weak". */
  ignoredFixes: number;
}

export function initialState(): NavState {
  return {
    targetId: null,
    distanceM: null,
    bearingDeg: null,
    turn: null,
    headingDeg: null,
    steer: null,
    mode: null,
    straightM: null,
    alongM: null,
    offLineM: null,
    inRadius: false,
    offRouteCount: 0,
    offRoute: false,
    ignoredFixes: 0,
  };
}

/** Distance and direction toward `targetAlongM` on a track, from a fix projected at `alongM`. */
function alongTrack(track: Track, alongM: number, targetAlongM: number, fix: LatLng, stop: LatLng): { distanceM: number; bearingDeg: number } {
  const distance = Math.abs(targetAlongM - alongM);
  const step = Math.min(LOOK_AHEAD_M, distance);
  const ahead = pointAlong(track.line, track.cum, alongM + Math.sign(targetAlongM - alongM) * step);
  // Close to the stop (or the look-ahead point is where the visitor stands): point at the stop itself.
  const towards = ahead && step >= 5 && distanceM(fix, ahead) >= 3 ? ahead : stop;
  return { distanceM: distance, bearingDeg: bearingDeg(fix, towards) };
}

/**
 * Take one fix. `stamped` is the visitor's stamps (a new stamp changes the target at the next call); `path` is a
 * walking path from OpenRouteService for one stop, used only while off the course line and only for that stop.
 */
export function applyFix(model: NavModel, prev: NavState, reading: NavReading, stamped: ReadonlySet<string>, path: NavPath | null = null): NavState {
  if (!(reading.accuracyM <= MAX_ACCURACY_M)) return { ...prev, ignoredFixes: prev.ignoredFixes + 1 }; // also catches NaN

  const base = { ...initialState(), ignoredFixes: prev.ignoredFixes, headingDeg: reading.headingDeg ?? prev.headingDeg };
  const i = nearestTarget(model.stops, stamped, reading);
  if (i === null) return base;
  const stop = model.stops[i]!;
  const straightM = distanceM(reading, stop);
  const inRadius = straightM <= stop.radiusM;

  // Where is the visitor relative to the course line? Near the last position first, then anywhere.
  let proj = null;
  if (model.line.length >= 2) {
    if (prev.alongM !== null) proj = projectOnLine(model.line, model.cum, reading, { fromM: prev.alongM - SEARCH_WINDOW_M, toM: prev.alongM + SEARCH_WINDOW_M });
    if (!proj || proj.offM > OFF_LINE_RECHECK_M) proj = projectOnLine(model.line, model.cum, reading);
  }
  const off = proj ? offRouteStep(prev.offRouteCount, proj.offM) : { count: 0, offRoute: false };
  const common = { ...base, targetId: stop.id, straightM, inRadius, offLineM: proj ? proj.offM : null, offRouteCount: off.count, offRoute: off.offRoute };

  const stopAlong = model.stopAlongM[i] ?? null;
  if (proj && !off.offRoute && proj.offM <= OFF_LINE_RECHECK_M && stopAlong !== null) {
    return { ...common, mode: "line", alongM: proj.alongM, turn: nextTurn(model.line, model.cum, proj.alongM, stopAlong), ...alongTrack(model, proj.alongM, stopAlong, reading, stop) };
  }

  if (path && path.stopId === stop.id && path.line.length >= 2) {
    const onPath = projectOnLine(path.line, path.cum, reading);
    // Strayed from the path too: guided straight, which asks for a new path (wantsPath). Leaving takes further than
    // joining, so a jumpy fix near the edge does not flip the guidance.
    if (onPath && onPath.offM <= (prev.mode === "path" ? OFF_PATH_LEAVE_M : OFF_ROUTE_M)) {
      const end = path.cum[path.cum.length - 1]!;
      return { ...common, mode: "path", turn: nextTurn(path.line, path.cum, onPath.alongM, end), ...alongTrack(path, onPath.alongM, end, reading, stop) };
    }
  }

  const towards = bearingDeg(reading, stop);
  // No line to follow: say which way relative to where the visitor is walking, once that is known.
  const steer = base.headingDeg === null ? null : (turnKind(turnDelta(base.headingDeg, towards)) ?? "straight");
  return { ...common, mode: "straight", distanceM: straightM, bearingDeg: towards, steer };
}

/** True when the screen should ask OpenRouteService for a path to the current target. */
export function wantsPath(state: NavState): boolean {
  return state.targetId !== null && state.mode === "straight" && !state.inRadius;
}
