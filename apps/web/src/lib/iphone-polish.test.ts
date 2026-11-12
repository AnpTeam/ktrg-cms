import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12, from the user's iPhone: the staff at the top left was hidden under iOS's top blur, and the story's progress line
// beside the real scrollbar looked like a second scrollbar. docs/landing-story-design.md.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8");

test("the staff starts below the status bar's blur and is drawn stronger", () => {
  const decor = read("components", "landing", "Decor.tsx");
  expect(decor).toMatch(/top-\[calc\(1\.5rem\+var\(--top-clear\)\)\]/);
  expect(decor).toMatch(/opacity-\[0\.2[0-9]?\]/);
});

test("the progress line is a short inset marker, not a full-height strip that mimics a scrollbar", () => {
  const line = read("components", "landing", "ScrollProgress.tsx");
  expect(line).not.toMatch(/inset-y-0/);
  expect(line).toMatch(/rounded-full/);
  expect(line).toMatch(/right-1\.5/);
});

test("in the installed app the journey's words start below the blur", () => {
  const css = read("app", "globals.css");
  expect(css).toMatch(/@media \(display-mode: standalone\)[^{]*\{[^@]*\.journey-live \[data-beat\][^{]*\{\s*padding-top: var\(--top-clear\)/s);
});
