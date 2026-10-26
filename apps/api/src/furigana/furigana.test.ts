import { expect, test } from "bun:test";
import { createFuriganaService, loadKuromoji, partsOfWord, partsOfWords } from "./furigana";

test("a word's reading is narrowed to its kanji", () => {
  expect(partsOfWord("歩い", "アルイ")).toEqual([{ t: "歩", r: "ある" }, { t: "い" }]);
  expect(partsOfWord("お願い", "オネガイ")).toEqual([{ t: "お" }, { t: "願", r: "ねが" }, { t: "い" }]);
  expect(partsOfWord("葛城", "カツラギ")).toEqual([{ t: "葛城", r: "かつらぎ" }]);
  expect(partsOfWord("取り扱い", "トリアツカイ")).toEqual([{ t: "取り扱", r: "とりあつか" }, { t: "い" }]);
  expect(partsOfWord("の", "ノ")).toEqual([{ t: "の" }]);
  expect(partsOfWord("19", "*")).toEqual([{ t: "19" }]);
});

test("plain neighbours are joined", () => {
  expect(partsOfWords([{ surface: "と" }, { surface: "山", reading: "ヤマ" }, { surface: "を" }, { surface: "見る", reading: "ミル" }])).toEqual([
    { t: "と" },
    { t: "山", r: "やま" },
    { t: "を" },
    { t: "見", r: "み" },
    { t: "る" },
  ]);
});

test("the service skips texts without kanji and keeps answers", async () => {
  let calls = 0;
  const service = createFuriganaService(async () => ({
    tokenize: () => {
      calls++;
      return [{ surface_form: "山", reading: "ヤマ" }];
    },
  }));
  expect(await service.readings(["やま", "山", "山"])).toEqual([[{ t: "やま" }], [{ t: "山", r: "やま" }], [{ t: "山", r: "やま" }]]);
  expect(calls).toBe(1);
});

test("with the real dictionary", async () => {
  const [r] = await createFuriganaService(loadKuromoji).readings(["葛城修験の道を歩く"]);
  expect(r!.filter((p) => p.r).map((p) => `${p.t}${p.r}`)).toEqual(["葛城かつらぎ", "修験しゅげん", "道みち", "歩ある"]);
});
