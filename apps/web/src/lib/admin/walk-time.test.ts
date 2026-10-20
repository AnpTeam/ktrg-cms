import { describe, expect, test } from "bun:test";
import { categoryOfKind, isPointKind, pointKinds, stampableByDefault } from "../point-kinds";
import { estimateWalkMinutes } from "./walk-time";

describe("estimateWalkMinutes", () => {
  test("3 km/h on the flat, plus an hour per 600 m of climb, to the nearest 5 minutes", () => {
    expect(estimateWalkMinutes(9, null)).toBe(180);
    expect(estimateWalkMinutes(9, 0)).toBe(180);
    expect(estimateWalkMinutes(9, 600)).toBe(240);
    expect(estimateWalkMinutes(9.3, 379)).toBe(225); // 3.1 h + 0.63 h = 224 min, to the nearest 5
  });
  test("short and missing distances", () => {
    expect(estimateWalkMinutes(0.1, null)).toBe(5);
    expect(estimateWalkMinutes(null, 300)).toBeNull();
    expect(estimateWalkMinutes(0, 300)).toBeNull();
    expect(estimateWalkMinutes(Number.NaN, 300)).toBeNull();
  });
});

describe("point kinds", () => {
  test("kinds say what a waypoint is (stamping is a separate switch), and the map's own categories where they exist", () => {
    expect(pointKinds as readonly string[]).not.toContain("stamp");
    for (const k of ["temple", "mound", "view", "other"] as const) expect(stampableByDefault(k)).toBe(true);
    for (const k of ["turn", "danger", "toilet", "rest_area", "drinking_water", "vending_machine", "bus_stop", "station", "parking"] as const) expect(stampableByDefault(k)).toBe(false);
    expect(categoryOfKind("toilet")).toBe("toilet");
    expect(categoryOfKind("drinking_water")).toBe("drinking_water");
    expect(categoryOfKind("bus_stop")).toBe("bus_stop");
    for (const k of ["turn", "danger", "view", "other"] as const) expect(categoryOfKind(k)).toBe("other");
  });
  test("only the known kinds are accepted", () => {
    expect(isPointKind("turn")).toBe(true);
    expect(isPointKind("castle")).toBe(false);
    expect(isPointKind(undefined)).toBe(false);
  });
});
