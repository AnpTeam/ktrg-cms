import { describe, expect, test } from "bun:test";
import { municipalities, municipalityName, prefectureOfCity, splitCities } from "./municipalities";

describe("municipalities", () => {
  test("a listed city knows its prefecture, a typed town does not", () => {
    expect(prefectureOfCity("和歌山市")).toBe("wakayama");
    expect(prefectureOfCity("堺市")).toBe("osaka");
    expect(prefectureOfCity("御所市")).toBe("nara");
    expect(prefectureOfCity("岬町")).toBeNull();
  });
  test("the number of cities per prefecture", () => {
    expect(municipalities.wakayama).toHaveLength(9);
    expect(municipalities.osaka).toHaveLength(33);
    expect(municipalities.nara).toHaveLength(12);
  });

  test("no name is listed twice, and every English name is filled in", () => {
    for (const list of Object.values(municipalities)) {
      expect(new Set(list.map((c) => c.ja)).size).toBe(list.length);
      expect(list.every((c) => c.en.trim() !== "" && /^[A-Za-z ]+$/.test(c.en))).toBe(true);
    }
  });

  test("English pages show the English name of a listed city, anything else as typed", () => {
    expect(municipalityName("en", ["和歌山市"])).toBe("Wakayama City");
    expect(municipalityName("ja", ["和歌山市"])).toBe("和歌山市");
    expect(municipalityName("en", ["岬町"])).toBe("岬町");
    expect(municipalityName("en", ["  "])).toBeNull();
    expect(municipalityName("en", [])).toBeNull();
  });

  test("a course that crosses from one city into another lists them in order, each named for the page's language", () => {
    expect(municipalityName("ja", ["和歌山市", "岬町"])).toBe("和歌山市 → 岬町");
    expect(municipalityName("en", ["和歌山市", "岬町"])).toBe("Wakayama City → 岬町");
    expect(municipalityName("en", ["和歌山市", " ", "海南市"])).toBe("Wakayama City → Kainan City");
  });

  test("a sheet cell with several cities is split in walking order, whatever comma it uses", () => {
    expect(splitCities("和歌山市、岬町")).toEqual(["和歌山市", "岬町"]);
    expect(splitCities(" 和歌山市 , 海南市，紀の川市, ")).toEqual(["和歌山市", "海南市", "紀の川市"]);
    expect(splitCities("和歌山市")).toEqual(["和歌山市"]);
    expect(splitCities("、")).toEqual([]);
    expect(splitCities("")).toEqual([]);
  });
});
