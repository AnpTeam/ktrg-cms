import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SQL } from "bun";
import { databaseUrlFrom } from "../src/parse-env";
import { HELP, newFiles, parseJournal, pendingMigrations } from "./ktrg-lib";

// The project's command line: `bun run ktrg <command>` from the repo root (see HELP in ktrg-lib.ts).

const root = resolve(import.meta.dir, "../../..");
const api = resolve(root, "apps/api");
const drizzleDir = resolve(api, "drizzle");

/** Run a command, showing its output; resolves with its exit code. */
async function run(cmd: string[], cwd = root): Promise<number> {
  const child = Bun.spawn(cmd, { cwd, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  return child.exited;
}

const journalPath = resolve(drizzleDir, "meta/_journal.json");
const files = () => new Set([...readdirSync(drizzleDir), ...readdirSync(resolve(drizzleDir, "meta")).map((f) => `meta/${f}`)]);

async function status(): Promise<number> {
  const url = databaseUrlFrom(process.env);
  if (!url) return console.error("DATABASE_URL is not set (put it in .env at the repo root)."), 1;
  const entries = parseJournal(readFileSync(journalPath, "utf8"));
  const db = new SQL(url);
  let applied: number[] = [];
  try {
    applied = (await db`select created_at from drizzle.__drizzle_migrations`).map((r: { created_at: string | number }) => Number(r.created_at));
  } catch {
    // No migrations table yet: nothing has been applied.
  } finally {
    await db.close();
  }
  const waiting = new Set(pendingMigrations(entries, applied).map((e) => e.tag));
  for (const e of entries) console.log(`${waiting.has(e.tag) ? "waiting " : "applied "} ${e.tag}`);
  console.log(waiting.size === 0 ? "\nThe database is up to date." : `\n${waiting.size} waiting. Run: bun run ktrg db migrate`);
  return 0;
}

/** Ask drizzle-kit for a migration; if it writes one, the schema files and the migrations disagree. Nothing is kept. */
async function drift(): Promise<number> {
  const journalBefore = readFileSync(journalPath, "utf8");
  const before = files();
  const code = await run(["bun", "run", "db:generate", "--", "--name", "drift_check"], api);
  const made = newFiles(before, files());
  if (made.length > 0) {
    for (const f of made) rmSync(resolve(drizzleDir, f));
    writeFileSync(journalPath, journalBefore);
    console.error(`\nThe schema files have changes no migration covers. Run: bun run ktrg db generate <name>`);
    return 1;
  }
  if (code === 0) console.log("\nThe migrations match the schema files.");
  return code;
}

const [group, ...rest] = process.argv.slice(2);
const sub = rest[0];

const commands: Record<string, () => Promise<number>> = {
  dev: async () => {
    const both = [run(["bun", "run", "dev:api"]), run(["bun", "run", "dev:web"])];
    return (await Promise.race(both)) ?? 0;
  },
  check: () => run(["bun", "run", "check"]),
  "db status": status,
  "db migrate": () => run(["bun", "run", "db:migrate"], api),
  "db generate": async () => {
    const name = rest[1];
    if (!name || !/^\w+$/.test(name)) return console.error("Give the migration a name, for example: bun run ktrg db generate route_tags"), 1;
    return run(["bun", "run", "db:generate", "--", "--name", name], api);
  },
  "db drift": drift,
  "db seed": () => run(["bun", "run", "db:seed"], api),
};

const key = group === "db" ? `db ${sub ?? ""}` : (group ?? "");
const command = commands[key];
if (!command) {
  console.log(HELP);
  process.exit(group && group !== "help" ? 1 : 0);
}
process.exit(await command());
