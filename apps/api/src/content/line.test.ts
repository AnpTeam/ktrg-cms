import { describe, expect, test } from "bun:test";
import { lineLengthKm, parseLine, ridesOf, sketchOf, simplifyLine, type LineString } from "./line";

const line = (coordinates: LineString["coordinates"]): LineString => ({ type: "LineString", coordinates });
const wiggle = (n: number) =>
  line(Array.from({ length: n }, (_, i) => [135 + i * 0.00001, 34 + Math.sin(i / 3) * 0.0005] as [number, number]));

describe("parseLine", () => {
  const ok = [[135, 34], [135.01, 34.01]];
  test("accepts a real line and keeps an optional elevation", () => {
    const r = parseLine({ type: "LineString", coordinates: [[135, 34, 12.5], [135.01, 34.01]] });
    expect(r.ok).toBe(true);
    expect(parseLine({ type: "LineString", coordinates: ok }).ok).toBe(true);
  });
  test.each([
    ["no points", []],
    ["one point", [[135, 34]]],
    ["NaN", [[135, 34], [Number.NaN, 34]]],
    ["latitude 91", [[135, 34], [135, 91]]],
    ["a point in the Atlantic", [[135, 34], [-30, 20]]],
    ["a text coordinate", [[135, 34], ["a", 34]]],
  ])("rejects %s", (_n, coordinates) => {
    expect(parseLine({ type: "LineString", coordinates }).ok).toBe(false);
  });
  test("rejects 50,001 points, wrong type and non-objects", () => {
    expect(parseLine({ type: "LineString", coordinates: Array.from({ length: 50_001 }, () => [135, 34]) }).ok).toBe(false);
    expect(parseLine({ type: "Polygon", coordinates: ok }).ok).toBe(false);
    expect(parseLine(null).ok).toBe(false);
    expect(parseLine("x").ok).toBe(false);
  });
});

describe("parseLine legs", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const coordinates: [number, number][] = [[135, 34], [135.01, 34.01]];
  test("keeps well-formed legs, and no legs is fine", () => {
    const r = parseLine({ type: "LineString", coordinates, legs: [{ from: A, to: B, coordinates }] });
    expect(r.ok && r.line.legs).toEqual([{ from: A, to: B, coordinates }]);
    const none = parseLine({ type: "LineString", coordinates, legs: [] });
    expect(none.ok && "legs" in none.line).toBe(false);
  });
  test.each([
    ["an id that is not a uuid", [{ from: "a", to: B, coordinates }]],
    ["a leg with one point", [{ from: A, to: B, coordinates: [[135, 34]] }]],
    ["a leg outside Japan", [{ from: A, to: B, coordinates: [[135, 34], [-30, 20]] }]],
    ["legs that are not a list", {}],
  ])("rejects %s", (_n, legs) => {
    expect(parseLine({ type: "LineString", coordinates, legs }).ok).toBe(false);
  });
});

describe("simplifyLine", () => {
  test("keeps the endpoints and stays within the cap", () => {
    const l = wiggle(10_000);
    const s = simplifyLine(l, 2000);
    expect(s.coordinates.length).toBeLessThanOrEqual(2000);
    expect(s.coordinates[0]).toEqual(l.coordinates[0]!);
    expect(s.coordinates.at(-1)).toEqual(l.coordinates.at(-1)!);
  });
  test("leaves a short line alone", () => {
    const l = wiggle(10);
    expect(simplifyLine(l, 2000)).toEqual(l);
  });
});

describe("lineLengthKm", () => {
  test("0.01 degrees of latitude is about 1.11 km", () => {
    expect(lineLengthKm(line([[135, 34], [135, 34.01]]))).toBe(1.11);
  });
});

describe("sketchOf", () => {
  test("returns at most 40 points as [lng, lat]", () => {
    const s = sketchOf(wiggle(5000), 40);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s[0]).toHaveLength(2);
  });

  test("keeps the height when the line has one", () => {
    const s = sketchOf({ type: "LineString", coordinates: [[135, 34, 10], [135.01, 34.01, 250], [135.02, 34.02, 120]] }, 40);
    expect(s.map((p) => p[2])).toEqual([10, 250, 120]);
  });
});

describe("guide points on a leg", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const withVia = (via: unknown) => parseLine({ type: "LineString", coordinates: [[135, 34], [135.01, 34.01]], legs: [{ from: A, to: B, coordinates: [[135, 34], [135.01, 34.01]], via }] });

  test("are kept on the leg, in order, and an empty list is left out", () => {
    const r = withVia([[135.002, 34.004], [135.006, 34.002]]);
    expect(r.ok && r.line.legs?.[0]?.via).toEqual([[135.002, 34.004], [135.006, 34.002]]);
    const none = withVia([]);
    expect(none.ok && none.line.legs?.[0]).not.toHaveProperty("via");
  });

  test.each([
    ["more than 20", Array.from({ length: 21 }, () => [135, 34])],
    ["a point with three numbers", [[135, 34, 5]]],
    ["a point outside Japan", [[-30, 20]]],
    ["a text coordinate", [["a", 34]]],
    ["not a list", "x"],
  ])("are refused: %s", (_n, via) => {
    expect(withVia(via).ok).toBe(false);
  });
});

describe("return legs", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const coordinates = [[135, 34], [135.01, 34.01]];
  test("a leg marked as a return leg keeps its mark; a ride on it is not read as a ride to the place it returns to", () => {
    const r = parseLine({ type: "LineString", coordinates, legs: [{ from: B, to: A, coordinates, back: true, ride: { mode: "ferry", minutes: 20 } }] });
    expect(r.ok && r.line.legs?.[0]?.back).toBe(true);
    if (r.ok) expect(ridesOf(r.line, new Set([A, B]))).toEqual([]);
  });
  test("anything but true is not a return leg", () => {
    const r = parseLine({ type: "LineString", coordinates, legs: [{ from: A, to: B, coordinates, back: "yes" }] });
    expect(r.ok && r.line.legs?.[0]?.back).toBeUndefined();
  });
});
