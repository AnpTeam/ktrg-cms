import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reads the color tokens straight from globals.css so the contrast promise
// is enforced against what actually ships, for both palettes.
const css = readFileSync(join(import.meta.dir, "../app/globals.css"), "utf8");

function tokens(block: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/--color-([a-z-]+): *(#[0-9a-fA-F]{6})/g)) {
    found[match[1] as string] = match[2] as string;
  }
  return found;
}

// Text between a marker and the closing brace of its top-level block.
function block(marker: string): string {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`globals.css has no ${marker}`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`unterminated block: ${marker}`);
}

const palettes: Record<string, Record<string, string>> = {
  light: tokens(block("@theme")),
  dark: tokens(block("@media (prefers-color-scheme: dark)")),
};

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

const names = ["accent", "danger", "ink", "line", "muted", "paper", "surface"];

// Text must reach WCAG AAA (7:1).
const text: [string, string][] = [
  ["ink", "paper"],
  ["ink", "surface"],
  ["muted", "paper"],
  ["muted", "surface"],
  ["accent", "paper"],
  ["accent", "surface"],
  ["danger", "paper"],
  ["danger", "surface"],
  ["paper", "accent"], // button label on an accent button
  ["paper", "ink"], // selected state
];

// Borders and the focus ring must reach 3:1 (WCAG 1.4.11).
const parts: [string, string][] = [
  ["line", "paper"],
  ["line", "surface"],
  ["accent", "paper"],
  ["accent", "surface"],
];

for (const [scheme, colors] of Object.entries(palettes)) {
  describe(`${scheme} palette`, () => {
    test("defines every token", () => {
      expect(Object.keys(colors).sort()).toEqual(names);
    });

    const pair = (foreground: string, background: string) => {
      const fg = colors[foreground];
      const bg = colors[background];
      if (!fg || !bg) throw new Error(`missing color token: ${foreground} or ${background}`);
      return ratio(fg, bg);
    };

    for (const [foreground, background] of text) {
      test(`${foreground} on ${background} is at least 7:1`, () => {
        expect(pair(foreground, background)).toBeGreaterThanOrEqual(7);
      });
    }

    for (const [foreground, background] of parts) {
      test(`${foreground} against ${background} is at least 3:1`, () => {
        expect(pair(foreground, background)).toBeGreaterThanOrEqual(3);
      });
    }
  });
}
