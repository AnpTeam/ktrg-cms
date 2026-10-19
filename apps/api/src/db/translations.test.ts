import { describe, expect, test } from "bun:test";
import { emptyTexts, flattenTexts, ROUTE_TEXT, SPOT_TEXT, splitTexts } from "./translations";

describe("translations", () => {
  test("rows become flat fields per owner; a missing language stays null", () => {
    const rows = [
      { spotId: "a", locale: "ja" as const, name: "経塚", description: null, statusNote: "通行止め" },
      { spotId: "a", locale: "en" as const, name: "Mound", description: null, statusNote: null },
      { spotId: "b", locale: "ja" as const, name: "トイレ", description: null, statusNote: null },
    ];
    const flat = flattenTexts(SPOT_TEXT, rows, (r) => r.spotId);
    expect(flat.get("a")).toEqual({
      nameJa: "経塚", nameEn: "Mound", descriptionJa: null, descriptionEn: null, statusNoteJa: "通行止め", statusNoteEn: null,
    });
    expect(flat.get("b")).toMatchObject({ nameJa: "トイレ", nameEn: null });
    expect(flat.has("c")).toBe(false);
    expect(Object.values(emptyTexts(ROUTE_TEXT)).every((v) => v === null)).toBe(true);
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
});
