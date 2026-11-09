import { describe, expect, test } from "bun:test";
import { dictionaryWords, loadTokenizer, type Token, type Tokenizer } from "./dictionary";

// A pretend dictionary: each text is already cut into its tokens.
const fake = (cuts: Record<string, Token[]>): Tokenizer => ({ tokenize: (text) => cuts[text] ?? [] });

describe("dictionaryWords", () => {
  test("only words with a hard kanji, never a proper noun, never one without a reading, never one already handled", () => {
    const tokenizer = fake({
      "渓谷の季節に転法輪寺と葛城山へ": [
        { surface_form: "渓谷", reading: "ケイコク" },
        { surface_form: "の", reading: "ノ" },
        { surface_form: "季節", reading: "キセツ" }, // 季 and 節 are taught in elementary school
        { surface_form: "転法輪寺", reading: "テンポウリンジ", pos_detail_1: "固有名詞" },
        { surface_form: "葛城山", reading: "カツラギサン" },
        { surface_form: "鎧", reading: "*" },
      ],
    });
    const words = dictionaryWords(tokenizer, ["渓谷の季節に転法輪寺と葛城山へ"], (w) => w === "葛城山");
    expect([...words]).toEqual([["渓谷", "ケイコク"]]);
  });

  test("a text with no hard kanji is not read at all", () => {
    let calls = 0;
    const tokenizer: Tokenizer = { tokenize: () => (calls++, []) };
    dictionaryWords(tokenizer, ["山に行きます", "ありがとう"], () => false);
    expect(calls).toBe(0);
  });
});

describe("the real dictionary", () => {
  test("kuromoji loads in the API and reads an everyday word", async () => {
    const tokenizer = await loadTokenizer();
    const words = dictionaryWords(tokenizer, ["山道の渓谷がきれいです。"], () => false);
    expect(words.get("渓谷")).toBe("ケイコク");
  }, 30_000);
});
