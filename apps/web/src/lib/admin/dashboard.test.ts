import { describe, expect, test } from "bun:test";
import { goalFromText, progressPercent, sparkPoints } from "./dashboard";

describe("dashboard numbers", () => {
  test("progress toward a goal, which may pass 100; no goal means no progress", () => {
    expect(progressPercent(120, 500)).toBe(24);
    expect(progressPercent(600, 500)).toBe(120);
    expect(progressPercent(5, null)).toBeNull();
  });

  test("a line chart's points: left to right, the highest value at the top, and a flat zero line", () => {
    expect(sparkPoints([0, 5, 10], 100, 30)).toBe("3,27 50,15 97,3");
    expect(sparkPoints([0, 0], 100, 30)).toBe("3,27 97,27");
    expect(sparkPoints([4], 100, 30)).toBe("3,3");
    expect(sparkPoints([], 100, 30)).toBe("");
  });

  test("a goal is a whole number from 1 or empty", () => {
    expect(goalFromText(" 500 ")).toBe(500);
    expect(goalFromText("")).toBeNull();
    expect(Number.isNaN(goalFromText("0"))).toBe(true);
    expect(Number.isNaN(goalFromText("1.5"))).toBe(true);
    expect(Number.isNaN(goalFromText("12a"))).toBe(true);
    expect(Number.isNaN(goalFromText("-3"))).toBe(true);
  });
});
