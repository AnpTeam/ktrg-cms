import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type RouteOptions } from "../auth/route-kit";
import type { StampServices } from "./stamp-routes";

const idParams = t.Object({ id: t.String({ format: "uuid" }) });

/**
 * Reviewing flagged stamps (`stamp.review`, admin only). A revoked stamp is kept as a record and ignored by progress;
 * it can be restored. A course or rally the visitor already finished stays finished (finishes are saved once).
 */
export function stampAdminRoutes(getServices: () => StampServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  const svc = () => getServices().stamps;

  return new Elysia({ prefix: "/admin/stamps", detail: { tags: ["Admin stamps"] } })
    .use(plugins)
    .get(
      "/",
      async ({ query }) => ({
        ok: true as const,
        stamps: (await svc().listFlagged(query.revoked === "true")).map((s) => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
          revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
        })),
      }),
      { auth: "stamp.review", query: t.Object({ revoked: t.Optional(t.Literal("true")) }) },
    )
    .post(
      "/:id/revoke",
      async ({ user, params, set }) => ((await svc().setRevoked(user.id, params.id, true)).ok ? { ok: true as const } : fail(set, 404, "not_found")),
      { auth: "stamp.review", rateLimit: { adminWriteUser: "user.id" }, params: idParams },
    )
    .post(
      "/:id/restore",
      async ({ user, params, set }) => ((await svc().setRevoked(user.id, params.id, false)).ok ? { ok: true as const } : fail(set, 404, "not_found")),
      { auth: "stamp.review", rateLimit: { adminWriteUser: "user.id" }, params: idParams },
    );
}
