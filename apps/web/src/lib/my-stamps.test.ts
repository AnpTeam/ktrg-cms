import { describe, expect, test } from "bun:test";
import { myStampsFromRows } from "./my-stamps";
import { parseMyStampRows } from "./stamp-flow";

describe("parseMyStampRows", () => {
  test("keeps the place and the course; a missing course id becomes null", () => {
    const body = { ok: true, stamps: [{ spotId: "a", routeId: "r1", createdAt: "x" }, { spotId: "b", createdAt: "y" }, { spotId: "c", routeId: "" }] };
    expect(parseMyStampRows(200, body)).toEqual([
      { spotId: "a", routeId: "r1", createdAt: null }, // "x" is not a time
      { spotId: "b", routeId: null, createdAt: null },
      { spotId: "c", routeId: null, createdAt: null },
    ]);
  });

  test("an unusable answer is null, so it is never mistaken for 'no stamps'", () => {
    expect(parseMyStampRows(401, { ok: false })).toBeNull();
    expect(parseMyStampRows(200, { ok: true })).toBeNull();
    expect(parseMyStampRows(200, null)).toBeNull();
  });
});

describe("myStampsFromRows", () => {
  test("place ids, and a count per course", () => {
    const m = myStampsFromRows([
      { spotId: "a", routeId: "r1" },
      { spotId: "b", routeId: "r1" },
      { spotId: "c", routeId: "r2" },
      { spotId: "d", routeId: null },
    ]);
    expect(m.ids).toEqual(new Set(["a", "b", "c", "d"]));
    expect(m.byRoute.get("r1")).toBe(2);
    expect(m.byRoute.get("r2")).toBe(1);
    expect(m.byRoute.size).toBe(2);
  });

  test("no stamps gives empty sets", () => {
    const m = myStampsFromRows([]);
    expect(m.ids.size).toBe(0);
    expect(m.byRoute.size).toBe(0);
  });
});

describe("when each place was stamped", () => {
  test("the latest time of each place is kept; a row without a usable time adds none", () => {
    const rows = parseMyStampRows(200, { ok: true, stamps: [{ spotId: "a", routeId: "r", createdAt: "2026-11-01T00:00:00Z" }, { spotId: "a", routeId: "r", createdAt: "2026-11-04T00:00:00Z" }, { spotId: "b", routeId: null, createdAt: "nope" }] })!;
    expect([...myStampsFromRows(rows).at]).toEqual([["a", "2026-11-04T00:00:00Z"]]);
  });
});
