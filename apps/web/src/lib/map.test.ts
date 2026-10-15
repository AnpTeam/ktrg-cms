import { describe, expect, test } from "bun:test";
import {
  boundsOf,
  gsiAttribution,
  gsiTileListUrl,
  gsiTileUrl,
  lineFeature,
  mapStyle,
  markerKind,
  nextStopId,
  routeLineLayers,
  zoomLimits,
} from "./map";

describe("GSI tiles", () => {
  test("tile addresses come from the GSI host in the xyz pattern", () => {
    expect(gsiTileUrl("std")).toBe("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png");
    expect(gsiTileUrl("relief")).toBe("https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png");
  });

  test("the credit names GSI and links to the tile list, as the terms require", () => {
    expect(gsiAttribution).toContain("国土地理院");
    expect(gsiAttribution).toContain(gsiTileListUrl);
    expect(gsiAttribution).toContain('rel="noopener noreferrer"');
  });

  test("the style uses only the two GSI raster layers, with relief hidden at first", () => {
    const style = mapStyle();
    expect(Object.keys(style.sources)).toEqual(["gsi-std", "gsi-relief"]);
    for (const source of Object.values(style.sources)) {
      expect(source.type).toBe("raster");
      expect("tiles" in source && source.tiles?.every((t) => t.startsWith("https://cyberjapandata.gsi.go.jp/"))).toBe(true);
      expect("attribution" in source && source.attribution).toContain("国土地理院");
    }
    const relief = style.layers.find((l) => l.id === "gsi-relief");
    expect(relief?.layout?.visibility).toBe("none");
  });

  test("a background layer sits under the tiles so missing tiles are not holes", () => {
    const ids = mapStyle().layers.map((l) => l.id);
    expect(ids[0]).toBe("background");
    expect(ids.indexOf("background")).toBeLessThan(ids.indexOf("gsi-std"));
  });

  test("zoom limits match the real tile ranges", () => {
    expect(zoomLimits).toEqual({ min: 5, max: 18, reliefMax: 15 });
    const relief = mapStyle().sources["gsi-relief"];
    expect(relief && "maxzoom" in relief ? relief.maxzoom : undefined).toBe(15);
  });
});

describe("geometry", () => {
  const points = [
    { lat: 34.25, lng: 135.1 },
    { lat: 34.3, lng: 135.15 },
    { lat: 34.27, lng: 135.12 },
  ];

  test("bounds are [west, south] to [east, north] in lng, lat order", () => {
    expect(boundsOf(points)).toEqual([
      [135.1, 34.25],
      [135.15, 34.3],
    ]);
    expect(boundsOf([])).toBeNull();
  });

  test("the line is a GeoJSON LineString in lng, lat order", () => {
    const feature = lineFeature(points);
    expect(feature.geometry.type).toBe("LineString");
    expect(feature.geometry.coordinates[0]).toEqual([135.1, 34.25]);
    expect(feature.geometry.coordinates).toHaveLength(3);
  });

  test("an approximate line is dashed, a real path is solid", () => {
    const approx = routeLineLayers("route", true).find((l) => l.id === "route-line");
    const real = routeLineLayers("route", false).find((l) => l.id === "route-line");
    expect(approx?.paint && "line-dasharray" in approx.paint).toBe(true);
    expect(real?.paint && "line-dasharray" in real.paint).toBe(false);
    expect(routeLineLayers("route", true)[0]?.id).toBe("route-casing");
  });
});

describe("markers", () => {
  test("signed out is neutral; signed in is stamped, next or todo", () => {
    expect(markerKind(null, false)).toBe("neutral");
    expect(markerKind(true, false)).toBe("stamped");
    expect(markerKind(false, true)).toBe("next");
    expect(markerKind(false, false)).toBe("todo");
  });

  test("the next stop is the first one not stamped", () => {
    expect(nextStopId([{ id: "a", stamped: true }, { id: "b", stamped: false }, { id: "c", stamped: false }])).toBe("b");
  });

  test("there is no next stop when signed out or when all are stamped", () => {
    expect(nextStopId([{ id: "a", stamped: null }, { id: "b", stamped: null }])).toBeNull();
    expect(nextStopId([{ id: "a", stamped: true }])).toBeNull();
    expect(nextStopId([])).toBeNull();
  });
});
