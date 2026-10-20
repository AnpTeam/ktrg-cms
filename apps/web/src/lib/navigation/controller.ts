// One navigation session, wired together without any screen: the stops the visitor has already stamped, the phone's
// position, the state step, and (signed in, off the course line) walking paths from our API. A screen subscribes with
// `onChange`. Coordinates are kept in memory only (the last fix, where the last path was asked from) and dropped on stop;
// the only one sent anywhere is the path request's starting point.

import type { GeoFailure } from "../stamp-flow";
import { createPositionWatcher, type GeoApi, type VisibilityApi } from "./position-watcher";
import { PATH_BACKOFF_MS, shouldAskForPath, type LastAsk, type PathAnswer } from "./path-client";
import { applyFix, initialState, trackOf, wantsPath, type NavModel, type NavPath, type NavReading, type NavState } from "./session";

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
}

export interface ControllerDeps {
  model: NavModel;
  geo: GeoApi | undefined;
  doc: VisibilityApi;
  now: () => number;
  /** The visitor's stamps from the server; null when they cannot be read. */
  loadStamps: () => Promise<Set<string> | null>;
  /** Asks for a walking path; leave it out for a signed-out visitor (then off the line it is straight to the stop). */
  fetchPath?: (spotId: string, from: { lat: number; lng: number }) => Promise<PathAnswer>;
  onChange: (snapshot: NavSnapshot) => void;
}

export function createNavigationController(deps: ControllerDeps) {
  const { model } = deps;
  let alive = false;
  let stamped: ReadonlySet<string> = new Set();
  let stampsKnown = false;
  let last: NavReading | null = null;
  let path: NavPath | null = null;
  let lastAsk: LastAsk | null = null;
  let asking = false;
  // Bumped on stop, so an answer for an earlier session is dropped.
  let generation = 0;
  let snap: NavSnapshot = { state: initialState(), stamped, stampsKnown, paused: false, problem: null, lastFixAtMs: null };

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
        if (last) emit({ state: applyFix(model, snap.state, last, stamped, path) });
      } else if (answer.backOff && lastAsk) {
        lastAsk = { ...lastAsk, backOffUntilMs: atMs + PATH_BACKOFF_MS };
      }
    });
  };

  const apply = (reading: NavReading) => {
    last = reading;
    const state = applyFix(model, snap.state, reading, stamped, path);
    emit({ state, stamped, lastFixAtMs: deps.now(), problem: null });
    if (deps.fetchPath && !asking && shouldAskForPath(wantsPath(state), state.targetId, reading, deps.now(), lastAsk)) askForPath(state.targetId!, reading);
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
    const loaded = await deps.loadStamps();
    if (!alive) return;
    if (loaded) {
      stamped = loaded;
      stampsKnown = true;
    }
    // Recompute right away when a fix is already there; otherwise just show the right target.
    emit({
      stamped,
      stampsKnown,
      state: last ? applyFix(model, snap.state, last, stamped, path) : snap.state,
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
      path = null;
      lastAsk = null;
      asking = false;
      generation++;
    },
    /** After a successful stamp: move on at once, without waiting for the server's list. */
    markStamped(id: string) {
      stamped = new Set([...stamped, id]);
      emit({ stamped, state: last ? applyFix(model, snap.state, last, stamped, path) : snap.state });
    },
    refreshStamps,
    /** A walking path from OpenRouteService (or null to drop it); used from the fix already held. */
    setPath(next: NavPath | null) {
      path = next;
      if (last) emit({ state: applyFix(model, snap.state, last, stamped, path) });
    },
    get snapshot() {
      return snap;
    },
  };
}

export type NavigationController = ReturnType<typeof createNavigationController>;
