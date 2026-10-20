import type { AuditWriter } from "../audit/audit-log";
import { REVIEW_PAGE, type ReviewStamp, type StampSpot, type StampStore } from "./stamp-types";

/**
 * In-memory twin for tests: one stamp per visitor and place, revoked ones hidden from the visitor's list.
 * It does not finish courses or rallies (that SQL is covered by db/integration.test.ts), so `finished` is empty.
 */
export function createMemoryStampStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const spots = new Map<string, StampSpot>();
  const stamps = new Map<string, ReviewStamp & { flagged: boolean }>();
  let n = 0;
  // Valid UUIDs, because the routes validate ids as such.
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const nothing = () => ({ routeIds: [], rallyIds: [] });

  const store: StampStore = {
    async findSpot(id) {
      return spots.get(id) ?? null;
    },
    async award(userId, spotId, flag) {
      const have = [...stamps.values()].find((s) => s.userId === userId && s.spotId === spotId);
      if (have) return { created: false, createdAt: have.createdAt, flagged: have.flagged, revoked: !!have.revokedAt, finished: nothing() };
      const row = { id: uuid(), userId, spotId, flagReason: flag.flagReason, flagged: flag.flagged, createdAt: now(), revokedAt: null };
      stamps.set(row.id, row);
      return { created: true, createdAt: row.createdAt, flagged: row.flagged, revoked: false, finished: nothing() };
    },
    async listMine(userId) {
      return [...stamps.values()].filter((s) => s.userId === userId && !s.revokedAt).map((s) => ({ spotId: s.spotId, createdAt: s.createdAt }));
    },
    async listFlagged(revoked) {
      return [...stamps.values()]
        .filter((s) => s.flagged && !!s.revokedAt === revoked)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, REVIEW_PAGE);
    },
    async setRevoked(actor, id, revoked) {
      const s = stamps.get(id);
      if (!s) return "not_found";
      if (!!s.revokedAt === revoked) return "ok"; // nothing changes: no new time, no audit row
      s.revokedAt = revoked ? now() : null;
      await audit.record({ actorUserId: actor, action: revoked ? "stamp.revoke" : "stamp.restore", targetId: id });
      return "ok";
    },
  };
  return { store, spots, stamps };
}
