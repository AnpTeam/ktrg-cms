import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reads the color tokens straight from globals.css so the contrast promise
// is enforced against what actually ships.
const css = readFileSync(join(import.meta.dir, "../app/globals.css"), "utf8");
const theme = css.slice(css.indexOf("@theme"), css.indexOf("}", css.indexOf("@theme")));

const colors: Record<string, string> = {};
for (const match of theme.matchAll(/--color-([a-z-]+): *(#[0-9a-fA-F]{6})/g)) {
  colors[match[1] as string] = match[2] as string;
}

function channel(hex: string, start: number) {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function ratio(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function pair(foreground: string, background: string) {
  const fg = colors[foreground];
  const bg = colors[background];
  if (!fg || !bg) throw new Error(`missing color token: ${foreground} or ${background}`);
  return ratio(fg, bg);
}

describe("color tokens", () => {
  test("all expected tokens are defined", () => {
    expect(Object.keys(colors).sort()).toEqual(
      ["accent", "danger", "ink", "line", "muted", "paper", "surface"],
    );
  });

  // Text must reach WCAG AAA (7:1).
  const text: [string, string][] = [
    ["ink", "paper"],
    ["ink", "surface"],
    ["muted", "paper"],
    ["muted", "surface"],
    ["accent", "paper"],
    ["accent", "surface"],
    ["danger", "paper"],
    ["paper", "accent"], // button label on an accent button
    ["paper", "ink"], // selected state
  ];
  for (const [foreground, background] of text) {
    test(`${foreground} on ${background} is at least 7:1`, () => {
      expect(pair(foreground, background)).toBeGreaterThanOrEqual(7);
    });
  }

  // Borders and the focus ring must reach 3:1 (WCAG 1.4.11).
  const parts: [string, string][] = [
    ["line", "paper"],
    ["line", "surface"],
    ["accent", "paper"],
  ];
  for (const [foreground, background] of parts) {
    test(`${foreground} against ${background} is at least 3:1`, () => {
      expect(pair(foreground, background)).toBeGreaterThanOrEqual(3);
    });
  }
});
