import { describe, expect, test } from "bun:test";
import { SEED_ROUTES, SEED_SPOT_COUNT, SEED_SPOTS, seedSpots } from "./seed-data";

describe("seed data", () => {
  test("19 routes, each with a Japanese and an English name", () => {
    expect(SEED_ROUTES).toHaveLength(19);
    for (const r of SEED_ROUTES) {
      expect(r.nameJa.trim()).not.toBe("");
      expect(r.nameEn.trim()).not.toBe("");
    }
  });

  test("route names are unique", () => {
    expect(new Set(SEED_ROUTES.map((r) => r.nameJa)).size).toBe(19);
    expect(new Set(SEED_ROUTES.map((r) => r.nameEn)).size).toBe(19);
  });

  test("the English names have no leftover typos from the workbook", () => {
    expect(SEED_ROUTES.map((r) => r.nameEn).join(" ")).not.toMatch(/\bFron\b/);
  });

  test("31 sutra mounds: numbers 1 to 28, with 3, 14 and 28 at two places each", () => {
    expect(SEED_SPOT_COUNT).toBe(31);
    expect(SEED_SPOTS).toHaveLength(31);
    const places = new Map<number, number>();
    for (const s of SEED_SPOTS) places.set(s.mound, (places.get(s.mound) ?? 0) + 1);
    expect([...places.keys()].sort((x, y) => x - y)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect([...places].filter(([, n]) => n === 2).map(([m]) => m)).toEqual([3, 14, 28]);
    expect([...places].filter(([, n]) => n > 2)).toEqual([]);
  });

  test("every mound has a unique Japanese name and sits on a real course", () => {
    expect(new Set(SEED_SPOTS.map((s) => s.nameJa)).size).toBe(31);
    for (const s of SEED_SPOTS) {
      expect(s.nameJa.trim()).not.toBe("");
      expect(s.nameEn.trim()).not.toBe("");
      expect(s.routeNumber).toBeGreaterThanOrEqual(1);
      expect(s.routeNumber).toBeLessThanOrEqual(19);
    }
  });

  test("the courses hold the mounds the manager's sheet gives them (course 3 has none)", () => {
    const byCourse = new Map<number, number[]>();
    for (const s of SEED_SPOTS) byCourse.set(s.routeNumber, [...(byCourse.get(s.routeNumber) ?? []), s.mound]);
    expect(Object.fromEntries(byCourse)).toEqual({
      1: [1], 2: [2], 4: [3, 3], 5: [4], 6: [5], 7: [6, 7], 8: [8], 9: [9, 10], 10: [11], 11: [12, 13, 14],
      12: [14], 13: [15, 16, 17], 14: [18, 19], 15: [20, 21], 16: [22, 23], 17: [24, 25], 18: [26, 27], 19: [28, 28],
    });
    expect(byCourse.has(3)).toBe(false);
  });

  test("the order inside a course counts up from 1, and the seed gets the same 31 spots", () => {
    for (const course of new Set(SEED_SPOTS.map((s) => s.routeNumber))) {
      const orders = SEED_SPOTS.filter((s) => s.routeNumber === course).map((s) => s.sortOrder);
      expect(orders).toEqual(orders.map((_, i) => i + 1));
    }
    expect(seedSpots()).toHaveLength(31);
  });

  test("no coordinates are ever invented, and nothing is published", () => {
    for (const s of seedSpots()) {
      expect(Object.keys(s).sort()).toEqual(["nameEn", "nameJa", "routeNumber", "sortOrder"]); // no lat, lng, published...
    }
  });
});
