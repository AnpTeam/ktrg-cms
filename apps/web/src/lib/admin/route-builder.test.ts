import { describe, expect, mock, test } from "bun:test";
import { buildLine, closeLineGaps, smoothLine } from "./route-builder";
import type { LatLng } from "./gsi-paths";

const a = { lat: 34.27, lng: 135.07 };
const b = { lat: 34.28, lng: 135.08 };
const c = { lat: 34.29, lng: 135.09 };

describe("buildLine", () => {
  test("joins the trail between each pair of stops, in order, without repeating a stop", async () => {
    const bridge = mock(async (from: LatLng, to: LatLng): Promise<LatLng[] | null> => [from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], to]);
    const { line, straightHops } = await buildLine([a, b, c], "trail", bridge);
    expect(straightHops).toBe(0);
    expect(line[0]).toEqual([a.lng, a.lat]);
    expect(line.at(-1)).toEqual([c.lng, c.lat]);
    expect(line.filter((p) => p[0] === b.lng && p[1] === b.lat)).toHaveLength(1);
    expect(bridge).toHaveBeenCalledTimes(2);
  });

  test("a hop with no trail is straight, and is counted so the editor can say so", async () => {
    const { line, straightHops } = await buildLine([a, b, c], "trail", async (from) => (from[0] === a.lat ? null : [from]));
    expect(straightHops).toBe(1);
    expect(line).toHaveLength(3);
  });

  test("direct mode never asks for a trail", async () => {
    const bridge = mock(async () => null);
    const { line, straightHops } = await buildLine([a, b], "direct", bridge);
    expect(bridge).not.toHaveBeenCalled();
    expect(straightHops).toBe(0);
    expect(line).toEqual([[a.lng, a.lat], [b.lng, b.lat]]);
  });

  test("fewer than two stops make no line", async () => {
    expect(await buildLine([a], "trail")).toEqual({ line: [], straightHops: 0 });
  });
});

describe("closeLineGaps", () => {
  test("a line that already reaches its stops is left as it is", async () => {
    const bridge = mock(async () => null);
    const line: [number, number][] = [[a.lng, a.lat], [b.lng, b.lat]];
    expect(await closeLineGaps(line, [a, b], bridge)).toEqual(line);
    expect(bridge).not.toHaveBeenCalled();
  });
});

describe("smoothLine", () => {
  const corner: [number, number][] = [[135.07, 34.27], [135.08, 34.27], [135.08, 34.28]];
  test("keeps the ends and rounds the corner with more points", () => {
    const smooth = smoothLine(corner);
    expect(smooth.length).toBeGreaterThan(corner.length);
    expect(smooth[0]).toEqual([135.07, 34.27]);
    expect(smooth.at(-1)).toEqual([135.08, 34.28]);
  });
  test("a line of two points has no corner to round", () => {
    expect(smoothLine([[135.07, 34.27], [135.08, 34.28]])).toHaveLength(2);
  });
});
