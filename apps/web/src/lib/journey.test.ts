import { expect, test } from "bun:test";
import { BEAT_STARTS, beatAt, drawnShare, sealPoints, sealsPlaced, stageLine } from "./journey";
import { RIDGE_HEIGHT, RIDGE_WIDTH, ridgePath } from "./ridge";

test("the beat is the last one whose start the scroll has reached", () => {
  expect(BEAT_STARTS).toEqual([0, 0.2, 0.5, 0.8]);
  expect(beatAt(0)).toBe(0);
  expect(beatAt(0.19)).toBe(0);
  expect(beatAt(0.2)).toBe(1);
  expect(beatAt(0.5)).toBe(2);
  expect(beatAt(0.8)).toBe(3);
  expect(beatAt(1)).toBe(3);
});

test("a progress outside 0..1, or not a number, never leaves the four beats", () => {
  expect(beatAt(-5)).toBe(0);
  expect(beatAt(9)).toBe(3);
  expect(beatAt(Number.NaN)).toBe(0);
});

test("the ridge is undrawn until 0.15 and complete at 0.5", () => {
  expect(drawnShare(0)).toBe(0);
  expect(drawnShare(0.15)).toBe(0);
  expect(drawnShare(0.325)).toBeCloseTo(0.5, 5);
  expect(drawnShare(0.5)).toBe(1);
  expect(drawnShare(1)).toBe(1);
  expect(drawnShare(Number.NaN)).toBe(0);
});

test("seals start dropping at 0.5 and are all placed at 0.8", () => {
  expect(sealsPlaced(0.5, 31)).toBe(0);
  expect(sealsPlaced(0.8, 31)).toBe(31);
  expect(sealsPlaced(1, 31)).toBe(31);
  expect([15, 16]).toContain(sealsPlaced(0.65, 31));
});

test("a count of seals is a whole number between 0 and the total, for any progress and any total", () => {
  for (const total of [0, 1, 31]) {
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const n = sealsPlaced(p, total);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(total);
    }
  }
  expect(sealsPlaced(0.9, 0)).toBe(0);
});

test("seals are spread evenly along a straight line", () => {
  expect(sealPoints([[0, 0], [10, 0]], 3)).toEqual([[0, 0], [5, 0], [10, 0]]);
});

test("one seal stands at the middle of the line", () => {
  expect(sealPoints([[0, 0], [10, 0]], 1)).toEqual([[5, 0]]);
});

test("no seals, or a line with fewer than two points, gives none", () => {
  expect(sealPoints([[0, 0], [10, 0]], 0)).toEqual([]);
  expect(sealPoints([[0, 0], [10, 0]], -2)).toEqual([]);
  expect(sealPoints([[3, 3]], 5)).toEqual([]);
  expect(sealPoints([], 5)).toEqual([]);
});

test("seals are spaced by the length of the line, not by x", () => {
  // An L: 10 across then 10 down. Three seals: the start, the corner (half the length), the end.
  expect(sealPoints([[0, 0], [10, 0], [10, 10]], 3)).toEqual([[0, 0], [10, 0], [10, 10]]);
});

test("seals on a line with a repeated point are all finite", () => {
  for (const [x, y] of sealPoints([[0, 0], [0, 0], [10, 0], [10, 0]], 5)) {
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  }
});

test("without ridge data the stage draws a plain straight line, never an invented profile", () => {
  const line = stageLine(null);
  expect(line.points).toEqual([[0, RIDGE_HEIGHT], [RIDGE_WIDTH, RIDGE_HEIGHT * 0.1]]);
  expect(line.d.startsWith("M0.0 200.0")).toBe(true);
});

test("with ridge data the stage draws the ridge's own line and points", () => {
  const ridge = ridgePath([{ order: 1, distanceKm: 1, sketch: { points: [], elevations: [0, 100] } }])!;
  const line = stageLine(ridge);
  expect(line.d).toBe(ridge.d);
  expect(line.points).toBe(ridge.points);
});
