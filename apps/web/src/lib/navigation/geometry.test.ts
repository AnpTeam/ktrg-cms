import { describe, expect, test } from "bun:test";
import { cumulativeDistances, cutLegs, distanceM, legProgress, nextTarget, offRouteStep, projectOnLine, type LinePoint, type Stop } from "./geometry";

// 0.001 degrees of longitude at latitude 34.5 is about 91.7 m, 0.001 of latitude about 111.2 m.
const LAT = 34.5;
const straight: LinePoint[] = Array.from({ length: 11 }, (_, i) => [135 + i * 0.001, LAT] as LinePoint); // 135.000 to 135.010
const stop = (id: string, lng: number, lat = LAT): Stop => ({ id, lng, lat });
const close = (a: number, b: number, tol = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("cumulativeDistances", () => {
  test("starts at 0, grows by each segment, and an empty or one-point line has no length", () => {
    const cum = cumulativeDistances(straight);
    expect(cum[0]).toBe(0);
    expect(cum).toHaveLength(11);
    close(cum[10]!, 917, 3);
    expect(cumulativeDistances([])).toEqual([0]);
    expect(cumulativeDistances([[135, LAT]])).toEqual([0]);
  });
});

describe("projectOnLine", () => {
  const cum = cumulativeDistances(straight);

  test("a point on the line: along is its distance from the start, off is about 0", () => {
    const p = projectOnLine(straight, cum, { lat: LAT, lng: 135.005 })!;
    close(p.alongM, 458.5, 2);
    close(p.offM, 0, 0.5);
  });

  test("a point beside the line is off by the sideways distance (0.0003 degrees of latitude is about 33 m)", () => {
    const p = projectOnLine(straight, cum, { lat: LAT + 0.0003, lng: 135.005 })!;
    close(p.offM, 33.4, 1);
    close(p.alongM, 458.5, 2);
  });

  test("before the start and after the end it sticks to the ends", () => {
    expect(projectOnLine(straight, cum, { lat: LAT, lng: 134.99 })!.alongM).toBe(0);
    close(projectOnLine(straight, cum, { lat: LAT, lng: 135.02 })!.alongM, cum[10]!, 0.001);
  });

  test("a point exactly on a vertex", () => {
    const p = projectOnLine(straight, cum, { lat: LAT, lng: 135.003 })!;
    close(p.alongM, cum[3]!, 0.5);
    close(p.offM, 0, 0.5);
  });

  test("a line with fewer than two points, or an empty window, gives null", () => {
    expect(projectOnLine([], [0], { lat: LAT, lng: 135 })).toBeNull();
    expect(projectOnLine([[135, LAT]], [0], { lat: LAT, lng: 135 })).toBeNull();
    expect(projectOnLine(straight, cum, { lat: LAT, lng: 135 }, { fromM: 5000, toM: 6000 })).toBeNull();
  });
});

describe("a bent line", () => {
  // East 0.005 degrees, then north 0.005 degrees: an L.
  const el: LinePoint[] = [[135, LAT], [135.005, LAT], [135.005, LAT + 0.005]];
  const cum = cumulativeDistances(el);

  test("distance follows the bend, not the straight line", () => {
    close(cum[2]!, 458.5 + 556, 4);
    const p = projectOnLine(el, cum, { lat: LAT + 0.0025, lng: 135.0051 })!;
    close(p.alongM, 458.5 + 278, 4);
    close(p.offM, 9, 1);
  });
});

describe("cutLegs", () => {
  const cum = cumulativeDistances(straight);

  test("one leg per stop; each leg starts where the one before ends, the first at the start of the line", () => {
    const legs = cutLegs(straight, cum, [stop("a", 135.003), stop("b", 135.006), stop("c", 135.01)]);
    expect(legs.map((l) => l.toStopId)).toEqual(["a", "b", "c"]);
    expect(legs[0]!.startM).toBe(0);
    close(legs[0]!.endM, cum[3]!, 0.5);
    expect(legs[1]!.startM).toBe(legs[0]!.endM);
    close(legs[2]!.endM, cum[10]!, 0.5);
    expect(legs.every((l) => l.reliable)).toBe(true);
  });

  test("a stop far from the line makes its leg unreliable", () => {
    const legs = cutLegs(straight, cum, [stop("a", 135.003), stop("far", 135.006, LAT + 0.002)]);
    expect(legs.map((l) => l.reliable)).toEqual([true, false]);
  });

  test("stops given in the wrong order are unreliable instead of silently wrong", () => {
    const legs = cutLegs(straight, cum, [stop("late", 135.008), stop("early", 135.002)]);
    expect(legs[0]!.reliable).toBe(true);
    expect(legs[1]!.reliable).toBe(false);
  });

  test("a route that doubles back puts the later stop on the way back, not on the way out", () => {
    // Out east along latitude LAT to 135.005, then back west along LAT + 0.0003 (about 33 m north) to 135.002.
    const out: LinePoint[] = [[135, LAT], [135.005, LAT], [135.005, LAT + 0.0003], [135.002, LAT + 0.0003]];
    const c = cumulativeDistances(out);
    // B is nearer the outward pass (13 m) than the return pass (20 m), but comes after A in the walk.
    const legs = cutLegs(out, c, [stop("A", 135.004), stop("B", 135.003, LAT + 0.00012)]);
    expect(legs[1]!.endM).toBeGreaterThan(legs[0]!.endM);
    close(legs[1]!.endM, c[3]! - 91.7, 5); // on the return pass, 135.003
    expect(legs.every((l) => l.reliable)).toBe(true);
  });

  test("an empty or one-point line gives unreliable legs, not a crash", () => {
    expect(cutLegs([], [0], [stop("a", 135)]).map((l) => l.reliable)).toEqual([false]);
    expect(cutLegs(straight, cum, [])).toEqual([]);
  });
});

describe("legProgress", () => {
  const cum = cumulativeDistances(straight);
  const legs = cutLegs(straight, cum, [stop("a", 135.003), stop("b", 135.006)]);

  test("halfway along the second leg", () => {
    const p = legProgress(straight, cum, legs[1]!, { lat: LAT, lng: 135.0045 })!;
    close(p.lengthM, 275, 3);
    close(p.alongLegM, 137.5, 3);
    close(p.remainingM, 137.5, 3);
    close(p.offM, 0, 0.5);
  });

  test("before the leg starts it reads 0 walked; past the stop it reads 0 left", () => {
    expect(legProgress(straight, cum, legs[1]!, { lat: LAT, lng: 135.001 })!.alongLegM).toBe(0);
    expect(legProgress(straight, cum, legs[1]!, { lat: LAT, lng: 135.009 })!.remainingM).toBe(0);
  });

  test("off the line is reported in metres", () => {
    close(legProgress(straight, cum, legs[0]!, { lat: LAT + 0.0005, lng: 135.001 })!.offM, 55.6, 1.5);
  });

  test("a line that cannot be used gives null", () => {
    expect(legProgress([], [0], { toStopId: "a", startM: 0, endM: 0, reliable: false }, { lat: LAT, lng: 135 })).toBeNull();
  });
});

describe("nextTarget", () => {
  const stops = [{ id: "a" }, { id: "b", status: "closed" as const }, { id: "c", status: "caution" as const }, { id: "d" }];

  test("the first stop not stamped and not closed; caution is still a target", () => {
    expect(nextTarget(stops, new Set())).toBe(0);
    expect(nextTarget(stops, new Set(["a"]))).toBe(2);
    expect(nextTarget(stops, new Set(["a", "c"]))).toBe(3);
  });

  test("null when everything is stamped or closed", () => {
    expect(nextTarget(stops, new Set(["a", "c", "d"]))).toBeNull();
    expect(nextTarget([], new Set())).toBeNull();
  });
});

describe("offRouteStep", () => {
  test("three fixes in a row beyond 40 m; one good fix resets the count", () => {
    let s = { count: 0, offRoute: false };
    for (const off of [50, 50]) s = offRouteStep(s.count, off);
    expect(s.offRoute).toBe(false);
    s = offRouteStep(s.count, 50);
    expect(s).toEqual({ count: 3, offRoute: true });
    s = offRouteStep(s.count, 10);
    expect(s).toEqual({ count: 0, offRoute: false });
  });

  test("exactly 40 m is still on route", () => {
    expect(offRouteStep(5, 40)).toEqual({ count: 0, offRoute: false });
  });
});

describe("distanceM", () => {
  test("matches the known length of a degree", () => {
    close(distanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 111_195, 10);
  });
});
