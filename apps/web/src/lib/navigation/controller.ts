// One navigation session, wired together without any screen: the stops the visitor has already stamped, the phone's
// position, the state step, and (signed in, off the course line) walking paths from our API. A screen subscribes with
// `onChange`. Coordinates are kept in memory only (the last fix, where the last path was asked from) and dropped on stop;
// the only one sent anywhere is the path request's starting point.

import type { GeoFailure } from "../stamp-flow";
import type { LinePoint } from "./geometry";
import { createPositionWatcher, type GeoApi, type VisibilityApi } from "./position-watcher";
import { PATH_BACKOFF_MS, shouldAskForPath, type LastAsk, type PathAnswer } from "./path-client";
import { applyFix, initialState, MAX_ACCURACY_M, movementHeading, stopsBehind, trackOf, wantsPath, type NavModel, type NavPath, type NavReading, type NavState } from "./session";

export interface NavSnapshot {
  state: NavState;
  /** Place ids the visitor has stamped, as last read from the server (or marked here). */
  stamped: ReadonlySet<string>;
  /** False when the stamps could not be read (signed out, offline): the target may be a stop already stamped. */
  stampsKnown: boolean;
  /** The page is hidden, so no position is being watched. */
  paused: boolean;
  /** The last thing the phone could not do (permission denied, unavailable, timeout, unsupported), if any. */
  problem: GeoFailure | null;
  /** The time of the last used fix, so the screen can say how old the position is. Null before the first. */
  lastFixAtMs: number | null;
  /** The last used fix, for the position dot on the map. On this phone only: never sent, dropped on stop. */
  position: NavReading | null;
  /** The walking path being followed off the course line, for the map; null when there is none. */
  pathLine: readonly LinePoint[] | null;
  /** The stop the visitor chose to head for instead of the nearest one; null while it is chosen automatically. */
  forcedId: string | null;
  /** A stop just walked past without stamping: the screen asks whether to go on or go back. */
  passedId: string | null;
}

export interface ControllerDeps {
  model: NavModel;
  geo: GeoApi | undefined;
  doc: VisibilityApi;
  now: () => number;
  /** The visitor's stamps from the server; null when they cannot be read. */
  loadStamps: () => Promise<Set<string> | null>;
  /** Places stamped with no signal and still waiting on this phone: the guidance does not head for them again. */
  loadWaiting?: () => Promise<string[]>;
  /** Asks for a walking path; leave it out for a signed-out visitor (then off the line it is straight to the stop). */
  fetchPath?: (spotId: string, from: { lat: number; lng: number }) => Promise<PathAnswer>;
  onChange: (snapshot: NavSnapshot) => void;
}

export function createNavigationController(deps: ControllerDeps) {
  // The stops' statuses change while walking (setStatuses).
  let model = deps.model;
  let alive = false;
  let stamped: ReadonlySet<string> = new Set();
  let stampsKnown = false;
  let last: NavReading | null = null;
  // Where the direction of travel was last read from (in memory only, dropped on stop).
  let headingFrom: NavReading | null = null;
  let path: NavPath | null = null;
  let lastAsk: LastAsk | null = null;
  let asking = false;
  // Bumped on stop, so an answer for an earlier session is dropped.
  let generation = 0;
  let forced: string | null = null;
  // The visitor chose to walk although far from the course; reset once they are near it.
  let walkChosen = false;
  // Stops walked past and left behind: the guidance no longer heads for them. `asked`: each is asked about once.
  let skipped: ReadonlySet<string> = new Set();
  let asked: ReadonlySet<string> = new Set();
  // What the guidance does not head for. With only skipped stops left it heads for those rather than saying all is done.
  const finished = (): ReadonlySet<string> => {
    const done = new Set([...stamped, ...skipped]);
    return model.stops.some((s) => !done.has(s.id) && s.status !== "closed") ? done : stamped;
  };
  let snap: NavSnapshot = { state: initialState(), stamped, stampsKnown, paused: false, problem: null, lastFixAtMs: null, position: null, pathLine: null, forcedId: null, passedId: null };

  const emit = (patch: Partial<NavSnapshot>) => {
    if (!alive) return;
    snap = { ...snap, ...patch };
    deps.onChange(snap);
  };

  const askForPath = (stopId: string, from: NavReading) => {
    const fetchPath = deps.fetchPath;
    if (!fetchPath) return;
    asking = true;
    const gen = generation;
    const atMs = deps.now();
    lastAsk = { stopId, atMs, from: { lat: from.lat, lng: from.lng } };
    void fetchPath(stopId, { lat: from.lat, lng: from.lng }).then((answer) => {
      if (gen !== generation) return;
      asking = false;
      if (!alive) return;
      if (answer.ok) {
        path = { stopId, ...trackOf(answer.line) };
        emit({ pathLine: path.line, ...(last ? { state: applyFix(model, snap.state, last, finished(), path, forced) } : {}) });
      } else if (answer.backOff && lastAsk) {
        lastAsk = { ...lastAsk, backOffUntilMs: atMs + PATH_BACKOFF_MS };
      }
    });
  };

  const apply = (fix: NavReading) => {
    // Too poor to use: only counted. It is not the visitor's position, so nothing below may keep it.
    if (!(fix.accuracyM <= MAX_ACCURACY_M)) return emit({ problem: null, state: applyFix(model, snap.state, fix, finished(), path, forced) });
    // The phone's heading when it has one; otherwise read it from the movement since the last one.
    let reading = fix;
    if (fix.headingDeg === undefined) {
      const moved = movementHeading(headingFrom, fix);
      if (moved !== null) reading = { ...fix, headingDeg: moved };
    }
    if (reading.headingDeg !== undefined || !headingFrom) headingFrom = fix;
    last = reading;
    const state = applyFix(model, snap.state, reading, finished(), path, forced);
    // A stop chosen by hand is never asked about: the visitor wants it.
    const justPassed = state.passed && forced === null && snap.passedId === null && state.targetId !== null && !asked.has(state.targetId);
    if (justPassed) asked = new Set([...asked, state.targetId!]);
    // A path for another stop (the target moved on) is no longer drawn.
    if (!state.far) walkChosen = false;
    emit({ state, stamped, lastFixAtMs: deps.now(), problem: null, position: reading, pathLine: path && path.stopId === state.targetId ? path.line : null, passedId: justPassed ? state.targetId : snap.passedId });
    if (deps.fetchPath && !asking && shouldAskForPath(wantsPath(state, walkChosen), state.targetId, reading, deps.now(), lastAsk)) askForPath(state.targetId!, reading);
  };

  const watcher = createPositionWatcher({
    geo: deps.geo,
    doc: deps.doc,
    now: deps.now,
    onFix: apply,
    onProblem: (problem) => emit({ problem }),
    onPaused: (paused) => emit({ paused }),
  });

  async function refreshStamps() {
    const [loaded, waiting] = await Promise.all([deps.loadStamps(), deps.loadWaiting?.() ?? []]);
    if (!alive) return;
    if (loaded) {
      stamped = loaded;
      stampsKnown = true;
    }
    stamped = new Set([...stamped, ...waiting]);
    if (forced !== null && stamped.has(forced)) forced = null;
    // Recompute right away when a fix is already there; otherwise just show the right target.
    emit({
      stamped,
      stampsKnown,
      state: last ? applyFix(model, snap.state, last, finished(), path, forced) : snap.state,
      forcedId: forced,
    });
  }

  return {
    async start() {
      if (alive) return;
      alive = true;
      emit({});
      watcher.start();
      await refreshStamps();
    },
    stop() {
      if (!alive) return;
      watcher.stop();
      alive = false;
      last = null;
      headingFrom = null;
      path = null;
      lastAsk = null;
      asking = false;
      generation++;
      forced = null;
      walkChosen = false;
      skipped = new Set();
      asked = new Set();
    },
    /** Walk to the course although it is far: asks for a walking path from the fix held (one at a time). */
    chooseWalk() {
      walkChosen = true;
      const target = snap.state.targetId;
      if (last && target && deps.fetchPath && !asking) askForPath(target, last);
    },
    /** Head for this stop instead of the nearest one (null: back to choosing the nearest). */
    setTarget(id: string | null) {
      forced = id;
      if (id !== null && skipped.has(id)) skipped = new Set([...skipped].filter((s) => s !== id));
      emit({ forcedId: id, ...(last ? { state: applyFix(model, snap.state, last, finished(), path, forced) } : {}) });
    },
    /** The stop just passed is left behind: head for the next one. */
    skipPassed() {
      if (snap.passedId === null) return;
      const behind = snap.state.alongM === null ? [] : stopsBehind(model, snap.passedId, snap.state.alongM);
      const wide = new Set([...skipped, snap.passedId, ...behind]);
      // Walking off the last stop: nothing lies ahead, so only the passed one is dropped.
      skipped = model.stops.some((s) => !wide.has(s.id) && !stamped.has(s.id) && s.status !== "closed") ? wide : new Set([...skipped, snap.passedId]);
      emit({ passedId: null, ...(last ? { state: applyFix(model, snap.state, last, finished(), path, forced) } : {}) });
    },
    /** Go back to the stop just passed. */
    returnToPassed() {
      const id = snap.passedId;
      if (id === null) return;
      forced = id;
      emit({ passedId: null, forcedId: id, ...(last ? { state: applyFix(model, snap.state, last, finished(), path, forced) } : {}) });
    },
    /** The stops' latest statuses: a stop closed during the walk is no longer headed for, one reopened is again. */
    setStatuses(statuses: ReadonlyMap<string, "open" | "caution" | "closed">) {
      if (!model.stops.some((s) => statuses.has(s.id) && statuses.get(s.id) !== s.status)) return;
      model = { ...model, stops: model.stops.map((s) => ({ ...s, status: statuses.get(s.id) ?? s.status })) };
      if (forced !== null && statuses.get(forced) === "closed") forced = null;
      emit({ forcedId: forced, ...(last ? { state: applyFix(model, snap.state, last, finished(), path, forced) } : {}) });
    },
    /** After a successful stamp: move on at once, without waiting for the server's list. */
    markStamped(id: string) {
      stamped = new Set([...stamped, id]);
      if (forced === id) forced = null; // the chosen stop is done: back to the nearest
      emit({ stamped, forcedId: forced, passedId: snap.passedId === id ? null : snap.passedId, state: last ? applyFix(model, snap.state, last, finished(), path, forced) : snap.state });
    },
    refreshStamps,
    /** A walking path from OpenRouteService (or null to drop it); used from the fix already held. */
    setPath(next: NavPath | null) {
      path = next;
      emit({ pathLine: next ? next.line : null, ...(last ? { state: applyFix(model, snap.state, last, finished(), path, forced) } : {}) });
    },
    get snapshot() {
      return snap;
    },
  };
}

export type NavigationController = ReturnType<typeof createNavigationController>;
