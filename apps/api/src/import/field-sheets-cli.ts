// Loads the field team's CSV sheets into the database as DRAFT waypoints (nothing is published, no position is marked
// as checked). Without --apply it only prints what it would do.
//   bun --env-file=../../.env src/import/field-sheets-cli.ts --stops <stops.csv> --places <places.csv> [--mounds <points.geojson>] [--apply]
// Safe to run again: places already loaded are found by course, kind, name and position and are not added twice.
// Refuses a database that is not on this computer unless --allow-remote is given (a person's decision, not a default).
import { readFileSync } from "node:fs";
import { asc, eq } from "drizzle-orm";
import { createDb } from "../db/client";
import { routes, spots, spotTranslations } from "../db/schema";
import { parseFacilities, parseMoundPoints, parseStops, planLoad, type Existing, type SpotKindName } from "./field-sheets";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args[args.indexOf(`--${name}`) + 1];
const need = (name: string) => {
  const v = flag(name) ? value(name) : undefined;
  if (!v) throw new Error(`--${name} <file> is needed`);
  return readFileSync(v, "utf8");
};

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !flag("allow-remote")) {
  throw new Error(`${host} is not on this computer; add --allow-remote only if you mean it`);
}

const parsedStops = parseStops(need("stops"));
const facilities = parseFacilities(need("places"));
const mounds = flag("mounds") ? parseMoundPoints(need("mounds")) : [];

const { db, client } = createDb(url);
const courses = await db.select({ id: routes.id }).from(routes).orderBy(asc(routes.sortOrder));
const routeNumber = new Map(courses.map((c, i) => [c.id, i + 1]));
const rows = await db
  .select({ id: spots.id, routeId: spots.routeId, kind: spots.kind, lat: spots.lat, lng: spots.lng, sortOrder: spots.sortOrder, name: spotTranslations.name })
  .from(spots)
  .leftJoin(spotTranslations, eq(spotTranslations.spotId, spots.id));
const existing: Existing[] = rows.flatMap((r) => (r.name !== null && routeNumber.has(r.routeId) ? [{ id: r.id, route: routeNumber.get(r.routeId)!, nameJa: r.name, kind: r.kind as SpotKindName, lat: r.lat, lng: r.lng, sortOrder: r.sortOrder }] : []));

const plan = planLoad({ stops: parsedStops.stops, facilities, mounds, existing });
const created = plan.spots.filter((s) => !s.existing);
const byRoute = new Map<number, typeof plan.spots>();
for (const s of plan.spots) byRoute.set(s.route, [...(byRoute.get(s.route) ?? []), s]);

console.log(`Database: ${host}`);
console.log(`Stops read: ${parsedStops.stops.length} (course headings: ${parsedStops.routes.length}, caution notes left out: ${parsedStops.skippedNotes})`);
console.log(`Places read: ${facilities.length}; waiting for the places directory: ${JSON.stringify(plan.waiting)}`);
console.log(`Plan: ${created.length} new waypoints, ${plan.spots.length - created.length} already there (re-ordered), on courses ${[...byRoute.keys()].join(", ")}`);
for (const n of plan.notes) console.log(`  note: ${n}`);

if (!flag("apply")) {
  console.log("Dry run: nothing was written. Add --apply to write.");
  await client.end();
  process.exit(0);
}

await db.transaction(async (tx) => {
  for (const [route, list] of byRoute) {
    const routeId = courses[route - 1]?.id;
    if (!routeId) {
      console.log(`  course ${route} does not exist: skipped`);
      continue;
    }
    for (const [i, p] of list.entries()) {
      const sortOrder = i + 1;
      if (p.existing) {
        // A position fills an empty one only; it never replaces what is there.
        const fill = p.existing.lat === null && p.lat !== null ? { lat: p.lat, lng: p.lng, positionSource: p.source } : {};
        await tx.update(spots).set({ sortOrder, ...fill }).where(eq(spots.id, p.existing.id));
      } else {
        const [made] = await tx
          .insert(spots)
          .values({ routeId, sortOrder, kind: p.kind, stampable: p.stampable, lat: p.lat, lng: p.lng, positionVerified: false, positionSource: p.source })
          .returning({ id: spots.id });
        await tx.insert(spotTranslations).values([
          { spotId: made!.id, locale: "ja", name: p.nameJa },
          ...(p.nameEn ? [{ spotId: made!.id, locale: "en" as const, name: p.nameEn }] : []),
        ]);
      }
    }
  }
});
console.log("Written. Everything is a draft: open each place in the admin, check its position, and publish when ready.");
await client.end();
