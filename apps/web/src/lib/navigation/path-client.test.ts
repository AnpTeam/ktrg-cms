import { describe, expect, test } from "bun:test";
import { parsePathResponse, PATH_BACKOFF_MS, PATH_MIN_INTERVAL_MS, shouldAskForPath, type LastAsk } from "./path-client";

const LAT = 34.5;
const here = { lat: LAT, lng: 135 };
const t0 = 1_000_000;

describe("parsePathResponse", () => {
  test("a path of two or more points", () => {
    expect(parsePathResponse(200, { ok: true, line: [[135, LAT], [135.01, LAT, 120]], distanceM: 900 })).toEqual({ ok: true, line: [[135, LAT], [135.01, LAT]] });
  });

  test("a malformed or too short path is no path (and no reason to back off)", () => {
    expect(parsePathResponse(200, { ok: true, line: [[135, LAT]] })).toEqual({ ok: false, backOff: false });
    expect(parsePathResponse(200, { ok: true, line: [[135, "x"], [1, 2]] })).toEqual({ ok: false, backOff: false });
    expect(parsePathResponse(200, { ok: true })).toEqual({ ok: false, backOff: false });
    expect(parsePathResponse(200, null)).toEqual({ ok: false, backOff: false });
  });

  test("service down or too many asks: back off; anything else: just no path", () => {
    expect(parsePathResponse(503, { ok: false, error: "routing_unavailable" })).toEqual({ ok: false, backOff: true });
    expect(parsePathResponse(429, undefined)).toEqual({ ok: false, backOff: true });
    expect(parsePathResponse(422, { ok: false, error: "routing_no_route" })).toEqual({ ok: false, backOff: false });
    expect(parsePathResponse(401, undefined)).toEqual({ ok: false, backOff: false });
    expect(parsePathResponse(404, undefined)).toEqual({ ok: false, backOff: false });
  });
});

describe("shouldAskForPath", () => {
  const asked = (over: Partial<LastAsk> = {}): LastAsk => ({ stopId: "a", atMs: t0, from: here, ...over });

  test("only when a path is wanted and there is a target", () => {
    expect(shouldAskForPath(false, "a", here, t0, null)).toBe(false);
    expect(shouldAskForPath(true, null, here, t0, null)).toBe(false);
    expect(shouldAskForPath(true, "a", here, t0, null)).toBe(true);
  });

  test("never twice within the interval, even for a new stop or after moving", () => {
    const moved = { lat: LAT + 0.001, lng: 135 };
    expect(shouldAskForPath(true, "b", moved, t0 + PATH_MIN_INTERVAL_MS - 1, asked())).toBe(false);
  });

  test("after the interval: again for a new stop, or for the same stop once moved 50 m, not when standing still", () => {
    const later = t0 + PATH_MIN_INTERVAL_MS;
    expect(shouldAskForPath(true, "b", here, later, asked())).toBe(true);
    expect(shouldAskForPath(true, "a", here, later, asked())).toBe(false);
    expect(shouldAskForPath(true, "a", { lat: LAT + 0.0004, lng: 135 }, later, asked())).toBe(false); // ~44 m
    expect(shouldAskForPath(true, "a", { lat: LAT + 0.0005, lng: 135 }, later, asked())).toBe(true); // ~56 m
  });

  test("while backing off nothing is asked; after it, it asks again even standing still", () => {
    const off = asked({ backOffUntilMs: t0 + PATH_BACKOFF_MS });
    expect(shouldAskForPath(true, "b", here, t0 + PATH_BACKOFF_MS - 1, off)).toBe(false);
    expect(shouldAskForPath(true, "a", here, t0 + PATH_BACKOFF_MS, off)).toBe(true);
  });
});
