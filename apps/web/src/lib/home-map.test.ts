import { describe, expect, test } from "bun:test";
import { areaCollection, circlePolygon, framePoints, nextSnap, sheetHeightPx, snapAfterDrag, type HomeRoute } from "./home-map";
import { distanceMeters } from "./places";

const route = (id: string, order: number, over: Partial<HomeRoute> = {}): HomeRoute => ({
  id,
  order,
  name: `route ${order}`,
  nameLang: "ja",
  prefecture: null,
  municipality: null,
  distanceKm: null,
  elevationGainM: null,
  expectedTimeMin: null,
  difficulty: null,
  status: "ready",
  spotCount: 0,
  stampedCount: null,
  area: { lat: 34.4, lng: 135.5, radiusM: 3000, verified: false },
  elevations: null,
  href: `/ja/routes/${id}`,
  stops: null,
  line: null,
  draft: false,
  ...over,
});

describe("circlePolygon", () => {
  const center = { lat: 34.4, lng: 135.5 };

  test("is a closed ring, every point the radius away from the centre", () => {
    const ring = circlePolygon(center, 3000, 24);
    expect(ring).toHaveLength(25);
    expect(ring[0]).toEqual(ring[24]!);
    for (const p of ring) expect(Math.abs(distanceMeters(center, p) - 3000)).toBeLessThan(15);
  });

  test("a bigger radius is a bigger ring", () => {
    const small = circlePolygon(center, 1000, 8).map((p) => distanceMeters(center, p));
    const big = circlePolygon(center, 4000, 8).map((p) => distanceMeters(center, p));
    expect(Math.min(...big)).toBeGreaterThan(Math.max(...small));
  });
});

describe("areaCollection", () => {
  const routes = [route("a", 1), route("b", 2), route("c", 3, { area: null })];

  test("overview: every course that has an area", () => {
    const fc = areaCollection(routes, null);
    expect(fc.features.map((f) => f.properties.id)).toEqual(["a", "b"]);
    expect(fc.features.every((f) => !f.properties.selected)).toBe(true);
  });

  test("a chosen course: only its own area stays, the others fold away", () => {
    const fc = areaCollection(routes, "b");
    expect(fc.features.map((f) => f.properties)).toEqual([{ id: "b", order: 2, selected: true }]);
  });

  test("a chosen course without an area draws nothing", () => {
    expect(areaCollection(routes, "c").features).toHaveLength(0);
  });
});

describe("framePoints", () => {
  test("uses the stops and the path when there are some", () => {
    const r = route("a", 1, {
      stops: [{ id: "s", order: 1, name: "s", nameLang: "ja", label: "1", position: { lat: 1, lng: 2 }, stamped: null, status: "open", href: "/", description: null, statusNote: null, statusUpdatedAt: null }],
      line: [{ lat: 3, lng: 4 }],
    });
    expect(framePoints(r)).toEqual([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
  });

  test("falls back to the area, and to nothing", () => {
    expect(framePoints(route("a", 1)).length).toBeGreaterThan(3);
    expect(framePoints(route("a", 1, { area: null }))).toEqual([]);
  });
});

describe("the bottom sheet", () => {
  const room = 600;

  test("heights grow from peek to full", () => {
    expect(sheetHeightPx("peek", room)).toBeLessThan(sheetHeightPx("half", room));
    expect(sheetHeightPx("half", room)).toBeLessThan(sheetHeightPx("full", room));
    expect(sheetHeightPx("full", room)).toBeLessThan(room);
  });

  test("a slow drag settles at the nearest resting place", () => {
    expect(snapAfterDrag(sheetHeightPx("half", room) + 20, 0, room, "peek")).toBe("half");
    expect(snapAfterDrag(sheetHeightPx("peek", room) + 10, 100, room, "half")).toBe("peek");
    expect(snapAfterDrag(room, 0, room, "half")).toBe("full");
  });

  test("a quick flick goes one step in its direction, never past the ends", () => {
    expect(snapAfterDrag(300, 900, room, "peek")).toBe("half");
    expect(snapAfterDrag(300, 900, room, "half")).toBe("full");
    expect(snapAfterDrag(300, 900, room, "full")).toBe("full");
    expect(snapAfterDrag(300, -900, room, "half")).toBe("peek");
    expect(snapAfterDrag(300, -900, room, "peek")).toBe("peek");
  });

  test("tapping the handle goes up, and back down after the top", () => {
    expect(nextSnap("peek")).toBe("half");
    expect(nextSnap("half")).toBe("full");
    expect(nextSnap("full")).toBe("peek");
  });
});
