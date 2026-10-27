import { Elysia, t } from "elysia";
import type { Result } from "../admin-lists/list-types";
import { fail } from "../auth/http";
import { rowOut } from "../admin-lists/list-routes";
import { routeKit, type RouteOptions } from "../auth/route-kit";
import { USER_FIELDS, type UserListServices } from "./user-list";

const statusOf = (reason: string) => (reason === "not_found" ? 404 : reason === "validation_failed" ? 422 : 409);

/**
 * The one write of the users list: PATCH /admin/lists/users/:id with `{ updatedAt, role }`, the same shape as every
 * generic list's change, so the generated form saves here unchanged. Needs `user.manage_roles`, which needs a fresh
 * login (403 `reauth_required` until then; the form then asks the admin to confirm it is them).
 */
export function userRoleRoutes(getServices: () => UserListServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  const idParams = t.Object({ id: t.String({ format: "uuid" }) });
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
  )
    // Restrict an account (it can look but not take part), lift that, ask for deletion after 3 days, cancel that, delete now.
    // Every one needs a fresh login, refuses your own account and an admin's, and is audited by account id only.
    .put(
      "/:id/restriction",
      async ({ user, params, body, set }) => respond(set, await getServices().userList.restrict(user.id, params.id, body)),
      {
        auth: "user.restrict",
        rateLimit: { adminWriteUser: "user.id" },
        params: idParams,
        body: t.Object({ reason: t.String({ minLength: 1, maxLength: 200 }), until: t.Union([t.String({ format: "date-time" }), t.Null()]) }),
      },
    )
    .delete("/:id/restriction", async ({ user, params, set }) => respond(set, await getServices().userList.lift(user.id, params.id)), { auth: "user.restrict", rateLimit: { adminWriteUser: "user.id" }, params: idParams })
    .post("/:id/deletion-request", async ({ user, params, set }) => respond(set, await getServices().userList.requestDeletion(user.id, params.id)), { auth: "user.delete", rateLimit: { adminWriteUser: "user.id" }, params: idParams })
    .delete("/:id/deletion-request", async ({ user, params, set }) => respond(set, await getServices().userList.cancelDeletion(user.id, params.id)), { auth: "user.delete", rateLimit: { adminWriteUser: "user.id" }, params: idParams })
    .delete(
      "/:id",
      async ({ user, params, set }) => {
        const r = await getServices().userList.deleteNow(user.id, params.id);
        return r.ok ? { ok: true as const } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "user.delete", rateLimit: { adminWriteUser: "user.id" }, params: idParams },
    );

  function respond(set: Parameters<typeof fail>[0], r: Result<Parameters<typeof rowOut>[0]>) {
    return r.ok ? { ok: true as const, item: rowOut(r.value) } : fail(set, statusOf(r.reason), r.reason);
  }
}
