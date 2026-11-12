import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12 (user: "the signed-in homepage does not match our current logged-out homepage at all"): the signed-in home uses the
// same chapter system as the logged-out one, without the scroll scene: your walk first, then the courses, the map, the notices and
// blog, the story and the film, each on its own ground with a drawing and a soft seam.
const landing = readFileSync(join(import.meta.dir, "..", "components", "landing", "Landing.tsx"), "utf8").replace(/\r\n/g, "\n");
const topBranch = landing.slice(landing.indexOf("{top ? (\n          <>\n            {/* 1: your walk"), landing.indexOf(") : (\n          <>\n            {/* 4:"));

test("the branch was found", () => {
  expect(topBranch.length).toBeGreaterThan(1000);
});

test("the signed-in branch: your walk as the first chapter on a ground with the sutra scroll", () => {
  expect(topBranch).toMatch(/data-ground[^>]*>\s*<SutraScroll \/>\s*\{top\}/);
});

test("the signed-in branch: courses with the kuzu vine, the map as its own chapter, the story with the staff, all seamed", () => {
  expect(topBranch).toMatch(/<KuzuVine \/>/);
  expect(topBranch).toMatch(/id="map-title"/);
  expect(topBranch).toMatch(/<StaffAndWaves \/>/);
  expect(topBranch.match(/<SeamFade /g)?.length).toBeGreaterThanOrEqual(3);
});

test("the signed-in home has no scroll scene: it keeps the hero and skips the journey", () => {
  expect(topBranch).not.toContain("<Journey");
});
