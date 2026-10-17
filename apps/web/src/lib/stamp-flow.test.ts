import { describe, expect, test } from "bun:test";
import { distanceParts, geoFailureFromCode, isStampMock, parseStampResponse, readingFrom, roundedDistance } from "./stamp-flow";

describe("geoFailureFromCode", () => {
  test("maps the browser's three error codes", () => {
    expect(geoFailureFromCode(1)).toBe("denied");
    expect(geoFailureFromCode(2)).toBe("unavailable");
    expect(geoFailureFromCode(3)).toBe("timeout");
  });

  test("an unknown code is 'unavailable', not a crash", () => {
    expect(geoFailureFromCode(0)).toBe("unavailable");
    expect(geoFailureFromCode(99)).toBe("unavailable");
  });
});

test("readingFrom keeps only what the server needs", () => {
  expect(readingFrom({ coords: { latitude: 34.5, longitude: 135.6, accuracy: 12 } })).toEqual({ lat: 34.5, lng: 135.6, accuracyM: 12 });
});

describe("parseStampResponse", () => {
  test("a stamp, and a stamp that was already there", () => {
    expect(parseStampResponse(200, { ok: true, status: "stamped" })).toEqual({ ok: true, already: false });
    expect(parseStampResponse(200, { ok: true, status: "already_stamped" })).toEqual({ ok: true, already: true });
  });

  test("a 200 without ok:true is never a stamp", () => {
    expect(parseStampResponse(200, {})).toEqual({ ok: false, failure: "failed" });
    expect(parseStampResponse(200, null)).toEqual({ ok: false, failure: "failed" });
    expect(parseStampResponse(200, "ok")).toEqual({ ok: false, failure: "failed" });
  });

  test("each refusal has its own failure", () => {
    expect(parseStampResponse(409, { ok: false, error: "too_far", distanceM: 240 })).toEqual({ ok: false, failure: "too_far", distanceM: 240 });
    expect(parseStampResponse(409, { ok: false, error: "accuracy_too_low" })).toEqual({ ok: false, failure: "low_accuracy" });
    expect(parseStampResponse(409, { ok: false, error: "spot_closed" })).toEqual({ ok: false, failure: "spot_closed" });
    expect(parseStampResponse(409, { ok: false, error: "rally_not_active" })).toEqual({ ok: false, failure: "rally_not_active" });
  });

  test("a distance that is not a sensible number is dropped", () => {
    expect(parseStampResponse(409, { error: "too_far", distanceM: "far" })).toEqual({ ok: false, failure: "too_far" });
    expect(parseStampResponse(409, { error: "too_far", distanceM: -5 })).toEqual({ ok: false, failure: "too_far" });
    expect(parseStampResponse(409, { error: "too_far", distanceM: Infinity })).toEqual({ ok: false, failure: "too_far" });
  });

  test("status codes without a body", () => {
    expect(parseStampResponse(401, undefined)).toEqual({ ok: false, failure: "login_needed" });
    expect(parseStampResponse(429, undefined)).toEqual({ ok: false, failure: "too_many_requests" });
    expect(parseStampResponse(404, undefined)).toEqual({ ok: false, failure: "not_ready" });
    expect(parseStampResponse(501, undefined)).toEqual({ ok: false, failure: "not_ready" });
    expect(parseStampResponse(500, undefined)).toEqual({ ok: false, failure: "failed" });
  });
});

describe("distances", () => {
  test("rounded to what people can read", () => {
    expect(roundedDistance(3)).toBe(10);
    expect(roundedDistance(247)).toBe(250);
    expect(roundedDistance(996)).toBe(1000);
    expect(roundedDistance(1240)).toBe(1200);
  });

  test("metres under a kilometre, kilometres above", () => {
    expect(distanceParts(247)).toEqual({ value: 250, unit: "m" });
    expect(distanceParts(1240)).toEqual({ value: 1.2, unit: "km" });
    expect(distanceParts(12000)).toEqual({ value: 12, unit: "km" });
  });
});

test("isStampMock accepts only the known names", () => {
  expect(isStampMock("far")).toBe(true);
  expect(isStampMock("anything")).toBe(false);
  expect(isStampMock(undefined)).toBe(false);
});
