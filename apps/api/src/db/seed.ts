// Starting content: bun run db:seed
// Safe to run again: it only adds what is missing and never overwrites CMS edits.
import { asc, count } from "drizzle-orm";
import { createDb, type Db } from "./client";
import { rallies, rallyRoutes, rallySpots, rallyTranslations, routes, routeTranslations, spots, spotTranslations } from "./schema";
import { flattenTexts, ROUTE_TEXT } from "./translations";
import { MOUND_RALLY, SEED_ROUTES, seedSpots } from "./seed-data";

/** A database or a transaction: all the seed needs is select and insert. */
export type Executor = Pick<Db, "select" | "insert">;

export interface SeedResult {
  /** Rallies created (only into an empty table): the sutra-mound rally of places and one rally of courses per course. */
  rallies: number;
  routes: number;
  spots: number;
  /** Links created: places of the mound rally (rally_spots) and courses of the course rallies (rally_routes). */
  links: number;
}

export async function seed(db: Executor): Promise<SeedResult> {
  let routesCreated = 0;
  const routeCount = (await db.select({ n: count() }).from(routes))[0]?.n ?? 0;
  if (routeCount === 0) {
    const made = await db
      .insert(routes)
      .values(SEED_ROUTES.map((_, i) => ({ sortOrder: i + 1 })))
      .returning({ id: routes.id, sortOrder: routes.sortOrder });
    await db.insert(routeTranslations).values(
      made.flatMap(({ id, sortOrder }) => {
        const r = SEED_ROUTES[sortOrder - 1]!;
        return [
          { routeId: id, locale: "ja" as const, name: r.nameJa },
          { routeId: id, locale: "en" as const, name: r.nameEn },
        ];
      }),
    );
    routesCreated = made.length;
  }

  // The courses in trail order: course N is the Nth row. A mound whose course is missing is skipped.
  const names = flattenTexts(ROUTE_TEXT, await db.select().from(routeTranslations), (t) => t.routeId);
  const courses = (await db.select({ id: routes.id }).from(routes).orderBy(asc(routes.sortOrder))).map((c) => ({
    id: c.id,
    nameJa: names.get(c.id)?.nameJa ?? "",
    nameEn: names.get(c.id)?.nameEn ?? null,
  }));

  let spotsCreated = 0;
  const spotCount = (await db.select({ n: count() }).from(spots))[0]?.n ?? 0;
  if (spotCount === 0 && courses.length > 0) {
    // No lat/lng, published=false, permissionConfirmed=false: drafts only.
    const values = seedSpots().flatMap(({ routeNumber, ...s }) => {
      const course = courses[routeNumber - 1];
      return course ? [{ ...s, routeId: course.id }] : [];
    });
    const made =
      values.length > 0
        ? await db
            .insert(spots)
            .values(values.map(({ routeId, sortOrder }) => ({ routeId, sortOrder })))
            .returning({ id: spots.id, routeId: spots.routeId, sortOrder: spots.sortOrder })
        : [];
    // A seed place is known by its course and its order there.
    const words = new Map(values.map((v) => [`${v.routeId}:${v.sortOrder}`, v]));
    if (made.length > 0) {
      await db.insert(spotTranslations).values(
        made.flatMap(({ id, routeId, sortOrder }) => {
          const s = words.get(`${routeId}:${sortOrder}`)!;
          return [
            { spotId: id, locale: "ja" as const, name: s.nameJa },
            { spotId: id, locale: "en" as const, name: s.nameEn },
          ];
        }),
      );
    }
    spotsCreated = made.length;
  }

  // Rallies, only into an empty table (never undoes an admin's rallies): the sutra-mound rally as a rally of PLACES
  // (every mound place in trail order) and one rally of COURSES per course, all published. The admin can then
  // regroup courses into bigger rallies and delete these.
  let ralliesCreated = 0;
  let links = 0;
  const rallyCount = (await db.select({ n: count() }).from(rallies))[0]?.n ?? 0;
  if (rallyCount === 0) {
    const allSpots = await db.select({ id: spots.id, routeId: spots.routeId, sortOrder: spots.sortOrder }).from(spots);
    const courseOrder = new Map(courses.map((c, i) => [c.id, i]));
    const inTrailOrder = [...allSpots].sort(
      (a, b) => (courseOrder.get(a.routeId) ?? 0) - (courseOrder.get(b.routeId) ?? 0) || a.sortOrder - b.sortOrder,
    );

    const named = async (values: typeof rallies.$inferInsert, nameJa: string, nameEn: string | null) => {
      const [made] = await db.insert(rallies).values({ ...values, published: true }).returning({ id: rallies.id });
      await db.insert(rallyTranslations).values([
        { rallyId: made!.id, locale: "ja", name: nameJa },
        { rallyId: made!.id, locale: "en", name: nameEn },
      ]);
      ralliesCreated++;
      return made!.id;
    };

    const mounds = await named({ kind: "places", sortOrder: 0 }, MOUND_RALLY.nameJa, MOUND_RALLY.nameEn);
    if (inTrailOrder.length > 0) {
      await db.insert(rallySpots).values(inTrailOrder.map((s, i) => ({ rallyId: mounds, spotId: s.id, position: i + 1 })));
      links += inTrailOrder.length;
    }
    for (const [i, c] of courses.entries()) {
      const id = await named({ kind: "course", sortOrder: i + 1 }, c.nameJa, c.nameEn);
      await db.insert(rallyRoutes).values({ rallyId: id, routeId: c.id, position: 1 });
      links++;
    }
  }

  return { rallies: ralliesCreated, routes: routesCreated, spots: spotsCreated, links };
}

if (import.meta.main) {
  const { db, client } = createDb(process.env.DATABASE_URL);
  const host = new URL(process.env.DATABASE_URL!).hostname;
  const result = await seed(db);
  console.log(
    `Seeded ${host}: ${result.rallies} rallies, ${result.routes} routes, ${result.spots} spots, ${result.links} place-in-rally links.`,
  );
  if (!result.rallies && !result.routes && !result.spots && !result.links) console.log("Nothing to do: everything is already there.");
  await client.end();
}
