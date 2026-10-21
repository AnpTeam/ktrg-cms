import { describe, expect, test } from "bun:test";
import { cleanTranslations, emptyTexts, flattenTexts, mergeTranslations, ROUTE_TEXT, SPOT_TEXT, splitTexts } from "./translations";

describe("translations", () => {
  test("rows become flat fields per owner; a missing language stays null", () => {
    const rows = [
      { spotId: "a", locale: "ja" as const, name: "経塚", description: null, history: null, statusNote: "通行止め" },
      { spotId: "a", locale: "en" as const, name: "Mound", description: null, history: null, statusNote: null },
      { spotId: "b", locale: "ja" as const, name: "トイレ", description: null, history: null, statusNote: null },
    ];
    const flat = flattenTexts(SPOT_TEXT, rows, (r) => r.spotId);
    expect(flat.get("a")).toEqual({
      nameJa: "経塚", nameEn: "Mound", descriptionJa: null, descriptionEn: null, historyJa: null, historyEn: null, statusNoteJa: "通行止め", statusNoteEn: null, translations: {},
    });
    expect(flat.get("b")).toMatchObject({ nameJa: "トイレ", nameEn: null });
    expect(flat.has("c")).toBe(false);
    const { translations, ...flatFields } = emptyTexts(ROUTE_TEXT);
    expect(Object.values(flatFields).every((v) => v === null)).toBe(true);
    expect(translations).toEqual({});
  });

  test("flat values split into the owner's columns and one set of words per language that changes", () => {
    const { rest, texts } = splitTexts(ROUTE_TEXT, { nameEn: "Renamed", historyJa: null, accessEn: undefined, videoUrl: "https://youtu.be/x" });
    expect(rest).toEqual({ videoUrl: "https://youtu.be/x" });
    expect(texts).toEqual([
      { locale: "ja", values: { history: null } },
      { locale: "en", values: { name: "Renamed" } },
    ]);
    const noWords = { sortOrder: 2 };
    expect(splitTexts(ROUTE_TEXT, noWords)).toEqual({ rest: { sortOrder: 2 }, texts: [] });
  });

  test("other languages: read into one map (fields with text only), written as their own rows", () => {
    const rows = [
      { spotId: "a", locale: "ja" as const, name: "経塚", description: null, history: null, statusNote: null },
      { spotId: "a", locale: "de" as const, name: "Hügelgrab", description: null, history: null, statusNote: null },
      { spotId: "a", locale: "th" as const, name: null, description: null, history: null, statusNote: null },
    ];
    expect(flattenTexts(SPOT_TEXT, rows, (r) => r.spotId).get("a")).toMatchObject({ nameJa: "経塚", nameEn: null, translations: { de: { name: "Hügelgrab" } } });

    const { rest, texts } = splitTexts(SPOT_TEXT, { nameJa: "経塚", translations: { de: { name: "Hügelgrab" }, fr: { name: null } }, radiusM: 50 });
    expect(rest).toEqual({ radiusM: 50 });
    expect(texts).toEqual([
      { locale: "de", values: { name: "Hügelgrab" } },
      { locale: "fr", values: { name: null } },
      { locale: "ja", values: { name: "経塚" } },
    ]);
  });

  test("a change is trimmed (blank clears), unknown languages are dropped, and merges like the database", () => {
    expect(cleanTranslations({ de: { name: "  Grab " }, fr: { name: "   " }, xx: { name: "?" } } as never)).toEqual({ de: { name: "Grab" }, fr: { name: null } });
    expect(cleanTranslations(undefined)).toBeUndefined();
    const saved = { de: { name: "Grab", description: "Text" }, fr: { name: "Tumulus" } };
    expect(mergeTranslations(saved, { de: { name: null }, fr: { name: null }, es: { name: "Túmulo" } })).toEqual({ de: { description: "Text" }, es: { name: "Túmulo" } });
  });
});
