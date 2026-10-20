import { describe, expect, test } from "bun:test";
import type { PublicSpot } from "../api-content-types";
import { createNavigationController, type NavSnapshot } from "./controller";
import type { GeoApi, VisibilityApi } from "./position-watcher";
import { modelFromRoute } from "./input";
import type { LinePoint } from "./geometry";

const LAT = 34.5;
const line: LinePoint[] = Array.from({ length: 11 }, (_, i) => [135 + i * 0.001, LAT] as LinePoint);
const spot = (id: string, lng: number, over: Partial<PublicSpot> = {}): PublicSpot =>
  ({ id, routeId: "r", stampable: true, position: { lat: LAT, lng, verified: true }, radiusM: 50, status: "open", sortOrder: 1, ...over }) as PublicSpot;
const spots = [spot("a", 135.003, { sortOrder: 1 }), spot("b", 135.006, { sortOrder: 2 }), spot("c", 135.01, { sortOrder: 3 })];

function setup(stampsOnServer: Set<string> | null = new Set()) {
  let deliver: ((p: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) | null = null;
  const watching = new Set<number>();
  const geo: GeoApi = {
    watchPosition(ok) {
      deliver = ok;
      watching.add(1);
      return 1;
    },
    clearWatch: (id) => void watching.delete(id),
  };
  const doc: VisibilityApi = { hidden: false, addEventListener() {}, removeEventListener() {} };
  let t = 0;
  const seen: NavSnapshot[] = [];
  const c = createNavigationController({
    model: modelFromRoute({ line: { type: "LineString", coordinates: line as [number, number][] } }, spots),
    geo,
    doc,
    now: () => t,
    loadStamps: async () => stampsOnServer,
    onChange: (s) => seen.push(s),
  });
  return {
    c, seen, watching,
    walk: (lng: number, accuracy = 10) => {
      t += 5000; // past the throttle every time
      deliver!({ coords: { latitude: LAT, longitude: lng, accuracy } });
    },
  };
}

describe("modelFromRoute", () => {
  test("only stamp places with a checked position are stops, in sort order; no line gives an empty line", () => {
    const m = modelFromRoute(
      { line: null },
      [spot("z", 135.009, { sortOrder: 9 }), spot("nopos", 135, { position: null, sortOrder: 2 }), spot("turn", 135, { stampable: false, sortOrder: 3 }), spot("a", 135.003, { sortOrder: 1 })],
    );
    expect(m.stops.map((s) => s.id)).toEqual(["a", "z"]);
    expect(m.line).toEqual([]);
    expect(m.legs.every((l) => !l.reliable)).toBe(true);
  });
});

describe("a navigation session", () => {
  test("loads the stamps, watches the phone, and reports where the visitor is", async () => {
    const s = setup(new Set(["a"]));
    await s.c.start();
    expect(s.c.snapshot.stampsKnown).toBe(true);
    expect(s.c.snapshot.state.targetId).toBe("b"); // a is already stamped
    s.walk(135.004);
    expect(s.c.snapshot.state.targetId).toBe("b");
    expect(s.c.snapshot.state.leg!.remainingM).toBeGreaterThan(150);
    expect(s.c.snapshot.lastFixAtMs).not.toBeNull();
  });

  test("marking a stamp moves the target on at once, from the fix already held", async () => {
    const s = setup();
    await s.c.start();
    s.walk(135.003);
    expect(s.c.snapshot.state.inRadius).toBe(true);
    s.c.markStamped("a");
    expect(s.c.snapshot.state.targetId).toBe("b");
    expect(s.c.snapshot.state.inRadius).toBe(false);
    expect(s.c.snapshot.state.distanceToTargetM).toBeGreaterThan(250);
  });

  test("stamps that cannot be read are said so, and the session still runs", async () => {
    const s = setup(null);
    await s.c.start();
    expect(s.c.snapshot.stampsKnown).toBe(false);
    s.walk(135.001);
    expect(s.c.snapshot.state.targetId).toBe("a");
  });

  test("a weak fix is ignored and counted, and does not clear an earlier problem-free state", async () => {
    const s = setup();
    await s.c.start();
    s.walk(135.001);
    const before = s.c.snapshot.state.distanceToTargetM;
    s.walk(135.009, 300);
    expect(s.c.snapshot.state.distanceToTargetM).toBe(before);
    expect(s.c.snapshot.state.ignoredFixes).toBe(1);
  });

  test("stop clears the watch, forgets the position, and later events change nothing", async () => {
    const s = setup();
    await s.c.start();
    s.walk(135.001);
    s.c.stop();
    expect(s.watching.size).toBe(0);
    const count = s.seen.length;
    s.walk(135.002);
    s.c.markStamped("a");
    await s.c.refreshStamps();
    expect(s.seen.length).toBe(count);
    s.c.stop(); // safe to repeat
  });

  test("a slow stamps answer that arrives after stop is dropped", async () => {
    let release!: (v: Set<string>) => void;
    const slow = new Promise<Set<string>>((r) => (release = r));
    const c = createNavigationController({
      model: modelFromRoute({ line: null }, spots),
      geo: undefined,
      doc: { hidden: false, addEventListener() {}, removeEventListener() {} },
      now: () => 0,
      loadStamps: () => slow,
      onChange: () => {},
    });
    const started = c.start();
    c.stop();
    release(new Set(["a"]));
    await started;
    expect(c.snapshot.stampsKnown).toBe(false);
  });
});
