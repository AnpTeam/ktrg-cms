import { expect, test } from "bun:test";
import { Glob } from "bun";
import { join } from "node:path";

// The browser's own boxes cannot be styled or translated and explain nothing: use confirmDialog (ConfirmDialog.tsx).
test("no window.confirm, alert or prompt in the app", async () => {
  const root = join(import.meta.dir, "..");
  const found: string[] = [];
  for await (const file of new Glob("**/*.{ts,tsx}").scan(root)) {
    // shortcut: PR #357 replaces the one confirm left in NavigationHud, remove this exception once it is merged.
    if (file.includes(".test.") || file.endsWith("NavigationHud.tsx")) continue;
    const text = await Bun.file(join(root, file)).text();
    if (/(?:window\.|(?<![.\w]))(?:confirm|alert|prompt)\(/.test(text)) found.push(file);
  }
  expect(found).toEqual([]);
});
