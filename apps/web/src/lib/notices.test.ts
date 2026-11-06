import { describe, expect, test } from "bun:test";
import { isWebUrl } from "./format";
import { activeNotices, todayInJapan, type TrailNotice } from "./notices";

const make = (id: string, verifiedOn: string, expiresOn: string | null): TrailNotice => ({
  id,
  titleJa: id,
  titleEn: null,
  bodyJa: "",
  bodyEn: null,
  sourceUrl: "https://example.org/",
  sourceNameJa: "出典",
  sourceNameEn: null,
  verifiedOn,
  expiresOn,
  routeId: null,
});

describe("activeNotices", () => {
  test("drops expired notices, keeps the expiry day itself and open-ended ones", () => {
    const list = [make("old", "2026-10-01", "2026-10-10"), make("last-day", "2026-10-02", "2026-10-16"), make("open", "2026-10-03", null)];
    expect(activeNotices(list, "2026-10-16").map((n) => n.id)).toEqual(["open", "last-day"]);
  });

  test("puts the most recently checked first and does not change the input", () => {
    const list = [make("a", "2026-10-01", null), make("b", "2026-10-09", null)];
    expect(activeNotices(list, "2026-10-16").map((n) => n.id)).toEqual(["b", "a"]);
    expect(list.map((n) => n.id)).toEqual(["a", "b"]);
  });
});

test("todayInJapan uses Japan time, not UTC", () => {
  expect(todayInJapan(new Date("2026-10-16T16:00:00Z"))).toBe("2026-10-17");
});

test("only web links are rendered", () => {
  expect(isWebUrl("https://example.org")).toBe(true);
  expect(isWebUrl("javascript:alert(1)")).toBe(false);
});
