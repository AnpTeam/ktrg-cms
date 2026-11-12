import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12: the badges page matches the other restyled screens (Mincho red title, capsule tiles).
const page = readFileSync(join(import.meta.dir, "..", "app", "(public)", "badges", "page.tsx"), "utf8");

test("badges page: Mincho red title and 1.75rem capsule tiles", () => {
  expect(page).toMatch(/<h1 className="font-serif text-3xl font-bold text-accent wide:text-4xl">/);
  expect(page).toMatch(/rounded-\[1\.75rem\] bg-surface/);
  expect(page).not.toMatch(/rounded-3xl/);
});
