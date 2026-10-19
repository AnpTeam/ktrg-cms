import { describe, expect, test } from "bun:test";
import { lineLengthKm, parseLine, sketchOf, simplifyLine, type LineString } from "./line";

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
});
