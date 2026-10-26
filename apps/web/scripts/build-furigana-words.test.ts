import { expect, test } from "bun:test";
import { markupFor } from "./build-furigana-words";

test("a reading is put over the kanji it belongs to", () => {
  expect(markupFor("葛城", "カツラギ")).toBe("葛城{かつらぎ}");
  expect(markupFor("取り扱い", "トリアツカイ")).toBe("取{と}り扱{あつか}い");
  expect(markupFor("お勧め", "オススメ")).toBe("お勧{すす}め");
  expect(markupFor("葛城山", "カツラギサン")).toBe("葛城山{かつらぎさん}");
});

test("words with no hard kanji, no reading or a reading that does not line up give nothing", () => {
  expect(markupFor("山道", "ヤマミチ")).toBeNull();
  expect(markupFor("友ヶ島", "トモガシマ")).toBeNull(); // every kanji is an elementary-school one
  expect(markupFor("葛城", undefined)).toBeNull();
  expect(markupFor("葛城", "*")).toBeNull();
  expect(markupFor("取り扱い", "ゼンゼンチガウ")).toBeNull();
});
