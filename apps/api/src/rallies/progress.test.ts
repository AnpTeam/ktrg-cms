import { describe, expect, test } from "bun:test";
import { computeProgress, type HeldStamp, type RallyMember } from "./progress";

const member = (id: string, over: Partial<RallyMember> = {}): RallyMember => ({ spotId: id, published: true, status: "open", ...over });
const stamp = (id: string, at: string, revokedAt: string | null = null): HeldStamp => ({
  spotId: id,
  createdAt: new Date(at),
  revokedAt: revokedAt ? new Date(revokedAt) : null,
});

describe("computeProgress", () => {
  const members = [member("a"), member("b"), member("c"), member("d")];

  test("counts the places stamped, and when the latest was", () => {
    const p = computeProgress({
      members,
      stamps: [stamp("a", "2026-10-10T00:00:00Z"), stamp("c", "2026-10-12T00:00:00Z")],
      stampsRequired: null,
    });
    expect(p).toMatchObject({ total: 4, stamped: 2, waived: 0, required: 4, complete: false });
    expect(p.lastStampedAt).toEqual(new Date("2026-10-12T00:00:00Z"));
  });

  test("every place stamped completes the rally", () => {
    const p = computeProgress({ members, stamps: members.map((m) => stamp(m.spotId, "2026-10-10T00:00:00Z")), stampsRequired: null });
    expect(p).toMatchObject({ stamped: 4, complete: true });
  });

  test("a stamp for a place that is not in the rally changes nothing", () => {
    expect(computeProgress({ members, stamps: [stamp("zzz", "2026-10-10T00:00:00Z")], stampsRequired: null })).toMatchObject({
      stamped: 0,
      lastStampedAt: null,
    });
  });

  test("a revoked stamp counts for nothing, and the latest valid time is used", () => {
    const p = computeProgress({
      members,
      stamps: [stamp("a", "2026-10-10T00:00:00Z"), stamp("b", "2026-10-14T00:00:00Z", "2026-10-15T00:00:00Z")],
      stampsRequired: null,
    });
    expect(p.stamped).toBe(1);
    expect(p.lastStampedAt).toEqual(new Date("2026-10-10T00:00:00Z"));
  });

  test("draft places never count: not in the total, not as stamped", () => {
    const p = computeProgress({
      members: [member("a"), member("b", { published: false })],
      stamps: [stamp("b", "2026-10-10T00:00:00Z")],
      stampsRequired: null,
    });
    expect(p).toMatchObject({ total: 1, stamped: 0, complete: false, lastStampedAt: null });
  });

  test("a closed place counts as done for the rally, until it reopens, unless it was stamped", () => {
    const closed = [member("a"), member("b", { status: "closed" })];
    expect(computeProgress({ members: closed, stamps: [stamp("a", "2026-10-10T00:00:00Z")], stampsRequired: null })).toMatchObject({
      stamped: 1,
      waived: 1,
      complete: true,
    });
    // stamped AND closed: counted once, as stamped
    expect(computeProgress({ members: closed, stamps: [stamp("b", "2026-10-10T00:00:00Z")], stampsRequired: null })).toMatchObject({
      stamped: 1,
      waived: 0,
      complete: false,
    });
    // reopened: no longer waived
    const reopened = [member("a"), member("b")];
    expect(computeProgress({ members: reopened, stamps: [stamp("a", "2026-10-10T00:00:00Z")], stampsRequired: null }).complete).toBe(false);
  });

  test("a rally can need fewer places than it has, never more than it has", () => {
    const two = [stamp("a", "2026-10-10T00:00:00Z"), stamp("b", "2026-10-10T00:00:00Z")];
    expect(computeProgress({ members, stamps: two, stampsRequired: 2 })).toMatchObject({ required: 2, complete: true });
    expect(computeProgress({ members, stamps: two, stampsRequired: 10 })).toMatchObject({ required: 4, complete: false });
  });

  test("a rally with no published places is never complete", () => {
    expect(computeProgress({ members: [], stamps: [], stampsRequired: null })).toMatchObject({ total: 0, complete: false });
    expect(computeProgress({ members: [member("a", { published: false })], stamps: [], stampsRequired: null }).complete).toBe(false);
  });

  test("ONE stamp counts in every rally that includes the place", () => {
    const heldStamps = [stamp("mound-1", "2026-10-10T00:00:00Z")];
    const moundRally = [member("mound-1"), member("mound-2")];
    const courseRally = [member("mound-1"), member("waypoint-1")];
    expect(computeProgress({ members: moundRally, stamps: heldStamps, stampsRequired: null }).stamped).toBe(1);
    expect(computeProgress({ members: courseRally, stamps: heldStamps, stampsRequired: null }).stamped).toBe(1);
  });
});
