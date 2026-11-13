import { describe, expect, test } from "bun:test";
import { tooFast } from "./travel";

const at = (iso: string) => new Date(iso);
const A = { lat: 34.3, lng: 135.1 };
// about 3.3 km north of A
const B = { lat: 34.33, lng: 135.1 };

describe("tooFast", () => {
  test("the same place is never fast, even with no time between", () => {
    expect(tooFast({ ...A, at: at("2026-11-10T09:00:00Z") }, { ...A, at: at("2026-11-10T09:00:00Z") })).toBe(false);
  });
  test("under 200 m is never fast, however short the time", () => {
    const near = { lat: 34.3012, lng: 135.1 }; // about 130 m
    expect(tooFast({ ...A, at: at("2026-11-10T09:00:00Z") }, { ...near, at: at("2026-11-10T09:00:05Z") })).toBe(false);
  });
  test("3 km in 10 minutes is a normal walk", () => {
    expect(tooFast({ ...A, at: at("2026-11-10T09:00:00Z") }, { ...B, at: at("2026-11-10T09:10:00Z") })).toBe(false);
  });
  test("3 km in 1 minute is 200 km/h: flagged", () => {
    expect(tooFast({ ...A, at: at("2026-11-10T09:00:00Z") }, { ...B, at: at("2026-11-10T09:01:00Z") })).toBe(true);
  });
  test("two far places at the same instant are flagged", () => {
    expect(tooFast({ ...A, at: at("2026-11-10T09:00:00Z") }, { ...B, at: at("2026-11-10T09:00:00Z") })).toBe(true);
  });
  test("the order of the two times does not matter (offline entries arrive late)", () => {
    expect(tooFast({ ...B, at: at("2026-11-10T09:01:00Z") }, { ...A, at: at("2026-11-10T09:00:00Z") })).toBe(true);
  });
});
