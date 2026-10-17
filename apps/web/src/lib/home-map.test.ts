import { describe, expect, test } from "bun:test";
import { areaCollection, areaContains, estimateLabel, framePoints, namesThatFit, nextSnap, rectangleRing, revealedRouteId, sheetHeightPx, snapAfterDrag, type HomeRoute } from "./home-map";
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
  area: { lat: 34.4, lng: 135.5, widthM: 8000, heightM: 5000, verified: false },
  elevations: null,
  href: `/ja/routes/${id}`,
  stops: null,
  line: null,
  draft: false,
  ...over,
});

describe("rectangleRing", () => {
  const area = { lat: 34.4, lng: 135.5, widthM: 8000, heightM: 5000, verified: false };

  test("is a closed box with the size asked for", () => {
    const ring = rectangleRing(area);
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]!);
    const [sw, se, ne] = [ring[0]!, ring[1]!, ring[2]!];
    expect(Math.abs(distanceMeters(sw, se) - 8000)).toBeLessThan(30);
    expect(Math.abs(distanceMeters(se, ne) - 5000)).toBeLessThan(30);
  });

  test("contains its centre and not a point beyond its edge", () => {
    expect(areaContains(area, { lat: 34.4, lng: 135.5 })).toBe(true);
    expect(areaContains(area, { lat: 34.4, lng: 135.58 })).toBe(false);
    expect(areaContains(area, { lat: 34.46, lng: 135.5 })).toBe(false);
  });
});

describe("revealedRouteId", () => {
  const stop = { id: "s", order: 1, name: "s", nameLang: "ja" as const, label: "1", position: { lat: 34.4, lng: 135.5 }, stamped: null, status: "open" as const, href: "/", description: null, statusNote: null, statusUpdatedAt: null };
  const withStops = (id: string, order: number, lat: number) => route(id, order, { area: { lat, lng: 135.5, widthM: 8000, heightM: 8000, verified: false }, stops: [stop] });
  const routes = [withStops("a", 1, 34.4), withStops("b", 2, 34.43), route("c", 3)];

  test("nothing opens while the map is zoomed out", () => {
    expect(revealedRouteId(routes, { lat: 34.4, lng: 135.5 }, 9, 11)).toBeNull();
  });

  test("zoomed in over a course with stops, that course opens", () => {
    expect(revealedRouteId(routes, { lat: 34.39, lng: 135.5 }, 12, 11)).toBe("a");
  });

  test("where two overlap, the nearer centre wins", () => {
    expect(revealedRouteId(routes, { lat: 34.425, lng: 135.5 }, 12, 11)).toBe("b");
  });

  test("a course with an area but no stops is shown on its own too", () => {
    expect(revealedRouteId([route("c", 3)], { lat: 34.4, lng: 135.5 }, 13, 11)).toBe("c");
  });

  test("empty ground, and a course with no area, never open", () => {
    expect(revealedRouteId(routes, { lat: 35.5, lng: 135.5 }, 13, 11)).toBeNull();
    expect(revealedRouteId([route("d", 4, { area: null })], { lat: 34.4, lng: 135.5 }, 13, 11)).toBeNull();
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

describe("names beside the pins", () => {
  test("a long Japanese name folds into more columns; a short one stays in one", () => {
    expect(estimateLabel("金剛山", true).w).toBeLessThan(estimateLabel("志野峠から中津川・粉河寺へ", true).w);
    expect(estimateLabel("志野峠から中津川・粉河寺へ", true).h).toBeLessThanOrEqual(136);
  });

  test("a long English name takes more lines", () => {
    expect(estimateLabel("From Shino-toge Pass to Nakatsugawa and Kokawa-dera Temple", false).h).toBeGreaterThan(estimateLabel("Mount Kongo", false).h);
  });

  test("a name with room is shown", () => {
    expect([...namesThatFit([{ id: "a", x: 200, y: 300, name: "金剛山", vertical: true }])]).toEqual(["a"]);
  });

  test("pins far apart all keep their names", () => {
    const pins = [
      { id: "a", x: 100, y: 300, name: "金剛山", vertical: true },
      { id: "b", x: 300, y: 300, name: "二上山", vertical: true },
    ];
    expect(namesThatFit(pins).size).toBe(2);
  });

  test("when two names would collide, the earlier one wins and the other shows only its pin", () => {
    const pins = [
      { id: "a", x: 100, y: 300, name: "葛城の道・長い名前の区間", vertical: true },
      { id: "b", x: 60, y: 380, name: "金剛山と葛城の道旅", vertical: true },
    ];
    expect([...namesThatFit(pins)]).toEqual(["a"]);
  });

  test("a name never covers another pin's head", () => {
    const pins = [
      { id: "a", x: 100, y: 300, name: "葛城の道", vertical: true },
      { id: "b", x: 140, y: 330, name: "x", vertical: true },
    ];
    expect(namesThatFit(pins).has("a")).toBe(false);
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
