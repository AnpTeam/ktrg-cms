import { Elysia, t } from "elysia";
import { rowOut } from "../admin-lists/list-routes";
import { fail } from "../auth/http";
import { routeKit, type RouteOptions } from "../auth/route-kit";
import { STAMP_FIELDS, type StampListServices } from "./stamp-list";
import type { StampServices } from "./stamp-routes";

/**
 * The one write of the stamps list: PATCH /admin/lists/stamps/:id with `{ updatedAt, revoked }`, the same shape as
 * every generic list's change, so the generated form saves here unchanged (`updatedAt` is not checked: revoking is
 * idempotent). A revoked stamp is kept and ignored by progress; it can be restored. A course or rally the visitor
 * already finished stays finished (finishes are saved once).
 */
export function stampAdminRoutes(getServices: () => StampServices & StampListServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  return new Elysia({ prefix: "/admin/lists/stamps", detail: { tags: ["Admin lists"] } }).use(plugins).patch(
    "/:id",
    async ({ user, params, body, set }) => {
      const r = await getServices().stamps.setRevoked(user.id, params.id, body.revoked);
      const item = r.ok ? await getServices().stampList.get(params.id) : null;
      return item ? { ok: true as const, item: rowOut(item) } : fail(set, 404, "not_found");
    },
    {
      auth: "stamp.review",
      rateLimit: { adminWriteUser: "user.id" },
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({ updatedAt: t.String({ format: "date-time" }), ...STAMP_FIELDS }),
    },
  );
}
