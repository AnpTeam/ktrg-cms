import { describe, expect, test } from "bun:test";
import { daysBetween } from "./format";


describe("daysBetween", () => {
  test("counts whole days, never negative", () => {
    expect(daysBetween("2026-10-20", "2026-10-20")).toBe(0);
    expect(daysBetween("2026-10-20", "2026-10-27")).toBe(7);
    expect(daysBetween("2026-10-27", "2026-10-20")).toBe(0);
  });
});
