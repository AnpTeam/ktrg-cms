import { describe, expect, test } from "bun:test";
import {
  boundsOf,
  englishMaxZoom,
  gsiAttribution,
  gsiTileListUrl,
  gsiTileUrl,
  lineFeature,
  mapStyle,
  markerKind,
  nextStopId,
  pinScale,
  routeLineLayers,
  sideLineCollection,
  sideLineLayers,
  terrainLayerId,
  zoomLimits,
} from "./map";
import { defaultMapSettings } from "./map-settings";

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

  test("the style uses only GSI raster layers, with the terrain overlay hidden at first", () => {
    const style = mapStyle();
    expect(Object.keys(style.sources)).toEqual(["gsi-base", "gsi-terrain"]);
    for (const source of Object.values(style.sources)) {
      expect(source.type).toBe("raster");
      expect("tiles" in source && source.tiles?.every((t) => t.startsWith("https://cyberjapandata.gsi.go.jp/"))).toBe(true);
      expect("attribution" in source && source.attribution).toContain("国土地理院");
    }
    expect(style.layers.find((l) => l.id === terrainLayerId)?.layout?.visibility).toBe("none");
  });

  test("a background layer sits under the tiles so missing tiles are not holes", () => {
    const ids = mapStyle().layers.map((l) => l.id);
    expect(ids[0]).toBe("background");
    expect(ids.indexOf("background")).toBeLessThan(ids.indexOf("gsi-base"));
  });

  test("the settings choose the tiles: base map, terrain kind, strength", () => {
    const plain = mapStyle({ base: "pale", terrain: "relief", terrainOpacity: 0.3, saturation: 0, contrast: 0, dark: "none", labelScale: 1, iconScale: 1, lineScale: 1 });
    const base = plain.sources["gsi-base"];
    const terrain = plain.sources["gsi-terrain"];
    expect(base && "tiles" in base ? base.tiles?.[0] : "").toContain("/pale/");
    expect(terrain && "tiles" in terrain ? terrain.tiles?.[0] : "").toContain("/relief/");
    expect(terrain && "maxzoom" in terrain ? terrain.maxzoom : 0).toBe(15);
    expect(plain.layers.find((l) => l.id === terrainLayerId)?.paint).toEqual({ "raster-opacity": 0.3 });

    const hill = mapStyle({ ...defaultMapSettings, base: "std" });
    const hillTerrain = hill.sources["gsi-terrain"];
    expect(hillTerrain && "tiles" in hillTerrain ? hillTerrain.tiles?.[0] : "").toContain("/hillshademap/");
    expect(hillTerrain && "maxzoom" in hillTerrain ? hillTerrain.maxzoom : 0).toBe(16);
  });

  test("the other base maps and the calming settings reach the style", () => {
    const photo = mapStyle({ ...defaultMapSettings, base: "photo" });
    const photoBase = photo.sources["gsi-base"];
    expect(photoBase && "tiles" in photoBase ? photoBase.tiles?.[0] : "").toBe("https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg");
    const blank = mapStyle({ ...defaultMapSettings, base: "blank" }).sources["gsi-base"];
    expect(blank && "maxzoom" in blank ? blank.maxzoom : 0).toBe(14);
    expect(mapStyle(defaultMapSettings).layers.find((l) => l.id === "gsi-base")?.paint).toEqual({});
    const calm = mapStyle({ ...defaultMapSettings, saturation: -0.4, contrast: -0.1 });
    expect(calm.layers.find((l) => l.id === "gsi-base")?.paint).toEqual({ "raster-saturation": -0.4, "raster-contrast": -0.1 });
  });

  test("zoom limits match the real tile ranges", () => {
    expect(zoomLimits).toEqual({ min: 5, max: 18, reliefMax: 15, hillshadeMax: 16 });
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

describe("editor base maps", () => {
  test("every choice has a hidden layer in the style, and only the chosen one shows", async () => {
    const { editorBaseLayerIds, editorBaseVisibility, editorBases, editorStyle } = await import("./map");
    const ids = editorStyle().layers.map((l) => l.id);
    for (const b of editorBases) expect(ids).toContain(editorBaseLayerIds[b]);
    // The terrain overlay stays on top of whichever base is chosen.
    expect(ids.indexOf("gsi-terrain")).toBeGreaterThan(ids.indexOf("base-topo"));
    expect(Object.values(editorBaseVisibility("topo")).filter((v) => v === "visible")).toHaveLength(1);
    expect(editorBaseVisibility("topo")["base-topo"]).toBe("visible");
    expect(editorBaseVisibility("std")["gsi-base"]).toBe("visible");
  });
});

describe("side trips and pin size", () => {
  const width = (layer: { paint?: unknown } | undefined) => (layer!.paint as { "line-width": number })["line-width"];

  test("a side trip is a thinner dashed blue line than the route's own", () => {
    const [casing, line] = sideLineLayers("side");
    expect(line!.paint).toMatchObject({ "line-color": "#1d4ed8", "line-dasharray": [2, 1.5] });
    const main = routeLineLayers("route", false);
    expect(width(line)).toBeLessThan(width(main[1]));
    expect(width(casing)).toBeLessThan(width(main[0]));
  });

  test("a side trip with fewer than two points is not drawn", () => {
    expect(sideLineCollection([[{ lat: 34, lng: 135 }], [{ lat: 34, lng: 135 }, { lat: 34.01, lng: 135.01 }]]).features).toHaveLength(1);
  });

  test("pins shrink as the map zooms out, never below just over half, and are full size when walking", () => {
    expect(pinScale(17)).toBe(1);
    expect(pinScale(15)).toBe(1);
    expect(pinScale(13)).toBeGreaterThan(pinScale(11));
    expect(pinScale(5)).toBe(0.8);
  });
});

test("the English map lies over the standard map, up to GSI's last English zoom", () => {
  const ids = (s: ReturnType<typeof mapStyle>) => s.layers.map((l) => l.id);
  const en = mapStyle({ ...defaultMapSettings, base: "std" }, "en");
  expect(ids(en).indexOf("gsi-english")).toBe(ids(en).indexOf("gsi-base") + 1);
  expect(en.layers.find((l) => l.id === "gsi-english")?.maxzoom).toBe(englishMaxZoom + 1);
  expect(ids(mapStyle({ ...defaultMapSettings, base: "std" }, "ja"))).not.toContain("gsi-english");
  expect(ids(mapStyle({ ...defaultMapSettings, base: "photo" }, "en"))).not.toContain("gsi-english");
});
