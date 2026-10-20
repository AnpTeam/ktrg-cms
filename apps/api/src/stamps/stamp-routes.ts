import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import type { ErrorCode } from "../lib/api-errors";
import type { StampService } from "./stamp-service";

export interface StampServices extends KitServices {
  stamps: StampService;
}

function statusOf(reason: ErrorCode): 404 | 409 | 422 {
  switch (reason) {
    case "not_found":
      return 404;
    case "gps_accuracy_poor":
      return 422;
    default:
      return 409; // spot_closed, too_far, stamp_revoked
  }
}

/**
 * Collecting a stamp (`stamp.create`, any signed-in account) and reading your own. Both only ever use the caller's
 * own user id: there is no user id in the path or the body to swap. Stamping again where you already hold a stamp is
 * a no-op answered with `alreadyStamped: true`, not an error. The coordinates in the body are checked and dropped.
 */
export function stampRoutes(getServices: () => StampServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  const svc = () => getServices().stamps;

  return new Elysia({ prefix: "/stamps", detail: { tags: ["Stamps"] } })
    .use(plugins)
    .post(
      "/",
      async ({ user, body, set }) => {
        const r = await svc().collect(user.id, body);
        if (!r.ok) return fail(set, statusOf(r.reason), r.reason);
        const { createdAt, ...rest } = r.value;
        return { ok: true as const, stamp: { ...rest, createdAt: createdAt.toISOString() } };
      },
      {
        auth: "stamp.create",
        rateLimit: { stampUser: "user.id" },
        body: t.Object({
          spotId: t.String({ format: "uuid" }),
          lat: t.Number({ minimum: -90, maximum: 90 }),
          lng: t.Number({ minimum: -180, maximum: 180 }),
          accuracyM: t.Number({ minimum: 0, maximum: 100_000 }),
        }),
      },
    )
    .get(
      "/",
      async ({ user }) => ({
        ok: true as const,
        stamps: (await svc().listMine(user.id)).map((s) => ({ spotId: s.spotId, routeId: s.routeId, createdAt: s.createdAt.toISOString() })),
      }),
      { auth: "stamp.create" },
    );
}
