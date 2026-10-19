// Prints what the database holds for each route (names and counts only), to see what the admin will show.
//   bun --env-file=../../.env scripts/show-routes.ts
import { createDb } from "../src/db/client";
import { createDrizzleContentStore } from "../src/content/content-store";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, client } = createDb(url);
try {
  for (const r of await createDrizzleContentStore(db).listRoutes()) {
    console.log(
      `${String(r.sortOrder).padStart(2)} ${r.nameJa} | line ${r.geometry ? r.geometry.coordinates.length + " pts" + (r.lineVerified ? " (checked)" : "") : "none"} | places ${r.publishedSpotCount}/${r.spotCount} | points ${r.pointCount} | km ${r.distanceKm ?? "-"}`,
    );
  }
} finally {
  await client.end();
}
