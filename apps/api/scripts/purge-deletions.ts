// Delete the accounts whose deletion request is older than the grace period (3 days): bun run purge:deletions
// Run it on a schedule (once an hour is plenty). Safe to run again: it only deletes what is due, and an account
// whose owner cancelled in time is left alone. Prints only a count, never an email or an id.
import { createDb } from "../src/db/client";
import { createDrizzleMeStore } from "../src/me/me-store";
import { createMeService } from "../src/me/me-service";

const { db, client } = createDb(process.env.DATABASE_URL);
const host = new URL(process.env.DATABASE_URL!).hostname;
const deleted = await createMeService({ store: createDrizzleMeStore(db) }).purgeDue();
console.log(`Purged ${deleted} account(s) on ${host}.`);
await client.end();
