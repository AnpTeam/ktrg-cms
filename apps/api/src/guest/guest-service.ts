import type { Result } from "../content/content-types";
import type { Finished } from "../stamps/stamp-types";
import type { Reading, StampService } from "../stamps/stamp-service";
import { decodeGuest, encodeGuest, GUEST_MAX, type GuestStamp } from "./guest-cookie";

/**
 * Stamps without an account. The place checks are the account's own (stamp-service `check`: open, close enough, accurate
 * enough), so a guest cannot stamp anywhere an account could not. What is kept is the signed cookie (guest-cookie.ts), not a
 * database row: nothing about the visitor is stored here. After sign-up or login `claim` moves the stamps to the account.
 */
export function createGuestService({ stamps, secret, now = () => new Date() }: { stamps: StampService; secret: string; now?: () => Date }) {
  const list = (cookie: string | null | undefined) => decodeGuest(cookie, secret);

  return {
    list,

    /** The guest's stamps with the course each belongs to; a place that is no longer a stamp place is left out. */
    async listWithRoutes(cookie: string | null | undefined) {
      const held = list(cookie);
      const places = await stamps.stampPlaces(held.map((s) => s.spotId));
      return held.flatMap((s) => {
        const place = places.get(s.spotId);
        return place ? [{ spotId: s.spotId, routeId: place.routeId, createdAt: new Date(s.at * 1000) }] : [];
      });
    },

    async collect(cookie: string | null | undefined, r: Reading): Promise<Result<{ spotId: string; createdAt: Date; flagged: boolean; alreadyStamped: boolean; finished: Finished; cookie: string }>> {
      const checked = await stamps.check(r);
      if (!checked.ok) return checked;
      const held = list(cookie);
      const finished: Finished = { routeIds: [], rallyIds: [] }; // finishing a course or rally is an account's: no certificate here
      const mine = held.find((s) => s.spotId === r.spotId);
      if (mine) return { ok: true, value: { spotId: r.spotId, createdAt: new Date(mine.at * 1000), flagged: mine.flagged, alreadyStamped: true, finished, cookie: encodeGuest(held, secret) } };
      if (held.length >= GUEST_MAX) return { ok: false, reason: "guest_full" };
      const at = Math.floor(now().getTime() / 1000);
      const next: GuestStamp[] = [...held, { spotId: r.spotId, at, flagged: checked.value.flagged }];
      return { ok: true, value: { spotId: r.spotId, createdAt: new Date(at * 1000), flagged: checked.value.flagged, alreadyStamped: false, finished, cookie: encodeGuest(next, secret) } };
    },

    /** The cookie's own value, to be kept as a backup (empty when there are no stamps). */
    backup(cookie: string | null | undefined): string {
      const held = list(cookie);
      return held.length > 0 ? encodeGuest(held, secret) : "";
    },

    /** Adds the stamps of a backup to the ones this browser holds (a place held in both keeps its earlier time). Null for a code that is not ours. */
    restore(cookie: string | null | undefined, code: string): { cookie: string; restored: number; total: number } | null {
      const backup = decodeGuest(code, secret);
      if (backup.length === 0) return null;
      const merged = new Map(list(cookie).map((s) => [s.spotId, s]));
      let restored = 0;
      for (const s of backup) {
        const have = merged.get(s.spotId);
        if (!have) restored++;
        if (!have || s.at < have.at) merged.set(s.spotId, s);
      }
      const all = [...merged.values()].sort((a, b) => a.at - b.at).slice(0, GUEST_MAX);
      return { cookie: encodeGuest(all, secret), restored, total: all.length };
    },

    /** Moves the guest's stamps to the account (a place the account already holds is left as it is). Returns how many were new. */
    async claim(userId: string, cookie: string | null | undefined): Promise<{ added: number; already: number }> {
      const held = list(cookie);
      const places = await stamps.stampPlaces(held.map((s) => s.spotId));
      return stamps.awardMany(userId, held.filter((s) => places.has(s.spotId)));
    },
  };
}

export type GuestService = ReturnType<typeof createGuestService>;
