import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Titles on the home page are never tracked wide (decision 2026-11-11, the user: it looked machine-made). Letter spacing
// above 0.05 em is out; this fails if `tracking-widest`, `tracking-wider` or a wide `tracking-[..em]` comes back.
const dir = join(import.meta.dir, "..", "components", "landing");
const sources = readdirSync(dir).filter((f) => f.endsWith(".tsx"));

describe("no title is tracked wider than 0.05 em", () => {
  test("there are landing sources to check", () => {
    expect(sources.length).toBeGreaterThan(5);
  });
  for (const file of sources) {
    test(file, () => {
      const text = readFileSync(join(dir, file), "utf8");
      expect(text).not.toMatch(/tracking-(widest|wider)\b/);
      for (const m of text.matchAll(/tracking-\[(-?[\d.]+)em\]/g)) expect(Number(m[1])).toBeLessThanOrEqual(0.05);
    });
  }
});
