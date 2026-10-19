import { describe, expect, test } from "bun:test";
import { filterRoutes, moveId, routeState } from "./route-list";

describe("routeState", () => {
  test("coming soon, draft, published", () => {
    expect(routeState({ spotCount: 0, publishedSpotCount: 0 })).toBe("soon");
    expect(routeState({ spotCount: 3, publishedSpotCount: 0 })).toBe("draft");
    expect(routeState({ spotCount: 3, publishedSpotCount: 1 })).toBe("published");
  });
});

describe("filterRoutes", () => {
  const routes = [
    { nameJa: "甲山から孝子越え", nameEn: "Koyama to Kyoshigoe", prefecture: "wakayama" as const },
    { nameJa: "葛城の道", nameEn: null, prefecture: "nara" as const },
    { nameJa: "二上山", nameEn: "Mount Nijo", prefecture: null },
  ];
  test("finds by either language, ignoring case and spaces around", () => {
    expect(filterRoutes(routes, " koyama ", null).map((r) => r.nameJa)).toEqual(["甲山から孝子越え"]);
    expect(filterRoutes(routes, "葛城", null)).toHaveLength(1);
  });
  test("narrows by prefecture, and an empty search keeps everything", () => {
    expect(filterRoutes(routes, "", "nara")).toHaveLength(1);
    expect(filterRoutes(routes, "", null)).toHaveLength(3);
    expect(filterRoutes(routes, "zzz", null)).toEqual([]);
  });
});

describe("moveId", () => {
  test("moves one step and stays put at the ends", () => {
    expect(moveId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b"], "zzz", 1)).toEqual(["a", "b"]);
  });
});
