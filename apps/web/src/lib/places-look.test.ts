import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12: the places directory looks like the course list: Mincho red titles, capsule rows, no panel strokes.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8");

test("directory and place page titles are Mincho in the readable red", () => {
  expect(read("app", "(public)", "places", "page.tsx")).toMatch(/font-serif text-3xl font-bold text-accent/);
  expect(read("app", "(public)", "places", "[id]", "page.tsx")).toMatch(/font-serif text-3xl font-bold[^"]*text-accent/);
});

test("the directory has no heading rule and its rows are separate capsules", () => {
  expect(read("app", "(public)", "places", "page.tsx")).not.toMatch(/border-b-2 border-ink/);
  const view = read("components", "places", "DirectoryView.tsx");
  expect(view).toMatch(/rounded-\[1\.75rem\] bg-surface/);
  expect(view).not.toMatch(/divide-y|rounded-3xl bg-surface px-4/);
});

test("the place page's group title is the left-bar heading", () => {
  const page = read("app", "(public)", "places", "[id]", "page.tsx");
  expect(page).toMatch(/border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent/);
  expect(page).not.toMatch(/SectionBanner/);
});
