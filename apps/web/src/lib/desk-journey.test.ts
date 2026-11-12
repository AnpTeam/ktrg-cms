import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The desktop journey (docs/landing-desktop-design.md): source-level checks of how the pieces are wired, like decor.test.ts.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8");

test("the scene does not start when a beat is taller than the screen", () => {
  const scene = read("components", "landing", "JourneyScene.tsx");
  expect(scene).toMatch(/import \{[^}]*\bSCENE_QUERY\b[^}]*\bbeatsFit\b[^}]*\} from "@\/lib\/landing-desktop"|import \{[^}]*\bbeatsFit\b[^}]*\bSCENE_QUERY\b[^}]*\} from "@\/lib\/landing-desktop"/);
  expect(scene).toMatch(/mm\.add\(mode === "scene" \? SCENE_QUERY :/);
  expect(scene).not.toMatch(/\(min-height: 38rem\)"/); // the literal lives in one place
  const added = scene.indexOf('classList.add("journey-live")');
  const checked = scene.indexOf("beatsFit(", added);
  expect(added).toBeGreaterThan(-1);
  expect(checked).toBeGreaterThan(added);
  expect(scene.slice(checked, checked + 400)).toMatch(/classList\.remove\("journey-live"\)/);
});

test("the desk is its own screen gate, never the `wide` variant (that one matches a phone on its side)", () => {
  const css = read("app", "globals.css");
  expect(css).toMatch(/@custom-variant desk \{\s*@media \(min-width: 1024px\) and \(min-height: 38rem\) \{\s*@slot;/);
  expect(css).not.toMatch(/@custom-variant desk[^}]*max-height/);
  // 300 svh of scroll only on the desk, and only while the scene is live.
  expect(css).toMatch(/@media \(min-width: 1024px\) and \(min-height: 38rem\) \{[^@]*\.journey-live \{\s*height: 300svh;/s);
});

test("the picture panel and the step marker are drawings behind and beside the words, in tokens, for the desk only", () => {
  const panel = read("components", "landing", "DeskPanel.tsx");
  expect(panel).toMatch(/export function DeskPanel\(/);
  expect(panel).toMatch(/data-picture/);
  expect(panel).toMatch(/data-steps/);
  expect(panel.match(/data-step=/g)?.length).toBe(3);
  expect(panel).toMatch(/aria-hidden="true"/);
  expect(panel).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  const css = read("app", "globals.css");
  // Outside the desk and outside the live scene they are not drawn at all.
  expect(css).toMatch(/\[data-picture\],\s*\[data-picture-credit\],\s*\[data-steps\] \{\s*display: none;/);
  const journey = read("components", "landing", "Journey.tsx");
  expect(journey).toMatch(/<DeskPanel photos=\{panelPhotos\(/);
  expect(read("components", "landing", "Decor.tsx")).toMatch(/export function Waves\(\{ id\b/);
});

test("the step marker's words exist in both languages", () => {
  for (const [lang, ridge, sea] of [["ja", "稜線", "海"], ["en", "Ridge", "Sea"]] as const) {
    const po = read("locales", `${lang}.po`);
    expect(po).toMatch(new RegExp(`msgid "稜線"\r?\nmsgstr "${ridge}"`));
    expect(po).toMatch(new RegExp(`msgid "海"\r?\nmsgstr "${sea}"`));
  }
});
