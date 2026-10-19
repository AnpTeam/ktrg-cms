// One-off: puts the places of route 2 in the order of the sample's stops (for a database imported before the import
// script did that itself). Safe to run again. Local database only.
//   bun --env-file=../../.env scripts/reorder-route-02.ts
import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { users } from "../src/db/schema";
import { createDrizzleContentStore } from "../src/content/content-store";
import { createContentService } from "../src/content/content-service";
import { route02Draft } from "../../web/src/lib/sample-route-02";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname)) throw new Error("local database only");
const { db, client } = createDb(url);
try {
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (!admin) throw new Error("no admin account");
  const service = createContentService({ store: createDrizzleContentStore(db) });
  const route = (await service.listRoutes()).find((r) => r.nameJa === route02Draft.nameJa);
  if (!route) throw new Error("route 2 not found");
  const places = (await service.getRoute(route.id))?.spots ?? [];
  const used = new Set<string>();
  const ordered: string[] = [];
  for (const stop of route02Draft.spots) {
    const hit =
      places.find((p) => !used.has(p.id) && p.nameJa === stop.nameJa) ??
      places.find((p) => !used.has(p.id) && !stop.stopBy && [stop.nameJa, stop.descriptionJa].some((t) => t.includes(p.nameJa.split("・")[0]!)));
    if (hit) {
      used.add(hit.id);
      ordered.push(hit.id);
    }
  }
  const rest = places.map((p) => p.id).filter((id) => !used.has(id));
  const r = await service.reorderSpots(admin.id, route.id, [...ordered, ...rest]);
  console.log(r.ok ? `Ordered ${ordered.length} places like the sample (${rest.length} others kept at the end).` : `Failed: ${r.reason}`);
} finally {
  await client.end();
}
