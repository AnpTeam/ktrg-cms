import { and, between, desc, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { visitCounts } from "../db/schema";
import { MIN_CITY_VIEWS, type VisitStore, type VisitSummary } from "./visits";

export function createDrizzleVisitStore(db: Db): VisitStore {
  return {
    async add(day, place, path) {
      await db
        .insert(visitCounts)
        .values({ day, ...place, path, views: 1 })
        .onConflictDoUpdate({ target: [visitCounts.day, visitCounts.country, visitCounts.region, visitCounts.city, visitCounts.path], set: { views: sql`${visitCounts.views} + 1` } });
    },
    async daily(from, to) {
      return db.select({ day: sql<string>`${visitCounts.day}::text`, views: sql<number>`sum(${visitCounts.views})::int` }).from(visitCounts).where(between(visitCounts.day, from, to)).groupBy(visitCounts.day).orderBy(visitCounts.day);
    },
    async summary(from, to, prefix): Promise<VisitSummary> {
      // starts_with() takes the prefix as a value, so a % or _ in it is not a pattern.
      const where = and(between(visitCounts.day, from, to), prefix === null ? undefined : sql`starts_with(${visitCounts.path}, ${prefix})`);
      const views = sql<number>`sum(${visitCounts.views})::int`;
      const [totals, byCountry, byRegion, cities, topPages] = await Promise.all([
        db.select({ n: views }).from(visitCounts).where(where),
        db.select({ country: visitCounts.country, views }).from(visitCounts).where(where).groupBy(visitCounts.country).orderBy(desc(views)),
        db.select({ country: visitCounts.country, region: visitCounts.region, views }).from(visitCounts).where(where).groupBy(visitCounts.country, visitCounts.region).orderBy(desc(views)),
        db.select({ country: visitCounts.country, region: visitCounts.region, city: visitCounts.city, views }).from(visitCounts).where(where).groupBy(visitCounts.country, visitCounts.region, visitCounts.city).orderBy(desc(views)),
        db.select({ path: visitCounts.path, views }).from(visitCounts).where(where).groupBy(visitCounts.path).orderBy(desc(views)).limit(20),
      ]);
      const shown = cities.filter((c) => c.views >= MIN_CITY_VIEWS && c.city !== "");
      return {
        total: totals[0]?.n ?? 0,
        byCountry,
        byRegion,
        byCity: shown,
        hiddenCityViews: cities.reduce((n, c) => n + c.views, 0) - shown.reduce((n, c) => n + c.views, 0),
        topPages,
      };
    },
  };
}
