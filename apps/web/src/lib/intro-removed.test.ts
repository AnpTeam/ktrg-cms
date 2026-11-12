import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The language-and-install screen that covered a first visit is gone (decision 2026-11-11, docs/landing-story-design.md):
// the home page is the introduction, the language button sits on its first photo and the install bar comes later.
const src = join(import.meta.dir, "..");

test("the intro flow is gone", () => {
  expect(existsSync(join(src, "components", "IntroFlow.tsx"))).toBe(false);
  const layout = readFileSync(join(src, "app", "(public)", "layout.tsx"), "utf8");
  expect(layout).not.toMatch(/IntroFlow|jar\.has\("intro"\)|helpFor/);
});

test("the install steps live on their own and the later bar uses them", () => {
  expect(existsSync(join(src, "components", "InstallSteps.tsx"))).toBe(true);
  expect(readFileSync(join(src, "components", "InstallNudge.tsx"), "utf8")).toContain("InstallSteps");
});

// Review finding (2026-11-11): InstallSteps reads navigator.userAgent, which differs on the server (Node's own `navigator`),
// so it must only be drawn after the visitor has asked for it, never in the first render.
test("the install steps are drawn only after the visitor asks", () => {
  const nudge = readFileSync(join(src, "components", "InstallNudge.tsx"), "utf8");
  expect(nudge).toMatch(/asked\s*\?\s*<InstallSteps/);
});

// Review finding: the bar must not sit over the stamp button, the outbox or the navigation toast, and the first photo must be
// as tall in English as in Japanese (the line wraps to four lines in English and the language buttons would sit on it).
test("the hero is as tall in every language when it is the journey's first screen", () => {
  const hero = readFileSync(join(src, "components", "landing", "LandingHero.tsx"), "utf8");
  expect(hero).toMatch(/bare\s*\?\s*"h-\[min\(78svh,44rem\)\]/);
});

// 2026-11-12, real iPhone on its side (about 390 px tall): the sticky stage is one screen tall, so the story words were cut
// off and the ridge sat below the fold, out of reach. A screen shorter than 38rem keeps the stacked page (every word and the
// whole ridge in reading order); it is a media query, so turning the phone swaps between the two without a reload.
test("the scroll scene runs only on a screen tall enough to hold a beat", () => {
  const scene = readFileSync(join(src, "components", "landing", "JourneyScene.tsx"), "utf8");
  expect(scene).toMatch(/\(prefers-reduced-motion: no-preference\) and \(min-height: 38rem\)/);
});
