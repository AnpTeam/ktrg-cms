import { describe, expect, test } from "bun:test";
import { moveLanguage, nextLanguage, startLanguages, translationsChange, withTranslation } from "./content-locales";

describe("content languages in a field", () => {
  test("a field starts with English and the languages that already have text", () => {
    expect(startLanguages("", undefined, "name")).toEqual([]);
    expect(startLanguages("Mound", { th: { name: "เนิน" }, de: { description: "x" } }, "name")).toEqual(["en", "th"]);
  });

  test("the add button offers the next unused language, and stops at 5 boxes (Japanese included)", () => {
    expect(nextLanguage([])).toBe("en");
    expect(nextLanguage(["en", "fr"])).toBe("de");
    expect(nextLanguage(["en", "de", "fr", "th"])).toBeNull(); // 1 + 4 = 5 boxes
  });

  test("only real changes are sent; blank means cleared", () => {
    const saved = { de: { name: "Grab" } };
    expect(translationsChange(saved, saved)).toBeNull();
    expect(translationsChange(saved, withTranslation(saved, "de", "name", "  "))).toEqual({ de: { name: null } });
    expect(translationsChange(saved, withTranslation(saved, "fr", "name", "Tumulus"))).toEqual({ fr: { name: "Tumulus" } });
  });

  test("changing a row's language moves the text and clears the old one; removing a row clears it", () => {
    const words = { en: "Mound", translations: { de: { name: "Hügel" } } };
    expect(moveLanguage(words, "name", "de", "fr")).toEqual({ en: "Mound", translations: { de: { name: null }, fr: { name: "Hügel" } } });
    expect(moveLanguage(words, "name", "en", "th")).toEqual({ en: "", translations: { de: { name: "Hügel" }, th: { name: "Mound" } } });
    expect(moveLanguage(words, "name", "de", "en")).toEqual({ en: "Hügel", translations: { de: { name: null } } });
    expect(moveLanguage(words, "name", "de", null)).toEqual({ en: "Mound", translations: { de: { name: null } } });
    expect(moveLanguage(words, "name", "en", null).en).toBe("");
  });
});
