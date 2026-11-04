import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import { readCookie, serializeSessionCookie } from "../auth/session";
import type { ErrorCode } from "../lib/api-errors";
import type { GuestService } from "./guest-service";
import type { StampServices } from "../stamps/stamp-routes";

export interface GuestServices extends KitServices, StampServices {
  guest: GuestService;
}

const YEAR_SEC = 365 * 24 * 60 * 60;

function statusOf(reason: ErrorCode): 404 | 409 | 422 {
  if (reason === "not_found") return 404;
  if (reason === "gps_accuracy_poor" || reason === "stale_scan" || reason === "bad_time") return 422;
  return 409; // spot_closed, too_far, guest_full
}

/**
 * Stamps for a visitor with no account: same checks as POST /stamps, kept in a signed cookie (guest/guest-cookie.ts) instead of
 * the database. `claim` (signed in) moves them to the account; `mode: "account"` drops them and keeps what the account has.
 */
export function guestRoutes(getServices: () => GuestServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  const name = opts.secureCookies ? "__Host-guest" : "guest";
  const guest = () => getServices().guest;
  const setCookie = (value: string) => serializeSessionCookie({ name, value, maxAgeSec: YEAR_SEC, secure: opts.secureCookies });
  const clearCookie = () => serializeSessionCookie({ name, value: "", maxAgeSec: 0, secure: opts.secureCookies });

  return new Elysia({ prefix: "/guest", detail: { tags: ["Stamps"] } })
    .use(plugins)
    .post(
      "/stamps",
      async ({ body, headers, set }) => {
        const r = await guest().collect(readCookie(headers.cookie, name), body);
        if (!r.ok) return fail(set, statusOf(r.reason), r.reason);
        const { cookie, createdAt, ...rest } = r.value;
        set.headers["set-cookie"] = setCookie(cookie);
        return { ok: true as const, stamp: { ...rest, createdAt: createdAt.toISOString() } };
      },
      {
        rateLimit: { stampGuestIp: "ip" },
        body: t.Object({
          spotId: t.String({ format: "uuid" }),
          lat: t.Number({ minimum: -90, maximum: 90 }),
          lng: t.Number({ minimum: -180, maximum: 180 }),
          accuracyM: t.Number({ minimum: 0, maximum: 100_000 }),
          scannedAt: t.Optional(t.String({ format: "date-time" })),
        }),
        detail: { summary: "Collect a stamp without an account (kept in a signed cookie)" },
      },
    )
    .get(
      "/stamps",
      async ({ headers }) => ({
        ok: true as const,
        stamps: (await guest().listWithRoutes(readCookie(headers.cookie, name))).map((s) => ({ spotId: s.spotId, routeId: s.routeId, createdAt: s.createdAt.toISOString() })),
      }),
      { detail: { summary: "The stamps kept in this browser's guest cookie" } },
    )
    .get(
      "/backup",
      ({ headers }) => ({ ok: true as const, code: guest().backup(readCookie(headers.cookie, name)) }),
      { detail: { summary: "A code that brings this browser's guest stamps back in another browser (see /restore)" } },
    )
    .post(
      "/restore",
      ({ body, headers, set }) => {
        const r = guest().restore(readCookie(headers.cookie, name), body.code);
        if (!r) return fail(set, 422, "validation_failed");
        set.headers["set-cookie"] = setCookie(r.cookie);
        return { ok: true as const, restored: r.restored, total: r.total };
      },
      {
        rateLimit: { stampGuestIp: "ip" },
        body: t.Object({ code: t.String({ minLength: 1, maxLength: 6000, pattern: "^[A-Za-z0-9_.-]+$" }) }),
        detail: { summary: "Bring back guest stamps from a backup code" },
      },
    )
    .post(
      "/claim",
      async ({ user, body, headers, set }) => {
        const cookie = readCookie(headers.cookie, name);
        const result = body.mode === "merge" ? await guest().claim(user.id, cookie) : { added: 0, already: 0 };
        set.headers["set-cookie"] = clearCookie();
        return { ok: true as const, ...result };
      },
      {
        auth: "stamp.create",
        body: t.Object({ mode: t.Union([t.Literal("merge"), t.Literal("account")]) }),
        detail: { summary: "Move the guest stamps to this account (merge), or drop them and keep the account's (account)" },
      },
    );
}
