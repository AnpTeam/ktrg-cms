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

function setup(stampsOnServer: Set<string> | null = new Set(), fetchPath?: Parameters<typeof createNavigationController>[0]["fetchPath"], waiting: string[] = []) {
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
    loadWaiting: async () => waiting,
    fetchPath,
    onChange: (s) => seen.push(s),
  });
  return {
    c, seen, watching,
    walk: (lng: number, accuracy = 10) => {
      t += 5000; // past the throttle every time
      deliver!({ coords: { latitude: LAT, longitude: lng, accuracy } });
    },
    walkAt: (lng: number, lat: number) => {
      t += 5000;
      deliver!({ coords: { latitude: lat, longitude: lng, accuracy: 10 } });
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
    expect(m.stopAlongM).toEqual([null, null]); // no line: no stop can be placed on it
  });
});

describe("a navigation session", () => {
  test("loads the stamps, watches the phone, and reports where the visitor is", async () => {
    const s = setup(new Set(["a"]));
    await s.c.start();
    expect(s.c.snapshot.stampsKnown).toBe(true);
    expect(s.c.snapshot.state.targetId).toBeNull(); // no fix yet: nearest is not known
    s.walk(135.0035);
    expect(s.c.snapshot.state.targetId).toBe("b"); // a is nearer but already stamped
    expect(s.c.snapshot.state.mode).toBe("line");
    expect(s.c.snapshot.state.distanceM!).toBeGreaterThan(200);
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
    expect(s.c.snapshot.state.distanceM!).toBeGreaterThan(250);
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
    const before = s.c.snapshot.state.distanceM;
    s.walk(135.009, 300);
    expect(s.c.snapshot.state.distanceM).toBe(before);
    expect(s.c.snapshot.state.ignoredFixes).toBe(1);
  });

  test("a fix too poor to use is no position: the screen can say the signal is weak, not that every stamp is pressed", async () => {
    const s = setup();
    await s.c.start();
    s.walk(135.001, 300);
    const first = s.c.snapshot;
    expect(first.position).toBeNull();
    expect(first.lastFixAtMs).toBeNull();
    expect(first.state.ignoredFixes).toBe(1);
  });

  test("a poor fix after a good one leaves the dot and the age of the position alone", async () => {
    const s = setup();
    await s.c.start();
    s.walk(135.001);
    const { position, lastFixAtMs } = s.c.snapshot;
    s.walk(135.009, 300);
    expect(s.c.snapshot.position).toEqual(position);
    expect(s.c.snapshot.lastFixAtMs).toBe(lastFixAtMs);
  });

  test("a stamp waiting on the phone is not headed for again, even when the server cannot be reached", async () => {
    const s = setup(null, undefined, ["a"]);
    await s.c.start();
    s.walk(135.003); // standing at "a"
    expect(s.c.snapshot.state.targetId).toBe("b");
    expect(s.c.snapshot.stampsKnown).toBe(false);
  });

  test("a stamp waiting on the phone counts beside the server's list", async () => {
    const s = setup(new Set(["b"]), undefined, ["a"]);
    await s.c.start();
    expect([...s.c.snapshot.stamped].sort()).toEqual(["a", "b"]);
    expect(s.c.snapshot.stampsKnown).toBe(true);
  });

  test("a path for the target switches an off-route visitor from 'straight' to 'path'", async () => {
    const s = setup();
    await s.c.start();
    s.walk(135.0025, 300); // ignored (weak), then a real fix far north of the line:
    for (let i = 0; i < 3; i++) s.walkAt(135.003, LAT + 0.004);
    expect(s.c.snapshot.state.mode).toBe("straight");
    s.c.setPath({ stopId: "a", line: [[135.003, LAT + 0.004], [135.003, LAT]], cum: [0, 444.8] });
    expect(s.c.snapshot.state.mode).toBe("path");
    s.c.setPath(null);
    expect(s.c.snapshot.state.mode).toBe("straight");
  });

  test("signed in and off the line: asks for a path once, follows it, and does not ask again while standing still", async () => {
    const asks: string[] = [];
    const s = setup(new Set(), async (spotId) => {
      asks.push(spotId);
      return { ok: true, line: [[135.003, LAT + 0.004], [135.003, LAT]] };
    });
    await s.c.start();
    for (let i = 0; i < 3; i++) s.walkAt(135.003, LAT + 0.004); // far north of the line
    await Promise.resolve();
    await Promise.resolve();
    expect(asks).toEqual(["a"]);
    expect(s.c.snapshot.state.mode).toBe("path");
    s.walkAt(135.003, LAT + 0.004);
    expect(asks).toEqual(["a"]);
  });

  test("signed out (no fetchPath): off the line stays straight, nothing is asked", async () => {
    const s = setup();
    await s.c.start();
    for (let i = 0; i < 3; i++) s.walkAt(135.003, LAT + 0.004);
    expect(s.c.snapshot.state.mode).toBe("straight");
  });

  test("a path answer that arrives after stop is dropped", async () => {
    let release!: (v: { ok: true; line: [number, number][] }) => void;
    const s = setup(new Set(), () => new Promise((r) => (release = r)));
    await s.c.start();
    for (let i = 0; i < 3; i++) s.walkAt(135.003, LAT + 0.004);
    s.c.stop();
    const count = s.seen.length;
    release({ ok: true, line: [[135.003, LAT + 0.004], [135.003, LAT]] });
    await Promise.resolve();
    expect(s.seen.length).toBe(count);
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

describe("choosing a stop", () => {
  test("setTarget heads for that stop at once, stamping it hands the choice back to the nearest, and null clears it", async () => {
    const s = setup();
    await s.c.start();
    s.walk(135.003);
    expect(s.c.snapshot.state.targetId).toBe("a");
    s.c.setTarget("c");
    expect(s.c.snapshot).toMatchObject({ forcedId: "c", state: { targetId: "c" } });
    s.walk(135.0031); // still c while walking: the choice sticks
    expect(s.c.snapshot.state.targetId).toBe("c");
    s.c.markStamped("c");
    expect(s.c.snapshot.forcedId).toBeNull();
    expect(s.c.snapshot.state.targetId).toBe("a");
    s.c.setTarget("b");
    s.c.setTarget(null);
    expect(s.c.snapshot).toMatchObject({ forcedId: null, state: { targetId: "a" } });
  });
});

describe("far from the course", () => {
  const FAR_LAT = LAT + 0.06; // about 6.7 km north of the line

  test("more than the far distance away: marked far, and no walking path is asked for unasked", async () => {
    const asked: string[] = [];
    const { c, walkAt } = setup(new Set(), async (id) => (asked.push(id), { ok: false, backOff: false }));
    await c.start();
    walkAt(135.005, FAR_LAT);
    expect(c.snapshot.state.far).toBe(true);
    expect(asked).toEqual([]);
  });

  test("choosing to walk asks for the path from the fix held; near the course it is not far", async () => {
    const asked: string[] = [];
    const { c, walkAt } = setup(new Set(), async (id) => (asked.push(id), { ok: false, backOff: false }));
    await c.start();
    walkAt(135.005, FAR_LAT);
    c.chooseWalk();
    expect(asked).toHaveLength(1);
    walkAt(135.005, LAT + 0.0002);
    expect(c.snapshot.state.far).toBe(false);
  });
});

describe("a stop walked past", () => {
  const past = async () => {
    const run = setup();
    await run.c.start();
    [135.0025, 135.0029, 135.0043].forEach((lng) => run.walk(lng));
    return run;
  };

  test("asks once; going on heads for the next stop", async () => {
    const { c, walk } = await past();
    expect(c.snapshot.passedId).toBe("a");
    c.skipPassed();
    expect(c.snapshot.passedId).toBeNull();
    expect(c.snapshot.state.targetId).toBe("b");
    walk(135.0044);
    expect(c.snapshot.passedId).toBeNull();
  });

  test("going back heads for it and does not ask again", async () => {
    const { c, walk } = await past();
    c.returnToPassed();
    expect(c.snapshot.forcedId).toBe("a");
    expect(c.snapshot.state.targetId).toBe("a");
    walk(135.0045);
    expect(c.snapshot.passedId).toBeNull();
  });

  test("a stop left behind can still be chosen by hand", async () => {
    const { c } = await past();
    c.skipPassed();
    c.setTarget("a");
    expect(c.snapshot.state.targetId).toBe("a");
  });
});
