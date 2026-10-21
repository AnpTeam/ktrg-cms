import { describe, expect, test } from "bun:test";
import { decodeDem, demAt, fillElevations, tileFor } from "./dem";
import { parseGpx } from "./gpx";
import { climbM, elevationsOf, lengthKm, simplify, type LngLatEle } from "./line";

describe("line", () => {
  test("length matches the API: 0.01 degrees of latitude is 1.11 km, and the diagonal 1.44 km", () => {
    expect(lengthKm([[135, 34], [135, 34.01]])).toBe(1.11);
    expect(lengthKm([[135, 34], [135.01, 34.01]])).toBe(1.44);
    expect(lengthKm([[135, 34]])).toBe(0);
  });
  test("simplify keeps both ends and respects the cap", () => {
    const wiggle: LngLatEle[] = Array.from({ length: 8000 }, (_, i) => [135 + i * 1e-5, 34 + Math.sin(i / 4) * 5e-4]);
    const s = simplify(wiggle, 1000);
    expect(s.length).toBeLessThanOrEqual(1000);
    expect(s[0]).toEqual(wiggle[0]!);
    expect(s.at(-1)).toEqual(wiggle.at(-1)!);
    expect(simplify(wiggle.slice(0, 5), 1000)).toHaveLength(5);
  });
  test("climb ignores a bouncing reading and counts a real hill", () => {
    expect(climbM([100, 101, 100, 101, 100, 101, 100])).toBeLessThanOrEqual(1);
    expect(climbM([100, 150, 200, 250, 300])).toBeGreaterThanOrEqual(190);
    expect(climbM([300, 250, 200])).toBe(0);
    expect(climbM([])).toBe(0);
  });
  test("elevations are returned only when every point has one", () => {
    expect(elevationsOf([[135, 34, 1], [135, 34.1, 2]])).toEqual([1, 2]);
    expect(elevationsOf([[135, 34, 1], [135, 34.1]])).toBeNull();
    expect(elevationsOf([])).toBeNull();
  });
});

describe("parseGpx", () => {
  const gpx = (pts: string, extra = "") => `<?xml version="1.0"?>${extra}<gpx version="1.1"><trk><trkseg>${pts}</trkseg></trk></gpx>`;
  test("reads track points with and without elevation, in either attribute order", () => {
    const r = parseGpx(gpx(`<trkpt lat="34.1" lon="135.2"><ele>120.5</ele></trkpt><trkpt lon="135.3" lat="34.2"/>`));
    expect(r).toEqual({ ok: true, points: [[135.2, 34.1, 120.5], [135.3, 34.2]], waypoints: [] });
  });
  test("reads named waypoints, decoding the name; a point out of range is skipped", () => {
    const r = parseGpx(
      `<gpx><wpt lat="34.1" lon="135.2"><name>神福寺跡 &amp; 経塚</name></wpt><wpt lat="34.3" lon="135.4"><name><![CDATA[慈眼院]]></name></wpt><wpt lat="99" lon="135"><name>bad</name></wpt><wpt lat="34.5" lon="135.5"/></gpx>`,
    );
    expect(r).toEqual({
      ok: true,
      points: [],
      waypoints: [
        { lat: 34.1, lng: 135.2, name: "神福寺跡 & 経塚" },
        { lat: 34.3, lng: 135.4, name: "慈眼院" },
        { lat: 34.5, lng: 135.5, name: "" },
      ],
    });
  });
  test("a file with a path and waypoints gives both", () => {
    const r = parseGpx(`<gpx><wpt lat="34.1" lon="135.2"><name>A</name></wpt><trk><trkseg><trkpt lat="34.1" lon="135.2"/><trkpt lat="34.2" lon="135.3"/></trkseg></trk></gpx>`);
    expect(r.ok && r.points.length === 2 && r.waypoints.length === 1).toBe(true);
  });
  test("a planned route (rtept) works when there is no track", () => {
    const r = parseGpx(`<gpx><rte><rtept lat="34.1" lon="135.2"/><rtept lat="34.2" lon="135.3"/></rte></gpx>`);
    expect(r.ok).toBe(true);
  });
  test("rejects garbage, one point, out-of-range positions and DOCTYPE or entities", () => {
    expect(parseGpx("not xml").ok).toBe(false);
    expect(parseGpx(gpx(`<trkpt lat="34.1" lon="135.2"/>`)).ok).toBe(false);
    expect(parseGpx(gpx(`<trkpt lat="91" lon="135.2"/><trkpt lat="34" lon="135"/>`)).ok).toBe(false);
    expect(parseGpx(gpx(`<trkpt lat="34.1" lon="135.2"/><trkpt lat="34.2" lon="135.3"/>`, `<!DOCTYPE x [<!ENTITY a "b">]>`)).ok).toBe(false);
  });
});

describe("elevation tiles", () => {
  test("decodes the GSI height formula, including no data and below sea level", () => {
    expect(decodeDem(0, 4, 0)).toBeCloseTo(10.24, 2); // 1024 * 0.01
    expect(decodeDem(128, 0, 0)).toBeNull(); // 2^23: no data
    expect(decodeDem(255, 255, 156)).toBeCloseTo(-1, 2); // 2^24 - 100 -> -1.00 m
  });
  test("a position falls in the right tile and pixel", () => {
    // Zoom 0 is one tile; the middle of the world is the middle of the tile.
    expect(tileFor(0, 0, 0)).toMatchObject({ x: 0, y: 0, px: 128, py: 128 });
    const t = tileFor(135.5, 34.5, 14);
    expect(t.x).toBeGreaterThan(14000);
    expect(t.px).toBeGreaterThanOrEqual(0);
    expect(t.px).toBeLessThan(256);
  });
  test("reads a pixel out of RGBA data", () => {
    const rgba = new Uint8ClampedArray(256 * 256 * 4);
    const i = (3 * 256 + 5) * 4;
    rgba[i] = 0; rgba[i + 1] = 4; rgba[i + 2] = 0;
    expect(demAt(rgba, 5, 3)).toBeCloseTo(10.24, 2);
  });
  test("fills only missing elevations, asks for each tile once, and survives a tile that will not load", async () => {
    const rgba = new Uint8ClampedArray(256 * 256 * 4);
    for (let i = 0; i < rgba.length; i += 4) { rgba[i] = 0; rgba[i + 1] = 2; rgba[i + 2] = 0; } // 5.12 m everywhere
    let loads = 0;
    const ok = await fillElevations([[135.5, 34.5], [135.5001, 34.5001], [135.5, 34.5, 77]], async () => { loads++; return rgba; });
    expect(loads).toBe(1);
    expect(ok.points.map((p) => p[2])).toEqual([5.1, 5.1, 77]);
    expect(ok.missing).toBe(0);
    const bad = await fillElevations([[135.5, 34.5]], async () => { throw new Error("offline"); });
    expect(bad).toEqual({ points: [[135.5, 34.5]], missing: 1 });
  });
});
