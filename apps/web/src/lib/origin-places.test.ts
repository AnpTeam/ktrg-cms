import { describe, expect, test } from "bun:test";
import { COUNTRY_REGIONS, countryOptions, originOfPlace, placeName, placeOfOrigin, PREFECTURE_REGIONS } from "./origin-places";

describe("origin places", () => {
  test("all 47 prefectures once each, Kinki first with the trails' three on top", () => {
    const all = PREFECTURE_REGIONS.flatMap((r) => r.prefectures.map((p) => p.code));
    expect(new Set(all).size).toBe(47);
    expect(all.slice(0, 3)).toEqual(["JP-27", "JP-30", "JP-29"]);
    expect(PREFECTURE_REGIONS[0]!.ja).toBe("近畿地方");
  });

  test("every country has one part of the world, a real name, and Japan is not among them", () => {
    const all = COUNTRY_REGIONS.flatMap((r) => r.countries);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain("JP");
    expect(all.every((c) => /^[A-Z]{2}$/.test(c) && placeName(c, "en") !== c)).toBe(true);
  });

  test("names follow the language, and countries come sorted by name", () => {
    expect(placeName("JP-30", "ja")).toBe("和歌山県");
    expect(placeName("JP-30", "en")).toBe("Wakayama");
    expect(placeName("TH", "en")).toBe("Thailand");
    expect(placeName("ZZ", "en")).toBeNull();
    expect(countryOptions(["US", "TH", "AU"], "en").map((c) => c.code)).toEqual(["AU", "TH", "US"]);
  });

  test("a place gives the plain answer, and an old answer gives its place", () => {
    expect(["JP-27", "JP-30", "JP-29", "JP-13", "TH"].map(originOfPlace)).toEqual(["osaka", "wakayama", "nara", "other_japan", "overseas"]);
    expect(placeOfOrigin("nara")).toBe("JP-29");
    expect(placeOfOrigin("other_japan")).toBeNull();
  });
});
