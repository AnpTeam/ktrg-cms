import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12 (user, desktop two columns): beside a course with a two-line name, the other course's card stopped short and
// left a gap (its photo and pattern ended early). Each row must fill its stretched grid cell.
const src = readFileSync(join(import.meta.dir, "TrailRibbon.tsx"), "utf8");

test("a course row fills its grid cell, so a shorter card beside a taller one has no gap", () => {
  expect(src).toMatch(/<li className="grid border-b border-line">/);
  expect(src).toMatch(/relative block h-full overflow-hidden/);
});
