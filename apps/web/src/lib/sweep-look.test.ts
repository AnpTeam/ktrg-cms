import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12: the small screens join the new look (red Mincho titles, 1.75rem capsules, no big rounded-3xl).
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8");
const pub = (n: string) => ["app", "(public)", ...n.split("/")];

test("page titles are Mincho in the readable red", () => {
  for (const f of ["notices/page.tsx", "sitemap/page.tsx", "licenses/page.tsx", "grading/page.tsx", "error.tsx", "not-found.tsx"])
    expect(read(...pub(f))).toMatch(/<h1 className="font-serif text-3xl font-bold text-accent/);
  for (const [i, l] of read("components", "pages", "PageViews.tsx").split("\n").filter((l) => l.includes("<h1")).entries())
    expect(`${i}${l}`).toMatch(/font-serif text-3xl font-bold text-accent/);
});

test("large panels are 1.75rem capsules, not rounded-3xl", () => {
  const files = [
    pub("sitemap/page.tsx"), pub("licenses/page.tsx"), pub("grading/page.tsx"),
    ["components", "InstallSteps.tsx"], ["components", "PlaceFacts.tsx"], ["components", "RichBody.tsx"],
    ["components", "PrivacyNote.tsx"], ["components", "Notice.tsx"], ["components", "AccessList.tsx"], ["components", "pages", "PageViews.tsx"],
  ];
  for (const f of files) {
    const s = read(...f);
    expect(s).not.toMatch(/rounded-3xl bg-surface/);
    expect(s).toMatch(/rounded-\[1\.75rem\] bg-surface/);
  }
});

test("blog older/newer cards are capsules", () => {
  const s = read(...pub("blog/[id]/page.tsx"));
  expect(s).not.toMatch(/rounded-2xl bg-surface p-4/);
  expect(s.match(/rounded-\[1\.75rem\] bg-surface p-4/g)?.length).toBe(2);
});
