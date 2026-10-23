// The pure parts of the ktrg command line (scripts/ktrg.ts), so they can be tested without a database.

export interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

/** The migrations Drizzle knows about, in order (drizzle/meta/_journal.json). */
export function parseJournal(text: string): JournalEntry[] {
  const parsed = JSON.parse(text) as { entries?: JournalEntry[] };
  return (parsed.entries ?? []).map((e) => ({ idx: e.idx, when: e.when, tag: e.tag }));
}

/**
 * Drizzle stores each applied migration with its journal time (`when`) and applies them in order, so a migration is
 * waiting when it is newer than the newest applied one.
 */
export function pendingMigrations(entries: readonly JournalEntry[], appliedAt: readonly number[]): JournalEntry[] {
  const newest = Math.max(0, ...appliedAt);
  return entries.filter((e) => e.when > newest);
}

/** Files that are in `after` and were not in `before`: what a `generate` wrote. */
export function newFiles(before: ReadonlySet<string>, after: ReadonlySet<string>): string[] {
  return [...after].filter((f) => !before.has(f)).sort();
}

export const HELP = `ktrg: the project's commands

  bun run ktrg dev                 start the API and the web app together
  bun run ktrg check               typecheck and run every test
  bun run ktrg db status           which migrations are applied and which are waiting (needs DATABASE_URL)
  bun run ktrg db migrate          apply the waiting migrations
  bun run ktrg db generate <name>  write a migration from changes in the schema files
  bun run ktrg db drift            fail if the schema files have changes no migration covers (for CI)
  bun run ktrg db seed             load the sample routes, places and rallies
  bun run ktrg help                this text
`;
