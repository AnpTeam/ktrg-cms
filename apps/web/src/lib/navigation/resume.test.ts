import { describe, expect, test } from "bun:test";
import { clearResume, loadResume, RESUME_MAX_AGE_MS, saveResume } from "./resume";

const fake = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe("resume record", () => {
  test("round trip, and clearing", () => {
    const s = fake();
    saveResume(s, { routeId: "r1", at: 1000 });
    expect(loadResume(s, 2000)).toEqual({ routeId: "r1", at: 1000 });
    clearResume(s);
    expect(loadResume(s, 2000)).toBeNull();
  });

  test("too old, from the future, or malformed: nothing, and dropped", () => {
    const s = fake();
    saveResume(s, { routeId: "r1", at: 1000 });
    expect(loadResume(s, 1000 + RESUME_MAX_AGE_MS + 1)).toBeNull();
    expect(s.m.size).toBe(0);
    saveResume(s, { routeId: "r1", at: 5000 });
    expect(loadResume(s, 1000)).toBeNull();
    s.setItem("ktrg-nav-resume", "{oops");
    expect(loadResume(s, 1000)).toBeNull();
    s.setItem("ktrg-nav-resume", JSON.stringify({ routeId: "", at: 1 }));
    expect(loadResume(s, 2)).toBeNull();
  });

  test("no storage at all is fine", () => {
    saveResume(undefined, { routeId: "r", at: 1 });
    expect(loadResume(undefined, 2)).toBeNull();
    clearResume(undefined);
  });
});
