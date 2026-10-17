import { createHash, timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import { fail } from "../auth/http";
import type { MeServices } from "../me/me-routes";

/** Compare two secrets without leaking, through timing, how many leading characters matched. */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Called by a scheduler (the GitHub Actions workflow `purge-deletions.yml`, hourly), never by a person or a
 * browser: it deletes the accounts whose deletion request is more than 3 days old.
 *
 * - It is a POST (it changes data) and needs `Authorization: Bearer <CRON_SECRET>`. A browser page cannot
 *   send that header, so no website can trigger it.
 * - With no CRON_SECRET configured the route does not exist (404), so a deployment that has not set it up
 *   cannot be poked.
 * - It answers only with a count, never an id or an email.
 */
export function purgeRoutes(getServices: () => Pick<MeServices, "me">, cronSecret: string | undefined) {
  return new Elysia({ prefix: "/internal", detail: { hide: true } }).post("/purge-deletions", async ({ headers, set }) => {
    if (!cronSecret) return fail(set, 404, "not_found");
    const match = /^Bearer (.+)$/.exec(headers.authorization ?? "");
    if (!match || !sameSecret(match[1]!, cronSecret)) return fail(set, 401, "unauthenticated");
    const deleted = await getServices().me.purgeDue();
    return { ok: true as const, deleted };
  });
}
