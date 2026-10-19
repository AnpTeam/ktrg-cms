// Starting content: bun run db:seed
// Safe to run again: it only adds what is missing and never overwrites CMS edits.
import { asc, count } from "drizzle-orm";
import { createDb, type Db } from "./client";
import { rallies, rallySpots, rallyTranslations, routes, routeTranslations, spots, spotTranslations } from "./schema";
import { flattenTexts, ROUTE_TEXT } from "./translations";
import { MOUND_RALLY, SEED_ROUTES, seedSpots } from "./seed-data";

/** A database or a transaction: all the seed needs is select and insert. */
export type Executor = Pick<Db, "select" | "insert">;

export interface SeedResult {
  /** Rallies created: the mound rally and one per course. */
  rallies: number;
  routes: number;
  spots: number;
  /** Place-in-rally links created. */
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

  // Rallies: the mound rally and one per course, each only if it is missing.
  const existing = await db.select({ kind: rallies.kind, routeId: rallies.routeId }).from(rallies);
  const missing = [
    ...(existing.some((r) => r.kind === "mounds")
      ? []
      : [{ kind: "mounds" as const, nameJa: MOUND_RALLY.nameJa, nameEn: MOUND_RALLY.nameEn, sortOrder: 0 }]),
    ...courses.flatMap((c, i) =>
      existing.some((r) => r.routeId === c.id)
        ? []
        : [{ kind: "course" as const, routeId: c.id, nameJa: c.nameJa, nameEn: c.nameEn, sortOrder: i + 1 }],
    ),
  ];
  let ralliesCreated = 0;
  for (const { nameJa, nameEn, ...rally } of missing) {
    const [made] = await db.insert(rallies).values(rally).returning({ id: rallies.id });
    await db.insert(rallyTranslations).values([
      { rallyId: made!.id, locale: "ja", name: nameJa },
      { rallyId: made!.id, locale: "en", name: nameEn },
    ]);
    ralliesCreated++;
  }

  // Which places are in which rally: only for a rally that has none yet (never undoes an admin's changes).
  const allRallies = await db
    .select({ id: rallies.id, kind: rallies.kind, routeId: rallies.routeId })
    .from(rallies);
  const linked = new Set((await db.select({ id: rallySpots.rallyId }).from(rallySpots)).map((r) => r.id));
  const allSpots = await db.select({ id: spots.id, routeId: spots.routeId, sortOrder: spots.sortOrder }).from(spots);
  const courseOrder = new Map(courses.map((c, i) => [c.id, i]));
  const inTrailOrder = [...allSpots].sort(
    (a, b) => (courseOrder.get(a.routeId) ?? 0) - (courseOrder.get(b.routeId) ?? 0) || a.sortOrder - b.sortOrder,
  );

  const links: { rallyId: string; spotId: string; position: number }[] = [];
  for (const rally of allRallies) {
    if (linked.has(rally.id)) continue;
    // The mound rally holds every mound place in trail order; a course rally the places on its course.
    const members = rally.kind === "mounds" ? inTrailOrder : inTrailOrder.filter((s) => s.routeId === rally.routeId);
    members.forEach((s, i) => links.push({ rallyId: rally.id, spotId: s.id, position: i + 1 }));
  }
  if (links.length > 0) await db.insert(rallySpots).values(links);

  return { rallies: ralliesCreated, routes: routesCreated, spots: spotsCreated, links: links.length };
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
