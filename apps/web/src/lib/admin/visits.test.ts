import { describe, expect, test } from "bun:test";
import { barPercent, countryName, regionName } from "./visits";

describe("visit places", () => {
  test("Japanese regions are prefectures; others keep the host's code", () => {
    expect(regionName("JP", "29")).toBe("奈良県");
    expect(regionName("JP", "01")).toBe("北海道");
    expect(regionName("JP", "47")).toBe("沖縄県");
    expect(regionName("JP", "99")).toBe("99");
    expect(regionName("US", "CA")).toBe("CA");
    expect(regionName("JP", "")).toBe("");
  });

  test("countries are named in the reader's language; unknown stays empty", () => {
    expect(countryName("JP", "en")).toBe("Japan");
    expect(countryName("JP", "ja")).toBe("日本");
    expect(countryName("", "en")).toBe("");
  });

  test("a bar is proportional and always visible", () => {
    expect(barPercent(50, 100)).toBe(50);
    expect(barPercent(1, 1000)).toBe(2);
    expect(barPercent(0, 0)).toBe(0);
  });
});
