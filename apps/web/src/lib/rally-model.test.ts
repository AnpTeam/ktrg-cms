import { describe, expect, test } from "bun:test";
import {
  isSoon,
  nextSlot,
  otherRallies,
  pickFeatured,
  sealName,
  stampedNumbers,
  type RallyItem,
} from "./rally-model";

const slots = (flags: boolean[]) =>
  flags.map((stamped, i) => ({ id: `s${i + 1}`, number: i + 1, nameJa: `場所${i + 1}`, nameEn: null, stamped }));

const rally = (over: Partial<RallyItem> & { id: string }): RallyItem => ({
  kind: "course",
  order: 1,
  nameJa: over.id,
  nameEn: null,
  routeId: null,
  total: 3,
  stamped: 0,
  lastStampedAt: null,
  slots: slots([false, false, false]),
  ...over,
});

const mounds = rally({ id: "mounds", kind: "mounds", order: 0, total: 31, stamped: 6, lastStampedAt: "2026-10-14T09:40:00+09:00" });
const c1 = rally({ id: "c1", order: 1, lastStampedAt: "2026-10-12T15:10:00+09:00" });
const c2 = rally({ id: "c2", order: 2, lastStampedAt: "2026-10-15T11:25:00+09:00" });
const c3 = rally({ id: "c3", order: 3, total: 0, slots: [], stamped: null });
const c4 = rally({ id: "c4", order: 4 });

describe("pickFeatured", () => {
  test("the rally stamped in most recently", () => {
    expect(pickFeatured([mounds, c1, c2, c3, c4])?.id).toBe("c2");
  });

  test("a rally with no places is never featured, even if it has a time", () => {
    const odd = rally({ id: "odd", order: 5, total: 0, slots: [], lastStampedAt: "2030-01-01T00:00:00+09:00" });
    expect(pickFeatured([mounds, odd])?.id).toBe("mounds");
  });

  test("nothing stamped yet: the mound rally, the main one", () => {
    const fresh = [mounds, c1, c4].map((r) => ({ ...r, lastStampedAt: null }));
    expect(pickFeatured(fresh)?.id).toBe("mounds");
  });

  test("no mound rally and nothing stamped: the first ready one; nothing ready: null", () => {
    expect(pickFeatured([c4, c1].map((r) => ({ ...r, lastStampedAt: null })))?.id).toBe("c4");
    expect(pickFeatured([c3])).toBeNull();
    expect(pickFeatured([])).toBeNull();
  });
});

describe("otherRallies", () => {
  test("everything but the featured one, the mound rally first and then by course", () => {
    expect(otherRallies([c4, c2, mounds, c1, c3], c2).map((r) => r.id)).toEqual(["mounds", "c1", "c3", "c4"]);
  });

  test("with nothing featured, all of them", () => {
    expect(otherRallies([c2, c1], null).map((r) => r.id)).toEqual(["c1", "c2"]);
  });
});

describe("slots", () => {
  test("the next place is the first one not stamped; none when all are", () => {
    const r = rally({ id: "x", stamped: 2, slots: slots([true, true, false]) });
    expect(nextSlot(r)?.number).toBe(3);
    expect(nextSlot(rally({ id: "y", stamped: 3, slots: slots([true, true, true]) }))).toBeUndefined();
  });

  test("the stamped numbers, for the grid", () => {
    expect([...stampedNumbers(rally({ id: "x", slots: slots([true, false, true]) }))]).toEqual([1, 3]);
  });

  test("soon means no places", () => {
    expect(isSoon(c3)).toBe(true);
    expect(isSoon(c1)).toBe(false);
  });
});

describe("sealName", () => {
  test("shows only the chapter: the part after the last ・", () => {
    expect(sealName("友ヶ島・序品")).toBe("序品");
    expect(sealName("犬鳴山七宝龍寺鈴杵ヶ嶽・五百弟子受記品")).toBe("五百弟子受記品");
  });

  test("a name with no separator is shown as it is", () => {
    expect(sealName("経塚")).toBe("経塚");
  });
});
