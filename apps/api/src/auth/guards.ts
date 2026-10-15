import { Elysia } from "elysia";
import { createHttpHelpers } from "./http";
import { SESSION_SECURITY } from "../openapi";
import { can, needsFreshLogin, type Permission } from "./permissions";
import type { SessionService } from "./session-service";

export const UNAUTHENTICATED = { ok: false, error: "unauthenticated" } as const;
export const FORBIDDEN = { ok: false, error: "forbidden" } as const;
/** The role is allowed, but this permission needs a fresh login: run POST /auth/reauth/request + verify. */
export const REAUTH_REQUIRED = { ok: false, error: "reauth_required" } as const;

/**
 * Route guards. Use the plugin, then name the permission a route needs:
 *
 *   new Elysia()
 *     .use(authGuards({ getSession, secureCookies }))
 *     .get("/public", () => "anyone")                                        // no guard
 *     .get("/me", ({ user }) => user.id, { auth: "me.manage" })              // any logged-in account
 *     .post("/routes", ({ user }) => ..., { auth: "route.manage" })          // admins only
 *
 * - Not logged in, or the session ended: 401 `unauthenticated`.
 * - Logged in but the role lacks the permission: 403 `forbidden`.
 * - Allowed, but the permission needs a fresh login (FRESH_LOGIN_REQUIRED) and the last
 *   login or re-check is older than FRESH_LOGIN_MS: 403 `reauth_required`. Only someone
 *   who has the permission is ever told this.
 * - Otherwise the handler runs, with `user` set (never null) from the database on every
 *   request, so a role change or a deleted session takes effect immediately. `authSession`
 *   carries the session id and its `freshUntil`.
 *
 * The 401 and 403 bodies are fixed and say nothing about why, so they reveal nothing about
 * other accounts or about what exists.
 */
export function authGuards(opts: { getSession: () => SessionService; secureCookies: boolean }) {
  const http = createHttpHelpers({
    secureCookies: opts.secureCookies,
    trustProxy: false, // guards do not use the client IP
    getSession: opts.getSession,
  });

  return new Elysia({ name: "auth-guards" }).macro({
    auth: (permission: Permission) => ({
      // API docs: this route needs the session cookie, and this permission.
      detail: {
        security: SESSION_SECURITY,
        description: `Needs a login with the \`${permission}\` permission${needsFreshLogin(permission) ? " and a fresh login (POST /auth/reauth/verify in the last 10 minutes)" : ""}.`,
      },
      resolve: async ({ headers, set, status }) => {
        const auth = await http.session(headers, set);
        if (!auth) return status(401, UNAUTHENTICATED);
        const { user } = auth;
        if (!can(user.role, permission)) return status(403, FORBIDDEN);
        if (needsFreshLogin(permission) && !auth.fresh) {
          return status(403, REAUTH_REQUIRED);
        }
        return { user, authSession: { id: auth.sessionId, freshUntil: auth.freshUntil } };
      },
    }),
  });
}
