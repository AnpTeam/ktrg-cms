import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12 (user): rally, blog and bookmarks look like the course list (capsules with 1.75rem corners, no panel strokes),
// and the home page's blog block joins the ground above instead of standing as a raised panel.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8");

test("blog rows, bookmarks, rally cards and empty states are capsules without strokes", () => {
  expect(read("components", "blog", "PostRow.tsx")).toMatch(/rounded-\[1\.75rem\] bg-surface/);
  expect(read("components", "BookmarkList.tsx")).toMatch(/rounded-\[1\.75rem\] bg-surface/);
  expect(read("components", "RallyViews.tsx")).toMatch(/relative rounded-\[1\.75rem\] bg-surface/);
  expect(read("components", "RallyViews.tsx")).not.toMatch(/<li className="[^"]*border-dashed/); // the not-ready card has no dashed frame
  expect(read("components", "EmptyState.tsx")).not.toMatch(/border-2/);
});

test("the three headings are Mincho in the readable red, as on the course list", () => {
  for (const f of [["app", "(public)", "rallies", "page.tsx"], ["app", "(public)", "bookmarks", "page.tsx"]]) expect(read(...f)).toMatch(/font-serif text-3xl font-bold text-accent/);
});

test("the home page's blog block has no raised panel", () => {
  const card = read("components", "landing", "BlogCard.tsx");
  expect(card).not.toMatch(/rounded-3xl bg-surface p-5/);
  expect(card).toMatch(/<section className="mx-auto w-full max-w-5xl px-5/);
});
