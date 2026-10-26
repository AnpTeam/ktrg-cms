import { expect, test } from "bun:test";
import { wordMatcher } from "./furigana-words";
import { hasHardKanji, isHardKanji } from "./kyoiku-kanji";

const match = wordMatcher({ 葛城: "葛城{かつらぎ}", 葛城山: "葛城{かつらぎ}山{さん}", 取り扱い: "取{と}り扱{あつか}い" });

test("the longest listed word wins, and the rest stays plain", () => {
  expect(match("葛城山を歩く")).toEqual([{ t: "葛城", r: "かつらぎ" }, { t: "山", r: "さん" }, { t: "を歩く" }]);
  expect(match("葛城へ")).toEqual([{ t: "葛城", r: "かつらぎ" }, { t: "へ" }]);
  expect(match("取り扱い")).toEqual([{ t: "取", r: "と" }, { t: "り" }, { t: "扱", r: "あつか" }, { t: "い" }]);
  expect(match("山道")).toEqual([{ t: "山道" }]);
});

test("an empty list changes nothing", () => {
  expect(wordMatcher({})("葛城")).toEqual([{ t: "葛城" }]);
});

test("hard kanji are the ones outside the elementary-school list", () => {
  expect(isHardKanji("葛")).toBe(true);
  expect(isHardKanji("山")).toBe(false);
  expect(isHardKanji("々")).toBe(false);
  expect(isHardKanji("あ")).toBe(false);
  expect(hasHardKanji("修験")).toBe(false); // both are taught in elementary school
  expect(hasHardKanji("葛城")).toBe(true);
});
