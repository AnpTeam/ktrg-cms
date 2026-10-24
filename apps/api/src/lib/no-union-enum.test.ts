import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Glob } from "bun";

// t.UnionEnum gives a field a default (its first word). In a partial change (a PATCH sends only what changed) a field that
// was left out is then filled with it and silently overwritten: a place lost its category that way. Use `oneOf` (lib/schemas.ts).
// The map style is the exception: it is always sent whole.
const ALLOWED = new Set(["site-settings/site-settings.ts"]);

test("no schema uses t.UnionEnum, so a field left out of a change keeps its value", () => {
  const found: string[] = [];
  for (const file of new Glob("**/*.ts").scanSync({ cwd: import.meta.dir + "/.." })) {
    if (file.endsWith(".test.ts") || ALLOWED.has(file)) continue;
    const code = readFileSync(import.meta.dir + "/../" + file, "utf8").split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//")).join("\n");
    if (code.includes("t.UnionEnum(")) found.push(file);
  }
  expect(found).toEqual([]);
});
