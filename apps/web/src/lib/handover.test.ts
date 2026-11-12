import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// docs/HANDOVER.md is the entry point for whoever takes the project over. It must exist, be reviewed within 60 days
// (so it is "always ready", not written once and forgotten), and every repository file it names must exist.
const root = join(import.meta.dir, "../../../..");
const text = readFileSync(join(root, "docs/HANDOVER.md"), "utf8").replace(/\r\n/g, "\n");

test("HANDOVER.md was reviewed in the last 60 days", () => {
  const m = text.match(/^Last reviewed: (\d{4}-\d{2}-\d{2})$/m);
  expect(m).not.toBeNull();
  const days = (Date.now() - new Date(`${m![1]}T00:00:00Z`).getTime()) / 86_400_000;
  expect(days).toBeLessThan(60); // red: read the risks table, update it, and set "Last reviewed" to today
});

test("every repository file named in HANDOVER.md exists", () => {
  const named = [...text.matchAll(/`((?:docs\/|apps\/|\.github\/)[^`\s]+|README\.md|COMMANDS\.md|MAINTAINING\.md|\.env\.example)`/g)].map((x) => x[1]!);
  const missing = named.filter((p) => !/[*<>]|\/$/.test(p) && !existsSync(join(root, p)));
  expect(named.length).toBeGreaterThan(8);
  expect(missing).toEqual([]);
});
