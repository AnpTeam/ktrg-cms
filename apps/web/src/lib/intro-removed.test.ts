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
