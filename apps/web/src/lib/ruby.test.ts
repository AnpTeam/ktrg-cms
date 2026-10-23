import { describe, expect, test } from "bun:test";
import { isPerKanji, parseRuby, partsFor, runsOf, serializeRuby } from "./ruby";

describe("ruby markup", () => {
  test("a name is cut into runs of kanji and the rest", () => {
    expect(runsOf("友ヶ島と加太周辺").map((p) => p.text)).toEqual(["友ヶ島", "と", "加太周辺"]);
  });
  test("round trip", () => {
    const parts = [
      { text: "葛城", reading: "かつらぎ" },
      { text: "の", reading: null },
      { text: "道", reading: "みち" },
    ];
    const text = serializeRuby(parts);
    expect(text).toBe("葛城{かつらぎ}の道{みち}");
    expect(parseRuby(text)).toEqual(parts);
  });
  test("no readings gives empty text; an old whole-name reading is not per kanji", () => {
    expect(serializeRuby([{ text: "道", reading: null }])).toBe("");
    expect(isPerKanji("かつらぎのみち")).toBe(false);
    expect(parseRuby("かつらぎのみち")).toBeNull();
  });
  test("one kanji at a time", () => {
    expect(parseRuby("葛{かつ}城{らぎ}")).toEqual([
      { text: "葛", reading: "かつ" },
      { text: "城", reading: "らぎ" },
    ]);
  });
  test("a stored reading that spells another name is not used", () => {
    expect(partsFor("葛城の道", "葛城{かつらぎ}").map((p) => p.reading)).toEqual([null, null, null]);
    expect(partsFor("葛城", "葛城{かつらぎ}")).toEqual([{ text: "葛城", reading: "かつらぎ" }]);
  });
  test("a hand split survives with no readings typed yet", () => {
    const split = [{ text: "葛", reading: null }, { text: "城", reading: null }];
    const text = serializeRuby(split);
    expect(text).toBe("葛{}城{}");
    expect(parseRuby(text)).toEqual(split);
    expect(serializeRuby([{ text: "葛城", reading: null }])).toBe("");
  });
  test("broken markup is ignored", () => {
    expect(parseRuby("葛城{かつ")).toBeNull();
  });
});
