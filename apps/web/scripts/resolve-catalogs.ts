// Fixes a merge (or rebase) conflict in the translation catalogs (src/locales/en.po and ja.po) without anyone editing them.
// Both files are generated: the Japanese text and the places in the code come from `lingui extract`, so the only thing
// worth keeping from the branch is its English translations. This takes the other side's catalog (the one from main),
// runs `lingui extract --clean` so the branch's new messages are added, and writes the branch's English into the empty
// ones. It marks the files resolved (`git add`); commit as usual. Then `bun run check:catalogs` says if anything has no
// English.
//   bun run resolve:catalogs        (from apps/web, in the middle of a conflicted merge or rebase)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fillEmpty, hasConflictMarkers, translationsOf } from "./resolve-catalogs-lib";

const web = import.meta.dir + "/..";
const git = (...args: string[]) => {
  const r = Bun.spawnSync(["git", ...args], { cwd: web, stdout: "pipe", stderr: "pipe" });
  return { ok: r.exitCode === 0, out: r.stdout.toString() };
};

if (import.meta.main) {
  const files = ["en", "ja"].map((l) => `src/locales/${l}.po`);
  const conflicted = files.filter((f) => git("ls-files", "-u", "--", f).out.trim() !== "" || hasConflictMarkers(readFileSync(`${web}/${f}`, "utf8")));
  if (conflicted.length === 0) {
    console.log("No conflict in the catalogs: nothing to do.");
    process.exit(0);
  }

  // In a merge, stage 2 is this branch and stage 3 is the incoming one; in a rebase they are the other way round.
  const rebasing = ["rebase-merge", "rebase-apply"].some((d) => existsSync(resolve(web, git("rev-parse", "--git-path", d).out.trim())));
  const [mine, theirs] = rebasing ? [":3", ":2"] : [":2", ":3"];

  const known = new Map<string, Map<string, string[]>>();
  for (const f of conflicted) {
    const ours = git("show", `${mine}:./${f}`);
    const incoming = git("show", `${theirs}:./${f}`);
    if (!ours.ok || !incoming.ok) {
      console.error(`Could not read both sides of ${f} from git (is a merge or rebase in progress?).`);
      process.exit(1);
    }
    known.set(f, translationsOf(ours.out));
    writeFileSync(`${web}/${f}`, incoming.out); // the other side's catalog, to be extended
  }

  const extract = Bun.spawnSync(["bunx", "lingui", "extract", "--clean"], { cwd: web, stdout: "ignore", stderr: "inherit" });
  if (extract.exitCode !== 0) process.exit(extract.exitCode ?? 1);

  for (const f of conflicted) {
    const { text, filled } = fillEmpty(readFileSync(`${web}/${f}`, "utf8"), known.get(f)!);
    writeFileSync(`${web}/${f}`, text);
    git("add", "--", f);
    console.log(`${f}: ${filled} translation(s) from this branch put back, marked resolved.`);
  }
  console.log("\nNow run: bun run check:catalogs   (it lists any message still without English), then commit.");
}
