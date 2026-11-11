import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The coworker's mountain drawing, used as a mask along the bottom of the Start chapter. It is a file we ship, so it is
// plain shapes only: no script, no event handler, no link, no embedded picture.
const file = join(import.meta.dir, "..", "..", "public", "home", "outro_mountains.svg");

test("the outro mountains drawing is in public/home and is plain shapes", () => {
  expect(existsSync(file)).toBe(true);
  const svg = readFileSync(file, "utf8");
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg).not.toMatch(/<script|\bon[a-z]+\s*=|href\s*=|<image|<foreignObject|<use|javascript:/i);
  expect(svg.length).toBeLessThan(60_000);
});
