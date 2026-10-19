import { describe, expect, test } from "bun:test";
import { isListedMunicipality, municipalities, municipalitiesOf, municipalityName } from "./municipalities";

describe("municipalities", () => {
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

  test("a prefecture with none chosen offers no cities", () => {
    expect(municipalitiesOf(null)).toEqual([]);
    expect(municipalitiesOf("nara").map((c) => c.ja)).toContain("葛城市");
  });

  test("tells a listed city from one typed by hand", () => {
    expect(isListedMunicipality("wakayama", "和歌山市")).toBe(true);
    expect(isListedMunicipality("wakayama", "岬町")).toBe(false);
    expect(isListedMunicipality("nara", "和歌山市")).toBe(false);
    expect(isListedMunicipality(null, "和歌山市")).toBe(false);
  });

  test("English pages show the English name of a listed city, anything else as typed", () => {
    expect(municipalityName("en", "和歌山市")).toBe("Wakayama City");
    expect(municipalityName("ja", "和歌山市")).toBe("和歌山市");
    expect(municipalityName("en", "岬町")).toBe("岬町");
    expect(municipalityName("en", "  ")).toBeNull();
    expect(municipalityName("en", null)).toBeNull();
  });
});
