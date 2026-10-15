import { lt, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { rateLimits } from "../db/schema";
import type { RateLimitStore } from "./rate-limit";

export function createDrizzleRateLimitStore(db: Db): RateLimitStore {
  return {
    async hit(key, windowStart) {
      // One atomic upsert: concurrent requests cannot both read the same count.
      const [row] = await db
        .insert(rateLimits)
        .values({ key, windowStart, count: 1 })
        .onConflictDoUpdate({
          target: [rateLimits.key, rateLimits.windowStart],
          set: { count: sql`${rateLimits.count} + 1` },
        })
        .returning({ count: rateLimits.count });
      if (!row) throw new Error("rate limit upsert returned no row");
      return row.count;
    },

    async prune(before) {
      await db.delete(rateLimits).where(lt(rateLimits.windowStart, before));
    },
  };
}
