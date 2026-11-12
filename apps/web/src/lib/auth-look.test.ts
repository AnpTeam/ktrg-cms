import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-11-12: account and sign-in screens take the menu/profile look. Class names only; no auth logic.
const src = join(import.meta.dir, "..");
const read = (...p: string[]) => readFileSync(join(src, ...p), "utf8");
const TITLE = /<h1 className="[^"]*font-serif [^"]*text-3xl font-bold[^"]* text-accent/;
const BAR = "border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent";

test("auth pages: Mincho page titles in the readable red", () => {
  for (const p of ["login", "register", "restore", "password/undo", "settings/passkeys"]) {
    expect(read("app", "(public)", ...p.split("/"), "page.tsx")).toMatch(TITLE);
  }
});

test("auth panels: capsule corners, red-bar group titles", () => {
  for (const f of ["SignInPrompt.tsx", "ProfilePhoto.tsx", "settings/LoginMethods.tsx", "settings/PasswordMethod.tsx", "settings/PasskeyManager.tsx"]) {
    const s = read("components", ...f.split("/"));
    expect(s).toMatch(/rounded-\[1\.75rem\] bg-surface/);
    expect(s).not.toMatch(/rounded-3xl bg-surface/);
  }
  for (const f of ["ProfilePhoto.tsx", "settings/LoginMethods.tsx", "settings/PasswordMethod.tsx"]) {
    expect(read("components", ...f.split("/"))).toContain(BAR);
  }
});
