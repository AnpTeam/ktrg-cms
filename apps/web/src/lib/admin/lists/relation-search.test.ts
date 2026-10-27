import { describe, expect, test } from "bun:test";
import { matchChoices } from "./relation-search";

const names = ["金剛山 ロープウェイ駅", "葛城 カフェ", "ＣＡＦＥ Katsuragi", "公衆トイレ"].map((name, i) => ({ id: String(i), name }));

describe("matchChoices", () => {
  test("nothing typed keeps every choice in order", () => {
    expect(matchChoices(names, "  ").map((c) => c.id)).toEqual(["0", "1", "2", "3"]);
  });

  test("part of a name matches, ignoring case and full-width letters", () => {
    expect(matchChoices(names, "cafe").map((c) => c.id)).toEqual(["2"]);
    expect(matchChoices(names, "カフェ").map((c) => c.id)).toEqual(["1"]);
    expect(matchChoices(names, "駅").map((c) => c.id)).toEqual(["0"]);
  });

  test("no match is an empty list", () => {
    expect(matchChoices(names, "温泉")).toEqual([]);
  });
});
