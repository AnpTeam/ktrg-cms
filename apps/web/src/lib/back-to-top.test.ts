import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12, real iPhone: the home page is long, so its end has a "back to top" button.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8");

test("the home page ends with a back-to-top button that respects reduced motion", () => {
  expect(existsSync(join(src, "components", "BackToTop.tsx"))).toBe(true);
  const button = read("components", "BackToTop.tsx");
  expect(button).toMatch(/window\.scrollTo\(/);
  expect(button).toMatch(/prefers-reduced-motion: reduce/);
  expect(button).toMatch(/tap-target/);
  expect(read("components", "landing", "Landing.tsx")).toMatch(/<BackToTop\s*\/>/);
});

test("the button's words exist in both languages", () => {
  for (const [lang, want] of [["ja", /msgid "ページの先頭へ"\r?\nmsgstr "ページの先頭へ"/], ["en", /msgid "ページの先頭へ"\r?\nmsgstr "Back to top"/]] as const) {
    expect(read("locales", `${lang}.po`)).toMatch(want);
  }
});
