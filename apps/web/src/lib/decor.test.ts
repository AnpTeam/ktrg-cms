import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12: the chapters' grounds were too plain, so they carry our own line drawings tied to Katsuragi Shugen that drift
// gently as the page scrolls (docs/design-language.md, Motion): a sutra scroll (the 28 mounds), a kuzu vine (the plant
// 葛城 is named for) and a ringed staff over a wave pattern. Decoration only: never over the words' contrast, never read out.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8");

test("the drawings are our own inline SVG, in colour tokens, hidden from screen readers", () => {
  const file = join(src, "components", "landing", "Decor.tsx");
  expect(existsSync(file)).toBe(true);
  const decor = read("components", "landing", "Decor.tsx");
  for (const name of ["SutraScroll", "KuzuVine", "StaffAndWaves", "SeamFade"]) expect(decor).toMatch(new RegExp(`export function ${name}\\(`));
  expect(decor).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|<image|<script|href=|<use/); // no hard-coded colour, no outside picture, no code
  expect(decor.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(4);
  expect(decor).toMatch(/currentColor/);
});

test("the drawings stand behind the words in the chapters that were plain", () => {
  const journey = read("components", "landing", "Journey.tsx");
  expect(journey).toMatch(/decoration=\{<StaffAndWaves\s*\/>\}/);
  expect(journey).toMatch(/decoration=\{<SutraScroll\s*\/>\}/);
  expect(read("components", "landing", "Landing.tsx")).toMatch(/decoration=\{<KuzuVine\s*\/>\}/);
});

// The Start chapter's ground differs from the courses above it, and the edge between them was hard (real iPhone, 2026-11-12):
// it now fades in from the previous chapter's own ground, and does nothing when the two are the same.
test("the Start chapter fades in from the ground above it", () => {
  const landing = read("components", "landing", "Landing.tsx");
  expect(landing).toMatch(/<SeamFade from=\{startFrom\} to=\{startGround\}\s*\/>/);
  expect(read("components", "landing", "Decor.tsx")).toMatch(/if \(!from \|\| from === to\) return null;/);
});

test("the scene hands its progress to the drawings as --journey, and takes it back when it leaves", () => {
  const scene = read("components", "landing", "JourneyScene.tsx");
  expect(scene).toMatch(/setProperty\("--journey"/);
  expect(scene).toMatch(/removeProperty\("--journey"\)/);
  expect(read("app", "globals.css")).toMatch(/\.decor-drift\s*\{[^}]*var\(--journey, 0\.5\)/s);
});

test("the other chapters' drawings drift and grow only when motion is allowed", () => {
  const motion = read("components", "landing", "StoryMotion.tsx");
  expect(motion).toMatch(/\[data-parallax\]/);
  expect(motion).toMatch(/\[data-grow\]/);
  // Both sit inside the same matchMedia(no-preference) block as the reveals, so reduced motion and calm never see them.
  expect(motion.indexOf("[data-parallax]")).toBeGreaterThan(motion.indexOf('mm.add("(prefers-reduced-motion: no-preference)"'));
});
