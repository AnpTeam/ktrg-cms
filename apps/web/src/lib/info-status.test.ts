import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { offersNoStamp } from "./spot-status";

// 2026-11-12 (user): a place that exists but offers no stamp used to be set to "closed", which said "you cannot stamp here
// now". The "information only" status says what is true: nothing is blocked, there is just no stamp there.
const read = (...p: string[]) => readFileSync(join(import.meta.dir, "..", ...p), "utf8");

test("closed and information-only places are not stamp targets; open and caution are", () => {
  expect(offersNoStamp("closed")).toBe(true);
  expect(offersNoStamp("info")).toBe(true);
  expect(offersNoStamp("open")).toBe(false);
  expect(offersNoStamp("caution")).toBe(false);
  expect(offersNoStamp(undefined)).toBe(false);
});

test("an information place gets a calm panel and no stamp button, and an admin can set it", () => {
  const banner = read("components", "StatusBanner.tsx");
  expect(banner).toMatch(/status === "info"/);
  expect(banner).toContain("ここにはスタンプはありません。");
  expect(read("components", "StampHere.tsx")).toMatch(/status === "info" \?/);
  expect(read("components", "admin", "PlacePanel.tsx")).toMatch(/<option value="info">/);
});

test("the new words exist in both languages", () => {
  for (const [lang, a, b] of [["ja", "案内のみ", "ここにはスタンプはありません。"], ["en", "Information only", "There is no stamp here."]] as const) {
    const po = read("locales", `${lang}.po`);
    expect(po).toMatch(new RegExp(`msgid "案内のみ"\r?\nmsgstr "${a}"`));
    expect(po).toMatch(new RegExp(`msgid "ここにはスタンプはありません。"\r?\nmsgstr "${b}"`));
  }
});
