import { describe, expect, test } from "bun:test";
import { municipalities, municipalityName, prefectureOfCity, splitCities, towns } from "./municipalities";

describe("municipalities", () => {
  test("a listed city or town knows its prefecture, a name typed in does not", () => {
    expect(prefectureOfCity("和歌山市")).toBe("wakayama");
    expect(prefectureOfCity("堺市")).toBe("osaka");
    expect(prefectureOfCity("御所市")).toBe("nara");
    expect(prefectureOfCity("岬町")).toBe("osaka");
    expect(prefectureOfCity("千早赤阪村")).toBe("osaka");
    expect(prefectureOfCity("かつらぎ町")).toBe("wakayama");
    expect(prefectureOfCity("明日香村")).toBe("nara");
    expect(prefectureOfCity("架空町")).toBeNull();
  });
  test("the number of towns and villages per prefecture", () => {
    expect(towns.wakayama).toHaveLength(21);
    expect(towns.osaka).toHaveLength(10);
    expect(towns.nara).toHaveLength(27);
  });
  test("the number of cities per prefecture", () => {
    expect(municipalities.wakayama).toHaveLength(9);
    expect(municipalities.osaka).toHaveLength(33);
    expect(municipalities.nara).toHaveLength(12);
  });

  test("no name is listed twice, across cities and towns, and every English name is filled in", () => {
    const all = [...Object.values(municipalities), ...Object.values(towns)].flat();
    expect(new Set(all.map((c) => c.ja)).size).toBe(all.length);
    expect(all.every((c) => c.en.trim() !== "" && /^[A-Za-z ]+$/.test(c.en))).toBe(true);
    expect(towns.nara.every((c) => /(町|村)$/.test(c.ja))).toBe(true);
  });

  test("English pages show the English name of a listed city, anything else as typed", () => {
    expect(municipalityName("en", ["和歌山市"])).toBe("Wakayama City");
    expect(municipalityName("ja", ["和歌山市"])).toBe("和歌山市");
    expect(municipalityName("en", ["岬町"])).toBe("Misaki Town");
    expect(municipalityName("en", ["架空町"])).toBe("架空町");
    expect(municipalityName("en", ["  "])).toBeNull();
    expect(municipalityName("en", [])).toBeNull();
  });

  test("a course that crosses from one city into another lists them in order, each named for the page's language", () => {
    expect(municipalityName("ja", ["和歌山市", "岬町"])).toBe("和歌山市 → 岬町");
    expect(municipalityName("en", ["和歌山市", "岬町"])).toBe("Wakayama City → Misaki Town");
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
