import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12 (user): the story chapter's picture was the council's composite (a photo of a ritual with an inset statue of
// En no Gyōja of unclear ownership). The museum's image terms do not clearly cover a public website, so the picture is our own
// line drawing of En no Gyōja with his ringed staff, in the style of the other drawings (docs/design-language.md: our own
// drawings, never photos of unclear ownership, never AI images).
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8").replace(/\r\n/g, "\n");

test("EnNoGyoja is an inline drawing in the text colour, hidden from screen readers", () => {
  const decor = read("components", "landing", "Decor.tsx");
  expect(decor).toMatch(/export function EnNoGyoja\(/);
  const part = decor.slice(decor.indexOf("export function EnNoGyoja("));
  expect(part).toMatch(/aria-hidden="true"/);
  expect(part).toMatch(/currentColor|\{\.\.\.line\}/);
  expect(part).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|<image|<script|href=|<use/);
});

test("the story chapter shows the drawing, not the council's composite, and the file is gone", () => {
  const landing = read("components", "landing", "Landing.tsx");
  expect(landing).toMatch(/<EnNoGyoja /);
  expect(landing).not.toContain("story_img");
  expect(existsSync(join(src, "..", "public", "home", "story_img.png"))).toBe(false);
});
