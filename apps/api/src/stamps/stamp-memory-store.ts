import { memoryReader } from "../admin-lists/list-memory-store";
import type { AuditWriter } from "../audit/audit-log";
import type { ListReadStore } from "../admin-lists/list-types";
import type { StampListRow, StampSpot, StampStore } from "./stamp-types";
import { withTravel, type Fix } from "./travel";

/**
 * In-memory twin for tests: one stamp per visitor and place, revoked ones hidden from the visitor's list.
 * It does not finish courses or rallies (that SQL is covered by db/integration.test.ts), so `finished` is empty.
 * `listStore` is the twin of the admin stamps list over the same rows.
 */
export function createMemoryStampStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const spots = new Map<string, StampSpot>();
  // `at` is when the stamp was pressed (the phone's time for an offline one), which is what a walk is judged by.
  const stamps = new Map<string, StampListRow & { userId: string; spotId: string; at: Date }>();
  let n = 0;
  // Valid UUIDs, because the routes validate ids as such.
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const nothing = () => ({ routeIds: [], rallyIds: [] });

  const store: StampStore = {
    async findSpot(id) {
      return spots.get(id) ?? null;
    },
    async findSpots(ids) {
      return ids.flatMap((id) => spots.get(id) ?? []);
    },
    async awardMany(userId, items) {
      let added = 0;
      for (const i of items) {
        if (!(await store.award(userId, i.spotId, { flagged: i.flagged, flagReason: i.flagReason ?? (i.flagged ? "low_accuracy" : null) })).created) continue;
        added++;
        const row = [...stamps.values()].find((s) => s.userId === userId && s.spotId === i.spotId);
        if (row) row.createdAt = i.createdAt;
      }
      return { added, already: items.length - added };
    },
    async award(userId, spotId, flag) {
      const have = [...stamps.values()].find((s) => s.userId === userId && s.spotId === spotId);
      if (have) return { created: false, createdAt: have.createdAt, flagged: have.flagged, revoked: have.revoked, finished: nothing() };
      const at = now();
      const latest = [...stamps.values()].filter((s) => s.userId === userId && !s.revoked).sort((a, b) => b.at.getTime() - a.at.getTime())[0];
      const place = latest && spots.get(latest.spotId);
      const prev: Fix | null = latest && place?.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng, at: latest.at } : null;
      const { flagged, flagReason } = withTravel(flag, prev, flag.travel);
      const row = { id: uuid(), createdAt: at, updatedAt: at, at: flag.scannedAt ?? at, userId, spotId, memberId: userId.slice(0, 8), spotName: "", flagged, flagReason, revoked: false };
      stamps.set(row.id, row);
      return { created: true, createdAt: at, flagged: row.flagged, revoked: false, finished: nothing() };
    },
    async listMine(userId) {
      return [...stamps.values()].filter((s) => s.userId === userId && !s.revoked).map((s) => ({ spotId: s.spotId, routeId: spots.get(s.spotId)?.routeId ?? "", createdAt: s.createdAt }));
    },
    async listCompletions() {
      return []; // the memory store does not work out finishes (award() returns none)
    },
    async setRevoked(actor, id, revoked) {
      const s = stamps.get(id);
      if (!s) return "not_found";
      if (s.revoked === revoked) return "ok"; // nothing changes: no audit row
      s.revoked = revoked;
      await audit.record({ actorUserId: actor, action: revoked ? "stamp.revoke" : "stamp.restore", targetId: id });
      return "ok";
    },
  };
  // The list shows what the database list shows: no user id, no place id.
  const reader = memoryReader(stamps);
  const strip = ({ userId: _u, spotId: _s, at: _a, ...row }: (typeof stamps extends Map<string, infer R> ? R : never)) => row;
  const listStore: ListReadStore<StampListRow> = {
    list: async (after, limit) => (await reader.list(after, limit)).map(strip),
    get: async (id) => {
      const r = await reader.get(id);
      return r ? strip(r) : null;
    },
  };
  return { store, listStore, spots, stamps };
}
