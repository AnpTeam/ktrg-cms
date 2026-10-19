import { describe, expect, test } from "bun:test";
import type { LngLatEle } from "./line";
import { MAX_SNAP_POINTS, roundLine, snapPoints } from "./snap";

const wiggly = (n: number): LngLatEle[] => Array.from({ length: n }, (_, i) => [135 + i * 0.0005, 34 + Math.sin(i / 5) * 0.002]);

describe("roundLine", () => {
  test("positions to 6 decimals, heights to one, a missing height stays missing", () => {
    expect(roundLine([[135.123456789, 34.987654321, 100.449], [135.2, 34.3]])).toEqual([[135.123457, 34.987654, 100.4], [135.2, 34.3]]);
  });
});

describe("snapPoints", () => {
  test("a drawn line is thinned, keeping its ends, and sent as latitude and longitude", () => {
    const line = wiggly(400);
    const pts = snapPoints(line, [])!;
    expect(pts.length).toBeLessThanOrEqual(MAX_SNAP_POINTS);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts[0]).toEqual({ lat: line[0]![1], lng: line[0]![0] });
    expect(pts[pts.length - 1]).toEqual({ lat: line[399]![1], lng: line[399]![0] });
  });

  test("a short line is sent as it is", () => {
    const line: LngLatEle[] = [[135.1, 34.1], [135.2, 34.2], [135.3, 34.1]];
    expect(snapPoints(line, [])).toEqual([{ lat: 34.1, lng: 135.1 }, { lat: 34.2, lng: 135.2 }, { lat: 34.1, lng: 135.3 }]);
  });

  test("with no line, the stops that have a position are joined in order", () => {
    const stops = [{ lat: 34.1, lng: 135.1 }, { lat: null, lng: null }, { lat: 34.3, lng: 135.3 }];
    expect(snapPoints([], stops)).toEqual([{ lat: 34.1, lng: 135.1 }, { lat: 34.3, lng: 135.3 }]);
  });

  test("fewer than two usable points: nothing to snap", () => {
    expect(snapPoints([], [])).toBeNull();
    expect(snapPoints([], [{ lat: 34, lng: 135 }])).toBeNull();
    expect(snapPoints([[135, 34]], [{ lat: 34, lng: 135 }, { lat: null, lng: 135 }])).toBeNull();
  });

  test("a row of stops never goes past the limit", () => {
    const stops = Array.from({ length: 80 }, (_, i) => ({ lat: 34 + i * 0.001, lng: 135 }));
    expect(snapPoints([], stops)!.length).toBe(MAX_SNAP_POINTS);
  });
});
