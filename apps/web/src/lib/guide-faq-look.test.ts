import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12: the how-to-play guide and the FAQ share the new look: Mincho title in the readable red, capsule cards.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8").replace(/\r\n/g, "\n");

test("guide and FAQ titles are Mincho in the readable red", () => {
  const views = read("components", "pages", "PageViews.tsx");
  const guide = views.slice(views.indexOf("export function GuideView"), views.indexOf("export function FaqView"));
  const faq = views.slice(views.indexOf("export function FaqView"), views.indexOf("const Paragraph"));
  for (const part of [guide, faq]) expect(part).toMatch(/<h1 className="font-serif text-3xl font-bold text-accent">/);
});

test("step and question cards are capsules without strokes", () => {
  const cards = read("components", "pages", "Cards.tsx");
  expect(cards).toMatch(/rounded-\[1\.75rem\] bg-surface/);
  expect(cards).not.toMatch(/rounded-3xl|border-2/);
});
