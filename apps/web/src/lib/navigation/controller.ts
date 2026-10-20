// One navigation session, wired together without any screen: the stops the visitor has already stamped, the phone's
// position, and the state step. A screen subscribes with `onChange`. Nothing here sends or keeps coordinates: the last
// fix is held in memory only to recompute right after a stamp, and is dropped on stop.

import type { GeoFailure } from "../stamp-flow";
import { createPositionWatcher, type GeoApi, type VisibilityApi } from "./position-watcher";
import { applyFix, initialState, type NavModel, type NavReading, type NavState } from "./session";

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
  onChange: (snapshot: NavSnapshot) => void;
}

export function createNavigationController(deps: ControllerDeps) {
  const { model } = deps;
  let alive = false;
  let stamped: ReadonlySet<string> = new Set();
  let stampsKnown = false;
  let last: NavReading | null = null;
  let snap: NavSnapshot = { state: initialState(model, stamped), stamped, stampsKnown, paused: false, problem: null, lastFixAtMs: null };

  const emit = (patch: Partial<NavSnapshot>) => {
    if (!alive) return;
    snap = { ...snap, ...patch };
    deps.onChange(snap);
  };

  const apply = (reading: NavReading) => {
    last = reading;
    emit({ state: applyFix(model, snap.state, reading, stamped), stamped, lastFixAtMs: deps.now(), problem: null });
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
      state: last ? applyFix(model, snap.state, last, stamped) : initialState(model, stamped),
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
    },
    /** After a successful stamp: move on at once, without waiting for the server's list. */
    markStamped(id: string) {
      stamped = new Set([...stamped, id]);
      emit({ stamped, state: last ? applyFix(model, snap.state, last, stamped) : initialState(model, stamped) });
    },
    refreshStamps,
    get snapshot() {
      return snap;
    },
  };
}

export type NavigationController = ReturnType<typeof createNavigationController>;
