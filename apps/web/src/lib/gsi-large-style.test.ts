import { expect, test } from "bun:test";
import { applyEditorStyle, modernValue, type StdLayer } from "./gsi-large-style";

const std = (layers: StdLayer[]) => ({ version: 8, layers });
const label = (extra: Partial<StdLayer> = {}): StdLayer => ({ id: "a", type: "symbol", "source-layer": "label", minzoom: 13, maxzoom: 14, filter: ["all", ["in", "ftCode", 100]], layout: { "text-size": 12 }, paint: { "text-color": "black" }, ...extra });
// An editor file with one item whose layer is shown from zoom 13 to 13 (the editor's last zoom counts, MapLibre's does not).
const editor = (draw: object, extra: object = {}) => ({
  list: [{ type: "directory", list: [{ type: "item", list: [{ minzoom: 13, maxzoom: 13, filter: ["all", ["in", "ftCode", 100]], type: "layer", list: [{ type: "symbol", "source-layer": "label", draw }] }], ...extra }] }],
});

test("sizes and colours from the editor replace GSI's on the same layer", () => {
  const { style, report } = applyEditorStyle(std([label()]), editor({ "text-size": 30, "text-color": "red", "icon-pitch-alignment": "viewport" }));
  expect(style.layers[0]?.layout?.["text-size"]).toBe(30);
  expect(style.layers[0]?.paint?.["text-color"]).toBe("red");
  expect(style.layers[0]?.layout?.["icon-pitch-alignment"]).toBeUndefined(); // only the listed settings are taken
  expect(report).toEqual({ layers: 1, applied: 1, ambiguous: 0, untouched: 0 });
});

test("a layer with another zoom range or filter is left as GSI draws it, and the input is not changed", () => {
  const input = std([label({ minzoom: 8 }), label({ filter: ["all", ["in", "ftCode", 200]] })]);
  const before = JSON.stringify(input);
  const { style, report } = applyEditorStyle(input, editor({ "text-size": 30 }));
  expect(style.layers.map((l) => l.layout?.["text-size"])).toEqual([12, 12]);
  expect(report.untouched).toBe(2);
  expect(JSON.stringify(input)).toBe(before);
});

test("the item's own filter counts too", () => {
  const { report } = applyEditorStyle(std([label({ filter: ["all", ["in", "ftCode", 100], ["==", "annoCtg", 662]] })]), editor({ "text-size": 30 }, { filter: ["all", ["==", "annoCtg", 662]] }));
  expect(report.applied).toBe(1);
});

test("two GSI layers that cannot be told apart are not guessed", () => {
  const { style, report } = applyEditorStyle(std([label(), label({ id: "b" })]), editor({ "text-size": 30 }));
  expect(style.layers.map((l) => l.layout?.["text-size"])).toEqual([12, 12]);
  expect(report.ambiguous).toBe(2);
});

test("the editor's zoom stops become an interpolation", () => {
  expect(modernValue({ stops: [[14, 20], [16, 44]] })).toEqual(["interpolate", ["linear"], ["zoom"], 14, 20, 16, 44]);
  expect(modernValue({ stops: [[17, 4.5]] })).toBe(4.5);
  expect(modernValue(8)).toBe(8);
  expect(modernValue(["get", "x"])).toEqual(["get", "x"]);
});
