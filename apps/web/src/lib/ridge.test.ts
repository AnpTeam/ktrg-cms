import { expect, test } from "bun:test";
import { RIDGE_HEIGHT, RIDGE_WIDTH, ridgePath } from "./ridge";

const course = (order: number, distanceKm: number | null, elevations?: number[]) => ({ order, distanceKm, sketch: elevations ? { points: [], elevations } : null });

test("courses are laid end to end in course order, by their length", () => {
  const ridge = ridgePath([course(2, 3, [100, 300]), course(1, 1, [0, 100])])!;
  // 4 km in all: course 1 ends at x = 250, course 2 runs from 250 to 1000.
  expect(ridge.d.startsWith(`M0.0 ${RIDGE_HEIGHT.toFixed(1)}`)).toBe(true);
  expect(ridge.d).toContain("L250.0");
  expect(ridge.d.endsWith(`L${RIDGE_WIDTH.toFixed(1)} ${(RIDGE_HEIGHT * 0.1).toFixed(1)}`)).toBe(true);
  expect(ridge.courses).toBe(2);
  expect(ridge.topM).toBe(300);
});

test("a course without a profile or a length is left out, not guessed", () => {
  const ridge = ridgePath([course(1, 2, [0, 50]), course(2, null, [50, 60]), course(3, 4)])!;
  expect(ridge.courses).toBe(1);
});

test("nothing to draw gives null", () => {
  expect(ridgePath([])).toBeNull();
  expect(ridgePath([course(1, 2)])).toBeNull();
});

test("the ridge returns the points it drew, the same ones as its path", () => {
  const ridge = ridgePath([course(1, 1, [0, 100])])!;
  expect(ridge.points).toEqual([[0, RIDGE_HEIGHT], [RIDGE_WIDTH, RIDGE_HEIGHT * 0.1]]);
  expect(ridge.points.length).toBe((ridge.d.match(/[ML]/g) ?? []).length);
});
