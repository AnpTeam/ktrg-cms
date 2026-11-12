import { describe, expect, test } from "bun:test";
import { courseProgress, placeProgress, type HeldStamp, type PlaceMember } from "./progress";

const member = (id: string, over: Partial<PlaceMember> = {}): PlaceMember => ({ spotId: id, published: true, status: "open", ...over });
const stamp = (id: string, at: string, revokedAt: string | null = null): HeldStamp => ({
  spotId: id,
  createdAt: new Date(at),
  revokedAt: revokedAt ? new Date(revokedAt) : null,
});

describe("placeProgress (a course's stamp places, or a rally of places)", () => {
  const members = [member("a"), member("b"), member("c"), member("d")];

  test("counts the places stamped, and when the latest was", () => {
    const p = placeProgress({ members, stamps: [stamp("a", "2026-10-10T00:00:00Z"), stamp("c", "2026-10-12T00:00:00Z")] });
    expect(p).toMatchObject({ total: 4, stamped: 2, waived: 0, complete: false });
    expect(p.lastStampedAt).toEqual(new Date("2026-10-12T00:00:00Z"));
  });

  test("every place stamped finishes it", () => {
    expect(placeProgress({ members, stamps: members.map((m) => stamp(m.spotId, "2026-10-10T00:00:00Z")) })).toMatchObject({ stamped: 4, complete: true });
  });

  test("a stamp for a place that is not in it changes nothing", () => {
    expect(placeProgress({ members, stamps: [stamp("zzz", "2026-10-10T00:00:00Z")] })).toMatchObject({ stamped: 0, lastStampedAt: null });
  });

  test("a revoked stamp counts for nothing, and the latest valid time is used", () => {
    const p = placeProgress({ members, stamps: [stamp("a", "2026-10-10T00:00:00Z"), stamp("b", "2026-10-14T00:00:00Z", "2026-10-15T00:00:00Z")] });
    expect(p.stamped).toBe(1);
    expect(p.lastStampedAt).toEqual(new Date("2026-10-10T00:00:00Z"));
  });

  test("draft places never count: not in the total, not as stamped", () => {
    const p = placeProgress({ members: [member("a"), member("b", { published: false })], stamps: [stamp("b", "2026-10-10T00:00:00Z")] });
    expect(p).toMatchObject({ total: 1, stamped: 0, complete: false, lastStampedAt: null });
  });

  test("an information place is not a stamp place: it is left out of the total and never blocks finishing", () => {
    const withInfo = [member("a"), member("b", { status: "info" })];
    expect(placeProgress({ members: withInfo, stamps: [stamp("a", "2026-10-10T00:00:00Z")] })).toMatchObject({ total: 1, stamped: 1, waived: 0, complete: true });
    expect(placeProgress({ members: [member("b", { status: "info" })], stamps: [] })).toMatchObject({ total: 0, complete: false });
  });

  test("a closed place counts as done, until it reopens, unless it was stamped", () => {
    const closed = [member("a"), member("b", { status: "closed" })];
    expect(placeProgress({ members: closed, stamps: [stamp("a", "2026-10-10T00:00:00Z")] })).toMatchObject({ stamped: 1, waived: 1, complete: true });
    expect(placeProgress({ members: closed, stamps: [stamp("b", "2026-10-10T00:00:00Z")] })).toMatchObject({ stamped: 1, waived: 0, complete: false });
    expect(placeProgress({ members: [member("a"), member("b")], stamps: [stamp("a", "2026-10-10T00:00:00Z")] }).complete).toBe(false);
  });

  test("nothing published is never finished", () => {
    expect(placeProgress({ members: [], stamps: [] })).toMatchObject({ total: 0, complete: false });
    expect(placeProgress({ members: [member("a", { published: false })], stamps: [] }).complete).toBe(false);
  });

  test("ONE stamp counts in every set that includes the place (its course and a rally of places)", () => {
    const held = [stamp("mound-1", "2026-10-10T00:00:00Z")];
    expect(placeProgress({ members: [member("mound-1"), member("mound-2")], stamps: held }).stamped).toBe(1);
    expect(placeProgress({ members: [member("mound-1"), member("waypoint-1")], stamps: held }).stamped).toBe(1);
  });
});

describe("courseProgress (a rally of courses)", () => {
  test("finished when every course in it is finished", () => {
    expect(courseProgress({ routeIds: ["r1", "r2"], finishedRouteIds: new Set(["r1"]) })).toEqual({ total: 2, finished: 1, complete: false });
    expect(courseProgress({ routeIds: ["r1", "r2"], finishedRouteIds: new Set(["r1", "r2", "r9"]) })).toEqual({ total: 2, finished: 2, complete: true });
  });

  test("a rally with no courses is never finished", () => {
    expect(courseProgress({ routeIds: [], finishedRouteIds: new Set(["r1"]) })).toEqual({ total: 0, finished: 0, complete: false });
  });
});
