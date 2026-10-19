import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Query parameters that hosted-database URLs carry for other tools. postgres.js would send
// any parameter it does not know to the server as a setting, and the server refuses unknown ones.
const FOREIGN_PARAMS = ["supa", "pgbouncer"];

/**
 * How to connect for this URL. A transaction pooler (Supabase's port 6543, or a URL marked
 * pgbouncer=true) gives each query whichever server connection is free, so prepared statements
 * (postgres.js's default) would be missing on the next query: turn them off there.
 */
export function connectionFor(databaseUrl: string): { url: string; prepare: boolean } {
  const url = new URL(databaseUrl);
  const transactionPooler = url.port === "6543" || url.searchParams.get("pgbouncer") === "true";
  for (const name of FOREIGN_PARAMS) url.searchParams.delete(name);
  return { url: url.toString(), prepare: !transactionPooler };
}

/** Creates a database client. Nothing connects until the first query. */
export function createDb(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const { url, prepare } = connectionFor(databaseUrl);
  const client = postgres(url, { max: 5, prepare });
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof createDb>["db"];
