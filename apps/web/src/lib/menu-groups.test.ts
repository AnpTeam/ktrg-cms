import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12 (user): the menu takes the new design language, regrouped: account, bookmarks and reading, display, about.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8");

test("the menu is four titled groups on the paper ground, sign in is the brand button, links are ink rows", () => {
  const header = read("components", "SiteHeader.tsx");
  for (const title of ["アカウント", "しおりと読みもの", "表示と設定", "このアプリについて"]) expect(header).toContain(`<MenuGroup title={t\`${title}\`}>`);
  expect(header).toMatch(/buttonStyle\("action", "lg", "flex w-full"\)/);
  expect(header).toMatch(/menu-drop fixed inset-0[^"]*bg-paper/);
  expect(header).toMatch(/font-serif text-3xl font-bold text-accent/);
});

test("the new group names exist in both languages", () => {
  for (const [lang, en] of [["ja", ["しおりと読みもの", "表示と設定", "このアプリについて"]], ["en", ["Bookmarks and reading", "Display and settings", "About this app"]]] as const) {
    const po = read("locales", `${lang}.po`);
    ["しおりと読みもの", "表示と設定", "このアプリについて"].forEach((id, i) => expect(po).toMatch(new RegExp(`msgid "${id}"\r?\nmsgstr "${en[i]}"`)));
  }
});
