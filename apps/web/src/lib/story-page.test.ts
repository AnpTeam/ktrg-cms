import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12 (user: "the story page is just a plain text web, add some lives into it"): /story reads as chapters with their
// own grounds, our own drawings and the landing's reveal on scroll (reading register, docs/design-language.md).
const page = readFileSync(join(import.meta.dir, "..", "app", "(public)", "story", "page.tsx"), "utf8");

test("the story is told in chapters on their own grounds, with our drawings, moving through StoryMotion", () => {
  expect(page).toMatch(/<StoryMotion/);
  expect(page).toMatch(/<Chapter\b/);
  expect(page).toMatch(/<ScrollProgress\s*\/>/);
  for (const drawing of ["SutraScroll", "KuzuVine", "StaffAndWaves", "SeamFade"]) expect(page).toContain(drawing);
  expect(page).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
});

test("every word still comes from lib/story-text.ts and the credit line stays", () => {
  expect(page).toContain("STORY_SECTIONS");
  expect(page).toContain("STORY_SOURCE_URL");
  expect(page).toMatch(/<h1\b/);
});
