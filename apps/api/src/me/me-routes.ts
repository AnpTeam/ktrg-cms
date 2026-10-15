import { Elysia, t } from "elysia";
import { authGuards } from "../auth/guards";
import { createHttpHelpers } from "../auth/http";
import { AUTH_LIMITS, type RateLimiter } from "../auth/rate-limit";
import type { SessionService } from "../auth/session-service";
import type { MeService } from "./me-service";

export interface MeServices {
  me: MeService;
  session: SessionService;
  rateLimit: RateLimiter;
}

const GONE = { ok: false, error: "unauthenticated" } as const;

/**
 * The logged-in account's own profile. Every route needs a login (`me.manage`), and only
 * ever reads or changes the caller's own row: there is no id in the path to swap.
 */
export function meRoutes(getServices: () => MeServices, opts: { secureCookies: boolean; trustProxy?: boolean }) {
  const http = createHttpHelpers({
    secureCookies: opts.secureCookies,
    trustProxy: opts.trustProxy ?? false,
    getSession: () => getServices().session,
  });

  return (
    new Elysia({ prefix: "/me" })
      .use(authGuards({ getSession: () => getServices().session, secureCookies: opts.secureCookies }))
      .get(
        "/",
        async ({ user, set }) => {
          const me = await getServices().me.get(user);
          if (!me) {
            set.status = 401; // the account was deleted while the session lived
            return GONE;
          }
          return { ok: true as const, me };
        },
        { auth: "me.manage" },
      )
      // Change your language and/or display name. Email and role cannot be changed here.
      .patch(
        "/",
        async ({ user, body, set }) => {
          const result = await getServices().me.update(user, body);
          if (!result.ok) {
            set.status = result.reason === "gone" ? 401 : 400;
            return result.reason === "gone" ? GONE : { ok: false as const, error: "invalid_display_name" as const };
          }
          return { ok: true as const, me: result.profile };
        },
        {
          auth: "me.manage",
          body: t.Object(
            {
              locale: t.Optional(t.Union([t.Literal("ja"), t.Literal("en")])),
              // null clears it. Checked further in the service (length, hidden characters).
              displayName: t.Optional(t.Union([t.String({ maxLength: 200 }), t.Null()])),
            },
            { additionalProperties: false, minProperties: 1 },
          ),
        },
      )
      // Ask for the account to be deleted. Nothing is deleted yet: the request is recorded,
      // audited and emailed to the owner, and can be cancelled until it is carried out.
      .delete(
        "/",
        async ({ user, set }) => {
          const { me, rateLimit } = getServices();
          const limited = http.tooMany(
            set,
            await rateLimit.checkAll([{ rule: AUTH_LIMITS.meDeletionUser, identifier: user.id }]),
          );
          if (limited) return limited;

          const profile = await me.requestDeletion(user);
          if (!profile) {
            set.status = 401;
            return GONE;
          }
          set.status = 202; // accepted: carried out later
          return { ok: true as const, me: profile };
        },
        { auth: "me.manage" },
      )
      .post(
        "/deletion/cancel",
        async ({ user, set }) => {
          const { me, rateLimit } = getServices();
          const limited = http.tooMany(
            set,
            await rateLimit.checkAll([{ rule: AUTH_LIMITS.meDeletionUser, identifier: user.id }]),
          );
          if (limited) return limited;

          const profile = await me.cancelDeletion(user);
          if (!profile) {
            set.status = 401;
            return GONE;
          }
          return { ok: true as const, me: profile };
        },
        { auth: "me.manage" },
      )
  );
}
