import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12 (user): a course's typed reading shows over its name in the course list, the home capsules and the map list
// whatever the furigana setting says (the kanji of a name are hard for some Japanese readers too). NameRuby draws it as
// <ruby> itself; the page-wide furigana layer leaves existing ruby alone; no reading or English gives the plain name.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8").replace(/\r\n/g, "\n");

test("home capsules draw the course name with its typed reading", () => {
  const landing = read("components", "landing", "Landing.tsx");
  expect(landing).toMatch(/import \{ NameRuby \} from "@\/components\/Ruby";/);
  expect(landing).toMatch(/name=\{<NameRuby title=\{pickText\(locale, route\.nameJa, route\.nameEn\)\} reading=\{route\.nameKana\} \/>\}/);
});

test("the map list carries the reading from the page to its rows", () => {
  expect(read("lib", "map-screen.ts")).toMatch(/nameKana\?: string \| null;/);
  expect(read("app", "(public)", "map", "page.tsx")).toMatch(/nameKana: r\.nameKana,/);
  const screen = read("components", "map", "MapScreen.tsx");
  expect(screen).toMatch(/import \{ NameRuby \} from "@\/components\/Ruby";/);
  expect(screen).toMatch(/<NameRuby title=\{\{ text: r\.name, lang: r\.nameLang, fallback: false \}\} reading=\{r\.nameKana\} \/>/);
});
