import { describe, expect, test } from "bun:test";
import { checklist, factsFromDraft, progress, type RouteFacts } from "./checklist";
import { emptyDraft, newPlace } from "./route-draft";

const empty: RouteFacts = {
  nameJa: "甲山",
  nameEn: null,
  descriptionJa: null,
  descriptionEn: null,
  historyJa: null,
  accessJa: null, accessPoints: 0,
  photoUrl: null,
  videoUrl: null,
  prefecture: null,
  hasLine: false,
  lineVerified: false,
  publishedStampPlaces: 0,
};

const done = (items: ReturnType<typeof checklist>) => Object.fromEntries(items.map((i) => [i.id, i.done]));

describe("checklist", () => {
  test("a new route has only its name done and needs work", () => {
    const items = checklist(empty);
    expect(items.filter((i) => i.done).map((i) => i.id)).toEqual(["name_ja"]);
    expect(progress(items)).toEqual({ requiredDone: 1, requiredTotal: 4, recommendedDone: 0, recommendedTotal: 6, needsWork: true });
  });

  test("a drawn line counts only once it is checked", () => {
    expect(done(checklist({ ...empty, hasLine: true }))["line_checked"]).toBe(false);
    expect(done(checklist({ ...empty, hasLine: true, lineVerified: true }))["line_checked"]).toBe(true);
    expect(done(checklist({ ...empty, hasLine: false, lineVerified: true }))["line_checked"]).toBe(false);
  });

  test("blank text counts as missing", () => {
    expect(done(checklist({ ...empty, descriptionJa: "  " }))["description_ja"]).toBe(false);
    expect(done(checklist({ ...empty, descriptionJa: "道" }))["description_ja"]).toBe(true);
  });

  test("English needs both the name and the description", () => {
    expect(done(checklist({ ...empty, nameEn: "Mt. Kabuto" }))["english"]).toBe(false);
    expect(done(checklist({ ...empty, nameEn: "Mt. Kabuto", descriptionEn: "A walk" }))["english"]).toBe(true);
  });

  test("everything done needs no work", () => {
    const all: RouteFacts = { ...empty, nameEn: "a", descriptionJa: "b", descriptionEn: "c", historyJa: "d", accessJa: "e", photoUrl: "https://x", videoUrl: "https://y", prefecture: "nara", hasLine: true, lineVerified: true, publishedStampPlaces: 2 };
    const p = progress(checklist(all));
    expect(p.needsWork).toBe(false);
    expect(p.recommendedDone).toBe(6);
  });

  test("each item points at a tab", () => {
    const tabs = Object.fromEntries(checklist(empty).map((i) => [i.id, i.tab]));
    expect(tabs).toMatchObject({ name_ja: "overview", description_ja: "text", line_checked: "map", places_published: "places", history: "text", photo: "overview" });
  });
});

describe("factsFromDraft", () => {
  test("counts only published waypoints with a stamp, not the others", () => {
    const d = emptyDraft();
    const stamp = { ...newPlace("a", 34, 135, 1), published: true };
    const draftStamp = newPlace("b", 34, 135, 2);
    const point = { ...newPlace("c", 34, 135, 3, "toilet"), published: true };
    d.places = [stamp, draftStamp, point];
    expect(factsFromDraft(d).publishedStampPlaces).toBe(1);
  });

  test("a line needs two points", () => {
    const d = emptyDraft();
    d.line = [[135, 34]];
    expect(factsFromDraft(d).hasLine).toBe(false);
    d.line = [[135, 34], [135.1, 34.1]];
    expect(factsFromDraft(d).hasLine).toBe(true);
  });
});
