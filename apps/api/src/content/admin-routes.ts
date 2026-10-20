import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import type { ErrorCode } from "../lib/api-errors";
import type { RoutingService } from "../routing/routing-service";
import type { ContentService } from "./content-service";
import type { Result, RouteRow, RouteSummaryRow, SpotRow } from "./content-types";

export interface ContentServices extends KitServices {
  content: ContentService;
  /** Snaps a drawn line to trails (the admin's map editor). */
  routing: RoutingService;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Routes and places as JSON: times are ISO text, so the editor can send the same text back as `updatedAt`. */
const routeOut = (r: RouteRow | RouteSummaryRow) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});
const spotOut = (s: SpotRow) => ({
  ...s,
  statusUpdatedAt: iso(s.statusUpdatedAt),
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

/** What each refusal looks like over HTTP. */
function statusOf(reason: ErrorCode): 400 | 404 | 409 | 422 {
  switch (reason) {
    case "not_found":
      return 404;
    case "validation_failed":
      return 422;
    case "invalid_video_url":
    case "invalid_line":
    case "invalid_photo_url":
    case "source_required":
      return 400;
    default:
      return 409; // conflict, route_has_places, spot_has_stamps, no_coordinates, position_not_verified, permission_required
  }
}

const nullable = <T extends ReturnType<typeof t.String> | ReturnType<typeof t.Number> | ReturnType<typeof t.Integer>>(s: T) => t.Union([s, t.Null()]);

const prefecture = t.Union([t.Literal("osaka"), t.Literal("wakayama"), t.Literal("nara")]);
// Written out as literals: a union built by mapping over a list loses its literal types for the typed web client.
const kind = t.Union([
  t.Literal("temple"),
  t.Literal("mound"),
  t.Literal("view"),
  t.Literal("turn"),
  t.Literal("danger"),
  t.Literal("toilet"),
  t.Literal("rest_area"),
  t.Literal("drinking_water"),
  t.Literal("vending_machine"),
  t.Literal("bus_stop"),
  t.Literal("station"),
  t.Literal("parking"),
  t.Literal("other"),
]);
const status = t.Union([t.Literal("open"), t.Literal("caution"), t.Literal("closed")]);
const uuid = t.String({ format: "uuid" });
const idParams = t.Object({ id: uuid });

const routeProps = {
  nameJa: t.String({ minLength: 1, maxLength: 200 }),
  nameEn: nullable(t.String({ maxLength: 200 })),
  descriptionJa: nullable(t.String({ maxLength: 20000 })),
  descriptionEn: nullable(t.String({ maxLength: 20000 })),
  distanceKm: nullable(t.Number({ minimum: 0, maximum: 2000 })),
  elevationGainM: nullable(t.Integer({ minimum: 0, maximum: 10000 })),
  difficulty: nullable(t.String({ maxLength: 100 })),
  expectedTimeMin: nullable(t.Integer({ minimum: 0, maximum: 20000 })),
  prefecture: t.Union([prefecture, t.Null()]),
  municipality: nullable(t.String({ maxLength: 100 })),
  // Shape and range are checked by the service (parseLine); any JSON gets there.
  geometry: t.Unknown(),
  lineVerified: t.Boolean(),
  lineSource: nullable(t.String({ maxLength: 500 })),
  videoUrl: nullable(t.String({ maxLength: 500 })),
  historyJa: nullable(t.String({ maxLength: 20000 })),
  historyEn: nullable(t.String({ maxLength: 20000 })),
  accessJa: nullable(t.String({ maxLength: 20000 })),
  accessEn: nullable(t.String({ maxLength: 20000 })),
  photoUrl: nullable(t.String({ maxLength: 500 })),
};
const spotProps = {
  nameJa: t.String({ minLength: 1, maxLength: 200 }),
  nameEn: nullable(t.String({ maxLength: 200 })),
  descriptionJa: nullable(t.String({ maxLength: 20000 })),
  descriptionEn: nullable(t.String({ maxLength: 20000 })),
  lat: nullable(t.Number({ minimum: -90, maximum: 90 })),
  lng: nullable(t.Number({ minimum: -180, maximum: 180 })),
  positionVerified: t.Boolean(),
  positionSource: nullable(t.String({ maxLength: 500 })),
  radiusM: t.Integer({ minimum: 5, maximum: 1000 }),
  kind,
  // A stamp can be collected here; when a new waypoint leaves it out, it starts from the kind (stampableByDefault).
  stampable: t.Boolean(),
  photoUrl: nullable(t.String({ maxLength: 500 })),
  status,
  statusNoteJa: nullable(t.String({ maxLength: 1000 })),
  statusNoteEn: nullable(t.String({ maxLength: 1000 })),
  permissionConfirmed: t.Boolean(),
  permissionNote: nullable(t.String({ maxLength: 500 })),
};
const expected = { updatedAt: t.String({ format: "date-time" }) };

const createRouteBody = t.Composite([t.Pick(t.Object(routeProps), ["nameJa"]), t.Partial(t.Omit(t.Object(routeProps), ["nameJa"]))]);
const updateRouteBody = t.Composite([t.Object(expected), t.Partial(t.Object(routeProps))]);
const createSpotBody = t.Composite([t.Pick(t.Object(spotProps), ["nameJa"]), t.Partial(t.Omit(t.Object(spotProps), ["nameJa"]))]);
const updateSpotBody = t.Composite([t.Object(expected), t.Partial(t.Object(spotProps))]);
const orderBody = t.Object({ ids: t.Array(uuid, { maxItems: 1000 }) });

/**
 * The admin side of routes and places: list, edit, reorder, publish. Every route needs a login with the
 * right permission (route.manage / spot.manage / spot.publish, all admin-only in permissions.ts); writes are
 * rate limited and audited by the store. An edit carries the `updatedAt` the editor loaded, so two admins
 * cannot silently overwrite each other (409 `conflict`).
 */
export function adminContentRoutes(getServices: () => ContentServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  const svc = () => getServices().content;

  return new Elysia({ prefix: "/admin", detail: { tags: ["Admin content"] } })
    .use(plugins)
    // ---- routes ----------------------------------------------------------------------------
    .get("/routes", async () => ({ ok: true as const, routes: (await svc().listRoutes()).map(routeOut) }), { auth: "route.manage" })
    .get(
      "/routes/:id",
      async ({ params, set }) => {
        const found = await svc().getRoute(params.id);
        return found ? { ok: true as const, route: routeOut(found.route), spots: found.spots.map(spotOut) } : fail(set, 404, "not_found");
      },
      { auth: "route.manage", params: idParams },
    )
    .post(
      "/routes",
      async ({ user, body, set }) => {
        const r: Result<RouteRow> = await svc().createRoute(user.id, body);
        if (!r.ok) return fail(set, statusOf(r.reason), r.reason);
        set.status = 201;
        return { ok: true as const, route: routeOut(r.value) };
      },
      { auth: "route.manage", rateLimit: { adminWriteUser: "user.id" }, body: createRouteBody },
    )
    // Registered before "/routes/:id" patterns would matter: this one is a fixed path.
    .put(
      "/routes/order",
      async ({ user, body, set }) => {
        const r = await svc().reorderRoutes(user.id, body.ids);
        return r.ok ? { ok: true as const } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "route.manage", rateLimit: { adminWriteUser: "user.id" }, body: orderBody },
    )
    .patch(
      "/routes/:id",
      async ({ user, params, body, set }) => {
        const { updatedAt, ...changes } = body;
        const r = await svc().updateRoute(user.id, params.id, updatedAt, changes);
        return r.ok ? { ok: true as const, route: routeOut(r.value) } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "route.manage", rateLimit: { adminWriteUser: "user.id" }, params: idParams, body: updateRouteBody },
    )
    .delete(
      "/routes/:id",
      async ({ user, params, set }) => {
        const r = await svc().deleteRoute(user.id, params.id);
        return r.ok ? { ok: true as const } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "route.manage", rateLimit: { adminWriteUser: "user.id" }, params: idParams },
    )
    // ---- snapping a drawn line to trails -----------------------------------------------------
    .post(
      "/route-snap",
      async ({ body, set }) => {
        const r = await getServices().routing.snap(body.points);
        if (r.ok) return { ok: true as const, line: r.line, distanceM: r.distanceM };
        return fail(set, r.reason === "routing_unavailable" ? 503 : r.reason === "routing_no_route" ? 422 : 502, r.reason);
      },
      {
        auth: "route.manage",
        rateLimit: { adminRoutingUser: "user.id" },
        body: t.Object({
          // Two to fifty points: the most the service takes in one request.
          points: t.Array(t.Object({ lat: t.Number({ minimum: -90, maximum: 90 }), lng: t.Number({ minimum: -180, maximum: 180 }) }), { minItems: 2, maxItems: 50 }),
        }),
      },
    )
    // ---- places ----------------------------------------------------------------------------
    .post(
      "/routes/:id/spots",
      async ({ user, params, body, set }) => {
        const r = await svc().createSpot(user.id, params.id, body);
        if (!r.ok) return fail(set, statusOf(r.reason), r.reason);
        set.status = 201;
        return { ok: true as const, spot: spotOut(r.value) };
      },
      { auth: "spot.manage", rateLimit: { adminWriteUser: "user.id" }, params: idParams, body: createSpotBody },
    )
    .put(
      "/routes/:id/spots/order",
      async ({ user, params, body, set }) => {
        const r = await svc().reorderSpots(user.id, params.id, body.ids);
        return r.ok ? { ok: true as const } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "spot.manage", rateLimit: { adminWriteUser: "user.id" }, params: idParams, body: orderBody },
    )
    .patch(
      "/spots/:id",
      async ({ user, params, body, set }) => {
        const { updatedAt, ...changes } = body;
        const r = await svc().updateSpot(user.id, params.id, updatedAt, changes);
        return r.ok ? { ok: true as const, spot: spotOut(r.value) } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "spot.manage", rateLimit: { adminWriteUser: "user.id" }, params: idParams, body: updateSpotBody },
    )
    .post(
      "/spots/:id/publish",
      async ({ user, params, set }) => {
        const r = await svc().publishSpot(user.id, params.id);
        return r.ok ? { ok: true as const, spot: spotOut(r.value) } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "spot.publish", rateLimit: { adminWriteUser: "user.id" }, params: idParams },
    )
    .post(
      "/spots/:id/unpublish",
      async ({ user, params, set }) => {
        const r = await svc().unpublishSpot(user.id, params.id);
        return r.ok ? { ok: true as const, spot: spotOut(r.value) } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "spot.publish", rateLimit: { adminWriteUser: "user.id" }, params: idParams },
    )
    .delete(
      "/spots/:id",
      async ({ user, params, set }) => {
        const r = await svc().deleteSpot(user.id, params.id);
        return r.ok ? { ok: true as const } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: "spot.manage", rateLimit: { adminWriteUser: "user.id" }, params: idParams },
    );
}
