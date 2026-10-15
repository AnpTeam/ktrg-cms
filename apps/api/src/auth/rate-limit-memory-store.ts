import type { RateLimitStore } from "./rate-limit";

/** In-memory store for tests and manual checks. */
export function createMemoryRateLimitStore() {
  const counts = new Map<string, { key: string; windowStart: number; count: number }>();

  const store: RateLimitStore = {
    async hit(key, windowStart) {
      const id = `${key}|${windowStart.getTime()}`;
      const row = counts.get(id) ?? { key, windowStart: windowStart.getTime(), count: 0 };
      row.count++;
      counts.set(id, row);
      return row.count;
    },
    async prune(before) {
      for (const [id, row] of counts) if (row.windowStart < before.getTime()) counts.delete(id);
    },
  };

  return { store, counts };
}
