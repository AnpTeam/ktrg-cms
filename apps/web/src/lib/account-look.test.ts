import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12 (user): profile and settings take the look of the course list and the menu: Mincho headings in the readable red,
// group titles with the brand-red bar, capsule panels (1.75rem corners).
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8");
const BAR = "border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent";

test("profile: Mincho title, a capsule card with the 七宝, group titles with the red bar", () => {
  expect(read("app", "(public)", "profile", "page.tsx")).toMatch(/font-serif text-3xl font-bold text-accent/);
  const card = read("components", "ProfileCard.tsx");
  expect(card).toMatch(/rounded-\[1\.75rem\] bg-surface/);
  expect(card).toMatch(/pattern-shippo/);
  const settings = read("components", "ProfileSettings.tsx");
  expect(settings).toContain(BAR);
  expect(settings).not.toMatch(/rounded-3xl bg-surface/);
});

test("settings: Mincho title in the readable red, the three groups titled with the red bar, capsule lists", () => {
  expect(read("app", "(public)", "settings", "page.tsx")).toMatch(/font-serif text-3xl font-bold text-accent/);
  const form = read("components", "settings", "PrefsForm.tsx");
  expect(form.match(new RegExp(BAR.replace(/[-/\^$*+?.()|[\]{}]/g, "\$&"), "g"))?.length).toBe(3);
  expect(form).toMatch(/overflow-hidden rounded-\[1\.75rem\] bg-surface/);
});
