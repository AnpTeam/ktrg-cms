import { describe, expect, test } from "bun:test";
import type { LinePoint } from "./geometry";
import { applyFix, buildModel, initialState, isFar, stopsBehind, MAX_ACCURACY_M, movementHeading, trackOf, wantsPath, type NavReading, type NavState, type NavStop } from "./session";

// A straight east-west line at latitude 34.5 from 135.000 to 135.010 (about 917 m); 0.001 degrees of longitude is ~91.7 m.
const LAT = 34.5;
const line: LinePoint[] = Array.from({ length: 11 }, (_, i) => [135 + i * 0.001, LAT] as LinePoint);
const stops: NavStop[] = [
  { id: "a", lng: 135.003, lat: LAT, radiusM: 50 },
  { id: "b", lng: 135.006, lat: LAT, radiusM: 50 },
  { id: "c", lng: 135.01, lat: LAT, radiusM: 50 },
];
const at = (lng: number, lat = LAT, accuracyM = 10): NavReading => ({ lat, lng, accuracyM });
const none = new Set<string>();
const model = buildModel(line, stops);
const walk = (fixes: NavReading[], stamped: ReadonlySet<string> = none, s: NavState = initialState()) => fixes.reduce((st, f) => applyFix(model, st, f, stamped), s);
const close = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("the nearest stop, wherever the visitor joins", () => {
  test("no target before the first fix", () => {
    expect(initialState().targetId).toBeNull();
  });

  test("joining at the start heads for a; joining in the middle heads for b; at the far end for c", () => {
    expect(walk([at(135.0)]).targetId).toBe("a");
    expect(walk([at(135.0055)]).targetId).toBe("b");
    expect(walk([at(135.0099)]).targetId).toBe("c");
  });

  test("after a stamp the next nearest is chosen, even when it is behind (walking the course backwards)", () => {
    const s = walk([at(135.0098)], new Set(["c"]));
    expect(s.targetId).toBe("b");
    expect(s.bearingDeg!).toBeGreaterThan(260); // west
    expect(s.bearingDeg!).toBeLessThan(280);
  });

  test("everything stamped: no target, no distance", () => {
    const s = walk([at(135.01)], new Set(["a", "b", "c"]));
    expect(s.targetId).toBeNull();
    expect(s.distanceM).toBeNull();
    expect(s.inRadius).toBe(false);
  });

  test("a closed stop is never the target, even when it is the nearest", () => {
    const m = buildModel(line, stops.map((s) => (s.id === "b" ? { ...s, status: "closed" as const } : s)));
    expect(applyFix(m, initialState(), at(135.006), none).targetId).not.toBe("b");
  });
});

describe("on the course line: guided along it", () => {
  test("distance is measured along the line, the direction points along it, and the stamp is offered inside the radius", () => {
    let s = walk([at(135.0)]);
    expect(s.mode).toBe("line");
    close(s.distanceM!, 275, 3);
    close(s.bearingDeg!, 90, 1); // east, along the line
    expect(s.inRadius).toBe(false);
    s = walk([at(135.0026)], none, s); // ~37 m short
    expect(s.inRadius).toBe(true);
    close(s.distanceM!, 37, 3);
  });

  test("a bend: the direction follows the trail toward the next bend, not straight at the stop", () => {
    // East 0.004 degrees, then north 0.004 degrees; the stop is at the top.
    const el: LinePoint[] = [[135, LAT], [135.002, LAT], [135.004, LAT], [135.004, LAT + 0.002], [135.004, LAT + 0.004]];
    const m = buildModel(el, [{ id: "top", lng: 135.004, lat: LAT + 0.004, radiusM: 30 }]);
    const s = applyFix(m, initialState(), at(135.0005), none);
    expect(s.mode).toBe("line");
    close(s.bearingDeg!, 90, 2); // east along the trail, though the stop is north-east
    close(s.distanceM!, 0.0035 * 91_700 + 0.004 * 111_200, 10);
  });

  test("one fix off the line is not 'off route' yet; three are, and one back on clears it", () => {
    const north = (lng: number) => at(lng, LAT + 0.0005); // ~55 m north
    let s = walk([at(135.0005), north(135.001), north(135.0012)]);
    expect(s.offRoute).toBe(false);
    expect(s.mode).toBe("line"); // still guided along the line until it is clear
    s = walk([north(135.0014)], none, s);
    expect(s.offRoute).toBe(true);
    expect(s.mode).toBe("straight");
    s = walk([at(135.0016)], none, s);
    expect(s.offRoute).toBe(false);
    expect(s.mode).toBe("line");
  });

  test("off route points back to the nearest line point, and stays off until clearly back (no flicker at 30 m)", () => {
    const at30 = (lng: number) => at(lng, LAT + 0.00027); // ~30 m north: inside 40 m but outside the 25 m return distance
    const north = (lng: number) => at(lng, LAT + 0.0005);
    let s = walk([at(135.0005), north(135.001), north(135.0012), north(135.0014)]);
    expect(s.offRoute).toBe(true);
    close(s.backM!, 55, 5);
    close(s.backBearingDeg!, 180, 3); // the line is due south of the visitor
    s = walk([at30(135.0016)], none, s);
    expect(s.offRoute).toBe(true); // 30 m: still warned
    s = walk([at(135.0018, LAT + 0.0001)], none, s); // ~11 m
    expect(s.offRoute).toBe(false);
    expect(s.backM).toBeNull();
  });
});

describe("off the course line", () => {
  const far = at(135.005, LAT + 0.005); // ~555 m north of the line

  test("without a path: points straight at the stop, and wants a path", () => {
    const s = walk([far]);
    expect(s.mode).toBe("straight");
    expect(s.offLineM!).toBeGreaterThan(500);
    expect(wantsPath(s)).toBe(true);
    close(s.distanceM!, s.straightM!, 0.001);
  });

  test("with a path from OpenRouteService for that stop: follows the path", () => {
    // A path from the visitor south-west to stop b.
    const pathLine: LinePoint[] = [[135.005, LAT + 0.005], [135.005, LAT + 0.0025], [135.006, LAT]];
    const path = { stopId: "b", ...trackOf(pathLine) };
    const s = applyFix(model, initialState(), far, none, path);
    expect(s.targetId).toBe("b");
    expect(s.mode).toBe("path");
    close(s.bearingDeg!, 180, 2); // due south along the path's first stretch
    expect(s.distanceM!).toBeGreaterThan(s.straightM!); // a path is never shorter than the straight line
    expect(wantsPath(s)).toBe(false); // on the path: no new request
  });

  test("strayed more than 40 m from the path: straight again, and wants a new path", () => {
    const pathLine: LinePoint[] = [[135.005, LAT + 0.005], [135.005, LAT + 0.0025], [135.006, LAT]];
    const path = { stopId: "b", ...trackOf(pathLine) };
    const near = applyFix(model, initialState(), at(135.0053, LAT + 0.004), none, path); // ~27 m east of it
    expect(near.mode).toBe("path");
    const strayed = applyFix(model, initialState(), at(135.0056, LAT + 0.004), none, path); // ~55 m east of it
    expect(strayed.mode).toBe("straight");
    expect(wantsPath(strayed)).toBe(true);
  });

  test("a jumpy fix near the edge does not flip the guidance; leaving needs more than 60 m", () => {
    const pathLine: LinePoint[] = [[135.005, LAT + 0.005], [135.005, LAT + 0.0025], [135.006, LAT]];
    const path = { stopId: "b", ...trackOf(pathLine) };
    const fix = (lng: number, prev: NavState) => applyFix(model, prev, at(lng, LAT + 0.004), none, path);
    let s = fix(135.005, initialState()); // on the path
    for (const lng of [135.00541, 135.00549, 135.00541]) s = fix(lng, s); // ~38, ~45, ~38 m
    expect(s.mode).toBe("path");
    expect(fix(135.0056, fix(135.00549, s)).mode).toBe("path"); // ~55 m: still on it
    expect(fix(135.0058, s).mode).toBe("straight"); // ~73 m: left it
  });

  test("a path for a different stop is ignored", () => {
    const path = { stopId: "c", ...trackOf([[135.005, LAT + 0.005], [135.01, LAT]] as LinePoint[]) };
    expect(applyFix(model, initialState(), far, none, path).mode).toBe("straight");
  });

  test("on the line no path is wanted, nor inside the radius", () => {
    expect(wantsPath(walk([at(135.001)]))).toBe(false);
    expect(wantsPath(walk([at(135.003, LAT + 0.0002)]))).toBe(false);
  });
});

describe("weak GPS", () => {
  test("a fix worse than the limit is ignored and counted; exactly the limit is used", () => {
    const first = walk([at(135.001)]);
    expect(applyFix(model, first, at(135.009, LAT, MAX_ACCURACY_M + 1), none)).toEqual({ ...first, ignoredFixes: 1 });
    expect(applyFix(model, first, at(135.002, LAT, MAX_ACCURACY_M), none).distanceM).not.toBe(first.distanceM);
  });

  test("a missing accuracy (NaN) is ignored, never trusted", () => {
    expect(applyFix(model, initialState(), { lat: LAT, lng: 135, accuracyM: Number.NaN }, none).ignoredFixes).toBe(1);
  });
});

describe("when the line cannot be used", () => {
  test("no line at all: straight to the nearest stop", () => {
    const m = buildModel([], stops);
    const s = applyFix(m, initialState(), at(135.001), none);
    expect(s.mode).toBe("straight");
    expect(s.offLineM).toBeNull();
    expect(s.targetId).toBe("a");
  });

  test("a stop far from the line is guided straight even while the visitor is on the line", () => {
    const m = buildModel(line, [{ id: "far", lng: 135.005, lat: LAT + 0.003, radiusM: 50 }]);
    const s = applyFix(m, initialState(), at(135.001), none);
    expect(s.mode).toBe("straight");
    expect(s.offRoute).toBe(false);
  });

  test("no stops: nothing to head for", () => {
    expect(applyFix(buildModel(line, []), initialState(), at(135.001), none).targetId).toBeNull();
  });
});

describe("a trail that doubles back", () => {
  test("the visitor's position stays on the pass they are walking, not the parallel one", () => {
    // Out east along LAT to 135.005, then back west 33 m north to 135.000; the stop is at the very end.
    const back: LinePoint[] = [[135, LAT], [135.005, LAT], [135.005, LAT + 0.0003], [135, LAT + 0.0003]];
    const m = buildModel(back, [{ id: "end", lng: 135, lat: LAT + 0.0003, radiusM: 20 }]);
    // Walking out: the end of the course is "behind" in a straight line, but far along the trail.
    let s = applyFix(m, initialState(), at(135.001), none);
    s = applyFix(m, s, at(135.002), none);
    expect(s.mode).toBe("line");
    expect(s.distanceM!).toBeGreaterThan(500); // out to the turn and back, not 30 m across
    close(s.bearingDeg!, 90, 2); // keep walking east
  });
});

describe("turns in the state", () => {
  test("on an L-shaped course the state says a left turn is coming, and how far", () => {
    const el: LinePoint[] = [[135, LAT], [135.002, LAT], [135.004, LAT], [135.004, LAT + 0.002], [135.004, LAT + 0.004]];
    const m = buildModel(el, [{ id: "top", lng: 135.004, lat: LAT + 0.004, radiusM: 30 }]);
    const s = applyFix(m, initialState(), at(135.0035), none);
    expect(s.mode).toBe("line");
    expect(s.turn!.kind).toBe("left");
    close(s.turn!.inM, 46, 15); // ~46 m to the corner
  });

  test("no turn on the straight course, and none when pointing straight off the line", () => {
    expect(walk([at(135.001)]).turn).toBeNull();
    expect(walk([at(135.005, LAT + 0.005)]).turn).toBeNull();
  });
});

describe("which way relative to the walking direction (no line to follow)", () => {
  const free = buildModel([], [{ id: "x", lng: 135.005, lat: LAT, radiusM: 20 }]); // a stop due east, no line

  test("before the direction of travel is known: no steer, just the compass direction", () => {
    const s = applyFix(free, initialState(), at(135.0), none);
    expect(s.steer).toBeNull();
    close(s.bearingDeg!, 90, 1);
  });

  test("walking east toward it: straight on; walking north: turn right; walking south: turn left; walking west: turn back", () => {
    const step = (headingDeg: number) => applyFix(free, initialState(), { ...at(135.0), headingDeg }, none).steer;
    expect(step(90)).toBe("straight");
    expect(step(0)).toBe("right");
    expect(step(180)).toBe("left");
    expect(step(270)).toBe("u-turn");
    expect(step(45)).toBe("slight-right");
  });

  test("the direction of travel is kept while the visitor stands still", () => {
    const moving = applyFix(free, initialState(), { ...at(135.0), headingDeg: 0 }, none);
    expect(applyFix(free, moving, at(135.0), none).steer).toBe("right");
  });

  test("movementHeading reads a direction only after moving 8 m", () => {
    expect(movementHeading(null, at(135))).toBeNull();
    expect(movementHeading(at(135), at(135.00005))).toBeNull(); // ~4.6 m
    close(movementHeading(at(135), at(135.0002))!, 90, 1); // ~18 m east
  });
});

describe("a stop the visitor chose", () => {
  test("it is the target even when another stop is nearer", () => {
    // Standing at a (135.003): a is the nearest, but c was chosen.
    expect(applyFix(model, initialState(), at(135.003), none).targetId).toBe("a");
    expect(applyFix(model, initialState(), at(135.003), none, null, "c").targetId).toBe("c");
  });

  test("it is ignored once stamped, when closed, or when unknown: the nearest takes over", () => {
    expect(applyFix(model, initialState(), at(135.003), new Set(["c"]), null, "c").targetId).toBe("a");
    const closed = buildModel(line, stops.map((s) => (s.id === "c" ? { ...s, status: "closed" as const } : s)));
    expect(applyFix(closed, initialState(), at(135.003), none, null, "c").targetId).toBe("a");
    expect(applyFix(model, initialState(), at(135.003), none, null, "nope").targetId).toBe("a");
  });
});

describe("isFar", () => {
  test("measured from the line when there is one, from the stops when there is not; the course's own distance counts", () => {
    expect(isFar(model, { lat: LAT, lng: 135.005 })).toBe(false);
    expect(isFar(model, { lat: LAT + 0.06, lng: 135.005 })).toBe(true); // ~6.7 km
    expect(isFar(buildModel(line, stops, 10_000), { lat: LAT + 0.06, lng: 135.005 })).toBe(false);
    expect(isFar(buildModel([], stops), { lat: LAT + 0.06, lng: 135.003 })).toBe(true);
    expect(isFar(buildModel([], stops), { lat: LAT + 0.01, lng: 135.003 })).toBe(false);
  });

  test("far visitors are not sent a foot path unless they chose to walk", () => {
    const s = walk([at(135.005, LAT + 0.06)]);
    expect(s.far).toBe(true);
    expect(s.mode).toBe("straight");
    expect(wantsPath(s)).toBe(false);
    expect(wantsPath(s, true)).toBe(true);
  });
});

describe("a stop walked past", () => {
  const two: NavStop[] = [
    { id: "a", lat: LAT, lng: 135.002, radiusM: 30 },
    { id: "b", lat: LAT, lng: 135.009, radiusM: 30 },
  ];
  const model = buildModel(line, two);
  const walk = (lngs: number[]) => lngs.reduce((s, lng) => applyFix(model, s, { lat: LAT, lng, accuracyM: 10 }, new Set()), initialState());

  test("walking on past a stop marks it passed; coming up to it does not", () => {
    expect(walk([135, 135.0012]).passed).toBe(false);
    const past = walk([135.0015, 135.0019, 135.0035]);
    expect(past.passed).toBe(true);
    expect(past.targetId).toBe("a");
  });

  test("standing at the stop, or never having come close, is not passing", () => {
    expect(walk([135.0019, 135.002]).passed).toBe(false);
    expect(walk([135.0055, 135.0056]).passed).toBe(false);
  });
});

describe("stops left behind", () => {
  const model = buildModel(line, [
    { id: "a", lat: LAT, lng: 135.002, radiusM: 30 },
    { id: "b", lat: LAT, lng: 135.004, radiusM: 30 },
    { id: "c", lat: LAT, lng: 135.0095, radiusM: 30 },
  ]);
  const at = (degrees: number) => degrees * 91_700;

  test("depends on which way the walker went past", () => {
    expect(stopsBehind(model, "b", at(0.0055))).toEqual(["a", "b"]);
    expect(stopsBehind(model, "b", at(0.0025))).toEqual(["b", "c"]);
  });
});
