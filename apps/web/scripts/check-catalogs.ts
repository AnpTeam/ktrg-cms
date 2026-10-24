// Fails when the English catalog has a message with no English text: such a message shows Japanese on the English site
// without anyone noticing. Runs `lingui extract --clean` first, so a string added in code but never extracted is found too.
//   bun run check:catalogs

import { readFileSync } from "node:fs";

/** The msgids that have an empty msgstr (the file's own header, whose msgid is empty, is not one of them). */
export function missingTranslations(po: string): string[] {
  const missing: string[] = [];
  for (const block of po.split(/\n\s*\n/)) {
    const id = /^msgid ((?:".*"\s*\n?)+)/m.exec(block)?.[1];
    const str = /^msgstr ((?:".*"\s*\n?)+)/m.exec(block)?.[1];
    if (id === undefined || str === undefined) continue;
    const text = (quoted: string) => [...quoted.matchAll(/"(.*)"/g)].map((m) => m[1]).join("");
    if (text(id) !== "" && text(str) === "") missing.push(text(id));
  }
  return missing;
}

if (import.meta.main) {
  const run = Bun.spawnSync(["bunx", "lingui", "extract", "--clean"], { cwd: import.meta.dir + "/..", stdout: "ignore", stderr: "inherit" });
  if (run.exitCode !== 0) process.exit(run.exitCode ?? 1);
  const missing = missingTranslations(readFileSync(import.meta.dir + "/../src/locales/en.po", "utf8"));
  if (missing.length > 0) {
    console.error(`${missing.length} message(s) have no English text in src/locales/en.po:`);
    for (const id of missing) console.error(`  - ${id}`);
    process.exit(1);
  }
  console.log("English catalog is complete.");
}
