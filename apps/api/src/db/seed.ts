// Starting content: bun run db:seed
// Safe to run again: it only fills tables that are empty, so it never overwrites CMS edits.
import { asc, count } from "drizzle-orm";
import { createDb, type Db } from "./client";
import { rallies, routes, spots } from "./schema";
import { SEED_ROUTES, seedSpots } from "./seed-data";

/** A database or a transaction: all the seed needs is select and insert. */
export type Executor = Pick<Db, "select" | "insert">;

export interface SeedResult {
  rally: boolean;
  routes: number;
  spots: number;
}

export async function seed(db: Executor): Promise<SeedResult> {
  // The one permanent rally. A second insert is refused by the single-row unique index.
  const rally = await db.insert(rallies).values({}).onConflictDoNothing().returning({ id: rallies.id });

  let routesCreated = 0;
  const routeCount = (await db.select({ n: count() }).from(routes))[0]?.n ?? 0;
  if (routeCount === 0) {
    const made = await db
      .insert(routes)
      .values(SEED_ROUTES.map((r, i) => ({ nameJa: r.nameJa, nameEn: r.nameEn, sortOrder: i + 1 })))
      .returning({ id: routes.id });
    routesCreated = made.length;
  }

  let spotsCreated = 0;
  const spotCount = (await db.select({ n: count() }).from(spots))[0]?.n ?? 0;
  // The courses in trail order: course N is the Nth row. A mound whose course is missing is skipped.
  const courses = await db.select({ id: routes.id }).from(routes).orderBy(asc(routes.sortOrder));
  if (spotCount === 0 && courses.length > 0) {
    // No lat/lng, published=false, permissionConfirmed=false: drafts only.
    const values = seedSpots().flatMap(({ routeNumber, ...s }) => {
      const course = courses[routeNumber - 1];
      return course ? [{ ...s, routeId: course.id }] : [];
    });
    const made = values.length > 0 ? await db.insert(spots).values(values).returning({ id: spots.id }) : [];
    spotsCreated = made.length;
  }

  return { rally: rally.length === 1, routes: routesCreated, spots: spotsCreated };
}

if (import.meta.main) {
  const { db, client } = createDb(process.env.DATABASE_URL);
  const host = new URL(process.env.DATABASE_URL!).hostname;
  const result = await seed(db);
  console.log(`Seeded ${host}: rally ${result.rally ? "created" : "already there"}, ${result.routes} routes, ${result.spots} spots.`);
  if (!result.rally && !result.routes && !result.spots) console.log("Nothing to do: the tables already have data.");
  await client.end();
}
