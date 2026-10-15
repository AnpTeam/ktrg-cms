import { Elysia } from "elysia";
import { createHttpHelpers } from "./http";
import { can, type Permission } from "./permissions";
import type { SessionService } from "./session-service";

export const UNAUTHENTICATED = { ok: false, error: "unauthenticated" } as const;
export const FORBIDDEN = { ok: false, error: "forbidden" } as const;

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
 * - Otherwise the handler runs, with `user` set (never null) from the database on every
 *   request, so a role change or a deleted session takes effect immediately.
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
      resolve: async ({ headers, set, status }) => {
        const user = await http.authenticate(headers, set);
        if (!user) return status(401, UNAUTHENTICATED);
        if (!can(user.role, permission)) return status(403, FORBIDDEN);
        return { user };
      },
    }),
  });
}
