import { describe, expect, test } from "bun:test";
import { distanceParts, geoFailureFromCode, isStampMock, parseMyStamps, parseStampResponse, readingFrom, roundedDistance, parseMyCompletions } from "./stamp-flow";

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
    expect(parseStampResponse(200, { ok: true, stamp: { alreadyStamped: false } })).toEqual({ ok: true, already: false });
    expect(parseStampResponse(200, { ok: true, stamp: { alreadyStamped: true } })).toEqual({ ok: true, already: true });
  });

  test("what the stamp finished is passed on, and a malformed list is dropped", () => {
    const finished = { routeIds: ["r1"], rallyIds: ["y1", "y2"] };
    expect(parseStampResponse(200, { ok: true, stamp: { alreadyStamped: false, finished } })).toEqual({ ok: true, already: false, finished });
    expect(parseStampResponse(200, { ok: true, stamp: { finished: { routeIds: [1], rallyIds: [] } } })).toEqual({ ok: true, already: false });
  });

  test("an ok answer without a stamp is not a stamp", () => {
    expect(parseStampResponse(200, { ok: true })).toEqual({ ok: false, failure: "failed" });
    expect(parseStampResponse(200, { ok: true, stamp: null })).toEqual({ ok: false, failure: "failed" });
  });

  test("a 200 without ok:true is never a stamp", () => {
    expect(parseStampResponse(200, {})).toEqual({ ok: false, failure: "failed" });
    expect(parseStampResponse(200, null)).toEqual({ ok: false, failure: "failed" });
    expect(parseStampResponse(200, "ok")).toEqual({ ok: false, failure: "failed" });
  });

  test("each refusal has its own failure", () => {
    expect(parseStampResponse(409, { ok: false, error: "guest_full" })).toEqual({ ok: false, failure: "guest_full" });
    expect(parseStampResponse(409, { ok: false, error: "too_far" })).toEqual({ ok: false, failure: "too_far" });
    expect(parseStampResponse(409, { ok: false, error: "too_far", distanceM: 240 })).toEqual({ ok: false, failure: "too_far", distanceM: 240 });
    expect(parseStampResponse(422, { ok: false, error: "gps_accuracy_poor" })).toEqual({ ok: false, failure: "low_accuracy" });
    expect(parseStampResponse(409, { ok: false, error: "stamp_revoked" })).toEqual({ ok: false, failure: "stamp_revoked" });
    expect(parseStampResponse(403, { ok: false, error: "account_restricted" })).toEqual({ ok: false, failure: "account_restricted" });
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

describe("parseMyStamps", () => {
  test("the place ids of the caller's stamps", () => {
    const body = { ok: true, stamps: [{ spotId: "a", createdAt: "x" }, { spotId: "b", createdAt: "y" }] };
    expect(parseMyStamps(200, body)).toEqual(new Set(["a", "b"]));
    expect(parseMyStamps(200, { ok: true, stamps: [] })).toEqual(new Set());
  });

  test("anything unusable is null, never an empty set that would look like 'no stamps'", () => {
    expect(parseMyStamps(401, { ok: false, error: "unauthenticated" })).toBeNull();
    expect(parseMyStamps(200, { ok: true })).toBeNull();
    expect(parseMyStamps(200, null)).toBeNull();
    expect(parseMyStamps(500, undefined)).toBeNull();
  });

  test("entries without a place id are skipped", () => {
    expect(parseMyStamps(200, { ok: true, stamps: [null, {}, { spotId: 5 }, { spotId: "a" }] })).toEqual(new Set(["a"]));
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

describe("parseMyCompletions", () => {
  test("keeps well-formed rows, drops the rest, and is empty when the answer is not usable", () => {
    const body = { ok: true, completions: [{ rallyId: "r1", completedAt: "2026-11-04T01:00:00.000Z" }, { rallyId: 2, completedAt: "x" }, { rallyId: "r3", completedAt: "not a date" }, null] };
    expect([...parseMyCompletions(200, body)]).toEqual([["r1", "2026-11-04T01:00:00.000Z"]]);
    expect(parseMyCompletions(401, body).size).toBe(0);
    expect(parseMyCompletions(200, { ok: true }).size).toBe(0);
  });
});
