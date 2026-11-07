import { expect, test } from "bun:test";
import type { StyleSpecification } from "maplibre-gl";
import { composeLargeStyle, largeStyleUrl, mapStyleSource } from "./large-map-style";
import { defaultMapSettings } from "./map-settings";
import { terrainLayerId } from "./map";

const base = {
  version: 8,
  sources: { v: { type: "vector", tiles: ["t"] } },
  layers: [
    { id: "bg", type: "background" },
    { id: "road", type: "line", source: "v", "source-layer": "road" },
    { id: "name", type: "symbol", source: "v", "source-layer": "label" },
  ],
} as unknown as StyleSpecification;

test("the terrain overlay goes under the first label, hidden unless asked for, and the sprite is ours", () => {
  const style = composeLargeStyle(base, { origin: "https://x.test", terrain: "relief", terrainOpacity: 0.4, terrainOn: false });
  expect(style.layers.map((l) => l.id)).toEqual(["land", "bg", "road", terrainLayerId, "name"]);
  expect(style.layers[3]?.layout?.visibility).toBe("none");
  expect(style.sprite).toBe("https://x.test/map-style/sprite/std");
  expect(style.sources["gsi-terrain"]).toBeDefined();
  expect(composeLargeStyle(base, { origin: "o", terrain: "hillshade", terrainOpacity: 0.5, terrainOn: true }).layers[3]?.layout?.visibility).toBe("visible");
});

test("the map paints its own land, in a fixed colour, so the page and its theme never show through", () => {
  const style = composeLargeStyle({ ...base, layers: base.layers.filter((l) => l.type !== "background") }, { origin: "o", terrain: "hillshade", terrainOpacity: 0.5, terrainOn: false });
  expect(style.layers[0]).toEqual({ id: "land", type: "background", paint: { "background-color": "#fcfaf5" } });
});

test("only the 'large' base map is an address", () => {
  expect(typeof mapStyleSource({ ...defaultMapSettings, base: "pale" })).toBe("object");
  expect(mapStyleSource({ ...defaultMapSettings, base: "large", terrain: "relief", terrainOpacity: 0.3 })).toBe("/map-style/large?terrain=relief&opacity=0.3");
  expect(largeStyleUrl(defaultMapSettings, true)).toContain("on=1");
});

import { scaleLayers, scaleSize } from "./large-map-style";
import { sanitizeMapSettings } from "./map-settings";
import type { LayerSpecification } from "maplibre-gl";

test("a size is scaled where it stands: numbers, zoom outputs, old stops; other expressions are wrapped", () => {
  expect(scaleSize(10, 1.5)).toBe(15);
  expect(scaleSize(["interpolate", ["linear"], ["zoom"], 12, 8, 17, 20], 2)).toEqual(["interpolate", ["linear"], ["zoom"], 12, 16, 17, 40]);
  expect(scaleSize(["step", ["zoom"], 10, 14, 20], 2)).toEqual(["step", ["zoom"], 20, 14, 40]);
  expect(scaleSize({ stops: [[14, 12], [16, 24]] }, 0.5)).toEqual({ stops: [[14, 6], [16, 12]] });
  expect(scaleSize(["get", "size"], 2)).toEqual(["*", 2, ["get", "size"]]);
});

test("names, icons and lines scale on their own, and a scale of 1 changes nothing", () => {
  const layers = [
    { id: "n", type: "symbol", source: "v", layout: { "text-size": 10, "icon-size": 1 } },
    { id: "r", type: "line", source: "v", paint: { "line-width": 2 } },
    { id: "f", type: "fill", source: "v", paint: { "fill-color": "red" } },
  ] as unknown as LayerSpecification[];
  expect(scaleLayers(layers, 1, 1, 1)).toEqual(layers);
  const big = scaleLayers(layers, 2, 1.5, 3);
  expect(big[0]?.layout).toMatchObject({ "text-size": 20, "icon-size": 1.5 });
  expect(big[1]?.paint).toMatchObject({ "line-width": 6 });
  expect(big[2]).toEqual(layers[2]);
});

test("the sizes travel in the address only when they differ, and are kept in range when read", () => {
  expect(largeStyleUrl({ ...defaultMapSettings, labelScale: 1.4, lineScale: 1.2 })).toBe("/map-style/large?terrain=hillshade&opacity=0.5&ls=1.4&ws=1.2");
  expect(sanitizeMapSettings({ labelScale: 9, iconScale: 0.1, lineScale: "x" })).toMatchObject({ labelScale: 2, iconScale: 0.8, lineScale: 1 });
});
