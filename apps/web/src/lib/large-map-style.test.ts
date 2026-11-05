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
  expect(style.layers.map((l) => l.id)).toEqual(["bg", "road", terrainLayerId, "name"]);
  expect(style.layers[2]?.layout?.visibility).toBe("none");
  expect(style.sprite).toBe("https://x.test/map-style/sprite/std");
  expect(style.sources["gsi-terrain"]).toBeDefined();
  expect(composeLargeStyle(base, { origin: "o", terrain: "hillshade", terrainOpacity: 0.5, terrainOn: true }).layers[2]?.layout?.visibility).toBe("visible");
});

test("only the 'large' base map is an address", () => {
  expect(typeof mapStyleSource({ ...defaultMapSettings, base: "pale" })).toBe("object");
  expect(mapStyleSource({ ...defaultMapSettings, base: "large", terrain: "relief", terrainOpacity: 0.3 })).toBe("/map-style/large?terrain=relief&opacity=0.3");
  expect(largeStyleUrl(defaultMapSettings, true)).toContain("on=1");
});
