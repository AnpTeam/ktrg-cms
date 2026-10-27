import { and, count, countDistinct, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { rallyCompletions, routeTranslations, spots, stamps, users } from "../db/schema";
import type { DashboardStore } from "./dashboard";

const liveStamps = isNull(stamps.revokedAt);

export function createDrizzleDashboardStore(db: Db): DashboardStore {
  const jst = (column: typeof stamps.createdAt | typeof users.createdAt) => sql<string>`to_char(timezone('Asia/Tokyo', ${column}), 'YYYY-MM-DD')`;
  return {
    async totals() {
      const [s, p, u, c, f] = await Promise.all([
        db.select({ n: count() }).from(stamps).where(liveStamps),
        db.select({ n: countDistinct(stamps.userId) }).from(stamps).where(liveStamps),
        db.select({ n: count() }).from(users),
        db.select({ n: count() }).from(rallyCompletions),
        db.select({ n: count() }).from(stamps).where(and(liveStamps, eq(stamps.flagged, true))),
      ]);
      return { stamps: s[0]?.n ?? 0, stampers: p[0]?.n ?? 0, signups: u[0]?.n ?? 0, completions: c[0]?.n ?? 0, flagged: f[0]?.n ?? 0 };
    },
    async since(from) {
      const [s, u, c] = await Promise.all([
        db.select({ n: count() }).from(stamps).where(and(liveStamps, gte(stamps.createdAt, from))),
        db.select({ n: count() }).from(users).where(gte(users.createdAt, from)),
        db.select({ n: count() }).from(rallyCompletions).where(gte(rallyCompletions.completedAt, from)),
      ]);
      return { stamps: s[0]?.n ?? 0, signups: u[0]?.n ?? 0, completions: c[0]?.n ?? 0 };
    },
    async daily(from) {
      const [s, u] = await Promise.all([
        db.select({ day: jst(stamps.createdAt), n: count() }).from(stamps).where(and(liveStamps, gte(stamps.createdAt, from))).groupBy(jst(stamps.createdAt)),
        db.select({ day: jst(users.createdAt), n: count() }).from(users).where(gte(users.createdAt, from)).groupBy(jst(users.createdAt)),
      ]);
      const days = new Map<string, { day: string; stamps: number; signups: number }>();
      for (const r of s) days.set(r.day, { day: r.day, stamps: r.n, signups: 0 });
      for (const r of u) days.set(r.day, { day: r.day, stamps: days.get(r.day)?.stamps ?? 0, signups: r.n });
      return [...days.values()];
    },
    async originSplit() {
      return db.select({ origin: users.origin, users: count() }).from(users).groupBy(users.origin).orderBy(desc(count()));
    },
    async stampsByRoute(from, limit) {
      return db
        .select({ routeId: spots.routeId, name: routeTranslations.name, stamps: count() })
        .from(stamps)
        .innerJoin(spots, eq(stamps.spotId, spots.id))
        .leftJoin(routeTranslations, and(eq(routeTranslations.routeId, spots.routeId), eq(routeTranslations.locale, "ja")))
        .where(and(liveStamps, gte(stamps.createdAt, from)))
        .groupBy(spots.routeId, routeTranslations.name)
        .orderBy(desc(count()))
        .limit(limit);
    },
  };
}
