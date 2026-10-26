import { describe, expect, test } from "bun:test";
import { applyGpxElevations } from "./gpx-elevation";
import type { LngLatEle } from "./line";

// A straight track east along the 34.4 N line, climbing from 100 m to 200 m over 0.01 degrees.
const track: LngLatEle[] = Array.from({ length: 11 }, (_, i) => [135.7 + i * 0.001, 34.4, 100 + i * 10]);

describe("heights from a GPX track", () => {
  test("a line along the track takes its heights, between the track's own points too", () => {
    const line: LngLatEle[] = [[135.7, 34.4], [135.7025, 34.40002], [135.705, 34.4], [135.71, 34.4]];
    const r = applyGpxElevations(line, track)!;
    expect(r.matched).toBe(4);
    expect(r.points.map((p) => p[2])).toEqual([100, 125, 150, 200]);
    expect(r.points.map((p) => [p[0], p[1]])).toEqual(line.map((p) => [p[0], p[1]])); // the shape is untouched
  });

  test("heights the line already had (a wrong 0) are replaced", () => {
    const line: LngLatEle[] = [[135.7, 34.4, 0], [135.705, 34.4, 0], [135.71, 34.4, 0]];
    expect(applyGpxElevations(line, track)!.points.map((p) => p[2])).toEqual([100, 150, 200]);
  });

  test("a stretch away from the track is filled in between its two sides; a line far from it is refused", () => {
    const line: LngLatEle[] = [[135.7, 34.4], [135.703, 34.45], [135.71, 34.4]];
    const r = applyGpxElevations(line, track)!;
    expect(r.matched).toBe(2);
    expect(r.points[1]![2]).toBeGreaterThan(100);
    expect(r.points[1]![2]).toBeLessThan(200);
    expect(applyGpxElevations([[136, 35], [136.01, 35]], track)).toBeNull();
  });

  test("a track with no heights gives nothing", () => {
    expect(applyGpxElevations([[135.7, 34.4], [135.71, 34.4]], track.map((p) => [p[0], p[1]] as LngLatEle))).toBeNull();
  });
});
