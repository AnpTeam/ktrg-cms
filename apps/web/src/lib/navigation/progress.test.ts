import { describe, expect, test } from "bun:test";
import { courseProgress } from "./progress";
import { initialState, type NavModel } from "./session";

// Four places along a 4 km course line: at 0, 1000, 2500 and 4000 m (the line itself is not needed here).
const stop = (id: string, status: "open" | "closed" = "open") => ({ id, lat: 0, lng: 0, radiusM: 50, status });
const model = (along: (number | null)[] = [0, 1000, 2500, 4000], closed = -1): NavModel => ({
  line: [],
  cum: [],
  stops: ["a", "b", "c", "d"].map((id, i) => stop(id, i === closed ? "closed" : "open")),
  stopAlongM: along,
  farM: 5000,
});
const at = (alongM: number | null, distanceM: number | null = null) => ({ ...initialState(), alongM, distanceM });

describe("courseProgress", () => {
  test("counts stamped places and closed ones as done", () => {
    expect(courseProgress(model(undefined, 3), at(0), new Set(["a"]))).toMatchObject({ total: 4, done: 2 });
  });

  test("distance left covers everything still to stamp, from the nearer end", () => {
    // Left: b (1000) and d (4000); at 0 m the nearer end is b: 1000 to get there, 3000 across.
    expect(courseProgress(model(), at(0), new Set(["a", "c"])).leftM).toBe(4000);
    // Standing at 3500 m: the nearer end is d (500), then back across 3000 to b.
    expect(courseProgress(model(), at(3500), new Set(["a", "c"])).leftM).toBe(3500);
    // One place left: just the way to it.
    expect(courseProgress(model(), at(500), new Set(["a", "b", "c"])).leftM).toBe(3500);
  });

  test("time is the distance at 50 m a minute, rounded up, at least one minute", () => {
    const p = courseProgress(model(), at(0, 120), new Set());
    expect(p.toNextMin).toBe(3);
    expect(courseProgress(model(), at(0, 3), new Set()).toNextMin).toBe(1);
    expect(courseProgress(model(), at(0), new Set(["a", "c"])).leftMin).toBe(80);
  });

  test("no number is shown when it cannot be true: off the line, a place not on the line, or nothing left", () => {
    expect(courseProgress(model(), at(null), new Set()).leftM).toBeNull();
    expect(courseProgress(model([0, 1000, null, 4000]), at(0), new Set()).leftM).toBeNull();
    expect(courseProgress(model(), at(0), new Set(["a", "b", "c", "d"]))).toMatchObject({ done: 4, leftM: null, leftMin: null });
    expect(courseProgress(model(), at(0), new Set())).toMatchObject({ toNextM: null, toNextMin: null });
  });
});
