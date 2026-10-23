import { describe, expect, test } from "bun:test";
import { areaCollection, areaContains, estimateGroupBox, estimateLabel, framePoints, groupLabelLines, MERGE_PX, namesThatFit, nextSnap, rectangleRing, revealedRouteId, SAME_PLACE_M, sheetHeightPx, snapAfterDrag, spreadLabels, spreadMeters, stopMergePx, type LabelBox, type MapScreenRoute } from "./map-screen";
import { distanceMeters } from "./places";

const route = (id: string, order: number, over: Partial<MapScreenRoute> = {}): MapScreenRoute => ({
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
  physicalLevel: null,
  technicalLevel: null,
  status: "ready",
  spotCount: 0,
  stampedCount: null,
  area: { lat: 34.4, lng: 135.5, widthM: 8000, heightM: 5000, verified: false },
  elevations: null,
  description: null,
  history: null,
  access: null,
  gallery: [],
  points: [],
  photo: null,
  spots: [],
  href: `/routes/${id}`,
  stops: null,
  line: null,
  hasLine: false,
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
  const stop = { id: "s", order: 1, name: "s", nameLang: "ja" as const, label: "1", position: { lat: 34.4, lng: 135.5 }, stamped: null, status: "open" as const, href: "/", description: null, statusNote: null, statusUpdatedAt: null, photo: null };
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
      stops: [{ id: "s", order: 1, name: "s", nameLang: "ja", label: "1", position: { lat: 1, lng: 2 }, stamped: null, status: "open", href: "/", description: null, statusNote: null, statusUpdatedAt: null, photo: null }],
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
  test("a long name takes more lines than a short one", () => {
    expect(estimateLabel("From Shino-toge Pass to Nakatsugawa and Kokawa-dera Temple").h).toBeGreaterThan(estimateLabel("Mount Kongo").h);
    expect(estimateLabel("Mount Kongo").w).toBeLessThanOrEqual(120);
  });

  test("a name with room is shown", () => {
    expect([...namesThatFit([{ id: "a", x: 200, y: 300, name: "Mount Kongo" }])]).toEqual(["a"]);
  });

  test("pins far apart all keep their names", () => {
    const pins = [
      { id: "a", x: 100, y: 300, name: "Mount Kongo" },
      { id: "b", x: 400, y: 300, name: "Mount Nijo" },
    ];
    expect(namesThatFit(pins).size).toBe(2);
  });

  test("when two names would collide, the earlier one wins and the other shows only its pin", () => {
    const pins = [
      { id: "a", x: 100, y: 300, name: "From Mt. Kabuto across Kyoshi-toge" },
      { id: "b", x: 60, y: 340, name: "From Nagaredani to Iwawaki-ji Temple" },
    ];
    expect([...namesThatFit(pins)]).toEqual(["a"]);
  });

  test("a name never covers another pin's head", () => {
    const pins = [
      { id: "a", x: 100, y: 300, name: "Mount Kongo" },
      { id: "b", x: 150, y: 300, name: "x" },
    ];
    expect(namesThatFit(pins).has("a")).toBe(false);
  });
});

describe("the bottom sheet", () => {
  const room = 600;

  test("heights grow from peek to full", () => {
    expect(sheetHeightPx("peek", room)).toBeLessThan(sheetHeightPx("half", room));
    expect(sheetHeightPx("half", room)).toBeLessThan(sheetHeightPx("full", room));
    expect(sheetHeightPx("full", room)).toBe(room); // the top resting place covers the whole page
  });

  test("stops merge only when asked: off, just pins on top of each other share one", () => {
    expect(stopMergePx(false)).toBeLessThan(8); // off: only pins right on top of each other share one
    expect(stopMergePx(true)).toBeGreaterThan(stopMergePx(false));
    expect(MERGE_PX.namedPin).toBeGreaterThan(MERGE_PX.pin);
    expect(MERGE_PX.pin).toBeGreaterThan(MERGE_PX.tag);
  });

  test("group labels are pushed apart and kept inside the visible area", () => {
    const area = { left: 0, top: 0, right: 400, bottom: 600 };
    const touching = [
      { id: "a", x: 200, y: 200, w: 176, h: 100 },
      { id: "b", x: 210, y: 220, w: 176, h: 100 },
    ];
    const [a, b] = spreadLabels(touching, area) as [LabelBox, LabelBox];
    const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 - 1 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2 - 1;
    expect(apart).toBe(true);
    // Far outside the area: pulled back in.
    const [c] = spreadLabels([{ id: "c", x: -500, y: 9000, w: 176, h: 100 }], area) as [LabelBox];
    expect(c.x).toBe(88);
    expect(c.y).toBe(550);
    // Too big for the area: pinned to the top-left corner, not thrown off screen.
    const [d] = spreadLabels([{ id: "d", x: 100, y: 100, w: 176, h: 900 }], area) as [LabelBox];
    expect(d.y - 450).toBe(0);
  });

  test("the estimated size of a group grows with its names", () => {
    expect(estimateGroupBox(["a", "b", "c"]).h).toBeLessThan(estimateGroupBox(["a", "b", "c", "d", "e", "f"]).h);
    expect(estimateGroupBox(["大福山から雲山峰を越えて長い名前の区間へ"]).h).toBeGreaterThan(estimateGroupBox(["大福山"]).h);
  });

  test("a merged group names its members, the first few and how many more", () => {
    expect(groupLabelLines(["a", "b"])).toEqual({ lines: ["a", "b"], more: 0 });
    const seven = ["a", "b", "c", "d", "e", "f", "g"];
    expect(groupLabelLines(seven).more).toBe(0); // room enough: every name
    const tight = groupLabelLines(seven, estimateGroupBox(seven.slice(0, 5)).h + 18);
    expect(tight.lines).toEqual(["a", "b", "c", "d", "e"]);
    expect(tight.more).toBe(2);
    expect(groupLabelLines(seven, 1).lines).toEqual(["a"]); // never fewer than one name
  });

  test("a slow drag settles at the nearest resting place", () => {
    expect(snapAfterDrag(sheetHeightPx("half", room) + 20, 0, room, "peek")).toBe("half");
    expect(snapAfterDrag(sheetHeightPx("peek", room) + 10, 100, room, "half")).toBe("peek");
    expect(snapAfterDrag(room, 0, room, "half")).toBe("full");
    expect(snapAfterDrag(20, 0, room, "peek")).toBe("hidden"); // pulled down to the bottom
    expect(sheetHeightPx("hidden", room)).toBe(0);
  });

  test("a quick flick goes one step in its direction, never past the ends", () => {
    expect(snapAfterDrag(300, 900, room, "peek")).toBe("half");
    expect(snapAfterDrag(300, 900, room, "half")).toBe("full");
    expect(snapAfterDrag(300, 900, room, "full")).toBe("full");
    expect(snapAfterDrag(300, -900, room, "half")).toBe("peek");
    expect(snapAfterDrag(300, -900, room, "peek")).toBe("hidden"); // a flick down from the lowest one hides the sheet
    expect(snapAfterDrag(0, -900, room, "hidden")).toBe("hidden");
  });

  test("tapping the handle goes up, and back down after the top", () => {
    expect(nextSnap("peek")).toBe("half");
    expect(nextSnap("hidden")).toBe("half");
    expect(nextSnap("half")).toBe("full");
    expect(nextSnap("full")).toBe("peek");
  });
});

describe("pins on the same spot", () => {
  test("pins within 30 m are chosen from a list; pins farther apart are pulled apart by zooming", () => {
    const station = { lat: 34.2808, lng: 135.0027 };
    const nextDoor = { lat: 34.28085, lng: 135.00275 }; // about 7 m away
    const farther = { lat: 34.2825, lng: 135.0027 }; // about 190 m away
    expect(spreadMeters([station, station])).toBe(0);
    expect(spreadMeters([station, nextDoor])).toBeLessThanOrEqual(SAME_PLACE_M);
    expect(spreadMeters([station, nextDoor, farther])).toBeGreaterThan(SAME_PLACE_M);
    expect(spreadMeters([])).toBe(0);
  });
});
