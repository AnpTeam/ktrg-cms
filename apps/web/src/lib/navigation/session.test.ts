import { describe, expect, test } from "bun:test";
import type { LinePoint } from "./geometry";
import { applyFix, buildModel, initialState, MAX_ACCURACY_M, type NavReading, type NavState, type NavStop } from "./session";

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

describe("a walk along the route, fix by fix", () => {
  const model = buildModel(line, stops);

  test("heads for the first stop, counts down to it, and offers the stamp inside the radius", () => {
    let s: NavState = initialState(model, none);
    expect(s.targetId).toBe("a");
    expect(s.distanceToTargetM).toBeNull();

    s = applyFix(model, s, at(135.0), none);
    expect(s.targetId).toBe("a");
    expect(s.distanceToTargetM).toBeGreaterThan(270);
    expect(s.distanceToTargetM).toBeLessThan(280);
    expect(s.inRadius).toBe(false);
    expect(s.leg!.alongLegM).toBeLessThan(1);
    expect(s.straightLineOnly).toBe(false);

    s = applyFix(model, s, at(135.0025), none); // ~46 m short of the stop
    expect(s.inRadius).toBe(true);
    expect(s.leg!.remainingM).toBeLessThan(50);
  });

  test("after the stamp the next fix heads for the next stop and measures its own leg", () => {
    let s = applyFix(model, initialState(model, none), at(135.003), none);
    const stamped = new Set(["a"]);
    s = applyFix(model, s, at(135.0035), stamped);
    expect(s.targetId).toBe("b");
    expect(s.leg!.lengthM).toBeGreaterThan(270);
    expect(s.leg!.alongLegM).toBeGreaterThan(40);
    expect(s.leg!.alongLegM).toBeLessThan(50);
  });

  test("everything stamped: no target, no distance", () => {
    const s = applyFix(model, initialState(model, none), at(135.01), new Set(["a", "b", "c"]));
    expect(s.targetId).toBeNull();
    expect(s.distanceToTargetM).toBeNull();
    expect(s.inRadius).toBe(false);
  });
});

describe("off route", () => {
  const model = buildModel(line, stops);
  const north = (lng: number) => at(lng, LAT + 0.0005); // about 55 m north of the line

  test("three fixes in a row beyond 40 m, and one fix back on the line clears it", () => {
    let s = initialState(model, none);
    s = applyFix(model, s, north(135.001), none);
    s = applyFix(model, s, north(135.0012), none);
    expect(s.offRoute).toBe(false);
    s = applyFix(model, s, north(135.0014), none);
    expect(s.offRoute).toBe(true);
    s = applyFix(model, s, at(135.0016), none);
    expect(s.offRoute).toBe(false);
    expect(s.offRouteCount).toBe(0);
  });

  test("a change of target restarts the count", () => {
    let s = initialState(model, none);
    s = applyFix(model, s, north(135.001), none);
    s = applyFix(model, s, north(135.0012), none);
    s = applyFix(model, s, north(135.0034), new Set(["a"])); // target is now b: 1 fix off, not 3
    expect(s.targetId).toBe("b");
    expect(s.offRoute).toBe(false);
    expect(s.offRouteCount).toBe(1);
  });
});

describe("poor accuracy", () => {
  const model = buildModel(line, stops);

  test("a fix worse than the limit is ignored and counted; exactly the limit is used", () => {
    const first = applyFix(model, initialState(model, none), at(135.001), none);
    const ignored = applyFix(model, first, at(135.009, LAT, MAX_ACCURACY_M + 1), none);
    expect(ignored).toEqual({ ...first, ignoredFixes: 1 });
    const used = applyFix(model, first, at(135.002, LAT, MAX_ACCURACY_M), none);
    expect(used.distanceToTargetM).not.toBe(first.distanceToTargetM);
    expect(used.ignoredFixes).toBe(0);
  });

  test("a missing accuracy (NaN) is ignored, never trusted", () => {
    const first = initialState(model, none);
    expect(applyFix(model, first, { lat: LAT, lng: 135, accuracyM: Number.NaN }, none).ignoredFixes).toBe(1);
  });
});

describe("when the line cannot be trusted", () => {
  test("a stop far from the line: straight-line distance only, and never 'off route'", () => {
    const model = buildModel(line, [{ id: "far", lng: 135.005, lat: LAT + 0.003, radiusM: 50 }]);
    const s = applyFix(model, initialState(model, none), at(135.001), none);
    expect(s.straightLineOnly).toBe(true);
    expect(s.leg).toBeNull();
    expect(s.offRoute).toBe(false);
    expect(s.distanceToTargetM).toBeGreaterThan(300);
  });

  test("a route with no line at all still gives the straight-line distance", () => {
    const model = buildModel([], stops);
    const s = applyFix(model, initialState(model, none), at(135.001), none);
    expect(s.straightLineOnly).toBe(true);
    expect(s.targetId).toBe("a");
    expect(s.distanceToTargetM).toBeGreaterThan(150);
  });

  test("a route with no stops has nothing to head for", () => {
    const model = buildModel(line, []);
    const s = applyFix(model, initialState(model, none), at(135.001), none);
    expect(s.targetId).toBeNull();
  });
});

describe("a closed stop in between", () => {
  test("it is skipped as a target, and the leg to the next one starts at the last STAMPED stop", () => {
    const withClosed = stops.map((s) => (s.id === "b" ? { ...s, status: "closed" as const } : s));
    const model = buildModel(line, withClosed);
    const stamped = new Set(["a"]);
    // The visitor is between a and b (b is closed): the target is c and the leg to c starts at a, so not off route.
    const s = applyFix(model, initialState(model, stamped), at(135.0045), stamped);
    expect(s.targetId).toBe("c");
    expect(s.offRoute).toBe(false);
    expect(s.leg!.offM).toBeLessThan(1);
    expect(s.leg!.lengthM).toBeGreaterThan(600); // from a (~275 m) to c (~917 m)
  });
});
