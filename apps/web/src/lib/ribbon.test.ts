import { describe, expect, test } from "bun:test";
import { completedCount, connectorStates, nodeState, progressShare } from "./ribbon";
import { downsample, elevationArea, fitPoints, linePath, normalizePoints } from "./sketch";
import { resolveViewer, viewerFromMe } from "./viewer";

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
  test("production never accepts an override: the real session decides", () => {
    expect(resolveViewer({ as: "in" }, { NODE_ENV: "production" })).toBeNull();
  });

  test("development can force signed in or out; otherwise the session decides", () => {
    const dev = { NODE_ENV: "development" };
    expect(resolveViewer({}, dev)).toBeNull();
    expect(resolveViewer({ as: "in" }, dev)).toEqual({ signedIn: true, role: null, publicId: null, deletionDueAt: null, name: null, origin: null, originPlace: null, ageRange: null, gender: null, email: null, foundVia: null, preferences: null, bookmarks: [] });
    expect(resolveViewer({ as: "out" }, dev)).toEqual({ signedIn: false, role: null, publicId: null, deletionDueAt: null, name: null, origin: null, originPlace: null, ageRange: null, gender: null, email: null, foundVia: null, preferences: null, bookmarks: [] });
    expect(resolveViewer({ as: "auto" }, dev)).toBeNull();
  });
});

describe("viewerFromMe", () => {
  test("a good answer gives the name", () => {
    expect(viewerFromMe(200, { ok: true, me: { displayName: "Hana" } })).toEqual({ signedIn: true, role: null, publicId: null, deletionDueAt: null, name: "Hana", avatarUrl: null, origin: null, originPlace: null, ageRange: null, gender: null, email: null, foundVia: null, preferences: null, bookmarks: [] });
    expect(viewerFromMe(200, { ok: true, me: { displayName: null } })).toEqual({ signedIn: true, role: null, publicId: null, deletionDueAt: null, name: null, avatarUrl: null, origin: null, originPlace: null, ageRange: null, gender: null, email: null, foundVia: null, preferences: null, bookmarks: [] });
    expect(viewerFromMe(200, { ok: true, me: { displayName: "Hana", origin: "nara" } }).origin).toBe("nara");
    expect(viewerFromMe(200, { ok: true, me: { displayName: "Hana", origin: "mars" } }).origin).toBeNull();
    const about = viewerFromMe(200, { ok: true, me: { publicId: "00048271", deletionDueAt: "2026-10-18T05:30:00.000Z", displayName: "Hana", ageRange: "60s", gender: "unspecified" } });
    expect(about).toMatchObject({ publicId: "00048271", deletionDueAt: "2026-10-18T05:30:00.000Z", ageRange: "60s", gender: "unspecified" });
    expect(viewerFromMe(200, { ok: true, me: { displayName: "Hana", ageRange: "teens", gender: "robot" } })).toMatchObject({ ageRange: null, gender: null });
    // The account's saved choices come with it.
    const saved = { size: "large", mergeStops: true, placesOnMap: false, setupDone: true, furigana: false, contrast: false, calm: false, updatedAt: 1760000000000 } as const;
    expect(viewerFromMe(200, { ok: true, me: { displayName: "Hana", preferences: saved } }).preferences).toEqual(saved);
  });

  test("anything else is signed out", () => {
    const out = { signedIn: false, role: null, publicId: null, deletionDueAt: null, name: null, origin: null, originPlace: null, ageRange: null, gender: null, email: null, foundVia: null, preferences: null, bookmarks: [] };
    expect(viewerFromMe(401, { ok: false, error: "unauthenticated" })).toEqual(out);
    expect(viewerFromMe(200, null)).toEqual(out);
    expect(viewerFromMe(200, { ok: false })).toEqual(out);
    expect(viewerFromMe(500, { ok: true, me: { displayName: "x" } })).toEqual(out);
  });
});
