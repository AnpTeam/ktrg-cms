import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createMemoryContentStore } from "../content/content-memory-store";
import { alignReading, createFuriganaService, createMemoryFuriganaStore, nameReadings } from "./furigana-words";

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

describe("readings typed with names", () => {
  const admin = "11111111-1111-4111-8111-111111111111";
  const setup = (names: { word: string; reading: string }[]) => {
    const audit = createMemoryAuditWriter();
    const { store } = createMemoryFuriganaStore(audit.writer);
    return createFuriganaService({ store, names: async () => names });
  };

  test("a name's reading joins the list in the marked-up form; one that does not fit its name is left out", async () => {
    const s = setup([
      { word: "葛木神社", reading: "かつらぎじんじゃ" },
      { word: "転法輪寺", reading: "転法輪{てんぽうりん}寺{じ}" },
      { word: "取り扱い", reading: "ぜんぜん" },
    ]);
    expect(await s.words()).toEqual({ 葛木神社: "葛木神社{かつらぎじんじゃ}", 転法輪寺: "転法輪{てんぽうりん}寺{じ}" });
  });

  test("two places written alike but read differently keep their readings to their own pages", async () => {
    const s = setup([
      { word: "高天", reading: "たかま" },
      { word: "高天", reading: "たかあま" },
      { word: "葛城", reading: "かつらぎ" },
      { word: "葛城", reading: "かつらぎ" },
    ]);
    expect(await s.words()).toEqual({ 葛城: "葛城{かつらぎ}" });
  });

  test("a word in the list wins over a name's reading", async () => {
    const s = setup([{ word: "葛城", reading: "かづらき" }]);
    await s.create(admin, { word: "葛城", reading: "かつらぎ" });
    expect(await s.words()).toEqual({ 葛城: "葛城{かつらぎ}" });
  });
});

describe("which names give readings", () => {
  test("course names and published waypoints only: a draft waypoint's name never reaches visitors", async () => {
    const audit = createMemoryAuditWriter();
    const { store: content } = createMemoryContentStore(audit.writer);
    const actor = "11111111-1111-4111-8111-111111111111";
    const route = await content.createRoute(actor, { nameJa: "葛城の道", nameKana: "かつらぎのみち" });
    const draft = await content.createSpot(actor, route.id, { nameJa: "高天寺", nameKana: "たかまでら" });
    const open = await content.createSpot(actor, route.id, { nameJa: "転法輪寺", nameKana: "てんぽうりんじ" });
    await content.setPublished(actor, open!.id, true);
    const places = { listPublic: async () => [{ nameJa: "茶屋", nameKana: "ちゃや" }] };
    const words = (await nameReadings(content, places)).map((n) => n.word);
    expect(words.sort()).toEqual(["葛城の道", "茶屋", "転法輪寺"].sort());
    expect(words).not.toContain(draft!.nameJa);
  });
});
