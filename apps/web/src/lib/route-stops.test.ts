import { describe, expect, test } from "bun:test";
import type { RoutePoint, SpotListItem } from "./content";
import { journeyOf, trailStops } from "./route-stops";

const spot = (id: string, over: Partial<SpotListItem> = {}): SpotListItem => ({
  id, nameJa: id, nameEn: null, status: "open", stamped: null, position: { lat: 34.3, lng: 135.1, verified: true }, ...over,
});
const point = (id: string, over: Partial<RoutePoint> = {}): RoutePoint => ({
  id, kind: "toilet", nameJa: id, nameEn: null, descriptionJa: null, descriptionEn: null, position: { lat: 34.3, lng: 135.1, verified: true }, ...over,
});
const ids = (stops: ReturnType<typeof trailStops>) => stops.map((s) => (s.type === "stamp" ? s.spot.id : s.point.id));

describe("trailStops", () => {
  test("stamp places and other places come in one list, in the order of the walk", () => {
    const stops = trailStops({
      spots: [spot("a", { sortOrder: 1 }), spot("b", { sortOrder: 4 })],
      points: [point("wc", { sortOrder: 2 }), point("bus", { kind: "bus_stop", sortOrder: 5 })],
    });
    expect(ids(stops)).toEqual(["a", "wc", "b", "bus"]);
  });

  test("every place along the walk is numbered, with or without a stamp; a side trip has no number", () => {
    const stops = trailStops({
      spots: [spot("a", { sortOrder: 1 }), spot("b", { sortOrder: 4 }), spot("side", { sortOrder: 5, stopBy: true })],
      points: [point("wc", { sortOrder: 2 }), point("bus", { kind: "bus_stop", sortOrder: 6 }), point("view", { kind: "view", sortOrder: 7, stopBy: true })],
    });
    expect(stops.map((s) => [s.type === "stamp" ? s.spot.id : s.point.id, s.number])).toEqual([["a", 1], ["wc", 2], ["b", 3], ["side", null], ["bus", 4], ["view", null]]);
  });

  test("turns and dangers only guide the way, so they are not listed", () => {
    const stops = trailStops({ spots: [spot("a", { sortOrder: 1 })], points: [point("t", { kind: "turn", sortOrder: 2 }), point("d", { kind: "danger", sortOrder: 3 })] });
    expect(ids(stops)).toEqual(["a"]);
  });

  test("without an order, stamp places come first and the others follow", () => {
    expect(ids(trailStops({ spots: [spot("a"), spot("b")], points: [point("wc")] }))).toEqual(["a", "b", "wc"]);
  });
});

describe("journeyOf", () => {
  const far = { lat: 34.4, lng: 135.2, verified: true };
  const near = { lat: 34.3015, lng: 135.1, verified: true };
  const named = (j: ReturnType<typeof journeyOf>, which: "start" | "goal" | "turnaround") => {
    const stop = j?.[which];
    return stop ? (stop.type === "stamp" ? stop.spot.id : stop.point.id) : null;
  };

  test("with nothing saved, a goal far from the start is one-way", () => {
    const j = journeyOf(trailStops({ spots: [spot("a", { sortOrder: 1 }), spot("b", { sortOrder: 2, position: far })], points: [] }));
    expect(j?.style).toBe("one_way");
    expect([named(j, "start"), named(j, "goal")]).toEqual(["a", "b"]);
  });

  test("with nothing saved, a goal near the start is not guessed to be a loop or an out-and-back", () => {
    const j = journeyOf(trailStops({ spots: [spot("a", { sortOrder: 1 }), spot("b", { sortOrder: 2, position: near })], points: [] }));
    expect(j?.style).toBeNull();
  });

  test("what the admin saved wins over the distance", () => {
    const stops = trailStops({ spots: [spot("a", { sortOrder: 1 }), spot("b", { sortOrder: 2, position: far })], points: [] });
    expect(journeyOf(stops, "loop")?.style).toBe("loop");
    expect(journeyOf(stops, "one_way")?.style).toBe("one_way");
  });

  test("an out-and-back walk turns round at the place farthest from the start", () => {
    const stops = trailStops({
      spots: [spot("a", { sortOrder: 1 }), spot("mid", { sortOrder: 2, position: { lat: 34.35, lng: 135.1, verified: true } }), spot("top", { sortOrder: 3, position: far }), spot("back", { sortOrder: 4, position: near })],
      points: [],
    });
    const j = journeyOf(stops, "out_and_back");
    expect(named(j, "turnaround")).toBe("top");
    expect(named(journeyOf(stops, "loop"), "turnaround")).toBeNull();
  });

  test("a side trip is not the goal, and a single place has no goal", () => {
    const stops = trailStops({ spots: [spot("a", { sortOrder: 1 }), spot("b", { sortOrder: 2, position: far }), spot("side", { sortOrder: 3, stopBy: true })], points: [] });
    expect(named(journeyOf(stops), "goal")).toBe("b");
    expect(journeyOf(trailStops({ spots: [spot("a")], points: [] }))?.goal).toBeNull();
    expect(journeyOf([])).toBeNull();
  });

  test("a place without a position is never called far", () => {
    const j = journeyOf(trailStops({ spots: [spot("a", { sortOrder: 1 }), spot("b", { sortOrder: 2, position: null })], points: [] }));
    expect(j?.style).toBeNull();
  });
});
