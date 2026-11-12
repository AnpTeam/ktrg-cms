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
