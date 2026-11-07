// Watching the phone's position for navigation mode, with every browser part passed in so it can be tested with fakes.
//
// Rules (CLAUDE.md, Map, GPS and stamp rules): watchPosition only while navigation is on and the page is visible;
// at most one fix per few seconds; always clearWatch (also when the page is hidden, or on stop); permission denied
// stops watching until the visitor comes back to the page (they may have allowed it in the settings). The accuracy filter is the state step's job (session.ts), not this file's.

import { geoFailureFromCode, type GeoFailure } from "../stamp-flow";

/** The part of navigator.geolocation that is used. */
export interface GeoApi {
  watchPosition(
    ok: (pos: { coords: { latitude: number; longitude: number; accuracy: number; heading?: number | null; speed?: number | null } }) => void,
    fail: (err: { code: number }) => void,
    options: { enableHighAccuracy: boolean; maximumAge: number; timeout: number },
  ): number;
  clearWatch(id: number): void;
}

/** The part of `document` that is used. */
export interface VisibilityApi {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface WatcherOptions {
  /** Undefined where the browser has none (then the watcher reports "unsupported"). */
  geo: GeoApi | undefined;
  doc: VisibilityApi;
  now: () => number;
  onFix: (reading: { lat: number; lng: number; accuracyM: number; headingDeg?: number }) => void;
  onProblem: (problem: GeoFailure) => void;
  /** True when the page was hidden and watching stopped; false when it resumed. */
  onPaused: (paused: boolean) => void;
  minIntervalMs?: number;
}

export const MIN_FIX_INTERVAL_MS = 3000;
const WATCH_TIMEOUT_MS = 20_000;
// A fix a couple of seconds old is fine while walking; a cached one from minutes ago is not.
const MAX_FIX_AGE_MS = 2000;

export function createPositionWatcher(opts: WatcherOptions) {
  const minInterval = opts.minIntervalMs ?? MIN_FIX_INTERVAL_MS;
  let watchId: number | null = null;
  let running = false;
  let lastFixAt = Number.NEGATIVE_INFINITY;

  const endWatch = () => {
    if (watchId !== null) opts.geo?.clearWatch(watchId);
    watchId = null;
  };

  const beginWatch = () => {
    if (!opts.geo || watchId !== null) return;
    watchId = opts.geo.watchPosition(
      (pos) => {
        const t = opts.now();
        if (t - lastFixAt < minInterval) return; // throttle: the phone may report far more often than a walker needs
        lastFixAt = t;
        // The phone's own direction of travel, when it gives one (only while moving: walking pace is about 1 m/s).
        const { heading, speed } = pos.coords;
        const moving = typeof heading === "number" && Number.isFinite(heading) && typeof speed === "number" && speed >= 0.5;
        opts.onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy, ...(moving ? { headingDeg: heading } : {}) });
      },
      (err) => {
        const problem = geoFailureFromCode(err.code);
        opts.onProblem(problem);
        // Asking again now would only repeat the refusal. Browsers do not prompt again, so the try on return is silent.
        if (problem === "denied") endWatch();
      },
      { enableHighAccuracy: true, maximumAge: MAX_FIX_AGE_MS, timeout: WATCH_TIMEOUT_MS },
    );
  };

  const onVisibility = () => {
    if (!running) return;
    if (opts.doc.hidden) {
      endWatch();
      opts.onPaused(true);
    } else {
      lastFixAt = Number.NEGATIVE_INFINITY; // the first fix after coming back is always taken
      beginWatch();
      opts.onPaused(false);
    }
  };

  return {
    start() {
      if (running) return;
      if (!opts.geo) {
        opts.onProblem("unsupported");
        return;
      }
      running = true;
      opts.doc.addEventListener("visibilitychange", onVisibility);
      if (opts.doc.hidden) opts.onPaused(true);
      else beginWatch();
    },
    stop() {
      if (!running) return;
      running = false;
      endWatch();
      opts.doc.removeEventListener("visibilitychange", onVisibility);
    },
  };
}

export type PositionWatcher = ReturnType<typeof createPositionWatcher>;
