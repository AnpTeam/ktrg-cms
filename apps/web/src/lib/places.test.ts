import { describe, expect, test } from "bun:test";
import {
  distanceLabel,
  distanceMeters,
  groupCounts,
  groupOf,
  placeCategories,
  placeGroups,
  sortByDistance,
} from "./places";

describe("groups", () => {
  test("every category belongs to a group", () => {
    for (const category of placeCategories) expect(placeGroups).toContain(groupOf(category));
  });

  test("toilets and rest come first, as the thing people look for most", () => {
    expect(placeGroups[0]).toBe("rest");
    expect(groupOf("toilet")).toBe("rest");
    expect(groupOf("vending_machine")).toBe("vending");
    expect(groupOf("bus_stop")).toBe("transport");
    expect(groupOf("cafe")).toBe("shops");
  });

  test("counts leave out empty groups", () => {
    expect(groupCounts([{ category: "toilet" }, { category: "rest_area" }, { category: "cafe" }])).toEqual({ rest: 2, shops: 1 });
    expect(groupCounts([])).toEqual({});
  });
});

describe("distance", () => {
  test("0.001 degree of latitude is about 111 metres", () => {
    const m = distanceMeters({ lat: 34.2, lng: 135.1 }, { lat: 34.201, lng: 135.1 });
    expect(m).toBeGreaterThan(110);
    expect(m).toBeLessThan(112);
  });

  test("the same point is zero away, and the order of the points does not matter", () => {
    const a = { lat: 34.25, lng: 135.11 };
    const b = { lat: 34.27, lng: 135.12 };
    expect(distanceMeters(a, a)).toBe(0);
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  test("labels are whole tens of metres, then tenths of a kilometre", () => {
    expect(distanceLabel(3)).toEqual({ amount: 10, unit: "m" });
    expect(distanceLabel(347)).toEqual({ amount: 350, unit: "m" });
    expect(distanceLabel(994)).toEqual({ amount: 990, unit: "m" });
    expect(distanceLabel(996)).toEqual({ amount: 1, unit: "km" });
    expect(distanceLabel(1240)).toEqual({ amount: 1.2, unit: "km" });
    expect(distanceLabel(12_340)).toEqual({ amount: 12.3, unit: "km" });
  });

  test("sorting puts the nearest first and keeps the other fields", () => {
    const from = { lat: 34.25, lng: 135.1 };
    const items = [
      { id: "far", position: { lat: 34.26, lng: 135.1 } },
      { id: "near", position: { lat: 34.2501, lng: 135.1 } },
      { id: "mid", position: { lat: 34.254, lng: 135.1 } },
    ];
    const sorted = sortByDistance(items, from);
    expect(sorted.map((s) => s.id)).toEqual(["near", "mid", "far"]);
    expect(sorted[0]!.meters).toBeLessThan(sorted[1]!.meters);
    expect(items[0]!.id).toBe("far"); // the input is not changed
  });
});
