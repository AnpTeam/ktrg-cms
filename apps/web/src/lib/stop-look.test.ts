import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12 (user): the stop page (/spots/[id]) in the new look: Mincho titles in the readable red, group titles with
// the brand bar, capsule panels. Caution keeps its amber border and closed its barrier stripes (safety signalling).
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8").replace(/\r\n/g, "\n");
const GROUP_TITLE = "border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent";

test("the stop title is Mincho in the readable red and keeps its furigana", () => {
  const sheet = read("components", "SpotSheet.tsx");
  expect(sheet).toMatch(/<h1 className="font-serif text-4xl font-bold leading-tight text-accent has-\[rt\]:pt-4">/);
  expect(sheet).toMatch(/<NameRuby title=/);
});

test("every group title on the stop page has the brand bar", () => {
  const sheet = read("components", "SpotSheet.tsx");
  const h2s = [...sheet.matchAll(/<h2 className="([^"]*)"/g)].map((m) => m[1]);
  expect(h2s.length).toBeGreaterThanOrEqual(6);
  for (const c of h2s) expect(c).toContain(GROUP_TITLE);
});

test("stop page panels are capsules", () => {
  const sheet = read("components", "SpotSheet.tsx");
  expect(sheet).not.toMatch(/rounded-3xl/);
  expect(sheet).toMatch(/rounded-\[1\.75rem\] bg-surface/);
});

test("status banners: rounder corners, safety signals intact", () => {
  const banner = read("components", "StatusBanner.tsx");
  expect(banner).not.toMatch(/rounded-xl/);
  expect(banner).toMatch(/rounded-\[1\.75rem\] border-4 border-caution/);
  expect(banner).toMatch(/overflow-hidden rounded-\[1\.75rem\] border-4 border-ink/);
  expect(banner).toMatch(/repeating-linear-gradient\(135deg,var\(--color-ink\)/);
});
