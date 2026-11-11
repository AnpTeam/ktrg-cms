import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Pins on the map are never merged into a group (decision 2026-11-11, the user): a merged button gets in the way when
// moving the map. Every stop, place, mound and course keeps its own button. This fails if a group button comes back.
const mapDir = join(import.meta.dir, "..", "components", "map");
const sources = readdirSync(mapDir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"));

describe("map pins are never merged", () => {
  test("there are map sources to check", () => {
    expect(sources.length).toBeGreaterThan(3);
  });

  for (const file of sources) {
    test(`${file} builds no group button and does no pixel clustering`, () => {
      const text = readFileSync(join(mapDir, file), "utf8");
      expect(text).not.toMatch(/createClusterElement|clusterByPixels|map-cluster|mergeStops/);
    });
  }

  test("the stylesheet has no group-button rules", () => {
    const css = readFileSync(join(import.meta.dir, "..", "app", "globals.css"), "utf8");
    expect(css).not.toMatch(/\.map-cluster|data-count/);
  });
});
