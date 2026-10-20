import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { rowOut } from "../admin-lists/list-routes";
import { routeKit, type RouteOptions } from "../auth/route-kit";
import { USER_FIELDS, type UserListServices } from "./user-list";

/**
 * The one write of the users list: PATCH /admin/lists/users/:id with `{ updatedAt, role }`, the same shape as every
 * generic list's change, so the generated form saves here unchanged. Needs `user.manage_roles`, which needs a fresh
 * login (403 `reauth_required` until then; the form then asks the admin to confirm it is them).
 */
export function userRoleRoutes(getServices: () => UserListServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  return new Elysia({ prefix: "/admin/lists/users", detail: { tags: ["Admin lists"] } }).use(plugins).patch(
    "/:id",
    async ({ user, params, body, set }) => {
      const r = await getServices().userList.setRole(user.id, params.id, body.updatedAt, body.role);
      if (r.ok) return { ok: true as const, item: rowOut(r.value) };
      return fail(set, r.reason === "not_found" ? 404 : r.reason === "conflict" || r.reason === "cannot_change_own_role" ? 409 : 400, r.reason);
    },
    {
      auth: "user.manage_roles",
      rateLimit: { adminWriteUser: "user.id" },
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({ updatedAt: t.String({ format: "date-time" }), ...USER_FIELDS }),
    },
  );
}
