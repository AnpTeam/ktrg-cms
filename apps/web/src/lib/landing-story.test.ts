import { describe, expect, test } from "bun:test";
import { installNudgeShows, previewRoutes, progressOf } from "./landing-story";

describe("progressOf", () => {
  test("0 before the top, 1 past the bottom, linear between", () => {
    expect(progressOf(-50, 100, 500)).toBe(0);
    expect(progressOf(100, 100, 500)).toBe(0);
    expect(progressOf(300, 100, 500)).toBe(0.5);
    expect(progressOf(900, 100, 500)).toBe(1);
  });
  test("an empty or backwards range is 0", () => {
    expect(progressOf(300, 500, 500)).toBe(0);
    expect(progressOf(300, 500, 100)).toBe(0);
    expect(progressOf(Number.NaN, 0, 100)).toBe(0);
  });
});

const r = (order: number, status: "ready" | "soon") => ({ order, status });

describe("previewRoutes", () => {
  test("the first five published routes in course order", () => {
    const routes = [8, 7, 6, 5, 4, 3, 2, 1].map((o) => r(o, "ready"));
    expect(previewRoutes(routes).map((x) => x.order)).toEqual([1, 2, 3, 4, 5]);
  });
  test("with fewer than five published, unpublished ones fill the rest", () => {
    const routes = [r(9, "soon"), r(1, "ready"), r(5, "soon"), r(2, "ready"), r(3, "ready"), r(6, "soon"), r(7, "soon"), r(8, "soon")];
    expect(previewRoutes(routes).map((x) => `${x.order}${x.status === "soon" ? "s" : ""}`)).toEqual(["1", "2", "3", "5s", "6s"]);
  });
  test("fewer routes than five, none, and the input is not changed", () => {
    const two = [r(2, "soon"), r(1, "ready")];
    expect(previewRoutes(two).map((x) => x.order)).toEqual([1, 2]);
    expect(two.map((x) => x.order)).toEqual([2, 1]);
    expect(previewRoutes([])).toEqual([]);
  });
  test("a smaller maximum", () => {
    expect(previewRoutes([r(1, "ready"), r(2, "ready"), r(3, "ready")], 2)).toHaveLength(2);
  });
});

describe("installNudgeShows", () => {
  const ok = { phone: true, installed: false, inAppBrowser: false, onMap: false, visits: 2, seconds: 0, dismissedDaysAgo: null, dialogOpen: false, inputFocused: false };
  test("shows on a phone from the second visit", () => {
    expect(installNudgeShows(ok)).toBe(true);
  });
  test("or after three minutes on the first visit, not before", () => {
    expect(installNudgeShows({ ...ok, visits: 1, seconds: 179 })).toBe(false);
    expect(installNudgeShows({ ...ok, visits: 1, seconds: 180 })).toBe(true);
  });
  test("never when installed, in another app's browser, on a computer, on the map, over a dialog or a typing field", () => {
    for (const no of [{ installed: true }, { inAppBrowser: true }, { phone: false }, { onMap: true }, { dialogOpen: true }, { inputFocused: true }]) {
      expect(installNudgeShows({ ...ok, ...no })).toBe(false);
    }
  });
  test("hidden for 30 days after it was dismissed", () => {
    expect(installNudgeShows({ ...ok, dismissedDaysAgo: 0 })).toBe(false);
    expect(installNudgeShows({ ...ok, dismissedDaysAgo: 29 })).toBe(false);
    expect(installNudgeShows({ ...ok, dismissedDaysAgo: 30 })).toBe(true);
  });
});
