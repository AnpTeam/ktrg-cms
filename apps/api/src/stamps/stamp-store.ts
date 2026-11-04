import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { courseCompletions, rallyCompletions, spots, stamps } from "../db/schema";
import { ralliesForPlace, recordFinished } from "../rallies/rally-store";
import type { StampStore } from "./stamp-types";

const spotColumns = {
  id: spots.id,
  routeId: spots.routeId,
  published: spots.published,
  stampable: spots.stampable,
  positionVerified: spots.positionVerified,
  lat: spots.lat,
  lng: spots.lng,
  radiusM: spots.radiusM,
  status: spots.status,
  statusUpdatedAt: spots.statusUpdatedAt,
};

export function createDrizzleStampStore(db: Db): StampStore {
  return {
    async findSpot(id) {
      const [s] = await db.select(spotColumns).from(spots).where(eq(spots.id, id)).limit(1);
      return s ?? null;
    },

    async findSpots(ids) {
      return ids.length ? db.select(spotColumns).from(spots).where(inArray(spots.id, ids)) : [];
    },

    async awardMany(userId, items) {
      if (items.length === 0) return { added: 0, already: 0 };
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`stamps.${userId}`}))`);
        const made = await tx
          .insert(stamps)
          .values(items.map((i) => ({ userId, spotId: i.spotId, flagged: i.flagged, flagReason: i.flagged ? "low_accuracy" : null })))
          .onConflictDoNothing()
          .returning({ id: stamps.id });
        if (made.length) await recordFinished(tx, userId);
        return { added: made.length, already: items.length - made.length };
      });
    },

    async award(userId, spotId, flag) {
      return db.transaction(async (tx) => {
        // Two stamps by one visitor at once would each miss the other when working out a finish: serialise them per user.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`stamps.${userId}`}))`);
        // The unique index (user, place) decides a race between two taps: one row, the other sees it.
        const [made] = await tx
          .insert(stamps)
          .values({ userId, spotId, flagged: flag.flagged, flagReason: flag.flagReason, scannedAt: flag.scannedAt ?? null })
          .onConflictDoNothing()
          .returning({ createdAt: stamps.createdAt, flagged: stamps.flagged });
        if (!made) {
          const [have] = await tx
            .select({ createdAt: stamps.createdAt, flagged: stamps.flagged, revokedAt: stamps.revokedAt })
            .from(stamps)
            .where(and(eq(stamps.userId, userId), eq(stamps.spotId, spotId)))
            .limit(1);
          return { created: false, createdAt: have!.createdAt, flagged: have!.flagged, revoked: have!.revokedAt !== null, finished: { routeIds: [], rallyIds: [] } };
        }
        return { created: true, createdAt: made.createdAt, flagged: made.flagged, revoked: false, finished: await recordFinished(tx, userId, { spotId }) };
      });
    },

    listMine(userId) {
      return db
        .select({ spotId: stamps.spotId, routeId: spots.routeId, createdAt: stamps.createdAt })
        .from(stamps)
        .innerJoin(spots, eq(spots.id, stamps.spotId))
        .where(and(eq(stamps.userId, userId), isNull(stamps.revokedAt)))
        .orderBy(desc(stamps.createdAt));
    },

    listCompletions(userId) {
      return db.select({ rallyId: rallyCompletions.rallyId, completedAt: rallyCompletions.completedAt }).from(rallyCompletions).where(eq(rallyCompletions.userId, userId));
    },

    async setRevoked(actor, id, revoked) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(stamps)
          .set(revoked ? { revokedAt: new Date(), revokedBy: actor } : { revokedAt: null, revokedBy: null })
          // Only a stamp in the other state changes, so a second click keeps the first admin and time.
          .where(and(eq(stamps.id, id), revoked ? isNull(stamps.revokedAt) : isNotNull(stamps.revokedAt)))
          .returning({ id: stamps.id, userId: stamps.userId, spotId: stamps.spotId });
        if (!row) {
          const [exists] = await tx.select({ id: stamps.id }).from(stamps).where(eq(stamps.id, id)).limit(1);
          return exists ? "ok" : "not_found";
        }
        if (revoked) {
          // A saved finish only ever grows, so a revoked stamp would leave "complete" standing: drop the finishes it was part of.
          // They are saved again the next time the visitor stamps or their progress is read, if they still hold every stamp.
          const touched = await ralliesForPlace(tx, row.spotId);
          if (touched.routeIds.length) await tx.delete(courseCompletions).where(and(eq(courseCompletions.userId, row.userId), inArray(courseCompletions.routeId, touched.routeIds)));
          if (touched.rallyIds.length) await tx.delete(rallyCompletions).where(and(eq(rallyCompletions.userId, row.userId), inArray(rallyCompletions.rallyId, touched.rallyIds)));
        }
        await writeAudit(tx, { actorUserId: actor, action: revoked ? "stamp.revoke" : "stamp.restore", targetId: id });
        return "ok";
      });
    },
  };
}
