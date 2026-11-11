import { pickFeatured } from "./rally-model";
import { afterEach, describe, expect, test } from "bun:test";
import {
  areaFromBounds,
  fetchPublicRoutes,
  ralliesFromApi,
  isEmptyRoute,
  placeItemFromApi,
  routeDetailFromApi,
  routeSummaryFromApi,
  sketchFromPoints,
  spotDetailFromApi,
} from "./api-content";
import type { PublicRoute, PublicSpot } from "./api-content-types";

const route = (over: Partial<PublicRoute> = {}): PublicRoute => ({
  id: "r1", nameJa: "甲山から孝子越え", nameEn: null, descriptionJa: null, descriptionEn: null, distanceKm: 9.3, elevationGainM: 379,
  difficulty: null, nameKana: null, physicalLevel: null, technicalLevel: null, expectedTimeMin: null, prefecture: "wakayama", municipalities: ["和歌山市"], videoUrl: null, historyJa: null, historyEn: null, accessJa: null, accessEn: null, photoUrl: null, sortOrder: 2,
  status: "ready", publishedSpotCount: 2, sketch: [[135, 34], [135.01, 34.01]], line: null,
  bounds: { west: 135, south: 34, east: 135.1, north: 34.05 }, ...over,
});
const spot = (over: Partial<PublicSpot> = {}): PublicSpot => ({
  id: "s1", routeId: "r1", nameJa: "虎島の経塚", nameEn: null, descriptionJa: null, descriptionEn: null,
  position: { lat: 34.3, lng: 135.1, verified: true }, radiusM: 50, kind: "mound", stampable: true, photoUrl: null, status: "open", statusNoteJa: null, statusNoteEn: null,
  statusUpdatedAt: null, sortOrder: 1, ...over,
});

describe("a route answered before the cities list existed", () => {
  // The site keeps API answers for a while (revalidate), so right after a deploy a cached answer can lack the field.
  test("shows no cities instead of failing the page", () => {
    const old = route({ municipalities: undefined } as unknown as Partial<PublicRoute>);
    expect(routeSummaryFromApi(old, 1).municipalities).toEqual([]);
  });
});

describe("area from the line's box", () => {
  test("centre and size in metres, never smaller than a tappable shape", () => {
    const a = areaFromBounds({ west: 135, south: 34, east: 135.1, north: 34.05 })!;
    expect(a.lat).toBeCloseTo(34.025, 5);
    expect(a.lng).toBeCloseTo(135.05, 5);
    expect(a.heightM).toBeCloseTo(0.05 * 110_574, 0);
    expect(a.widthM).toBeGreaterThan(8000);
    expect(a.verified).toBe(true);
    const tiny = areaFromBounds({ west: 135, south: 34, east: 135.0001, north: 34.0001 })!;
    expect([tiny.widthM, tiny.heightM]).toEqual([1500, 1500]);
    expect(areaFromBounds(null)).toBeNull();
  });
});

describe("sketch", () => {
  test("north stays up, the box is 0..1 and elevations ride along only when every point has one", () => {
    const s = sketchFromPoints([[135, 34, 10], [135, 34.01, 50]])!;
    expect(s.points[0]![1]).toBeGreaterThan(s.points[1]![1]); // the northern point has the smaller y
    expect(s.elevations).toEqual([10, 50]);
    expect(sketchFromPoints([[135, 34, 10], [135, 34.01]])!.elevations).toBeUndefined();
    expect(sketchFromPoints([[135, 34]])).toBeNull();
  });
  test("at most 40 points", () => {
    const pts = Array.from({ length: 500 }, (_, i) => [135 + i * 1e-4, 34 + Math.sin(i / 20) * 1e-3] as [number, number]);
    expect(sketchFromPoints(pts)!.points.length).toBeLessThanOrEqual(40);
  });
});

describe("route and place view-models", () => {
  test("summary: order, count of published places, unknown prefecture becomes null", () => {
    const s = routeSummaryFromApi(route({ prefecture: "tokyo" }), 2);
    expect(s).toMatchObject({ order: 2, spotCount: 2, prefecture: null, status: "ready", stampedCount: 0 });
    expect(s.sketch?.points).toHaveLength(2);
  });
  test("detail: line and silhouette from the whole line, places mapped, position kept only when sent", () => {
    const d = routeDetailFromApi(
      route({ line: { type: "LineString", coordinates: [[135, 34, 5], [135.01, 34.01, 9]] } }),
      [spot(), spot({ id: "s2", position: null })],
      2,
    );
    expect(d.line).toEqual([{ lat: 34, lng: 135 }, { lat: 34.01, lng: 135.01 }]);
    expect(d.sketch?.elevations).toEqual([5, 9]);
    expect(d.spots.map((s) => s.position)).toEqual([{ lat: 34.3, lng: 135.1, verified: true }, null]);
  });
  test("a place carries its route's names", () => {
    expect(spotDetailFromApi(spot({ statusNoteJa: "崩落" }), { id: "r1", nameJa: "甲山", nameEn: "Koyama" })).toMatchObject({
      routeId: "r1", routeNameJa: "甲山", routeNameEn: "Koyama", statusNoteJa: "崩落",
    });
  });
  test("a course is empty until it has a line, a published place or text", () => {
    expect(isEmptyRoute({ bounds: null, publishedSpotCount: 0, descriptionJa: null })).toBe(true);
    expect(isEmptyRoute({ bounds: null, publishedSpotCount: 1, descriptionJa: null })).toBe(false);
    expect(isEmptyRoute({ bounds: null, publishedSpotCount: 0, descriptionJa: "説明" })).toBe(false);
  });
});

describe("fetching never throws", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  test("an unreachable API gives null, an error body gives null, a good body gives the routes", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await fetchPublicRoutes()).toBeNull();
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: "internal_error" }), { status: 500 })) as unknown as typeof fetch;
    expect(await fetchPublicRoutes()).toBeNull();
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, routes: [route()] }), { status: 200 })) as unknown as typeof fetch;
    expect((await fetchPublicRoutes())?.[0]?.id).toBe("r1");
  });
});

describe("the visitor's stamps in the view-models", () => {
  const spots = [spot({ id: "s1", sortOrder: 1 }), spot({ id: "s2", sortOrder: 2 }), spot({ id: "s3", sortOrder: 3 })];

  test("a course detail marks the stamped places and counts them; nothing is stamped by default", () => {
    const d = routeDetailFromApi(route(), spots, 2, [], new Set(["s1", "s3", "other-course"]));
    expect(d.spots.map((s) => s.stamped)).toEqual([true, false, true]);
    expect(d.stampedCount).toBe(2);
    const none = routeDetailFromApi(route(), spots, 2);
    expect(none.spots.every((s) => s.stamped === false)).toBe(true);
    expect(none.stampedCount).toBe(0);
  });

  test("a course summary takes its stamped count; a place detail takes its own flag", () => {
    expect(routeSummaryFromApi(route(), 2, 4).stampedCount).toBe(4);
    expect(routeSummaryFromApi(route(), 2).stampedCount).toBe(0);
    const r = { id: "r1", nameJa: "甲山", nameEn: null };
    expect(spotDetailFromApi(spot(), r, true).stamped).toBe(true);
    expect(spotDetailFromApi(spot(), r).stamped).toBe(false);
  });
});

describe("placeItemFromApi", () => {
  const place = { id: "p1", category: "toilet", routeId: "r1", nameJa: "トイレ", nameEn: null, descriptionJa: null, descriptionEn: null, hoursJa: null, hoursEn: null, closedDaysJa: null, closedDaysEn: null, lat: 34.2, lng: 135.1, addressJa: null, addressEn: null, phone: null, website: null, photoUrl: null, status: "open", lastVerified: "2026-10-17" };
  test("carries the course number and the checked position", () => {
    expect(placeItemFromApi(place, 3)).toMatchObject({ category: "toilet", routes: [3], position: { lat: 34.2, lng: 135.1, verified: true }, status: "open" });
    expect(placeItemFromApi(place, null).routes).toEqual([]);
  });
  test("a category or status this app does not know is read as other / unknown", () => {
    expect(placeItemFromApi({ ...place, category: "hot_spring", status: "weird" }, 1)).toMatchObject({ category: "other", status: "unknown" });
  });
});

describe("ralliesFromApi", () => {
  const places = { id: "r-p", kind: "places" as const, nameJa: "経塚", nameEn: "Mounds", sortOrder: 1, courses: [], places: [{ id: "s1", routeId: "c1", nameJa: "一", nameEn: null }, { id: "s2", routeId: "c1", nameJa: "二", nameEn: null }] };
  const courses = { id: "r-c", kind: "course" as const, nameJa: "全部", nameEn: null, sortOrder: 2, places: [], courses: [{ routeId: "c1", nameJa: "道1", nameEn: null, spots: [{ id: "s1", status: "open" }, { id: "s2", status: "open" }] }, { routeId: "c2", nameJa: "道2", nameEn: null, spots: [] }] };
  test("a rally of places has a slot for each place, stamped from the visitor's stamps", () => {
    const [r] = ralliesFromApi([places], new Set(["s2"]));
    expect(r).toMatchObject({ id: "r-p", kind: "rally", total: 2, stamped: 1 });
    expect(r!.slots.map((s) => [s.number, s.stamped])).toEqual([[1, false], [2, true]]);
  });
  test("a rally of courses has a slot for each course; one is stamped when all its places are, and a course with none never is", () => {
    const [r] = ralliesFromApi([courses], new Set(["s1", "s2"]));
    expect(r!.slots.map((s) => s.stamped)).toEqual([true, false]);
    expect(r!.stamped).toBe(1);
  });
  test("a rally's last stamp is the latest among its places (for a rally of courses, among its courses' places); none when nothing is stamped", () => {
    const at = new Map([["s1", "2026-11-01T00:00:00Z"], ["s2", "2026-11-03T00:00:00Z"], ["elsewhere", "2026-11-09T00:00:00Z"]]);
    expect(ralliesFromApi([places, courses], new Set(["s1", "s2"]), at).map((r) => r.lastStampedAt)).toEqual(["2026-11-03T00:00:00Z", "2026-11-03T00:00:00Z"]);
    expect(ralliesFromApi([places], new Set(), new Map())[0]!.lastStampedAt).toBeNull();
  });
  test("the rally stamped in most recently is the one featured, not the mound rally", () => {
    const other = { ...courses, id: "r-t", places: [], courses: [{ routeId: "c9", nameJa: "試し", nameEn: null, spots: [{ id: "t1", status: "open" as const }] }] };
    const list = ralliesFromApi([places, other], new Set(["t1"]), new Map([["t1", "2026-11-05T00:00:00Z"]]));
    expect(pickFeatured(list)?.id).toBe("r-t");
    expect(pickFeatured(ralliesFromApi([places, other], new Set(), new Map()))?.id).toBe("r-p"); // nothing stamped: the introduction
  });
  test("a closed place that nobody stamped counts as done, like on the server; an open one does not", () => {
    const closed = { ...courses, courses: [{ routeId: "c1", nameJa: "道1", nameEn: null, spots: [{ id: "s1", status: "open" }, { id: "s2", status: "closed" }] }] };
    expect(ralliesFromApi([closed], new Set(["s1"]))[0]!.slots[0]!.stamped).toBe(true);
    expect(ralliesFromApi([closed], new Set(["s2"]))[0]!.slots[0]!.stamped).toBe(false);
  });
});
