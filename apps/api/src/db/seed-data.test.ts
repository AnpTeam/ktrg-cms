import { describe, expect, test } from "bun:test";
import { SEED_ROUTES, SEED_SPOT_COUNT, seedSpots } from "./seed-data";

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

  test("28 placeholder spots with unique, ordered names", () => {
    const spots = seedSpots();
    expect(SEED_SPOT_COUNT).toBe(28);
    expect(spots).toHaveLength(28);
    expect(spots.map((s) => s.sortOrder)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(new Set(spots.map((s) => s.nameJa)).size).toBe(28);
    expect(spots[0]!.nameJa).toBe("スポット01（仮）");
    expect(spots[27]!.nameEn).toBe("Spot 28 (placeholder)");
  });

  test("no coordinates are ever invented, and nothing is published", () => {
    for (const s of seedSpots()) {
      expect(Object.keys(s).sort()).toEqual(["nameEn", "nameJa", "sortOrder"]); // no lat, lng, published...
    }
  });
});
