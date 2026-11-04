// Applies apps/api/drizzle migrations with drizzle-orm's migrator, so it runs inside the production image, which has no
// drizzle-kit. Same journal table as `drizzle-kit migrate` (drizzle.__drizzle_migrations), so the two can be mixed.
// Used by deploy/aws/docker-compose.yml before the API starts: bun scripts/migrate.ts
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { createDb } from "../src/db/client";
import { databaseUrlFrom } from "../src/parse-env";

const { db, client } = createDb(databaseUrlFrom(process.env));
try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  console.log("migrations: up to date");
} finally {
  await client.end();
}
