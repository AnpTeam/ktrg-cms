import { describe, expect, test } from "bun:test";
import { filterByPrefecture, filterByPrefectures, isPrefecture, parsePrefectures, pickText, prefecturesOf, sampleContentEnabled } from "./content";
import { formatDayTime, formatUpdated } from "./format";

describe("pickText", () => {
  test("Japanese UI uses Japanese", () => {
    expect(pickText("ja", "山", "Mountain")).toEqual({ text: "山", lang: "ja", fallback: false });
  });

  test("English UI uses English when it was entered", () => {
    expect(pickText("en", "山", "Mountain")).toEqual({ text: "Mountain", lang: "en", fallback: false });
  });

  test("English UI falls back to Japanese and says so", () => {
    expect(pickText("en", "山", null)).toEqual({ text: "山", lang: "ja", fallback: true });
    expect(pickText("en", "山", "")).toEqual({ text: "山", lang: "ja", fallback: true });
  });

  test("returns null when there is nothing to show", () => {
    expect(pickText("ja", null, null)).toBeNull();
    // Japanese is the required language: English alone is not shown in the Japanese UI.
    expect(pickText("ja", null, "Mountain")).toBeNull();
  });
});

describe("prefecture filter", () => {
  const routes = [
    { id: "a", prefecture: "nara" as const },
    { id: "b", prefecture: "osaka" as const },
    { id: "c", prefecture: null },
  ];

  test("only the three known prefectures are accepted", () => {
    expect(isPrefecture("nara")).toBe(true);
    expect(isPrefecture("tokyo")).toBe(false);
    expect(isPrefecture(undefined)).toBe(false);
  });

  test("filters, and leaves everything when no prefecture is chosen", () => {
    expect(filterByPrefecture(routes, "nara").map((r) => r.id)).toEqual(["a"]);
    expect(filterByPrefecture(routes, undefined)).toHaveLength(3);
  });
});

describe("formatDayTime", () => {
  test("a full date with the time, in Japan time, rolling over to the next day", () => {
    const NBSP = String.fromCharCode(160);
    expect(formatDayTime("ja", "2026-10-15T05:30:00Z")).toBe("2026年10月15日" + NBSP + "14:30");
    expect(formatDayTime("en", "2026-10-15T05:30:00Z")).toBe("Oct 15, 2026," + NBSP + "14:30");
    expect(formatDayTime("ja", "2026-10-15T16:05:00Z")).toBe("2026年10月16日" + NBSP + "01:05");
  });
});

describe("formatUpdated", () => {
  const NBSP = String.fromCharCode(160); // date and time never split across lines
  // 05:30 UTC is 14:30 in Japan (UTC+9, no daylight saving).
  test("shows Japan time", () => {
    expect(formatUpdated("ja", "2026-10-15T05:30:00Z")).toBe("10月15日" + NBSP + "14:30");
    expect(formatUpdated("en", "2026-10-15T05:30:00Z")).toBe("Oct 15," + NBSP + "14:30");
  });

  test("rolls over to the next day in Japan", () => {
    expect(formatUpdated("ja", "2026-10-14T23:10:00Z")).toBe("10月15日" + NBSP + "08:10");
  });
});

describe("sampleContentEnabled", () => {
  test("on by default in development and Vercel previews, off in production", () => {
    expect(sampleContentEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(sampleContentEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(true);
    expect(sampleContentEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
    expect(sampleContentEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(sampleContentEnabled({})).toBe(false);
  });

  test("the flag decides when it is set", () => {
    expect(sampleContentEnabled({ NODE_ENV: "production", SHOW_SAMPLE_CONTENT: "1" })).toBe(true);
    expect(sampleContentEnabled({ NODE_ENV: "development", SHOW_SAMPLE_CONTENT: "0" })).toBe(false);
  });
});

describe("courses through several prefectures", () => {
  const r = (id: string, prefecture: "osaka" | "wakayama" | "nara" | null, municipalities: string[]) => ({ id, prefecture, municipalities });
  const routes = [r("a", "wakayama", ["和歌山市", "海南市"]), r("b", "osaka", ["河内長野市", "御所市"]), r("c", "nara", ["御所市"]), r("d", null, [])];

  test("a course's prefectures are its own plus those of its listed cities", () => {
    expect(prefecturesOf(routes[1]!).sort()).toEqual(["nara", "osaka"]);
    expect(prefecturesOf(routes[3]!)).toEqual([]);
  });

  test("choosing prefectures keeps the courses that pass through all of them", () => {
    expect(filterByPrefectures(routes, ["osaka"]).map((x) => x.id)).toEqual(["b"]);
    expect(filterByPrefectures(routes, ["osaka", "nara"]).map((x) => x.id)).toEqual(["b"]);
    expect(filterByPrefectures(routes, ["nara"]).map((x) => x.id)).toEqual(["b", "c"]);
    expect(filterByPrefectures(routes, ["wakayama", "nara"])).toEqual([]);
    expect(filterByPrefectures(routes, [])).toHaveLength(4);
  });

  test("the address ?pref=osaka,nara is read, ignoring unknown and repeated names", () => {
    expect(parsePrefectures("osaka,nara")).toEqual(["osaka", "nara"]);
    expect(parsePrefectures("nara,tokyo,nara")).toEqual(["nara"]);
    expect(parsePrefectures(undefined)).toEqual([]);
  });
});
