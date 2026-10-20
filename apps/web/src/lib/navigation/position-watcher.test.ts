import { describe, expect, test } from "bun:test";
import type { GeoFailure } from "../stamp-flow";
import { createPositionWatcher, MIN_FIX_INTERVAL_MS, type GeoApi, type VisibilityApi } from "./position-watcher";

function setup(opts: { hidden?: boolean; noGeo?: boolean } = {}) {
  let nextId = 1;
  let ok: Parameters<GeoApi["watchPosition"]>[0] | null = null;
  let fail: Parameters<GeoApi["watchPosition"]>[1] | null = null;
  const watching = new Set<number>();
  const cleared: number[] = [];
  const geo: GeoApi = {
    watchPosition(o, f) {
      ok = o;
      fail = f;
      const id = nextId++;
      watching.add(id);
      return id;
    },
    clearWatch(id) {
      cleared.push(id);
      watching.delete(id);
    },
  };
  let listener: (() => void) | null = null;
  const doc = {
    hidden: opts.hidden ?? false,
    addEventListener: (_: string, l: () => void) => void (listener = l),
    removeEventListener: (_: string, l: () => void) => void (listener === l && (listener = null)),
  } as VisibilityApi & { hidden: boolean };
  let t = 1_000_000;
  const fixes: { lat: number; lng: number; accuracyM: number }[] = [];
  const problems: GeoFailure[] = [];
  const paused: boolean[] = [];
  const watcher = createPositionWatcher({
    geo: opts.noGeo ? undefined : geo,
    doc,
    now: () => t,
    onFix: (f) => fixes.push(f),
    onProblem: (p) => problems.push(p),
    onPaused: (p) => paused.push(p),
  });
  const pos = (lat: number, lng: number, accuracy: number) => ({ coords: { latitude: lat, longitude: lng, accuracy } });
  return {
    watcher, fixes, problems, paused, watching, cleared,
    deliver: (lat: number, lng: number, accuracy = 10) => ok!(pos(lat, lng, accuracy)),
    error: (code: number) => fail!({ code }),
    advance: (ms: number) => void (t += ms),
    hide: (hidden: boolean) => {
      (doc as { hidden: boolean }).hidden = hidden;
      listener?.();
    },
    hasListener: () => listener !== null,
  };
}

describe("createPositionWatcher", () => {
  test("starts one watch, passes fixes on as readings, and clears the watch on stop", () => {
    const s = setup();
    s.watcher.start();
    s.watcher.start(); // a second start changes nothing
    expect(s.watching.size).toBe(1);
    s.deliver(34.5, 135.1, 12);
    expect(s.fixes).toEqual([{ lat: 34.5, lng: 135.1, accuracyM: 12 }]);
    s.watcher.stop();
    expect(s.watching.size).toBe(0);
    expect(s.hasListener()).toBe(false);
    s.watcher.stop(); // safe to repeat
    expect(s.cleared).toEqual([1]);
  });

  test("throttles: fixes closer together than the interval are dropped", () => {
    const s = setup();
    s.watcher.start();
    s.deliver(1, 1);
    s.advance(MIN_FIX_INTERVAL_MS - 1);
    s.deliver(2, 2);
    s.advance(1);
    s.deliver(3, 3);
    expect(s.fixes.map((f) => f.lat)).toEqual([1, 3]);
  });

  test("a hidden page stops watching and says so; coming back resumes and takes the first fix at once", () => {
    const s = setup();
    s.watcher.start();
    s.deliver(1, 1);
    s.hide(true);
    expect(s.watching.size).toBe(0);
    expect(s.paused).toEqual([true]);
    s.hide(false);
    expect(s.watching.size).toBe(1);
    expect(s.paused).toEqual([true, false]);
    s.deliver(2, 2); // no waiting for the interval after a pause
    expect(s.fixes.map((f) => f.lat)).toEqual([1, 2]);
  });

  test("started on a hidden page: no watch yet, paused until it is shown", () => {
    const s = setup({ hidden: true });
    s.watcher.start();
    expect(s.watching.size).toBe(0);
    expect(s.paused).toEqual([true]);
    s.hide(false);
    expect(s.watching.size).toBe(1);
  });

  test("permission denied is reported once and stops watching for good", () => {
    const s = setup();
    s.watcher.start();
    s.error(1);
    expect(s.problems).toEqual(["denied"]);
    expect(s.watching.size).toBe(0);
    expect(s.hasListener()).toBe(false);
    s.hide(true);
    s.hide(false);
    expect(s.watching.size).toBe(0); // a returning page does not ask again
  });

  test("unavailable and timeout are reported but the watch keeps going", () => {
    const s = setup();
    s.watcher.start();
    s.error(2);
    s.error(3);
    expect(s.problems).toEqual(["unavailable", "timeout"]);
    expect(s.watching.size).toBe(1);
  });

  test("no geolocation: reports unsupported and starts nothing", () => {
    const s = setup({ noGeo: true });
    s.watcher.start();
    expect(s.problems).toEqual(["unsupported"]);
    expect(s.hasListener()).toBe(false);
  });
});
