import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { alignReading, createFuriganaService, createMemoryFuriganaStore } from "./furigana-words";

describe("alignReading", () => {
  test("a whole-word reading goes over the kanji it belongs to", () => {
    expect(alignReading("葛城山", "かつらぎさん")).toBe("葛城山{かつらぎさん}");
    expect(alignReading("取り扱い", "とりあつかい")).toBe("取{と}り扱{あつか}い");
    expect(alignReading("お勧め", "おすすめ")).toBe("お勧{すす}め");
    expect(alignReading("歩く", "アルク")).toBe("歩{ある}く");
  });
  test("kana that do not line up, and words with no kanji, give nothing", () => {
    expect(alignReading("取り扱い", "ぜんぜん")).toBeNull();
    expect(alignReading("やま", "やま")).toBeNull();
  });
});

describe("the furigana list", () => {
  const setup = () => {
    const audit = createMemoryAuditWriter();
    const { store } = createMemoryFuriganaStore(audit.writer);
    return createFuriganaService({ store });
  };
  const admin = "11111111-1111-4111-8111-111111111111";

  test("a plain reading is saved in the marked-up form, and the page gets every word", async () => {
    const s = setup();
    expect((await s.create(admin, { word: "葛城山", reading: "かつらぎさん" })).ok).toBe(true);
    expect((await s.create(admin, { word: "取り扱い", reading: "取{と}り扱{あつか}い" })).ok).toBe(true);
    expect(await s.words()).toEqual({ 葛城山: "葛城山{かつらぎさん}", 取り扱い: "取{と}り扱{あつか}い" });
  });

  test("a word may be listed once, must hold a kanji, and its reading must fit it", async () => {
    const s = setup();
    await s.create(admin, { word: "葛城", reading: "かつらぎ" });
    expect(await s.create(admin, { word: "葛城", reading: "かつらぎ" })).toEqual({ ok: false, reason: "conflict" });
    expect(await s.create(admin, { word: "かつらぎ", reading: "かつらぎ" })).toEqual({ ok: false, reason: "validation_failed" });
    expect(await s.create(admin, { word: "取り扱い", reading: "ぜんぜん" })).toEqual({ ok: false, reason: "validation_failed" });
    expect(await s.create(admin, { word: "葛城", reading: "山{やま}" })).toEqual({ ok: false, reason: "conflict" });
    expect(await s.create(admin, { word: "峠", reading: "山{やま}" })).toEqual({ ok: false, reason: "validation_failed" });
  });
});
