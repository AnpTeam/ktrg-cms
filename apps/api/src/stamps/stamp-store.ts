import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { spots, stamps } from "../db/schema";
import { recordFinished } from "../rallies/rally-store";
import type { StampStore } from "./stamp-types";

export function createDrizzleStampStore(db: Db): StampStore {
  return {
    async findSpot(id) {
      const [s] = await db
        .select({
          id: spots.id,
          published: spots.published,
          stampable: spots.stampable,
          positionVerified: spots.positionVerified,
          lat: spots.lat,
          lng: spots.lng,
          radiusM: spots.radiusM,
          status: spots.status,
        })
        .from(spots)
        .where(eq(spots.id, id))
        .limit(1);
      return s ?? null;
    },

    async award(userId, spotId, flag) {
      return db.transaction(async (tx) => {
        // The unique index (user, place) decides a race between two taps: one row, the other sees it.
        const [made] = await tx
          .insert(stamps)
          .values({ userId, spotId, flagged: flag.flagged, flagReason: flag.flagReason })
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
        .select({ spotId: stamps.spotId, createdAt: stamps.createdAt })
        .from(stamps)
        .where(and(eq(stamps.userId, userId), isNull(stamps.revokedAt)))
        .orderBy(desc(stamps.createdAt));
    },

    async setRevoked(actor, id, revoked) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(stamps)
          .set(revoked ? { revokedAt: new Date(), revokedBy: actor } : { revokedAt: null, revokedBy: null })
          // Only a stamp in the other state changes, so a second click keeps the first admin and time.
          .where(and(eq(stamps.id, id), revoked ? isNull(stamps.revokedAt) : isNotNull(stamps.revokedAt)))
          .returning({ id: stamps.id });
        if (!row) {
          const [exists] = await tx.select({ id: stamps.id }).from(stamps).where(eq(stamps.id, id)).limit(1);
          return exists ? "ok" : "not_found";
        }
        await writeAudit(tx, { actorUserId: actor, action: revoked ? "stamp.revoke" : "stamp.restore", targetId: id });
        return "ok";
      });
    },
  };
}
