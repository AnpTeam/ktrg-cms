// Loads the field team's CSV sheets into the database as DRAFTS (nothing is published, no position is marked as
// checked): the stops of the courses become waypoints, the places along them go into the places directory.
// Without --apply it only prints what it would do.
//   bun --env-file=../../.env src/import/field-sheets-cli.ts --stops <stops.csv> --places <places.csv> [--mounds <points.geojson>] [--apply]
// Safe to run again: what is already there is found by course, kind or category, name and position, and not added twice.
// Refuses a database that is not on this computer unless --allow-remote is given (a person's decision, not a default).
import { readFileSync } from "node:fs";
import { asc, eq } from "drizzle-orm";
import { createDb } from "../db/client";
import { places, placeTranslations, routes, spots, spotTranslations } from "../db/schema";
import { parseFacilities, parseMoundPoints, parseStops, planLoad, planPlaces, type Existing, type ExistingPlace, type SpotKindName } from "./field-sheets";

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
const placeRows = await db
  .select({ id: places.id, routeId: places.routeId, category: places.category, lat: places.lat, lng: places.lng, name: placeTranslations.name })
  .from(places)
  .leftJoin(placeTranslations, eq(placeTranslations.placeId, places.id));
const existingPlaces: ExistingPlace[] = placeRows.flatMap((r) => (r.name === null ? [] : [{ id: r.id, route: r.routeId ? (routeNumber.get(r.routeId) ?? null) : null, category: r.category, nameJa: r.name, lat: r.lat, lng: r.lng }]));

const plan = planLoad({ stops: parsedStops.stops, mounds, existing });
const directory = planPlaces(facilities, existingPlaces);
const created = plan.spots.filter((s) => !s.existing);
const byRoute = new Map<number, typeof plan.spots>();
for (const s of plan.spots) byRoute.set(s.route, [...(byRoute.get(s.route) ?? []), s]);

console.log(`Database: ${host}`);
console.log(`Stops read: ${parsedStops.stops.length} (course headings: ${parsedStops.routes.length}, caution notes left out: ${parsedStops.skippedNotes})`);
console.log(`Waypoints: ${created.length} new, ${plan.spots.length - created.length} already there (re-ordered), on courses ${[...byRoute.keys()].join(", ")}`);
console.log(`Places directory: ${directory.places.length} new, ${directory.skipped} already there (of ${facilities.length} read)`);
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
          .values({ routeId, sortOrder, kind: p.kind, stampable: p.stampable, stopBy: p.stopBy, lat: p.lat, lng: p.lng, positionVerified: false, positionSource: p.source })
          .returning({ id: spots.id });
        await tx.insert(spotTranslations).values([
          { spotId: made!.id, locale: "ja", name: p.nameJa },
          ...(p.nameEn ? [{ spotId: made!.id, locale: "en" as const, name: p.nameEn }] : []),
        ]);
      }
    }
  }
  for (const p of directory.places) {
    const [made] = await tx
      .insert(places)
      .values({
        category: p.category as (typeof places.$inferInsert)["category"],
        routeId: courses[p.route - 1]?.id ?? null,
        lat: p.lat,
        lng: p.lng,
        positionVerified: false,
        positionSource: p.positionSource,
        address: p.address,
        phone: p.phone,
        website: p.website,
        status: p.status as (typeof places.$inferInsert)["status"],
        lastVerified: p.lastVerified,
        listingConfirmed: p.listingConfirmed,
        listingNote: p.listingNote,
      })
      .returning({ id: places.id });
    await tx.insert(placeTranslations).values([
      { placeId: made!.id, locale: "ja", name: p.nameJa, description: p.descriptionJa, hours: p.hoursJa, closedDays: p.closedDaysJa },
      ...(p.nameEn || p.descriptionEn || p.hoursEn || p.closedDaysEn
        ? [{ placeId: made!.id, locale: "en" as const, name: p.nameEn, description: p.descriptionEn, hours: p.hoursEn, closedDays: p.closedDaysEn }]
        : []),
    ]);
  }
});
console.log("Written. Everything is a draft: open each one in the admin, check its position, and publish when ready.");
await client.end();
