import { describe, expect, test } from "bun:test";
import { STORY_SECTIONS, STORY_SOURCE_URL, storyParagraph } from "./story-text";

// /story is written by us (the copy of the official page is gone): plain facts in our own words, Japanese and English.
describe("the story page text", () => {
  test("four chapters; each has both headings and as many English paragraphs as Japanese ones", () => {
    expect(STORY_SECTIONS).toHaveLength(4);
    for (const s of STORY_SECTIONS) {
      expect(s.heading.ja.trim()).not.toBe("");
      expect(s.heading.en.trim()).not.toBe("");
      expect(s.paragraphs.length).toBeGreaterThan(0);
      for (const p of s.paragraphs) {
        expect(p.ja.trim()).not.toBe("");
        expect(p.en.trim()).not.toBe("");
      }
    }
  });
  test("the trail length is filled in from one place, and no placeholder is left", () => {
    const all = STORY_SECTIONS.flatMap((s) => s.paragraphs).flatMap((p) => [storyParagraph(p, "ja", 112), storyParagraph(p, "en", 112)]);
    expect(all.join("")).toContain("112");
    expect(all.join("")).not.toMatch(/[{}<>]/);
  });
  test("the credit points to the official site over https", () => {
    expect(STORY_SOURCE_URL.startsWith("https://")).toBe(true);
  });
});
