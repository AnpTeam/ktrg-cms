import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// contrast.test.ts checks the palette; this checks how it is USED. It reads every class string in the app, pairs a
// background token with the text token in the same string, and fails when the words are too small for that pair's
// contrast in either theme. It exists because small labels on the brand red (3.85:1) crept into a dozen places.
// shortcut: only pairs inside one string literal are seen (a bg in one string and its text in another, e.g. split
// across a template's ternary, is not); upgrade to a JSX-aware scan if such a pair ever slips through.

const src = join(import.meta.dir, "..");
const css = readFileSync(join(src, "app/globals.css"), "utf8");

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

function tokens(text: string): Record<string, string> {
  const found: Record<string, string> = { white: "#ffffff", black: "#000000" };
  for (const m of text.matchAll(/--color-([a-z-]+): *(#[0-9a-fA-F]{6})/g)) found[m[1] as string] = m[2] as string;
  return found;
}

const palettes = { light: tokens(block("@theme")), dark: tokens(block(':root[data-theme="dark"]')) };

const channel = (hex: string, at: number) => {
  const v = parseInt(hex.slice(at, at + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
export function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const SIZES: Record<string, number> = { "text-xs": 12, "text-sm": 14, "text-base": 16, "text-lg": 18, "text-xl": 20, "text-2xl": 24, "text-3xl": 30, "text-4xl": 36 };

export type Pair = { where: string; text: string; bg: string; size: number; bold: boolean };

/** Every background + text token pair that shares a variant (none, `aria-pressed:`, `hover:`…) in one class string. */
export function pairsIn(source: string, where: string): Pair[] {
  const out: Pair[] = [];
  for (const [, classes] of source.matchAll(/["`]([^"`]*\bbg-[a-z][^"`]*)["`]/g)) {
    const byVariant = new Map<string, { bg?: string; text?: string; size?: number; bold?: boolean }>();
    for (const c of (classes as string).split(/\s+/)) {
      const cut = c.lastIndexOf(":");
      const [variant, utility] = cut < 0 ? ["", c] : [c.slice(0, cut), c.slice(cut + 1)];
      const slot = byVariant.get(variant) ?? {};
      byVariant.set(variant, slot);
      if (utility in SIZES) slot.size = Math.max(slot.size ?? 0, SIZES[utility] as number);
      if (utility === "font-bold") slot.bold = true;
      const m = /^(bg|text)-([a-z-]+)$/.exec(utility);
      if (m && m[2]! in palettes.light) slot[m[1] === "bg" ? "bg" : "text"] = m[2];
    }
    const base = byVariant.get("") ?? {};
    for (const slot of byVariant.values()) {
      const words = slot.text ?? base.text;
      if (slot.bg && words) out.push({ where, text: words, bg: slot.bg, size: slot.size ?? base.size ?? 16, bold: slot.bold ?? base.bold ?? false });
    }
  }
  return out;
}

/** 3:1 for large text (24px, or 20px bold: the app's own line, a little above WCAG's 18.66px), else 4.5:1. */
export const needed = (p: Pair) => (p.size >= 24 || (p.bold && p.size >= 20) ? 3 : 4.5);
export const worst = (p: Pair) => Math.min(ratio(palettes.light[p.text]!, palettes.light[p.bg]!), ratio(palettes.dark[p.text]!, palettes.dark[p.bg]!));

// Circles that hold only an icon (no words): an icon needs 3:1, which white on the brand red meets. Each names its file.
const ICON_ONLY = new Set([
  "components/ProfileCard.tsx on-brand/brand",
  "components/FileVideo.tsx on-brand/brand",
  "components/IntroVideo.tsx on-brand/brand",
  "components/settings/WelcomeFlow.tsx on-brand/brand",
  "components/settings/PasskeyManager.tsx on-brand/brand",
  "components/navigation/NavigationHud.tsx white/brand", // the turn sign
  "components/auth/authUi.tsx on-brand/brand", // the words inside are text-xl bold, in their own span
]);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : files(path);
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [path] : [];
  });
}

describe("the scanner", () => {
  test("pairs a background with its words, per variant", () => {
    const pairs = pairsIn(`a "rounded bg-brand text-base text-on-brand aria-pressed:bg-selected aria-pressed:text-on-selected"`, "x");
    expect(pairs.map((p) => `${p.text}/${p.bg}@${p.size}`)).toEqual(["on-brand/brand@16", "on-selected/selected@16"]);
  });
  test("reads the size and weight under the same variant", () => {
    const [step] = pairsIn(`"[&_[data-step]]:before:bg-brand [&_[data-step]]:before:text-2xl [&_[data-step]]:before:text-on-brand"`, "x");
    expect(step!.size).toBe(24);
  });
  test("small words on the brand red fail, 20px bold passes", () => {
    const [small] = pairsIn(`"bg-brand text-sm font-bold text-on-brand"`, "x");
    const [large] = pairsIn(`"bg-brand text-xl font-bold text-on-brand"`, "x");
    expect(worst(small!)).toBeLessThan(needed(small!));
    expect(worst(large!)).toBeGreaterThanOrEqual(needed(large!));
  });
});

describe("words on a filled background are large enough for its contrast", () => {
  const all = files(src).flatMap((path) => pairsIn(readFileSync(path, "utf8"), relative(src, path)));
  test("the scan finds the app's class strings", () => {
    expect(all.length).toBeGreaterThan(50);
  });
  const failing = all
    .filter((p) => worst(p) < needed(p) && !ICON_ONLY.has(`${p.where} ${p.text}/${p.bg}`))
    .map((p) => `${p.where}: text-${p.text} on bg-${p.bg} at ${p.size}px${p.bold ? " bold" : ""} is ${worst(p).toFixed(2)}:1, needs ${needed(p)}:1`);
  test("no small words on a colour they cannot be read on", () => {
    expect(failing).toEqual([]);
  });
});
