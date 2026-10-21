import { describe, expect, test } from "bun:test";
import { defaultLayers, moundStops, offeredLayers } from "./map-layers";
import type { MapScreenRoute, MapScreenStop } from "./map-screen";

const stop = (id: string, kind?: MapScreenStop["kind"]): MapScreenStop => ({
  id,
  order: 1,
  name: id,
  nameLang: "ja",
  label: id,
  position: { lat: 34.4, lng: 135.5 },
  kind,
  stamped: null,
  status: "open",
  href: "/",
  description: null,
  statusNote: null,
  statusUpdatedAt: null,
  photo: null,
});

const route = (over: Partial<MapScreenRoute> = {}) => ({ id: "r", points: [], stops: null, ...over }) as unknown as MapScreenRoute;

describe("moundStops", () => {
  test("lists only the mounds, with their course", () => {
    const r = route({ stops: [stop("a", "mound"), stop("b", "temple"), stop("c")] });
    expect(moundStops([r, route()]).map((m) => [m.route, m.stop.id])).toEqual([[r, "a"]]);
  });
});

describe("offeredLayers", () => {
  test("offers only what there is to show", () => {
    expect(offeredLayers([route()])).toEqual(["courses"]);
    const withData = route({
      stops: [stop("a", "mound")],
      points: [
        { id: "p1", category: "toilet", name: "t", nameLang: "ja", position: { lat: 1, lng: 2 } },
        { id: "p2", category: "other", name: "o", nameLang: "ja", position: { lat: 1, lng: 2 } },
      ],
    });
    // "other" has no button; toilets belong to the "rest" group.
    expect(offeredLayers([withData])).toEqual(["courses", "mounds", "rest"]);
  });

  test("side trips get a button only when a course has one, and are not on at first", () => {
    const withSide = route({ sideLines: [[{ lat: 1, lng: 2 }, { lat: 1.1, lng: 2.1 }]] });
    expect(offeredLayers([withSide])).toEqual(["courses", "side"]);
    expect(defaultLayers.has("side")).toBe(false);
  });
});
