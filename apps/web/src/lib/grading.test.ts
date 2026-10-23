import { describe, expect, test } from "bun:test";
import { courseConstant, isTechnicalLevel, physicalLevelOf, suggestPhysicalLevel } from "./grading";

describe("courseConstant", () => {
  test("1.8 per hour, 0.3 per km, 10 per km climbed and 0.6 per km descended", () => {
    expect(courseConstant({ hours: 1, km: 3, climbM: 300, descentM: 300 })).toBeCloseTo(1.8 + 0.9 + 3 + 0.18, 6);
    expect(courseConstant({ hours: 0, km: 0, climbM: 0, descentM: 0 })).toBe(0);
  });
});

describe("physicalLevelOf", () => {
  test("steps up through the ranges and stops at 10", () => {
    expect(physicalLevelOf(0)).toBe(1);
    expect(physicalLevelOf(10)).toBe(1);
    expect(physicalLevelOf(10.1)).toBe(2);
    expect(physicalLevelOf(90)).toBe(9);
    expect(physicalLevelOf(500)).toBe(10);
  });
});

describe("suggestPhysicalLevel", () => {
  test("needs a distance and a time; a missing climb counts as flat", () => {
    expect(suggestPhysicalLevel({ distanceKm: null, expectedTimeMin: 60, elevationGainM: 0, descentM: 0 })).toBeNull();
    expect(suggestPhysicalLevel({ distanceKm: 3, expectedTimeMin: null, elevationGainM: 0, descentM: 0 })).toBeNull();
    const s = suggestPhysicalLevel({ distanceKm: 6, expectedTimeMin: 120, elevationGainM: null, descentM: null });
    expect(s?.constant).toBeCloseTo(1.8 * 2 + 0.3 * 6, 6);
    expect(s?.level).toBe(1);
  });
});

test("isTechnicalLevel", () => {
  expect(isTechnicalLevel("C")).toBe(true);
  expect(isTechnicalLevel("F")).toBe(false);
  expect(isTechnicalLevel(null)).toBe(false);
});

import { climbM, descentM } from "./admin/line";

describe("descentM", () => {
  test("counts the way down like climbM counts the way up", () => {
    const up = [100, 150, 200, 250];
    expect(descentM(up)).toBe(0);
    expect(descentM([...up].reverse())).toBe(climbM(up));
    expect(descentM([100])).toBe(0);
  });
});
