import { describe, expect, test } from "bun:test";
import { completedCount, connectorStates, nodeState, progressShare } from "./ribbon";
import { downsample, elevationArea, fitPoints, linePath, normalizePoints } from "./sketch";
import { resolveViewer } from "./viewer";

describe("nodeState", () => {
  test("a route without published spots is soon, whoever is looking", () => {
    expect(nodeState({ status: "soon", stamped: 3, total: 10 })).toBe("soon");
    expect(nodeState({ status: "ready", stamped: 0, total: 0 })).toBe("soon");
  });

  test("signed out shows nothing personal", () => {
    expect(nodeState({ status: "ready", stamped: null, total: 10 })).toBe("neutral");
  });

  test("signed in: not started, in progress, complete", () => {
    expect(nodeState({ status: "ready", stamped: 0, total: 10 })).toBe("notStarted");
    expect(nodeState({ status: "ready", stamped: 4, total: 10 })).toBe("inProgress");
    expect(nodeState({ status: "ready", stamped: 10, total: 10 })).toBe("complete");
  });
});

describe("progressShare", () => {
  test("is a share between 0 and 1", () => {
    expect(progressShare(5, 10)).toBe(0.5);
    expect(progressShare(15, 10)).toBe(1);
    expect(progressShare(-1, 10)).toBe(0);
  });

  test("is 0 when signed out or empty", () => {
    expect(progressShare(null, 10)).toBe(0);
    expect(progressShare(3, 0)).toBe(0);
  });
});

describe("connectors and counts", () => {
  test("a connector is done only after a completed stop", () => {
    expect(connectorStates(["complete", "inProgress", "notStarted"])).toEqual(["open", "done", "open"]);
    expect(connectorStates(["neutral", "neutral"])).toEqual(["open", "open"]);
  });

  test("completed count is null when signed out", () => {
    expect(completedCount(["complete", "inProgress", "complete"], true)).toBe(2);
    expect(completedCount(["neutral", "neutral"], false)).toBeNull();
  });
});

describe("sketch", () => {
  test("normalizes into a 0..1 box and keeps the aspect ratio", () => {
    expect(normalizePoints([[10, 10], [30, 10], [30, 20]])).toEqual([[0, 0], [1, 0], [1, 0.5]]);
    expect(normalizePoints([])).toEqual([]);
  });

  test("downsample keeps the ends and the maximum", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const out = downsample(items, 10);
    expect(out).toHaveLength(10);
    expect(out[0]).toBe(0);
    expect(out[9]).toBe(99);
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  test("linePath stays inside the box", () => {
    const d = linePath([[0, 0], [1, 0], [1, 1]], 100, 50, 4);
    expect(d.startsWith("M")).toBe(true);
    const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      expect(nums[i]!).toBeGreaterThanOrEqual(0);
      expect(nums[i]!).toBeLessThanOrEqual(100);
      expect(nums[i + 1]!).toBeGreaterThanOrEqual(0);
      expect(nums[i + 1]!).toBeLessThanOrEqual(50);
    }
    expect(linePath([[0, 0]], 100, 50)).toBe("");
  });

  test("fitPoints centres the line and keeps its aspect ratio", () => {
    const fitted = fitPoints([[0, 0], [1, 0]], 100, 50, 0);
    // A flat line has no height: it is scaled by its width and centred vertically.
    expect(fitted[0]).toEqual([0, 25]);
    expect(fitted[1]).toEqual([100, 25]);
    expect(fitPoints([], 100, 50)).toEqual([]);
  });

  test("elevationArea is closed, and empty without data", () => {
    const d = elevationArea([100, 300, 200], 90, 40);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(elevationArea([100], 90, 40)).toBe("");
    // A flat profile must not divide by zero.
    expect(elevationArea([100, 100, 100], 90, 40)).toContain("M");
  });
});

describe("resolveViewer", () => {
  test("production is always signed out", () => {
    expect(resolveViewer({ as: "in" }, { NODE_ENV: "production" })).toEqual({ signedIn: false });
  });

  test("development is signed in by default, and signed out on request", () => {
    const dev = { NODE_ENV: "development" };
    expect(resolveViewer({}, dev)).toEqual({ signedIn: true });
    expect(resolveViewer({ as: "in" }, dev)).toEqual({ signedIn: true });
    expect(resolveViewer({ as: "out" }, dev)).toEqual({ signedIn: false });
  });
});
