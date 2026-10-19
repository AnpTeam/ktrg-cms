// Loads the draft content of route 2 (甲山から孝子越え) into the database, so the admin shows what the sample pages show.
// The data is the sample file of the web app (converted from Navivi's export), and stays DRAFT:
//   - the line is not marked as checked, and no place has a checked position (the positions were clicked on Navivi's
//     map, not taken from an official source), so visitors see none of it until a person checks and publishes it;
//   - the descriptions are the narration Navivi's AI wrote from photos: they are a draft to review.
// It never overwrites: a route that already has a line is left alone. A place that is already there (the real mound of
// the course, from the manager's sheet) is kept under its own name and gets the draft text and position; the other stops
// of the sample are added.
//
//   bun --env-file=../../.env scripts/import-route-02.ts        (local database only)

import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { users } from "../src/db/schema";
import { createDrizzleContentStore } from "../src/content/content-store";
import { createContentService } from "../src/content/content-service";
import { route02Draft } from "../../web/src/lib/sample-route-02";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) throw new Error(`Refusing to import into ${host}: local database only.`);

const { db, client } = createDb(url);
try {
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (!admin) throw new Error("There is no admin account yet. Log in once with an address in ADMIN_EMAILS, then run this again.");

  const store = createDrizzleContentStore(db);
  const service = createContentService({ store });
  const route = (await service.listRoutes()).find((r) => r.nameJa === route02Draft.nameJa);
  if (!route) throw new Error(`No route named ${route02Draft.nameJa}: run the seed first (bun run db:seed).`);
  if (route.geometry) {
    console.log("Route 2 already has a line: nothing imported.");
  } else {
    // [lat, lng] pairs become [lng, lat, elevation]; the elevations are spread evenly along the path.
    const line = route02Draft.line.map(([lat, lng], i) => {
      const e = route02Draft.elevations;
      const ele = e.length > 0 ? e[Math.min(e.length - 1, Math.round((i * (e.length - 1)) / Math.max(1, route02Draft.line.length - 1)))] : undefined;
      return ele === undefined ? [lng, lat] : [lng, lat, ele];
    });
    const saved = await service.updateRoute(admin.id, route.id, route.updatedAt, {
      prefecture: route02Draft.prefecture,
      municipality: route02Draft.municipality,
      distanceKm: route02Draft.distanceKm,
      elevationGainM: route02Draft.elevationGainM,
      geometry: { type: "LineString", coordinates: line },
      lineVerified: false,
    });
    if (!saved.ok) throw new Error(`Could not save the route: ${saved.reason}`);

    const existing = (await service.getRoute(route.id))?.spots ?? [];
    const taken = new Set<string>();
    let n = 0;
    let merged = 0;
    const ordered: string[] = []; // the places in the order of the sample's stops
    for (const spot of route02Draft.spots) {
      // The same mound under another name: the sheet's name starts with where it is (神福寺跡・方便品).
      const same = existing.find((e) => !taken.has(e.id) && e.kind === "stamp" && !spot.stopBy && [spot.nameJa, spot.descriptionJa].some((t) => t.includes(e.nameJa.split("・")[0]!)));
      if (same) {
        taken.add(same.id);
        const updated = await service.updateSpot(admin.id, same.id, same.updatedAt, { descriptionJa: same.descriptionJa ?? spot.descriptionJa, lat: spot.lat, lng: spot.lng });
        if (!updated.ok) throw new Error(`Could not update ${same.nameJa}: ${updated.reason}`);
        merged++;
        ordered.push(same.id);
        continue;
      }
      const made = await service.createSpot(admin.id, route.id, {
        nameJa: spot.nameJa,
        descriptionJa: spot.descriptionJa,
        lat: spot.lat,
        lng: spot.lng,
        // A stop the route only passes by is a navigation point, not a stamp place.
        kind: spot.stopBy ? "other" : "stamp",
      });
      if (!made.ok) throw new Error(`Could not add ${spot.nameJa}: ${made.reason}`);
      n++;
      ordered.push(made.value.id);
    }
    // Any place that was there already and is not one of the sample's stops goes last.
    const inOrder = await service.reorderSpots(admin.id, route.id, [...ordered, ...existing.map((e) => e.id).filter((id) => !ordered.includes(id))]);
    if (!inOrder.ok) throw new Error(`Could not put the places in order: ${inOrder.reason}`);
    console.log(`Imported route 2: ${line.length} line points, ${n} places added and ${merged} existing place updated, all drafts (nothing is public).`);
  }
} finally {
  await client.end();
}
