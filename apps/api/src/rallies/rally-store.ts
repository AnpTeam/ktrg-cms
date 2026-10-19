import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { rallies, rallySpots, spots, stamps } from "../db/schema";
import { computeProgress, type Progress } from "./progress";

/** A database or a transaction: reading is all this needs. */
export type Reader = Pick<Db, "select">;

export interface RallySummary extends Progress {
  id: string;
  kind: "mounds" | "course";
  nameJa: string;
  nameEn: string | null;
  routeId: string | null;
  sortOrder: number;
}

/**
 * Every rally with one visitor's progress in it. No SQL string building: three plain reads, then the
 * pure `computeProgress` decides, so the rules are the ones tested in progress.test.ts.
 */
export async function listRalliesWithProgress(db: Reader, userId: string): Promise<RallySummary[]> {
  const all = await db.select().from(rallies).orderBy(asc(rallies.sortOrder));
  if (all.length === 0) return [];

  const links = await db
    .select({
      rallyId: rallySpots.rallyId,
      spotId: rallySpots.spotId,
      published: spots.published,
      status: spots.status,
    })
    .from(rallySpots)
    .innerJoin(spots, eq(spots.id, rallySpots.spotId))
    .where(
      inArray(
        rallySpots.rallyId,
        all.map((r) => r.id),
      ),
    );

  const spotIds = [...new Set(links.map((l) => l.spotId))];
  const mine =
    spotIds.length === 0
      ? []
      : await db
          .select({ spotId: stamps.spotId, createdAt: stamps.createdAt, revokedAt: stamps.revokedAt })
          .from(stamps)
          // Only this visitor's stamps are ever read.
          .where(and(eq(stamps.userId, userId), inArray(stamps.spotId, spotIds)));

  return all.map((r) => ({
    id: r.id,
    kind: r.kind,
    nameJa: r.nameJa,
    nameEn: r.nameEn,
    routeId: r.routeId,
    sortOrder: r.sortOrder,
    ...computeProgress({
      members: links.filter((l) => l.rallyId === r.id).map((l) => ({ spotId: l.spotId, published: l.published, status: l.status })),
      stamps: mine,
      stampsRequired: r.stampsRequired,
    }),
  }));
}
