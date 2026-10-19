// Prints the places of one route (by its number): bun --env-file=../../.env scripts/show-route-places.ts 2
import { createDb } from "../src/db/client";
import { createDrizzleContentStore } from "../src/content/content-store";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const n = Number(process.argv[2] ?? "2");
const { db, client } = createDb(url);
try {
  const store = createDrizzleContentStore(db);
  const route = (await store.listRoutes())[n - 1];
  const found = route ? await store.getRoute(route.id) : null;
  for (const s of found?.spots ?? []) console.log(`${s.sortOrder} [${s.kind}] ${s.nameJa} | ${s.lat ?? "-"},${s.lng ?? "-"} | published ${s.published}`);
} finally {
  await client.end();
}
