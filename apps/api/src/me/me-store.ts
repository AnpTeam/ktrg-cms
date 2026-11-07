import { and, eq, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { otpCodes, sessions, users } from "../db/schema";
import type { MeStore, StoredProfile } from "./me-service";

const profileColumns = {
  id: users.id,
  publicId: users.publicId,
  email: users.email,
  role: users.role,
  locale: users.locale,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  origin: users.origin,
  originPlace: users.originPlace,
  ageRange: users.ageRange,
  gender: users.gender,
  foundVia: users.foundVia,
  preferences: users.preferences,
  bookmarks: users.bookmarks,
  deletionRequestedAt: users.deletionRequestedAt,
  deletionByAdmin: users.deletionByAdmin,
  deletionAppeal: users.deletionAppeal,
  createdAt: users.createdAt,
};

type Executor = Pick<Db, "select">;

async function getProfile(db: Executor, userId: string): Promise<StoredProfile | null> {
  const [row] = await db.select(profileColumns).from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export function createDrizzleMeStore(db: Db): MeStore {
  return {
    get: (userId) => getProfile(db, userId),

    async update(userId, changes) {
      if (Object.keys(changes).length === 0) return getProfile(db, userId);
      const [row] = await db
        .update(users)
        .set({ ...changes, updatedAt: sql`now()` })
        .where(eq(users.id, userId))
        .returning(profileColumns);
      return row ?? null;
    },

    async requestDeletion(userId, at) {
      return db.transaction(async (tx) => {
        // Only a real change counts, so two requests at once write one audit row.
        const [row] = await tx
          .update(users)
          .set({ deletionRequestedAt: at, updatedAt: sql`now()` })
          .where(and(eq(users.id, userId), isNull(users.deletionRequestedAt)))
          .returning(profileColumns);
        if (!row) {
          const profile = await getProfile(tx, userId);
          return profile ? { profile, changed: false } : null;
        }
        await writeAudit(tx, { actorUserId: userId, action: "user.deletion_request", targetId: userId });
        return { profile: row, changed: true };
      });
    },

    async purgeDue(cutoff, adminCutoff) {
      const due = or(and(eq(users.deletionByAdmin, false), lte(users.deletionRequestedAt, cutoff)), and(eq(users.deletionByAdmin, true), lte(users.deletionRequestedAt, adminCutoff)));
      return db.transaction(async (tx) => {
        const found = await tx.select({ id: users.id, email: users.email }).from(users).where(and(isNotNull(users.deletionRequestedAt), due));
        let deleted = 0;
        for (const { id, email } of found) {
          // The conditions are repeated so a request cancelled a moment ago is not deleted.
          const [gone] = await tx
            .delete(users)
            .where(and(eq(users.id, id), isNotNull(users.deletionRequestedAt), due))
            .returning({ id: users.id });
          if (!gone) continue;
          // Login codes are kept by email, not user id, so no foreign key removes them.
          if (email) await tx.delete(otpCodes).where(eq(otpCodes.email, email.toLowerCase()));
          // Ids only: the audit log keeps rows for good and holds no personal data.
          await writeAudit(tx, { actorUserId: null, action: "user.deleted", targetId: id });
          deleted++;
        }
        // Sessions nobody came back with stay in the table until they are swept here.
        await tx.delete(sessions).where(lt(sessions.expiresAt, new Date()));
        return deleted;
      });
    },

    async appealDeletion(userId, text) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(users)
          .set({ deletionAppeal: text, updatedAt: sql`now()` })
          .where(and(eq(users.id, userId), isNotNull(users.deletionRequestedAt), eq(users.deletionByAdmin, true)))
          .returning(profileColumns);
        if (!row) {
          const profile = await getProfile(tx, userId);
          return profile ? { profile, changed: false } : null;
        }
        await writeAudit(tx, { actorUserId: userId, action: "user.deletion_appeal", targetId: userId });
        return { profile: row, changed: true };
      });
    },

    async cancelDeletion(userId) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(users)
          .set({ deletionRequestedAt: null, updatedAt: sql`now()` })
          // Not one an admin asked for: that is for an admin to cancel.
          .where(and(eq(users.id, userId), isNotNull(users.deletionRequestedAt), eq(users.deletionByAdmin, false)))
          .returning(profileColumns);
        if (!row) {
          const profile = await getProfile(tx, userId);
          return profile ? { profile, changed: false } : null;
        }
        await writeAudit(tx, { actorUserId: userId, action: "user.deletion_cancel", targetId: userId });
        return { profile: row, changed: true };
      });
    },
  };
}
