// Git merge driver for src/locales/*.po (see .gitattributes and `bun run setup:git`): keeps the incoming catalog, adds the
// messages this branch added and fills empty English from either side, so a .po file never shows a conflict.
//   bun apps/web/scripts/merge-po.ts <base> <ours> <theirs>     (git passes %O %A %B; the result is written over <ours>)
import { readFileSync, writeFileSync } from "node:fs";
import { mergeCatalogs } from "./resolve-catalogs-lib";

if (import.meta.main) {
  const [base, ours, theirs] = process.argv.slice(2) as [string, string, string];
  const read = (p: string) => readFileSync(p, "utf8");
  writeFileSync(ours, mergeCatalogs(read(base), read(ours), read(theirs)));
}
