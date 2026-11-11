import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { STORY_SECTIONS, STORY_SOURCE_URL, type StoryFigure } from "./story-copy";

// /story is the official story page, copied for now (docs/landing-story-design.md). The text is plain strings.
describe("the copied story page", () => {
  test("four chapters, each with a heading and some words", () => {
    expect(STORY_SECTIONS).toHaveLength(4);
    for (const s of STORY_SECTIONS) {
      expect(s.heading.trim()).not.toBe("");
      expect(s.blocks.some((b) => "text" in b)).toBe(true);
    }
  });
  test("every photo is in public/story and has a caption", () => {
    const figures = STORY_SECTIONS.flatMap((s) => s.blocks.filter((b): b is StoryFigure => "src" in b));
    expect(figures).toHaveLength(9);
    for (const f of figures) {
      expect(f.src.startsWith("/story/")).toBe(true);
      expect(existsSync(join(import.meta.dir, "..", "..", "public", f.src))).toBe(true);
      expect(f.caption.trim()).not.toBe("");
      expect(f.width).toBeGreaterThan(0);
      expect(f.height).toBeGreaterThan(0);
    }
  });
  test("no empty paragraph, no markup, no footer left over from the source page", () => {
    for (const s of STORY_SECTIONS) {
      for (const b of s.blocks) {
        if (!("text" in b)) continue;
        expect(b.text.trim()).not.toBe("");
        expect(b.text).not.toMatch(/[<>]|\[IMG|観光情報|Copyright/);
      }
    }
  });
  test("the source is an https address", () => {
    expect(STORY_SOURCE_URL.startsWith("https://")).toBe(true);
  });
});
